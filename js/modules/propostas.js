/* Módulo: Propostas (#/propostas, #/propostas/<id>, #/propostas?lead=<id>). */
(function () {
  'use strict';
  var U = SP.ui, esc = U.esc, M = function (v, c) { return U.fmtMoney(v, c); }, N = function (v, d) { return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d || 0 }); };
  var HSP = { 'Campinas': 5.0, 'São Paulo': 4.6, 'Osasco': 4.6, 'Ribeirão Preto': 5.4, 'Sorocaba': 4.9, 'Jundiaí': 4.9, 'Belo Horizonte': 5.3, 'Rio de Janeiro': 5.0, 'Curitiba': 4.3, 'Goiânia': 5.5, 'Brasília': 5.5, 'Salvador': 5.5, 'Fortaleza': 5.6, 'Uberlândia': 5.5 };
  var BANCOS = [{ id: 'bv', nome: 'BV Solar', taxa: 1.19 }, { id: 'santander', nome: 'Santander Solar', taxa: 1.35 }, { id: 'sicredi', nome: 'Sicredi', taxa: 1.05 }];
  var STEPS = ['Cliente e consumo', 'Dimensionamento', 'Investimento', 'Economia', 'Pagamento'];
  var ST = { rascunho: ['Rascunho', 'gray'], enviada: ['Enviada', 'blue'], visualizada: ['Visualizada', 'amber'], aprovada: ['Aprovada', 'green'], recusada: ['Recusada', 'red'] };
  function stKey(p) { return p.status === 'aceita' ? 'aprovada' : p.status; }
  function emp() { return SP.store.get().empresa || { nome: 'Solar Prime' }; }

  /* ---------- cálculos ---------- */
  function est(cat) { return SP.store.collection('estoque').filter(function (e) { return e.categoria === cat; }); }
  function modW(m) { var r = /(\d{3})\s*W/i.exec(m.nome); return r ? +r[1] : 550; }
  function invKw(i) { var n = i.nome, r = /(\d+(?:\.\d+)?)\s*kW/i.exec(n) || /(\d+)K?TL/i.exec(n) || /(\d+\.\d)\b/.exec(n); if (!r) return 5; var v = parseFloat(r[1]); return v >= 1000 ? v / 1000 : v; }
  function hspOf(cidade) { return HSP[cidade] || 5.0; }
  function newState(lead) {
    var l = lead || {}, c = l.consumoKwh || 500;
    var S = { leadId: l.id || '', cliente: l.nome || '', cpf: l.cpfCnpj || '', cidade: l.cidade || '', endereco: l.endereco || '', consumo: c, valorConta: l.valorConta || Math.round(c * 0.95), tipoTelhado: l.tipoTelhado || 'cerâmico', areaDisp: l.areaM2 || 40, hsp: hspOf(l.cidade), moduloId: '', qtd: 0, qtdAuto: true, inversorId: '', invQtd: 1, maoObra: 0, maoAuto: true, margem: 22, pg: { forma: 'avista', parcelasCartao: 12, banco: 'sicredi', parcelas: 60, entrada: 0 } };
    var mods = est('Módulo'); var best = mods.filter(function (m) { return m.qtd - (m.reservado || 0) > 0; }).sort(function (a, b) { return modW(b) - modW(a); })[0] || mods[0];
    S.moduloId = best ? best.id : '';
    return S;
  }
  function calc(S) {
    var r = {}, mod = SP.store.find('estoque', S.moduloId), W = mod ? modW(mod) : 550;
    r.mod = mod; r.W = W; r.kwpNec = S.consumo / (S.hsp * 30 * 0.8);
    r.qtdAuto = Math.max(1, Math.ceil(r.kwpNec * 1000 / W));
    r.qtd = S.qtdAuto ? r.qtdAuto : Math.max(1, S.qtd);
    r.kwp = Math.round(r.qtd * W / 10) / 100;
    r.area = Math.round(r.qtd * 2.6 * 10) / 10; r.areaOk = r.area <= S.areaDisp;
    var invs = est('Inversor').map(function (i) { return { i: i, kw: invKw(i) }; }).sort(function (a, b) { return a.kw - b.kw; });
    var sug = invs.filter(function (x) { return x.kw >= r.kwp * 0.8; })[0] || invs[invs.length - 1];
    r.invSug = sug ? sug.i : null; r.inv = SP.store.find('estoque', S.inversorId) || r.invSug; r.invKw = r.inv ? invKw(r.inv) : 0;
    var kit = est('Estrutura').filter(function (e) { return S.tipoTelhado === 'fibrocimento' ? /fibro/i.test(e.nome) : /^metal/i.test(S.tipoTelhado) ? /met/i.test(e.nome) : /cer/i.test(e.nome); })[0];
    r.custoMod = r.qtd * (mod ? mod.preco : 800); r.custoInv = (r.inv ? r.inv.preco : 0) * S.invQtd;
    r.custoEst = r.qtd * (kit ? kit.preco : 85); r.custoOutros = Math.round(r.qtd * 38 + 520);
    r.equip = r.custoMod + r.custoInv + r.custoEst + r.custoOutros;
    r.mao = S.maoAuto ? Math.round(r.kwp * 380) : S.maoObra;
    r.base = r.equip + r.mao; r.valor = Math.round(r.base * (1 + S.margem / 100)); r.lucro = r.valor - r.base;
    r.tarifa = S.valorConta / Math.max(1, S.consumo);
    r.ger = Math.round(r.kwp * S.hsp * 30 * 0.8);
    r.ecoM = Math.max(0, Math.round(Math.min(r.ger, Math.max(0, S.consumo - 100)) * r.tarifa));
    r.contaNova = Math.max(0, Math.round(S.valorConta - r.ecoM)); r.ecoA = r.ecoM * 12;
    r.eco25 = 0; r.acum = []; var acc = -r.valor, pb = null;
    for (var y = 1; y <= 25; y++) { var e = r.ecoM * 12 * Math.pow(1.05, y - 1) * Math.pow(0.993, y - 1); r.eco25 += e; var prev = acc; acc += e; if (pb == null && acc >= 0) pb = y - 1 + (-prev / e); if (y % 5 === 0 || y === 1) r.acum.push([y, acc]); }
    r.eco25 = Math.round(r.eco25); r.payback = Math.round((r.ecoA ? r.valor / r.ecoA : 0) * 10) / 10; r.paybackReaj = pb ? Math.round(pb * 10) / 10 : null;
    r.co2 = Math.round(r.ger * 12 * 0.075 * 25 / 1000 * 10) / 10;
    return r;
  }
  function price(pv, i, n) { i = i / 100; return i ? pv * i / (1 - Math.pow(1 + i, -n)) : pv / n; }
  function pagto(S, r) {
    var p = S.pg, o = { forma: p.forma };
    if (p.forma === 'avista') { o.valor = Math.round(r.valor * 0.96); o.txt = 'À vista com 4% de desconto: ' + M(o.valor); o.curto = 'À vista'; }
    else if (p.forma === 'cartao') { var n = p.parcelasCartao, par = price(r.valor, 1.89, n); o.parcela = par; o.valor = par * n; o.txt = 'Cartão em ' + n + 'x de ' + M(par, { cents: true }); o.curto = 'Cartão ' + n + 'x'; }
    else { var b = BANCOS.filter(function (x) { return x.id === p.banco; })[0] || BANCOS[0], fin = Math.max(0, r.valor - p.entrada), pr = price(fin, b.taxa, p.parcelas); o.banco = b; o.parcela = pr; o.valor = p.entrada + pr * p.parcelas; o.txt = (p.entrada ? 'Entrada de ' + M(p.entrada) + ' + ' : '') + 'Financiamento ' + b.nome + ' em ' + p.parcelas + 'x de ' + M(pr, { cents: true }) + ' (' + String(b.taxa).replace('.', ',') + '% a.m.)'; o.curto = 'Financiamento ' + p.parcelas + 'x'; }
    return o;
  }

  /* ---------- persistência ---------- */
  function persist(S, r, status, existing) {
    var pg = pagto(S, r), lead = SP.store.lead(S.leadId), p = existing || {};
    var num = p.numero || 'PR-' + String(SP.store.collection('propostas').length + 101).padStart(4, '0');
    var o = Object.assign(p, { numero: num, leadId: S.leadId, vendedorId: p.vendedorId || (lead && lead.vendedorId) || SP.session.userId, potenciaKwp: r.kwp, modulos: r.qtd, moduloModelo: r.mod ? r.mod.nome : '', inversor: r.inv ? r.inv.nome : '', valor: r.valor, geracaoMensalKwh: r.ger, economiaMensal: r.ecoM, paybackAnos: r.payback, formaPagamento: pg.curto, pagamentoDescricao: pg.txt, status: status || p.status || 'rascunho', criadaEm: p.criadaEm || new Date().toISOString(), enviadaEm: p.enviadaEm || null, validadeEm: p.validadeEm || new Date(Date.now() + 15 * 864e5).toISOString(), builder: JSON.parse(JSON.stringify(S)) });
    var novo = !o.id; o = SP.store.upsert('propostas', o);
    if (novo) SP.store.log('criou proposta', 'proposta', o.id, o.numero + ' - ' + (lead ? lead.nome : ''));
    return o;
  }
  function etapaIdx(id) { var a = SP.consts.ETAPAS, i; for (i = 0; i < a.length; i++) if (a[i].id === id) return i; return -1; }

  /* ---------- documento (PDF) ---------- */
  function docHtml(S, r, p) {
    var E = emp(), pg = pagto(S, r), lead = SP.store.lead(S.leadId) || {}, ven = SP.store.user(p && p.vendedorId || lead.vendedorId) || {};
    var hoje = U.fmtDate(p && p.criadaEm || new Date().toISOString()), val = U.fmtDate(p && p.validadeEm || new Date(Date.now() + 15 * 864e5).toISOString());
    var max = Math.max(S.valorConta, 1);
    return '<div class="prop-doc">' +
      '<div class="prop-doc-head"><div class="prop-logo">' + U.icon('bolt', 28) + '<div><b>' + esc(E.nome) + '</b><small>Energia solar fotovoltaica</small></div></div><div class="prop-doc-num"><b>PROPOSTA ' + esc(p ? p.numero : 'PR-RASCUNHO') + '</b><span>Emitida em ' + hoje + '</span><span>Válida até ' + val + '</span></div></div>' +
      '<div class="prop-doc-hero"><div><small>Sistema proposto</small><h2>' + N(r.kwp, 2) + ' kWp</h2><p>Geração estimada de <b>' + N(r.ger) + ' kWh/mês</b></p></div><div><small>Economia mensal estimada</small><h2>' + M(r.ecoM) + '</h2><p>Retorno em <b>' + N(r.payback, 1) + ' anos</b></p></div></div>' +
      '<h3>Cliente</h3><p><b>' + esc(S.cliente) + '</b>' + (S.cpf ? ' · ' + esc(S.cpf) : '') + '<br>' + esc(S.endereco || '') + ' ' + esc(S.cidade) + '<br>Consumo médio: ' + N(S.consumo) + ' kWh/mês · Conta atual: ' + M(S.valorConta) + '</p>' +
      '<h3>Equipamentos</h3><table class="prop-doc-table"><tr><td>' + r.qtd + ' x ' + esc(r.mod ? r.mod.nome : 'Módulo') + '</td><td>' + esc(r.mod ? r.mod.marca : '') + '</td></tr><tr><td>' + S.invQtd + ' x ' + esc(r.inv ? r.inv.nome : 'Inversor') + '</td><td>' + esc(r.inv ? r.inv.marca : '') + '</td></tr><tr><td>Estrutura de fixação, cabeamento, string box e proteções</td><td>Incluso</td></tr><tr><td>Projeto, instalação e homologação junto à concessionária</td><td>Incluso</td></tr></table>' +
      '<h3>Sua conta de luz</h3><div class="prop-doc-bars"><div><span>Hoje</span><i style="width:100%;background:#DC2626"></i><b>' + M(S.valorConta) + '</b></div><div><span>Com energia solar</span><i style="width:' + Math.max(4, r.contaNova / max * 100) + '%;background:#16A34A"></i><b>' + M(r.contaNova) + '</b></div></div>' +
      '<p>Economia em 25 anos: <b>' + M(r.eco25) + '</b> (considerando reajuste tarifário de 5% a.a. e degradação dos módulos).</p>' +
      '<h3>Investimento</h3><div class="prop-doc-total">' + M(r.valor) + '</div><p>' + esc(pg.txt) + '</p>' +
      '<h3>Condições</h3><ul><li>Proposta válida por 15 dias.</li><li>Prazo de instalação: até 45 dias após a aprovação do projeto pela concessionária.</li><li>Garantia: 12 anos contra defeitos dos módulos (performance de 25 anos) e 10 anos para o inversor.</li><li>Valores de geração e economia são estimativas e podem variar com o clima e as tarifas.</li></ul>' +
      '<div class="prop-doc-foot"><span>' + esc(ven.nome || '') + ' · Consultor(a) ' + esc(E.nome) + '</span><span>' + esc(E.telefone || '') + ' · ' + esc(E.email || '') + ' · CNPJ ' + esc(E.cnpj || '') + '</span></div></div>';
  }
  function overlay(S, r, p) {
    var d = document.createElement('div'); d.className = 'prop-overlay';
    d.innerHTML = '<div class="prop-toolbar"><b>Proposta ' + esc(p ? p.numero : '') + '</b><span class="grow"></span><button class="btn btn-primary btn-sm" data-a="print">' + U.icon('file', 16) + ' Imprimir / salvar PDF</button><button class="btn btn-ghost btn-sm" data-a="x">Fechar</button></div><div class="prop-sheet">' + docHtml(S, r, p) + '</div>';
    function close() { d.remove(); document.body.classList.remove('prop-printing'); }
    d.addEventListener('click', function (e) { var a = e.target.closest('[data-a]'); if (!a) return; if (a.dataset.a === 'x') close(); else window.print(); });
    document.body.appendChild(d); document.body.classList.add('prop-printing');
  }

  /* ---------- lista ---------- */
  function stateOf(p) {
    if (p.builder) return p.builder;
    var lead = SP.store.lead(p.leadId), S = newState(lead), mod = est('Módulo').filter(function (m) { return m.nome === p.moduloModelo; })[0];
    if (mod) S.moduloId = mod.id; S.qtd = p.modulos; S.qtdAuto = false;
    var inv = est('Inversor').filter(function (i) { return i.nome === p.inversor; })[0]; if (inv) S.inversorId = inv.id;
    return S;
  }
  function renderList(el) {
    var all = SP.store.collection('propostas').filter(function (p) { return SP.session.role !== 'vendedor' || p.vendedorId === SP.session.userId; });
    var filtro = el._f || 'todas';
    var cnt = {}; all.forEach(function (p) { var k = stKey(p); cnt[k] = (cnt[k] || 0) + 1; });
    var pend = all.filter(function (p) { return (stKey(p) === 'enviada' || stKey(p) === 'visualizada') && U.daysSince(p.enviadaEm) >= 3; });
    var tot = all.filter(function (p) { return stKey(p) === 'aprovada'; }).reduce(function (s, p) { return s + p.valor; }, 0);
    var rows = all.filter(function (p) { return filtro === 'todas' || stKey(p) === filtro; }).sort(function (a, b) { return new Date(b.criadaEm) - new Date(a.criadaEm); });
    el.innerHTML = U.pageHeader('Propostas', 'Crie, envie e acompanhe propostas comerciais', '<button class="btn btn-primary" data-a="nova">' + U.icon('file', 16) + ' Nova proposta</button>') +
      '<div class="kpi-grid">' + U.kpi({ label: 'Em aberto', value: (cnt.enviada || 0) + (cnt.visualizada || 0), icon: 'send', tone: 'blue' }) + U.kpi({ label: 'Sem resposta há 3+ dias', value: pend.length, icon: 'alert', tone: pend.length ? 'red' : 'green' }) + U.kpi({ label: 'Aprovadas', value: cnt.aprovada || 0, icon: 'star', tone: 'green' }) + U.kpi({ label: 'Valor aprovado', value: M(tot, { compact: true }), icon: 'dollar', tone: 'orange' }) + '</div>' +
      '<div class="tabs prop-tabs">' + ['todas', 'rascunho', 'enviada', 'visualizada', 'aprovada', 'recusada'].map(function (k) { return '<button class="tab' + (k === filtro ? ' active' : '') + '" data-f="' + k + '">' + (k === 'todas' ? 'Todas' : ST[k][0]) + ' <small>' + (k === 'todas' ? all.length : (cnt[k] || 0)) + '</small></button>'; }).join('') + '</div>' +
      (rows.length ? '<div class="card prop-list">' + rows.map(function (p) {
        var l = SP.store.lead(p.leadId) || { nome: '—' }, k = stKey(p), dias = p.enviadaEm ? U.daysSince(p.enviadaEm) : 0, alert = (k === 'enviada' || k === 'visualizada') && dias >= 3;
        return '<div class="prop-row" data-id="' + p.id + '"><div class="prop-row-main"><b>' + esc(l.nome) + '</b><span class="muted text-sm">' + esc(p.numero) + ' · ' + N(p.potenciaKwp, 2) + ' kWp · ' + esc(p.formaPagamento || '') + '</span></div><div class="prop-row-val">' + M(p.valor) + '</div><div class="prop-row-st">' + U.badge(ST[k] ? ST[k][0] : k, ST[k] ? ST[k][1] : 'gray') + (alert ? ' <span class="badge badge-red" title="Sem resposta do cliente">' + dias + ' dias sem resposta</span>' : '') + '</div><div class="prop-row-act"><button class="btn btn-ghost btn-sm" data-pdf="' + p.id + '">PDF</button><button class="btn btn-sm" data-open="' + p.id + '">Abrir</button></div></div>';
      }).join('') + '</div>' : '<div class="card">' + U.empty({ icon: 'file', title: 'Nenhuma proposta aqui', text: 'Clique em "Nova proposta" para começar.' }) + '</div>');
    el.onclick = function (e) {
      var t = e.target.closest('[data-a],[data-f],[data-open],[data-pdf],.prop-row'); if (!t) return;
      if (t.dataset.a === 'nova') SP.go('propostas/novo'); else if (t.dataset.f) { el._f = t.dataset.f; renderList(el); }
      else if (t.dataset.pdf) { var p = SP.store.find('propostas', t.dataset.pdf), S = stateOf(p); overlay(S, calc(S), p); }
      else if (t.dataset.open) SP.go('propostas/' + t.dataset.open); else if (t.dataset.id) SP.go('propostas/' + t.dataset.id);
    };
  }

  /* ---------- builder ---------- */
  function field(label, k, v, o) { o = o || {}; return '<label class="prop-f' + (o.full ? ' full' : '') + '"><span>' + label + '</span><input ' + (o.type === 'text' ? 'type="text"' : 'type="number" inputmode="decimal" step="' + (o.step || 'any') + '"') + ' data-k="' + k + '" value="' + esc(v) + '"' + (o.hint ? '' : '') + '>' + (o.hint ? '<small>' + o.hint + '</small>' : '') + '</label>'; }
  function setK(S, k, v) { if (k.indexOf('pg.') === 0) S.pg[k.slice(3)] = v; else S[k] = v; }

  function renderBuilder(el, p, leadId) {
    var lead = SP.store.lead(leadId || (p && p.leadId)), S = p ? JSON.parse(JSON.stringify(stateOf(p))) : newState(lead), step = 0;
    if (p && !S.leadId) S.leadId = p.leadId;
    function status() { return p ? stKey(p) : 'rascunho'; }
    function draw() {
      var r = calc(S), k = status(), body = '';
      if (step === 0) {
        var leads = SP.store.visibleLeads();
        body = '<div class="card-title">Cliente e consumo</div><div class="form">' +
          '<label class="prop-f full"><span>Lead / cliente</span><select data-k="leadId"><option value="">Selecione um lead...</option>' + leads.map(function (l) { return '<option value="' + l.id + '"' + (l.id === S.leadId ? ' selected' : '') + '>' + esc(l.nome) + ' - ' + esc(l.cidade) + '</option>'; }).join('') + '</select></label>' +
          field('Nome', 'cliente', S.cliente, { type: 'text' }) + field('CPF/CNPJ', 'cpf', S.cpf, { type: 'text' }) + field('Cidade', 'cidade', S.cidade, { type: 'text' }) + field('Endereço', 'endereco', S.endereco, { type: 'text' }) +
          field('Consumo médio (kWh/mês)', 'consumo', S.consumo) + field('Valor da conta (R$/mês)', 'valorConta', S.valorConta, { hint: 'Tarifa aprox.: ' + M(r.tarifa, { cents: true }) + '/kWh' }) +
          '<label class="prop-f"><span>Tipo de telhado</span><select data-k="tipoTelhado">' + ['cerâmico', 'fibrocimento', 'metálico', 'laje', 'solo'].map(function (t) { return '<option' + (t === S.tipoTelhado ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label>' + field('Área disponível (m²)', 'areaDisp', S.areaDisp) + '</div>';
      } else if (step === 1) {
        var mods = est('Módulo'), invs = est('Inversor');
        body = '<div class="card-title">Dimensionamento automático</div><div class="prop-calc">kWp necessário = ' + N(S.consumo) + ' kWh ÷ (' + N(S.hsp, 1) + ' HSP × 30 × 0,8) = <b>' + N(r.kwpNec, 2) + ' kWp</b></div><div class="form">' +
          field('Irradiação (HSP)', 'hsp', S.hsp, { step: '0.1', hint: 'Sugerido para ' + esc(S.cidade || 'a região') + ': ' + N(hspOf(S.cidade), 1) }) +
          '<label class="prop-f"><span>Módulo (do estoque)</span><select data-k="moduloId">' + mods.map(function (m) { return '<option value="' + m.id + '"' + (m.id === S.moduloId ? ' selected' : '') + '>' + esc(m.marca) + ' ' + modW(m) + 'W (' + (m.qtd - (m.reservado || 0)) + ' disp.)</option>'; }).join('') + '</select></label>' +
          field('Quantidade de módulos', 'qtd', r.qtd, { hint: S.qtdAuto ? 'Calculado automaticamente. Edite para ajustar.' : '<a href="#" data-a="auto">Voltar ao automático (' + r.qtdAuto + ')</a>' }) +
          '<label class="prop-f"><span>Inversor (sugestão: ' + esc(r.invSug ? r.invSug.nome : '-') + ')</span><select data-k="inversorId">' + invs.map(function (i) { return '<option value="' + i.id + '"' + (r.inv && i.id === r.inv.id ? ' selected' : '') + '>' + esc(i.nome) + '</option>'; }).join('') + '</select></label>' + field('Qtd. de inversores', 'invQtd', S.invQtd) + '</div>' +
          '<div class="prop-stats"><div><small>Potência</small><b>' + N(r.kwp, 2) + ' kWp</b></div><div><small>Geração/mês</small><b>' + N(r.ger) + ' kWh</b></div><div><small>Área necessária</small><b>' + N(r.area, 1) + ' m²</b></div><div><small>Inversor</small><b>' + N(r.invKw, 1) + ' kW</b></div></div>' +
          (r.areaOk ? '' : '<div class="prop-warn">' + U.icon('alert', 16) + ' A área necessária (' + N(r.area, 1) + ' m²) é maior que a disponível (' + N(S.areaDisp) + ' m²). Reduza os módulos, use módulo de maior potência ou considere instalação no solo.</div>') +
          (r.invKw && r.invKw * S.invQtd * 1.3 < r.kwp ? '<div class="prop-warn">' + U.icon('alert', 16) + ' Inversor subdimensionado para ' + N(r.kwp, 2) + ' kWp.</div>' : '');
      } else if (step === 2) {
        body = '<div class="card-title">Investimento</div><table class="table prop-tbl"><tbody>' +
          '<tr><td>' + r.qtd + ' módulos</td><td class="right">' + M(r.custoMod) + '</td></tr><tr><td>Inversor</td><td class="right">' + M(r.custoInv) + '</td></tr><tr><td>Estrutura de fixação</td><td class="right">' + M(r.custoEst) + '</td></tr><tr><td>Cabos, conectores e proteções</td><td class="right">' + M(r.custoOutros) + '</td></tr><tr><th>Equipamentos</th><th class="right">' + M(r.equip) + '</th></tr></tbody></table>' +
          '<div class="form mt">' + field('Mão de obra (R$)', 'maoObra', r.mao, { hint: S.maoAuto ? 'Sugerido: R$ 380/kWp. Edite para ajustar.' : '<a href="#" data-a="maoauto">Voltar ao sugerido</a>' }) + field('Margem (%)', 'margem', S.margem, { hint: 'Lucro estimado: ' + M(r.lucro) }) + '</div>' +
          '<div class="prop-total"><span>Valor da proposta</span><b>' + M(r.valor) + '</b><small>' + M(r.valor / r.kwp) + ' por kWp</small></div>';
      } else if (step === 3) {
        var mx = Math.max(S.valorConta, 1), cm = Math.max.apply(null, r.acum.map(function (a) { return Math.abs(a[1]); }).concat([1]));
        body = '<div class="card-title">Economia</div><div class="prop-bars"><div><span>Conta atual</span><i style="width:100%;background:var(--red)"></i><b>' + M(S.valorConta) + '</b></div><div><span>Conta com solar</span><i style="width:' + Math.max(3, r.contaNova / mx * 100) + '%;background:var(--green)"></i><b>' + M(r.contaNova) + '</b></div></div>' +
          '<div class="prop-stats"><div><small>Economia mensal</small><b>' + M(r.ecoM) + '</b></div><div><small>Economia anual</small><b>' + M(r.ecoA) + '</b></div><div><small>Em 25 anos</small><b>' + M(r.eco25) + '</b></div><div><small>Payback</small><b>' + N(r.payback, 1) + ' anos</b></div></div>' +
          '<div class="card-title mt">Fluxo acumulado (já descontado o investimento)</div><div class="prop-cols">' + r.acum.map(function (a) { var h = Math.max(4, Math.abs(a[1]) / cm * 100); return '<div><i style="height:' + h + '%;background:' + (a[1] < 0 ? 'var(--red)' : 'var(--green)') + '"></i><b>' + M(a[1], { compact: true }) + '</b><span>Ano ' + a[0] + '</span></div>'; }).join('') + '</div>' +
          '<p class="muted text-sm mt">Estimativa com reajuste tarifário de 5% a.a. e degradação de 0,7% a.a. Considera taxa mínima de 100 kWh. Retorno com reajuste: ' + (r.paybackReaj ? N(r.paybackReaj, 1) + ' anos' : '-') + '. CO2 evitado em 25 anos: ' + N(r.co2, 1) + ' t.</p>';
      } else {
        var pg = pagto(S, r), fin = Math.max(0, r.valor - S.pg.entrada);
        body = '<div class="card-title">Forma de pagamento</div><div class="prop-opts">' + [['avista', 'À vista', '4% de desconto'], ['cartao', 'Cartão parcelado', 'até 18x'], ['fin', 'Financiamento', 'bancos parceiros']].map(function (o) { return '<button class="prop-opt' + (S.pg.forma === o[0] ? ' on' : '') + '" data-forma="' + o[0] + '"><b>' + o[1] + '</b><small>' + o[2] + '</small></button>'; }).join('') + '</div>';
        if (S.pg.forma === 'avista') body += '<div class="prop-total"><span>Valor à vista</span><b>' + M(pg.valor) + '</b><small>Economia de ' + M(r.valor - pg.valor) + ' sobre o valor cheio</small></div>';
        else if (S.pg.forma === 'cartao') body += '<div class="form"><label class="prop-f"><span>Parcelas</span><select data-k="pg.parcelasCartao">' + [2, 3, 6, 10, 12, 15, 18].map(function (n) { return '<option' + (n === S.pg.parcelasCartao ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></div><div class="prop-total"><span>' + S.pg.parcelasCartao + 'x de</span><b>' + M(pg.parcela, { cents: true }) + '</b><small>Taxa 1,89% a.m. · total ' + M(pg.valor) + '</small></div>';
        else {
          body += '<div class="prop-banks">' + BANCOS.map(function (b) { var pr = price(fin, b.taxa, S.pg.parcelas); return '<button class="prop-opt' + (S.pg.banco === b.id ? ' on' : '') + '" data-banco="' + b.id + '"><b>' + b.nome + '</b><small>' + String(b.taxa).replace('.', ',') + '% a.m.</small><strong>' + M(pr, { cents: true }) + '</strong></button>'; }).join('') + '</div>' +
            '<div class="form mt">' + field('Entrada (R$)', 'pg.entrada', S.pg.entrada) + '<label class="prop-f"><span>Parcelas: <b>' + S.pg.parcelas + 'x</b> (24 a 120)</span><input type="range" min="24" max="120" step="6" value="' + S.pg.parcelas + '" data-k="pg.parcelas"></label></div>' +
            '<div class="prop-total"><span>' + S.pg.parcelas + 'x de</span><b>' + M(pg.parcela, { cents: true }) + '</b><small>Total pago ' + M(pg.valor) + '</small></div>' +
            '<div class="prop-cmp ' + (pg.parcela < S.valorConta ? 'ok' : 'no') + '">Parcela de <b>' + M(pg.parcela, { cents: true }) + '</b> vs conta atual de <b>' + M(S.valorConta) + '</b>: ' + (pg.parcela < S.valorConta ? 'a parcela é menor que a conta de luz de hoje. Com a conta residual de ' + M(r.contaNova) + ', o total mensal fica em ' + M(pg.parcela + r.contaNova) + '.' : 'a parcela mais a conta residual (' + M(pg.parcela + r.contaNova) + '/mês) supera a conta atual durante o financiamento; depois dele a economia é total.') + '</div>';
        }
      }
      var steps = STEPS.map(function (s, i) { return '<button class="prop-step' + (i === step ? ' on' : i < step ? ' done' : '') + '" data-step="' + i + '"><i>' + (i + 1) + '</i><span>' + s + '</span></button>'; }).join('');
      var send = '<div class="prop-send"><button class="btn btn-ghost" data-a="pdf">' + U.icon('eye', 16) + ' Visualizar PDF</button><button class="btn" data-a="wa">' + U.icon('whatsapp', 16) + ' Enviar por WhatsApp</button><button class="btn" data-a="mail">' + U.icon('mail', 16) + ' Enviar por e-mail</button>' +
        (k === 'aprovada' ? '<button class="btn btn-primary" data-a="contrato">' + U.icon('contract', 16) + ' Gerar contrato</button>' : '<button class="btn btn-primary" data-a="aprovou">Cliente aprovou</button>') + (k === 'enviada' || k === 'visualizada' ? '<button class="btn btn-danger btn-sm" data-a="recusou">Recusada</button>' : '') + '</div>';
      el.innerHTML = U.pageHeader(p ? 'Proposta ' + p.numero : 'Nova proposta', (S.cliente || 'Selecione o cliente') + ' · ' + N(r.kwp, 2) + ' kWp · ' + M(r.valor), '<a class="btn btn-ghost" href="#/propostas">Voltar à lista</a> ' + U.badge(ST[k][0], ST[k][1])) +
        '<div class="prop-steps">' + steps + '</div><div class="card prop-body">' + body + '</div>' +
        '<div class="prop-nav"><button class="btn btn-ghost" data-a="prev"' + (step === 0 ? ' disabled' : '') + '>Voltar</button><button class="btn" data-a="save">Salvar rascunho</button>' + (step < 4 ? '<button class="btn btn-primary" data-a="next">Avançar</button>' : '') + '</div>' + (step === 4 || p ? send : '');
    }
    function need() { if (!S.leadId) { U.toast('Selecione um lead primeiro.', 'error'); step = 0; draw(); return false; } return true; }
    function save(st) { var r = calc(S); p = persist(S, r, st, p); return p; }
    el.onchange = function (e) {
      var t = e.target; if (!t.dataset || !t.dataset.k) return; var k = t.dataset.k, v = t.type === 'number' || t.type === 'range' ? parseFloat(t.value) || 0 : t.value;
      if (k === 'leadId') { var l = SP.store.lead(v); var ns = newState(l); ns.leadId = v; ns.moduloId = S.moduloId || ns.moduloId; S = ns; }
      else if (k === 'qtd') { S.qtd = v; S.qtdAuto = false; } else if (k === 'maoObra') { S.maoObra = v; S.maoAuto = false; } else if (k === 'cidade') { S.cidade = v; S.hsp = hspOf(v); }
      else if (k === 'invQtd') S.invQtd = Math.max(1, v); else setK(S, k, v);
      draw();
    };
    el.oninput = function (e) { if (e.target.type === 'range') { setK(S, e.target.dataset.k, parseFloat(e.target.value)); draw(); var rg = el.querySelector('[data-k="pg.parcelas"]'); if (rg) rg.focus(); } };
    el.onclick = function (e) {
      var t = e.target.closest('[data-step],[data-a],[data-forma],[data-banco]'); if (!t) return; if (t.tagName === 'A') e.preventDefault();
      if (t.dataset.step != null) { if (+t.dataset.step > 0 && !S.leadId) return need(); step = +t.dataset.step; draw(); window.scrollTo(0, 0); return; }
      if (t.dataset.forma) { S.pg.forma = t.dataset.forma; return draw(); } if (t.dataset.banco) { S.pg.banco = t.dataset.banco; return draw(); }
      var a = t.dataset.a, r;
      if (a === 'auto') { S.qtdAuto = true; draw(); } else if (a === 'maoauto') { S.maoAuto = true; draw(); }
      else if (a === 'prev') { step = Math.max(0, step - 1); draw(); window.scrollTo(0, 0); } else if (a === 'next') { if (!need()) return; step = Math.min(4, step + 1); draw(); window.scrollTo(0, 0); }
      else if (a === 'save') { if (!need()) return; save(); U.toast('Rascunho salvo.', 'success'); history.replaceState(null, '', '#/propostas/' + p.id); draw(); }
      else if (a === 'pdf') { if (!need()) return; save(); overlay(S, calc(S), p); draw(); }
      else if (a === 'wa' || a === 'mail') {
        if (!need()) return; var l = SP.store.lead(S.leadId), canal = a === 'wa' ? 'WhatsApp' : 'e-mail', o = save(); r = calc(S);
        var now = new Date().toISOString(); SP.store.patch('propostas', o.id, { status: 'enviada', enviadaEm: now, validadeEm: new Date(Date.now() + 15 * 864e5).toISOString() });
        if (l) { l.interacoes = l.interacoes || []; l.interacoes.unshift({ em: now, tipo: a === 'wa' ? 'whatsapp' : 'email', texto: 'Proposta ' + o.numero + ' enviada por ' + canal + ' (' + M(r.valor) + ')', porId: SP.session.userId }); l.ultimoContato = now; if (etapaIdx(l.etapa) < etapaIdx('proposta_enviada') && l.etapa !== 'perdido') l.etapa = 'proposta_enviada'; SP.store.upsert('leads', l); }
        SP.store.log('enviou proposta', 'proposta', o.id, o.numero + ' por ' + canal); U.toast('Proposta enviada por ' + canal + ' (simulado) para ' + (l ? l.nome : 'cliente') + '.', 'success'); p = SP.store.find('propostas', o.id); history.replaceState(null, '', '#/propostas/' + p.id); draw();
      }
      else if (a === 'aprovou') { if (!need()) return; var o2 = save('aprovada'); SP.store.log('aprovou proposta', 'proposta', o2.id, o2.numero + ' aprovada pelo cliente'); var l2 = SP.store.lead(S.leadId); if (l2) { l2.interacoes = l2.interacoes || []; l2.interacoes.unshift({ em: new Date().toISOString(), tipo: 'nota', texto: 'Cliente aprovou a proposta ' + o2.numero, porId: SP.session.userId }); SP.store.upsert('leads', l2); } U.toast('Proposta aprovada! Agora é só gerar o contrato.', 'success'); history.replaceState(null, '', '#/propostas/' + o2.id); draw(); }
      else if (a === 'recusou') { p = SP.store.patch('propostas', p.id, { status: 'recusada' }); SP.store.log('recusou proposta', 'proposta', p.id, p.numero); U.toast('Proposta marcada como recusada.'); draw(); }
      else if (a === 'contrato') { SP.go('contratos?proposta=' + p.id); }
    };
    draw();
  }

  SP.register({
    route: 'propostas', title: 'Propostas', icon: 'file', group: 'Vendas', order: 14, roles: ['dono', 'vendedor'],
    render: function (el, params) {
      el.onclick = el.onchange = el.oninput = null; el._f = el._f || 'todas';
      var q = params.query || {};
      if (params.id === 'novo') return renderBuilder(el, null, q.lead);
      if (params.id) { var p = SP.store.find('propostas', params.id); if (p) return renderBuilder(el, p); }
      if (q.lead) { var ex = SP.store.where('propostas', function (x) { return x.leadId === q.lead && stKey(x) === 'rascunho'; })[0]; return renderBuilder(el, ex || null, q.lead); }
      renderList(el);
    }
  });
})();
