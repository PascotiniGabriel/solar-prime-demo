/* Módulo: Estoque (rota #/estoque). Produtos, movimentações, reservas por obra e pedidos de compra. */
(function () {
  'use strict';
  var ui = SP.ui, esc = ui.esc, store = SP.store;
  var tab = 'produtos', f = { q: '', cat: '', baixo: false };
  var FORN = { 'Módulo': 'SolarTech Distribuidora', 'Inversor': 'EnergiaMax Atacado', 'Estrutura': 'MetalSol Estruturas', 'Cabo': 'CaboVolt Materiais Elétricos', 'String box': 'EnergiaMax Atacado' };
  var PSTAT = { rascunho: ['Rascunho', 'gray'], enviado: ['Enviado ao fornecedor', 'blue'], recebido: ['Recebido', 'green'], cancelado: ['Cancelado', 'red'] };

  function disp(it) { return it.qtd - (it.reservado || 0); }
  function baixo(it) { return it.qtd < it.min; }
  function recalc(it) { it.reservado = (it.reservas || []).reduce(function (s, r) { return s + r.qtd; }, 0); }
  function save() { store.save(); SP.refresh(); }
  function movs() { return store.collection('movimentos'); }
  function pedidos() { return store.collection('pedidosCompra'); }
  function mov(it, tipo, qtd, motivo, obraId) {
    movs().unshift({ id: store.nextId('m'), itemId: it.id, tipo: tipo, qtd: qtd, motivo: motivo || '', obraId: obraId || '', em: new Date().toISOString(), porId: SP.session.userId });
  }
  function obraLabel(id) { var o = store.find('obras', id), l = o && store.lead(o.leadId); return l ? l.nome + ' (' + o.id + ')' : id; }
  function money(v) { return ui.fmtMoney(v, { cents: v < 100 }); }

  function filtered() {
    var q = f.q.toLowerCase();
    return store.collection('estoque').filter(function (it) {
      if (f.cat && it.categoria !== f.cat) return false;
      if (f.baixo && !baixo(it)) return false;
      return !q || (it.nome + ' ' + it.marca + ' ' + it.sku).toLowerCase().indexOf(q) >= 0;
    });
  }
  function statusBadge(it) {
    if (it.qtd <= 0) return ui.badge('Zerado', 'red');
    if (baixo(it)) return ui.badge('Abaixo do mínimo', 'red');
    if (it.qtd < it.min * 1.3) return ui.badge('Atenção', 'amber');
    return ui.badge('OK', 'green');
  }
  function actions(it) {
    return '<button class="btn btn-sm" data-a="in" data-id="' + it.id + '">+ Entrada</button><button class="btn btn-sm" data-a="out" data-id="' + it.id + '">- Saída</button><button class="btn btn-sm" data-a="res" data-id="' + it.id + '">Reservar</button><button class="btn btn-sm btn-ghost" data-a="hist" data-id="' + it.id + '">Histórico</button>';
  }

  function produtosHtml(list) {
    if (!list.length) return '<div class="card">' + ui.empty({ icon: 'box', title: 'Nenhum produto encontrado', text: 'Ajuste a busca ou os filtros.' }) + '</div>';
    var rows = list.map(function (it) {
      return '<tr' + (baixo(it) ? ' class="est-low"' : '') + '><td><b>' + esc(it.nome) + '</b><div class="muted text-sm">' + esc(it.marca) + ' · ' + esc(it.sku) + '</div></td><td>' + esc(it.categoria) + '</td><td class="right"><b>' + ui.fmtNum(it.qtd) + '</b> ' + esc(it.unidade) + '</td><td class="right">' + ui.fmtNum(it.min) + '</td><td class="right">' + ui.fmtNum(it.reservado || 0) + '</td><td class="right"><b>' + ui.fmtNum(disp(it)) + '</b></td><td class="right">' + money(it.custo) + '</td><td class="right">' + money(it.preco) + '</td><td>' + statusBadge(it) + '</td><td class="est-act">' + actions(it) + '</td></tr>';
    }).join('');
    var cards = list.map(function (it) {
      var pct = it.min ? Math.min(100, it.qtd / (it.min * 2) * 100) : 100;
      return '<div class="est-card' + (baixo(it) ? ' est-low' : '') + '"><div class="row" style="justify-content:space-between;gap:8px"><b>' + esc(it.nome) + '</b>' + statusBadge(it) + '</div><div class="muted text-sm">' + esc(it.categoria) + ' · ' + esc(it.marca) + '</div>' +
        '<div class="est-nums"><div><small>Em estoque</small><b>' + ui.fmtNum(it.qtd) + '</b></div><div><small>Reservado</small><b>' + ui.fmtNum(it.reservado || 0) + '</b></div><div><small>Disponível</small><b>' + ui.fmtNum(disp(it)) + '</b></div><div><small>Mínimo</small><b>' + ui.fmtNum(it.min) + '</b></div></div>' +
        ui.progress(pct, baixo(it) ? 'var(--red)' : '') + '<div class="est-act mt">' + actions(it) + '</div></div>';
    }).join('');
    return '<div class="card table-wrap est-desktop"><table class="table"><thead><tr><th>Produto</th><th>Categoria</th><th class="right">Qtd</th><th class="right">Mín.</th><th class="right">Reserv.</th><th class="right">Disp.</th><th class="right">Custo</th><th class="right">Preço</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="est-mobile">' + cards + '</div>';
  }
  function movsHtml() {
    var m = movs().slice(0, 100);
    if (!m.length) return '<div class="card">' + ui.empty({ icon: 'refresh', title: 'Sem movimentações', text: 'Entradas, saídas e reservas aparecem aqui.' }) + '</div>';
    var tl = { entrada: ['Entrada', 'green'], saida: ['Saída', 'red'], reserva: ['Reserva', 'blue'], ajuste: ['Ajuste', 'gray'] };
    return '<div class="card"><ul class="list">' + m.map(function (x) {
      var it = store.find('estoque', x.itemId), u = store.user(x.porId), t = tl[x.tipo] || tl.ajuste;
      return '<li class="list-row"><span>' + ui.badge(t[0], t[1]) + '</span><span class="grow"><b>' + esc(it ? it.nome : x.itemId) + '</b><div class="muted text-sm">' + esc(x.motivo) + (x.obraId ? ' · ' + esc(obraLabel(x.obraId)) : '') + ' · ' + esc(u ? u.nome : '') + '</div></span><span class="right"><b>' + (x.tipo === 'saida' ? '-' : '+') + ui.fmtNum(x.qtd) + '</b><div class="muted text-sm">' + ui.fmtDateTime(x.em) + '</div></span></li>';
    }).join('') + '</ul></div>';
  }
  function pedidosHtml() {
    var p = pedidos();
    if (!p.length) return '<div class="card">' + ui.empty({ icon: 'file', title: 'Nenhum pedido de compra', text: 'Gere um pedido a partir dos itens abaixo do mínimo.', actionHtml: '<button class="btn btn-primary" data-a="novoPedido">Novo pedido de compra</button>' }) + '</div>';
    return '<div class="stack">' + p.map(function (x) {
      var st = PSTAT[x.status];
      return '<div class="card"><div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b>' + esc(x.numero) + '</b> · ' + esc(x.fornecedor) + '<div class="muted text-sm">' + ui.fmtDate(x.criadoEm) + ' · ' + x.itens.length + ' item(ns)</div></div><div>' + ui.badge(st[0], st[1]) + ' <b>' + ui.fmtMoney(x.total) + '</b></div></div>' +
        '<ul class="list mt">' + x.itens.map(function (i) { return '<li class="list-row"><span class="grow">' + esc(i.nome) + '</span><span>' + ui.fmtNum(i.qtd) + ' x ' + money(i.custo) + '</span></li>'; }).join('') + '</ul>' +
        '<div class="row mt" style="gap:8px;flex-wrap:wrap">' + (x.status === 'rascunho' ? '<button class="btn btn-primary btn-sm" data-pd="enviado" data-id="' + x.id + '">Enviar ao fornecedor</button>' : '') + (x.status === 'enviado' ? '<button class="btn btn-primary btn-sm" data-pd="recebido" data-id="' + x.id + '">Marcar como recebido</button>' : '') + (x.status === 'rascunho' || x.status === 'enviado' ? '<button class="btn btn-ghost btn-sm" data-pd="cancelado" data-id="' + x.id + '">Cancelar</button>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  /* ---------- modais ---------- */
  function qtyModal(it, kind) {
    var isIn = kind === 'in';
    ui.modal({ title: (isIn ? 'Entrada: ' : 'Saída: ') + it.nome, size: 'sm', body: '<div class="form"><label class="full">Quantidade (' + esc(it.unidade) + ')<input type="number" id="qQ" min="1" value="1" inputmode="numeric"></label><label class="full">Motivo<input id="qM" placeholder="' + (isIn ? 'Ex.: Compra NF 1234' : 'Ex.: Uso na obra / perda') + '"></label>' +
      (isIn ? '' : '<label class="full">Obra (opcional)<select id="qO"><option value="">-</option>' + store.collection('obras').filter(function (o) { return o.status !== 'concluida'; }).map(function (o) { return '<option value="' + o.id + '">' + esc(obraLabel(o.id)) + '</option>'; }).join('') + '</select></label>') + '</div>',
      actions: [{ label: 'Cancelar' }, { label: 'Confirmar', cls: 'btn-primary', onClick: function (c) {
        var q = Math.floor(+c.el.querySelector('#qQ').value);
        if (!(q > 0)) { ui.toast('Informe uma quantidade válida', 'error'); return false; }
        if (!isIn && q > it.qtd) { ui.toast('Saída maior que o estoque (' + it.qtd + ')', 'error'); return false; }
        var m = c.el.querySelector('#qM').value.trim(), ob = isIn ? '' : c.el.querySelector('#qO').value;
        it.qtd += isIn ? q : -q; mov(it, isIn ? 'entrada' : 'saida', q, m || (isIn ? 'Entrada manual' : 'Saída manual'), ob);
        store.log('ajustou estoque', 'estoque', it.id, (isIn ? '+' : '-') + q + ' ' + it.nome); ui.toast('Estoque atualizado', 'success'); save();
      } }] });
  }
  function reservaModal(it) {
    var obras = store.collection('obras').filter(function (o) { return o.status !== 'concluida'; });
    ui.modal({ title: 'Reservar: ' + it.nome, size: 'sm', body: '<p class="muted text-sm">Disponível: <b>' + disp(it) + '</b> ' + esc(it.unidade) + '</p><div class="form"><label class="full">Obra<select id="rO">' + obras.map(function (o) { return '<option value="' + o.id + '">' + esc(obraLabel(o.id)) + '</option>'; }).join('') + '</select></label><label class="full">Quantidade<input type="number" id="rQ" min="1" value="1"></label></div>',
      actions: [{ label: 'Cancelar' }, { label: 'Reservar', cls: 'btn-primary', onClick: function (c) {
        var q = Math.floor(+c.el.querySelector('#rQ').value), ob = c.el.querySelector('#rO').value;
        if (!ob || !(q > 0)) { ui.toast('Escolha obra e quantidade', 'error'); return false; }
        if (q > disp(it)) { ui.toast('Só há ' + disp(it) + ' disponível', 'error'); return false; }
        it.reservas = it.reservas || []; var r = it.reservas.filter(function (x) { return x.obraId === ob; })[0]; if (r) r.qtd += q; else it.reservas.push({ obraId: ob, qtd: q });
        recalc(it); mov(it, 'reserva', q, 'Reserva para obra', ob); store.log('ajustou estoque', 'estoque', it.id, 'Reservou ' + q + ' para ' + ob); ui.toast('Reservado', 'success'); save();
      } }] });
  }
  function histModal(it) {
    var m = movs().filter(function (x) { return x.itemId === it.id; }).slice(0, 30), rs = it.reservas || [];
    ui.modal({ title: it.nome, size: 'lg', body: '<div class="card-title">Reservas por obra</div>' + (rs.length ? '<ul class="list">' + rs.map(function (r) { return '<li class="list-row"><span class="grow">' + esc(obraLabel(r.obraId)) + '</span><b>' + r.qtd + ' ' + esc(it.unidade) + '</b><button class="btn btn-sm btn-ghost" data-lib="' + esc(r.obraId) + '">Liberar</button></li>'; }).join('') + '</ul>' : '<p class="muted text-sm">Sem reservas.</p>') +
      '<div class="card-title mt">Movimentações</div>' + (m.length ? '<ul class="list">' + m.map(function (x) { return '<li class="list-row"><span class="grow">' + esc(x.tipo) + ' · ' + esc(x.motivo) + '</span><b>' + (x.tipo === 'saida' ? '-' : '+') + x.qtd + '</b><span class="muted text-sm">' + ui.fmtDateTime(x.em) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted text-sm">Sem movimentações registradas.</p>'),
      actions: [{ label: 'Fechar' }] }).body.querySelectorAll('[data-lib]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ob = b.getAttribute('data-lib'); it.reservas = it.reservas.filter(function (r) { return r.obraId !== ob; }); recalc(it); mov(it, 'ajuste', 0, 'Reserva liberada', ob);
        store.log('ajustou estoque', 'estoque', it.id, 'Liberou reserva da obra ' + ob); ui.toast('Reserva liberada', 'success'); save();
        var bk = document.querySelector('.modal-backdrop'); if (bk && bk.parentNode) bk.parentNode.removeChild(bk);
      });
    });
  }
  function novoPedidoModal() {
    var low = store.collection('estoque').filter(baixo);
    if (!low.length) { ui.toast('Nenhum item abaixo do mínimo', 'info'); return; }
    var fornecs = Object.keys(FORN).map(function (k) { return FORN[k]; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    ui.modal({ title: 'Novo pedido de compra', size: 'lg', body: '<p class="muted text-sm">Itens abaixo do mínimo. Marque o que deseja comprar e ajuste a quantidade.</p><div class="est-pick">' + low.map(function (it) {
      var sug = Math.max(1, it.min * 2 - it.qtd);
      return '<div class="est-pickrow"><input type="checkbox" checked data-pk="' + it.id + '"><span class="grow"><b>' + esc(it.nome) + '</b><div class="muted text-sm">Estoque ' + it.qtd + ' / mín. ' + it.min + ' · ' + esc(FORN[it.categoria] || '') + ' · ' + money(it.custo) + '</div></span><input type="number" min="1" value="' + sug + '" data-pq="' + it.id + '" class="input" style="width:90px"></div>';
    }).join('') + '</div><div class="form mt"><label class="full">Fornecedor<select id="pF">' + fornecs.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select></label></div>',
      actions: [{ label: 'Cancelar' }, { label: 'Gerar pedido', cls: 'btn-primary', onClick: function (c) {
        var itens = [];
        c.el.querySelectorAll('[data-pk]').forEach(function (cb) { if (!cb.checked) return; var id = cb.getAttribute('data-pk'), it = store.find('estoque', id), q = Math.floor(+c.el.querySelector('[data-pq="' + id + '"]').value); if (it && q > 0) itens.push({ itemId: id, nome: it.nome, qtd: q, custo: it.custo }); });
        if (!itens.length) { ui.toast('Selecione ao menos um item', 'error'); return false; }
        var p = { id: store.nextId('p'), numero: 'PC-' + String(pedidos().length + 1).padStart(4, '0'), fornecedor: c.el.querySelector('#pF').value, itens: itens, total: itens.reduce(function (s, i) { return s + i.qtd * i.custo; }, 0), status: 'rascunho', criadoEm: new Date().toISOString() };
        pedidos().unshift(p); tab = 'pedidos'; store.log('ajustou estoque', 'estoque', p.id, 'Pedido de compra ' + p.numero + ' (' + itens.length + ' itens)'); ui.toast('Pedido ' + p.numero + ' gerado', 'success'); save();
      } }] });
  }
  function novoProdutoModal() {
    var cats = ['Módulo', 'Inversor', 'Estrutura', 'Cabo', 'String box'];
    ui.modal({ title: 'Novo produto', body: '<div class="form"><label class="full">Nome<input id="nN"></label><label>Categoria<select id="nC">' + cats.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></label><label>Marca<input id="nM"></label><label>SKU<input id="nS"></label><label>Unidade<input id="nU" value="un"></label><label>Qtd inicial<input type="number" id="nQ" value="0" min="0"></label><label>Mínimo<input type="number" id="nMin" value="0" min="0"></label><label>Custo (R$)<input type="number" id="nCu" step="0.01" min="0"></label><label>Preço (R$)<input type="number" id="nPr" step="0.01" min="0"></label></div>',
      actions: [{ label: 'Cancelar' }, { label: 'Salvar', cls: 'btn-primary', onClick: function (c) {
        var g = function (s) { return c.el.querySelector(s).value; }, nome = g('#nN').trim();
        if (!nome) { ui.toast('Informe o nome', 'error'); return false; }
        var it = store.upsert('estoque', { categoria: g('#nC'), nome: nome, marca: g('#nM'), sku: g('#nS'), unidade: g('#nU') || 'un', qtd: +g('#nQ') || 0, min: +g('#nMin') || 0, custo: +g('#nCu') || 0, preco: +g('#nPr') || 0, reservado: 0, reservas: [] });
        store.log('ajustou estoque', 'estoque', it.id, 'Novo produto: ' + nome); ui.toast('Produto cadastrado', 'success'); SP.refresh();
      } }] });
  }

  function render(el) {
    var all = store.collection('estoque'), isTec = SP.session.role === 'tecnico';
    var valor = all.reduce(function (s, i) { return s + i.qtd * i.custo; }, 0), lows = all.filter(baixo), reserv = all.reduce(function (s, i) { return s + (i.reservado || 0) * i.custo; }, 0);
    var abertos = pedidos().filter(function (p) { return p.status === 'rascunho' || p.status === 'enviado'; }).length;
    var cats = all.map(function (i) { return i.categoria; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    el.innerHTML = ui.pageHeader('Estoque', 'Equipamentos, reservas por obra e compras', '<button class="btn" id="eNovoP">+ Produto</button><button class="btn btn-primary" data-a="novoPedido">Pedido de compra</button>') +
      '<div class="kpi-grid">' + ui.kpi({ label: 'Valor em estoque', value: ui.fmtMoney(valor, { compact: true }), sub: 'a preço de custo', icon: 'dollar', tone: 'green' }) + ui.kpi({ label: 'Abaixo do mínimo', value: lows.length, sub: lows.length ? 'precisam de reposição' : 'tudo certo', icon: 'alert', tone: lows.length ? 'red' : 'green' }) +
      ui.kpi({ label: 'Reservado p/ obras', value: ui.fmtMoney(reserv, { compact: true }), icon: 'hardhat', tone: 'blue' }) + ui.kpi({ label: 'Pedidos em aberto', value: abertos, icon: 'file', tone: 'orange' }) + '</div>' +
      (lows.length ? '<div class="est-alert">' + ui.icon('alert', 18) + '<span><b>' + lows.length + ' item(ns) abaixo do mínimo:</b> ' + esc(lows.slice(0, 4).map(function (i) { return i.nome.replace(/\s*\(.*\)/, ''); }).join(', ')) + (lows.length > 4 ? '...' : '') + '</span><button class="btn btn-sm" data-a="novoPedido">Gerar pedido</button></div>' : '') +
      '<div class="row est-bar">' + ui.tabs([{ id: 'produtos', label: 'Produtos' }, { id: 'movs', label: 'Movimentações' }, { id: 'pedidos', label: 'Pedidos de compra' }], tab) + '</div>' +
      (tab === 'produtos' ? '<div class="row est-bar"><input class="input grow" id="eQ" placeholder="Buscar produto, marca ou SKU" value="' + esc(f.q) + '"><select class="input" id="eC"><option value="">Todas as categorias</option>' + cats.map(function (c) { return '<option' + (c === f.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select><label class="row text-sm" style="gap:6px"><input type="checkbox" id="eB"' + (f.baixo ? ' checked' : '') + '> Só abaixo do mínimo</label></div>' + produtosHtml(filtered()) : tab === 'movs' ? movsHtml() : pedidosHtml());

    el.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); SP.refresh(); }); });
    var q = el.querySelector('#eQ'); if (q) {
      q.addEventListener('change', function () { f.q = q.value; SP.refresh(); });
      el.querySelector('#eC').addEventListener('change', function (e) { f.cat = e.target.value; SP.refresh(); });
      el.querySelector('#eB').addEventListener('change', function (e) { f.baixo = e.target.checked; SP.refresh(); });
    }
    var np = el.querySelector('#eNovoP'); if (np) np.addEventListener('click', novoProdutoModal);
    el.querySelectorAll('[data-a]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-a'), it = store.find('estoque', b.getAttribute('data-id'));
        if (a === 'novoPedido') return novoPedidoModal();
        if (!it) return;
        if (a === 'in' || a === 'out') qtyModal(it, a); else if (a === 'res') reservaModal(it); else if (a === 'hist') histModal(it);
      });
    });
    el.querySelectorAll('[data-pd]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = pedidos().filter(function (x) { return x.id === b.getAttribute('data-id'); })[0], st = b.getAttribute('data-pd'); if (!p) return;
        p.status = st;
        if (st === 'recebido') p.itens.forEach(function (i) { var it = store.find('estoque', i.itemId); if (it) { it.qtd += i.qtd; mov(it, 'entrada', i.qtd, 'Recebimento ' + p.numero); } });
        store.log('ajustou estoque', 'estoque', p.id, p.numero + ' -> ' + st); ui.toast('Pedido ' + PSTAT[st][0].toLowerCase(), 'success'); save();
      });
    });
    void isTec;
  }

  SP.register({ route: 'estoque', title: 'Estoque', icon: 'box', group: 'Operação', order: 21, roles: ['dono', 'tecnico'], render: render });
})();
