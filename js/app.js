/* SP.app - shell: roteador por hash, menu lateral, topbar, busca global (Ctrl+K), notificações, "Ver como".
 * Módulos se registram com SP.register({route,title,icon,group,order,roles,render(el,params)}). */
(function () {
  'use strict';
  var ui = SP.ui, store = SP.store;
  var modules = [], byRoute = {};
  var GROUPS = ['', 'Vendas', 'Operação', 'Gestão'];
  var ROLES = ['dono', 'vendedor', 'tecnico', 'financeiro', 'trafego'];
  var current = null;
  var EXTRA_ROLES = { inicio: ['trafego'], leads: ['trafego'], funil: ['trafego'], marketing: ['trafego'], importar: ['trafego'] };
  /* Etapas ativas (base + personalizadas de db.config.etapas, sem as removidas). opts.semPerdido omite "perdido". */
  var baseEtapa = SP.consts.etapa;
  function cfgEtapas() { var c = (store.get() || {}).config || {}; return { list: c.etapas || [], rem: c.etapasRemovidas || [] }; }
  SP.consts.etapasAtivas = function (opts) {
    var c = cfgEtapas(), out = [], seen = {}, base = SP.consts.ETAPAS;
    function push(e, cfg) { if (seen[e.id]) return; seen[e.id] = 1; out.push({ id: e.id, nome: (cfg && cfg.nome) || e.nome, cor: (cfg && /^#[0-9a-f]{6}$/i.test(cfg.cor || '') && cfg.cor) || e.cor || '#64748B', oculta: !!(cfg && cfg.oculta), custom: !!(cfg && cfg.custom && !e.base) }); }
    c.list.forEach(function (x) { if (!x || !x.id || x.id === 'perdido') return; var b = base.filter(function (e) { return e.id === x.id; })[0]; if (b) push(b, x); else if (x.custom) push({ id: x.id, nome: x.nome || 'Etapa', cor: x.cor }, x); });
    base.forEach(function (e) { if (e.id !== 'perdido' && c.rem.indexOf(e.id) < 0) push(e, null); });
    if (!(opts && opts.semPerdido)) { var p = base.filter(function (e) { return e.id === 'perdido'; })[0]; if (p) push(p, null); }
    return out;
  };
  SP.consts.etapa = function (id) {
    var c = cfgEtapas(), x = c.list.filter(function (e) { return e && e.id === id; })[0], b = baseEtapa(id);
    if (!x) return b;
    return { id: id, nome: x.nome || b.nome, cor: (/^#[0-9a-f]{6}$/i.test(x.cor || '') && x.cor) || b.cor || '#64748B' };
  };
  SP.consts.PAPEIS.trafego = SP.consts.PAPEIS.trafego || 'Gestora de tráfego';
  if (SP.session.ROLE_USER) {
    SP.session.ROLE_USER.trafego = 'u_trafego';
    try { if (localStorage.getItem('solarprime_session') === 'trafego') { SP.session.role = 'trafego'; SP.session.userId = 'u_trafego'; } } catch (e) { /* ignora */ }
  }
  function hasRole(m, role) { return m.roles.indexOf(role) >= 0 || (EXTRA_ROLES[m.route] || []).indexOf(role) >= 0; }

  SP.modules = modules;
  SP.register = function (def) {
    if (!def || !def.route) throw new Error('SP.register: route obrigatório');
    def.roles = def.roles || ROLES; def.group = def.group || ''; def.order = def.order == null ? 50 : def.order;
    if (def.route === 'importar') def.group = 'Gestão';
    if (byRoute[def.route]) modules.splice(modules.indexOf(byRoute[def.route]), 1);
    modules.push(def); byRoute[def.route] = def;
    modules.sort(function (a, b) { return a.order - b.order; });
  };
  var AREA_ROUTES = { leads: 'Leads e funil', funil: 'Leads e funil', conversas: 'Leads e funil', propostas: 'Propostas e contratos', contratos: 'Propostas e contratos', obras: 'Obras e estoque', estoque: 'Obras e estoque', financeiro: 'Financeiro', metas: 'Metas e ranking', marketing: 'Marketing', config: 'Configurações' };
  function allowed(m) {
    var role = SP.session.role;
    if (!hasRole(m, role)) return false;
    if (role === 'trafego') return true;
    var cfg = store.get().config, perm = cfg && cfg.permissoes, area = AREA_ROUTES[m.route], i = ROLES.indexOf(role);
    if (perm && area && perm[area] && role !== 'dono') return !!perm[area][i];
    return true;
  }
  function applyBrand() { var c = (store.get().config || {}).logoCor; if (c) document.documentElement.style.setProperty('--primary', c); }
  function allowedList() { return modules.filter(allowed); }

  /* ---------- roteamento ---------- */
  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, ''), q = {}, ix = h.indexOf('?');
    if (ix >= 0) { h.slice(ix + 1).split('&').forEach(function (p) { var kv = p.split('='); if (kv[0]) q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); }); h = h.slice(0, ix); }
    var segs = h.split('/').filter(Boolean);
    return { route: segs[0] || 'inicio', id: segs[1] || null, segs: segs, query: q };
  }
  SP.go = function (path) { location.hash = '#/' + path.replace(/^#?\/?/, ''); };
  function render() {
    var p = parseHash(), m = byRoute[p.route], view = document.getElementById('view');
    if (!m) { view.innerHTML = ui.empty({ icon: 'search', title: 'Página não encontrada', text: 'O endereço não existe nesta demonstração.', actionHtml: '<a class="btn btn-primary" href="#/inicio">Ir para o início</a>' }); setActive(null); return; }
    if (!allowed(m)) { var first = allowedList()[0]; if (first && first.route !== p.route) { location.replace('#/' + first.route); return; } }
    current = m; setActive(m.route);
    view.scrollTop = 0; window.scrollTo(0, 0);
    view.innerHTML = '';
    var box = document.createElement('div'); box.className = 'page'; view.appendChild(box);
    try { m.render(box, { id: p.id, segs: p.segs, query: p.query }); }
    catch (e) { console.error(e); box.innerHTML = ui.empty({ icon: 'alert', title: 'Erro ao carregar o módulo', text: String(e.message || e) }); }
    document.title = m.title + ' · Solar Prime CRM';
  }
  SP.refresh = render;

  /* ---------- navegação ---------- */
  function buildNav() {
    var list = allowedList(), html = '', g;
    GROUPS.forEach(function (grp) {
      var items = list.filter(function (m) { return m.group === grp; });
      if (!items.length) return;
      if (grp) html += '<div class="nav-group">' + grp + '</div>';
      html += items.map(navItem).join('');
    });
    document.getElementById('sidebarNav').innerHTML = html;
    // bottom nav (mobile)
    var main = list.slice(0, 4), rest = list.slice(4);
    var bn = main.map(function (m) { return '<a href="#/' + m.route + '" data-route="' + m.route + '">' + ui.icon(m.icon, 22) + '<span>' + ui.esc(m.title) + '</span></a>'; }).join('');
    if (rest.length) bn += '<button id="moreBtn">' + ui.icon('more', 22) + '<span>Mais</span></button>';
    var bnEl = document.getElementById('bottomNav'); bnEl.innerHTML = bn;
    var mb = document.getElementById('moreBtn');
    if (mb) mb.onclick = function () {
      var body = '<div class="more-grid">' + rest.map(function (m) { return '<a href="#/' + m.route + '" class="more-item">' + ui.icon(m.icon, 24) + '<span>' + ui.esc(m.title) + '</span></a>'; }).join('') + '</div>';
      var md = ui.modal({ title: 'Mais módulos', body: body });
      md.body.addEventListener('click', function (e) { if (e.target.closest('a')) md.close(); });
    };
    setActive(current && current.route);
  }
  function navItem(m) { return '<a class="nav-item" href="#/' + m.route + '" data-route="' + m.route + '" data-tip="' + ui.esc(m.title) + '">' + ui.icon(m.icon, 20) + '<span>' + ui.esc(m.title) + '</span></a>'; }
  function setActive(route) {
    document.querySelectorAll('[data-route]').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-route') === route); });
  }

  /* ---------- notificações (mock, derivadas dos dados) ---------- */
  function notifications() {
    var out = [], leads = store.visibleLeads(), ids = {};
    leads.forEach(function (l) { ids[l.id] = 1; });
    leads.filter(function (l) { return l.etapa === 'novo' && !l.interacoes.length; }).slice(0, 3).forEach(function (l) { out.push({ icon: 'alert', tone: 'red', txt: 'Lead sem atendimento: ' + l.nome, when: l.criadoEm, href: '#/leads/' + l.id }); });
    store.collection('propostas').filter(function (p) { return ids[p.leadId] && (p.status === 'enviada' || p.status === 'visualizada') && ui.daysSince(p.enviadaEm) > 3; }).slice(0, 3).forEach(function (p) { out.push({ icon: 'file', tone: 'amber', txt: 'Proposta ' + p.numero + ' sem resposta há ' + Math.floor(ui.daysSince(p.enviadaEm)) + ' dias', when: p.enviadaEm, href: '#/leads/' + p.leadId }); });
    store.collection('conversas').filter(function (c) { return c.naoLidas > 0 && ids[c.leadId]; }).slice(0, 3).forEach(function (c) { var l = store.lead(c.leadId); out.push({ icon: 'chat', tone: 'blue', txt: c.naoLidas + ' mensagem(ns) nova(s) de ' + l.nome, when: c.atualizadoEm, href: '#/conversas/' + c.id }); });
    if (SP.session.role === 'dono' || SP.session.role === 'tecnico') store.collection('estoque').filter(function (e) { return e.qtd - e.reservado < e.min; }).slice(0, 2).forEach(function (e) { out.push({ icon: 'box', tone: 'orange', txt: 'Estoque baixo: ' + e.nome, when: null, href: '#/estoque' }); });
    return out;
  }
  function buildBell() {
    var n = notifications(), dot = document.getElementById('bellDot');
    dot.textContent = n.length; dot.style.display = n.length ? '' : 'none';
    var dd = document.getElementById('bellMenu');
    dd.innerHTML = '<div class="dd-title">Notificações</div>' + (n.length ? n.map(function (x) { return '<a class="dd-item" href="' + x.href + '"><span class="dd-ic tone-' + x.tone + '">' + ui.icon(x.icon, 16) + '</span><span><span class="dd-txt">' + ui.esc(x.txt) + '</span>' + (x.when ? '<span class="muted text-sm">' + ui.timeAgo(x.when) + '</span>' : '') + '</span></a>'; }).join('') : '<div class="dd-empty">Tudo em dia</div>');
  }

  /* ---------- busca global / paleta de comandos ---------- */
  function openPalette() {
    var body = document.createElement('div');
    body.innerHTML = '<div class="pal-input">' + ui.icon('search', 18) + '<input id="palInput" type="text" placeholder="Buscar lead, cliente, telefone ou módulo..." autocomplete="off"></div><div id="palList" class="pal-list"></div>';
    var md = ui.modal({ title: 'Busca rápida', body: body, size: 'pal' });
    var input = body.querySelector('#palInput'), list = body.querySelector('#palList'), items = [], sel = 0;
    function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function draw() {
      var q = norm(input.value.trim()); items = [];
      allowedList().forEach(function (m) { if (!q || norm(m.title).indexOf(q) >= 0) items.push({ ic: m.icon, t: m.title, s: 'Módulo', href: '#/' + m.route }); });
      if (q) {
        var qd = q.replace(/\D/g, '');
        store.visibleLeads().filter(function (l) { return norm(l.nome).indexOf(q) >= 0 || norm(l.cidade).indexOf(q) >= 0 || (qd.length > 2 && l.telefone.replace(/\D/g, '').indexOf(qd) >= 0); }).slice(0, 8).forEach(function (l) { items.push({ ic: 'users', t: l.nome, s: l.cidade + ' · ' + SP.consts.etapa(l.etapa).nome, href: '#/leads/' + l.id }); });
      }
      items = items.slice(0, 12); sel = Math.min(sel, Math.max(0, items.length - 1));
      list.innerHTML = items.length ? items.map(function (it, i) { return '<a class="pal-item' + (i === sel ? ' sel' : '') + '" href="' + it.href + '" data-i="' + i + '">' + ui.icon(it.ic, 18) + '<span class="pal-t">' + ui.esc(it.t) + '</span><span class="muted text-sm">' + ui.esc(it.s) + '</span></a>'; }).join('') : '<div class="dd-empty">Nada encontrado</div>';
    }
    input.addEventListener('input', function () { sel = 0; draw(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && items[sel]) { location.hash = items[sel].href; md.close(); }
    });
    list.addEventListener('click', function (e) { if (e.target.closest('a')) md.close(); });
    draw(); setTimeout(function () { input.focus(); }, 50);
  }

  /* ---------- tema ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('solarprime_theme', t); } catch (e) { /* ignora */ }
    var b = document.getElementById('themeBtn'); if (b) b.innerHTML = ui.icon(t === 'dark' ? 'sun' : 'moon', 20);
  }

  /* ---------- sidebar recolhível ---------- */
  function initSidebar() {
    var lay = document.querySelector('.layout'), btn = document.getElementById('sideToggle'), KEY = 'solarprime_sidebar';
    function set(c, save) {
      lay.classList.toggle('side-collapsed', c);
      btn.innerHTML = c ? '&raquo;' : '&laquo;'; btn.title = c ? 'Expandir menu' : 'Recolher menu'; btn.setAttribute('aria-label', btn.title);
      if (save) try { localStorage.setItem(KEY, c ? '1' : '0'); } catch (e) { /* ignora */ }
    }
    var c = false; try { c = localStorage.getItem(KEY) === '1'; } catch (e) { /* ignora */ }
    set(c, false);
    btn.addEventListener('click', function () { set(!lay.classList.contains('side-collapsed'), true); });
  }

  /* ---------- init ---------- */
  function init() {
    var theme = 'light';
    try { theme = localStorage.getItem('solarprime_theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) { /* ignora */ }
    initSidebar();
    document.getElementById('searchIcon').innerHTML = ui.icon('search', 18);
    document.getElementById('bellIcon').innerHTML = ui.icon('bell', 20);
    applyTheme(theme); applyBrand();

    var sel = document.getElementById('roleSelect');
    sel.innerHTML = ROLES.map(function (r) { return '<option value="' + r + '">' + SP.consts.PAPEIS[r] + '</option>'; }).join('');
    sel.value = SP.session.role;
    sel.addEventListener('change', function () { SP.session.set(sel.value); });
    var u = SP.session.user(); document.getElementById('userName').textContent = u ? u.nome.split(' ')[0] : '';

    document.getElementById('themeBtn').addEventListener('click', function () { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); });
    document.getElementById('searchBtn').addEventListener('click', openPalette);
    var bell = document.getElementById('bellBtn'), bm = document.getElementById('bellMenu');
    bell.addEventListener('click', function (e) { e.stopPropagation(); bm.classList.toggle('open'); });
    document.addEventListener('click', function (e) { if (!bm.contains(e.target)) bm.classList.remove('open'); });
    bm.addEventListener('click', function () { bm.classList.remove('open'); });
    document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); } });
    document.getElementById('resetLink').addEventListener('click', function (e) {
      e.preventDefault();
      if (confirm('Restaurar todos os dados fictícios originais? Suas alterações serão perdidas.')) { store.reset(); location.hash = '#/inicio'; location.reload(); }
    });

    store.on(function (info) {
      if (info && info.type === 'session') {
        sel.value = SP.session.role; var uu = SP.session.user(); document.getElementById('userName').textContent = uu ? uu.nome.split(' ')[0] : '';
        buildNav(); buildBell();
        var m = byRoute[parseHash().route];
        if (m && !allowed(m)) location.hash = '#/' + allowedList()[0].route; else render();
      } else { buildBell(); buildNav(); }
    });
    window.addEventListener('hashchange', function () { buildBell(); render(); });
    buildNav(); buildBell();
    if (!location.hash) location.replace('#/inicio'); else render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
