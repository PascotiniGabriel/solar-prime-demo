/* SP.store - persistência em localStorage (chave 'solarprime_v1') + sessão ("Ver como").
 * Coleções: usuarios, leads, conversas, propostas, contratos, tarefas, obras, estoque,
 * lancamentos, campanhas, metas, auditoria. Objeto 'empresa' avulso. */
(function () {
  'use strict';
  var KEY = 'solarprime_v1', SKEY = 'solarprime_session', SEED_VERSION = 2;
  var cache = null, listeners = [];

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* quota/privado: segue em memória */ } }
  function load() {
    if (cache) return cache;
    try { var raw = localStorage.getItem(KEY); if (raw) { cache = JSON.parse(raw); if (cache && cache.leads && cache._seedV === SEED_VERSION) return cache; } } catch (e) { /* ignora */ }
    cache = SP.buildSeed(); cache._seedV = SEED_VERSION; persist(); return cache;
  }
  function emit(info) { listeners.slice().forEach(function (fn) { try { fn(info); } catch (e) { console.error(e); } }); }

  var store = {
    /** Banco completo (objeto vivo; após alterar chame save()). */
    get: function () { return load(); },
    save: function (info) { persist(); emit(info || { type: 'save' }); },
    /** update(fn(db)) - muta o banco dentro de fn e salva. */
    update: function (fn) { var db = load(); fn(db); store.save({ type: 'update' }); return db; },
    collection: function (name) { var db = load(); if (!db[name]) db[name] = []; return db[name]; },
    find: function (name, id) { var c = store.collection(name); for (var i = 0; i < c.length; i++) if (c[i].id === id) return c[i]; return null; },
    where: function (name, fn) { return store.collection(name).filter(fn); },
    nextId: function (prefix) { var c = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); return prefix + c; },
    /** upsert(name, item) - insere (gera id se faltar) ou substitui por id. Retorna o item. */
    upsert: function (name, item) {
      var c = store.collection(name);
      if (!item.id) item.id = store.nextId(name.charAt(0));
      var ix = -1; for (var i = 0; i < c.length; i++) if (c[i].id === item.id) { ix = i; break; }
      if (ix >= 0) c[ix] = item; else c.unshift(item);
      store.save({ type: 'upsert', name: name, id: item.id }); return item;
    },
    /** patch(name, id, partial) - mescla campos num item existente. */
    patch: function (name, id, partial) { var it = store.find(name, id); if (!it) return null; Object.assign(it, partial); store.save({ type: 'patch', name: name, id: id }); return it; },
    remove: function (name, id) { var db = load(); db[name] = (db[name] || []).filter(function (x) { return x.id !== id; }); store.save({ type: 'remove', name: name, id: id }); },
    /** log(acao, entidade, entidadeId, detalhe) - registra na auditoria com o usuário atual. */
    log: function (acao, entidade, entidadeId, detalhe) {
      var c = store.collection('auditoria');
      c.unshift({ id: store.nextId('a'), usuarioId: SP.session.userId, acao: acao, entidade: entidade, entidadeId: entidadeId, detalhe: detalhe || '', em: new Date().toISOString() });
      persist();
    },
    /** Escuta mudanças: fn({type,name,id}). Retorna função para cancelar. */
    on: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    reset: function () { cache = SP.buildSeed(); persist(); emit({ type: 'reset' }); },

    user: function (id) { return store.find('usuarios', id); },
    lead: function (id) { return store.find('leads', id); },
    /** Leads que o papel atual enxerga (vendedor: só os seus; técnico: a partir da análise técnica). */
    visibleLeads: function () {
      var s = SP.session, all = store.collection('leads');
      if (s.role === 'vendedor') return all.filter(function (l) { return l.vendedorId === s.userId; });
      if (s.role === 'tecnico') return all.filter(function (l) { return ['analise_tecnica', 'venda_fechada', 'instalacao', 'pos_venda'].indexOf(l.etapa) >= 0; });
      return all;
    },
    vendedores: function () { return store.collection('usuarios').filter(function (u) { return u.papel === 'vendedor'; }); }
  };

  /* ---------- sessão ("Ver como") ---------- */
  var ROLE_USER = { dono: 'u1', vendedor: 'u2', tecnico: 'u7', financeiro: 'u8', trafego: 'u_trafego' };
  var sess = { role: 'dono', userId: 'u1' };
  try { var sv = localStorage.getItem(SKEY); if (sv && ROLE_USER[sv]) { sess.role = sv; sess.userId = ROLE_USER[sv]; } } catch (e) { /* ignora */ }
  sess.ROLE_USER = ROLE_USER;
  sess.user = function () { return store.user(sess.userId); };
  sess.set = function (role) {
    if (!ROLE_USER[role]) return;
    sess.role = role; sess.userId = ROLE_USER[role];
    try { localStorage.setItem(SKEY, role); } catch (e) { /* ignora */ }
    emit({ type: 'session', role: role });
  };

  SP.store = store;
  SP.session = sess;
})();
