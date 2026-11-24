/* Módulo: Contratos (#/contratos, #/contratos/<id>, #/contratos?proposta=<id>). */
(function () {
  'use strict';
  var U = SP.ui, esc = U.esc, M = function (v, c) { return U.fmtMoney(v, c); };
  var ANEXOS = [['rg', 'RG / CNH do contratante'], ['comprovante', 'Comprovante de residência'], ['conta', 'Conta de luz recente'], ['imovel', 'Documento do imóvel']];
  function emp() { return SP.store.get().empresa || { nome: 'Solar Prime' }; }
  function etapaIdx(id) { var a = SP.consts.ETAPAS, i; for (i = 0; i < a.length; i++) if (a[i].id === id) return i; return -1; }
  function hash(s) { var h = 2166136261, i; for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16; return (h >>> 0).toString(16).padStart(8, '0'); }
  function mockHash(seed) { return ['', 'a', 'b', 'c', 'd', 'e', 'f', 'g'].map(function (k) { return hash(seed + k); }).join('').toUpperCase(); }
  function mockIp() { return '187.' + (20 + Math.floor(Math.random() * 200)) + '.' + Math.floor(Math.random() * 255) + '.' + (1 + Math.floor(Math.random() * 254)); }
  function propOf(c) { return SP.store.find('propostas', c.propostaId) || {}; }

  /* ---------- dados de assinatura (sintetizados de forma determinística para contratos do seed) ---------- */
  var DEVS = ['iPhone 13 · Safari', 'Samsung Galaxy S22 · Chrome', 'iPhone 14 Pro · Safari', 'Motorola Edge 30 · Chrome', 'Xiaomi Redmi Note 12 · Chrome'];
  function rnd(seed, k) { return (parseInt(hash(seed + ':' + k), 16) % 10000) / 10000; }
  function sigSvg(nome, seed) {
    var parts = String(nome || 'Cliente').replace(/\s+(da|de|do|dos|das|e)\s+/gi, ' ').trim().split(/\s+/), txt = (parts[0] + ' ' + (parts.length > 1 ? parts[parts.length - 1] : '')).trim();
    var n = Math.min(txt.length, 13), st = 270 / n, d = 'M10 78', i, x, up, lo;
    for (i = 0; i < n; i++) {
      x = 10 + i * st; up = 22 + rnd(seed, i) * 34; lo = 6 + rnd(seed, i + 40) * 16;
      if (txt.charAt(i) === ' ') { d += ' M' + (x + st * .3).toFixed(1) + ' 72'; continue; }
      d += ' C' + (x + st * 1.15).toFixed(1) + ' ' + (78 - up).toFixed(1) + ' ' + (x - st * .25).toFixed(1) + ' ' + (78 - up * .8).toFixed(1) + ' ' + (x + st * .45).toFixed(1) + ' 78 S' + (x + st * .9).toFixed(1) + ' ' + (78 + lo).toFixed(1) + ' ' + (x + st).toFixed(1) + ' 74';
    }
    d += ' M18 98 Q150 ' + (84 + rnd(seed, 99) * 8).toFixed(1) + ' 292 ' + (90 + rnd(seed, 98) * 6).toFixed(1);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 110"><path d="' + d + '" fill="none" stroke="#1E3A8A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  function sigData(c) {
    var a = c.assinatura || {}, seed = String(c.id || c.numero || 'x'), l = SP.store.lead(c.leadId) || {}, MIN = 6e4;
    var em = c.assinadoEm || a.em || c.criadoEm || new Date().toISOString(), tEm = new Date(em).getTime(), tCr = new Date(c.criadoEm || em).getTime();
    var vis = Math.max(tCr + 2 * MIN, tEm - (4 + Math.floor(rnd(seed, 'v') * 20)) * MIN), env = Math.max(tCr + MIN, Math.min(vis - 3 * MIN, tCr + (2 + Math.floor(rnd(seed, 'e') * 6)) * MIN));
    vis = Math.max(vis, env + MIN); var tEm2 = Math.max(tEm, vis + MIN);
    var h0 = a.hash ? String(a.hash) : '', hh = (h0.length >= 64 ? h0 : h0 + mockHash(seed).slice(h0.length)).slice(0, 64);
    var ip = a.ip || ('187.' + (20 + Math.floor(rnd(seed, 'i1') * 200)) + '.' + Math.floor(rnd(seed, 'i2') * 250) + '.' + (2 + Math.floor(rnd(seed, 'i3') * 250)));
    return {
      em: new Date(tEm2).toISOString(), criadoEm: new Date(tCr).toISOString(), enviadoEm: new Date(env).toISOString(), visualizadoEm: new Date(vis).toISOString(), concluidoEm: new Date(tEm2 + 40000).toISOString(),
      ip: ip, ipEnvio: '200.' + (150 + Math.floor(rnd(seed, 'a') * 80)) + '.' + Math.floor(rnd(seed, 'b') * 250) + '.' + (2 + Math.floor(rnd(seed, 'c') * 250)),
      dispositivo: a.dispositivo || DEVS[Math.floor(rnd(seed, 'd') * DEVS.length) % DEVS.length], geo: a.geo || ((l.cidade || 'São Paulo') + ', Brasil'),
      hash: hh.toUpperCase(), img: a.img || sigSvg(l.nome, seed), tel: l.telefone || ''
    };
  }
  function repOf(c) { var u = SP.store.user && SP.store.user(c.vendedorId); return u && u.nome ? u.nome : 'Representante Solar Prime'; }
  function qrHtml(seed) {
    var N = 21, h = '', r, k, on;
    function fr(r, k, a, b) { var x = r - a, y = k - b; if (x < 0 || y < 0 || x > 6 || y > 6) return null; return (x === 0 || y === 0 || x === 6 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) ? 1 : 0; }
    for (r = 0; r < N; r++) for (k = 0; k < N; k++) {
      on = fr(r, k, 0, 0); if (on === null) on = fr(r, k, 0, N - 7); if (on === null) on = fr(r, k, N - 7, 0);
      if (on === null) on = ((r < 8 && k < 8) || (r < 8 && k > N - 9) || (r > N - 9 && k < 8)) ? 0 : (rnd(seed, r * 31 + k) > .5 ? 1 : 0);
      h += '<i' + (on ? ' class="on"' : '') + '></i>';
    }
    return '<div class="ctr-qr">' + h + '</div>';
  }
  function certHtml(c) {
    var S = sigData(c), E = emp(), l = SP.store.lead(c.leadId) || {}, DT = U.fmtDateTime;
    var ev = [['Contrato criado', S.criadoEm, 'Gerado por ' + esc(repOf(c)) + ' a partir da proposta aprovada.', 'file'], ['Enviado por WhatsApp', S.enviadoEm, 'Link seguro enviado para ' + esc(S.tel || 'o cliente') + ' · IP origem ' + esc(S.ipEnvio), 'whatsapp'], ['Visualizado pelo cliente', S.visualizadoEm, 'Documento aberto no navegador · ' + esc(S.dispositivo), 'eye'], ['Assinado eletronicamente', S.em, 'IP ' + esc(S.ip) + ' · ' + esc(S.dispositivo) + ' · ' + esc(S.geo), 'check'], ['Concluído', S.concluidoEm, 'Todas as partes assinaram. Cópia selada enviada ao cliente.', 'contract']];
    return '<div class="ctr-doc ctr-cert"><div class="ctr-doc-head"><div class="ctr-logo">' + U.icon('bolt', 26) + '<div><b>' + esc(E.nome) + '</b><small>Certificado de assinatura eletrônica</small></div></div><div class="ctr-doc-num"><b>' + esc(c.numero) + '</b><span>Emitido em ' + DT(S.concluidoEm) + '</span></div></div>' +
      '<h2>Certificado de assinatura eletrônica</h2><div class="ctr-cert-grid"><div><h4>Trilha de eventos</h4><ol class="ctr-tl">' + ev.map(function (e) { return '<li><span class="ctr-tl-dot">' + U.icon(e[3], 14) + '</span><div><b>' + e[0] + '</b><small>' + DT(e[1]) + '</small><span>' + e[2] + '</span></div></li>'; }).join('') + '</ol></div>' +
      '<div class="ctr-cert-qr">' + qrHtml(String(c.id) + 'qr') + '<b>Verificar autenticidade</b><small>Aponte a câmera ou acesse solarprime.com.br/verificar</small></div></div>' +
      '<h4>Signatários e evidências</h4><table class="ctr-doc-table"><tr><td>Contratante</td><td>' + esc(l.nome || '-') + ' · CPF/CNPJ ' + esc(l.cpfCnpj || '-') + '</td></tr><tr><td>Contratada</td><td>' + esc(E.nome) + ' · representada por ' + esc(repOf(c)) + '</td></tr><tr><td>Dispositivo</td><td>' + esc(S.dispositivo) + '</td></tr><tr><td>Endereço IP</td><td>' + esc(S.ip) + '</td></tr><tr><td>Geolocalização</td><td>' + esc(S.geo) + '</td></tr><tr><td>Hash SHA-256</td><td class="ctr-hash">' + esc(S.hash) + '</td></tr></table>' +
      '<p class="ctr-validity">' + U.icon('contract', 14) + ' Assinatura eletrônica com validade jurídica conforme a Lei 14.063/2020 e a MP 2.200-2/2001. A integridade do documento é garantida pelo hash acima: qualquer alteração invalida a assinatura. (Demonstração: dados simulados.)</p></div>';
  }

  /* ---------- texto do contrato ---------- */
  function docHtml(c) {
    var E = emp(), l = SP.store.lead(c.leadId) || {}, p = propOf(c), sig = c.status === 'assinado', S = sig ? sigData(c) : null;
    var b = p.builder || {}, pg = p.pagamentoDescricao || (c.formaPagamento || 'A combinar');
    var cl = [
      ['Objeto', 'Fornecimento, instalação e homologação de sistema de geração fotovoltaica de ' + (p.potenciaKwp || '-') + ' kWp, composto por ' + (p.modulos || '-') + ' módulos ' + esc(p.moduloModelo || '') + ' e inversor ' + esc(p.inversor || '') + ', incluindo estrutura de fixação, cabeamento, proteções, projeto e homologação junto à concessionária' + (l.concessionaria ? ' ' + esc(l.concessionaria) : '') + '.'],
      ['Valor e pagamento', 'O valor total é de ' + M(c.valor) + '. Forma de pagamento: ' + esc(pg) + '. O atraso sujeita o CONTRATANTE a multa de 2% e juros de 1% a.m.'],
      ['Prazos', 'A CONTRATADA realizará a instalação em até 45 dias corridos após a assinatura e a aprovação do projeto pela concessionária. A conexão à rede depende de vistoria e troca do medidor pela concessionária, fora do controle da CONTRATADA.'],
      ['Garantias', 'Módulos: 12 anos contra defeitos de fabricação e 25 anos de performance linear. Inversor: 10 anos. Serviço de instalação: 5 anos. A garantia não cobre danos por mau uso, intervenção de terceiros ou eventos da natureza.'],
      ['Obrigações do contratante', 'Fornecer documentos e acesso ao local, garantir a integridade estrutural do telhado e manter o imóvel em condições para a instalação.'],
      ['Geração estimada', 'As estimativas de geração e economia são projeções e não constituem garantia de resultado, podendo variar com clima, sombreamento e tarifas.'],
      ['Rescisão', 'A rescisão após a compra dos equipamentos implica multa de 10% do valor do contrato, além dos custos já incorridos.'],
      ['Foro', 'Fica eleito o foro da comarca de ' + esc(E.cidade || 'Campinas - SP') + ' para dirimir quaisquer questões deste contrato.']
    ];
    return '<div class="ctr-doc"><div class="ctr-doc-head"><div class="ctr-logo">' + U.icon('bolt', 26) + '<div><b>' + esc(E.nome) + '</b><small>CNPJ ' + esc(E.cnpj || '') + ' · ' + esc(E.cidade || '') + '</small></div></div><div class="ctr-doc-num"><b>CONTRATO ' + esc(c.numero || 'RASCUNHO') + '</b><span>Proposta ' + esc(p.numero || '-') + '</span><span>' + U.fmtDate(c.criadoEm || new Date().toISOString()) + '</span></div></div>' +
      '<h2>Contrato de venda e instalação de sistema fotovoltaico</h2>' +
      '<h4>Partes</h4><p><b>CONTRATADA:</b> ' + esc(E.nome) + ', CNPJ ' + esc(E.cnpj || '') + ', ' + esc(E.cidade || '') + '.<br><b>CONTRATANTE:</b> ' + esc(l.nome || b.cliente || '-') + ', CPF/CNPJ ' + esc(l.cpfCnpj || b.cpf || '-') + ', telefone ' + esc(l.telefone || '-') + ', endereço de instalação: ' + esc(l.endereco || b.endereco || '') + ', ' + esc(l.cidade || b.cidade || '') + '.</p>' +
      '<h4>Resumo comercial</h4><table class="ctr-doc-table"><tr><td>Sistema</td><td>' + (p.potenciaKwp || '-') + ' kWp · ' + (p.modulos || '-') + ' módulos</td></tr><tr><td>Inversor</td><td>' + esc(p.inversor || '-') + '</td></tr><tr><td>Geração estimada</td><td>' + (p.geracaoMensalKwh || '-') + ' kWh/mês</td></tr><tr><td>Valor total</td><td><b>' + M(c.valor) + '</b></td></tr><tr><td>Pagamento</td><td>' + esc(pg) + '</td></tr></table>' +
      '<h4>Cláusulas</h4><ol>' + cl.map(function (x) { return '<li><b>' + x[0] + '.</b> ' + x[1] + '</li>'; }).join('') + '</ol>' +
      '<h4>Equipamentos</h4><table class="ctr-doc-table ctr-equip"><tr><th>Item</th><th>Qtd.</th><th>Descrição</th></tr><tr><td>Módulos fotovoltaicos</td><td>' + (p.modulos || '-') + '</td><td>' + esc(p.moduloModelo || '-') + '</td></tr><tr><td>Inversor</td><td>1</td><td>' + esc(p.inversor || '-') + '</td></tr><tr><td>Estrutura de fixação</td><td>1 kit</td><td>Perfis de alumínio e fixadores em aço inox</td></tr><tr><td>String box e proteções</td><td>1 kit</td><td>DPS, disjuntores e seccionadora CC/CA</td></tr><tr><td>Cabeamento solar</td><td>1 kit</td><td>Cabos 6 mm² com conectores MC4</td></tr><tr><td>Projeto e homologação</td><td>1</td><td>Projeto elétrico, ART e aprovação na concessionária</td></tr></table>' +
      '<div class="ctr-sign"><div><div class="ctr-line">' + (sig ? '<img src="' + S.img + '" alt="Assinatura do contratante">' : '') + (sig ? '<span class="ctr-stamp ctr-stamp-g">Assinado digitalmente<br><small>' + U.fmtDateTime(S.em) + '</small></span>' : '') + '</div><small>' + esc(l.nome || '') + ' (CONTRATANTE)</small></div><div><div class="ctr-line">' + (sig ? '<img src="' + sigSvg(repOf(c), 'rep' + c.id) + '" alt="Assinatura do representante">' : '') + '<span class="ctr-stamp">' + esc(E.nome) + (sig ? '<br><small>' + esc(E.cnpj || '') + '</small>' : '') + '</span></div><small>' + (sig ? esc(repOf(c)) + ' · ' : '') + esc(E.nome) + ' (CONTRATADA)</small></div></div>' +
      (sig ? '<p class="ctr-audit">Assinado eletronicamente em ' + U.fmtDateTime(S.em) + ' · IP ' + esc(S.ip) + ' · ' + esc(S.dispositivo) + ' · Hash SHA-256: ' + esc(S.hash) + '</p>' : '<p class="ctr-audit">Aguardando assinatura do contratante.</p>') + '</div>';
  }
  function printOverlay(c) {
    var d = document.createElement('div'); d.className = 'ctr-overlay';
    d.innerHTML = '<div class="ctr-toolbar"><b>Contrato ' + esc(c.numero || '') + '</b><span class="grow"></span><button class="btn btn-primary btn-sm" data-a="print">Baixar PDF (imprimir)</button><button class="btn btn-ghost btn-sm" data-a="x">Fechar</button></div><div class="ctr-sheet">' + docHtml(c) + (c.status === 'assinado' ? certHtml(c) : '') + '</div>';
    d.addEventListener('click', function (e) { var a = e.target.closest('[data-a]'); if (!a) return; if (a.dataset.a === 'x') { d.remove(); document.body.classList.remove('ctr-printing'); } else window.print(); });
    document.body.appendChild(d); document.body.classList.add('ctr-printing');
  }

  /* ---------- assinatura ---------- */
  function signModal(c, done) {
    var l = SP.store.lead(c.leadId) || {}, E = emp();
    var body = document.createElement('div');
    body.innerHTML = '<div class="ctr-phone"><div class="ctr-phone-notch"></div><div class="ctr-phone-screen"><div class="ctr-phone-bar">' + U.icon('whatsapp', 14) + ' ' + esc(E.nome) + ' · Assinatura digital</div><div class="ctr-phone-body"><p><b>Olá, ' + esc((l.nome || '').split(' ')[0]) + '!</b><br>Revise o contrato <b>' + esc(c.numero) + '</b> no valor de <b>' + M(c.valor) + '</b> e assine abaixo com o dedo.</p><div class="ctr-pad-wrap"><canvas class="ctr-pad" width="300" height="140"></canvas><span class="ctr-pad-hint">Assine aqui</span></div><label class="ctr-chk"><input type="checkbox" class="ctr-ok"> Li e concordo com os termos do contrato.</label><div class="ctr-phone-act"><button class="btn btn-ghost btn-sm" data-a="clear">Limpar</button><button class="btn btn-primary" data-a="sign">Assinar contrato</button></div></div></div></div><p class="muted text-sm" style="text-align:center">Simulação: desenhe a assinatura com o mouse ou o dedo, como o cliente faria no celular.</p>';
    var cv = body.querySelector('canvas'), ctx = cv.getContext('2d'), drawing = false, has = false;
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0F172A';
    function pos(e) { var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * cv.width / r.width, (t.clientY - r.top) * cv.height / r.height]; }
    function start(e) { e.preventDefault(); drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]); }
    function move(e) { if (!drawing) return; e.preventDefault(); var p = pos(e); ctx.lineTo(p[0], p[1]); ctx.stroke(); has = true; body.querySelector('.ctr-pad-hint').style.display = 'none'; }
    function end() { drawing = false; }
    ['mousedown', 'touchstart'].forEach(function (n) { cv.addEventListener(n, start, { passive: false }); });
    ['mousemove', 'touchmove'].forEach(function (n) { cv.addEventListener(n, move, { passive: false }); });
    ['mouseup', 'mouseleave', 'touchend'].forEach(function (n) { cv.addEventListener(n, end); });
    var m = U.modal({ title: 'Cliente assinando no celular', body: body, size: 'sm', actions: [] });
    body.addEventListener('click', function (e) {
      var a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'clear') { ctx.clearRect(0, 0, cv.width, cv.height); has = false; body.querySelector('.ctr-pad-hint').style.display = ''; return; }
      if (!has) return U.toast('Desenhe a assinatura primeiro.', 'error');
      if (!body.querySelector('.ctr-ok').checked) return U.toast('Marque que concorda com os termos.', 'error');
      var now = new Date().toISOString();
      m.close(); done({ img: cv.toDataURL('image/png'), ip: mockIp(), hash: mockHash(c.id + now + c.valor), em: now });
    });
  }
  function finishSign(c, sig) {
    SP.store.patch('contratos', c.id, { status: 'assinado', assinadoEm: sig.em, assinatura: { img: sig.img, ip: sig.ip, hash: sig.hash, dispositivo: 'Navegador do cliente (simulação)' } });
    var l = SP.store.lead(c.leadId), p = propOf(c);
    if (l) { l.etapa = 'venda_fechada'; l.interacoes = l.interacoes || []; l.interacoes.unshift({ em: sig.em, tipo: 'nota', texto: 'Contrato ' + c.numero + ' assinado digitalmente', porId: SP.session.userId }); SP.store.upsert('leads', l); }
    var obras = SP.store.collection('obras');
    if (!obras.some(function (o) { return o.contratoId === c.id; })) {
      var t0 = Date.now(), DAY = 864e5, tec = SP.store.collection('usuarios').filter(function (u) { return u.papel === 'tecnico'; })[0];
      var etapas = SP.consts.OBRA_ETAPAS.map(function (e, k) { return { id: e.id, status: k === 0 ? 'andamento' : 'pendente', previstaEm: new Date(t0 + (k + 1) * 4 * DAY).toISOString(), concluidaEm: null }; });
      var o = SP.store.upsert('obras', { id: SP.store.nextId('o'), leadId: c.leadId, contratoId: c.id, propostaId: c.propostaId, tecnicoId: tec ? tec.id : 'u7', cidade: l ? l.cidade : '', potenciaKwp: p.potenciaKwp || 0, modulos: p.modulos || 0, status: 'andamento', etapas: etapas, inicioEm: sig.em, previsaoEntrega: new Date(t0 + 45 * DAY).toISOString(), observacoes: 'Obra criada automaticamente após assinatura do contrato ' + c.numero + '.' });
      SP.store.log('criou obra', 'obra', o.id, 'A partir do contrato ' + c.numero);
    }
    SP.store.log('assinou contrato', 'contrato', c.id, c.numero + ' assinado (hash ' + sig.hash.slice(0, 12) + ')');
    U.toast('Contrato assinado com sucesso!', 'success'); setTimeout(function () { U.toast('Equipe técnica notificada: nova obra criada.', 'success'); }, 700);
  }

  /* ---------- telas ---------- */
  function renderList(el) {
    var f = el._f || 'todos', all = SP.store.collection('contratos').filter(function (c) { return SP.session.role !== 'vendedor' || c.vendedorId === SP.session.userId; });
    var aw = all.filter(function (c) { return c.status !== 'assinado'; }), sg = all.filter(function (c) { return c.status === 'assinado'; });
    var rows = (f === 'aguardando' ? aw : f === 'assinado' ? sg : all).slice().sort(function (a, b) { return new Date(b.criadoEm) - new Date(a.criadoEm); });
    var aprov = SP.store.collection('propostas').filter(function (p) { return (p.status === 'aprovada' || p.status === 'aceita') && !all.some(function (c) { return c.propostaId === p.id; }); });
    el.innerHTML = U.pageHeader('Contratos', 'Gere, envie e acompanhe assinaturas') +
      '<div class="kpi-grid">' + U.kpi({ label: 'Aguardando assinatura', value: aw.length, icon: 'clock', tone: aw.length ? 'orange' : 'green' }) + U.kpi({ label: 'Assinados', value: sg.length, icon: 'contract', tone: 'green' }) + U.kpi({ label: 'Valor assinado', value: M(sg.reduce(function (s, c) { return s + c.valor; }, 0), { compact: true }), icon: 'dollar', tone: 'blue' }) + U.kpi({ label: 'Propostas aprovadas sem contrato', value: aprov.length, icon: 'file', tone: aprov.length ? 'red' : 'green' }) + '</div>' +
      (aprov.length ? '<div class="card ctr-todo"><div class="card-title">Prontas para contrato</div>' + aprov.map(function (p) { var l = SP.store.lead(p.leadId) || {}; return '<div class="ctr-row"><div class="ctr-row-main"><b>' + esc(l.nome || '') + '</b><span class="muted text-sm">' + esc(p.numero) + ' · ' + M(p.valor) + '</span></div><a class="btn btn-primary btn-sm" href="#/contratos?proposta=' + p.id + '">Gerar contrato</a></div>'; }).join('') + '</div>' : '') +
      '<div class="tabs ctr-tabs">' + [['todos', 'Todos', all.length], ['aguardando', 'Aguardando assinatura', aw.length], ['assinado', 'Assinados', sg.length]].map(function (t) { return '<button class="tab' + (t[0] === f ? ' active' : '') + '" data-f="' + t[0] + '">' + t[1] + ' <small>' + t[2] + '</small></button>'; }).join('') + '</div>' +
      (rows.length ? '<div class="card ctr-list">' + rows.map(function (c) { var l = SP.store.lead(c.leadId) || { nome: '-' }; return '<div class="ctr-row" data-id="' + c.id + '"><div class="ctr-row-main"><b>' + esc(l.nome) + '</b><span class="muted text-sm">' + esc(c.numero) + ' · ' + esc(c.formaPagamento || '') + ' · ' + U.fmtDate(c.criadoEm) + '</span></div><div class="ctr-val">' + M(c.valor) + '</div>' + (c.status === 'assinado' ? '<img class="ctr-thumb" src="' + sigData(c).img + '" alt="Assinatura">' : '') + U.badge(c.status === 'assinado' ? 'Assinado' : 'Aguardando assinatura', c.status === 'assinado' ? 'green' : 'amber') + (c.status === 'assinado' ? '<a class="btn btn-sm" href="#/contratos/' + c.id + '">Ver contrato assinado</a>' : '') + '</div>'; }).join('') + '</div>' : '<div class="card">' + U.empty({ icon: 'contract', title: 'Nenhum contrato aqui', text: 'Aprove uma proposta e gere o contrato com um clique.' }) + '</div>');
    el.onclick = function (e) {
      var t = e.target.closest('[data-f],[data-id]'); if (!t || e.target.closest('a')) return;
      if (t.dataset.f) { el._f = t.dataset.f; renderList(el); } else SP.go('contratos/' + t.dataset.id);
    };
  }

  function renderDetail(el, c, novo) {
    var l = SP.store.lead(c.leadId) || {}, sig = c.status === 'assinado', ob;
    c.anexos = c.anexos || [];
    function draw() {
      var anx = ANEXOS.map(function (a) { var up = c.anexos.filter(function (x) { return x.tipo === a[0]; })[0]; return '<div class="ctr-anx' + (up ? ' ok' : '') + '"><div>' + U.icon('file', 18) + '<span><b>' + a[1] + '</b><small>' + (up ? esc(up.nome) + ' · enviado ' + U.fmtDate(up.em) : 'Pendente') + '</small></span></div><button class="btn btn-sm ' + (up ? 'btn-ghost' : '') + '" data-up="' + a[0] + '">' + (up ? 'Trocar' : 'Anexar') + '</button></div>'; }).join('');
      ob = sig ? SP.store.collection('obras').filter(function (o) { return o.contratoId === c.id; })[0] : null;
      var acts = sig ? '<button class="btn btn-primary" data-a="print">' + U.icon('download', 16) + ' Baixar PDF</button><button class="btn" data-a="reenviar">' + U.icon('whatsapp', 16) + ' Reenviar ao cliente</button>' + (ob ? '<a class="btn" href="#/obras/' + ob.id + '">Ver obra vinculada</a>' : '<a class="btn" href="#/obras">Ver obras</a>') + (l.id ? '<a class="btn btn-ghost" href="#/leads/' + l.id + '">Ver lead</a>' : '') :
        (novo ? '<button class="btn btn-primary btn-lg" data-a="gerar">' + U.icon('send', 16) + ' Gerar e enviar para assinatura</button>' : '<button class="btn" data-a="reenviar">' + U.icon('whatsapp', 16) + ' Reenviar link</button><button class="btn btn-primary" data-a="assinar">Simular assinatura do cliente</button>') + '<button class="btn btn-ghost" data-a="print">Imprimir</button>';
      el.innerHTML = U.pageHeader(novo ? 'Gerar contrato' : 'Contrato ' + c.numero, (l.nome || '') + ' · ' + M(c.valor), '<a class="btn btn-ghost" href="#/contratos">Voltar à lista</a> ' + (novo ? '' : (sig ? U.badge('Assinado', 'green') + ' ' + U.badge('Concluído', 'blue') + (ob ? ' ' + U.badge(ob.status === 'concluida' ? 'Obra concluída' : 'Obra em andamento', ob.status === 'concluida' ? 'green' : 'orange') : '') : U.badge('Aguardando assinatura', 'amber')))) +
        (novo ? '<div class="ctr-hint">' + U.icon('bolt', 16) + ' O contrato foi preenchido automaticamente com os dados da proposta. Confira e envie para assinatura.</div>' : '') +
        '<div class="ctr-actions">' + acts + '</div>' +
        '<div class="grid ctr-grid"><div class="ctr-preview">' + docHtml(c) + (sig ? certHtml(c) : '') + '</div><div class="card ctr-side"><div class="card-title">Documentos do cliente</div>' + anx + '<p class="muted text-sm">Upload simulado: nenhum arquivo sai do navegador.</p>' +
        (sig ? (function () { var S = sigData(c); return '<div class="card-title mt">Trilha de auditoria</div><ul class="ctr-aud"><li>Assinado em ' + U.fmtDateTime(S.em) + '</li><li>IP ' + esc(S.ip) + '</li><li>' + esc(S.dispositivo) + '</li><li class="ctr-hash">' + esc(S.hash) + '</li></ul>'; })() : '') + '</div></div>';
    }
    el.onclick = function (e) {
      var t = e.target.closest('[data-a],[data-up]'); if (!t) return;
      if (t.dataset.up) { var tipo = t.dataset.up, inp = document.createElement('input'); inp.type = 'file'; inp.onchange = function () { var nome = inp.files[0] ? inp.files[0].name : tipo + '.pdf'; c.anexos = c.anexos.filter(function (x) { return x.tipo !== tipo; }).concat([{ tipo: tipo, nome: nome, em: new Date().toISOString() }]); if (!novo) { SP.store.patch('contratos', c.id, { anexos: c.anexos }); SP.store.log('anexou documento', 'contrato', c.id, tipo); } U.toast('Documento anexado (simulado).', 'success'); draw(); }; inp.click(); return; }
      var a = t.dataset.a;
      if (a === 'print') printOverlay(c);
      else if (a === 'gerar') {
        var p = propOf(c), n = SP.store.collection('contratos').length + 1;
        c.id = SP.store.nextId('c'); c.numero = 'CT-2026-' + String(n).padStart(4, '0'); c.criadoEm = new Date().toISOString(); c.status = 'aguardando_assinatura';
        SP.store.upsert('contratos', c); novo = false;
        if (l.id) { if (etapaIdx(l.etapa) < etapaIdx('contrato_enviado') && l.etapa !== 'perdido') l.etapa = 'contrato_enviado'; l.interacoes = l.interacoes || []; l.interacoes.unshift({ em: c.criadoEm, tipo: 'whatsapp', texto: 'Link de assinatura do contrato ' + c.numero + ' enviado por WhatsApp', porId: SP.session.userId }); SP.store.upsert('leads', l); }
        SP.store.log('gerou contrato', 'contrato', c.id, c.numero + ' a partir da proposta ' + (p.numero || ''));
        history.replaceState(null, '', '#/contratos/' + c.id); U.toast('Link de assinatura enviado por WhatsApp para ' + (l.nome || 'o cliente') + ' (simulado).', 'success'); draw();
        U.modal({ title: 'Contrato enviado', body: '<p>O link foi enviado para <b>' + esc(l.telefone || 'o cliente') + '</b>. Quer ver como o cliente assina no celular?</p>', actions: [{ label: 'Depois', cls: 'btn-ghost' }, { label: 'Simular assinatura', cls: 'btn-primary', onClick: function () { setTimeout(function () { signModal(c, function (s) { finishSign(c, s); c = SP.store.find('contratos', c.id); draw(); }); }, 100); } }] });
      }
      else if (a === 'reenviar') { SP.store.log('reenviou link de assinatura', 'contrato', c.id, c.numero); U.toast('Link reenviado por WhatsApp (simulado).', 'success'); }
      else if (a === 'assinar') signModal(c, function (s) { finishSign(c, s); c = SP.store.find('contratos', c.id); sig = true; draw(); });
    };
    draw();
  }

  SP.register({
    route: 'contratos', title: 'Contratos', icon: 'contract', group: 'Vendas', order: 15, roles: ['dono', 'vendedor', 'financeiro'],
    render: function (el, params) {
      el.onclick = null; var q = params.query || {};
      if (params.id) { var c = SP.store.find('contratos', params.id); if (c) return renderDetail(el, c, false); }
      if (q.proposta) {
        var p = SP.store.find('propostas', q.proposta);
        if (p) {
          var ex = SP.store.where('contratos', function (x) { return x.propostaId === p.id; })[0];
          if (ex) return renderDetail(el, ex, false);
          return renderDetail(el, { leadId: p.leadId, propostaId: p.id, vendedorId: p.vendedorId, valor: p.valor, formaPagamento: p.formaPagamento, status: 'rascunho', criadoEm: new Date().toISOString(), anexos: [] }, true);
        }
      }
      renderList(el);
    }
  });
})();
