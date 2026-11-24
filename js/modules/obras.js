/* Módulo: Obras (rota #/obras, detalhe #/obras/<id>). Acompanhamento pós-venda. */
(function () {
  'use strict';
  var ui = SP.ui, esc = ui.esc, store = SP.store;
  var view = null;          // 'kanban' | 'lista' | 'hoje'
  var filtro = { q: '', so: '' };
  var selStep = {};         // obraId -> etapa selecionada no stepper
  var DAY = 86400000;
  var CAMPO = ['visita', 'instalacao', 'vistoria']; // etapas de campo (técnico)

  var CHECK = {
    projeto: ['Dimensionar sistema (kWp)', 'Definir layout dos módulos', 'Diagrama unifilar', 'Aprovar projeto com o cliente'],
    visita: ['Confirmar horário com o cliente', 'Medir telhado e sombreamento', 'Fotografar quadro de energia', 'Verificar padrão de entrada', 'Fotografar telhado e estrutura'],
    documentacao: ['Cópia RG/CPF do titular', 'Conta de luz recente', 'ART do responsável técnico', 'Procuração assinada'],
    homologacao: ['Preencher formulário de acesso', 'Anexar projeto e ART', 'Protocolar na concessionária'],
    aprovacao: ['Receber parecer de acesso', 'Conferir pendências', 'Informar cliente da aprovação'],
    compra: ['Cotar fornecedores', 'Reservar itens do estoque', 'Confirmar prazo de entrega', 'Receber e conferir material'],
    agendamento: ['Definir data com o cliente', 'Escalar equipe', 'Separar EPIs e ferramentas'],
    instalacao: ['Instalar estrutura de fixação', 'Fixar módulos', 'Passar cabeamento CC', 'Instalar inversor e string box', 'Aterramento e proteções', 'Testes de isolamento', 'Fotos finais da instalação'],
    vistoria: ['Solicitar vistoria da concessionária', 'Acompanhar vistoria', 'Troca do medidor', 'Sistema conectado à rede'],
    entrega: ['Treinar cliente no app de monitoramento', 'Entregar manual e termo', 'Colher assinatura de entrega', 'Pedir avaliação do cliente']
  };
  var DOCS = ['Contrato assinado', 'Projeto elétrico', 'ART', 'Formulário de acesso', 'Parecer de acesso', 'Termo de entrega'];
  var HSTATUS = [['nao', 'Não protocolado', 'gray'], ['protocolado', 'Protocolado', 'blue'], ['analise', 'Em análise', 'amber'], ['pendencia', 'Com pendência', 'red'], ['aprovado', 'Aprovado', 'green']];

  function etapaNome(id) { var e = SP.consts.OBRA_ETAPAS.filter(function (x) { return x.id === id; })[0]; return e ? e.nome : id; }
  function lead(o) { return store.lead(o.leadId) || { nome: 'Cliente', concessionaria: '-', endereco: '', telefone: '' }; }
  function cur(o) { for (var i = 0; i < o.etapas.length; i++) if (o.etapas[i].status !== 'concluida') return i; return -1; }
  function ensure(o) {
    if (!o.check) o.check = {};
    if (!o.homolog) o.homolog = { protocolo: '', protocoladoEm: '', prazoDias: 15, status: 'nao' };
    if (!o.fotos) o.fotos = [];
    if (!o.docs) o.docs = DOCS.map(function (n, k) { return { nome: n, ok: k < Math.max(1, cur(o)) }; });
    if (!o.notas) o.notas = [];
    return o;
  }
  function checklist(o, id) {
    ensure(o);
    if (!o.check[id]) { var i = o.etapas.map(function (e) { return e.id; }).indexOf(id), done = o.etapas[i] && o.etapas[i].status === 'concluida'; o.check[id] = (CHECK[id] || []).map(function (t) { return { t: t, ok: !!done }; }); }
    return o.check[id];
  }
  function stepStart(o, i) { return i > 0 && o.etapas[i - 1].concluidaEm ? o.etapas[i - 1].concluidaEm : o.inicioEm; }
  function diasEtapa(o) { var i = cur(o); return i < 0 ? 0 : Math.max(0, Math.floor(ui.daysSince(stepStart(o, i)))); }
  function atrasada(o) { var i = cur(o); return i >= 0 && new Date(o.etapas[i].previstaEm).getTime() < Date.now(); }
  function save() { store.save(); SP.refresh(); }

  function setStep(o, idx) { // idx -1 = concluída
    var now = new Date().toISOString();
    o.etapas.forEach(function (e, k) {
      if (idx < 0 || k < idx) { e.status = 'concluida'; if (!e.concluidaEm) e.concluidaEm = now; }
      else if (k === idx) { e.status = 'andamento'; e.concluidaEm = null; }
      else { e.status = 'pendente'; e.concluidaEm = null; }
    });
    o.status = idx < 0 ? 'concluida' : 'andamento';
  }
  function avancar(o) {
    var i = cur(o); if (i < 0) return;
    var pend = checklist(o, o.etapas[i].id).filter(function (c) { return !c.ok; }).length;
    var go = function () {
      setStep(o, i + 1 >= o.etapas.length ? -1 : i + 1);
      store.log('atualizou etapa da obra', 'obra', o.id, lead(o).nome + ': ' + etapaNome(o.etapas[i].id) + ' concluída');
      ui.toast(i + 1 >= o.etapas.length ? 'Obra concluída!' : 'Etapa avançada: ' + etapaNome(o.etapas[i + 1].id), 'success');
      save();
    };
    if (!pend) return go();
    ui.modal({ title: 'Avançar etapa?', size: 'sm', body: '<p>Ainda há <b>' + pend + '</b> item(ns) pendente(s) no checklist de ' + esc(etapaNome(o.etapas[i].id)) + '. Avançar mesmo assim?</p>', actions: [{ label: 'Cancelar' }, { label: 'Avançar mesmo assim', cls: 'btn-primary', onClick: go }] });
  }

  /* ---------- reservas de estoque (mesma estrutura do módulo estoque) ---------- */
  function reservasObra(o) {
    var r = [];
    store.collection('estoque').forEach(function (it) { (it.reservas || []).forEach(function (x) { if (x.obraId === o.id) r.push({ item: it, qtd: x.qtd }); }); });
    return r;
  }
  function recalc(it) { it.reservado = (it.reservas || []).reduce(function (s, r) { return s + r.qtd; }, 0); }

  /* ---------- lista / kanban ---------- */
  function visiveis() {
    var s = SP.session, q = filtro.q.toLowerCase();
    return store.collection('obras').filter(function (o) {
      if (s.role === 'tecnico' && o.tecnicoId !== s.userId) return false;
      var l = lead(o);
      if (q && (l.nome + ' ' + o.cidade + ' ' + l.concessionaria).toLowerCase().indexOf(q) < 0) return false;
      if (filtro.so === 'atrasadas' && !(o.status !== 'concluida' && atrasada(o))) return false;
      if (filtro.so === 'andamento' && o.status === 'concluida') return false;
      return true;
    });
  }
  function cardHtml(o) {
    var l = lead(o), i = cur(o), late = o.status !== 'concluida' && atrasada(o), u = store.user(o.tecnicoId);
    var pct = Math.round(o.etapas.filter(function (e) { return e.status === 'concluida'; }).length / o.etapas.length * 100);
    return '<div class="obras-card' + (late ? ' late' : '') + '" data-open="' + o.id + '"><div class="row" style="justify-content:space-between;gap:8px"><b>' + esc(l.nome) + '</b>' + (late ? ui.badge('Atrasada', 'red') : o.status === 'concluida' ? ui.badge('Concluída', 'green') : '') + '</div>' +
      '<div class="muted text-sm">' + esc(o.cidade) + ' · ' + esc(l.concessionaria) + '</div>' +
      '<div class="row text-sm" style="gap:8px;margin:6px 0">' + ui.badge(o.potenciaKwp + ' kWp', 'orange') + (i >= 0 ? '<span class="muted">' + diasEtapa(o) + ' d na etapa</span>' : '') + '</div>' +
      (i >= 0 ? '<div class="text-sm">' + ui.icon('hardhat', 14) + ' ' + esc(etapaNome(o.etapas[i].id)) + '</div>' : '') + ui.progress(pct) +
      '<div class="row text-sm muted" style="gap:6px;margin-top:6px">' + (u ? ui.userAvatar(u.id, 20) + esc(u.nome.split(' ')[0]) : '') + '</div></div>';
  }
  function listaHtml(list) {
    if (!list.length) return '<div class="card">' + ui.empty({ icon: 'hardhat', title: 'Nenhuma obra encontrada', text: 'Ajuste os filtros.' }) + '</div>';
    return '<div class="obras-grid">' + list.map(cardHtml).join('') + '</div>';
  }
  function hojeHtml(list) {
    var mine = list.filter(function (o) { var i = cur(o); return i >= 0 && CAMPO.indexOf(o.etapas[i].id) >= 0; });
    if (!mine.length) return '<div class="card">' + ui.empty({ icon: 'calendar', title: 'Nenhuma visita hoje', text: 'Sem serviços de campo pendentes.' }) + '</div>';
    return '<div class="stack">' + mine.map(function (o) {
      var l = lead(o), i = cur(o), id = o.etapas[i].id, ck = checklist(o, id), ok = ck.filter(function (c) { return c.ok; }).length;
      var addr = [l.endereco, o.cidade].filter(Boolean).join(', ');
      return '<div class="card obras-visit" data-open="' + o.id + '"><div class="row" style="justify-content:space-between"><b style="font-size:16px">' + esc(l.nome) + '</b>' + ui.badge(etapaNome(id), 'blue') + '</div>' +
        '<div class="text-sm muted mt">' + ui.icon('pin', 14) + ' ' + esc(addr) + '</div>' +
        '<div class="row mt" style="gap:8px;flex-wrap:wrap">' + (l.telefone ? '<a class="btn btn-primary" href="tel:' + esc(String(l.telefone).replace(/[^\d+]/g, '')) + '" data-stop>' + ui.icon('phone', 16) + ' Ligar</a>' : '') +
        '<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr) + '" data-stop>' + ui.icon('pin', 16) + ' Rota</a><a class="btn btn-ghost" href="#/obras/' + o.id + '" data-stop>Abrir obra</a></div>' +
        '<div class="text-sm mt"><b>Checklist</b> ' + ok + '/' + ck.length + '</div>' + ui.progress(ck.length ? ok / ck.length * 100 : 0) +
        '<div class="obras-checks">' + ck.map(function (c, k) { return checkRow(o.id, id, c, k); }).join('') + '</div></div>';
    }).join('') + '</div>';
  }
  function checkRow(oid, eid, c, k) {
    return '<label class="obras-check' + (c.ok ? ' ok' : '') + '" data-stop><input type="checkbox" data-ck="' + oid + '|' + eid + '|' + k + '"' + (c.ok ? ' checked' : '') + '><span>' + esc(c.t) + '</span></label>';
  }
  function bindChecks(el) {
    el.querySelectorAll('[data-ck]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var p = cb.getAttribute('data-ck').split('|'), o = store.find('obras', p[0]); if (!o) return;
        var c = checklist(o, p[1])[+p[2]]; c.ok = cb.checked;
        store.log('atualizou etapa da obra', 'obra', o.id, (c.ok ? 'Marcou: ' : 'Desmarcou: ') + c.t);
        save();
      });
    });
    el.querySelectorAll('[data-stop]').forEach(function (n) { n.addEventListener('click', function (e) { e.stopPropagation(); }); });
  }

  function renderList(el) {
    var s = SP.session, isTec = s.role === 'tecnico';
    if (!view) view = isTec ? 'hoje' : (window.innerWidth < 768 ? 'lista' : 'kanban');
    var all = visiveis(), ativas = all.filter(function (o) { return o.status !== 'concluida'; }), lates = ativas.filter(atrasada);
    var tabs = [{ id: 'kanban', label: 'Quadro' }, { id: 'lista', label: 'Lista' }, { id: 'hoje', label: 'Minhas visitas de hoje' }];
    el.innerHTML = ui.pageHeader('Obras', 'Acompanhe cada instalação, da venda à entrega') +
      '<div class="kpi-grid">' + ui.kpi({ label: 'Em andamento', value: ativas.length, icon: 'hardhat', tone: 'blue' }) + ui.kpi({ label: 'Atrasadas', value: lates.length, icon: 'alert', tone: lates.length ? 'red' : 'green' }) +
      ui.kpi({ label: 'Concluídas', value: all.length - ativas.length, icon: 'check', tone: 'green' }) + ui.kpi({ label: 'kWp em obra', value: ui.fmtNum(Math.round(ativas.reduce(function (a, o) { return a + o.potenciaKwp; }, 0))), icon: 'bolt', tone: 'orange' }) + '</div>' +
      '<div class="row obras-bar">' + ui.tabs(tabs, view) + '<input class="input grow" id="obQ" placeholder="Buscar cliente, cidade, concessionária" value="' + esc(filtro.q) + '">' +
      '<select class="input" id="obF"><option value="">Todas</option><option value="andamento"' + (filtro.so === 'andamento' ? ' selected' : '') + '>Em andamento</option><option value="atrasadas"' + (filtro.so === 'atrasadas' ? ' selected' : '') + '>Atrasadas</option></select></div>' +
      '<div id="obBody"></div>';
    var body = el.querySelector('#obBody');
    if (view === 'lista') { body.innerHTML = listaHtml(all); }
    else if (view === 'hoje') { body.innerHTML = hojeHtml(all); }
    else {
      var cols = SP.consts.OBRA_ETAPAS.map(function (e) { return { id: e.id, title: e.nome, color: 'var(--primary)' }; }).concat([{ id: 'fim', title: 'Concluídas', color: 'var(--green)' }]);
      ui.kanban(body, { columns: cols, items: all, getCol: function (o) { var i = cur(o); return i < 0 ? 'fim' : o.etapas[i].id; }, card: function (o) { return cardHtml(o).replace(/^<div class="obras-card/, '<div class="obras-card inkb'); },
        onMove: function (o, col) { var idx = col === 'fim' ? -1 : o.etapas.map(function (e) { return e.id; }).indexOf(col); setStep(o, idx); store.log('atualizou etapa da obra', 'obra', o.id, lead(o).nome + ' movida para ' + (col === 'fim' ? 'Concluída' : etapaNome(col))); ui.toast('Obra movida', 'success'); save(); },
        onClick: function (o) { SP.go('obras/' + o.id); } });
    }
    body.querySelectorAll('[data-open]').forEach(function (n) { n.addEventListener('click', function () { SP.go('obras/' + n.getAttribute('data-open')); }); });
    bindChecks(body);
    el.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { view = b.getAttribute('data-tab'); SP.refresh(); }); });
    el.querySelector('#obF').addEventListener('change', function (e) { filtro.so = e.target.value; SP.refresh(); });
    var q = el.querySelector('#obQ');
    q.addEventListener('change', function () { filtro.q = q.value; SP.refresh(); });
  }

  /* ---------- detalhe ---------- */
  function renderDetail(el, id) {
    var o = store.find('obras', id);
    if (!o) { el.innerHTML = ui.pageHeader('Obra não encontrada', '', '<a class="btn" href="#/obras">Voltar</a>'); return; }
    ensure(o);
    var l = lead(o), ci = cur(o), late = o.status !== 'concluida' && atrasada(o);
    var sel = selStep[id] != null ? selStep[id] : (ci < 0 ? o.etapas.length - 1 : ci);
    var se = o.etapas[sel], ck = checklist(o, se.id), ckOk = ck.filter(function (c) { return c.ok; }).length;
    var steps = o.etapas.map(function (e, k) {
      var cls = e.status === 'concluida' ? 'done' : e.status === 'andamento' ? 'now' : '';
      var warn = e.status !== 'concluida' && new Date(e.previstaEm).getTime() < Date.now() ? ' late' : '';
      return '<button class="obras-step ' + cls + warn + (k === sel ? ' sel' : '') + '" data-step="' + k + '"><span class="obras-dot">' + (e.status === 'concluida' ? ui.icon('check', 14) : k + 1) + '</span><span class="obras-sname">' + esc(etapaNome(e.id)) + '</span><span class="obras-sdate">' + (e.concluidaEm ? ui.fmtDate(e.concluidaEm) : 'prev. ' + ui.fmtDate(e.previstaEm)) + '</span></button>';
    }).join('');
    var h = o.homolog, hs = HSTATUS.filter(function (x) { return x[0] === h.status; })[0];
    var prazo = '-';
    if (h.protocoladoEm) { var rest = Math.ceil((new Date(h.protocoladoEm).getTime() + h.prazoDias * DAY - Date.now()) / DAY); prazo = rest >= 0 ? rest + ' dia(s) restantes' : '<span style="color:var(--red)">vencido há ' + (-rest) + ' dia(s)</span>'; }
    var mats = reservasObra(o);
    var u = store.user(o.tecnicoId);
    el.innerHTML = '<div class="mb"><a href="#/obras" class="btn btn-ghost btn-sm">&larr; Obras</a></div>' +
      ui.pageHeader(l.nome, o.cidade + ' · ' + o.potenciaKwp + ' kWp · ' + l.concessionaria, (l.telefone ? '<a class="btn" href="tel:' + esc(String(l.telefone).replace(/[^\d+]/g, '')) + '">' + ui.icon('phone', 16) + ' Ligar</a>' : '') + (ci >= 0 ? '<button class="btn btn-primary" id="obAdv">Avançar etapa ' + ui.icon('chevronRight', 16) + '</button>' : ui.badge('Obra concluída', 'green'))) +
      '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">' + (late ? ui.badge('Etapa atrasada', 'red') : '') + (ci >= 0 ? ui.badge(diasEtapa(o) + ' dias na etapa atual', 'gray') : '') + ui.badge(o.modulos + ' módulos', 'orange') + (u ? '<span class="row text-sm" style="gap:6px">' + ui.userAvatar(u.id, 22) + esc(u.nome) + '</span>' : '') + '<span class="muted text-sm">Entrega prevista: ' + ui.fmtDate(o.previsaoEntrega) + '</span></div>' +
      '<div class="card"><div class="obras-stepper">' + steps + '</div></div>' +
      '<div class="grid grid-2 mt"><div class="card"><div class="card-title">Checklist: ' + esc(etapaNome(se.id)) + ' <span class="muted text-sm">' + ckOk + '/' + ck.length + '</span></div>' + ui.progress(ck.length ? ckOk / ck.length * 100 : 0) +
      '<div class="obras-checks">' + ck.map(function (c, k) { return checkRow(o.id, se.id, c, k); }).join('') + '</div></div>' +
      '<div class="card"><div class="card-title">Homologação na concessionária ' + ui.badge(hs[1], hs[2]) + '</div><div class="form"><label>Protocolo<input id="hProt" value="' + esc(h.protocolo) + '" placeholder="Nº do protocolo"></label>' +
      '<label>Data do protocolo<input type="date" id="hData" value="' + esc((h.protocoladoEm || '').slice(0, 10)) + '"></label><label>Prazo legal (dias)<input type="number" id="hPrazo" min="1" value="' + h.prazoDias + '"></label>' +
      '<label>Status<select id="hSt">' + HSTATUS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === h.status ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="row mt text-sm" style="justify-content:space-between"><span class="muted">Prazo da concessionária (' + esc(l.concessionaria) + '): ' + prazo + '</span><button class="btn btn-sm btn-primary" id="hSave">Salvar</button></div></div></div>' +
      '<div class="grid grid-2 mt"><div class="card"><div class="card-title">Documentos</div><div class="obras-checks">' + o.docs.map(function (d, k) { return '<label class="obras-check' + (d.ok ? ' ok' : '') + '"><input type="checkbox" data-doc="' + k + '"' + (d.ok ? ' checked' : '') + '><span>' + esc(d.nome) + '</span><em>' + (d.ok ? 'Recebido' : 'Pendente') + '</em></label>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="card-title">Materiais reservados <button class="btn btn-sm" id="matAdd" style="margin-left:auto">+ Reservar</button></div>' +
      (mats.length ? '<ul class="list">' + mats.map(function (m) { var falta = m.item.qtd - m.item.reservado < 0; return '<li class="list-row"><span class="grow">' + esc(m.item.nome) + '</span><b>' + m.qtd + ' ' + esc(m.item.unidade) + '</b>' + (falta ? ' ' + ui.badge('Falta estoque', 'red') : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted text-sm">Nenhum material reservado. <a href="#/estoque">Abrir estoque</a></p>') + '</div></div>' +
      '<div class="card mt"><div class="card-title">Fotos <button class="btn btn-sm" id="fotoAdd" style="margin-left:auto">' + ui.icon('plus', 14) + ' Adicionar foto</button></div>' +
      (o.fotos.length ? '<div class="obras-gal">' + o.fotos.map(function (f) { return '<figure class="obras-foto" style="background:linear-gradient(135deg,hsl(' + f.hue + ',70%,60%),hsl(' + ((f.hue + 50) % 360) + ',65%,38%))">' + ui.icon('sunpower', 28) + '<figcaption>' + esc(f.titulo) + '<small>' + ui.fmtDate(f.em) + '</small></figcaption></figure>'; }).join('') + '</div>' : '<p class="muted text-sm">Nenhuma foto ainda. Toque em adicionar para registrar a obra (simulado).</p>') + '</div>' +
      '<div class="card mt"><div class="card-title">Anotações</div><div class="row"><input class="input grow" id="nTxt" placeholder="Escreva uma observação..."><button class="btn btn-primary" id="nAdd">Adicionar</button></div>' +
      '<ul class="list mt">' + o.notas.map(function (n) { var nu = store.user(n.porId); return '<li class="list-row" style="display:block"><div class="text-sm muted">' + esc(nu ? nu.nome : '') + ' · ' + ui.timeAgo(n.em) + '</div>' + esc(n.texto) + '</li>'; }).join('') + (o.observacoes ? '<li class="list-row" style="display:block">' + esc(o.observacoes) + '</li>' : '') + '</ul></div>';

    bindChecks(el);
    el.querySelectorAll('[data-step]').forEach(function (b) { b.addEventListener('click', function () { selStep[id] = +b.getAttribute('data-step'); SP.refresh(); }); });
    var adv = el.querySelector('#obAdv'); if (adv) adv.addEventListener('click', function () { delete selStep[id]; avancar(o); });
    el.querySelector('#hSave').addEventListener('click', function () {
      h.protocolo = el.querySelector('#hProt').value.trim(); var d = el.querySelector('#hData').value; h.protocoladoEm = d ? new Date(d + 'T12:00:00').toISOString() : '';
      h.prazoDias = Math.max(1, +el.querySelector('#hPrazo').value || 15); h.status = el.querySelector('#hSt').value;
      store.log('atualizou etapa da obra', 'obra', o.id, 'Homologação: ' + h.status + (h.protocolo ? ' (' + h.protocolo + ')' : '')); ui.toast('Homologação salva', 'success'); save();
    });
    el.querySelectorAll('[data-doc]').forEach(function (cb) { cb.addEventListener('change', function () { var d = o.docs[+cb.getAttribute('data-doc')]; d.ok = cb.checked; store.log('atualizou etapa da obra', 'obra', o.id, 'Documento ' + d.nome + (d.ok ? ' recebido' : ' pendente')); save(); }); });
    el.querySelector('#fotoAdd').addEventListener('click', function () {
      var m = ui.modal({ title: 'Adicionar foto (simulada)', size: 'sm', body: '<div class="form"><label class="full">Legenda<input id="fT" placeholder="Ex.: Telhado antes da instalação"></label></div>', actions: [{ label: 'Cancelar' }, { label: 'Adicionar', cls: 'btn-primary', onClick: function (c) { var t = c.el.querySelector('#fT').value.trim() || 'Foto da obra'; o.fotos.push({ titulo: t, hue: Math.floor(Math.random() * 360), em: new Date().toISOString() }); store.log('atualizou etapa da obra', 'obra', o.id, 'Foto: ' + t); save(); } }] });
      void m;
    });
    el.querySelector('#nAdd').addEventListener('click', function () {
      var t = el.querySelector('#nTxt').value.trim(); if (!t) return;
      o.notas.unshift({ em: new Date().toISOString(), porId: SP.session.userId, texto: t }); store.log('atualizou etapa da obra', 'obra', o.id, 'Anotação adicionada'); save();
    });
    el.querySelector('#matAdd').addEventListener('click', function () {
      var items = store.collection('estoque');
      ui.modal({ title: 'Reservar material', size: 'sm', body: '<div class="form"><label class="full">Item<select id="mI">' + items.map(function (it) { return '<option value="' + it.id + '">' + esc(it.nome) + ' (disp. ' + (it.qtd - it.reservado) + ')</option>'; }).join('') + '</select></label><label class="full">Quantidade<input type="number" id="mQ" min="1" value="1"></label></div>',
        actions: [{ label: 'Cancelar' }, { label: 'Reservar', cls: 'btn-primary', onClick: function (c) {
          var it = store.find('estoque', c.el.querySelector('#mI').value), q = Math.max(1, +c.el.querySelector('#mQ').value || 1); if (!it) return; if (q > it.qtd - (it.reservado || 0)) { ui.toast('Só há ' + (it.qtd - (it.reservado || 0)) + ' disponível', 'error'); return false; }
          it.reservas = it.reservas || []; var r = it.reservas.filter(function (x) { return x.obraId === o.id; })[0]; if (r) r.qtd += q; else it.reservas.push({ obraId: o.id, qtd: q });
          recalc(it); store.log('ajustou estoque', 'estoque', it.id, 'Reservou ' + q + ' para obra ' + o.id); ui.toast('Material reservado', 'success'); save(); } }] });
    });
  }

  SP.register({
    route: 'obras', title: 'Obras', icon: 'hardhat', group: 'Operação', order: 20, roles: ['dono', 'tecnico'],
    render: function (el, params) { if (params && params.id) renderDetail(el, params.id); else renderList(el); }
  });
})();
