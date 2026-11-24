/* Módulo: Financeiro (#/financeiro) - modo incluso (Solar Prime) ou ERP integrado. */
(function () {
  'use strict';
  var ui = SP.ui, store = SP.store, esc = ui.esc, M = function (v) { return ui.fmtMoney(v); };
  var ERPS = [
    { id: 'omie', nome: 'Omie', cor: '#0EA5E9', desc: 'ERP em nuvem para pequenas e médias empresas.' },
    { id: 'contaazul', nome: 'Conta Azul', cor: '#2563EB', desc: 'Gestão financeira e emissão de notas.' },
    { id: 'bling', nome: 'Bling', cor: '#16A34A', desc: 'Pedidos, estoque e notas fiscais.' },
    { id: 'tiny', nome: 'Tiny', cor: '#F59E0B', desc: 'ERP online com foco em vendas e financeiro.' },
    { id: 'sapb1', nome: 'SAP Business One', cor: '#0F4C81', desc: 'ERP para empresas em crescimento.' }
  ];
  var SYNC = ['Clientes (leads convertidos)', 'Vendas (contratos assinados)', 'Contas a receber (parcelas e entradas)', 'Comissões a pagar'];
  var st = { tab: 'receber', filtro: 'todos' };

  function cfg() { var db = store.get(); if (!db.config) db.config = {}; return db.config; }
  function mode() { return cfg().financeiroModo || 'incluso'; }
  function setMode(m) {
    cfg().financeiroModo = m; store.save();
    store.log('alterou modo financeiro', 'financeiro', m, m === 'incluso' ? 'Financeiro Solar Prime' : 'ERP integrado');
  }
  function erpState() { var c = cfg(); if (!c.erp) c.erp = {}; return c.erp; }

  function monthKey(d) { d = new Date(d); return d.getFullYear() + '-' + d.getMonth(); }
  function inMonth(iso, off) { var n = new Date(); return monthKey(iso) === monthKey(new Date(n.getFullYear(), n.getMonth() + off, 1)); }
  function monthLabel(off) { var n = new Date(); var d = new Date(n.getFullYear(), n.getMonth() + off, 1); return ui.monthName(d.getMonth()) + '/' + String(d.getFullYear()).slice(2); }
  function sum(arr) { return arr.reduce(function (s, x) { return s + x.valor; }, 0); }

  function render(el) {
    var m = mode();
    el.innerHTML = ui.pageHeader('Financeiro', 'Contas, fluxo de caixa e comissões em um só lugar.',
      m === 'incluso' ? '<button class="btn btn-primary" id="fin-new">' + ui.icon('plus', 16) + ' Novo lançamento</button>' : '') +
      explainer(m) + (m === 'incluso' ? incluso() : integrado());
    bind(el);
  }

  function explainer(m) {
    var mensal = 389;
    function opt(id, titulo, tag, itens, econ) {
      return '<div class="fin-opt' + (m === id ? ' active' : '') + '"><div class="row"><b>' + titulo + '</b><span class="grow"></span>' + (m === id ? ui.badge('Ativo', 'green') : '') + '</div>' +
        '<div class="text-sm muted mb">' + tag + '</div><ul class="fin-list">' + itens.map(function (i) { return '<li>' + ui.icon('check', 14) + i + '</li>'; }).join('') + '</ul>' +
        (econ ? '<div class="fin-econ">' + econ + '</div>' : '') +
        (m === id ? '' : '<button class="btn btn-primary btn-sm mt" data-mode="' + id + '">Usar este modo</button>') + '</div>';
    }
    return '<div class="card fin-explain"><div class="card-title">Como você quer controlar o financeiro?</div>' +
      '<p class="muted text-sm mb">Escolha uma opção. Você pode trocar quando quiser, sem perder dados.</p><div class="grid grid-2">' +
      opt('incluso', 'Financeiro Solar Prime (incluso)', 'Tudo numa ferramenta só.', ['Contas a receber e a pagar', 'Comissões automáticas dos contratos', 'Fluxo de caixa e DRE', 'Zero integração para configurar'], 'Sem precisar de outro sistema financeiro.') +
      opt('integrado', 'Usar meu ERP (integrado)', 'Mantenha seu sistema atual e sincronize.', ['Omie, Conta Azul, Bling, Tiny e SAP B1', 'Clientes, vendas e recebíveis sincronizados', 'Sem digitar dados duas vezes', 'Mantém a mensalidade do seu ERP'], '') +
      '</div></div>';
  }

  /* ---------- modo incluso ---------- */
  function incluso() {
    var L = store.collection('lancamentos');
    var rec = L.filter(function (l) { return l.tipo === 'receber'; }), pag = L.filter(function (l) { return l.tipo === 'pagar'; });
    var aReceber = sum(rec.filter(function (l) { return l.status !== 'pago'; })), aPagar = sum(pag.filter(function (l) { return l.status !== 'pago'; }));
    var fatMes = sum(rec.filter(function (l) { return l.status === 'pago' && inMonth(l.pagoEm, 0); }));
    var caixa = sum(rec.filter(function (l) { return l.status === 'pago'; })) - sum(pag.filter(function (l) { return l.status === 'pago'; }));
    var atrasado = rec.filter(function (l) { return l.status === 'atrasado'; });
    var h = '<div class="kpi-grid mb">' +
      ui.kpi({ label: 'A receber', value: M(aReceber), sub: atrasado.length + ' em atraso', icon: 'dollar', tone: 'green' }) +
      ui.kpi({ label: 'A pagar', value: M(aPagar), sub: 'contas em aberto', icon: 'wallet', tone: 'red' }) +
      ui.kpi({ label: 'Saldo em caixa', value: M(caixa), sub: 'recebido - pago', icon: 'trending', tone: caixa >= 0 ? 'blue' : 'red' }) +
      ui.kpi({ label: 'Faturado no mês', value: M(fatMes), sub: 'recebimentos confirmados', icon: 'bolt', tone: 'orange' }) + '</div>';
    h += '<div class="grid grid-2 mb"><div class="card"><div class="card-title">Fluxo de caixa</div>' + cashChart(L) + '</div>' +
      '<div class="card"><div class="card-title">DRE simplificado (mês atual)</div>' + dre(L) + '</div></div>';
    h += '<div class="card mb"><div class="card-title">Lançamentos</div>' +
      ui.tabs([{ id: 'receber', label: 'A receber' }, { id: 'pagar', label: 'A pagar' }, { id: 'parcelas', label: 'Financiamentos' }], st.tab) +
      '<div class="fin-filter mt">' + ['todos', 'pendente', 'atrasado', 'pago'].map(function (f) { return '<button class="chip fin-chip' + (st.filtro === f ? ' on' : '') + '" data-filtro="' + f + '">' + f.charAt(0).toUpperCase() + f.slice(1) + '</button>'; }).join('') + '</div>' +
      '<div class="mt">' + lancTable(st.tab === 'pagar' ? 'pagar' : 'receber', st.tab === 'parcelas') + '</div></div>';
    h += '<div class="card"><div class="card-title">Comissões por vendedor</div><p class="muted text-sm mb">Calculadas automaticamente: 5% de cada contrato assinado.</p>' + comissoes() + '</div>';
    return h;
  }

  function cashChart(L) {
    var cols = [-2, -1, 0, 1].map(function (o) {
      var e = sum(L.filter(function (l) { return l.tipo === 'receber' && (o <= 0 ? (l.status === 'pago' && inMonth(l.pagoEm, o)) : inMonth(l.vencimento, o) && l.status !== 'pago'); }));
      var s = sum(L.filter(function (l) { return l.tipo === 'pagar' && (o <= 0 ? (l.status === 'pago' && inMonth(l.pagoEm, o)) : inMonth(l.vencimento, o) && l.status !== 'pago'); }));
      return { lbl: monthLabel(o) + (o > 0 ? ' (proj.)' : ''), e: e, s: s, proj: o > 0 };
    });
    var max = Math.max.apply(null, cols.map(function (c) { return Math.max(c.e, c.s); }).concat([1]));
    return '<div class="fin-chart">' + cols.map(function (c) {
      return '<div class="fin-col' + (c.proj ? ' proj' : '') + '"><div class="fin-bars"><span class="fin-b in" style="height:' + (c.e / max * 100) + '%" title="Entradas ' + M(c.e) + '"></span><span class="fin-b out" style="height:' + (c.s / max * 100) + '%" title="Saídas ' + M(c.s) + '"></span></div>' +
        '<div class="fin-lbl">' + c.lbl + '</div><div class="text-sm ' + (c.e - c.s >= 0 ? 'fin-pos' : 'fin-neg') + '">' + ui.fmtMoney(c.e - c.s, { compact: true }) + '</div></div>';
    }).join('') + '</div><div class="fin-legend"><span><i class="in"></i>Entradas</span><span><i class="out"></i>Saídas</span><span class="muted">Barras claras = projeção</span></div>';
  }

  function dre(L) {
    var mes = L.filter(function (l) { return inMonth(l.status === 'pago' ? l.pagoEm : l.vencimento, 0); });
    var rec = sum(mes.filter(function (l) { return l.tipo === 'receber'; }));
    function cat(c) { return sum(mes.filter(function (l) { return l.tipo === 'pagar' && l.categoria === c; })); }
    var forn = cat('fornecedor'), com = cat('comissao'), imp = cat('impostos');
    var tot = sum(mes.filter(function (l) { return l.tipo === 'pagar'; })), outras = tot - forn - com - imp;
    var liq = rec - tot;
    function r(n, v, b, neg) { return '<tr' + (b ? ' class="fin-total"' : '') + '><td>' + n + '</td><td class="right ' + (neg ? 'fin-neg' : '') + '">' + (neg ? '- ' : '') + M(Math.abs(v)) + '</td></tr>'; }
    return '<div class="table-wrap"><table class="table"><tbody>' + r('Receita bruta', rec, true) + r('Impostos', imp, false, true) + r('Materiais e equipamentos', forn, false, true) + r('Comissões', com, false, true) + r('Despesas fixas e outras', outras, false, true) +
      '<tr class="fin-total"><td>Resultado do mês</td><td class="right ' + (liq >= 0 ? 'fin-pos' : 'fin-neg') + '">' + M(liq) + '</td></tr></tbody></table></div>' +
      '<div class="text-sm muted mt">Margem: ' + (rec ? ui.fmtPct(liq / rec * 100) : '-') + '</div>';
  }

  function statusBadge(s) { return ui.badge(s === 'pago' ? 'Pago' : s === 'atrasado' ? 'Atrasado' : 'Pendente', s === 'pago' ? 'green' : s === 'atrasado' ? 'red' : 'amber'); }

  function lancTable(tipo, financ) {
    var rows = store.collection('lancamentos').filter(function (l) {
      if (l.tipo !== tipo) return false;
      if (financ && !(l.categoria === 'financiamento' || /parcela|financ/i.test(l.descricao))) return false;
      return st.filtro === 'todos' || l.status === st.filtro;
    }).sort(function (a, b) { return new Date(a.vencimento) - new Date(b.vencimento); }).slice(0, 60);
    if (financ && !rows.length) {
      var fin = store.collection('contratos').filter(function (c) { return c.status === 'assinado' && /financ/i.test(c.formaPagamento || ''); });
      if (!fin.length) return ui.empty({ icon: 'dollar', title: 'Nenhuma parcela de financiamento', text: 'Contratos financiados aparecem aqui com as parcelas a receber do banco.' });
      return '<div class="text-sm muted mb">Parcelas previstas dos contratos financiados (repasse do banco)</div>' + '<div class="table-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Parcela</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>' +
        fin.slice(0, 12).map(function (c, i) { var l = store.lead(c.leadId); var d = new Date(); d.setMonth(d.getMonth() + (i % 3)); return '<tr><td>' + esc(l ? l.nome : '-') + '</td><td>1/' + (12 + (i % 4) * 12) + '</td><td>' + M(c.valor / (12 + (i % 4) * 12)) + '</td><td>' + ui.fmtDate(d.toISOString()) + '</td><td>' + ui.badge('Previsto', 'blue') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    if (!rows.length) return ui.empty({ icon: 'wallet', title: 'Nenhum lançamento', text: 'Nada encontrado com este filtro.' });
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(function (l) {
      return '<tr><td>' + esc(l.descricao) + '<div class="text-sm muted">' + esc(l.categoria || '') + '</div></td><td><b>' + M(l.valor) + '</b></td><td>' + ui.fmtDate(l.vencimento) + '</td><td>' + statusBadge(l.status) + '</td><td class="right">' +
        (l.status !== 'pago' ? '<button class="btn btn-sm btn-primary" data-pay="' + l.id + '">' + (tipo === 'receber' ? 'Receber' : 'Pagar') + '</button>' : '<span class="text-sm muted">' + ui.fmtDate(l.pagoEm) + '</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  function comissoes() {
    var cs = store.collection('contratos').filter(function (c) { return c.status === 'assinado'; });
    var vs = store.vendedores().map(function (v) {
      var mine = cs.filter(function (c) { return c.vendedorId === v.id; }), tot = sum(mine);
      var pagas = sum(store.collection('lancamentos').filter(function (l) { return l.categoria === 'comissao' && l.usuarioId === v.id && l.status === 'pago'; }));
      return { v: v, n: mine.length, tot: tot, com: Math.round(tot * 0.05), pagas: pagas };
    }).sort(function (a, b) { return b.tot - a.tot; });
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Vendedor</th><th>Contratos</th><th>Vendido</th><th>Comissão (5%)</th><th>Já paga</th></tr></thead><tbody>' + vs.map(function (r) {
      return '<tr><td><span class="row">' + ui.userAvatar(r.v.id, 26) + ' ' + esc(r.v.nome) + '</span></td><td>' + r.n + '</td><td>' + M(r.tot) + '</td><td><b>' + M(r.com) + '</b></td><td>' + M(r.pagas) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* ---------- modo integrado ---------- */
  function integrado() {
    var es = erpState();
    var h = '<div class="card mb"><div class="card-title">O que será sincronizado</div><ul class="fin-list">' + SYNC.map(function (s) { return '<li>' + ui.icon('check', 14) + s + '</li>'; }).join('') + '</ul>' +
      '<p class="text-sm muted mt">Os dados fluem do CRM para o ERP automaticamente. Contas pagas no ERP retornam e atualizam o status aqui.</p></div><div class="grid grid-3">';
    h += ERPS.map(function (e) {
      var s = es[e.id], on = s && s.conectado;
      return '<div class="card fin-erp"><div class="row"><span class="fin-logo" style="background:' + e.cor + '">' + esc(e.nome.charAt(0)) + '</span><div class="grow"><b>' + e.nome + '</b><div class="text-sm muted">' + e.desc + '</div></div></div>' +
        '<div class="mt">' + (on ? ui.badge('Conectado', 'green') + '<div class="text-sm muted mt">Última sincronização: ' + ui.timeAgo(s.ultimaSync) + '<br>' + ui.fmtNum(s.itens || 0) + ' registros enviados</div>' : ui.badge('Não conectado', 'gray')) + '</div>' +
        '<div class="fin-prog" id="prog-' + e.id + '"></div><div class="row mt">' +
        (on ? '<button class="btn btn-sm btn-primary" data-sync="' + e.id + '">' + ui.icon('refresh', 14) + ' Sincronizar agora</button><button class="btn btn-sm btn-ghost" data-disc="' + e.id + '">Desconectar</button>' : '<button class="btn btn-sm btn-primary" data-conn="' + e.id + '">Conectar</button>') + '</div></div>';
    }).join('') + '</div>';
    return h;
  }

  function connectModal(id) {
    var e = ERPS.filter(function (x) { return x.id === id; })[0];
    var md = ui.modal({
      title: 'Conectar ' + e.nome, size: 'sm',
      body: '<div class="fin-oauth"><span class="fin-logo big" style="background:' + e.cor + '">' + esc(e.nome.charAt(0)) + '</span><h3>Solar Prime CRM quer acessar sua conta ' + e.nome + '</h3>' +
        '<ul class="fin-list">' + ['Ler e criar clientes', 'Ler e criar vendas', 'Ler e criar contas a receber'].map(function (s) { return '<li>' + ui.icon('check', 14) + s + '</li>'; }).join('') + '</ul>' +
        '<p class="text-sm muted">Simulação de autorização OAuth. Nenhum dado real é enviado.</p></div>',
      actions: [{ label: 'Cancelar', cls: 'btn-ghost' }, {
        label: 'Autorizar', cls: 'btn-primary', onClick: function () {
          erpState()[id] = { conectado: true, ultimaSync: new Date().toISOString(), itens: store.collection('leads').length + store.collection('contratos').length };
          store.save(); store.log('conectou ERP', 'financeiro', id, e.nome); ui.toast(e.nome + ' conectado com sucesso', 'success'); SP.refresh();
        }
      }]
    });
  }

  function fakeSync(id, el) {
    var box = el.querySelector('#prog-' + id), steps = SYNC, i = 0;
    var timer = setInterval(function () {
      i++; var pct = Math.min(100, Math.round(i / steps.length * 100));
      box.innerHTML = '<div class="text-sm muted mt">' + (i <= steps.length ? 'Sincronizando: ' + esc(steps[i - 1]) : 'Concluído') + '</div>' + ui.progress(pct);
      if (i > steps.length) {
        clearInterval(timer); var s = erpState()[id]; s.ultimaSync = new Date().toISOString(); s.itens = store.collection('leads').length + store.collection('contratos').length + store.collection('lancamentos').length;
        store.save(); store.log('sincronizou ERP', 'financeiro', id, s.itens + ' registros'); ui.toast('Sincronização concluída', 'success'); SP.refresh();
      }
    }, 650);
  }

  function newModal() {
    var body = document.createElement('div');
    body.innerHTML = '<div class="form"><label>Tipo<select id="nl-tipo"><option value="receber">A receber</option><option value="pagar">A pagar</option></select></label>' +
      '<label>Categoria<select id="nl-cat"><option value="venda">Venda</option><option value="fornecedor">Fornecedor</option><option value="fixo">Despesa fixa</option><option value="marketing">Marketing</option><option value="impostos">Impostos</option><option value="outros">Outros</option></select></label>' +
      '<label class="full">Descrição<input id="nl-desc" placeholder="Ex.: Aluguel do galpão"></label><label>Valor (R$)<input id="nl-val" type="number" min="0" step="0.01"></label>' +
      '<label>Vencimento<input id="nl-venc" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></label></div>';
    ui.modal({
      title: 'Novo lançamento', body: body, actions: [{ label: 'Cancelar', cls: 'btn-ghost' }, {
        label: 'Salvar', cls: 'btn-primary', onClick: function () {
          var d = body.querySelector('#nl-desc').value.trim(), v = parseFloat(body.querySelector('#nl-val').value), dt = body.querySelector('#nl-venc').value;
          if (!d || !(v > 0) || !dt) { ui.toast('Preencha descrição, valor e vencimento', 'error'); return false; }
          var venc = new Date(dt + 'T12:00:00');
          var it = store.upsert('lancamentos', { tipo: body.querySelector('#nl-tipo').value, descricao: d, valor: v, vencimento: venc.toISOString(), pagoEm: null, status: venc < new Date() ? 'atrasado' : 'pendente', categoria: body.querySelector('#nl-cat').value });
          store.log('criou lançamento', 'financeiro', it.id, d + ' - ' + M(v)); ui.toast('Lançamento criado', 'success'); SP.refresh();
        }
      }]
    });
  }

  function bind(el) {
    el.addEventListener('click', function (ev) {
      var t = ev.target.closest('button'); if (!t) return;
      if (t.id === 'fin-new') return newModal();
      if (t.dataset.mode) { setMode(t.dataset.mode); ui.toast('Modo alterado', 'success'); return SP.refresh(); }
      if (t.dataset.tab) { st.tab = t.dataset.tab; return SP.refresh(); }
      if (t.dataset.filtro) { st.filtro = t.dataset.filtro; return SP.refresh(); }
      if (t.dataset.pay) {
        var l = store.find('lancamentos', t.dataset.pay);
        store.patch('lancamentos', l.id, { status: 'pago', pagoEm: new Date().toISOString() });
        store.log('registrou pagamento', 'financeiro', l.id, l.descricao); ui.toast('Marcado como pago', 'success'); return SP.refresh();
      }
      if (t.dataset.conn) return connectModal(t.dataset.conn);
      if (t.dataset.disc) { delete erpState()[t.dataset.disc]; store.save(); store.log('desconectou ERP', 'financeiro', t.dataset.disc, ''); return SP.refresh(); }
      if (t.dataset.sync) { t.disabled = true; return fakeSync(t.dataset.sync, el); }
    });
  }

  SP.register({
    route: 'financeiro', title: 'Financeiro', icon: 'wallet', group: 'Gestão', order: 30, roles: ['dono', 'financeiro'],
    render: function (el) { render(el); }
  });
})();
