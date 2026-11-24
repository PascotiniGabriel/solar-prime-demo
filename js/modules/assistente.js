/* Módulo: Assistente IA (#/assistente). Chat com motor local de intenções: respostas calculadas ao vivo do SP.store,
 * filtradas pelo papel. Demo estática (sem LLM). Também injeta o botão flutuante em todas as páginas. */
(function () {
  'use strict';
  var ui = SP.ui, S = SP.store, C = SP.consts;
  var DAY = 86400000;
  var e = function (s) { return ui.esc(s); };
  var m$ = function (v) { return ui.fmtMoney(v); };
  var mc$ = function (v) { return ui.fmtMoney(v, { compact: true }); };
  function nf(v, d) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 1 : d }); }
  function pct(a, b) { return b ? a / b * 100 : 0; }
  function sum(a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0); }
  function T(iso) { return iso ? new Date(iso).getTime() : 0; }
  function first(n) { return String(n || '').split(' ')[0]; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9$%,.\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function words(s) { return norm(s).replace(/[.,]/g, ' ').split(' ').filter(Boolean); }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 9;
    var p = [], i, j, c; for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) { var prev = p[0]; p[0] = i; for (j = 1; j <= b.length; j++) { c = p[j]; p[j] = Math.min(p[j] + 1, p[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = c; } }
    return p[b.length];
  }
  function lk(l) { return '<a href="#/leads/' + l.id + '">' + e(l.nome) + '</a>'; }
  function etNome(id) { return C.etapa(id).nome; }
  function tone(v, good, bad) { return v >= good ? 'green' : v <= bad ? 'red' : 'amber'; }

  /* ---------- blocos de resposta ---------- */
  var B = {
    p: function (h) { return { t: 'p', h: h }; },
    n: function (h) { return { t: 'n', h: h }; },
    k: function (items) { return { t: 'k', items: items }; },
    t: function (head, rows) { return { t: 't', head: head, rows: rows }; },
    l: function (items) { return { t: 'l', items: items }; },
    m: function (text) { return { t: 'm', text: text }; },
    a: function (items) { return { t: 'a', items: items }; }
  };
  function K(l, v, tn) { return { l: l, v: v, tn: tn || 'blue' }; }
  function Aopen(href, label) { return { l: label, href: href }; }
  function Aask(text, label) { return { l: label || text, act: 'ask', d: text }; }

  function blocksHtml(blocks) {
    return blocks.map(function (b) {
      if (b.t === 'p') return '<p>' + b.h + '</p>';
      if (b.t === 'n') return '<p class="as-note">' + b.h + '</p>';
      if (b.t === 'k') return '<div class="as-kpis">' + b.items.map(function (k) { return '<div class="as-kpi as-tone-' + k.tn + '"><b>' + k.v + '</b><span>' + k.l + '</span></div>'; }).join('') + '</div>';
      if (b.t === 't') return '<div class="as-tw"><table class="as-table"><thead><tr>' + b.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
        b.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      if (b.t === 'l') return '<ul class="as-list">' + b.items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
      if (b.t === 'm') return '<div class="as-msg"><div class="as-msg-t">' + e(b.text).replace(/\n/g, '<br>') + '</div><button class="btn btn-sm btn-ghost" data-act="copy" data-d="' + e(JSON.stringify(b.text)) + '">Copiar mensagem</button></div>';
      if (b.t === 'a') return '<div class="as-actions">' + b.items.map(function (a) {
        return a.href ? '<a class="btn btn-sm btn-ghost as-act" href="' + e(a.href) + '">' + e(a.l) + '</a>' :
          '<button class="btn btn-sm btn-ghost as-act" data-act="' + a.act + '" data-d="' + e(JSON.stringify(a.d)) + '">' + e(a.l) + '</button>';
      }).join('') + '</div>';
      return '';
    }).join('');
  }

  /* ---------- períodos e entidades ---------- */
  function mkPer(id) {
    var n = new Date(), d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    if (id === 'hoje') return { id: id, label: 'hoje', start: d0 };
    if (id === 'semana') return { id: id, label: 'nos últimos 7 dias', start: d0 - 6 * DAY };
    if (id === '30') return { id: id, label: 'nos últimos 30 dias', start: d0 - 29 * DAY };
    if (id === '90') return { id: id, label: 'nos últimos 90 dias', start: d0 - 89 * DAY };
    if (id === 'ano') return { id: id, label: 'neste ano', start: new Date(n.getFullYear(), 0, 1).getTime() };
    return { id: 'mes', label: 'neste mês', start: new Date(n.getFullYear(), n.getMonth(), 1).getTime() };
  }
  function parsePer(t) {
    if (/\bhoje\b/.test(t)) return mkPer('hoje');
    if (/\b(semana|semanal|7 dias)\b/.test(t)) return mkPer('semana');
    if (/\b30 dias\b/.test(t)) return mkPer('30');
    if (/\b90 dias|trimestre\b/.test(t)) return mkPer('90');
    if (/\b(ano|anual)\b/.test(t)) return mkPer('ano');
    if (/\b(mes|mensal)\b/.test(t)) return mkPer('mes');
    return null;
  }
  var NOME_STOP = { de: 1, da: 1, do: 1, dos: 1, das: 1, e: 1, solar: 1, energia: 1, ltda: 1, me: 1, epp: 1, sa: 1, comercio: 1, industria: 1, agro: 1, fazenda: 1, sitio: 1, posto: 1, loja: 1, cliente: 1, lead: 1, mercado: 1, padaria: 1, transportes: 1, grupo: 1, servicos: 1, construcoes: 1, clinica: 1, hotel: 1, escola: 1 };
  function findLead(tokens, vendToks) {
    var best = [], bh = 0;
    S.visibleLeads().forEach(function (l) {
      var nt = norm(l.nome).split(' ').filter(function (w) { return w.length >= 3 && !NOME_STOP[w]; }), hits = 0, onlyVend = true;
      nt.forEach(function (w) {
        var ok = tokens.some(function (t) { return t === w || (w.length >= 5 && t.length >= 5 && lev(t, w) <= 1); });
        if (ok) { hits++; if (vendToks.indexOf(w) < 0) onlyVend = false; }
      });
      if (!hits || (hits === 1 && onlyVend)) return;
      if (hits > bh) { bh = hits; best = [l]; } else if (hits === bh) best.push(l);
    });
    return { lead: best.length === 1 ? best[0] : null, cands: best.length > 1 ? best.slice(0, 5) : [], hits: bh };
  }
  function parseNums(raw) {
    var t = norm(raw), o = {}, mt;
    if ((mt = t.match(/(\d+(?:[.,]\d+)?)\s*%/))) { o.taxa = parseFloat(mt[1].replace(',', '.')); t = t.replace(mt[0], ' '); }
    if ((mt = t.match(/(\d+)\s*(?:x|parcelas|vezes|meses)\b/))) { o.parcelas = parseInt(mt[1], 10); t = t.replace(mt[0], ' '); }
    if ((mt = t.match(/(\d[\d.]*(?:,\d+)?)\s*kwh/))) { o.kwh = parseFloat(mt[1].replace(/\./g, '').replace(',', '.')); t = t.replace(mt[0], ' '); }
    if ((mt = t.match(/r\$\s*(\d[\d.]*(?:,\d+)?)/))) { o.valor = parseFloat(mt[1].replace(/\./g, '').replace(',', '.')); t = t.replace(mt[0], ' '); }
    else if ((mt = t.match(/(\d+(?:[.,]\d+)?)\s*(mil|k)\b/))) { o.valor = parseFloat(mt[1].replace(',', '.')) * 1000; t = t.replace(mt[0], ' '); }
    else if ((mt = t.match(/(\d[\d.]*(?:,\d+)?)\s*reais/))) { o.valor = parseFloat(mt[1].replace(/\./g, '').replace(',', '.')); t = t.replace(mt[0], ' '); }
    if ((mt = t.match(/\b(\d{3,}(?:\.\d{3})*)\b/))) { var v = parseFloat(mt[1].replace(/\./g, '')); if (o.valor == null && o.kwh == null) o.bare = v; }
    return o;
  }

  function buildCtx(raw) {
    var t = norm(raw), tokens = words(raw), vs = S.vendedores(), vend = null, vendToks = [];
    vs.forEach(function (u) { var f = norm(first(u.nome)); if (tokens.indexOf(f) >= 0) { vend = vend || u; vendToks.push(f); } });
    var canal = null; C.ORIGENS.forEach(function (o) { var n = norm(o); if (n !== 'manual' && new RegExp('\\b' + n.split(' ')[0]).test(t)) canal = o; });
    var city = null; S.collection('leads').forEach(function (l) { var c = String(l.cidade || '').split(' - ')[0]; if (c && !city && t.indexOf(norm(c)) >= 0) city = c; });
    var fl = findLead(tokens, vendToks);
    return { raw: raw, t: t, tokens: tokens, role: SP.session.role, user: SP.session.user(), uid: SP.session.userId, per: parsePer(t), vend: vend, canal: canal, city: city,
      lead: fl.lead, cands: fl.cands, nums: parseNums(raw) };
  }

  /* ---------- dados ---------- */
  function contratosAss(per, ids) { return S.collection('contratos').filter(function (c) { return c.status === 'assinado' && T(c.assinadoEm) >= per.start && (!ids || ids[c.leadId]); }); }
  function idMap(ls) { var o = {}; ls.forEach(function (l) { o[l.id] = l; }); return o; }
  function scopeLeads(ctx, ls) {
    if (ctx.vend && ctx.role !== 'vendedor') ls = ls.filter(function (l) { return l.vendedorId === ctx.vend.id; });
    if (ctx.canal) ls = ls.filter(function (l) { return l.origem === ctx.canal; });
    if (ctx.city) ls = ls.filter(function (l) { return String(l.cidade).indexOf(ctx.city) === 0; });
    return ls;
  }
  function scopeNote(ctx) { return (ctx.vend ? ' de ' + e(first(ctx.vend.nome)) : '') + (ctx.canal ? ' via ' + e(ctx.canal) : '') + (ctx.city ? ' em ' + e(ctx.city) : ''); }
  function isOpen(l) { return ['venda_fechada', 'instalacao', 'pos_venda', 'perdido'].indexOf(l.etapa) < 0; }
  function idleDays(l) { return Math.floor(ui.daysSince(l.ultimoContato || l.criadoEm)); }
  function propDe(l) { var ps = S.collection('propostas').filter(function (p) { return p.leadId === l.id; }); return ps.sort(function (a, b) { return T(b.criadaEm) - T(a.criadaEm); })[0] || null; }
  function aceita(p) { return p.status === 'aceita' || p.status === 'aprovada'; }
  function ymNow() { var n = new Date(); return n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2); }
  function vendStats(per) {
    return S.vendedores().map(function (u) {
      var ls = S.collection('leads').filter(function (l) { return l.vendedorId === u.id && T(l.criadoEm) >= per.start; });
      var cs = S.collection('contratos').filter(function (c) { return c.vendedorId === u.id && c.status === 'assinado' && T(c.assinadoEm) >= per.start; });
      var meta = S.collection('metas').filter(function (x) { return x.vendedorId === u.id && x.mes === ymNow(); })[0];
      var fat = sum(cs, function (c) { return c.valor; });
      return { u: u, leads: ls.length, vendas: cs.length, fat: fat, conv: pct(cs.length, ls.length), meta: meta, pm: meta ? pct(fat, meta.metaVendas) : null };
    }).sort(function (a, b) { return b.fat - a.fat; });
  }
  function campStats() {
    var leads = S.collection('leads'), cs = S.collection('contratos').filter(function (c) { return c.status === 'assinado'; }), byL = idMap(leads);
    return S.collection('campanhas').map(function (c) {
      var ls = leads.filter(function (l) { return l.campanha === c.nome; });
      var vs = cs.filter(function (k) { return byL[k.leadId] && byL[k.leadId].campanha === c.nome; });
      var fat = sum(vs, function (k) { return k.valor; }), q = ls.filter(function (l) { return (l.score || 0) >= 60; }).length;
      return { c: c, leads: ls.length, vendas: vs.length, fat: fat, qual: q, pq: pct(q, ls.length), score: ls.length ? sum(ls, function (l) { return l.score || 0; }) / ls.length : 0,
        cpl: ls.length ? c.investimento / ls.length : 0, cac: vs.length ? c.investimento / vs.length : 0, roas: c.investimento ? fat / c.investimento : 0 };
    });
  }
  function obraAtraso(o) {
    if (o.status === 'concluida') return 0;
    var worst = 0, now = Date.now();
    o.etapas.forEach(function (x) { if (x.status !== 'concluida' && T(x.previstaEm) < now) worst = Math.max(worst, Math.floor((now - T(x.previstaEm)) / DAY)); });
    if (T(o.previsaoEntrega) < now) worst = Math.max(worst, Math.floor((now - T(o.previsaoEntrega)) / DAY));
    return worst;
  }
  function obraAtual(o) { for (var i = 0; i < o.etapas.length; i++) if (o.etapas[i].status !== 'concluida') return o.etapas[i]; return null; }
  function etapaObraNome(id) { var x = C.OBRA_ETAPAS.filter(function (z) { return z.id === id; })[0]; return x ? x.nome : id; }
  function obraDe(l) { return S.collection('obras').filter(function (o) { return o.leadId === l.id; })[0] || null; }
  function minhasObras(ctx) { return S.collection('obras').filter(function (o) { return ctx.role !== 'tecnico' || o.tecnicoId === ctx.uid; }); }

  /* ---------- FAQ comercial e técnica ---------- */
  var FAQ = [
    { id: 'onoff', kw: ['on grid', 'off grid', 'ongrid', 'offgrid', 'hibrido', 'bateria', 'baterias'], title: 'On-grid x Off-grid', roles: null,
      b: ['<b>On-grid</b> (conectado à rede): é o mais comum. Gera, injeta o excedente na rede e vira crédito. Não usa bateria, custa menos e tem payback mais rápido. Desliga em queda de energia (proteção anti-ilhamento).',
        '<b>Off-grid</b> (isolado): usa baterias e é indicado onde não há rede (sítios, locais remotos). Custa em geral 2 a 3 vezes mais por causa de baterias e controlador.',
        '<b>Híbrido</b>: on-grid com baterias para backup. Vale para quem não pode ficar sem energia.'], dica: 'Para 95% dos clientes urbanos o on-grid é a melhor opção.' },
    { id: 'lei14300', kw: ['lei 14300', '14 300', 'fio b', 'marco legal', 'taxa do fio', 'tusd', 'gd ii', 'regra nova', 'taxacao do sol'], title: 'Lei 14.300 e Fio B', roles: null,
      b: ['A <b>Lei 14.300/2022</b> é o marco legal da geração distribuída. Quem protocolou o pedido na concessionária até 06/01/2023 mantém a compensação integral até 2045.',
        'Para os novos sistemas, a parcela do <b>Fio B</b> (TUSD) passa a ser cobrada sobre a energia compensada de forma gradual: 15% (2023), 30% (2024), 45% (2025), <b>60% (2026)</b>, 75% (2027), 90% (2028) e 100% (2029).',
        'Na prática o impacto é pequeno na conta (a energia continua sendo compensada, só uma fração do componente Fio B é cobrada) e o payback segue entre 3 e 5 anos na maioria dos casos.'], dica: 'Confirme os percentuais vigentes com a concessionária antes de fechar proposta.' },
    { id: 'homolog', kw: ['prazo de homologacao', 'prazo da homologacao', 'quanto tempo homologacao', 'quanto tempo demora a homologacao', 'prazo concessionaria', 'quanto tempo para homologar', 'demora a homologacao', 'homologacao', 'homologar'], title: 'Prazo de homologação', roles: null,
      b: ['A distribuidora tem até <b>15 dias</b> para dar o parecer de acesso (sem obras de rede). Depois da instalação, a vistoria e a troca do medidor levam até <b>7 dias</b> cada, em regra.',
        'Na prática, do protocolo à geração liberada o prazo costuma ficar entre <b>30 e 60 dias</b>, variando por concessionária (CPFL, Elektro, Enel etc.) e pela qualidade da documentação.'], dica: 'Documentação completa e correta na primeira entrega é o que mais acelera.' },
    { id: 'garantia', kw: ['garantia', 'garantias', 'quanto tempo dura', 'vida util', 'durabilidade'], title: 'Garantias', roles: null,
      b: ['<b>Módulos</b>: 12 anos contra defeitos de fabricação e <b>25 anos</b> de garantia de desempenho linear (geração mínima de ~80-87% ao fim do período).',
        '<b>Inversor</b>: de 5 a 12 anos conforme a marca (em geral cerca de <b>10 anos</b> com extensão).',
        '<b>Instalação</b>: garantia da empresa (normalmente de 1 a 5 anos para a mão de obra e a estrutura).'], dica: 'O sistema pode operar por 25 a 30 anos; o inversor costuma ser trocado uma vez nesse período.' },
    { id: 'telhado', kw: ['telhado', 'ceramico', 'ceramica', 'metalico', 'laje', 'fibrocimento', 'tipo de telhado', 'estrutura de fixacao', 'solo'], title: 'Tipos de telhado', roles: null,
      b: ['<b>Cerâmico</b>: ganchos de fixação sob as telhas e perfis de alumínio. É o mais comum e simples.',
        '<b>Metálico</b>: fixação direta no perfil da telha com presilhas (mini clamp) ou parafusos com vedação. Instalação rápida.',
        '<b>Laje</b>: estrutura de suporte (triângulos) com lastro ou chumbadores, permitindo ajustar a inclinação.',
        '<b>Fibrocimento</b>: exige ganchos/parafusos longos e cuidado ao pisar na telha. <b>Solo</b>: estrutura própria com fundação.'], dica: 'A visita técnica confirma a estrutura, a orientação (norte é o ideal) e a área útil.' },
    { id: 'sombra', kw: ['sombra', 'sombreamento', 'sombreado', 'arvore', 'predio vizinho', 'otimizador', 'microinversor', 'micro inversor'], title: 'Sombreamento', roles: null,
      b: ['Sombra sobre módulos reduz a geração da string inteira. Entre 9h e 15h é o período crítico.',
        'Solução: reposicionar os módulos, usar <b>microinversores</b> ou <b>otimizadores de potência</b> (cada módulo opera de forma independente) ou podar a árvore.',
        'Em perdas por sombra acima de ~10% o ideal é remodelar o projeto antes de fechar.'], dica: 'Peça fotos do telhado e, na visita, meça o sombreamento com o app/solarímetro.' },
    { id: 'nublado', kw: ['nublado', 'chuva', 'dia sem sol', 'dias nublados', 'noite', 'sem sol'], title: 'Dias nublados e noite', roles: null,
      b: ['Em dia nublado a geração cai de 10% a 30% (com chuva forte pode chegar a 70-90%). A noite não há geração.',
        'O dimensionamento usa a <b>média anual</b> de irradiação (HSP ~4,8), então dias fracos são compensados pelos dias de muito sol. O excedente vira <b>créditos</b> que cobrem a noite e os dias ruins.'], dica: 'O cliente paga pouco, mas nunca fica "sem energia": a rede continua conectada.' },
    { id: 'manut', kw: ['manutencao', 'limpeza', 'limpar', 'lavar', 'monitoramento', 'revisao'], title: 'Manutenção e limpeza', roles: null,
      b: ['Sistema sem partes móveis: manutenção simples. <b>Limpeza</b> 1 a 2 vezes ao ano (mais em locais com poeira, fuligem ou pássaros), com água e pano/escova macia, sem produtos químicos e fora das horas quentes.',
        'Acompanhe a geração pelo aplicativo do inversor e faça uma <b>inspeção anual</b> de conexões, string box e inversor.'], dica: 'Queda brusca de geração no app é o primeiro sinal de problema.' },
    { id: 'creditos', kw: ['credito', 'creditos', 'compensacao', 'compensar', 'excedente', 'taxa minima', 'custo de disponibilidade', 'autoconsumo remoto', 'geracao compartilhada'], title: 'Compensação de créditos', roles: null,
      b: ['A energia injetada além do consumo vira <b>créditos em kWh</b>, válidos por <b>60 meses</b>, que abatem a conta da mesma unidade ou de outras do mesmo titular (autoconsumo remoto) ou de um grupo (geração compartilhada).',
        'Sempre há o <b>custo de disponibilidade</b>: 30 kWh (monofásico), 50 kWh (bifásico) ou 100 kWh (trifásico) por mês, mais iluminação pública e a parcela do Fio B.'], dica: 'Por isso a conta nunca zera, mas costuma cair 85% a 95%.' },
    { id: 'tstring', kw: ['dimensionar strings', 'dimensionar string', 'string', 'strings', 'mppt', 'tensao maxima', 'voc', 'ligacao em serie', 'modulos por string', 'em serie'], title: 'Strings fotovoltaicas', roles: ['tecnico', 'dono', 'vendedor'],
      b: ['Módulos em <b>série</b> somam tensão; strings em <b>paralelo</b> somam corrente. A Voc a frio (menor temperatura local) multiplicada pelo nº de módulos <b>não pode passar da tensão máxima de entrada</b> do inversor.',
        'A tensão de operação (Vmp a quente) precisa ficar dentro da faixa MPPT. Mantenha strings de mesma orientação/inclinação no mesmo MPPT e respeite a corrente máxima por entrada.',
        'Exemplo: 550 W com Voc ~49,5 V; com inversor de 1000 V e correção de -10 °C (~+6%), o limite é de 16 módulos por string.'], dica: 'Sempre faça a conta pelo datasheet do módulo e do inversor.' },
    { id: 'tinversor', kw: ['inversor', 'relacao dc ac', 'fdi', 'clipping', 'oversizing', 'potencia do inversor', 'qual inversor'], title: 'Inversores', roles: ['tecnico', 'dono', 'vendedor'],
      b: ['Regra prática: potência CA do inversor entre <b>80% e 100% da potência dos módulos</b> (FDI 0,8-1,0; relação DC/AC de 1,0 a 1,3). Acima de 1,3 o clipping fica relevante.',
        '<b>String</b>: custo menor, ideal para telhado sem sombra. <b>Micro/otimizador</b>: melhor com sombra, orientações mistas e monitoramento por módulo.',
        'Confira se o modelo tem certificação INMETRO e homologação na concessionária.'], dica: 'Instale o inversor em local ventilado, protegido do sol direto e da chuva.' },
    { id: 'taterra', kw: ['aterramento', 'dps', 'haste', 'equipotencializacao', 'terra', 'spda', 'para raios', 'protecao contra surto'], title: 'Aterramento e proteções', roles: ['tecnico', 'dono', 'vendedor'],
      b: ['Aterre <b>estruturas metálicas e molduras dos módulos</b> (equipotencialização) com cabo adequado e conexão ao aterramento da instalação (NBR 5410 e NBR 16690).',
        'Use <b>DPS CC e CA</b> na string box e no quadro, disjuntores/chaves seccionadoras CC e CA e proteção de sobrecorrente.',
        'Meça a resistência de aterramento (referência ≤ 10 Ω) e registre na documentação.'], dica: 'Se houver SPDA, mantenha o distanciamento ou interligue conforme a NBR 5419.' },
    { id: 'tnr10', kw: ['nr10', 'nr 10', 'choque', 'loto', 'desenergizar', 'bloqueio e etiquetagem', 'seguranca eletrica', 'eletricidade'], title: 'NR-10', roles: ['tecnico', 'dono', 'vendedor'],
      b: ['A <b>NR-10</b> exige curso e reciclagem (a cada 2 anos) para trabalhar com eletricidade, procedimentos de trabalho e EPIs/EPCs adequados.',
        'Sequência de segurança: <b>seccionar, impedir reenergização (bloqueio e etiqueta), constatar ausência de tensão, aterrar temporariamente e sinalizar</b>.',
        'Lembre: o lado CC dos módulos continua energizado com luz solar, mesmo com a chave CA desligada.'], dica: 'Nunca desconecte conectores MC4 sob carga.' },
    { id: 'tnr35', kw: ['nr35', 'nr 35', 'altura', 'trabalho em altura', 'linha de vida', 'cinto', 'talabarte', 'epi', 'andaime', 'queda'], title: 'NR-35', roles: ['tecnico', 'dono', 'vendedor'],
      b: ['A <b>NR-35</b> vale para trabalho acima de 2 m com risco de queda: treinamento de 8 h e reciclagem a cada 2 anos, ASO válido e análise de risco (APR).',
        'Use cinto tipo paraquedista com talabarte duplo, trava-quedas em <b>linha de vida</b>, capacete com jugular e calçado antiderrapante. Isole a área no solo.',
        'Suspenda o trabalho com chuva, vento forte ou telhado molhado.'], dica: 'Faça o checklist de EPIs antes de subir.' }
  ];

  /* ---------- objeções ---------- */
  var OBJ = [
    { id: 'preco', kw: ['preco', 'caro', 'muito caro', 'valor alto', 'desconto', 'barato'], t: 'Está caro / preço alto',
      r: ['Reposicione de "gasto" para "investimento": a parcela do financiamento costuma ser <b>igual ou menor que a conta de luz atual</b>.', 'Mostre o payback (3 a 5 anos) e que o sistema rende por 25 anos; a energia só sobe de preço.', 'Ofereça alternativas: sistema menor, mais parcelas ou entrada reduzida em vez de dar desconto de cara.'],
      s: 'Entendo, {nome}. Hoje você paga cerca de R$ {conta} por mês e esse valor não volta. Com o sistema a parcela fica parecida com a conta, só que no fim você é dono da usina e em ~4 anos ela se paga. Posso simular em 60x ou 84x para ver como encaixa no seu bolso?' },
    { id: 'financ', kw: ['financiamento', 'financiar', 'nao tenho dinheiro', 'sem entrada', 'a vista', 'credito'], t: 'Não tem dinheiro / financiamento',
      r: ['Apresente o financiamento com carência (primeira parcela em até 90 dias) e prazo de 60 a 120 meses.', 'Compare a parcela com a conta atual: o fluxo costuma ficar positivo desde o primeiro mês.', 'Se o crédito for negado, tente outro banco, cônjuge como proponente ou cartão em 12x.'],
      s: 'Sem problema, {nome}. A maioria dos clientes financia justamente para não desembolsar nada agora. A parcela substitui a conta de luz, então o orçamento mensal praticamente não muda. Quer que eu simule 3 cenários para você escolher?' },
    { id: 'conf', kw: ['confianca', 'confiar', 'desconfia', 'golpe', 'empresa nova', 'seguro', 'referencia', 'garantia'], t: 'Falta de confiança',
      r: ['Mostre CNPJ, tempo de mercado, projetos entregues na mesma cidade e depoimentos em vídeo.', 'Ofereça visitar uma instalação concluída e fale das garantias (25 anos módulos, ~10 anos inversor).', 'Contrato claro, com cronograma e pagamento por etapas.'],
      s: 'Faz todo sentido ter cuidado, {nome}. Posso te passar 2 clientes da sua região que já estão gerando e, se quiser, te levo para ver a instalação funcionando. Tudo fica em contrato, com garantia por escrito.' },
    { id: 'prazo', kw: ['prazo', 'demora', 'quanto tempo leva', 'quando fica pronto', 'instalacao demora'], t: 'Prazo / demora',
      r: ['Explique as etapas: projeto (3-5 dias), instalação (1-3 dias) e homologação (30-60 dias).', 'Deixe claro que a obra é rápida; o prazo maior é da concessionária.', 'Quanto antes assinar, antes começa a economizar.'],
      s: 'A instalação em si leva de 1 a 3 dias, {nome}. O que leva mais é a aprovação da concessionária, de 30 a 60 dias, e a gente cuida de tudo. Se fecharmos esta semana, em cerca de 2 meses você já está gerando.' },
    { id: 'pensar', kw: ['vou pensar', 'pensar', 'preciso pensar', 'depois eu vejo', 'conversar com', 'esposa', 'marido', 'sem pressa', 'indeciso'], t: '"Vou pensar"',
      r: ['Descubra a dúvida real: "O que falta para você se sentir seguro?" (preço, prazo, confiança, decisão em família).', 'Marque um retorno com data e hora e ofereça participar de uma conversa com quem decide.', 'Crie urgência honesta: validade da proposta, reajuste de equipamentos e regras do Fio B.'],
      s: 'Claro, {nome}, é uma decisão importante. Para eu te ajudar da melhor forma: o que ainda ficou pendente, valores, prazo ou algo técnico? Posso te ligar quinta às 10h para tirar qualquer dúvida e, se quiser, falar também com quem decide junto.' },
    { id: 'conc', kw: ['concorrente', 'mais barato', 'outra empresa', 'orcamento mais barato', 'achei mais barato', 'outro orcamento'], t: 'Concorrente mais barato',
      r: ['Peça o orçamento do concorrente e compare item a item: marca e potência dos módulos, inversor, garantia, estrutura, mão de obra e pós-venda.', 'Diferencie por homologação inclusa, monitoramento, equipe própria e garantia de geração.', 'Evite entrar em guerra de preço: mostre custo total em 25 anos.'],
      s: 'Obrigado por compartilhar, {nome}. Se puder me enviar o orçamento, comparo ponto a ponto com você: marca dos módulos, inversor, garantia e quem faz a instalação e a homologação. Preço baixo demais costuma significar equipamento inferior ou serviço terceirizado.' }
  ];

  /* ---------- mensagens WhatsApp ---------- */
  function zapMsg(ctx, l) {
    var nome = first(l.nome), eu = first((ctx.user || {}).nome), t = ctx.t, p = propDe(l);
    if (/preco|caro|desconto|valor/.test(t)) return 'Oi ' + nome + ', tudo bem? Aqui é ' + eu + ', da Solar Prime. Pensei na sua conta de luz: com a parcela do financiamento você troca um gasto que não volta por um sistema que se paga em cerca de 4 anos. Posso te mostrar 3 opções de parcela hoje?';
    if (l.etapa === 'novo' || l.etapa === 'primeiro_contato') return 'Oi ' + nome + ', tudo bem? Sou ' + eu + ', da Solar Prime. Recebi seu interesse em reduzir a conta de luz. Se puder me enviar uma foto da conta, em poucos minutos te mostro quanto você economiza com energia solar. Pode ser?';
    if (p && (p.status === 'enviada' || p.status === 'visualizada')) return 'Oi ' + nome + ', tudo bem? Aqui é ' + eu + ', da Solar Prime. Passando para saber o que achou da proposta de ' + m$(p.valor) + ' (' + nf(p.potenciaKwp, 1) + ' kWp). Ficou alguma dúvida de valor, prazo ou instalação? Se preferir, te ligo agora para explicar.';
    if (l.etapa === 'contrato_enviado') return 'Oi ' + nome + ', tudo bem? ' + eu + ' aqui, da Solar Prime. Seu contrato já está disponível para assinatura. Se tiver qualquer dúvida em alguma cláusula, me chama que resolvo agora para a gente já reservar sua data de instalação.';
    if (l.etapa === 'perdido') return 'Oi ' + nome + ', tudo bem? Aqui é ' + eu + ', da Solar Prime. Faz um tempo que conversamos e as condições de financiamento melhoraram. Quer que eu refaça sua simulação sem compromisso?';
    return 'Oi ' + nome + ', tudo bem? Aqui é ' + eu + ', da Solar Prime. Estou acompanhando seu projeto de energia solar e queria saber se posso ajudar em algo. Quando fica bom falarmos 5 minutinhos?';
  }
  function proximaAcao(l) {
    var d = idleDays(l), p = propDe(l);
    if (l.etapa === 'novo' && !(l.interacoes || []).length) return 'Fazer o primeiro contato agora (resposta em até 5 minutos dobra a chance de conversão).';
    if (l.etapa === 'novo' || l.etapa === 'primeiro_contato') return 'Qualificar: pedir a conta de luz, tipo de telhado e se pretende financiar.';
    if (l.etapa === 'qualificacao') return 'Agendar a visita técnica / análise técnica e levantar o consumo real.';
    if (l.etapa === 'analise_tecnica') return 'Finalizar o dimensionamento e enviar a proposta em até 48 horas.';
    if (l.etapa === 'proposta_enviada') return d > 3 ? 'Ligar hoje: a proposta está sem retorno há ' + d + ' dias. Depois reforçar por WhatsApp.' : 'Follow-up em 24-48 horas após o envio e oferecer simulação de financiamento.';
    if (l.etapa === 'negociacao') return 'Tratar a objeção principal' + ((l.objecoes || []).length ? ' (' + e(l.objecoes[0]) + ')' : '') + ' e propor condição de fechamento com prazo.';
    if (l.etapa === 'contrato_enviado') return 'Cobrar a assinatura do contrato e confirmar forma de pagamento.';
    if (l.etapa === 'perdido') return 'Reativar em 60 a 90 dias com nova simulação' + (l.motivoPerda ? ' (motivo: ' + e(l.motivoPerda) + ')' : '') + '.';
    if (p && aceita(p)) return 'Acompanhar a obra e a homologação; pedir indicação após a geração iniciar.';
    return 'Acompanhar a obra e o pós-venda; pedir indicação.';
  }

  /* ---------- intents ---------- */
  var ALL = ['dono', 'vendedor', 'tecnico', 'financeiro', 'trafego'];
  var INTENTS = [];
  function I(id, roles, kw, fn, opt) { INTENTS.push({ id: id, roles: roles || ALL, kw: kw, fn: fn, lead: opt && opt.lead, num: opt && opt.num }); }

  I('saudacao', ALL, ['oi', 'ola', 'e ai', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'opa'], function (ctx) {
    return [B.p('Olá, ' + e(first(ctx.user.nome)) + '! Como posso ajudar? Veja algumas ideias abaixo.'), B.a(sugestoes(ctx.role).slice(0, 4).map(function (s) { return Aask(s); }))];
  });
  I('obrigado', ALL, ['obrigado', 'obrigada', 'valeu', 'brigadao', 'show', 'perfeito'], function () { return [B.p('Disponha! Se precisar de mais alguma coisa, é só perguntar.')]; });
  I('ajuda', ALL, ['ajuda', 'o que voce faz', 'o que voce sabe', 'como funciona', 'comandos', 'help', 'o que posso perguntar'], function (ctx) {
    return [B.p('Eu consulto os dados do sistema <b>em tempo real</b> e respondo de acordo com o seu perfil (' + e(C.PAPEIS[ctx.role] || ctx.role) + '). Você pode perguntar, por exemplo:'),
      B.l(sugestoes(ctx.role).slice(0, 8).map(function (s) { return e(s); })), B.p('Dica: cite o nome de um lead, um período (hoje, semana, mês) ou valores como "600 kWh".')];
  });

  /* Dono / gestão */
  I('resumo_hoje', ['dono'], ['resumo da empresa', 'resumo do dia', 'resumo de hoje', 'resumo geral', 'como estamos', 'como esta a empresa', 'panorama', 'visao geral', 'briefing', 'bom dia', 'o que preciso saber', 'resumo'], function (ctx) {
    var ls = S.visibleLeads(), ids = idMap(ls), mes = mkPer('mes'), hoje = mkPer('hoje');
    var cs = contratosAss(mes, ids), fat = sum(cs, function (c) { return c.valor; });
    var neg = sum(ls.filter(function (l) { return C.EM_NEGOCIACAO.indexOf(l.etapa) >= 0; }), function (l) { return l.valorEstimado || 0; });
    var sem = ls.filter(function (l) { return l.etapa === 'novo' && !(l.interacoes || []).length; });
    var atras = S.collection('lancamentos').filter(function (x) { return x.tipo === 'receber' && x.status === 'atrasado'; });
    var ob = S.collection('obras').filter(function (o) { return obraAtraso(o) > 0; });
    var est = S.collection('estoque').filter(function (x) { return x.qtd - x.reservado < x.min; });
    var parados = ls.filter(function (l) { return isOpen(l) && idleDays(l) > 3; }).length;
    var out = [B.p('Resumo da <b>Solar Prime</b> em ' + e(ui.fmtDate(new Date().toISOString())) + ':'),
      B.k([K('Leads hoje', ls.filter(function (l) { return T(l.criadoEm) >= hoje.start; }).length, 'blue'), K('Leads no mês', ls.filter(function (l) { return T(l.criadoEm) >= mes.start; }).length, 'blue'),
        K('Vendido no mês', mc$(fat), 'green'), K('Em negociação', mc$(neg), 'amber'), K('Sem atendimento', sem.length, sem.length ? 'red' : 'green'), K('Obras atrasadas', ob.length, ob.length ? 'red' : 'green')])];
    var at = [];
    if (sem.length) at.push('<b>' + sem.length + '</b> lead(s) novo(s) ainda sem atendimento.');
    if (parados) at.push('<b>' + parados + '</b> lead(s) parado(s) há mais de 3 dias.');
    if (atras.length) at.push('<b>' + atras.length + '</b> recebimento(s) atrasado(s) somando ' + m$(sum(atras, function (x) { return x.valor; })) + '.');
    if (ob.length) at.push('<b>' + ob.length + '</b> obra(s) com etapa atrasada.');
    if (est.length) at.push('<b>' + est.length + '</b> item(ns) de estoque abaixo do mínimo.');
    out.push(at.length ? B.p('<b>Atenção hoje:</b>') : B.p('Tudo em dia, sem pendências críticas.'));
    if (at.length) out.push(B.l(at));
    out.push(B.a([Aopen('#/leads', 'Ver leads'), Aopen('#/financeiro', 'Ver financeiro'), Aopen('#/obras', 'Ver obras')]));
    return out;
  });
  I('leads_periodo', ['dono', 'vendedor', 'trafego', 'financeiro'], ['quantos leads', 'leads entraram', 'novos leads', 'leads novos', 'leads recebidos', 'leads por canal', 'leads da semana', 'leads do mes', 'entrada de leads', 'captacao', 'chegaram', 'entraram', 'leads por cidade', 'leads em', 'leads'], function (ctx) {
    var per = ctx.per || mkPer('mes'), base = scopeLeads(ctx, S.visibleLeads()), ls = base.filter(function (l) { return T(l.criadoEm) >= per.start; });
    var by = {}; ls.forEach(function (l) { by[l.origem] = (by[l.origem] || 0) + 1; });
    var rows = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (k) { return [e(k), by[k], nf(pct(by[k], ls.length), 0) + '%']; });
    var out = [B.p('Entraram <b>' + ls.length + ' lead(s)</b> ' + e(per.label) + scopeNote(ctx) + (ctx.role === 'vendedor' ? ' na sua carteira' : '') + '.'),
      B.k([K('Leads ' + per.label, ls.length, 'blue'), K('Já atendidos', ls.filter(function (l) { return (l.interacoes || []).length; }).length, 'green'), K('Sem atendimento', ls.filter(function (l) { return !(l.interacoes || []).length; }).length, 'red')])];
    if (rows.length) out.push(B.t(['Canal', 'Leads', '%'], rows));
    out.push(B.a([Aopen('#/leads', 'Abrir leads'), Aask('conversão ' + per.label, 'Ver conversão')]));
    return out;
  });
  I('conversao', ['dono', 'vendedor', 'trafego'], ['conversao', 'taxa de conversao', 'convers*', 'converte', 'conversoes'], function (ctx) {
    var per = ctx.per || mkPer('mes'), base = scopeLeads(ctx, S.visibleLeads()), ids = idMap(base);
    var ls = base.filter(function (l) { return T(l.criadoEm) >= per.start; }), cs = contratosAss(per, ids), conv = pct(cs.length, ls.length);
    var by = {}; C.ORIGENS.forEach(function (o) { by[o] = { l: 0, v: 0 }; });
    ls.forEach(function (l) { if (by[l.origem]) by[l.origem].l++; });
    cs.forEach(function (c) { var l = ids[c.leadId]; if (l && by[l.origem]) by[l.origem].v++; });
    var rows = Object.keys(by).filter(function (k) { return by[k].l; }).sort(function (a, b) { return pct(by[b].v, by[b].l) - pct(by[a].v, by[a].l); }).map(function (k) { return [e(k), by[k].l, by[k].v, nf(pct(by[k].v, by[k].l), 1) + '%']; });
    return [B.p('Taxa de conversão ' + e(per.label) + scopeNote(ctx) + ': <b>' + nf(conv, 1) + '%</b> (' + cs.length + ' venda(s) para ' + ls.length + ' lead(s)).'),
      B.k([K('Conversão', nf(conv, 1) + '%', tone(conv, 15, 5)), K('Vendas', cs.length, 'green'), K('Leads', ls.length, 'blue')]), B.t(['Canal', 'Leads', 'Vendas', 'Conversão'], rows),
      B.n('Referência do setor: 10% a 20% sobre leads qualificados.')];
  });
  I('faturamento', ['dono', 'vendedor', 'financeiro'], ['faturamento', 'faturei', 'faturamos', 'quanto vendemos', 'quanto vendi', 'vendas fechadas', 'vendido', 'vendi', 'total vendido', 'quanto fechamos', 'vendas do mes', 'vendas'], function (ctx) {
    var per = ctx.per || mkPer('mes'), ids = idMap(scopeLeads(ctx, S.visibleLeads())), cs = contratosAss(per, ids), fat = sum(cs, function (c) { return c.valor; });
    var out = [B.p('Faturamento vendido ' + e(per.label) + scopeNote(ctx) + ': <b>' + m$(fat) + '</b> em ' + cs.length + ' contrato(s) assinado(s).'),
      B.k([K('Vendido', mc$(fat), 'green'), K('Contratos', cs.length, 'blue'), K('Ticket médio', mc$(cs.length ? fat / cs.length : 0), 'amber')])];
    if (ctx.role === 'dono' && !ctx.vend) out.push(B.t(['Vendedor', 'Vendas', 'Valor'], vendStats(per).map(function (r) { return [e(first(r.u.nome)), r.vendas, mc$(r.fat)]; })));
    out.push(B.a([Aopen('#/contratos', 'Ver contratos'), Aask('ranking de vendedores ' + per.label, 'Ver ranking')]));
    return out;
  });
  I('ticket', ['dono', 'vendedor', 'financeiro'], ['ticket medio', 'ticket', 'valor medio', 'valor medio das vendas'], function (ctx) {
    var per = ctx.per || mkPer('mes'), ids = idMap(scopeLeads(ctx, S.visibleLeads())), cs = contratosAss(per, ids), fat = sum(cs, function (c) { return c.valor; });
    var kwp = sum(cs, function (c) { var p = S.find('propostas', c.propostaId); return p ? p.potenciaKwp : 0; });
    return [B.p('O ticket médio ' + e(per.label) + scopeNote(ctx) + ' é <b>' + m$(cs.length ? fat / cs.length : 0) + '</b> (' + cs.length + ' venda(s)).'),
      B.k([K('Ticket médio', mc$(cs.length ? fat / cs.length : 0), 'amber'), K('R$/kWp vendido', kwp ? m$(fat / kwp) : '-', 'blue'), K('kWp vendidos', nf(kwp, 1), 'green')])];
  });
  I('negociacao', ['dono', 'vendedor'], ['em negociacao', 'valor em negociacao', 'pipeline', 'funil de vendas', 'dinheiro na mesa', 'oportunidades abertas', 'negociacao'], function (ctx) {
    var ls = scopeLeads(ctx, S.visibleLeads()).filter(function (l) { return C.EM_NEGOCIACAO.indexOf(l.etapa) >= 0; });
    var rows = C.EM_NEGOCIACAO.map(function (id) { var x = ls.filter(function (l) { return l.etapa === id; }); return [e(etNome(id)), x.length, m$(sum(x, function (l) { return l.valorEstimado || 0; }))]; });
    var tot = sum(ls, function (l) { return l.valorEstimado || 0; });
    var top = ls.slice().sort(function (a, b) { return (b.valorEstimado || 0) - (a.valorEstimado || 0); }).slice(0, 4);
    return [B.p('Há <b>' + m$(tot) + '</b> em negociação' + scopeNote(ctx) + ', distribuídos em ' + ls.length + ' lead(s).'), B.k([K('Em negociação', mc$(tot), 'amber'), K('Leads', ls.length, 'blue')]),
      B.t(['Etapa', 'Leads', 'Valor'], rows), B.p('Maiores oportunidades: ' + top.map(function (l) { return lk(l) + ' (' + mc$(l.valorEstimado || 0) + ')'; }).join(', ') + '.'), B.a([Aopen('#/funil', 'Abrir funil')])];
  });
  I('ranking', ['dono', 'vendedor'], ['ranking', 'ranking de vendedores', 'vendedores', 'desempenho da equipe', 'equipe de vendas', 'placar', 'ranking da equipe', 'metas', 'equipe'], function (ctx) {
    var per = ctx.per || mkPer('mes'), st = vendStats(per);
    return [B.p('Ranking de vendas ' + e(per.label) + ':'), B.t(['#', 'Vendedor', 'Leads', 'Vendas', 'Valor', 'Conversão', 'Meta'], st.map(function (r, i) {
      var me = r.u.id === ctx.uid;
      return [i + 1, (me ? '<b>' + e(first(r.u.nome)) + ' (você)</b>' : e(first(r.u.nome))), r.leads, r.vendas, mc$(r.fat), nf(r.conv, 0) + '%', r.pm == null ? '-' : nf(r.pm, 0) + '%'];
    })), B.a([Aopen('#/metas', 'Ver metas e ranking')])];
  });
  I('pior_melhor', ['dono'], ['quem esta pior', 'quem esta melhor', 'pior vendedor', 'melhor vendedor', 'quem vende mais', 'quem vende menos', 'quem mais vendeu', 'quem menos vendeu', 'destaque da equipe', 'quem esta atras', 'pior desempenho', 'melhor desempenho', 'pior', 'melhor'], function (ctx) {
    var per = ctx.per || mkPer('mes'), st = vendStats(per), best = st[0], worst = st[st.length - 1];
    var idleV = st.map(function (r) { return { u: r.u, n: S.collection('leads').filter(function (l) { return l.vendedorId === r.u.id && isOpen(l) && idleDays(l) > 3; }).length }; }).sort(function (a, b) { return b.n - a.n; })[0];
    return [B.p('Melhor desempenho ' + e(per.label) + ': <b>' + e(best.u.nome) + '</b> com ' + mc$(best.fat) + ' (' + best.vendas + ' venda(s), conversão ' + nf(best.conv, 0) + '%).'),
      B.p('Mais atrás: <b>' + e(worst.u.nome) + '</b> com ' + mc$(worst.fat) + ' (' + worst.vendas + ' venda(s), conversão ' + nf(worst.conv, 0) + '%).'),
      B.p('Quem mais acumula leads parados (mais de 3 dias): <b>' + e(first(idleV.u.nome)) + '</b> (' + idleV.n + ').'),
      B.t(['Vendedor', 'Valor', 'Vendas', 'Meta'], st.map(function (r) { return [e(first(r.u.nome)), mc$(r.fat), r.vendas, r.pm == null ? '-' : nf(r.pm, 0) + '%']; })),
      B.n('Sugestão: faça uma conversa de acompanhamento com ' + e(first(worst.u.nome)) + ' e revise os leads parados.'), B.a([Aopen('#/metas', 'Ver metas')])];
  });
  I('sem_atendimento', ['dono', 'vendedor'], ['sem atendimento', 'nao atendidos', 'sem contato', 'nao respondidos', 'ninguem atendeu', 'leads sem resposta', 'sem primeiro contato', 'esperando atendimento', 'sem resposta'], function (ctx) {
    var ls = scopeLeads(ctx, S.visibleLeads()).filter(function (l) { return l.etapa === 'novo' && !(l.interacoes || []).length; }).sort(function (a, b) { return T(a.criadoEm) - T(b.criadoEm); });
    if (!ls.length) return [B.p('Nenhum lead sem atendimento' + scopeNote(ctx) + '. Tudo respondido!'), B.a([Aopen('#/leads', 'Abrir leads')])];
    return [B.p('<b>' + ls.length + ' lead(s)</b> novo(s) sem nenhum contato' + scopeNote(ctx) + '. Os mais antigos primeiro:'), B.t(['Lead', 'Origem', 'Vendedor', 'Chegou'], ls.slice(0, 8).map(function (l) {
      var v = S.user(l.vendedorId); return [lk(l), e(l.origem), e(v ? first(v.nome) : '-'), e(ui.timeAgo(l.criadoEm))];
    })), B.a([Aopen('#/leads', 'Abrir leads'), Aask('quem devo ligar primeiro', 'Priorizar ligações')])];
  });
  I('leads_parados', ['dono', 'vendedor'], ['leads parados', 'parados', 'esquecidos', 'sem movimento', 'abandonados', 'sem interacao'], function (ctx) {
    var ls = scopeLeads(ctx, S.visibleLeads()).filter(function (l) { return isOpen(l) && idleDays(l) > 3; }).sort(function (a, b) { return idleDays(b) - idleDays(a); });
    return [B.p('<b>' + ls.length + ' lead(s)</b> abertos estão há mais de 3 dias sem contato' + scopeNote(ctx) + ':'), B.t(['Lead', 'Etapa', 'Parado há', 'Valor'], ls.slice(0, 8).map(function (l) { return [lk(l), e(etNome(l.etapa)), idleDays(l) + ' dias', mc$(l.valorEstimado || 0)]; })), B.a([Aopen('#/leads', 'Abrir leads')])];
  });
  I('tempo_resposta', ['dono', 'vendedor'], ['tempo de resposta', 'primeira resposta', 'tempo medio', 'demora para responder', 'velocidade de atendimento', 'sla', 'tempo de atendimento'], function (ctx) {
    var per = ctx.per || mkPer('mes'), ls = S.visibleLeads().filter(function (l) { return T(l.criadoEm) >= per.start && l.primeiraRespostaMin != null; });
    var avg = ls.length ? sum(ls, function (l) { return l.primeiraRespostaMin; }) / ls.length : null, rows = [];
    var vs = ctx.role === 'vendedor' ? [S.user(ctx.uid)] : S.vendedores();
    vs.forEach(function (u) { var x = ls.filter(function (l) { return l.vendedorId === u.id; }); if (x.length) { var a = sum(x, function (l) { return l.primeiraRespostaMin; }) / x.length; rows.push([e(first(u.nome)), x.length, ui.fmtDuration(a), a > 60 ? '<span class="as-chip as-red">acima de 1h</span>' : '<span class="as-chip as-green">ok</span>']); } });
    return [B.p('Tempo médio de 1ª resposta ' + e(per.label) + ': <b>' + e(ui.fmtDuration(avg)) + '</b> (' + ls.length + ' lead(s) respondido(s)).'), B.k([K('Tempo médio', ui.fmtDuration(avg), avg != null && avg > 60 ? 'red' : 'green')]),
      B.t(['Vendedor', 'Leads', 'Tempo médio', 'Status'], rows), B.n('Meta recomendada: responder em até 5 a 15 minutos. Depois de 1 hora a chance de venda cai drasticamente.')];
  });
  I('motivos_perda', ['dono', 'vendedor', 'trafego'], ['motivos de perda', 'motivo de perda', 'por que perdemos', 'porque perdemos', 'leads perdidos', 'vendas perdidas', 'perdidos', 'perdemos', 'perda', 'perdi'], function (ctx) {
    var ls = scopeLeads(ctx, S.visibleLeads()).filter(function (l) { return l.etapa === 'perdido'; }), by = {};
    ls.forEach(function (l) { var k = l.motivoPerda || 'Sem motivo'; by[k] = by[k] || { n: 0, v: 0 }; by[k].n++; by[k].v += l.valorEstimado || 0; });
    var ks = Object.keys(by).sort(function (a, b) { return by[b].n - by[a].n; });
    if (!ks.length) return [B.p('Nenhum lead perdido' + scopeNote(ctx) + '.')];
    return [B.p('<b>' + ls.length + ' lead(s)</b> perdidos' + scopeNote(ctx) + ', cerca de ' + m$(sum(ls, function (l) { return l.valorEstimado || 0; })) + ' em oportunidades. O principal motivo é <b>' + e(ks[0]) + '</b>.'),
      B.t(['Motivo', 'Leads', '%', 'Valor perdido'], ks.map(function (k) { return [e(k), by[k].n, nf(pct(by[k].n, ls.length), 0) + '%', mc$(by[k].v)]; })), B.n('Atacar o motivo no topo da lista é o jeito mais rápido de recuperar vendas.'), B.a([Aopen('#/leads', 'Ver leads')])];
  });
  I('previsao', ['dono', 'vendedor'], ['previsao de fechamento', 'previsao', 'forecast', 'quanto vou fechar', 'quanto vamos fechar', 'projecao de vendas', 'prever', 'fechar este mes', 'projecao'], function (ctx) {
    var W = { analise_tecnica: 0.15, proposta_enviada: 0.3, negociacao: 0.5, contrato_enviado: 0.8 }, ls = scopeLeads(ctx, S.visibleLeads()), tot = 0, rows = [], max = 0;
    Object.keys(W).forEach(function (id) { var x = ls.filter(function (l) { return l.etapa === id; }), v = sum(x, function (l) { return l.valorEstimado || 0; }); tot += v * W[id]; max += v; rows.push([e(etNome(id)), x.length, mc$(v), nf(W[id] * 100, 0) + '%', mc$(v * W[id])]); });
    var jaV = sum(contratosAss(mkPer('mes'), idMap(ls)), function (c) { return c.valor; });
    return [B.p('Previsão ponderada por etapa' + scopeNote(ctx) + ': <b>' + m$(tot) + '</b> a fechar nas próximas semanas, além dos ' + m$(jaV) + ' já vendidos no mês.'),
      B.k([K('Previsão ponderada', mc$(tot), 'green'), K('Melhor cenário', mc$(max), 'blue'), K('Vendido no mês', mc$(jaV), 'amber')]),
      B.t(['Etapa', 'Leads', 'Valor', 'Prob.', 'Esperado'], rows), B.n('Probabilidades de referência por etapa; ajuste conforme seu histórico de conversão.')];
  });
  I('campanha_vende', ['dono', 'trafego'], ['campanha que mais vende', 'melhor campanha', 'campanha vende', 'campanha mais', 'qual campanha', 'campanhas que vendem', 'canal que mais vende', 'origem que mais vende', 'campanhas'], function (ctx) {
    var st = campStats().sort(function (a, b) { return b.fat - a.fat; });
    return [B.p('A campanha que mais vendeu é <b>' + e(st[0].c.nome) + '</b>: ' + st[0].vendas + ' venda(s), ' + m$(st[0].fat) + ' e ROAS de ' + nf(st[0].roas, 1) + 'x.'),
      B.t(['Campanha', 'Leads', 'Vendas', 'Vendido', 'ROAS'], st.map(function (r) { return [e(r.c.nome), r.leads, r.vendas, mc$(r.fat), nf(r.roas, 1) + 'x']; })), B.a([Aopen('#/marketing', 'Abrir Marketing & Tráfego')])];
  });
  I('cac_roas', ['dono', 'trafego'], ['cac', 'roas', 'retorno sobre anuncio', 'retorno do investimento', 'custo por venda', 'custo de aquisicao', 'roi', 'retorno dos anuncios'], function (ctx) {
    var st = campStats(), inv = sum(st, function (r) { return r.c.investimento; }), fat = sum(st, function (r) { return r.fat; }), v = sum(st, function (r) { return r.vendas; }), l = sum(st, function (r) { return r.leads; });
    return [B.p('Considerando todas as campanhas: ROAS <b>' + nf(pct(fat, inv) / 100, 1) + 'x</b> e CAC de <b>' + m$(v ? inv / v : 0) + '</b> por venda.'),
      B.k([K('Investimento', mc$(inv), 'amber'), K('Vendido (origem anúncio)', mc$(fat), 'green'), K('ROAS', nf(inv ? fat / inv : 0, 1) + 'x', tone(inv ? fat / inv : 0, 4, 1.5)), K('CAC', mc$(v ? inv / v : 0), 'red'), K('CPL', m$(l ? inv / l : 0), 'blue')]),
      B.t(['Campanha', 'Invest.', 'Vendas', 'CAC', 'ROAS'], st.slice().sort(function (a, b) { return b.roas - a.roas; }).map(function (r) { return [e(r.c.nome), mc$(r.c.investimento), r.vendas, r.vendas ? mc$(r.cac) : '-', nf(r.roas, 1) + 'x']; })), B.a([Aopen('#/marketing', 'Abrir Marketing & Tráfego')])];
  });
  I('obras_atrasadas', ['dono', 'tecnico'], ['obras atrasadas', 'obra atrasada', 'atraso nas obras', 'atraso de obra', 'obras em atraso', 'prazo das obras', 'atrasos', 'atrasadas'], function (ctx) {
    var os = minhasObras(ctx).map(function (o) { return { o: o, d: obraAtraso(o) }; }).filter(function (x) { return x.d > 0; }).sort(function (a, b) { return b.d - a.d; });
    if (!os.length) return [B.p('Nenhuma obra atrasada. Cronograma em dia.'), B.a([Aopen('#/obras', 'Ver obras')])];
    return [B.p('<b>' + os.length + ' obra(s)</b> com etapa atrasada. A mais crítica está ' + os[0].d + ' dia(s) fora do prazo.'), B.t(['Obra', 'Cliente', 'Etapa atual', 'Atraso'], os.slice(0, 8).map(function (x) {
      var l = S.lead(x.o.leadId), a = obraAtual(x.o); return ['<a href="#/obras">' + e(x.o.id.toUpperCase()) + '</a>', l ? lk(l) : '-', e(a ? etapaObraNome(a.id) : '-'), x.d + ' dias'];
    })), B.a([Aopen('#/obras', 'Abrir obras')])];
  });
  I('estoque_baixo', ['dono', 'tecnico'], ['estoque baixo', 'estoque', 'falta de material', 'material acabando', 'reposicao', 'repor', 'comprar material', 'itens em falta', 'em falta'], function () {
    var it = S.collection('estoque').filter(function (x) { return x.qtd - x.reservado < x.min; }).sort(function (a, b) { return (a.qtd - a.reservado - a.min) - (b.qtd - b.reservado - b.min); });
    if (!it.length) return [B.p('Estoque saudável: nenhum item abaixo do mínimo.'), B.a([Aopen('#/estoque', 'Ver estoque')])];
    return [B.p('<b>' + it.length + ' item(ns)</b> abaixo do estoque mínimo (considerando reservas):'), B.t(['Item', 'Disponível', 'Mínimo', 'Comprar'], it.slice(0, 8).map(function (x) { var d = x.qtd - x.reservado; return [e(x.nome), d, x.min, '<b>' + Math.max(1, x.min - d) + '</b> ' + e(x.unidade || '')]; })),
      B.n('Estimativa de reposição: ' + m$(sum(it, function (x) { return Math.max(1, x.min - (x.qtd - x.reservado)) * (x.custo || 0); }))), B.a([Aopen('#/estoque', 'Abrir estoque')])];
  });

  /* Lead */
  I('lead_info', ['dono', 'vendedor', 'tecnico', 'financeiro'], ['o que acontece com', 'o que esta acontecendo com', 'como esta o lead', 'resumo do lead', 'resumo do cliente', 'status do lead', 'status do cliente', 'situacao do lead', 'lead', 'cliente', 'sobre o lead', 'proxima acao', 'proximo passo', 'historico de', 'me fale sobre', 'informacoes do', 'como esta o'], function (ctx) {
    var l = ctx.lead;
    if (!l) {
      if (ctx.cands.length) return [B.p('Encontrei mais de um lead com esse nome. Qual deles?'), B.a(ctx.cands.map(function (c) { return Aask('resumo do lead ' + c.nome, c.nome + ' (' + String(c.cidade).split(' - ')[0] + ')'); }))];
      return [B.p('Não localizei esse lead entre os que você pode ver. Diga o nome (ou parte dele), por exemplo: <b>"o que acontece com o lead João Batista"</b>.'),
        B.a(S.visibleLeads().filter(isOpen).sort(function (a, b) { return (b.score || 0) - (a.score || 0); }).slice(0, 3).map(function (x) { return Aask('resumo do lead ' + x.nome, x.nome); }))];
    }
    var v = S.user(l.vendedorId), p = propDe(l), tars = S.collection('tarefas').filter(function (t) { return t.leadId === l.id && !t.concluida; }), ob = obraDe(l), ult = (l.interacoes || []).slice().sort(function (a, b) { return T(b.em) - T(a.em); })[0];
    var out = [B.p('<b>' + lk(l) + '</b> · ' + e(etNome(l.etapa)) + ' · ' + e(l.cidade) + (v ? ' · vendedor(a) ' + e(first(v.nome)) : '') + '.'),
      B.k([K('Score', l.score || 0, tone(l.score || 0, 70, 40)), K('Consumo', nf(l.consumoKwh, 0) + ' kWh', 'blue'), K('Valor estimado', mc$(l.valorEstimado || 0), 'green'), K('Sem contato', idleDays(l) + ' d', idleDays(l) > 3 ? 'red' : 'green')])];
    var det = ['Origem: ' + e(l.origem) + (l.campanha ? ' (' + e(l.campanha) + ')' : ''), 'Conta: ' + m$(l.valorConta) + ' · telhado ' + e(l.tipoTelhado || '-') + ' · ' + nf(l.areaM2, 0) + ' m²'];
    if (p) det.push('Proposta ' + e(p.numero) + ': ' + m$(p.valor) + ' · ' + nf(p.potenciaKwp, 1) + ' kWp · ' + e(p.status));
    if (ult) det.push('Última interação (' + e(ui.timeAgo(ult.em)) + '): ' + e(ult.texto));
    if (tars.length) det.push('Tarefas abertas: ' + tars.slice(0, 2).map(function (t) { return e(t.titulo); }).join('; '));
    if (ob) det.push('Obra ' + e(ob.id.toUpperCase()) + ': ' + (obraAtual(ob) ? 'etapa ' + e(etapaObraNome(obraAtual(ob).id)) : 'concluída'));
    if (l.etapa === 'perdido' && l.motivoPerda) det.push('Motivo da perda: ' + e(l.motivoPerda));
    out.push(B.l(det), B.p('<b>Próxima ação sugerida:</b> ' + proximaAcao(l)));
    var ac = [Aopen('#/leads/' + l.id, 'Abrir lead'), { l: 'Criar tarefa de follow-up', act: 'task', d: { leadId: l.id, titulo: 'Follow-up com ' + l.nome } }, Aask('mensagem de whatsapp para ' + l.nome, 'Mensagem de WhatsApp')];
    if (ob) ac.push(Aopen('#/obras', 'Ver obra')); else ac.push(Aopen('#/propostas', 'Gerar proposta'));
    out.push(B.a(ac));
    return out;
  }, { lead: true });

  /* Vendedor */
  I('meus_leads_hoje', ['vendedor', 'dono'], ['meus leads', 'quem ligar', 'quem devo ligar', 'por onde comecar', 'prioridade', 'prioridades', 'o que fazer hoje', 'meu dia', 'foco de hoje', 'quem contatar', 'quem atender', 'ligar primeiro', 'leads quentes', 'leads prioritarios', 'resumo do dia', 'minha agenda', 'leads de hoje'], function (ctx) {
    var tars = S.collection('tarefas').filter(function (t) { return !t.concluida && (ctx.role === 'dono' || t.responsavelId === ctx.uid); });
    var venc = {}; tars.forEach(function (t) { if (T(t.vencimento) < Date.now() + DAY) venc[t.leadId] = true; });
    var ls = scopeLeads(ctx, S.visibleLeads()).filter(isOpen).map(function (l) {
      var w = { novo: 20, primeiro_contato: 12, qualificacao: 10, analise_tecnica: 14, proposta_enviada: 22, negociacao: 26, contrato_enviado: 30 }[l.etapa] || 5;
      return { l: l, pr: (l.score || 0) * 0.5 + Math.min(idleDays(l), 10) * 5 + w + (venc[l.id] ? 15 : 0) };
    }).sort(function (a, b) { return b.pr - a.pr; });
    var top = ls.slice(0, 6), hoje = tars.filter(function (t) { return T(t.vencimento) < Date.now() + DAY; });
    var out = [B.p('Para ' + (ctx.role === 'dono' ? 'a equipe, comece' : 'hoje, comece') + ' por <b>' + (top[0] ? lk(top[0].l) : '-') + '</b>. A ordem leva em conta score, tempo sem contato, etapa e tarefas vencidas:'),
      B.k([K('Leads abertos', ls.length, 'blue'), K('Tarefas para hoje', hoje.length, hoje.length ? 'amber' : 'green'), K('Parados > 3 dias', ls.filter(function (x) { return idleDays(x.l) > 3; }).length, 'red')]),
      B.t(['#', 'Lead', 'Etapa', 'Score', 'Parado há', 'Ação'], top.map(function (x, i) { return [i + 1, lk(x.l), e(etNome(x.l.etapa)), x.l.score || 0, idleDays(x.l) + ' d', e(proximaAcao(x.l).split(/[.:(]/)[0])]; }))];
    if (top[0]) out.push(B.a([Aopen('#/leads/' + top[0].l.id, 'Abrir ' + first(top[0].l.nome)), Aask('mensagem de whatsapp para ' + top[0].l.nome, 'Mensagem pronta'), Aopen('#/agenda', 'Ver agenda')]));
    return out;
  });
  I('objecoes', ['vendedor', 'dono'], ['objecao', 'objecoes', 'cliente falou', 'cliente disse', 'cliente acha', 'cliente quer pensar', 'vou pensar', 'esta caro', 'muito caro', 'achou caro', 'mais barato', 'concorrente', 'nao confia', 'desconfia*', 'contornar', 'como responder', 'quebrar objecao', 'preco alto', 'nao tenho dinheiro', 'demora muito'], function (ctx) {
    var sc = OBJ.map(function (o) { var s = 0; o.kw.forEach(function (k) { if (hasPhrase(ctx.t, k)) s += 1 + k.split(' ').length; }); return { o: o, s: s }; }).sort(function (a, b) { return b.s - a.s; });
    var l = ctx.lead, nome = l ? first(l.nome) : 'cliente';
    if (!sc[0].s) return [B.p('As objeções mais comuns e como contornar. Escolha uma:'), B.a(OBJ.map(function (o) { return Aask('como contornar: ' + o.t, o.t); }))];
    var o = sc[0].o;
    return [B.p('<b>Objeção: ' + e(o.t) + '</b>. Como contornar:'), B.l(o.r), B.p('<b>Script sugerido:</b>'), B.m(o.s.replace('{nome}', nome).replace('{conta}', l ? nf(l.valorConta, 0) : '600')),
      B.a([Aask('simular financiamento', 'Simular financiamento'), Aask('mensagem de whatsapp ' + (l ? 'para ' + l.nome : 'follow up'), 'Mensagem de WhatsApp')])];
  }, { lead: true });
  I('dimensionar', ['vendedor', 'dono', 'tecnico'], ['dimensionar', 'dimensionamento', 'quantos modulos', 'quantas placas', 'quantos paineis', 'kwp', 'sistema para', 'tamanho do sistema', 'que sistema', 'quantos kwp', 'kwh', 'potencia necessaria', 'quanto gera', 'geracao', 'consumo de', 'conta de'], function (ctx) {
    var n = ctx.nums, l = ctx.lead, kwh = n.kwh, tarifa = 0.95;
    if (kwh == null && n.valor != null && /conta|luz/.test(ctx.t)) kwh = n.valor / tarifa;
    if (kwh == null && n.bare != null && n.bare < 20000) kwh = n.bare;
    if (kwh == null && l) kwh = l.consumoKwh;
    if (!kwh) return [B.p('Me diga o consumo mensal para dimensionar. Exemplo: <b>"dimensionar sistema para 800 kWh"</b>.'), B.a([Aask('dimensionar sistema para 450 kWh'), Aask('dimensionar sistema para 800 kWh'), Aask('dimensionar sistema para 1500 kWh')])];
    if (l && l.consumoKwh && l.valorConta) tarifa = l.valorConta / l.consumoKwh;
    var kwp = kwh / (4.8 * 30 * 0.8), mod = Math.ceil(kwp * 1000 / 550), kreal = mod * 0.55, area = mod * 2.6, gen = kreal * 4.8 * 30 * 0.8;
    var INV = [3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75], need = kreal / 1.25, inv = INV.filter(function (x) { return x >= need; })[0] || Math.ceil(need);
    var lo = kreal * 3800, hi = kreal * 4500, mid = (lo + hi) / 2, disp = 50, econ = Math.min(kwh, Math.max(0, gen - disp)) * tarifa, payback = econ ? mid / (econ * 12) : 0;
    var out = [B.p('Dimensionamento para <b>' + nf(kwh, 0) + ' kWh/mês</b>' + (l ? ' (' + lk(l) + ')' : '') + ' (HSP 4,8 · 30 dias · eficiência 80%):'),
      B.k([K('Potência (kWp)', nf(kreal, 2), 'amber'), K('Módulos 550 W', mod, 'blue'), K('Área aprox.', nf(area, 0) + ' m²', 'blue'), K('Inversor', nf(inv, 0) + ' kW', 'green'), K('Geração', nf(gen, 0) + ' kWh/mês', 'green')]),
      B.t(['Item', 'Estimativa'], [['Cálculo', nf(kwh, 0) + ' ÷ (4,8 × 30 × 0,8) = ' + nf(kwp, 2) + ' kWp'], ['Investimento (R$ 3.800-4.500/kWp)', m$(lo) + ' a ' + m$(hi)], ['Economia mensal (tarifa R$ ' + nf(tarifa, 2) + '/kWh)', m$(econ)], ['Economia em 25 anos', mc$(econ * 12 * 25)], ['Payback', nf(payback, 1) + ' anos']]),
      B.n('Estimativa comercial. O projeto final depende da visita técnica, sombreamento e orientação do telhado.')];
    var ac = [Aask('simular financiamento de ' + Math.round(mid) + ' em 60x', 'Simular financiamento')];
    if (l) { ac.unshift(Aopen('#/leads/' + l.id, 'Abrir lead')); ac.push(Aopen('#/propostas', 'Gerar proposta')); } else ac.push(Aopen('#/propostas', 'Gerar proposta'));
    out.push(B.a(ac)); return out;
  }, { lead: true, num: true });
  I('financiamento', ['vendedor', 'dono', 'financeiro'], ['simular financiamento', 'simulacao', 'simular', 'financiamento', 'financiar', 'parcela', 'parcelas', 'parcelar', 'juros', 'taxa de juros', 'prestacao', 'quanto fica a parcela'], function (ctx) {
    var n = ctx.nums, l = ctx.lead, p = l ? propDe(l) : null, valor = n.valor != null ? n.valor : (n.bare != null && n.bare >= 1000 ? n.bare : (p ? p.valor : (l ? l.valorEstimado : 28000)));
    var taxa = n.taxa != null ? n.taxa : 1.49, par = n.parcelas || 60, i = taxa / 100;
    function pmt(nn) { return i ? valor * i / (1 - Math.pow(1 + i, -nn)) : valor / nn; }
    var opts = [36, 48, 60, 72, 84, 96, 120]; if (opts.indexOf(par) < 0) opts.push(par); opts.sort(function (a, b) { return a - b; });
    var conta = l && l.valorConta ? l.valorConta : null;
    var out = [B.p('Simulação de <b>' + m$(valor) + '</b> a <b>' + nf(taxa, 2) + '% ao mês</b>: em ' + par + 'x a parcela fica em <b>' + m$(pmt(par)) + '</b>' + (l ? ' (' + lk(l) + ')' : '') + '.'),
      B.t(['Parcelas', 'Valor da parcela', 'Total pago'], opts.map(function (nn) { var r = nn === par; return [(r ? '<b>' : '') + nn + 'x' + (r ? '</b>' : ''), (r ? '<b>' : '') + m$(pmt(nn)) + (r ? '</b>' : ''), m$(pmt(nn) * nn)]; }))];
    if (conta) out.push(B.p('Comparação: a conta de luz atual é ' + m$(conta) + ' e a parcela em ' + par + 'x é ' + (pmt(par) <= conta ? '<b>menor</b>' : 'um pouco maior (compensada pela economia que a conta passa a ter)') + '.'));
    out.push(B.n('Simulação ilustrativa (juros compostos, sem carência, IOF e tarifas). Taxas reais variam por banco e perfil.'), B.a(l ? [Aopen('#/leads/' + l.id, 'Abrir lead'), Aopen('#/propostas', 'Gerar proposta')] : [Aask('simular financiamento de 40000 em 84x com 1,6%', 'Outra simulação')]));
    return out;
  }, { lead: true, num: true });
  I('minha_meta', ['vendedor'], ['minha meta', 'minha posicao', 'meu ranking', 'como estou', 'meu desempenho', 'bati a meta', 'quanto falta', 'meta do mes', 'minhas vendas', 'minha posicao no ranking', 'meta', 'posicao'], function (ctx) {
    var st = vendStats(mkPer('mes')), ix = -1; st.forEach(function (r, i) { if (r.u.id === ctx.uid) ix = i; });
    var me = st[ix]; if (!me) return [B.p('Não encontrei seus números neste mês.')];
    var meta = me.meta ? me.meta.metaVendas : 0, falta = Math.max(0, meta - me.fat), hoje = new Date(), diasMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate(), restam = Math.max(1, diasMes - hoje.getDate() + 1);
    var out = [B.p('Você está em <b>' + (ix + 1) + 'º lugar</b> de ' + st.length + ' no ranking do mês, com ' + m$(me.fat) + ' vendidos (' + me.vendas + ' contrato(s)).'),
      B.k([K('Posição', (ix + 1) + 'º', ix === 0 ? 'green' : 'amber'), K('Meta de vendas', meta ? mc$(meta) : '-', 'blue'), K('Atingido', me.pm == null ? '-' : nf(me.pm, 0) + '%', tone(me.pm || 0, 100, 40)), K('Falta', mc$(falta), falta ? 'amber' : 'green')])];
    if (meta) out.push(B.p(falta ? 'Faltam <b>' + m$(falta) + '</b> em ' + restam + ' dia(s): cerca de ' + mc$(falta / restam) + ' por dia.' : 'Meta batida! Todo valor a mais vira comissão extra.'));
    if (ix > 0) out.push(B.p('Para ultrapassar ' + e(first(st[ix - 1].u.nome)) + ' faltam ' + m$(st[ix - 1].fat - me.fat) + '.'));
    out.push(B.a([Aopen('#/metas', 'Ver metas'), Aask('quem devo ligar primeiro', 'O que fazer hoje')])); return out;
  });
  I('propostas_sem_resposta', ['vendedor', 'dono'], ['propostas sem resposta', 'proposta sem resposta', 'propostas paradas', 'propostas pendentes', 'propostas abertas', 'propostas enviadas', 'sem retorno', 'aguardando resposta', 'propostas', 'proposta'], function (ctx) {
    var ids = idMap(scopeLeads(ctx, S.visibleLeads())), ps = S.collection('propostas').filter(function (p) { return ids[p.leadId] && (p.status === 'enviada' || p.status === 'visualizada') && ui.daysSince(p.enviadaEm) >= 2; }).sort(function (a, b) { return T(a.enviadaEm) - T(b.enviadaEm); });
    if (!ps.length) return [B.p('Nenhuma proposta aguardando resposta há mais de 2 dias.'), B.a([Aopen('#/propostas', 'Ver propostas')])];
    return [B.p('<b>' + ps.length + ' proposta(s)</b> sem resposta, somando ' + m$(sum(ps, function (p) { return p.valor; })) + ':'), B.t(['Lead', 'Proposta', 'Valor', 'Enviada há', 'Status'], ps.slice(0, 8).map(function (p) {
      return [lk(ids[p.leadId]), e(p.numero), mc$(p.valor), Math.floor(ui.daysSince(p.enviadaEm)) + ' d', p.status === 'visualizada' ? '<span class="as-chip as-green">visualizada (quente)</span>' : '<span class="as-chip as-amber">enviada</span>'];
    })), B.n('Propostas visualizadas e sem resposta são as melhores para ligar agora.'), B.a([Aopen('#/propostas', 'Ver propostas'), Aask('mensagem de whatsapp para ' + ids[ps[0].leadId].nome, 'Follow-up do primeiro')])];
  });
  I('whatsapp_followup', ['vendedor', 'dono'], ['mensagem de whatsapp', 'mensagem pronta', 'mensagem para', 'follow up', 'followup', 'texto para', 'script de mensagem', 'escreva uma mensagem', 'whatsapp para', 'whatsapp', 'mande uma mensagem', 'retomar contato', 'reativar', 'mensagem de acompanhamento', 'mensagem'], function (ctx) {
    var l = ctx.lead;
    if (!l) {
      l = scopeLeads(ctx, S.visibleLeads()).filter(isOpen).sort(function (a, b) { return idleDays(b) - idleDays(a); })[0];
      if (!l) return [B.p('Não há leads abertos para enviar mensagem.')];
      return [B.p('Sem um nome específico, usei o lead mais parado: <b>' + lk(l) + '</b> (' + idleDays(l) + ' dias sem contato).'), B.m(zapMsg(ctx, l)), B.a([Aopen('#/conversas', 'Abrir Conversas'), Aopen('#/leads/' + l.id, 'Abrir lead')])];
    }
    return [B.p('Mensagem de follow-up para <b>' + lk(l) + '</b> (etapa ' + e(etNome(l.etapa)) + '):'), B.m(zapMsg(ctx, l)), B.a([Aopen('#/conversas', 'Abrir Conversas'), { l: 'Criar tarefa de follow-up', act: 'task', d: { leadId: l.id, titulo: 'Follow-up com ' + l.nome } }])];
  }, { lead: true });

  FAQ.forEach(function (f) {
    I('faq_' + f.id, f.roles || ALL, f.kw, function () { return [B.p('<b>' + e(f.title) + '</b>'), B.l(f.b), B.p('<b>Dica:</b> ' + f.dica)]; });
  });

  /* Técnico */
  I('visitas_obras', ['tecnico', 'dono'], ['minhas visitas', 'minhas obras', 'obras de hoje', 'visitas de hoje', 'obras hoje', 'visitas hoje', 'agenda tecnica', 'o que tenho hoje', 'instalacoes de hoje', 'obras em andamento', 'visitas', 'obras', 'o que fazer hoje'], function (ctx) {
    var os = minhasObras(ctx).filter(function (o) { return o.status !== 'concluida'; }), hoje = mkPer('hoje').start;
    var rows = os.map(function (o) { var a = obraAtual(o), l = S.lead(o.leadId); return { o: o, a: a, l: l, d: obraAtraso(o) }; }).sort(function (x, y) { return y.d - x.d || T(x.a && x.a.previstaEm) - T(y.a && y.a.previstaEm); });
    var tars = S.collection('tarefas').filter(function (t) { return !t.concluida && t.responsavelId === ctx.uid && T(t.vencimento) < hoje + 2 * DAY; });
    var campo = rows.filter(function (r) { return r.a && ['visita', 'instalacao', 'vistoria'].indexOf(r.a.id) >= 0; });
    var out = [B.p('Você tem <b>' + os.length + ' obra(s)</b> em andamento, <b>' + campo.length + '</b> com etapa de campo (visita, instalação ou vistoria) agora e ' + tars.length + ' tarefa(s) próxima(s).'),
      B.t(['Obra', 'Cliente', 'Cidade', 'Etapa atual', 'Previsto', 'Situação'], rows.slice(0, 8).map(function (r) {
        return [e(r.o.id.toUpperCase()), r.l ? lk(r.l) : '-', e(String(r.o.cidade).split(' - ')[0]), e(r.a ? etapaObraNome(r.a.id) : '-'), r.a ? e(ui.fmtDate(r.a.previstaEm)) : '-', r.d > 0 ? '<span class="as-chip as-red">' + r.d + ' d atraso</span>' : '<span class="as-chip as-green">no prazo</span>'];
      }))];
    if (tars.length) out.push(B.l(tars.slice(0, 4).map(function (t) { return e(t.titulo) + ' · ' + e(ui.timeAgo(t.vencimento)); })));
    out.push(B.a([Aopen('#/obras', 'Abrir obras'), Aopen('#/agenda', 'Ver agenda'), Aask('checklist de instalação', 'Checklist')])); return out;
  });
  I('checklist_instalacao', ['tecnico', 'dono'], ['checklist', 'check list', 'lista de verificacao', 'passo a passo da instalacao', 'roteiro de instalacao', 'antes de instalar', 'checklist de instalacao'], function () {
    return [B.p('<b>Checklist de instalação</b> (confirme item a item):'), B.l([
      '<b>Antes de subir:</b> APR/ordem de serviço, ASO e NR-35/NR-10 em dia, EPIs e linha de vida, clima favorável.',
      '<b>Conferência:</b> módulos (quantidade/modelo), inversor, estrutura, cabos solares, string box e DPS conforme projeto.',
      '<b>Estrutura:</b> fixação conforme tipo de telhado, vedação dos pontos de furo, alinhamento e torque dos parafusos.',
      '<b>Módulos:</b> sem trincas, strings de acordo com o projeto, conectores MC4 firmes e cabos organizados.',
      '<b>Elétrica:</b> aterramento e equipotencialização, DPS, disjuntores CC/CA, medição de Voc e polaridade de cada string antes de ligar.',
      '<b>Inversor:</b> fixação, ventilação, configuração da rede/norma, conexão do Wi-Fi e monitoramento.',
      '<b>Comissionamento:</b> teste de geração, fotos do antes/depois, etiquetas e plaquetas de sinalização.',
      '<b>Entrega:</b> treinamento do cliente, termo de entrega assinado, abertura da vistoria com a concessionária.']), B.a([Aopen('#/obras', 'Abrir obras'), Aask('documentação da concessionária', 'Documentação')])];
  });
  I('status_homologacao', ['tecnico', 'dono'], ['homologacao', 'status da obra', 'status homologacao', 'andamento da obra', 'etapa da obra', 'parecer de acesso', 'vistoria da concessionaria', 'troca do medidor', 'status', 'obra'], function (ctx) {
    var os = minhasObras(ctx), o = null, l = ctx.lead;
    if (l) o = obraDe(l); var mo = ctx.t.match(/\bo(\d+)\b/); if (!o && mo) o = S.find('obras', 'o' + mo[1]);
    if (!o) {
      var h = os.filter(function (x) { var a = obraAtual(x); return a && ['homologacao', 'aprovacao', 'documentacao'].indexOf(a.id) >= 0; });
      return [B.p('<b>' + h.length + ' obra(s)</b> estão hoje na fase de documentação/homologação/aprovação da concessionária:'), B.t(['Obra', 'Cliente', 'Etapa', 'Previsto'], h.slice(0, 8).map(function (x) { var a = obraAtual(x), ll = S.lead(x.leadId); return [e(x.id.toUpperCase()), ll ? lk(ll) : '-', e(etapaObraNome(a.id)), e(ui.fmtDate(a.previstaEm))]; })),
        B.n('Cite o cliente ou o código para ver o detalhe, por exemplo: "status da homologação da obra o3".'), B.a([Aopen('#/obras', 'Abrir obras')])];
    }
    var ll = S.lead(o.leadId), done = o.etapas.filter(function (x) { return x.status === 'concluida'; }).length;
    return [B.p('Obra <b>' + e(o.id.toUpperCase()) + '</b>' + (ll ? ' de ' + lk(ll) : '') + ' (' + nf(o.potenciaKwp, 1) + ' kWp, ' + e(o.cidade) + '): ' + done + ' de ' + o.etapas.length + ' etapas concluídas.'),
      B.t(['Etapa', 'Status', 'Previsto'], o.etapas.map(function (x) { return [e(etapaObraNome(x.id)), x.status === 'concluida' ? '<span class="as-chip as-green">concluída</span>' : x.status === 'andamento' ? '<span class="as-chip as-amber">em andamento</span>' : '<span class="as-chip as-gray">pendente</span>', e(ui.fmtDate(x.previstaEm))]; })), B.a([Aopen('#/obras', 'Abrir obras')].concat(ll ? [Aopen('#/leads/' + ll.id, 'Abrir lead')] : []))];
  }, { lead: true });
  I('materiais_reservados', ['tecnico', 'dono'], ['materiais reservados', 'material reservado', 'reservas', 'reservado', 'reservados', 'materiais da obra', 'o que falta na obra', 'separar material', 'lista de materiais', 'kit da obra', 'materiais'], function (ctx) {
    var it = S.collection('estoque').filter(function (x) { return (x.reservas || []).length; }), l = ctx.lead, ob = l ? obraDe(l) : null, rows = [];
    it.forEach(function (x) { x.reservas.forEach(function (r) { if (ob && r.obraId !== ob.id) return; var o = S.find('obras', r.obraId); rows.push([e(x.nome), r.qtd + ' ' + e(x.unidade || ''), e(r.obraId.toUpperCase()), o && S.lead(o.leadId) ? lk(S.lead(o.leadId)) : '-', x.qtd - x.reservado < 0 ? '<span class="as-chip as-red">insuficiente</span>' : '<span class="as-chip as-green">ok</span>']); }); });
    if (!rows.length) return [B.p('Nenhum material reservado' + (ob ? ' para esta obra' : '') + ' no momento.'), B.a([Aopen('#/estoque', 'Ver estoque')])];
    return [B.p('<b>' + rows.length + ' reserva(s)</b> de materiais' + (ob ? ' para a obra ' + e(ob.id.toUpperCase()) : ' ativas') + ':'), B.t(['Item', 'Reservado', 'Obra', 'Cliente', 'Situação'], rows.slice(0, 10)), B.a([Aopen('#/estoque', 'Abrir estoque')])];
  }, { lead: true });
  I('doc_concessionaria', ['tecnico', 'dono', 'vendedor'], ['documentacao', 'documentos', 'documentos da concessionaria', 'formulario de acesso', 'art', 'solicitacao de acesso', 'parecer', 'rrt', 'diagrama unifilar', 'memorial descritivo', 'projeto para concessionaria', 'cpfl', 'elektro', 'enel', 'concessionaria'], function () {
    return [B.p('<b>Documentação para solicitação de acesso à concessionária</b> (micro e minigeração distribuída):'), B.l([
      'Formulário de solicitação de acesso (padrão da distribuidora) e procuração do cliente para o integrador.',
      'ART/RRT do responsável técnico e documento do titular (RG/CPF ou CNPJ).',
      'Conta de luz recente (número da unidade consumidora).',
      'Projeto: diagrama unifilar, memorial descritivo e diagrama de localização/layout.',
      'Datasheets e certificados INMETRO de módulos e inversor; ajuste de proteções do inversor.',
      'Para geração compartilhada/remota: termo de adesão e rateio dos créditos.',
      'Após a instalação: pedido de vistoria e troca do medidor bidirecional.']), B.n('Os documentos variam por distribuidora; confirme o checklist no portal da concessionária.'), B.a([Aopen('#/obras', 'Abrir obras'), Aask('prazo de homologação', 'Prazo de homologação')])];
  });

  /* Financeiro */
  function lanc() { return S.collection('lancamentos'); }
  I('caixa', ['dono', 'financeiro'], ['caixa', 'saldo', 'como esta o caixa', 'situacao financeira', 'saude financeira', 'dinheiro em caixa', 'financeiro'], function () {
    var L = lanc(), rec = sum(L.filter(function (x) { return x.tipo === 'receber' && x.status === 'pago'; }), function (x) { return x.valor; }), pag = sum(L.filter(function (x) { return x.tipo === 'pagar' && x.status === 'pago'; }), function (x) { return x.valor; });
    var ar = sum(L.filter(function (x) { return x.tipo === 'receber' && x.status !== 'pago'; }), function (x) { return x.valor; }), ap = sum(L.filter(function (x) { return x.tipo === 'pagar' && x.status !== 'pago'; }), function (x) { return x.valor; });
    return [B.p('Posição de caixa: saldo realizado de <b>' + m$(rec - pag) + '</b> e projeção de <b>' + m$(rec - pag + ar - ap) + '</b> se tudo pendente for liquidado.'),
      B.k([K('Recebido', mc$(rec), 'green'), K('Pago', mc$(pag), 'red'), K('Saldo realizado', mc$(rec - pag), tone(rec - pag, 1, -1)), K('A receber', mc$(ar), 'blue'), K('A pagar', mc$(ap), 'amber')]), B.a([Aopen('#/financeiro', 'Abrir financeiro'), Aask('fluxo de caixa', 'Fluxo de caixa')])];
  });
  I('receber_pagar', ['dono', 'financeiro'], ['a receber', 'a pagar', 'contas a pagar', 'contas a receber', 'vencem', 'vencimentos', 'proximos pagamentos', 'proximos recebimentos', 'receber esta semana', 'pagar esta semana', 'esta semana', 'semana', 'receber', 'pagar'], function () {
    var now = Date.now(), fim = now + 7 * DAY, L = lanc().filter(function (x) { return x.status === 'pendente' && T(x.vencimento) <= fim; }).sort(function (a, b) { return T(a.vencimento) - T(b.vencimento); });
    var r = L.filter(function (x) { return x.tipo === 'receber'; }), p = L.filter(function (x) { return x.tipo === 'pagar'; }), vr = sum(r, function (x) { return x.valor; }), vp = sum(p, function (x) { return x.valor; });
    return [B.p('Nos próximos 7 dias: <b>' + m$(vr) + '</b> a receber e <b>' + m$(vp) + '</b> a pagar (saldo previsto ' + m$(vr - vp) + ').'), B.k([K('A receber (7 dias)', mc$(vr), 'green'), K('A pagar (7 dias)', mc$(vp), 'amber'), K('Saldo previsto', mc$(vr - vp), tone(vr - vp, 1, -1))]),
      B.t(['Vence', 'Tipo', 'Descrição', 'Valor'], L.slice(0, 10).map(function (x) { return [e(ui.fmtDate(x.vencimento)), x.tipo === 'receber' ? '<span class="as-chip as-green">receber</span>' : '<span class="as-chip as-amber">pagar</span>', e(x.descricao), m$(x.valor)]; })), B.a([Aopen('#/financeiro', 'Abrir financeiro')])];
  });
  I('atrasados', ['dono', 'financeiro'], ['atrasad*', 'inadimpl*', 'vencidas', 'vencidos', 'em atraso', 'calote', 'pagamentos atrasados', 'contas atrasadas', 'cobranca', 'titulos vencidos'], function () {
    var L = lanc().filter(function (x) { return x.status === 'atrasado'; }).sort(function (a, b) { return T(a.vencimento) - T(b.vencimento); }), r = L.filter(function (x) { return x.tipo === 'receber'; }), p = L.filter(function (x) { return x.tipo === 'pagar'; });
    return [B.p('Em atraso: <b>' + m$(sum(r, function (x) { return x.valor; })) + '</b> a receber (' + r.length + ' título(s)) e <b>' + m$(sum(p, function (x) { return x.valor; })) + '</b> a pagar (' + p.length + ').'),
      B.t(['Venceu há', 'Tipo', 'Descrição', 'Valor'], L.slice(0, 10).map(function (x) { return [Math.floor(ui.daysSince(x.vencimento)) + ' d', x.tipo === 'receber' ? '<span class="as-chip as-green">receber</span>' : '<span class="as-chip as-red">pagar</span>', e(x.descricao), m$(x.valor)]; })), B.n('Priorize cobrar os recebimentos mais antigos e renegociar os pagamentos com multa.'), B.a([Aopen('#/financeiro', 'Abrir financeiro')])];
  });
  I('fluxo_caixa', ['dono', 'financeiro'], ['fluxo de caixa', 'fluxo', 'entradas e saidas', 'entradas', 'saidas', 'projecao financeira'], function () {
    var n = new Date(), rows = [], L = lanc();
    for (var k = 2; k >= -1; k--) {
      var a = new Date(n.getFullYear(), n.getMonth() - k, 1).getTime(), b = new Date(n.getFullYear(), n.getMonth() - k + 1, 1).getTime();
      var x = L.filter(function (z) { return T(z.vencimento) >= a && T(z.vencimento) < b; }), r = sum(x.filter(function (z) { return z.tipo === 'receber'; }), function (z) { return z.valor; }), p = sum(x.filter(function (z) { return z.tipo === 'pagar'; }), function (z) { return z.valor; });
      if (k === -1 && !x.length) continue; rows.push([e(new Date(a).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })) + (k === 0 ? ' (atual)' : k < 0 ? ' (previsto)' : ''), mc$(r), mc$(p), '<b>' + mc$(r - p) + '</b>']);
    }
    return [B.p('Fluxo de caixa por mês de vencimento (todos os lançamentos):'), B.t(['Mês', 'Entradas', 'Saídas', 'Saldo'], rows), B.a([Aopen('#/financeiro', 'Abrir financeiro')])];
  });
  I('comissoes', ['dono', 'financeiro', 'vendedor'], ['comissao', 'comissoes', 'comissionamento', 'minhas comissoes', 'minha comissao'], function (ctx) {
    var L = lanc().filter(function (x) { return x.categoria === 'comissao' && (ctx.role !== 'vendedor' || x.usuarioId === ctx.uid); }), by = {};
    L.forEach(function (x) { var k = x.usuarioId; by[k] = by[k] || { p: 0, a: 0, n: 0 }; by[k].n++; if (x.status === 'pago') by[k].p += x.valor; else by[k].a += x.valor; });
    var rows = Object.keys(by).map(function (k) { var u = S.user(k); return [e(u ? first(u.nome) : k), by[k].n, mc$(by[k].p), mc$(by[k].a)]; });
    var pg = sum(L.filter(function (x) { return x.status === 'pago'; }), function (x) { return x.valor; }), pe = sum(L.filter(function (x) { return x.status !== 'pago'; }), function (x) { return x.valor; });
    return [B.p((ctx.role === 'vendedor' ? 'Suas comissões' : 'Comissões') + ': <b>' + m$(pg) + '</b> pagas e <b>' + m$(pe) + '</b> pendentes (5% do contrato).'), B.k([K('Pagas', mc$(pg), 'green'), K('Pendentes', mc$(pe), 'amber')]), B.t(['Vendedor', 'Lançamentos', 'Pago', 'Pendente'], rows), B.a([Aopen('#/financeiro', 'Abrir financeiro')])];
  });
  I('dre', ['dono', 'financeiro'], ['dre', 'resultado do mes', 'lucro', 'margem', 'demonstrativo', 'resultado financeiro', 'lucratividade', 'despesas', 'resultado', 'custos'], function (ctx) {
    var per = mkPer('mes'), n = new Date(), fim = new Date(n.getFullYear(), n.getMonth() + 1, 1).getTime(), L = lanc().filter(function (x) { return T(x.vencimento) >= per.start && T(x.vencimento) < fim; });
    var rec = sum(L.filter(function (x) { return x.tipo === 'receber'; }), function (x) { return x.valor; }), by = {};
    L.filter(function (x) { return x.tipo === 'pagar'; }).forEach(function (x) { by[x.categoria] = (by[x.categoria] || 0) + x.valor; });
    var tot = sum(Object.keys(by), function (k) { return by[k]; }), res = rec - tot;
    var NM = { fornecedor: 'Fornecedores / materiais', comissao: 'Comissões', folha: 'Folha e equipe técnica', fixo: 'Custos fixos', impostos: 'Impostos', marketing: 'Marketing' };
    return [B.p('DRE gerencial do mês (por vencimento): resultado de <b>' + m$(res) + '</b> e margem de <b>' + nf(pct(res, rec), 1) + '%</b>.'), B.k([K('Receita', mc$(rec), 'green'), K('Custos e despesas', mc$(tot), 'red'), K('Resultado', mc$(res), tone(res, 1, -1)), K('Margem', nf(pct(res, rec), 0) + '%', tone(pct(res, rec), 15, 0))]),
      B.t(['Linha', 'Valor', '% da receita'], [['<b>Receita bruta</b>', m$(rec), '100%']].concat(Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (k) { return [e(NM[k] || k), '- ' + m$(by[k]), nf(pct(by[k], rec), 0) + '%']; })).concat([['<b>Resultado</b>', '<b>' + m$(res) + '</b>', nf(pct(res, rec), 0) + '%']])), B.n('Visão gerencial simplificada, não substitui a contabilidade.'), B.a([Aopen('#/financeiro', 'Abrir financeiro')])];
  });

  /* Tráfego */
  I('cpl_campanha', ['trafego', 'dono'], ['cpl', 'custo por lead', 'custo por contato', 'quanto custa cada lead', 'cpl por campanha', 'custo por oportunidade'], function () {
    var st = campStats().filter(function (r) { return r.leads; }).sort(function (a, b) { return a.cpl - b.cpl; }), inv = sum(st, function (r) { return r.c.investimento; }), l = sum(st, function (r) { return r.leads; });
    return [B.p('CPL médio de <b>' + m$(l ? inv / l : 0) + '</b>. Mais barata: <b>' + e(st[0].c.nome) + '</b> (' + m$(st[0].cpl) + '); mais cara: <b>' + e(st[st.length - 1].c.nome) + '</b> (' + m$(st[st.length - 1].cpl) + ').'),
      B.t(['Campanha', 'Canal', 'Invest.', 'Leads', 'CPL', 'CPL qualif.'], st.map(function (r) { return [e(r.c.nome), e(r.c.canal), mc$(r.c.investimento), r.leads, m$(r.cpl), r.qual ? m$(r.c.investimento / r.qual) : '-']; })), B.a([Aopen('#/marketing', 'Abrir Marketing & Tráfego')])];
  });
  I('melhor_criativo', ['trafego', 'dono'], ['melhor criativo', 'criativo', 'criativos', 'anuncio que mais converte', 'melhor anuncio', 'qual anuncio', 'qual criativo', 'anuncios', 'anuncio'], function () {
    var st = campStats().filter(function (r) { return r.leads >= 3; }).sort(function (a, b) { return b.roas - a.roas || b.pq - a.pq; });
    return [B.p('Melhor anúncio/criativo por retorno: <b>' + e(st[0].c.nome) + '</b> (' + e(st[0].c.canal) + '), ROAS ' + nf(st[0].roas, 1) + 'x, ' + st[0].vendas + ' venda(s) e ' + nf(st[0].pq, 0) + '% de leads qualificados.'),
      B.t(['#', 'Anúncio', 'ROAS', 'Vendas', 'Qualidade', 'CPL'], st.slice(0, 6).map(function (r, i) { return [i + 1, e(r.c.nome), nf(r.roas, 1) + 'x', r.vendas, nf(r.pq, 0) + '%', m$(r.cpl)]; })), B.n('Aqui "criativo" equivale a cada campanha/anúncio cadastrado; teste variações do vencedor (gancho, imagem, CTA).'), B.a([Aopen('#/marketing', 'Abrir Marketing & Tráfego')])];
  });
  I('qualidade_lead', ['trafego', 'dono'], ['qualidade de lead', 'qualidade dos leads', 'leads qualificados', 'lead qualificado', 'qualificacao dos leads', 'lead frio', 'quais campanhas trazem lead bom', 'score medio', 'leads bons', 'qualidade'], function () {
    var st = campStats().filter(function (r) { return r.leads; }).sort(function (a, b) { return b.pq - a.pq; });
    return [B.p('Melhor qualidade: <b>' + e(st[0].c.nome) + '</b> (' + nf(st[0].pq, 0) + '% com score 60 ou mais). Pior: <b>' + e(st[st.length - 1].c.nome) + '</b> (' + nf(st[st.length - 1].pq, 0) + '%).'),
      B.t(['Campanha', 'Leads', 'Qualificados', 'Score médio', 'Conversão'], st.map(function (r) { return [e(r.c.nome), r.leads, nf(r.pq, 0) + '%', nf(r.score, 0), nf(pct(r.vendas, r.leads), 1) + '%']; })), B.n('Qualificado = score 60 ou mais. Use essa lista para ajustar público e formulário.'), B.a([Aopen('#/leads', 'Ver leads')])];
  });
  I('sugestoes_otimizacao', ['trafego', 'dono'], ['sugestoes', 'otimizar', 'otimizacao', 'o que melhorar', 'como melhorar', 'dicas', 'pausar', 'escalar', 'onde investir', 'realocar', 'orcamento', 'recomenda*', 'sugestao'], function () {
    var st = campStats().filter(function (r) { return r.c.investimento; }), avg = sum(st, function (r) { return r.c.investimento; }) / Math.max(1, sum(st, function (r) { return r.leads; })), tips = [];
    st.slice().sort(function (a, b) { return b.roas - a.roas; }).slice(0, 2).forEach(function (r) { if (r.roas >= 1) tips.push('<span class="as-chip as-green">escalar</span> <b>' + e(r.c.nome) + '</b>: ROAS ' + nf(r.roas, 1) + 'x. Aumente o orçamento em 20% a cada 3 dias enquanto o CPL se mantiver.'); });
    st.filter(function (r) { return r.c.status === 'ativa' && (r.roas < 1.5 || r.cpl > avg * 1.5); }).sort(function (a, b) { return a.roas - b.roas; }).slice(0, 2).forEach(function (r) { tips.push('<span class="as-chip as-red">revisar</span> <b>' + e(r.c.nome) + '</b>: ROAS ' + nf(r.roas, 1) + 'x e CPL ' + m$(r.cpl) + '. Teste novos criativos ou pause se não melhorar em 7 dias.'); });
    st.filter(function (r) { return r.c.status !== 'ativa' && r.pq >= 50; }).forEach(function (r) { tips.push('<span class="as-chip as-amber">retomar</span> <b>' + e(r.c.nome) + '</b> está pausada e gera ' + nf(r.pq, 0) + '% de leads qualificados.'); });
    tips.push('<span class="as-chip as-blue">rotina</span> Responda os leads de anúncio em até 5 minutos e envie as conversões (venda) de volta para otimizar o algoritmo.');
    return [B.p('Sugestões de otimização com base nos números atuais:'), B.l(tips), B.a([Aopen('#/marketing', 'Abrir Marketing & Tráfego'), Aask('relatório do mês', 'Relatório do mês')])];
  });
  I('relatorio_mes', ['trafego', 'dono'], ['relatorio', 'relatorio do mes', 'relatorio mensal', 'resultado das campanhas', 'resumo de marketing', 'desempenho das campanhas', 'performance', 'balanco do mes'], function () {
    var st = campStats(), inv = sum(st, function (r) { return r.c.investimento; }), l = sum(st, function (r) { return r.leads; }), v = sum(st, function (r) { return r.vendas; }), fat = sum(st, function (r) { return r.fat; }), q = sum(st, function (r) { return r.qual; });
    var best = st.slice().sort(function (a, b) { return b.roas - a.roas; })[0], worst = st.filter(function (r) { return r.c.investimento; }).sort(function (a, b) { return a.roas - b.roas; })[0];
    return [B.p('<b>Relatório de marketing</b> (' + e(new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })) + '):'),
      B.k([K('Investimento', mc$(inv), 'amber'), K('Leads', l, 'blue'), K('CPL', m$(l ? inv / l : 0), 'blue'), K('Vendas', v, 'green'), K('CAC', mc$(v ? inv / v : 0), 'red'), K('ROAS', nf(inv ? fat / inv : 0, 1) + 'x', tone(inv ? fat / inv : 0, 4, 1.5))]),
      B.l(['<b>Destaque:</b> ' + e(best.c.nome) + ' com ROAS ' + nf(best.roas, 1) + 'x.', '<b>Ponto de atenção:</b> ' + e(worst.c.nome) + ' com ROAS ' + nf(worst.roas, 1) + 'x.', '<b>Qualidade:</b> ' + nf(pct(q, l), 0) + '% dos leads têm score 60 ou mais.']),
      B.t(['Campanha', 'Invest.', 'Leads', 'Vendas', 'ROAS'], st.map(function (r) { return [e(r.c.nome), mc$(r.c.investimento), r.leads, r.vendas, nf(r.roas, 1) + 'x']; })), B.a([Aopen('#/marketing', 'Abrir Marketing & Tráfego'), Aask('sugestões de otimização', 'Sugestões')])];
  });

  /* ---------- motor ---------- */
  var reCache = {};
  function hasPhrase(t, k) {
    var re = reCache[k];
    if (!re) { var pre = k.charAt(k.length - 1) === '*', base = pre ? k.slice(0, -1) : k; re = reCache[k] = new RegExp('(^|\\s)' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (pre ? '\\w*' : '') + '(?=\\s|$)'); }
    return re.test(t);
  }
  function scoreIntent(it, ctx) {
    var s = 0; it.kw.forEach(function (k) { if (hasPhrase(ctx.t, k)) s += 1 + k.split(' ').length; });
    if (it.num && (ctx.nums.kwh != null || ctx.nums.parcelas != null || ctx.nums.taxa != null || ctx.nums.valor != null)) s += (it.id === 'dimensionar' ? (ctx.nums.kwh != null ? 4 : 0) : (ctx.nums.parcelas != null || ctx.nums.taxa != null ? 3 : 0));
    if (it.id === 'lead_info' && ctx.lead) s += 3;
    else if (it.lead && ctx.lead && s) s += 2;
    return s;
  }
  var PAPEL_ROTULO = { dono: 'Dono', vendedor: 'Vendedor', tecnico: 'Técnico', financeiro: 'Financeiro', trafego: 'Tráfego' };
  function sugestoes(role) {
    return {
      dono: ['Resumo da empresa hoje', 'Quantos leads entraram este mês?', 'Qual a taxa de conversão?', 'Faturamento vendido no mês', 'Ranking de vendedores', 'Quem está pior?', 'Leads sem atendimento', 'Motivos de perda', 'Previsão de fechamento', 'Qual campanha mais vende?', 'Como está o caixa?', 'Obras atrasadas', 'Estoque baixo', 'CAC e ROAS'],
      vendedor: ['Quem devo ligar primeiro?', 'Minha meta e posição no ranking', 'Propostas sem resposta', 'Dimensionar sistema para 600 kWh', 'Simular financiamento de 30000 em 60x', 'Como contornar: está muito caro', 'Cliente disse "vou pensar"', 'Mensagem de WhatsApp de follow-up', 'Diferença on-grid x off-grid', 'O que é a Lei 14.300 e o Fio B?', 'Prazo de homologação', 'Garantia dos módulos e inversor'],
      tecnico: ['Minhas obras em andamento', 'Checklist de instalação', 'Status da homologação', 'Materiais reservados', 'Documentação da concessionária', 'Obras atrasadas', 'Estoque baixo', 'Como dimensionar strings?', 'Regras de aterramento', 'O que é NR-10?', 'O que é NR-35?'],
      financeiro: ['A receber e a pagar esta semana', 'Pagamentos atrasados', 'Fluxo de caixa', 'Comissões', 'DRE resumo do mês', 'Como está o caixa?', 'Faturamento vendido no mês', 'Ticket médio', 'Simular financiamento de 30000 em 60x'],
      trafego: ['CPL por campanha', 'Qual o melhor criativo?', 'Qualidade dos leads por campanha', 'ROAS e CAC', 'Sugestões de otimização', 'Relatório do mês', 'Quantos leads entraram este mês?', 'Qual campanha mais vende?', 'Leads por canal']
    }[role] || [];
  }
  function answer(raw) {
    var ctx = buildCtx(raw), best = null, bs = 0, bestAny = null, bas = 0;
    INTENTS.forEach(function (it) {
      var s = scoreIntent(it, ctx);
      if (it.roles.indexOf(ctx.role) >= 0) { if (s > bs) { bs = s; best = it; } }
      else if (s > bas) { bas = s; bestAny = it; }
    });
    if (bestAny && bas >= 3 && bas > bs + 1) {
      var qs = bestAny.roles.map(function (r) { return PAPEL_ROTULO[r]; }).join(', ');
      return { id: 'restrito', blocks: [B.p('Essa informação é restrita aos perfis <b>' + e(qs) + '</b>. Com o seu perfil (' + e(PAPEL_ROTULO[ctx.role]) + ') eu posso ajudar com outros assuntos:'), B.a(sugestoes(ctx.role).slice(0, 4).map(function (s) { return Aask(s); }))] };
    }
    if (best && bs >= 2 && !(best.id === 'saudacao' && bs < 2)) {
      if (ctx.lead && bs <= 3 && best.id !== 'lead_info' && !best.lead && ['saudacao', 'obrigado'].indexOf(best.id) < 0 && bs < 3) { /* mantém */ }
      try { return { id: best.id, blocks: best.fn(ctx) }; } catch (err) { console.error(err); return { id: 'erro', blocks: [B.p('Tive um problema ao calcular essa resposta. Tente reformular a pergunta.')] }; }
    }
    if (ctx.lead) { var li = INTENTS.filter(function (i) { return i.id === 'lead_info'; })[0]; if (li.roles.indexOf(ctx.role) >= 0) return { id: 'lead_info', blocks: li.fn(ctx) }; }
    return { id: 'fallback', blocks: [B.p('Não entendi bem a pergunta. Posso ajudar com dados do sistema do seu perfil (' + e(PAPEL_ROTULO[ctx.role]) + '), como:'), B.a(sugestoes(ctx.role).slice(0, 5).map(function (s) { return Aask(s); })),
      B.n('Dica: cite um lead pelo nome, um período (hoje, semana, mês) ou valores como "600 kWh".')] };
  }

  /* ---------- UI ---------- */
  var KEY = 'solarprime_assist_';
  function loadHist(role) { try { var h = JSON.parse(localStorage.getItem(KEY + role) || '[]'); return Array.isArray(h) ? h : []; } catch (x) { return []; } }
  function saveHist(role, h) { try { localStorage.setItem(KEY + role, JSON.stringify(h.slice(-40))); } catch (x) { /* ignora */ } }
  function welcome(ctx) {
    var nome = first(ctx.user ? ctx.user.nome : '');
    var t = { dono: 'Olá ' + nome + ', sou seu assistente de gestão. Pergunto aos dados da empresa e respondo na hora: vendas, equipe, caixa, obras e campanhas.',
      vendedor: 'Olá ' + nome + ', sou seu assistente comercial. Priorizo seus leads, calculo sistemas e financiamentos, sugiro como contornar objeções e escrevo mensagens de follow-up.',
      tecnico: 'Olá ' + nome + ', sou seu assistente técnico. Consulto suas obras, checklists de instalação, homologação, materiais e normas como NR-10 e NR-35.',
      financeiro: 'Olá ' + nome + ', sou seu assistente financeiro. Mostro a receber e a pagar, atrasos, fluxo de caixa, comissões e o DRE do mês.',
      trafego: 'Olá ' + nome + ', sou seu assistente de tráfego. Analiso CPL, ROAS, qualidade dos leads por campanha e sugiro otimizações.' }[ctx.role];
    return { r: 'a', id: 'welcome', blocks: [B.p(e(t)), B.p('Escolha uma sugestão ou escreva sua pergunta:')] };
  }

  function render(el, params) {
    var role = SP.session.role, ctx0 = { role: role, user: SP.session.user() }, hist = loadHist(role), busy = false, queue = [];
    el.innerHTML = ui.pageHeader('Assistente IA', 'Pergunte em linguagem natural. As respostas vêm dos dados do sistema, no seu perfil.', '<button class="btn btn-ghost btn-sm" id="as-clear">' + ui.icon('trash', 16) + ' Limpar conversa</button>') +
      '<div class="card as-wrap"><div class="as-msgs" id="as-msgs" aria-live="polite"></div>' +
      '<div class="as-chips" id="as-chips">' + sugestoes(role).map(function (s) { return '<button class="as-sugg" data-q="' + e(s) + '">' + e(s) + '</button>'; }).join('') + '</div>' +
      '<form class="as-form" id="as-form" autocomplete="off"><input class="as-input" id="as-input" type="text" placeholder="Pergunte algo, ex.: ' + e(sugestoes(role)[0] || '') + '" maxlength="300" aria-label="Pergunta ao assistente"><button class="btn btn-primary as-send" type="submit" aria-label="Enviar">' + ui.icon('send', 18) + '</button></form>' +
      '<div class="as-demo">Demo: respostas geradas a partir dos dados do sistema. Na versão completa, IA generativa (Claude) no servidor.</div></div>';
    var box = el.querySelector('#as-msgs'), input = el.querySelector('#as-input');

    function bubble(msg) {
      var d = document.createElement('div');
      if (msg.r === 'u') { d.className = 'as-row as-user'; d.innerHTML = '<div class="as-bub">' + e(msg.t) + '</div>'; }
      else { d.className = 'as-row as-bot'; d.innerHTML = '<div class="as-av">' + ui.icon('sparkle', 16) + '</div><div class="as-bub">' + blocksHtml(msg.blocks) + '</div>'; }
      box.appendChild(d); return d;
    }
    function down() { box.scrollTop = box.scrollHeight; }
    function reveal(node, done) {
      var w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null), tn = [], x;
      while ((x = w.nextNode())) if (x.nodeValue.trim()) tn.push({ n: x, parts: x.nodeValue.split(/(\s+)/), i: 0 });
      var total = tn.reduce(function (s, o) { return s + o.parts.length; }, 0), step = Math.max(2, Math.ceil(total / 55)), ci = 0;
      tn.forEach(function (o) { o.full = o.n.nodeValue; o.n.nodeValue = ''; });
      (function tick() {
        if (!node.isConnected) { tn.forEach(function (o) { o.n.nodeValue = o.full; }); return done && done(); }
        var left = step;
        while (left > 0 && ci < tn.length) { var o = tn[ci]; var take = Math.min(left, o.parts.length - o.i); o.i += take; left -= take; o.n.nodeValue = o.parts.slice(0, o.i).join(''); if (o.i >= o.parts.length) ci++; }
        down(); if (ci < tn.length) setTimeout(tick, 22); else if (done) done();
      })();
    }
    function typing() { var d = document.createElement('div'); d.className = 'as-row as-bot'; d.innerHTML = '<div class="as-av">' + ui.icon('sparkle', 16) + '</div><div class="as-bub as-typing"><i></i><i></i><i></i></div>'; box.appendChild(d); down(); return d; }

    function ask(text) {
      text = String(text || '').trim(); if (!text) return;
      if (busy) { queue.push(text); input.value = ''; return; }
      busy = true; el.setAttribute('data-busy', '1'); hist.push({ r: 'u', t: text }); bubble({ r: 'u', t: text }); down(); input.value = '';
      var ty = typing();
      setTimeout(function () {
        var a = answer(text), msg = { r: 'a', id: a.id, blocks: a.blocks };
        hist.push(msg); saveHist(role, hist);
        if (ty.parentNode) ty.parentNode.removeChild(ty);
        var b = bubble(msg); down();
        el.setAttribute('data-last-intent', a.id);
        reveal(b.querySelector('.as-bub'), function () { busy = false; el.setAttribute('data-busy', '0'); down(); if (queue.length) ask(queue.shift()); });
      }, 450 + Math.random() * 350);
    }

    var wm = welcome(ctx0); bubble(wm);
    hist.forEach(function (msg) { bubble(msg); }); down();
    el.querySelector('#as-form').addEventListener('submit', function (ev) { ev.preventDefault(); ask(input.value); });
    el.querySelector('#as-chips').addEventListener('click', function (ev) { var b = ev.target.closest('[data-q]'); if (b) ask(b.getAttribute('data-q')); });
    el.querySelector('#as-clear').addEventListener('click', function () { hist = []; saveHist(role, hist); render(el, {}); ui.toast('Conversa limpa.', 'success'); });
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b) return;
      var d; try { d = JSON.parse(b.getAttribute('data-d')); } catch (x) { d = null; }
      if (b.getAttribute('data-act') === 'ask') ask(d);
      else if (b.getAttribute('data-act') === 'copy') {
        var done = function () { ui.toast('Mensagem copiada.', 'success'); };
        try { navigator.clipboard.writeText(d).then(done, function () { ui.toast('Selecione e copie o texto manualmente.', 'error'); }); } catch (x) { ui.toast('Selecione e copie o texto manualmente.', 'error'); }
      } else if (b.getAttribute('data-act') === 'task' && d) {
        var v = new Date(); v.setDate(v.getDate() + 1); v.setHours(10, 0, 0, 0);
        S.upsert('tarefas', { leadId: d.leadId, tipo: 'ligacao', titulo: d.titulo, responsavelId: SP.session.userId, vencimento: v.toISOString(), concluida: false });
        S.log('criar', 'tarefa', d.leadId, 'Criada pelo Assistente IA: ' + d.titulo); ui.toast('Tarefa criada para amanhã às 10h.', 'success'); b.disabled = true;
      }
    });
    var q = params && params.query && params.query.q;
    if (q) { try { history.replaceState(null, '', '#/assistente'); } catch (x) { /* ignora */ } setTimeout(function () { ask(q); }, 150); }
    else if (window.matchMedia && window.matchMedia('(min-width: 800px)').matches) input.focus();
  }

  SP.register({ route: 'assistente', title: 'Assistente IA', icon: 'sparkle', group: '', order: 1, roles: ALL, render: render });

  /* ---------- botão flutuante ---------- */
  function fab() {
    if (document.getElementById('as-fab')) return;
    var a = document.createElement('a'); a.id = 'as-fab'; a.className = 'as-fab'; a.href = '#/assistente'; a.setAttribute('aria-label', 'Abrir Assistente IA'); a.title = 'Assistente IA';
    a.innerHTML = ui.icon('sparkle', 22) + '<span>Assistente</span>'; document.body.appendChild(a);
    function upd() { var on = /^#\/assistente/.test(location.hash); a.style.display = on ? 'none' : ''; }
    window.addEventListener('hashchange', upd); upd();
  }
  if (document.body) fab(); else document.addEventListener('DOMContentLoaded', fab);
})();
