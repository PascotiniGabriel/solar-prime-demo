/* Módulo: Leads (#/leads e #/leads/<id>). */
(function () {
  'use strict';
  var ui = SP.ui, esc = ui.esc, S = SP.store;
  var state = { q: '', etapa: '', origem: '', vendedor: '', tipo: '', score: '', sort: 'recente', tab: 'resumo' };
  var TIPOS = ['Residencial', 'Comercial', 'Rural', 'Industrial'];
  var LIGACOES = ['Monofásica', 'Bifásica', 'Trifásica'];
  var TELHADOS = ['Cerâmico', 'Fibrocimento', 'Metálico', 'Laje', 'Solo'];

  function etapaNome(id) {
    return SP.consts.etapa(id).nome;
  }
  function badgeEtapa(id) { var e = SP.consts.etapa(id); return '<span class="badge" style="background:' + e.cor + '22;color:' + e.cor + '">' + esc(etapaNome(id)) + '</span>'; }
  function scoreCls(s) { return s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold'; }
  function scoreBadge(s) { return '<span class="leads-score leads-score-' + scoreCls(s || 0) + '">' + (s || 0) + '</span>'; }
  function isDono() { return SP.session.role === 'dono'; }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function kwp(l) { return l.consumoKwh ? Math.round(l.consumoKwh / (30 * 4.5 * 0.8) * 10) / 10 : 0; }
  function opts(list, sel, ph) {
    return (ph != null ? '<option value="">' + ph + '</option>' : '') + list.map(function (o) {
      var v = o.v != null ? o.v : o, t = o.t != null ? o.t : o;
      return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('');
  }
  function vendOpts(sel, ph) { return opts(S.vendedores().map(function (u) { return { v: u.id, t: u.nome }; }), sel, ph); }
  function dupOf(l) {
    var ph = digits(l.telefone), cp = digits(l.cpfCnpj);
    return S.collection('leads').filter(function (o) { return o.id !== l.id && ((ph && digits(o.telefone) === ph) || (cp && digits(o.cpfCnpj) === cp)); });
  }
  function addInteracao(l, tipo, texto) {
    l.interacoes = l.interacoes || [];
    l.interacoes.unshift({ em: new Date().toISOString(), tipo: tipo, texto: texto, porId: SP.session.userId });
  }

  /* ================= LISTA ================= */
  function renderList(el) {
    var leads = S.visibleLeads();
    var semDono = leads.filter(function (l) { return !l.vendedorId && l.etapa !== 'perdido'; }).length;
    var actions = (isDono() ? '<button class="btn" id="ld-dist">' + ui.icon('users') + ' Distribuir automaticamente' + (semDono ? ' (' + semDono + ')' : '') + '</button> ' : '') +
      '<button class="btn btn-primary" id="ld-new">' + ui.icon('users') + ' Novo lead</button>';
    el.innerHTML = '<div class="leads">' + ui.pageHeader('Leads', leads.length + ' leads' + (SP.session.role === 'vendedor' ? ' sob sua responsabilidade' : ''), actions) +
      '<div class="card leads-filters"><input class="leads-search" id="ld-q" type="search" placeholder="Buscar por nome, telefone, cidade ou CPF/CNPJ..." value="' + esc(state.q) + '">' +
      '<div class="leads-filter-row">' +
      '<select id="ld-etapa">' + opts(SP.consts.etapasAtivas().map(function (e) { return { v: e.id, t: e.nome }; }), state.etapa, 'Todas as etapas') + '</select>' +
      '<select id="ld-origem">' + opts(SP.consts.ORIGENS, state.origem, 'Todas as origens') + '</select>' +
      (isDono() ? '<select id="ld-vend">' + vendOpts(state.vendedor, 'Todos os vendedores') + '</select>' : '') +
      '<select id="ld-tipo">' + opts(TIPOS, state.tipo, 'Todos os tipos') + '</select>' +
      '<select id="ld-score">' + opts([{ v: 'hot', t: 'Quente (70+)' }, { v: 'warm', t: 'Morno (40-69)' }, { v: 'cold', t: 'Frio (<40)' }], state.score, 'Qualquer score') + '</select>' +
      '<select id="ld-sort">' + opts([{ v: 'recente', t: 'Mais recentes' }, { v: 'score', t: 'Maior score' }, { v: 'valor', t: 'Maior valor' }, { v: 'nome', t: 'Nome A-Z' }, { v: 'parado', t: 'Mais tempo parado' }], state.sort) + '</select>' +
      '<button class="btn btn-ghost btn-sm" id="ld-clear">Limpar filtros</button></div></div>' +
      '<div id="ld-results"></div></div>';
    var q = el.querySelector('#ld-q');
    q.addEventListener('input', function () { state.q = q.value; drawResults(el); });
    [['ld-etapa', 'etapa'], ['ld-origem', 'origem'], ['ld-vend', 'vendedor'], ['ld-tipo', 'tipo'], ['ld-score', 'score'], ['ld-sort', 'sort']].forEach(function (p) {
      var s = el.querySelector('#' + p[0]); if (s) s.addEventListener('change', function () { state[p[1]] = s.value; drawResults(el); });
    });
    el.querySelector('#ld-clear').addEventListener('click', function () { state.q = state.etapa = state.origem = state.vendedor = state.tipo = state.score = ''; state.sort = 'recente'; renderList(el); });
    el.querySelector('#ld-new').addEventListener('click', function () { openForm(); });
    var d = el.querySelector('#ld-dist'); if (d) d.addEventListener('click', distribuir);
    drawResults(el);
  }

  function filtered() {
    var q = state.q.trim().toLowerCase(), qd = digits(state.q);
    var r = S.visibleLeads().filter(function (l) {
      if (q && (l.nome || '').toLowerCase().indexOf(q) < 0 && (l.cidade || '').toLowerCase().indexOf(q) < 0 && !(qd && (digits(l.telefone).indexOf(qd) >= 0 || digits(l.cpfCnpj).indexOf(qd) >= 0))) return false;
      if (state.etapa && l.etapa !== state.etapa) return false;
      if (state.origem && l.origem !== state.origem) return false;
      if (state.vendedor && l.vendedorId !== state.vendedor) return false;
      if (state.tipo && l.tipo !== state.tipo) return false;
      if (state.score && scoreCls(l.score || 0) !== state.score) return false;
      return true;
    });
    var by = {
      recente: function (a, b) { return (b.criadoEm || '').localeCompare(a.criadoEm || ''); },
      score: function (a, b) { return (b.score || 0) - (a.score || 0); },
      valor: function (a, b) { return (b.valorEstimado || 0) - (a.valorEstimado || 0); },
      nome: function (a, b) { return (a.nome || '').localeCompare(b.nome || ''); },
      parado: function (a, b) { return (a.ultimoContato || '').localeCompare(b.ultimoContato || ''); }
    };
    return r.sort(by[state.sort] || by.recente);
  }

  function drawResults(el) {
    var box = el.querySelector('#ld-results'), rows = filtered();
    if (!rows.length) {
      box.innerHTML = '<div class="card">' + ui.empty({ icon: 'users', title: 'Nenhum lead encontrado', text: 'Ajuste os filtros ou cadastre um novo lead.' }) + '</div>'; return;
    }
    function nome(l) { return '<b>' + esc(l.nome) + '</b>' + (l.duplicadoDe || dupOf(l).length ? ' <span class="badge badge-amber" title="Possível duplicado (mesmo telefone ou CPF/CNPJ)">Duplicado</span>' : ''); }
    var vNome = function (l) { var u = S.user(l.vendedorId); return u ? esc(u.nome.split(' ')[0]) : '<span class="muted">Sem vendedor</span>'; };
    var table = '<div class="card leads-table-wrap table-wrap"><table class="table leads-table"><thead><tr><th>Lead</th><th>Cidade</th><th>Etapa</th><th>Origem</th><th>Vendedor</th><th>kWh/mês</th><th>Valor</th><th>Score</th><th>Último contato</th></tr></thead><tbody>' +
      rows.map(function (l) {
        return '<tr class="leads-row" data-id="' + l.id + '"><td>' + nome(l) + '<div class="muted text-sm">' + esc(l.telefone || '') + '</div></td><td>' + esc(l.cidade || '') + '</td><td>' + badgeEtapa(l.etapa) + '</td><td>' + esc(l.origem || '') + '</td><td>' + vNome(l) + '</td><td>' + ui.fmtNum(l.consumoKwh || 0) + '</td><td>' + ui.fmtMoney(l.valorEstimado || 0) + '</td><td>' + scoreBadge(l.score) + '</td><td class="muted">' + ui.timeAgo(l.ultimoContato) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    var cards = '<div class="leads-cards">' + rows.map(function (l) {
      return '<div class="card leads-card" data-id="' + l.id + '"><div class="row"><div class="grow">' + nome(l) + '<div class="muted text-sm">' + esc(l.cidade || '') + ' · ' + esc(l.telefone || '') + '</div></div>' + scoreBadge(l.score) + '</div><div class="row mt">' + badgeEtapa(l.etapa) + '<span class="grow"></span><b>' + ui.fmtMoney(l.valorEstimado || 0) + '</b></div><div class="muted text-sm mt">' + vNome(l) + ' · ' + ui.fmtNum(l.consumoKwh || 0) + ' kWh · ' + ui.timeAgo(l.ultimoContato) + '</div></div>';
    }).join('') + '</div>';
    box.innerHTML = '<div class="muted text-sm mb">' + rows.length + ' resultado(s)</div>' + table + cards;
    box.querySelectorAll('[data-id]').forEach(function (n) { n.addEventListener('click', function () { SP.go('leads/' + n.getAttribute('data-id')); }); });
  }

  function distribuir() {
    var sem = S.collection('leads').filter(function (l) { return !l.vendedorId && l.etapa !== 'perdido'; });
    var vend = S.vendedores();
    if (!sem.length) { ui.toast('Nenhum lead sem vendedor.', 'success'); return; }
    ui.modal({ title: 'Distribuir automaticamente', size: 'sm', body: '<p>' + sem.length + ' lead(s) sem vendedor serão divididos em rodízio entre ' + vend.length + ' vendedores.</p>',
      actions: [{ label: 'Cancelar' }, { label: 'Distribuir', cls: 'btn-primary', onClick: function () {
        var cnt = {}; vend.forEach(function (v) { cnt[v.id] = S.collection('leads').filter(function (l) { return l.vendedorId === v.id; }).length; });
        sem.forEach(function (l) {
          vend.sort(function (a, b) { return cnt[a.id] - cnt[b.id]; });
          var v = vend[0]; cnt[v.id]++; l.vendedorId = v.id; addInteracao(l, 'sistema', 'Lead distribuído automaticamente para ' + v.nome);
          S.log('distribuir', 'lead', l.id, 'Rodízio -> ' + v.nome);
        });
        S.save(); ui.toast(sem.length + ' lead(s) distribuídos.', 'success'); SP.refresh();
      } }] });
  }

  /* ================= FORM NOVO LEAD ================= */
  function openForm() {
    var me = SP.session.user();
    var f = function (label, inner, full) { return '<label class="' + (full ? 'full' : '') + '"><span class="text-sm muted">' + label + '</span>' + inner + '</label>'; };
    var html = '<div class="form leads-form">' +
      f('Nome *', '<input id="f-nome" placeholder="Nome completo">') + f('Telefone / WhatsApp *', '<input id="f-tel" placeholder="(00) 90000-0000">') +
      f('CPF / CNPJ', '<input id="f-cpf">') + f('Cidade', '<input id="f-cid">') +
      f('Endereço', '<input id="f-end">', true) +
      f('Tipo de cliente', '<select id="f-tipo">' + opts(TIPOS, 'Residencial') + '</select>') + f('Concessionária', '<input id="f-conc" placeholder="Ex.: CPFL">') +
      f('Consumo (kWh/mês)', '<input id="f-kwh" type="number" min="0">') + f('Valor da conta (R$)', '<input id="f-conta" type="number" min="0">') +
      f('Tipo de telhado', '<select id="f-telh">' + opts(TELHADOS, '', '') + '</select>') + f('Área disponível (m²)', '<input id="f-area" type="number" min="0">') +
      f('Tipo de ligação', '<select id="f-lig">' + opts(LIGACOES, '', '') + '</select>') + f('Origem', '<select id="f-orig">' + opts(SP.consts.ORIGENS, 'Manual') + '</select>') +
      (isDono() ? f('Vendedor', '<select id="f-vend">' + vendOpts('', 'Sem vendedor (distribuir depois)') + '</select>', true) : '') +
      '<div class="full" id="f-dup"></div></div>';
    var m = ui.modal({ title: 'Novo lead', size: 'lg', body: html, actions: [{ label: 'Cancelar' }, { label: 'Salvar lead', cls: 'btn-primary', keepOpen: true, onClick: function (ctx) { save(ctx); } }] });
    var $ = function (id) { return m.el.querySelector('#' + id); };
    function checkDup() {
      var d = dupOf({ id: '_', telefone: $('f-tel').value, cpfCnpj: $('f-cpf').value });
      $('f-dup').innerHTML = d.length ? '<div class="leads-dup">' + ui.icon('alert', 16) + ' <span>Atenção: já existe lead com este telefone/CPF: <b>' + esc(d[0].nome) + '</b> (' + esc(etapaNome(d[0].etapa)) + '). Clique em Salvar novamente para cadastrar mesmo assim.</span></div>' : '';
      return d;
    }
    $('f-tel').addEventListener('blur', checkDup); $('f-cpf').addEventListener('blur', checkDup);
    var warned = false;
    function save(ctx) {
      var nome = $('f-nome').value.trim(), tel = $('f-tel').value.trim();
      if (!nome || !tel) { ui.toast('Informe nome e telefone.', 'error'); return; }
      var d = checkDup();
      if (d.length && !warned) { warned = true; return; }
      var v = $('f-vend') ? $('f-vend').value : (SP.session.role === 'vendedor' ? me.id : '');
      var l = { nome: nome, telefone: tel, cpfCnpj: $('f-cpf').value.trim(), cidade: $('f-cid').value.trim(), endereco: $('f-end').value.trim(), tipo: $('f-tipo').value, concessionaria: $('f-conc').value.trim(),
        consumoKwh: +$('f-kwh').value || 0, valorConta: +$('f-conta').value || 0, tipoTelhado: $('f-telh').value, areaM2: +$('f-area').value || 0, tipoLigacao: $('f-lig').value,
        origem: $('f-orig').value, campanha: '', vendedorId: v, etapa: 'novo', motivoPerda: '', score: 30, criadoEm: new Date().toISOString(), ultimoContato: new Date().toISOString(),
        valorEstimado: 0, duplicadoDe: d.length ? d[0].id : null, objecoes: [], interacoes: [], primeiraRespostaMin: null };
      l.valorEstimado = Math.round(kwp(l) * 4800);
      l.score = Math.min(95, 30 + (l.consumoKwh > 500 ? 25 : l.consumoKwh > 250 ? 12 : 0) + (l.tipoTelhado ? 8 : 0) + (l.areaM2 ? 7 : 0));
      addInteracao(l, 'sistema', 'Lead cadastrado manualmente');
      S.upsert('leads', l); S.log('criar', 'lead', l.id, 'Cadastro manual: ' + nome);
      ctx.close(); ui.toast('Lead cadastrado.', 'success'); SP.go('leads/' + l.id);
    }
  }

  /* ================= DETALHE ================= */
  function renderDetail(el, id) {
    var l = S.lead(id);
    if (!l || (SP.session.role === 'vendedor' && l.vendedorId !== SP.session.userId)) {
      el.innerHTML = '<div class="leads">' + ui.pageHeader('Lead não encontrado') + '<div class="card">' + ui.empty({ icon: 'users', title: 'Lead não encontrado', text: 'Ele pode ter sido removido ou não estar sob sua responsabilidade.', actionHtml: '<a class="btn btn-primary" href="#/leads">Voltar para leads</a>' }) + '</div></div>'; return;
    }
    var conv = S.collection('conversas').filter(function (c) { return c.leadId === l.id; })[0];
    var u = S.user(l.vendedorId), dups = dupOf(l);
    var perdido = l.etapa === 'perdido';
    el.innerHTML = '<div class="leads"><a class="muted text-sm" href="#/leads">&larr; Voltar para leads</a>' +
      '<div class="card leads-head"><div class="row"><div class="grow"><h1 class="leads-title">' + esc(l.nome) + '</h1><div class="muted">' + esc(l.cidade || '') + ' · ' + esc(l.telefone || '') + ' · origem: ' + esc(l.origem || '-') + '</div>' +
      '<div class="row mt leads-chips">' + badgeEtapa(l.etapa) + ' <span title="Score do lead">Score ' + scoreBadge(l.score) + '</span> <span class="row">' + (u ? ui.userAvatar(u.id, 24) + ' ' + esc(u.nome) : '<span class="muted">Sem vendedor</span>') + '</span>' +
      (dups.length ? ' <a class="badge badge-amber" href="#/leads/' + dups[0].id + '">Possível duplicado: ' + esc(dups[0].nome) + '</a>' : '') + '</div>' +
      (perdido && l.motivoPerda ? '<div class="mt"><span class="badge badge-red">Perdido: ' + esc(l.motivoPerda) + '</span></div>' : '') + '</div></div>' +
      '<div class="leads-actions mt"><button class="btn btn-primary" id="a-etapa">Mudar etapa</button>' +
      (conv ? '<a class="btn" href="#/conversas/' + conv.id + '">' + ui.icon('chat') + ' Abrir conversa</a>' : '') +
      '<a class="btn" href="#/propostas?lead=' + l.id + '">' + ui.icon('file') + ' Gerar proposta</a>' +
      (isDono() ? '<button class="btn" id="a-transf">Transferir vendedor</button>' : '') +
      (perdido ? '<button class="btn" id="a-reabrir">Reabrir lead</button>' : '<button class="btn btn-danger" id="a-perdido">Marcar perdido</button>') + '</div></div>' +
      ui.tabs([{ id: 'resumo', label: 'Resumo' }, { id: 'historico', label: 'Histórico' }, { id: 'ia', label: 'IA' }, { id: 'docs', label: 'Documentos' }], state.tab) +
      '<div id="ld-tab" class="mt"></div></div>';
    el.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); el.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('active', x === b); }); drawTab(el, l); }); });
    var on = function (i, fn) { var n = el.querySelector('#' + i); if (n) n.addEventListener('click', fn); };
    on('a-etapa', function () { changeEtapa(l); });
    on('a-transf', function () { transfer(l); });
    on('a-perdido', function () { askPerdido(l); });
    on('a-reabrir', function () { l.etapa = 'qualificacao'; l.motivoPerda = ''; addInteracao(l, 'sistema', 'Lead reaberto'); S.save(); S.log('reabrir', 'lead', l.id, 'Reaberto'); SP.refresh(); });
    drawTab(el, l);
  }

  function field(k, v) { return '<div class="leads-field"><span class="muted text-sm">' + k + '</span><b>' + (v === '' || v == null ? '-' : v) + '</b></div>'; }

  function drawTab(el, l) {
    var box = el.querySelector('#ld-tab');
    if (state.tab === 'resumo') {
      var k = kwp(l);
      box.innerHTML = '<div class="grid grid-2"><div class="card"><div class="card-title">Dados do cliente</div><div class="leads-fields">' +
        field('Nome', esc(l.nome)) + field('Telefone', esc(l.telefone)) + field('CPF/CNPJ', esc(l.cpfCnpj)) + field('Tipo', esc(l.tipo)) + field('Cidade', esc(l.cidade)) + field('Endereço', esc(l.endereco)) + field('Campanha', esc(l.campanha)) + field('Cadastrado em', ui.fmtDate(l.criadoEm)) + '</div></div>' +
        '<div class="card"><div class="card-title">Dados técnicos</div><div class="leads-fields">' +
        field('Consumo', ui.fmtNum(l.consumoKwh || 0) + ' kWh/mês') + field('Valor da conta', ui.fmtMoney(l.valorConta || 0)) + field('Tipo de telhado', esc(l.tipoTelhado)) + field('Área disponível', l.areaM2 ? l.areaM2 + ' m²' : '') + field('Ligação', esc(l.tipoLigacao)) + field('Concessionária', esc(l.concessionaria)) + '</div>' +
        '<div class="leads-kwp mt">' + ui.icon('bolt', 20) + '<div><b>Sistema sugerido: ' + (k ? String(k).replace('.', ',') + ' kWp' : 'informe o consumo') + '</b><div class="muted text-sm">Estimativa: consumo / (30 dias × 4,5 h de sol × 0,8 de eficiência). Valor estimado ' + ui.fmtMoney(l.valorEstimado || 0) + '.</div></div></div></div></div>';
    } else if (state.tab === 'historico') {
      var its = l.interacoes || [];
      box.innerHTML = '<div class="card"><div class="card-title">Registrar interação</div><div class="leads-addint"><select id="i-tipo">' + opts([{ v: 'nota', t: 'Anotação' }, { v: 'ligacao', t: 'Ligação' }, { v: 'whatsapp', t: 'WhatsApp' }, { v: 'email', t: 'E-mail' }, { v: 'visita', t: 'Visita' }], 'nota') + '</select><input id="i-txt" placeholder="O que aconteceu? Ex.: Cliente pediu proposta com financiamento"><button class="btn btn-primary" id="i-add">Adicionar</button></div></div>' +
        '<div class="card mt"><div class="card-title">Linha do tempo</div>' + (its.length ? '<ul class="timeline">' + its.map(function (i) { var by = S.user(i.porId); return '<li class="done"><b>' + esc(i.tipo || '') + '</b> · <span class="muted text-sm">' + ui.fmtDateTime(i.em) + (by ? ' · ' + esc(by.nome) : '') + '</span><div>' + esc(i.texto) + '</div></li>'; }).join('') + '</ul>' : ui.empty({ icon: 'clock', title: 'Sem interações ainda', text: 'Registre a primeira acima.' })) + '</div>';
      var add = function () {
        var t = box.querySelector('#i-txt').value.trim(); if (!t) { ui.toast('Escreva a interação.', 'error'); return; }
        addInteracao(l, box.querySelector('#i-tipo').value, t); l.ultimoContato = new Date().toISOString(); S.save(); S.log('interacao', 'lead', l.id, t.slice(0, 80)); drawTab(el, l); ui.toast('Interação registrada.', 'success');
      };
      box.querySelector('#i-add').addEventListener('click', add);
      box.querySelector('#i-txt').addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    } else if (state.tab === 'ia') {
      drawIA(box, l);
    } else {
      drawDocs(box, l);
    }
  }

  var iaCache = {};
  function drawIA(box, l) {
    var r = l.iaResumo;
    if (!r) {
      box.innerHTML = '<div class="card leads-ia-empty">' + ui.empty({ icon: 'bolt', title: 'Resumo inteligente do lead', text: 'A IA analisa o histórico e sugere necessidades, objeções e a próxima ação.', actionHtml: '<button class="btn btn-primary" id="ia-go">Gerar resumo com IA</button>' }) + '</div>';
      box.querySelector('#ia-go').addEventListener('click', function () {
        box.innerHTML = '<div class="card leads-ia-loading"><div class="leads-spinner"></div><p>Analisando conversas e histórico...</p></div>';
        setTimeout(function () { l.iaResumo = genIA(l); S.save(); if (box.isConnected && state.tab === 'ia') drawIA(box, l); }, 1600);
      });
      return;
    }
    var li = function (a) { return '<ul class="leads-ul">' + a.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'; };
    box.innerHTML = '<div class="grid grid-2"><div class="card"><div class="card-title">Necessidades</div>' + li(r.needs) + '</div>' +
      '<div class="card"><div class="card-title">Objeções</div>' + (r.obj.length ? li(r.obj) : '<p class="muted">Nenhuma objeção registrada.</p>') + '</div>' +
      '<div class="card"><div class="card-title">Intenção de compra</div><div class="row"><b style="font-size:1.4rem">' + r.intent + '%</b><span class="badge ' + (r.intent >= 70 ? 'badge-green' : r.intent >= 40 ? 'badge-amber' : 'badge-gray') + '">' + (r.intent >= 70 ? 'Alta' : r.intent >= 40 ? 'Média' : 'Baixa') + '</span></div>' + ui.progress(r.intent) + '</div>' +
      '<div class="card"><div class="card-title">Próxima ação sugerida</div><p>' + esc(r.next) + '</p></div></div>' +
      '<div class="card mt"><div class="card-title">Resumo para passar o bastão</div><p class="leads-handover">' + esc(r.handover) + '</p><div class="row mt"><button class="btn btn-sm" id="ia-copy">Copiar resumo</button><button class="btn btn-ghost btn-sm" id="ia-re">Gerar novamente</button></div></div>';
    box.querySelector('#ia-copy').addEventListener('click', function () { try { navigator.clipboard.writeText(r.handover); ui.toast('Resumo copiado.', 'success'); } catch (e) { ui.toast('Não foi possível copiar.', 'error'); } });
    box.querySelector('#ia-re').addEventListener('click', function () { delete l.iaResumo; S.save(); drawIA(box, l); });
  }
  function genIA(l) {
    var k = kwp(l), needs = [];
    if (l.valorConta) needs.push('Reduzir a conta de luz de ' + ui.fmtMoney(l.valorConta) + '/mês');
    if (l.consumoKwh) needs.push('Sistema de aproximadamente ' + String(k).replace('.', ',') + ' kWp para ' + ui.fmtNum(l.consumoKwh) + ' kWh/mês');
    if (l.tipoTelhado) needs.push('Instalação em telhado ' + String(l.tipoTelhado).toLowerCase());
    if (!needs.length) needs.push('Entender o consumo para dimensionar o sistema');
    var neg = SP.consts.EM_NEGOCIACAO.indexOf(l.etapa) >= 0;
    var intent = Math.max(10, Math.min(95, Math.round((l.score || 30) * 0.9 + (neg ? 10 : 0))));
    var next = l.etapa === 'novo' ? 'Fazer o primeiro contato por WhatsApp hoje e pedir a última conta de luz.' :
      (l.etapa === 'primeiro_contato' || l.etapa === 'qualificacao') ? 'Qualificar: confirmar consumo, telhado e agendar visita técnica.' :
      l.etapa === 'analise_tecnica' ? 'Concluir o dimensionamento e gerar a proposta.' :
      neg ? 'Ligar para tratar objeções e propor condição de pagamento para fechar.' :
      l.etapa === 'perdido' ? 'Reativar em 60 dias com nova condição.' : 'Acompanhar o andamento e pedir indicações.';
    var u = S.user(l.vendedorId), ult = (l.interacoes || [])[0];
    return { needs: needs, obj: l.objecoes || [], intent: intent, next: next,
      handover: l.nome + ' (' + (l.cidade || 'cidade n/i') + ') está em "' + etapaNome(l.etapa) + '", origem ' + (l.origem || 'n/i') + ', sob responsabilidade de ' + (u ? u.nome : 'ninguém') + '. Consumo ' + ui.fmtNum(l.consumoKwh || 0) + ' kWh/mês (conta ' + ui.fmtMoney(l.valorConta || 0) + '), sistema sugerido ' + String(k).replace('.', ',') + ' kWp. ' +
        ((l.objecoes || []).length ? 'Objeções: ' + l.objecoes.join('; ') + '. ' : '') + (ult ? 'Último registro: "' + ult.texto + '". ' : '') + 'Próximo passo: ' + next };
  }

  var DOCS = {};
  function drawDocs(box, l) {
    var base = [{ n: 'Conta de luz.pdf', t: 'PDF', s: '1,2 MB' }, { n: 'Documento de identidade.jpg', t: 'IMAGEM', s: '860 KB' }];
    var list = l.docs || (l.docs = l.consumoKwh ? base.slice() : []);
    box.innerHTML = '<div class="card"><div class="row"><div class="card-title grow">Documentos do lead</div><label class="btn btn-primary btn-sm" for="d-file">Enviar documento</label><input id="d-file" type="file" hidden></div>' +
      (list.length ? '<div class="list mt">' + list.map(function (d, i) { return '<div class="list-row">' + ui.icon('file', 18) + '<span class="grow">' + esc(d.n) + '<div class="muted text-sm">' + esc(d.t) + ' · ' + esc(d.s) + '</div></span><button class="btn btn-ghost btn-sm" data-dl="' + i + '">Baixar</button><button class="btn btn-ghost btn-sm" data-rm="' + i + '">Remover</button></div>'; }).join('') + '</div>' : ui.empty({ icon: 'file', title: 'Nenhum documento', text: 'Envie a conta de luz, documento de identidade ou fotos do telhado.' })) + '<p class="muted text-sm mt">Demonstração: os arquivos não são enviados a nenhum servidor.</p></div>';
    box.querySelector('#d-file').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      list.unshift({ n: f.name, t: (f.name.split('.').pop() || 'arquivo').toUpperCase(), s: Math.max(1, Math.round(f.size / 1024)) + ' KB' });
      addInteracao(l, 'sistema', 'Documento anexado: ' + f.name); S.save(); S.log('documento', 'lead', l.id, f.name); ui.toast('Documento anexado (simulado).', 'success'); drawDocs(box, l);
    });
    box.querySelectorAll('[data-dl]').forEach(function (b) { b.addEventListener('click', function () { ui.toast('Download simulado.', 'success'); }); });
    box.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { list.splice(+b.getAttribute('data-rm'), 1); S.save(); drawDocs(box, l); }); });
  }

  /* ---- ações ---- */
  function changeEtapa(l) {
    ui.modal({ title: 'Mudar etapa', size: 'sm', body: '<div class="form"><label class="full"><span class="text-sm muted">Nova etapa</span><select id="m-etapa">' + opts(SP.consts.etapasAtivas({ semPerdido: true }).map(function (e) { return { v: e.id, t: etapaNome(e.id) }; }), l.etapa) + '</select></label></div>',
      actions: [{ label: 'Cancelar' }, { label: 'Confirmar', cls: 'btn-primary', onClick: function (ctx) {
        var n = ctx.el.querySelector('#m-etapa').value; if (n === l.etapa) return;
        var old = l.etapa; l.etapa = n; addInteracao(l, 'sistema', 'Etapa alterada: ' + etapaNome(old) + ' -> ' + etapaNome(n)); S.save(); S.log('etapa', 'lead', l.id, old + ' -> ' + n); ui.toast('Etapa atualizada.', 'success'); SP.refresh();
      } }] });
  }
  function transfer(l) {
    ui.modal({ title: 'Transferir vendedor', size: 'sm', body: '<div class="form"><label class="full"><span class="text-sm muted">Novo responsável</span><select id="m-v">' + vendOpts(l.vendedorId) + '</select></label></div>',
      actions: [{ label: 'Cancelar' }, { label: 'Transferir', cls: 'btn-primary', onClick: function (ctx) {
        var v = ctx.el.querySelector('#m-v').value; if (!v || v === l.vendedorId) return;
        var o = S.user(l.vendedorId), n = S.user(v); l.vendedorId = v;
        addInteracao(l, 'sistema', 'Transferido de ' + (o ? o.nome : 'ninguém') + ' para ' + n.nome); S.save(); S.log('transferir', 'lead', l.id, (o ? o.nome : '-') + ' -> ' + n.nome); ui.toast('Lead transferido.', 'success'); SP.refresh();
      } }] });
  }
  function askPerdido(l) {
    ui.modal({ title: 'Marcar como perdido', size: 'sm', body: '<div class="form"><label class="full"><span class="text-sm muted">Motivo da perda *</span><select id="m-mot">' + opts(SP.consts.MOTIVOS_PERDA, '', 'Selecione...') + '</select></label><label class="full"><span class="text-sm muted">Observação</span><input id="m-obs"></label></div>',
      actions: [{ label: 'Cancelar' }, { label: 'Marcar perdido', cls: 'btn-danger', keepOpen: true, onClick: function (ctx) {
        var mot = ctx.el.querySelector('#m-mot').value; if (!mot) { ui.toast('Selecione o motivo.', 'error'); return; }
        var obs = ctx.el.querySelector('#m-obs').value.trim();
        l.etapa = 'perdido'; l.motivoPerda = mot; addInteracao(l, 'sistema', 'Marcado como perdido: ' + mot + (obs ? ' - ' + obs : '')); S.save(); S.log('perdido', 'lead', l.id, mot); ctx.close(); ui.toast('Lead marcado como perdido.', 'success'); SP.refresh();
      } }] });
  }

  SP.register({
    route: 'leads', title: 'Leads', icon: 'users', group: 'Vendas', order: 10, roles: ['dono', 'vendedor'],
    render: function (el, params) { if (params && params.id) renderDetail(el, params.id); else renderList(el); }
  });
})();
