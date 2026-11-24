/* Módulo: Conversas (#/conversas, #/conversas/<id>) - caixa de entrada estilo WhatsApp Web + painel IA. */
(function () {
  'use strict';
  var ui = SP.ui, esc = ui.esc, store = SP.store;
  var filt = { canal: '', vend: '', sem: false, q: '' };
  var iaOpen = false, summaries = {}, timers = {};

  var QUICK = [
    ['Saudação', 'Olá! Aqui é da Solar Prime. Como posso ajudar com a sua economia de energia?'],
    ['Pedir conta de luz', 'Pode me enviar uma foto da sua última conta de luz? Com ela faço a simulação certinha.'],
    ['Enviar proposta', 'Preparei sua proposta personalizada. Vou te enviar agora para você analisar com calma.'],
    ['Financiamento', 'Temos financiamento em até 84x, com parcela menor que a sua conta de luz atual.'],
    ['Agendar visita', 'Podemos agendar uma visita técnica gratuita? Qual o melhor dia e horário para você?'],
    ['Follow-up', 'Oi! Passando para saber se ficou alguma dúvida sobre a proposta. Posso ajudar?']
  ];
  var REPLIES = ['Entendi, vou ver isso com a minha esposa e te falo.', 'Qual seria o valor da parcela?', 'Ok, pode mandar sim!', 'Achei um pouco caro, tem desconto?', 'Quanto tempo leva a instalação?', 'Beleza, obrigado!', 'Posso pagar no cartão?', 'Qual a garantia dos painéis?'];
  var OBJ = [
    ['Preço alto', /caro|desconto|valor alto|muito alto/i],
    ['Medo de financiamento', /financ|parcel|juros|banco/i],
    ['Dúvida sobre payback', /payback|retorno|compensa|se paga/i],
    ['Vai consultar família', /espos|marido|famil|c[oô]njuge/i],
    ['Comparando concorrentes', /concorr|outra empresa|outro or[cç]amento|or[cç]amento de/i],
    ['Dúvida sobre garantia', /garantia|manuten|defeito/i],
    ['Quer pensar', /vou pensar|mais pra frente|sem pressa/i]
  ];

  function myConvs() {
    var s = SP.session;
    return store.collection('conversas').filter(function (c) {
      var l = store.lead(c.leadId); if (!l) return false;
      return s.role === 'dono' || l.vendedorId === s.userId;
    });
  }
  function lastMsg(c) { return c.mensagens[c.mensagens.length - 1]; }
  function pending(c) { var m = lastMsg(c); return !!m && m.de === 'cliente'; }
  function waitMin(c) { return pending(c) ? (Date.now() - new Date(lastMsg(c).em).getTime()) / 60000 : 0; }
  function hhmm(iso) { var d = new Date(iso); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function dayLabel(iso) {
    var d = new Date(iso), n = new Date(), a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var diff = Math.round((b - a) / 86400000);
    return diff === 0 ? 'Hoje' : diff === 1 ? 'Ontem' : ui.fmtDate(iso);
  }
  function listTime(iso) { var d = dayLabel(iso); return d === 'Hoje' ? hhmm(iso) : d === 'Ontem' ? 'Ontem' : ui.fmtDate(iso).slice(0, 5); }

  /* ---------- IA: análise por palavras-chave ---------- */
  function analyze(c) {
    var l = store.lead(c.leadId), txt = c.mensagens.map(function (m) { return m.texto; }).join(' \n ');
    var cli = c.mensagens.filter(function (m) { return m.de === 'cliente'; }).map(function (m) { return m.texto; }).join(' \n ');
    var found = [];
    OBJ.forEach(function (o) { if (o[1].test(cli)) found.push(o[0]); });
    var kwh = null, conta = null, m;
    if ((m = txt.match(/(\d{2,4})\s*kwh/i))) kwh = parseInt(m[1], 10);
    if ((m = txt.match(/R\$\s*(\d{2,5}(?:[.,]\d{1,2})?)/i))) conta = parseFloat(m[1].replace(',', '.')) || null;
    var fin = /financ|parcel|juros|banco|60x|84x/i.test(txt);
    var interesse = /proposta|or[cç]amento|simula|instal|quando|pre[cç]o|valor/i.test(cli) ? 'Alto: pediu valores/proposta' : cli ? 'Moderado: conversando' : 'Baixo: sem mensagens do cliente';
    var score = 30 + Math.round((l.score || 40) * 0.4);
    if (/proposta|simula|instal|fechar|contrato|pagar|quando/i.test(cli)) score += 18;
    if (fin) score += 6;
    score -= found.length * 5;
    if (waitMin(c) > 240) score -= 8;
    score = Math.max(5, Math.min(98, score));
    var obj = Array.from(new Set(found.concat(l.objecoes || [])));
    var next = /proposta/i.test(txt) && /visita|agendar/i.test(txt) ? 'Fazer follow-up da proposta e pedir decisão' :
      !kwh && !l.consumoKwh ? 'Pedir conta de luz para dimensionar o sistema' :
      found.indexOf('Medo de financiamento') >= 0 || fin ? 'Enviar simulação de financiamento em 60x/84x' :
      found.indexOf('Preço alto') >= 0 ? 'Mostrar economia/payback e condição especial' :
      'Enviar proposta e agendar ligação de fechamento';
    return { consumo: kwh || l.consumoKwh, conta: conta || l.valorConta, interesse: interesse, objecao: obj[0] || 'Nenhuma detectada', objs: obj, fin: fin ? 'Sim, cliente cogitou financiar' : 'Não mencionado', next: next, score: score, kwhMsg: kwh, contaMsg: conta };
  }

  /* ---------- render ---------- */
  SP.register({
    route: 'conversas', title: 'Conversas', icon: 'chat', group: 'Vendas', order: 12, roles: ['dono', 'vendedor'],
    render: function (el, params) {
      var all = myConvs().sort(function (a, b) { return new Date(b.atualizadoEm) - new Date(a.atualizadoEm); });
      var cur = params.id ? store.find('conversas', params.id) : null;
      if (cur && all.indexOf(cur) < 0) cur = null;
      var isDono = SP.session.role === 'dono';
      el.classList.add('cv-page');
      el.innerHTML = '<div class="cv-wrap' + (cur ? ' cv-has-chat' : '') + (iaOpen ? ' cv-ia-open' : '') + '">' +
        '<aside class="cv-list card"><div class="cv-filters"></div><div class="cv-items"></div></aside>' +
        '<section class="cv-chat card"></section><aside class="cv-ia card"></aside></div>';
      var filtersEl = el.querySelector('.cv-filters'), itemsEl = el.querySelector('.cv-items');
      var chatEl = el.querySelector('.cv-chat'), iaEl = el.querySelector('.cv-ia');

      var vends = store.vendedores();
      filtersEl.innerHTML = '<div class="cv-title"><b>Conversas</b><span class="badge badge-orange">' + all.filter(function (c) { return c.naoLidas > 0; }).length + ' não lidas</span></div>' +
        '<input class="input cv-search" placeholder="Buscar cliente ou mensagem..." value="' + esc(filt.q) + '">' +
        '<div class="cv-frow"><select class="input" data-f="canal"><option value="">Todos os canais</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option></select>' +
        (isDono ? '<select class="input" data-f="vend"><option value="">Todos vendedores</option>' + vends.map(function (v) { return '<option value="' + v.id + '">' + esc(v.nome.split(' ')[0]) + '</option>'; }).join('') + '</select>' : '') +
        '</div><label class="cv-check"><input type="checkbox" data-f="sem"' + (filt.sem ? ' checked' : '') + '> Só sem resposta (cliente aguardando)</label>';
      filtersEl.querySelectorAll('select').forEach(function (s) {
        s.value = filt[s.getAttribute('data-f')];
        s.addEventListener('change', function () { filt[s.getAttribute('data-f')] = s.value; drawItems(); });
      });
      filtersEl.querySelector('[data-f=sem]').addEventListener('change', function (e) { filt.sem = e.target.checked; drawItems(); });
      filtersEl.querySelector('.cv-search').addEventListener('input', function (e) { filt.q = e.target.value; drawItems(); });

      function drawItems() {
        var list = all.filter(function (c) {
          var l = store.lead(c.leadId);
          if (filt.canal && c.canal !== filt.canal) return false;
          if (filt.vend && l.vendedorId !== filt.vend) return false;
          if (filt.sem && !pending(c)) return false;
          if (filt.q) { var q = filt.q.toLowerCase(); if (l.nome.toLowerCase().indexOf(q) < 0 && !c.mensagens.some(function (m) { return m.texto.toLowerCase().indexOf(q) >= 0; })) return false; }
          return true;
        });
        itemsEl.innerHTML = list.length ? list.map(function (c) {
          var l = store.lead(c.leadId), lm = lastMsg(c), w = waitMin(c), v = store.user(l.vendedorId);
          var late = w > 60;
          return '<a class="cv-item' + (cur && cur.id === c.id ? ' active' : '') + '" href="#/conversas/' + c.id + '">' +
            '<div class="cv-av">' + ui.avatar(l.nome, { size: 40 }) + '<span class="cv-ch cv-ch-' + c.canal + '">' + ui.icon(c.canal, 12) + '</span></div>' +
            '<div class="cv-it-body"><div class="cv-it-top"><b class="cv-name">' + esc(l.nome) + '</b><span class="cv-time' + (late ? ' late' : '') + '">' + (lm ? listTime(lm.em) : '') + '</span></div>' +
            '<div class="cv-it-bot"><span class="cv-last">' + (lm ? (lm.de === 'vendedor' ? 'Você: ' : '') + esc(lm.texto) : 'Sem mensagens') + '</span>' + (c.naoLidas > 0 ? '<span class="cv-unread">' + c.naoLidas + '</span>' : '') + '</div>' +
            '<div class="cv-it-meta">' + (isDono && v ? '<span class="muted text-sm">' + esc(v.nome.split(' ')[0]) + '</span>' : '') + (late ? '<span class="cv-wait">Sem resposta há ' + ui.fmtDuration(w) + '</span>' : '') + '</div></div></a>';
        }).join('') : ui.empty({ icon: 'chat', title: 'Nenhuma conversa', text: 'Ajuste os filtros para ver mais.' });
      }
      drawItems();

      if (!cur) {
        chatEl.innerHTML = '<div class="cv-placeholder">' + ui.empty({ icon: 'chat', title: 'Selecione uma conversa', text: 'Escolha um cliente na lista para ver as mensagens.' }) + '</div>';
        iaEl.innerHTML = '';
        return;
      }
      if (cur.naoLidas > 0) store.patch('conversas', cur.id, { naoLidas: 0 });
      var lead = store.lead(cur.leadId), vend = store.user(lead.vendedorId);
      var timerKey = cur.id;

      chatEl.innerHTML = '<header class="cv-head"><a class="btn btn-ghost btn-icon cv-back" href="#/conversas" aria-label="Voltar">' + ui.icon('x', 18) + '</a>' +
        ui.avatar(lead.nome, { size: 38 }) + '<div class="grow"><b>' + esc(lead.nome) + '</b><div class="muted text-sm">' + (cur.canal === 'whatsapp' ? 'WhatsApp' : 'Instagram') + ' · ' + esc(lead.telefone) + '</div></div>' +
        '<a class="btn btn-ghost btn-sm" href="#/leads/' + lead.id + '">Ver lead</a>' +
        '<button class="btn btn-sm cv-ia-toggle" data-act="ia">' + ui.icon('star', 14) + ' IA</button></header>' +
        (isDono ? '<div class="cv-banner">' + ui.icon('eye', 14) + '<span>Você está acompanhando a conversa de <b>' + esc(vend ? vend.nome : '-') + '</b> · 1ª resposta: <b>' + (lead.primeiraRespostaMin != null ? ui.fmtDuration(lead.primeiraRespostaMin) : '-') + '</b></span><button class="btn btn-sm" data-act="transfer">Transferir atendimento</button></div>' : '') +
        '<div class="cv-msgs"></div>' +
        ('<div class="cv-quick">' + QUICK.map(function (q, i) { return '<button class="chip" data-q="' + i + '">' + esc(q[0]) + '</button>'; }).join('') + '</div>' +
          '<form class="cv-composer"><input class="input" placeholder="Digite uma mensagem..." autocomplete="off"><button class="btn btn-primary" type="submit">' + ui.icon('send', 16) + ' <span>Enviar</span></button></form>' + (isDono ? '<div class="muted text-sm" style="padding:2px 12px 8px;opacity:.75">Enviando como gestor</div>' : ''));
      var msgsEl = chatEl.querySelector('.cv-msgs');
      var typing = false;
      function drawMsgs() {
        var last = '', h = '';
        cur.mensagens.forEach(function (m) {
          var d = dayLabel(m.em); if (d !== last) { h += '<div class="cv-day"><span>' + d + '</span></div>'; last = d; }
          h += '<div class="cv-bub ' + (m.de === 'vendedor' ? 'out' : 'in') + '">' + esc(m.texto) + '<span class="cv-bt">' + hhmm(m.em) + '</span></div>';
        });
        if (typing) h += '<div class="cv-bub in cv-typing">digitando...</div>';
        msgsEl.innerHTML = h || '<div class="muted" style="text-align:center">Nenhuma mensagem ainda.</div>';
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
      drawMsgs();

      chatEl.querySelector('[data-act=ia]').addEventListener('click', function () { iaOpen = !iaOpen; el.querySelector('.cv-wrap').classList.toggle('cv-ia-open', iaOpen); });
      var tr = chatEl.querySelector('[data-act=transfer]');
      if (tr) tr.addEventListener('click', function () {
        var body = '<div class="form"><label class="full">Novo vendedor responsável<select id="cvTo">' + vends.filter(function (v) { return v.id !== lead.vendedorId; }).map(function (v) { return '<option value="' + v.id + '">' + esc(v.nome) + '</option>'; }).join('') + '</select></label></div>';
        ui.modal({ title: 'Transferir atendimento', body: body, size: 'sm', actions: [{ label: 'Cancelar' }, { label: 'Transferir', cls: 'btn-primary', onClick: function (ctx) {
          var to = ctx.body.querySelector('#cvTo').value, u = store.user(to);
          store.patch('leads', lead.id, { vendedorId: to });
          store.log('transferiu atendimento', 'conversa', cur.id, lead.nome + ' de ' + (vend ? vend.nome : '-') + ' para ' + u.nome);
          ui.toast('Atendimento transferido para ' + u.nome, 'success'); SP.refresh();
        } }] });
      });

      function send(text) {
        text = (text || '').trim(); if (!text) return;
        cur.mensagens.push({ id: store.nextId('m'), de: 'vendedor', texto: text, em: new Date().toISOString() });
        cur.atualizadoEm = new Date().toISOString(); store.save();
        if (lead.primeiraRespostaMin == null) store.patch('leads', lead.id, { primeiraRespostaMin: 5 });
        store.log('enviou mensagem', 'conversa', cur.id, lead.nome + ' (' + cur.canal + ')');
        drawMsgs(); drawItems();
        if (Math.random() < 0.6) {
          clearTimeout(timers[timerKey]);
          timers[timerKey] = setTimeout(function () {
            if (el.isConnected) { typing = true; drawMsgs(); }
            timers[timerKey] = setTimeout(function () { typing = false; push(); }, 900);
          }, 1100);
        }
      }
      function push() {
        cur.mensagens.push({ id: store.nextId('m'), de: 'cliente', texto: REPLIES[Math.floor(Math.random() * REPLIES.length)], em: new Date().toISOString() });
        var visible = el.isConnected && location.hash.indexOf(cur.id) >= 0;
        cur.naoLidas = visible ? 0 : (cur.naoLidas || 0) + 1; cur.atualizadoEm = new Date().toISOString(); store.save();
        if (visible) { drawMsgs(); drawItems(); }
      }
      var form = chatEl.querySelector('.cv-composer');
      if (form) {
        var inp = form.querySelector('input');
        form.addEventListener('submit', function (e) { e.preventDefault(); send(inp.value); inp.value = ''; inp.focus(); });
        chatEl.querySelectorAll('[data-q]').forEach(function (b) { b.addEventListener('click', function () { inp.value = QUICK[b.getAttribute('data-q')][1]; inp.focus(); }); });
      }

      function drawIA() {
        var a = analyze(cur), s = summaries[cur.id];
        var tone = a.score >= 65 ? 'green' : a.score >= 40 ? 'amber' : 'red';
        var h = '<div class="cv-ia-head"><b>' + ui.icon('star', 16) + ' Assistente IA</b><button class="btn btn-ghost btn-icon cv-ia-close" aria-label="Fechar">' + ui.icon('x', 16) + '</button></div>' +
          '<div class="cv-sec"><div class="muted text-sm">Intenção de compra</div><div class="cv-meter"><div class="cv-meter-bar cv-' + tone + '" style="width:' + a.score + '%"></div></div><div class="text-sm"><b>' + a.score + '%</b> · ' + (a.score >= 65 ? 'Quente' : a.score >= 40 ? 'Morno' : 'Frio') + '</div></div>' +
          '<div class="cv-sec"><div class="muted text-sm">Objeções detectadas</div><div class="cv-chips">' + (a.objs.length ? a.objs.map(function (o) { return '<span class="badge badge-red">' + esc(o) + '</span>'; }).join('') : '<span class="muted text-sm">Nenhuma</span>') + '</div></div>';
        if (s === 'loading') h += '<div class="cv-sec cv-loading"><span class="cv-spin"></span> Analisando conversa...</div>';
        else if (s) h += '<div class="cv-sec cv-summary"><div class="cv-sum-row"><span>Consumo</span><b>' + (s.consumo ? ui.fmtNum(s.consumo) + ' kWh/mês' : 'Não informado') + '</b></div>' +
          '<div class="cv-sum-row"><span>Conta de luz</span><b>' + (s.conta ? ui.fmtMoney(s.conta) : 'Não informada') + '</b></div>' +
          '<div class="cv-sum-row"><span>Interesse</span><b>' + esc(s.interesse) + '</b></div>' +
          '<div class="cv-sum-row"><span>Principal objeção</span><b>' + esc(s.objecao) + '</b></div>' +
          '<div class="cv-sum-row"><span>Financiamento</span><b>' + esc(s.fin) + '</b></div>' +
          '<div class="cv-sum-row cv-next"><span>Próxima ação sugerida</span><b>' + esc(s.next) + '</b></div>' +
          '<button class="btn btn-primary btn-sm" data-act="reg">Registrar no cadastro</button></div>';
        h += '<div class="cv-sec"><button class="btn btn-sm" data-act="sum"' + (s === 'loading' ? ' disabled' : '') + '>' + ui.icon('refresh', 14) + ' ' + (s && s !== 'loading' ? 'Resumir novamente' : 'Resumir conversa') + '</button></div>' +
          '<div class="cv-sec"><a class="btn btn-primary" style="width:100%;justify-content:center" href="#/propostas?lead=' + lead.id + '">' + ui.icon('file', 16) + ' Enviar proposta</a></div>' +
          '<div class="cv-sec muted text-sm">Lead: ' + ui.badgeEtapa(lead.etapa) + '<br>Score ' + (lead.score || 0) + ' · ' + esc(lead.cidade) + '</div>';
        iaEl.innerHTML = h;
        iaEl.querySelector('.cv-ia-close').addEventListener('click', function () { iaOpen = false; el.querySelector('.cv-wrap').classList.remove('cv-ia-open'); });
        iaEl.querySelector('[data-act=sum]').addEventListener('click', function () {
          summaries[cur.id] = 'loading'; drawIA();
          setTimeout(function () { summaries[cur.id] = analyze(cur); if (el.isConnected) drawIA(); }, 1400);
        });
        var br = iaEl.querySelector('[data-act=reg]');
        if (br) br.addEventListener('click', function () {
          var sm = summaries[cur.id], patch = {};
          if (sm.kwhMsg) patch.consumoKwh = sm.kwhMsg;
          if (sm.contaMsg) patch.valorConta = sm.contaMsg;
          patch.objecoes = sm.objs;
          patch.interacoes = (lead.interacoes || []).concat([{ em: new Date().toISOString(), tipo: cur.canal, texto: 'Resumo IA: ' + sm.interesse + '. Objeção: ' + sm.objecao + '. Próxima: ' + sm.next, porId: SP.session.userId }]);
          store.patch('leads', lead.id, patch);
          var venc = new Date(Date.now() + 86400000); venc.setHours(10, 0, 0, 0);
          store.upsert('tarefas', { leadId: lead.id, tipo: 'followup', titulo: sm.next + ' - ' + lead.nome.split(' ')[0], responsavelId: lead.vendedorId, vencimento: venc.toISOString(), concluida: false });
          store.log('registrou resumo IA', 'lead', lead.id, 'Campos atualizados e follow-up criado');
          ui.toast('Cadastro atualizado e follow-up criado para amanhã', 'success');
        });
      }
      drawIA();
    }
  });
})();
