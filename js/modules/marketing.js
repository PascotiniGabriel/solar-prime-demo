/* Módulo: Marketing & Tráfego (#/marketing) - visão da gestora de tráfego: campanhas, criativos, qualidade, UTM, conversões offline, relatório e reativação. */
(function () {
  'use strict';
  var ui = SP.ui, store = SP.store, esc = ui.esc, M = function (v) { return ui.fmtMoney(v); }, P = function (v) { return ui.fmtPct(v); };
  var st = { dias: 90, tab: 'geral', plat: 'todas', sort: 'roas', utmSrc: 'todas', utm: { url: 'https://suaempresa.com.br/orcamento', source: 'facebook', medium: 'paid_social', campaign: 'solar_residencial', content: 'video_conta_luz', term: '' } };
  var CORES = { 'Facebook Ads': '#3B82F6', 'Google Ads': '#EAB308', 'Instagram': '#EC4899', 'WhatsApp': '#22C55E', 'Site': '#8B5CF6', 'Indicação': '#F97316' };
  var PLAT = { 'Facebook Ads': 'Meta', 'Instagram': 'Meta', 'WhatsApp': 'Meta', 'Google Ads': 'Google' };
  var TABS = [['geral', 'Visão geral'], ['campanhas', 'Campanhas'], ['qualidade', 'Qualidade do lead'], ['utm', 'Atribuição & UTM'], ['offline', 'Conversões offline'], ['relatorio', 'Relatório para o cliente'], ['reativacao', 'Reativação']];

  /* tipo, título, peso de leads, peso de gasto, CTR % */
  var SEED = {
    'Solar Residencial - FB Ads': [['Proprietários 35-55 anos', [['video', 'Sua conta de luz pode cair até 95%', 40, 30, 1.9], ['imagem', 'Orçamento solar grátis em 24h', 25, 35, 1.1]]], ['Lookalike de clientes', [['carrossel', 'Antes e depois: 3 casos reais', 35, 35, 1.6]]]],
    'Black Friday Solar': [['Remarketing visitantes', [['imagem', 'Black Friday: 12% off no kit solar', 30, 25, 2.4], ['video', 'Última semana: instale sem entrada', 20, 20, 1.7]]], ['Público frio - interesse em economia', [['carrossel', 'Quanto você economiza em 25 anos', 25, 30, 1.2], ['imagem', 'Frete e projeto grátis até domingo', 25, 25, 0.8]]]],
    'Google - Energia Solar SP': [['Pesquisa: energia solar residencial', [['texto', 'Energia Solar em SP | Orçamento Grátis', 55, 45, 5.2], ['texto', 'Reduza sua conta de luz em até 95%', 25, 25, 4.6]]], ['Pesquisa: empresas', [['texto', 'Energia solar para empresas | Payback 3 anos', 20, 30, 3.9]]]],
    'Google - Instalação Solar': [['Pesquisa: instalação', [['texto', 'Instalação de placas solares com garantia', 60, 55, 4.8], ['texto', 'Quanto custa instalar energia solar?', 40, 45, 3.7]]]],
    'Reels Economia na Conta': [['Reels - mulheres 30-50', [['video', 'Dona Marta cortou 92% da conta', 55, 40, 2.8], ['video', '3 erros ao contratar energia solar', 30, 35, 2.1]]], ['Reels - Lookalike', [['imagem', 'Simule sua economia em 1 minuto', 15, 25, 0.9]]]],
    'Stories Orçamento': [['Stories - região', [['imagem', 'Arraste e peça seu orçamento', 60, 60, 0.7], ['video', 'Veja a obra em 10 segundos', 40, 40, 1.0]]]],
    'Click to WhatsApp': [['Conversa no WhatsApp', [['imagem', 'Fale com um especialista agora', 50, 70, 2.2], ['carrossel', 'Tire suas dúvidas sobre financiamento', 50, 30, 1.4]]]]
  };
  var CONV = [['lead', 'Lead', 'Formulário ou conversa iniciada', 'Lead'], ['qualificado', 'Lead qualificado', 'Passou pela qualificação do vendedor', 'QualifiedLead'], ['proposta', 'Proposta enviada', 'Proposta comercial emitida', 'InitiateCheckout'], ['venda', 'Venda', 'Contrato assinado, com valor', 'Purchase']];

  var ADS_V = 2, ESCALA = 1.8, ESC_CAMP = { 'Click to WhatsApp': 4.1, 'Reels Economia na Conta': 3.0 }; /* v2: gasto de mídia realista (ROAS geral ~5x). Subir ADS_V reseeda db.ads */
  function db() { return store.get(); }
  function seed() {
    var d = db(); if (d.ads && d.ads.anuncios && d.ads.v === ADS_V) return d.ads;
    var an = [];
    Object.keys(SEED).forEach(function (camp, ci) {
      SEED[camp].forEach(function (cj, si) { cj[1].forEach(function (a, ai) { an.push({ id: 'ad' + ci + si + ai, camp: camp, conjunto: cj[0], tipo: a[0], titulo: a[1], pl: a[2], pg: a[3], ctr: a[4], status: 'ativo' }); }); });
    });
    d.ads = { v: ADS_V, escala: ESCALA, escalas: ESC_CAMP, anuncios: an, conv: { lead: true, qualificado: true, proposta: true, venda: true }, conectado: { meta: true, google: true } };
    store.save({ type: 'seed-ads' }); return d.ads;
  }
  function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003; return h; }

  var LOSTBAD = ['Sem resposta', 'Imóvel alugado'];
  function isQual(l) { return l.etapa !== 'novo' && !(l.etapa === 'perdido' && LOSTBAD.indexOf(l.motivoPerda) >= 0); }

  /* agrega métricas de uma lista de leads com um investimento */
  function agg(ls, inv, X) {
    var o = { leads: ls.length, qual: 0, prop: 0, ctr: 0, fat: 0, inv: inv, kwh: 0, tk: 0 };
    ls.forEach(function (l) { if (isQual(l)) o.qual++; if (X.prop[l.id]) o.prop++; var c = X.ctr[l.id]; if (c) { o.ctr++; o.fat += c.valor; } o.kwh += l.consumoKwh || 0; });
    o.cpl = o.leads ? inv / o.leads : 0; o.cpql = o.qual ? inv / o.qual : 0; o.cac = o.ctr ? inv / o.ctr : 0;
    o.roas = inv ? o.fat / inv : 0; o.roi = inv ? (o.fat - inv) / inv * 100 : 0; o.pq = o.leads ? o.qual / o.leads * 100 : 0;
    o.kwhm = o.leads ? o.kwh / o.leads : 0; o.tk = o.ctr ? o.fat / o.ctr : 0; o.tx = o.leads ? o.ctr / o.leads * 100 : 0;
    return o;
  }

  function build() {
    var A = seed(), X = { prop: {}, ctr: {} };
    store.collection('propostas').forEach(function (p) { X.prop[p.leadId] = 1; });
    store.collection('contratos').forEach(function (c) { if (c.status === 'assinado') X.ctr[c.leadId] = c; });
    var leads = store.collection('leads').filter(function (l) { return st.dias === 0 || ui.daysSince(l.criadoEm) <= st.dias; });
    var fator = st.dias === 0 ? 3 : Math.max(0.3, Math.min(3, st.dias / 30));
    var camps = store.collection('campanhas').map(function (c) {
      var ls = leads.filter(function (l) { return l.campanha === c.nome; }), inv = Math.round(c.investimento * fator * ((A.escalas && A.escalas[c.nome]) || A.escala || 1));
      var r = { c: c, ls: ls, m: agg(ls, inv, X), plat: PLAT[c.canal] || 'Outros', orc: Math.round(c.investimento * 1.18 / 100) * 100 };
      r.ads = A.anuncios.filter(function (a) { return a.camp === c.nome; });
      var sl = r.ads.reduce(function (s, a) { return s + a.pl; }, 0), sg = r.ads.reduce(function (s, a) { return s + a.pg; }, 0);
      r.adRows = r.ads.map(function (a) {
        var als = []; if (sl) ls.forEach(function (l) { var h = hash(l.id) % sl, acc = 0, hit = null; r.ads.forEach(function (b) { if (hit) return; acc += b.pl; if (h < acc) hit = b; }); if (hit === a) als.push(l); });
        var ainv = sg ? Math.round(inv * a.pg / sg) : 0, m = agg(als, ainv, X), imp = ainv / (r.plat === 'Google' ? 38 : 22) * 1000;
        return { a: a, ls: als, m: m, camp: r, imp: imp, clk: imp * a.ctr / 100 };
      });
      return r;
    });
    var allAds = []; camps.forEach(function (r) { allAds = allAds.concat(r.adRows); });
    var elig = allAds.filter(function (x) { return x.m.leads >= 3 && x.m.inv > 0; });
    var best = elig.slice().sort(function (a, b) { return b.m.roas - a.m.roas || b.m.ctr - a.m.ctr; })[0];
    var worst = elig.slice().sort(function (a, b) { return a.m.roas - b.m.roas || b.m.cpl - a.m.cpl; })[0];
    if (best === worst) worst = null;
    var tot = agg([].concat.apply([], camps.map(function (r) { return r.ls; })), camps.reduce(function (s, r) { return s + r.m.inv; }, 0), X);
    return { A: A, X: X, leads: leads, camps: camps, ads: allAds, best: best, worst: worst, tot: tot, fator: fator };
  }

  function chan(D) {
    var m = {};
    D.camps.forEach(function (r) { var k = r.c.canal, o = m[k] || (m[k] = { canal: k, ls: [], inv: 0 }); o.ls = o.ls.concat(r.ls); o.inv += r.m.inv; });
    return Object.keys(m).map(function (k) { m[k].m = agg(m[k].ls, m[k].inv, D.X); return m[k]; }).sort(function (a, b) { return b.m.fat - a.m.fat; });
  }
  function platAgg(D, p) {
    var rs = D.camps.filter(function (r) { return r.plat === p; });
    return agg([].concat.apply([], rs.map(function (r) { return r.ls; })), rs.reduce(function (s, r) { return s + r.m.inv; }, 0), D.X);
  }

  function badgeRoas(v) { return ui.badge(v.toFixed(1).replace('.', ',') + 'x', v >= 3 ? 'green' : v >= 1 ? 'amber' : 'red'); }
  function sel(d) { return st.dias === d ? ' selected' : ''; }

  /* ---------------- render ---------------- */
  function render(el) {
    var D = build();
    var per = '<select class="input" id="mk-per"><option value="30"' + sel(30) + '>Últimos 30 dias</option><option value="60"' + sel(60) + '>Últimos 60 dias</option><option value="90"' + sel(90) + '>Últimos 90 dias</option><option value="0"' + sel(0) + '>Todo o período</option></select>';
    var h = ui.pageHeader('Marketing & Tráfego', 'Do clique do anúncio até a venda assinada: quanto cada real investido volta em faturamento.', per);
    h += '<div class="mk-tabs mb">' + ui.tabs(TABS.map(function (t) { return { id: t[0], label: t[1] }; }), st.tab) + '</div>';
    var fn = { geral: geral, campanhas: campanhas, qualidade: qualidade, utm: utm, offline: offline, relatorio: relatorio, reativacao: reativacao }[st.tab] || geral;
    h += fn(D);
    el.innerHTML = h; bind(el, D);
  }

  /* ---------------- 1. visão geral ---------------- */
  function kpis(t) {
    return '<div class="kpi-grid mb">' +
      ui.kpi({ label: 'Investimento', value: M(t.inv), icon: 'megaphone', tone: 'blue' }) +
      ui.kpi({ label: 'Leads', value: ui.fmtNum(t.leads), sub: t.qual + ' qualificados', icon: 'users', tone: 'orange' }) +
      ui.kpi({ label: 'CPL (custo por lead)', value: M(t.cpl), sub: 'Por qualificado: ' + M(t.cpql), icon: 'target', tone: 'orange' }) +
      ui.kpi({ label: 'Propostas', value: ui.fmtNum(t.prop), sub: P(t.leads ? t.prop / t.leads * 100 : 0) + ' dos leads', icon: 'file', tone: 'purple' }) +
      ui.kpi({ label: 'Contratos', value: ui.fmtNum(t.ctr), sub: P(t.tx) + ' de conversão', icon: 'contract', tone: 'green' }) +
      ui.kpi({ label: 'CAC (custo por venda)', value: M(t.cac), icon: 'dollar', tone: 'red' }) +
      ui.kpi({ label: 'Faturamento', value: M(t.fat), icon: 'wallet', tone: 'green' }) +
      ui.kpi({ label: 'ROAS', value: t.roas.toFixed(1).replace('.', ',') + 'x', sub: 'Cada R$ 1 voltou R$ ' + t.roas.toFixed(2).replace('.', ','), icon: 'trending', tone: 'green' }) +
      ui.kpi({ label: 'ROI', value: t.inv ? P(t.roi) : '-', sub: 'Lucro sobre o investimento', icon: 'trending', tone: 'blue' }) + '</div>';
  }
  function weekly(D) {
    var W = 8, b = [], now = Date.now();
    for (var i = 0; i < W; i++) b.push({ l: 0, q: 0 });
    store.collection('leads').forEach(function (l) { if (!l.campanha) return; var w = Math.floor((now - new Date(l.criadoEm).getTime()) / (7 * 864e5)); if (w >= 0 && w < W) { b[W - 1 - w].l++; if (isQual(l)) b[W - 1 - w].q++; } });
    var mx = Math.max.apply(null, b.map(function (x) { return x.l; }).concat([1])), s = '<svg class="mk-svg" viewBox="0 0 320 150" role="img" aria-label="Leads por semana">';
    b.forEach(function (x, i) {
      var hh = x.l / mx * 100, hq = x.q / mx * 100, X0 = 10 + i * 38;
      s += '<rect x="' + X0 + '" y="' + (120 - hh) + '" width="28" height="' + hh + '" rx="4" fill="#3B82F6" opacity=".35"/><rect x="' + X0 + '" y="' + (120 - hq) + '" width="28" height="' + hq + '" rx="4" fill="#F97316"/>' +
        '<text x="' + (X0 + 14) + '" y="' + (114 - hh) + '" text-anchor="middle" font-size="10" fill="currentColor">' + x.l + '</text><text x="' + (X0 + 14) + '" y="138" text-anchor="middle" font-size="9" fill="currentColor" opacity=".6">S' + (i + 1) + '</text>';
    });
    return s + '</svg><div class="mk-legend"><span><i style="background:#3B82F6;opacity:.5"></i>Leads</span><span><i style="background:#F97316"></i>Qualificados</span><span class="muted">Últimas 8 semanas</span></div>';
  }
  function geral(D) {
    var t = D.tot, cs = chan(D), h = kpis(t);
    var cheap = D.camps.filter(function (r) { return r.m.leads >= 5; }).sort(function (a, b) { return a.m.cpl - b.m.cpl; })[0];
    var bestC = D.camps.filter(function (r) { return r.m.ctr > 0; }).sort(function (a, b) { return a.m.cac - b.m.cac; })[0];
    if (cheap && bestC && cheap !== bestC) h += '<div class="card mk-best mb"><div class="row">' + ui.icon('star', 28) + '<div class="grow"><b>Lead barato não é lead bom.</b><div class="text-sm">"' + esc(cheap.c.nome) + '" tem o menor CPL (' + M(cheap.m.cpl) + '), mas "' + esc(bestC.c.nome) + '" tem o menor custo por venda (' + M(bestC.m.cac) + '). Otimize pelo custo por venda, não pelo custo por lead.</div></div></div></div>';
    h += '<div class="grid grid-2 mb"><div class="card"><div class="card-title">Funil por canal</div><div class="mk-chs">' + cs.map(function (c) { return chFunnel(c, cs[0].m.leads); }).join('') + '</div></div>' +
      '<div class="card"><div class="card-title">Leads por semana</div>' + weekly(D) + '<div class="card-title mt">Investimento x faturamento por canal</div>' +
      ui.barChart(cs.map(function (c) { return { label: c.canal + ' (inv.)', value: c.inv, display: ui.fmtMoney(c.inv, { compact: true }), color: '#94A3B8' }; }).concat(cs.map(function (c) { return { label: c.canal + ' (fat.)', value: c.m.fat, display: ui.fmtMoney(c.m.fat, { compact: true }), color: CORES[c.canal] }; })).sort(function (a, b) { return b.value - a.value; })) + '</div></div>';
    h += '<div class="card"><div class="card-title">Resultado por canal</div><div class="table-wrap"><table class="table"><thead><tr><th>Canal</th><th>Invest.</th><th>Leads</th><th>CPL</th><th>Qualif.</th><th>Contratos</th><th>CAC</th><th>Faturamento</th><th>ROAS</th></tr></thead><tbody>' + cs.map(function (c) {
      var m = c.m; return '<tr><td><b>' + esc(c.canal) + '</b></td><td>' + M(c.inv) + '</td><td>' + m.leads + '</td><td>' + M(m.cpl) + '</td><td>' + P(m.pq) + '</td><td>' + m.ctr + '</td><td>' + (m.ctr ? M(m.cac) : '-') + '</td><td>' + M(m.fat) + '</td><td>' + (c.inv ? badgeRoas(m.roas) : '-') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
    return h;
  }
  function chFunnel(c, max) {
    var m = c.m, rows = [['Leads', m.leads, 100, '#3B82F6'], ['Qualificados', m.qual, m.leads ? m.qual / m.leads * 100 : 0, '#6366F1'], ['Propostas', m.prop, m.leads ? m.prop / m.leads * 100 : 0, '#F59E0B'], ['Contratos', m.ctr, m.leads ? m.ctr / m.leads * 100 : 0, '#22C55E']];
    return '<div class="mk-ch"><div class="row"><i class="mk-dot" style="background:' + (CORES[c.canal] || '#64748B') + '"></i><b class="grow">' + esc(c.canal) + '</b><span class="text-sm muted">' + (c.inv ? M(c.inv) + ' investidos' : 'sem verba') + '</span></div>' +
      rows.map(function (r) { return '<div class="mk-fr"><span>' + r[0] + '</span><span class="mk-ft"><span style="width:' + Math.max(r[1] ? 3 : 0, (m.leads / (max || 1)) * r[2]) + '%;background:' + r[3] + '"></span></span><b>' + r[1] + '</b></div>'; }).join('') + '</div>';
  }

  /* ---------------- 2. campanhas ---------------- */
  function thumb(a, tag) {
    var inner = a.tipo === 'video' ? '<span class="mk-play"></span><em>0:15</em>' : a.tipo === 'carrossel' ? '<span class="mk-cards"><i></i><i></i><i></i></span>' : a.tipo === 'texto' ? '<span class="mk-txt"><i></i><i></i><i></i></span>' : '<span class="mk-sun"></span><span class="mk-panels"></span>';
    return '<div class="mk-thumb mk-t-' + a.tipo + '">' + inner + '<b>' + esc(a.titulo) + '</b>' + (tag ? '<span class="mk-tag ' + tag[0] + '">' + tag[1] + '</span>' : '') + '</div>';
  }
  var TIPO = { imagem: 'Imagem', video: 'Vídeo', carrossel: 'Carrossel', texto: 'Anúncio de pesquisa' };
  function campanhas(D) {
    var k = { roas: 'm.roas', leads: 'm.leads', cpl: 'm.cpl', fat: 'm.fat', ctr: 'm.ctr' }, key = st.sort;
    function val(r) { return r.m[key === 'fat' ? 'fat' : key]; }
    var rows = D.camps.filter(function (r) { return r.ads.length && (st.plat === 'todas' || r.plat === st.plat); }).sort(function (a, b) { return key === 'cpl' ? (a.m.cpl || 1e9) - (b.m.cpl || 1e9) : val(b) - val(a); });
    var h = '<div class="mk-bar mb"><div class="mk-chips">' + ['todas', 'Meta', 'Google'].map(function (p) { return '<button class="mk-chip' + (st.plat === p ? ' on' : '') + '" data-plat="' + p + '">' + (p === 'todas' ? 'Todas as plataformas' : p + ' Ads') + '</button>'; }).join('') + '</div>' +
      '<label class="text-sm muted">Ordenar por <select class="input" id="mk-sort">' + [['roas', 'ROAS'], ['leads', 'Leads'], ['cpl', 'Menor CPL'], ['ctr', 'Contratos'], ['fat', 'Receita']].map(function (o) { return '<option value="' + o[0] + '"' + (key === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></div>';
    if (D.best) h += '<div class="grid grid-2 mb"><div class="card mk-best"><div class="text-sm muted">Melhor criativo</div><div class="mk-hl">' + thumb(D.best.a) + '<div><b>' + esc(D.best.a.titulo) + '</b><div class="text-sm">' + esc(D.best.camp.c.nome) + '</div><div class="text-sm">ROAS ' + D.best.m.roas.toFixed(1).replace('.', ',') + 'x, CPL ' + M(D.best.m.cpl) + ', ' + D.best.m.ctr + ' contratos. Escale a verba.</div></div></div></div>' +
      (D.worst ? '<div class="card mk-worst"><div class="text-sm muted">Pior criativo</div><div class="mk-hl">' + thumb(D.worst.a) + '<div><b>' + esc(D.worst.a.titulo) + '</b><div class="text-sm">' + esc(D.worst.camp.c.nome) + '</div><div class="text-sm">ROAS ' + D.worst.m.roas.toFixed(1).replace('.', ',') + 'x, CPL ' + M(D.worst.m.cpl) + ', ' + D.worst.m.ctr + ' contratos. Pause ou troque a copy.</div></div></div></div>' : '') + '</div>';
    h += rows.map(function (r) {
      var m = r.m, day = new Date(), exp = day.getDate() / new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate() * 100, sp = Math.min(100, r.c.investimento / r.orc * 100);
      var pace = sp > exp + 12 ? ['red', 'Acima do ritmo'] : sp < exp - 15 ? ['amber', 'Abaixo do ritmo'] : ['green', 'No ritmo'];
      var sets = {}; r.adRows.forEach(function (x) { (sets[x.a.conjunto] = sets[x.a.conjunto] || []).push(x); });
      return '<details class="card mk-camp mb"' + (rows.length <= 2 ? ' open' : '') + '><summary><div class="mk-sum"><div class="grow"><b>' + esc(r.c.nome) + '</b><div class="text-sm muted">' + esc(r.c.canal) + ' - ' + r.plat + ' Ads ' + (r.c.status === 'ativa' ? ui.badge('Ativa', 'green') : ui.badge('Pausada', 'gray')) + '</div></div>' +
        '<div class="mk-nums"><span><small>Leads</small><b>' + m.leads + '</b></span><span><small>CPL</small><b>' + M(m.cpl) + '</b></span><span><small>Qualif.</small><b>' + P(m.pq) + '</b></span><span><small>Contratos</small><b>' + m.ctr + '</b></span><span><small>Receita</small><b>' + ui.fmtMoney(m.fat, { compact: true }) + '</b></span><span><small>ROAS</small><b>' + m.roas.toFixed(1).replace('.', ',') + 'x</b></span></div></div>' +
        '<div class="mk-pace"><div class="row text-sm"><span class="grow muted">Verba do mês: ' + M(r.c.investimento) + ' de ' + M(r.orc) + '</span>' + ui.badge(pace[1], pace[0]) + '</div><div class="mk-track"><span style="width:' + sp + '%"></span><i style="left:' + exp + '%" title="Onde deveria estar hoje"></i></div></div></summary>' +
        '<div class="mk-body"><div class="mk-actions"><button class="btn btn-ghost btn-sm" data-pausec="' + r.c.id + '">' + (r.c.status === 'ativa' ? 'Pausar campanha' : 'Reativar campanha') + '</button></div>' +
        Object.keys(sets).map(function (s) {
          return '<div class="mk-set"><div class="mk-set-t">' + ui.icon('target', 16) + ' Conjunto: ' + esc(s) + '</div><div class="mk-ads">' + sets[s].map(function (x) {
            var tag = D.best === x ? ['good', 'Melhor'] : D.worst === x ? ['bad', 'Pior'] : x.a.status === 'pausado' ? ['off', 'Pausado'] : null;
            return '<div class="mk-ad' + (x.a.status === 'pausado' ? ' off' : '') + (D.best === x ? ' good' : D.worst === x ? ' bad' : '') + '">' + thumb(x.a, tag) + '<div class="mk-adi"><div class="text-sm muted">' + TIPO[x.a.tipo] + ' - CTR ' + String(x.a.ctr).replace('.', ',') + '%</div>' +
              '<div class="mk-adm"><span>Leads <b>' + x.m.leads + '</b></span><span>CPL <b>' + (x.m.leads ? M(x.m.cpl) : '-') + '</b></span><span>Qualif. <b>' + P(x.m.pq) + '</b></span><span>Contratos <b>' + x.m.ctr + '</b></span><span>Receita <b>' + ui.fmtMoney(x.m.fat, { compact: true }) + '</b></span><span>ROAS <b>' + x.m.roas.toFixed(1).replace('.', ',') + 'x</b></span></div>' +
              '<button class="btn btn-ghost btn-sm" data-pausea="' + x.a.id + '">' + (x.a.status === 'ativo' ? 'Pausar anúncio' : 'Reativar') + '</button></div></div>';
          }).join('') + '</div></div>';
        }).join('') + '</div></details>';
    }).join('') || ui.empty({ icon: 'megaphone', title: 'Nenhuma campanha neste filtro' });
    return h + '<p class="text-sm muted">Impressões e cliques são estimados a partir da verba; leads, qualificação e vendas vêm do CRM.</p>';
  }

  /* ---------------- 3. qualidade ---------------- */
  function qualidade(D) {
    var rows = D.camps.filter(function (r) { return r.m.leads > 0; }).map(function (r) {
      var perd = {}; r.ls.forEach(function (l) { if (l.etapa === 'perdido' && l.motivoPerda) perd[l.motivoPerda] = (perd[l.motivoPerda] || 0) + 1; });
      var top = Object.keys(perd).sort(function (a, b) { return perd[b] - perd[a]; })[0];
      var tkL = r.m.leads ? r.ls.reduce(function (s, l) { return s + (l.valorEstimado || 0); }, 0) / r.m.leads : 0;
      return { r: r, m: r.m, top: top ? top + ' (' + perd[top] + ')' : '-', tk: r.m.ctr ? r.m.tk : tkL, tkReal: !!r.m.ctr };
    });
    var byCpl = rows.filter(function (x) { return x.m.leads >= 5; }).sort(function (a, b) { return a.m.cpl - b.m.cpl; })[0];
    var byCac = rows.filter(function (x) { return x.m.ctr > 0; }).sort(function (a, b) { return a.m.cac - b.m.cac; })[0];
    var h = '<div class="card mk-best mb"><div class="row">' + ui.icon('alert', 28) + '<div class="grow"><b>Lead barato não é lead bom.</b><div class="text-sm">' + (byCpl && byCac && byCpl !== byCac ?
      'A campanha mais barata por lead é "' + esc(byCpl.r.c.nome) + '" (' + M(byCpl.m.cpl) + ', ' + P(byCpl.m.pq) + ' qualificados, ' + byCpl.m.ctr + ' vendas). Já "' + esc(byCac.r.c.nome) + '" custa ' + M(byCac.m.cpl) + ' por lead, mas vende por ' + M(byCac.m.cac) + '. Avalie sempre o custo por venda e por lead qualificado.' :
      'Compare sempre o custo por lead com o custo por lead qualificado e por venda antes de escalar a verba.') + '</div><div class="text-sm muted mt">Referência de mercado: em solar, formulário do Meta costuma ter CPL menor que o Google, mas o Google tende a trazer mais agendamentos e fechamentos por lead. Por isso o custo por reunião realizada e por venda é a métrica justa.</div></div></div></div>';
    h += '<div class="grid grid-2 mb"><div class="card"><div class="card-title">CPL x % de qualificados</div>' + scatter(rows) + '<p class="text-sm muted">Quanto mais para a esquerda e para cima, melhor. O tamanho da bolha é o número de vendas.</p></div>' +
      '<div class="card"><div class="card-title">Custo por lead x custo por lead qualificado</div>' + ui.barChart(rows.slice().sort(function (a, b) { return a.m.cpql - b.m.cpql; }).map(function (x) { return { label: x.r.c.nome, value: x.m.cpql, display: M(x.m.cpl) + ' > ' + M(x.m.cpql), color: CORES[x.r.c.canal] }; })) + '<p class="text-sm muted">Primeiro valor: CPL. Segundo: custo de cada lead qualificado.</p></div></div>';
    h += '<div class="card"><div class="card-title">Qualidade por campanha</div><div class="table-wrap"><table class="table"><thead><tr><th>Campanha</th><th>Leads</th><th>% qualificados</th><th>Consumo médio</th><th>Ticket médio</th><th>Fechamento</th><th>CPL</th><th>Custo/venda</th><th>Principal motivo de perda</th></tr></thead><tbody>' + rows.map(function (x) {
      return '<tr><td><b>' + esc(x.r.c.nome) + '</b><div class="text-sm muted">' + esc(x.r.c.canal) + '</div></td><td>' + x.m.leads + '</td><td><div class="mk-mini"><span style="width:' + x.m.pq + '%"></span></div>' + P(x.m.pq) + '</td><td>' + ui.fmtNum(Math.round(x.m.kwhm)) + ' kWh</td><td>' + M(x.tk) + (x.tkReal ? '' : '<div class="text-sm muted">estimado</div>') + '</td><td>' + P(x.m.tx) + '</td><td>' + M(x.m.cpl) + '</td><td>' + (x.m.ctr ? M(x.m.cac) : '-') + '</td><td>' + esc(x.top) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
    return h;
  }
  function scatter(rows) {
    if (!rows.length) return ui.empty({ icon: 'trending', title: 'Sem dados' });
    var mx = Math.max.apply(null, rows.map(function (x) { return x.m.cpl; }).concat([1])) * 1.15, mc = Math.max.apply(null, rows.map(function (x) { return x.m.ctr; }).concat([1])), s = '<svg class="mk-svg" viewBox="0 0 320 210" role="img" aria-label="CPL versus qualificação"><line x1="34" y1="10" x2="34" y2="170" stroke="currentColor" opacity=".25"/><line x1="34" y1="170" x2="310" y2="170" stroke="currentColor" opacity=".25"/>';
    [0, 50, 100].forEach(function (v) { s += '<text x="30" y="' + (174 - v * 1.6) + '" text-anchor="end" font-size="9" fill="currentColor" opacity=".6">' + v + '%</text>'; });
    s += '<text x="172" y="195" text-anchor="middle" font-size="10" fill="currentColor" opacity=".7">Custo por lead (R$)</text>';
    rows.forEach(function (x) {
      var cx = 34 + x.m.cpl / mx * 270, cy = 170 - Math.min(100, x.m.pq) * 1.6, r = 6 + x.m.ctr / mc * 12;
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (CORES[x.r.c.canal] || '#64748B') + '" opacity=".75"><title>' + esc(x.r.c.nome) + ': CPL ' + M(x.m.cpl) + ', ' + P(x.m.pq) + ' qualificados, ' + x.m.ctr + ' vendas</title></circle>';
    });
    return s + '</svg>';
  }

  /* ---------------- 4. atribuição & UTM ---------------- */
  var SRC = { 'Facebook Ads': ['facebook', 'paid_social'], 'Instagram': ['instagram', 'paid_social'], 'Google Ads': ['google', 'cpc'], 'WhatsApp': ['whatsapp', 'click_to_whatsapp'], 'Site': ['google', 'organic'], 'Indicação': ['indicacao', 'referral'], 'Manual': ['direct', 'none'] };
  function slug(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
  function utmUrl() {
    var u = st.utm, q = [['utm_source', u.source], ['utm_medium', u.medium], ['utm_campaign', u.campaign], ['utm_content', u.content], ['utm_term', u.term]].filter(function (p) { return p[1]; }).map(function (p) { return p[0] + '=' + encodeURIComponent(p[1]); }).join('&');
    return (u.url || '') + (q ? (u.url.indexOf('?') >= 0 ? '&' : '?') + q : '');
  }
  function utm(D) {
    var camp = {}; D.camps.forEach(function (r) { camp[r.c.nome] = r; });
    var adOf = {}; D.ads.forEach(function (x) { x.ls.forEach(function (l) { adOf[l.id] = x; }); });
    var rows = D.leads.filter(function (l) { return l.origem !== 'Manual'; }).map(function (l) {
      var s = SRC[l.origem] || ['direct', 'none'], ad = adOf[l.id], c = D.X.ctr[l.id];
      return { l: l, src: s[0], med: s[1], cam: slug(l.campanha) || '(nenhuma)', con: ad ? slug(ad.a.titulo).slice(0, 28) : '-', first: l.origem + ' em ' + ui.fmtDate(l.criadoEm), tc: c && c.assinadoEm ? Math.max(1, Math.round((new Date(c.assinadoEm) - new Date(l.criadoEm)) / 864e5)) : null, fat: c ? c.valor : 0 };
    }).sort(function (a, b) { return new Date(b.l.criadoEm) - new Date(a.l.criadoEm); });
    var srcs = ['todas'].concat(Object.keys(rows.reduce(function (m, r) { m[r.src] = 1; return m; }, {})));
    var vis = rows.filter(function (r) { return st.utmSrc === 'todas' || r.src === st.utmSrc; });
    var closed = rows.filter(function (r) { return r.tc; }), avg = closed.length ? closed.reduce(function (s, r) { return s + r.tc; }, 0) / closed.length : 0;
    var h = '<div class="card mb"><div class="card-title">' + ui.icon('send', 18) + ' Gerador de link com UTM</div><p class="text-sm muted mb">Todo anúncio deve apontar para um link com UTM. Assim o CRM sabe de qual campanha e criativo veio cada lead e a venda volta para o lugar certo.</p>' +
      '<div class="mk-presets">' + [['Meta - vídeo', 'facebook', 'paid_social'], ['Instagram - Reels', 'instagram', 'paid_social'], ['Google - pesquisa', 'google', 'cpc'], ['WhatsApp', 'whatsapp', 'click_to_whatsapp']].map(function (p) { return '<button class="mk-chip" data-preset="' + p[1] + '|' + p[2] + '">' + p[0] + '</button>'; }).join('') + '</div>' +
      '<div class="mk-utm">' + [['url', 'URL da página de destino'], ['source', 'utm_source (origem)'], ['medium', 'utm_medium (mídia)'], ['campaign', 'utm_campaign (campanha)'], ['content', 'utm_content (criativo)'], ['term', 'utm_term (palavra-chave)']].map(function (f) { return '<label class="text-sm muted">' + f[1] + '<input class="input" data-utm="' + f[0] + '" value="' + esc(st.utm[f[0]]) + '"></label>'; }).join('') + '</div>' +
      '<div class="mk-out"><code id="mk-utm-out">' + esc(utmUrl()) + '</code><button class="btn btn-primary btn-sm" id="mk-copy">Copiar link</button></div></div>';
    h += '<div class="grid grid-3 mb"><div class="card"><div class="text-sm muted">Leads rastreados</div><b class="mk-big">' + rows.length + '</b></div><div class="card"><div class="text-sm muted">Tempo médio até fechar</div><b class="mk-big">' + (closed.length ? Math.round(avg) + ' dias' : '-') + '</b></div><div class="card"><div class="text-sm muted">Primeiro toque = origem</div><b class="mk-big">100%</b><div class="text-sm muted">Cada lead guarda o primeiro canal que o trouxe.</div></div></div>';
    h += '<div class="card"><div class="mk-bar mb"><div class="card-title" style="margin:0">Leads com atribuição</div><label class="text-sm muted">Origem <select class="input" id="mk-usrc">' + srcs.map(function (s) { return '<option value="' + s + '"' + (s === st.utmSrc ? ' selected' : '') + '>' + (s === 'todas' ? 'Todas' : s) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Lead</th><th>utm_source</th><th>utm_medium</th><th>utm_campaign</th><th>utm_content</th><th>Primeiro toque</th><th>Tempo até fechar</th><th>Venda</th></tr></thead><tbody>' +
      vis.slice(0, 40).map(function (r) { return '<tr><td><a class="link" href="#/leads/' + esc(r.l.id) + '">' + esc(r.l.nome) + '</a></td><td><code>' + r.src + '</code></td><td><code>' + r.med + '</code></td><td><code>' + esc(r.cam) + '</code></td><td><code>' + esc(r.con) + '</code></td><td>' + esc(r.first) + '</td><td>' + (r.tc ? r.tc + ' dias' : '-') + '</td><td>' + (r.fat ? M(r.fat) : '-') + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="text-sm muted">Mostrando ' + Math.min(40, vis.length) + ' de ' + vis.length + ' leads.</p></div>';
    return h;
  }

  /* ---------------- 5. conversões offline ---------------- */
  function offline(D) {
    var A = D.A, plats = ['Meta', 'Google'], cnt = {};
    plats.forEach(function (p) { var m = platAgg(D, p); cnt[p] = { lead: m.leads, qualificado: m.qual, proposta: m.prop, venda: m.ctr, valor: m.fat }; });
    var all = platAgg(D, 'Meta'), g = platAgg(D, 'Google'), ls = [].concat(D.camps.filter(function (r) { return r.plat !== 'Outros'; }).map(function (r) { return r.ls.map(function (l) { return { l: l, p: r.plat }; }); }).reduce(function (a, b) { return a.concat(b); }, []));
    var ev = [];
    ls.forEach(function (x) {
      var l = x.l, c = D.X.ctr[l.id];
      if (c && c.assinadoEm) ev.push({ k: 'venda', t: c.assinadoEm, v: c.valor, x: x });
      else if (D.X.prop[l.id]) ev.push({ k: 'proposta', t: l.ultimoContato || l.criadoEm, v: l.valorEstimado, x: x });
      else if (isQual(l)) ev.push({ k: 'qualificado', t: l.ultimoContato || l.criadoEm, v: 0, x: x });
      else ev.push({ k: 'lead', t: l.criadoEm, v: 0, x: x });
    });
    ev.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
    var off = A.conv, anyOff = CONV.some(function (c) { return !off[c[0]]; });
    var h = '<div class="card mk-hero mb"><div class="row"><span class="mk-hero-ic">' + ui.icon('refresh', 26) + '</span><div class="grow"><h3>Enviar vendas de volta ao Meta (API de Conversões) e Google (Conversões offline)</h3><p class="text-sm">O Meta e o Google só enxergam o clique e o formulário. Quando o CRM devolve quem virou proposta e quem comprou, o algoritmo aprende a encontrar compradores e para de gastar verba com curiosos. É assim que o CPL pode subir um pouco enquanto o custo por venda cai.</p></div></div></div>';
    h += '<div class="grid grid-2 mb">' + plats.map(function (p) {
      var key = p.toLowerCase(), on = A.conectado[key];
      return '<div class="card"><div class="row mb"><b class="grow">' + (p === 'Meta' ? 'Meta Ads - API de Conversões' : 'Google Ads - Conversões offline') + '</b><button class="mk-sw' + (on ? ' on' : '') + '" data-conn="' + key + '" aria-label="Ativar integração ' + p + '"><i></i></button></div>' +
        '<div class="text-sm muted mb">' + (on ? 'Conectado (simulado). Identificadores capturados: ' + (p === 'Meta' ? 'fbclid, fbp e e-mail/telefone com hash' : 'gclid e conversões avançadas') + '.' : 'Integração desligada: nenhum evento será enviado.') + '</div>' +
        '<div class="mk-evs">' + CONV.map(function (c) { return '<div class="mk-ev"><span>' + c[1] + '</span><b>' + cnt[p][c[0]] + '</b></div>'; }).join('') + '</div><div class="text-sm mt">Valor de vendas enviado: <b>' + M(on && off.venda ? cnt[p].valor : 0) + '</b></div></div>';
    }).join('') + '</div>';
    h += '<div class="card mb"><div class="card-title">Eventos enviados</div><p class="text-sm muted mb">Escolha quais etapas do CRM viram sinal para os anúncios.</p>' + CONV.map(function (c) {
      return '<div class="mk-evrow"><div class="grow"><b>' + c[1] + '</b><div class="text-sm muted">' + c[2] + ' - evento ' + c[3] + (c[0] === 'venda' ? ' com valor do contrato' : '') + '</div></div><span class="text-sm muted">Meta ' + cnt.Meta[c[0]] + ' / Google ' + cnt.Google[c[0]] + '</span><button class="mk-sw' + (off[c[0]] ? ' on' : '') + '" data-conv="' + c[0] + '" aria-label="Enviar evento ' + c[1] + '"><i></i></button></div>';
    }).join('') + '</div>';
    var cplM = all.cpl, cpsM = all.cac, cpsG = g.cac;
    h += '<div class="grid grid-2 mb"><div class="card"><div class="card-title">Otimizando para lead (hoje, sem retorno)</div><div class="mk-cmp"><div><small>CPL</small><b>' + M(D.tot.cpl) + '</b></div><div><small>Custo por venda</small><b>' + M(D.tot.cac) + '</b></div></div><p class="text-sm muted">O algoritmo vê só formulários, então prioriza quem preenche rápido, inclusive curiosos.</p></div>' +
      '<div class="card mk-best"><div class="card-title">Otimizando para venda (com retorno do CRM)</div><div class="mk-cmp"><div><small>CPL estimado</small><b>' + M(D.tot.cpl * 1.12) + '</b></div><div><small>Custo por venda estimado</small><b>' + M(D.tot.cac * 0.78) + '</b></div></div><p class="text-sm muted">Simulação ilustrativa: CPL um pouco maior, venda cerca de 22% mais barata. Os resultados reais variam por conta.</p></div></div>';
    h += '<div class="card"><div class="card-title">Últimos eventos devolvidos às plataformas</div><div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Evento</th><th>Lead</th><th>Plataforma</th><th>Valor</th><th>Status</th></tr></thead><tbody>' + ev.slice(0, 14).map(function (e) {
      var nm = e.x.l.nome.split(' '), name = nm[0] + (nm[1] ? ' ' + nm[1].charAt(0) + '.' : ''), conn = D.A.conectado[e.x.p.toLowerCase()] && off[e.k], ck = CONV.filter(function (c) { return c[0] === e.k; })[0];
      return '<tr><td>' + ui.fmtDateTime(e.t) + '</td><td>' + ck[1] + ' <code>' + ck[3] + '</code></td><td>' + esc(name) + '</td><td>' + e.x.p + '</td><td>' + (e.v ? M(e.v) : '-') + '</td><td>' + (conn ? ui.badge('Enviado', 'green') : ui.badge('Desativado', 'gray')) + '</td></tr>';
    }).join('') + '</tbody></table></div>' + (anyOff ? '<p class="text-sm muted mt">Eventos desativados não são enviados e deixam de ensinar o algoritmo.</p>' : '') + '<p class="text-sm muted mt">Demonstração: nenhum dado real é enviado ao Meta ou ao Google.</p></div>';
    return h;
  }

  /* ---------------- 6. relatório ---------------- */
  function recos(D) {
    var r = [], t = D.tot;
    if (D.best) r.push(['good', 'Escalar', 'Aumentar 20% a verba do criativo "' + D.best.a.titulo + '" (' + D.best.camp.c.nome + '), ROAS de ' + D.best.m.roas.toFixed(1).replace('.', ',') + 'x.']);
    if (D.worst) r.push(['bad', 'Pausar ou trocar', 'O criativo "' + D.worst.a.titulo + '" gastou ' + M(D.worst.m.inv) + ' e retornou ' + M(D.worst.m.fat) + '. Testar nova copy ou pausar.']);
    var pausadas = D.camps.filter(function (x) { return x.c.status === 'pausada' && x.m.ctr > 0; })[0];
    if (pausadas) r.push(['info', 'Reativar', '"' + pausadas.c.nome + '" está pausada, mas gerou ' + pausadas.m.ctr + ' venda(s). Vale um novo teste.']);
    var gm = platAgg(D, 'Google'), mm = platAgg(D, 'Meta');
    if (gm.leads && mm.leads) r.push(['info', 'Equilibrar canais', 'Google: ' + P(gm.pq) + ' de leads qualificados e CPL ' + M(gm.cpl) + '. Meta: ' + P(mm.pq) + ' e CPL ' + M(mm.cpl) + '. Distribua a verba pelo custo por venda, não pelo CPL.']);
    r.push(['info', 'Ativar conversões offline', 'Enviar propostas e vendas ao Meta e Google para as campanhas otimizarem para compradores.']);
    if (t.leads) r.push(['info', 'Velocidade de resposta', 'Leads de anúncio esfriam rápido: responder em até 5 minutos pode multiplicar a chance de proposta.']);
    return r;
  }
  function relatorio(D) {
    var t = D.tot, emp = (db().config && db().config.empresa && db().config.empresa.nome) || 'Solar Prime', lbl = st.dias ? 'Últimos ' + st.dias + ' dias' : 'Todo o período';
    var top = D.ads.filter(function (x) { return x.m.leads > 0; }).sort(function (a, b) { return b.m.roas - a.m.roas; }).slice(0, 3);
    var h = '<div class="mk-noprint mk-bar mb"><span class="text-sm muted">Relatório pronto para enviar ao cliente. Use o filtro de período acima.</span><div class="mk-chips"><button class="btn btn-ghost" id="mk-send">Enviar ao cliente</button><button class="btn btn-primary" id="mk-print">' + ui.icon('download', 16) + ' Imprimir / salvar PDF</button></div></div>';
    h += '<div class="card mk-report"><div class="mk-rh"><div><div class="text-sm muted">Relatório de resultados - tráfego pago</div><h2>' + esc(emp) + '</h2><div class="text-sm muted">' + lbl + ' - gerado em ' + ui.fmtDate(new Date().toISOString()) + '</div></div><div class="mk-rb">' + ui.icon('sunpower', 30) + '</div></div>' +
      '<div class="mk-rhero"><div><small>Você investiu</small><b>' + M(t.inv) + '</b></div><div class="mk-arrow">→</div><div><small>E vendeu</small><b class="text-green">' + M(t.fat) + '</b></div><div><small>ROAS</small><b>' + t.roas.toFixed(1).replace('.', ',') + 'x</b></div><div><small>ROI</small><b>' + (t.inv ? P(t.roi) : '-') + '</b></div></div>' +
      '<p class="mk-sum2">Para cada R$ 1,00 investido em anúncios, a empresa faturou R$ ' + t.roas.toFixed(2).replace('.', ',') + ' em ' + t.ctr + ' contratos assinados.</p>' +
      '<div class="grid grid-4 mb">' + [['Leads', t.leads], ['Qualificados', t.qual], ['Propostas', t.prop], ['Contratos', t.ctr]].map(function (k) { return '<div class="mk-rk"><small>' + k[0] + '</small><b>' + k[1] + '</b></div>'; }).join('') + '</div>' +
      '<div class="grid grid-2 mb"><div><div class="card-title">Custos</div><div class="mk-kv"><span>Custo por lead</span><b>' + M(t.cpl) + '</b></div><div class="mk-kv"><span>Custo por lead qualificado</span><b>' + M(t.cpql) + '</b></div><div class="mk-kv"><span>Custo por venda (CAC)</span><b>' + M(t.cac) + '</b></div><div class="mk-kv"><span>Ticket médio</span><b>' + M(t.tk) + '</b></div></div>' +
      '<div><div class="card-title">Faturamento por canal</div>' + ui.barChart(chan(D).filter(function (c) { return c.m.fat > 0; }).map(function (c) { return { label: c.canal, value: c.m.fat, display: ui.fmtMoney(c.m.fat, { compact: true }), color: CORES[c.canal] }; })) + '</div></div>' +
      '<div class="card-title">Melhores criativos</div><div class="mk-top3">' + top.map(function (x, i) { return '<div class="mk-ad">' + thumb(x.a, ['good', (i + 1) + 'º']) + '<div class="mk-adi"><div class="text-sm muted">' + esc(x.camp.c.nome) + '</div><div class="mk-adm"><span>Leads <b>' + x.m.leads + '</b></span><span>Contratos <b>' + x.m.ctr + '</b></span><span>ROAS <b>' + x.m.roas.toFixed(1).replace('.', ',') + 'x</b></span></div></div></div>'; }).join('') + '</div>' +
      '<div class="card-title mt">Recomendações da IA <span class="mk-ia">Análise automática simulada</span></div><ul class="mk-recos">' + recos(D).map(function (r) { return '<li class="' + r[0] + '"><b>' + r[1] + '.</b> ' + esc(r[2]) + '</li>'; }).join('') + '</ul>' +
      '<div class="text-sm muted mt">Dados de leads, propostas e contratos vindos do CRM; verba informada pela gestão de tráfego.</div></div>';
    return h;
  }

  /* ---------------- 7. reativação (mantida) ---------------- */
  function segments() {
    var L = store.collection('leads');
    return [
      { id: 'preco', t: 'Perdidos por preço alto', ic: 'dollar', ls: L.filter(function (l) { return l.etapa === 'perdido' && l.motivoPerda === 'Preço alto'; }), msg: 'Oi {nome}! Temos uma nova condição de financiamento em até 84x com a primeira parcela em 90 dias. Posso refazer sua simulação sem compromisso?' },
      { id: 'semresp', t: 'Perdidos sem resposta', ic: 'chat', ls: L.filter(function (l) { return l.etapa === 'perdido' && (l.motivoPerda === 'Sem resposta' || l.motivoPerda === 'Adiou a decisão'); }), msg: 'Oi {nome}, tudo bem? A conta de luz subiu de novo e sua economia com energia solar ficou ainda maior. Quer ver quanto você pouparia hoje?' },
      { id: 'parados', t: 'Leads parados há mais de 15 dias', ic: 'clock', ls: L.filter(function (l) { return l.etapa !== 'perdido' && SP.consts.FECHADAS.indexOf(l.etapa) < 0 && ui.daysSince(l.ultimoContato) > 15; }), msg: 'Oi {nome}! Sua proposta de energia solar continua válida. Posso tirar alguma dúvida ou ajustar o projeto?' }
    ];
  }
  function reativacao() {
    return '<div class="card"><div class="card-title">' + ui.icon('refresh', 18) + ' Reativação automática</div><p class="muted text-sm mb">Leads que esfriaram agrupados por situação, com mensagem pronta para recuperar a venda. Recuperar lead antigo custa menos que comprar lead novo no anúncio.</p><div class="grid grid-3">' + segments().map(function (s) {
      return '<div class="mk-seg"><div class="row">' + ui.icon(s.ic, 20) + '<b class="grow">' + s.t + '</b>' + ui.badge(s.ls.length + ' leads', 'orange') + '</div><div class="mk-msg">' + esc(s.msg.replace('{nome}', s.ls.length ? s.ls[0].nome.split(' ')[0] : 'Cliente')) + '</div>' +
        '<button class="btn btn-primary btn-sm" data-camp="' + s.id + '"' + (s.ls.length ? '' : ' disabled') + '>Criar campanha</button></div>';
    }).join('') + '</div></div>';
  }

  /* ---------------- eventos ---------------- */
  function bind(el) {
    var per = el.querySelector('#mk-per'); if (per) per.onchange = function (e) { st.dias = +e.target.value; SP.refresh(); };
    el.onclick = function (ev) {
      var t = ev.target, b;
      if ((b = t.closest('[data-tab]'))) { st.tab = b.dataset.tab; SP.refresh(); return; }
      if ((b = t.closest('[data-plat]'))) { st.plat = b.dataset.plat; SP.refresh(); return; }
      if ((b = t.closest('[data-pausec]'))) { ev.preventDefault(); var c = store.find('campanhas', b.dataset.pausec); store.patch('campanhas', c.id, { status: c.status === 'ativa' ? 'pausada' : 'ativa' }); ui.toast('Campanha ' + (c.status === 'ativa' ? 'pausada' : 'reativada') + ' (simulado)', 'success'); SP.refresh(); return; }
      if ((b = t.closest('[data-pausea]'))) { var a = seed().anuncios.filter(function (x) { return x.id === b.dataset.pausea; })[0]; a.status = a.status === 'ativo' ? 'pausado' : 'ativo'; store.save(); SP.refresh(); return; }
      if ((b = t.closest('[data-conv]'))) { var A = seed(); A.conv[b.dataset.conv] = !A.conv[b.dataset.conv]; store.save(); SP.refresh(); return; }
      if ((b = t.closest('[data-conn]'))) { var A2 = seed(); A2.conectado[b.dataset.conn] = !A2.conectado[b.dataset.conn]; store.save(); SP.refresh(); return; }
      if ((b = t.closest('[data-preset]'))) { var p = b.dataset.preset.split('|'); st.utm.source = p[0]; st.utm.medium = p[1]; SP.refresh(); return; }
      if (t.closest('#mk-copy')) { var txt = utmUrl(); try { navigator.clipboard.writeText(txt); } catch (x) { /* ignora */ } ui.toast('Link copiado', 'success'); return; }
      if (t.closest('#mk-print')) { window.print(); return; }
      if (t.closest('#mk-send')) { ui.toast('Relatório enviado ao cliente por WhatsApp e e-mail (simulado)', 'success'); return; }
      if ((b = t.closest('[data-camp]'))) camp(b.dataset.camp);
    };
    el.oninput = function (e) {
      var f = e.target.dataset && e.target.dataset.utm; if (!f) return;
      st.utm[f] = e.target.value; var o = el.querySelector('#mk-utm-out'); if (o) o.textContent = utmUrl();
    };
    el.onchange = function (e) {
      if (e.target.id === 'mk-sort') { st.sort = e.target.value; SP.refresh(); }
      else if (e.target.id === 'mk-usrc') { st.utmSrc = e.target.value; SP.refresh(); }
    };
  }
  function camp(id) {
    var s = segments().filter(function (x) { return x.id === id; })[0];
    ui.modal({
      title: 'Criar campanha de reativação', body: '<p><b>' + esc(s.t) + '</b> - ' + s.ls.length + ' leads receberão uma mensagem personalizada pelo WhatsApp.</p><div class="mk-msg mt">' + esc(s.msg) + '</div><p class="text-sm muted mt">Simulação: nenhuma mensagem real será enviada.</p>',
      actions: [{ label: 'Cancelar', cls: 'btn-ghost' }, {
        label: 'Disparar agora', cls: 'btn-primary', onClick: function () {
          store.upsert('campanhas', { nome: 'Reativação - ' + s.t, canal: 'WhatsApp', investimento: 0, status: 'ativa', inicioEm: new Date().toISOString() });
          store.log('criou campanha de reativação', 'marketing', s.id, s.ls.length + ' leads'); ui.toast('Campanha criada para ' + s.ls.length + ' leads', 'success'); SP.refresh();
        }
      }]
    });
  }

  SP.register({
    route: 'marketing', title: 'Marketing & Tráfego', icon: 'megaphone', group: 'Gestão', order: 32, roles: ['dono', 'trafego'],
    render: function (el) { render(el); }
  });
})();
