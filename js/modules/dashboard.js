/* Módulo: Dashboard (rota #/inicio). Visão do dono e versão pessoal do vendedor. */
(function () {
  'use strict';
  var period = 'mes';

  function startOf(p) {
    var n = new Date();
    if (p === 'mes') return new Date(n.getFullYear(), n.getMonth(), 1).getTime();
    return Date.now() - (p === '30' ? 30 : 90) * 86400000;
  }
  function sum(a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0); }
  function group(a, keyFn) { var m = {}; a.forEach(function (x) { var k = keyFn(x); m[k] = (m[k] || 0) + 1; }); return m; }

  function render(el) {
    var ui = SP.ui, S = SP.store, C = SP.consts, sess = SP.session, pessoal = sess.role === 'vendedor';
    var start = startOf(period);
    var leadsAll = S.visibleLeads(), ids = {};
    leadsAll.forEach(function (l) { ids[l.id] = l; });
    var leadsP = leadsAll.filter(function (l) { return new Date(l.criadoEm).getTime() >= start; });
    var vendas = S.collection('contratos').filter(function (c) { return ids[c.leadId] && c.status === 'assinado' && new Date(c.assinadoEm).getTime() >= start; });
    var fat = sum(vendas, function (c) { return c.valor; });
    var conv = leadsP.length ? vendas.length / leadsP.length * 100 : 0;
    var negoc = sum(leadsAll.filter(function (l) { return C.EM_NEGOCIACAO.indexOf(l.etapa) >= 0; }), function (l) { return l.valorEstimado; });
    var comResp = leadsP.filter(function (l) { return l.primeiraRespostaMin != null; });
    var tResp = comResp.length ? sum(comResp, function (l) { return l.primeiraRespostaMin; }) / comResp.length : null;
    var semAt = leadsAll.filter(function (l) { return l.etapa === 'novo' && !l.interacoes.length; });
    var nomePeriodo = { mes: 'neste mês', '30': 'nos últimos 30 dias', '90': 'nos últimos 90 dias' }[period];

    var kpis = [
      ui.kpi({ label: 'Leads ' + nomePeriodo, value: ui.fmtNum(leadsP.length), icon: 'users', tone: 'blue', href: '#/leads' }),
      ui.kpi({ label: 'Taxa de conversão', value: ui.fmtPct(conv), sub: vendas.length + ' venda(s) fechada(s)', icon: 'target', tone: 'green' }),
      ui.kpi({ label: 'Faturamento vendido', value: ui.fmtMoney(fat, { compact: true }), sub: ui.fmtMoney(fat), icon: 'dollar', tone: 'orange' }),
      ui.kpi({ label: 'Ticket médio', value: ui.fmtMoney(vendas.length ? fat / vendas.length : 0, { compact: true }), icon: 'trending', tone: 'orange' }),
      ui.kpi({ label: 'Valor em negociação', value: ui.fmtMoney(negoc, { compact: true }), sub: 'Propostas, negociação e contrato', icon: 'funnel', tone: 'blue', href: '#/funil' }),
      ui.kpi({ label: 'Tempo médio 1ª resposta', value: ui.fmtDuration(tResp), icon: 'clock', tone: tResp != null && tResp > 60 ? 'red' : 'green' }),
      ui.kpi({ label: 'Leads sem atendimento', value: semAt.length, sub: semAt.length ? 'Responder agora' : 'Tudo atendido', icon: 'alert', tone: semAt.length ? 'red' : 'green', href: '#/leads' })
    ].join('');

    /* gráficos */
    var porCanal = group(leadsP, function (l) { return l.origem; });
    var canalItems = Object.keys(porCanal).map(function (k) { return { label: k, value: porCanal[k] }; }).sort(function (a, b) { return b.value - a.value; });
    var funilItems = C.etapasAtivas({ semPerdido: true }).map(function (e) { return { label: e.nome, value: leadsAll.filter(function (l) { return l.etapa === e.id; }).length, color: e.cor, href: '#/funil' }; });
    var perd = group(leadsAll.filter(function (l) { return l.etapa === 'perdido'; }), function (l) { return l.motivoPerda || 'Outro'; });
    var perdItems = Object.keys(perd).map(function (k) { return { label: k, value: perd[k] }; }).sort(function (a, b) { return b.value - a.value; });

    var colAside;
    if (pessoal) {
      var ym = new Date().getFullYear() + '-' + ('0' + (new Date().getMonth() + 1)).slice(-2);
      var meta = S.collection('metas').filter(function (m) { return m.vendedorId === sess.userId && m.mes === ym; })[0];
      var vendidoMes = sum(S.collection('contratos').filter(function (c) { return c.vendedorId === sess.userId && c.status === 'assinado' && new Date(c.assinadoEm).getTime() >= startOf('mes'); }), function (c) { return c.valor; });
      var pct = meta ? vendidoMes / meta.metaVendas * 100 : 0;
      var tarefas = S.collection('tarefas').filter(function (t) { return t.responsavelId === sess.userId && !t.concluida && new Date(t.vencimento).getTime() < Date.now() + 2 * 86400000; }).sort(function (a, b) { return a.vencimento < b.vencimento ? -1 : 1; }).slice(0, 6);
      colAside = '<div class="card"><h3 class="card-title">Minha meta do mês</h3>' + (meta ? '<div class="meta-big">' + ui.fmtPct(pct) + '</div>' + ui.progress(pct) + '<p class="muted text-sm mt">' + ui.fmtMoney(vendidoMes) + ' de ' + ui.fmtMoney(meta.metaVendas) + '</p>' : '<p class="muted">Sem meta definida.</p>') + '</div>' +
        '<div class="card"><h3 class="card-title">Minhas tarefas</h3>' + (tarefas.length ? '<ul class="list">' + tarefas.map(function (t) {
          var atras = new Date(t.vencimento).getTime() < Date.now();
          return '<li><a class="list-row" href="#/leads/' + t.leadId + '"><span>' + ui.esc(t.titulo) + '</span><span class="' + (atras ? 'text-red' : 'muted') + ' text-sm">' + ui.timeAgo(t.vencimento) + '</span></a></li>';
        }).join('') + '</ul>' : ui.empty({ icon: 'check', title: 'Sem tarefas pendentes' })) + '</div>';
    } else {
      var vend = S.vendedores().map(function (u) { return { label: u.nome.split(' ')[0], value: sum(vendas.filter(function (c) { return c.vendedorId === u.id; }), function (c) { return c.valor; }), color: u.cor }; }).sort(function (a, b) { return b.value - a.value; });
      colAside = '<div class="card"><h3 class="card-title">Vendas por vendedor</h3>' + ui.barChart(vend.map(function (v) { v.display = ui.fmtMoney(v.value, { compact: true }); return v; })) + '</div>';
    }

    /* alertas */
    var alertas = [];
    leadsAll.forEach(function (l) {
      if (['venda_fechada', 'instalacao', 'pos_venda', 'perdido'].indexOf(l.etapa) >= 0) return;
      var d = ui.daysSince(l.ultimoContato || l.criadoEm);
      if (d > 3) alertas.push({ d: d, tipo: 'parado', lead: l, txt: 'Lead parado há ' + Math.floor(d) + ' dias em ' + C.etapa(l.etapa).nome });
    });
    S.collection('propostas').forEach(function (p) {
      if (!ids[p.leadId] || (p.status !== 'enviada' && p.status !== 'visualizada')) return;
      var d = ui.daysSince(p.enviadaEm);
      if (d > 3) alertas.push({ d: d, tipo: 'proposta', lead: ids[p.leadId], txt: 'Proposta ' + p.numero + ' sem resposta há ' + Math.floor(d) + ' dias (' + ui.fmtMoney(p.valor, { compact: true }) + ')' });
    });
    alertas.sort(function (a, b) { return b.d - a.d; });
    var alertHtml = alertas.length ? '<ul class="list">' + alertas.slice(0, 8).map(function (a) {
      return '<li><a class="list-row" href="#/leads/' + a.lead.id + '"><span class="row-ic ' + (a.tipo === 'parado' ? 'tone-amber' : 'tone-red') + '">' + ui.icon(a.tipo === 'parado' ? 'clock' : 'file', 16) + '</span><span class="grow"><b>' + ui.esc(a.lead.nome) + '</b><br><span class="muted text-sm">' + ui.esc(a.txt) + '</span></span>' + ui.icon('chevronRight', 16) + '</a></li>';
    }).join('') + '</ul>' : ui.empty({ icon: 'check', title: 'Nenhum alerta', text: 'Todos os leads estão em dia.' });

    el.innerHTML = ui.pageHeader(pessoal ? 'Meu painel' : 'Visão geral', pessoal ? 'Seus números, ' + (sess.user() ? sess.user().nome.split(' ')[0] : '') + '. Foque nos alertas abaixo.' : 'Como está a Solar Prime: quanto entrou, o que está em jogo e onde agir hoje.',
      ui.tabs([{ id: 'mes', label: 'Este mês' }, { id: '30', label: '30 dias' }, { id: '90', label: '90 dias' }], period)) +
      '<div class="card as-dash"><h3 class="card-title">' + ui.icon('sparkle', 18) + ' Pergunte ao Assistente</h3><form class="as-ask" id="as-dash-form"><input type="text" id="as-dash-q" placeholder="Ex.: ' + ({ vendedor: 'quem devo ligar primeiro?', financeiro: 'o que vence esta semana?', trafego: 'qual o CPL por campanha?' }[sess.role] || 'resumo da empresa hoje') + '" aria-label="Pergunte ao Assistente"><button class="btn btn-primary" type="submit">Perguntar</button></form></div>' +
      '<div class="kpi-grid mt">' + kpis + '</div>' +
      '<div class="grid grid-2 mt">' +
      '<div class="card"><h3 class="card-title">Leads por canal</h3>' + ui.barChart(canalItems) + '</div>' + colAside + '</div>' +
      '<div class="grid grid-2 mt">' +
      '<div class="card"><h3 class="card-title">Funil de vendas <a class="link text-sm" href="#/funil">ver funil</a></h3>' + ui.barChart(funilItems) + '</div>' +
      '<div class="card"><h3 class="card-title">Motivos de perda</h3>' + ui.donut(perdItems, { centerLabel: 'perdidos' }) + '</div></div>' +
      '<div class="card mt"><h3 class="card-title">Alertas <span class="chip chip-red">' + alertas.length + '</span></h3>' + alertHtml + '</div>';

    var af = el.querySelector('#as-dash-form');
    if (af) af.addEventListener('submit', function (ev) { ev.preventDefault(); var q = el.querySelector('#as-dash-q').value.trim(); SP.go('assistente' + (q ? '?q=' + encodeURIComponent(q) : '')); });
    el.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { period = b.getAttribute('data-tab'); render(el); }); });
  }

  SP.register({ route: 'inicio', title: 'Início', icon: 'home', group: '', order: 0, roles: ['dono', 'vendedor', 'financeiro'], render: render });
})();
