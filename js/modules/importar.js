(function () {
  var U = function () { return SP.ui; };
  var esc = function (s) { return SP.ui.esc(s == null ? '' : String(s)); };

  var FIELDS = [
    { k: 'nome', l: 'Nome', alias: ['nome', 'cliente', 'name', 'contato', 'razao', 'lead'] },
    { k: 'telefone', l: 'Telefone / WhatsApp', alias: ['telefone', 'tel', 'fone', 'whatsapp', 'celular', 'phone', 'zap'] },
    { k: 'email', l: 'E-mail', alias: ['email', 'e-mail', 'mail'] },
    { k: 'cpfCnpj', l: 'CPF / CNPJ', alias: ['cpf', 'cnpj', 'documento'] },
    { k: 'cidade', l: 'Cidade', alias: ['cidade', 'municipio', 'city'] },
    { k: 'consumoKwh', l: 'Consumo (kWh)', alias: ['consumo', 'kwh'] },
    { k: 'valorConta', l: 'Valor da conta (R$)', alias: ['conta', 'valor da conta', 'fatura', 'valorconta'] },
    { k: 'origem', l: 'Origem', alias: ['origem', 'fonte', 'source', 'canal'] },
    { k: 'vendedor', l: 'Vendedor', alias: ['vendedor', 'responsavel', 'owner', 'consultor'] },
    { k: 'etapa', l: 'Etapa do funil', alias: ['etapa', 'status', 'fase', 'stage'] }
  ];

  var SAMPLE = 'Nome;Telefone;Email;Cidade;Consumo kWh;Valor da conta;Origem;Vendedor;Etapa\n' +
    'Marcos Almeida;(11) 98877-1020;marcos@exemplo.com;São Paulo;520;489,90;Indicação;;Novo lead\n' +
    'Fernanda Lima;(21) 99123-4567;fernanda@exemplo.com;Niterói;340;310,00;Instagram;;Primeiro contato\n' +
    'Padaria Pão Quente;(31) 3222-9087;contato@paoquente.com;Belo Horizonte;1800;1650,00;Site;;Qualificação\n' +
    'Roberto Dias;(41) 98811-2233;roberto@exemplo.com;Curitiba;410;395,40;WhatsApp;;Novo lead\n' +
    'Juliana Prado;(19) 99777-8800;ju.prado@exemplo.com;Campinas;275;260,00;Facebook Ads;;Novo lead\n' +
    'Oficina Dois Irmãos;(62) 3011-4545;oficina@exemplo.com;Goiânia;2200;2010,00;Google Ads;;Análise técnica\n' +
    'Carlos Eduardo Reis;(51) 98456-1234;carlos@exemplo.com;Porto Alegre;630;601,75;Indicação;;Proposta enviada\n' +
    'Patrícia Gomes;(85) 99654-3210;patricia@exemplo.com;Fortaleza;380;355,00;Site;;Novo lead\n' +
    'Sítio Boa Vista;(16) 99321-7788;boavista@exemplo.com;Ribeirão Preto;950;870,00;Indicação;;Qualificação\n' +
    'Thiago Moreira;(71) 98700-1122;thiago@exemplo.com;Salvador;450;430,00;Instagram;;Novo lead\n' +
    'Clínica Sorriso;(48) 3333-2020;sorriso@exemplo.com;Florianópolis;1500;1390,00;Google Ads;;Negociação\n' +
    'Renata Souza;(11) 97766-5544;renata@exemplo.com;Guarulhos;300;280,00;WhatsApp;;Novo lead\n' +
    'Anderson Pires;123;anderson@exemplo.com;Santos;500;470,00;Site;;Novo lead\n' +
    'Luciana Martins;(27) 99888-0011;luciana@exemplo.com;Vitória;720;690,00;Manual;;Primeiro contato\n' +
    'Supermercado Central;(65) 3624-7711;central@exemplo.com;Cuiabá;4100;3800,00;Indicação;;Qualificação\n';

  var SYSTEMS = [
    { id: 'rd', n: 'RD Station CRM', c: '#0EA5E9', d: 'Contatos, negócios e atividades', auth: 'token' },
    { id: 'pipedrive', n: 'Pipedrive', c: '#16A34A', d: 'Pessoas, negócios e atividades', auth: 'token' },
    { id: 'hubspot', n: 'HubSpot', c: '#F97316', d: 'Contatos, empresas e negócios', auth: 'oauth' },
    { id: 'kommo', n: 'Kommo', c: '#2563EB', d: 'Leads, contatos e conversas', auth: 'oauth' },
    { id: 'ploomes', n: 'Ploomes', c: '#7C3AED', d: 'Clientes, oportunidades e tarefas', auth: 'token' },
    { id: 'agendor', n: 'Agendor', c: '#0891B2', d: 'Pessoas, negócios e tarefas', auth: 'token' },
    { id: 'solarmarket', n: 'SolarMarket', c: '#EAB308', d: 'Projetos e propostas solares', auth: 'token' },
    { id: 'gsheets', n: 'Google Sheets', c: '#22C55E', d: 'Sincronização contínua de uma planilha', auth: 'oauth', sync: true },
    { id: 'excel', n: 'Excel / CSV', c: '#15803D', d: 'Envie o arquivo pelo assistente acima', auth: 'file' },
    { id: 'erp', n: 'ERP (Omie / Bling)', c: '#DC2626', d: 'Clientes e pedidos do ERP', auth: 'token' }
  ];
  var FAKE = [
    ['Cláudio Ferreira', 'Campinas'], ['Mercadinho São José', 'Sorocaba'], ['Helena Duarte', 'Londrina'],
    ['Igor Mendes', 'Maringá'], ['Bianca Torres', 'Uberlândia'], ['Marmoraria Pedra Viva', 'Anápolis']
  ];

  var S = null;
  function fresh() { return { step: 1, headers: [], rows: [], map: [], fileName: '', dup: 'pular', result: null }; }

  /* ---------- parsing ---------- */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    var first = text.split(/\r?\n/)[0] || '';
    var c = { ';': 0, ',': 0, '\t': 0 };
    first.split('').forEach(function (ch) { if (c[ch] != null) c[ch]++; });
    var d = (c['\t'] > 0 && c['\t'] >= c[';'] && c['\t'] >= c[',']) ? '\t' : (c[';'] >= c[','] ? ';' : ',');
    var rows = [], row = [], cur = '', q = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === d) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = ''; rows.push(row); row = [];
      } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function num(s) {
    s = String(s || '').replace(/[^\d.,-]/g, '');
    if (!s) return 0;
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  }
  function phoneKey(p) { var d = digits(p); if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2); return d; }
  function phoneOk(p) { var d = phoneKey(p); return d.length === 10 || d.length === 11; }

  function load(text, name) {
    var rows = parseCSV(text);
    if (rows.length < 2) { U().toast('Não encontrei linhas de dados. O arquivo precisa de cabeçalho e ao menos uma linha.', 'error'); return; }
    S.headers = rows[0].map(function (h) { return String(h).trim(); });
    S.rows = rows.slice(1);
    S.fileName = name;
    var used = {};
    S.map = S.headers.map(function (h) {
      var n = norm(h), hit = '';
      FIELDS.forEach(function (f) {
        if (hit || used[f.k]) return;
        if (f.alias.some(function (a) { return n === norm(a) || n.indexOf(norm(a)) > -1; })) hit = f.k;
      });
      if (hit) used[hit] = 1;
      return hit;
    });
    S.step = 2;
    SP.refresh();
  }

  function existingKeys() {
    var ph = {}, cp = {};
    SP.store.collection('leads').forEach(function (l) {
      if (l.telefone) ph[phoneKey(l.telefone)] = l.id;
      if (l.cpfCnpj) cp[digits(l.cpfCnpj)] = l.id;
    });
    return { ph: ph, cp: cp };
  }
  function buildItems() {
    var ex = existingKeys(), seen = {};
    return S.rows.map(function (r, idx) {
      var o = {};
      S.map.forEach(function (k, i) { if (k) o[k] = (r[i] || '').trim(); });
      var errs = [];
      if (!o.nome) errs.push('sem nome');
      if (o.telefone && !phoneOk(o.telefone)) errs.push('telefone inválido');
      var pk = o.telefone ? phoneKey(o.telefone) : '', ck = o.cpfCnpj ? digits(o.cpfCnpj) : '';
      var dupId = (pk && ex.ph[pk]) || (ck && ex.cp[ck]) || null;
      var inFile = !!(pk && seen[pk]);
      if (pk) seen[pk] = 1;
      return { idx: idx, o: o, errs: errs, dupId: dupId, inFile: inFile };
    });
  }
  function resolveEtapa(t) {
    var n = norm(t); if (!n) return 'novo';
    var e = SP.consts.ETAPAS.filter(function (x) { return norm(x.nome) === n || x.id === n.replace(/ /g, '_'); })[0];
    return e ? e.id : 'novo';
  }
  function resolveVend(t) {
    var n = norm(t); if (!n) return null;
    var v = SP.store.vendedores().filter(function (u) { return norm(u.nome).indexOf(n) > -1; })[0];
    return v ? v.id : null;
  }
  function toLead(o, batch) {
    var vend = resolveVend(o.vendedor);
    if (!vend) { var vs = SP.store.vendedores(); vend = vs.length ? vs[Math.floor(Math.random() * vs.length)].id : null; }
    var consumo = num(o.consumoKwh), conta = num(o.valorConta), now = new Date().toISOString();
    return {
      nome: o.nome, telefone: o.telefone || '', email: o.email || '', cpfCnpj: o.cpfCnpj || '', cidade: o.cidade || '',
      endereco: '', tipo: 'Residencial', concessionaria: '', consumoKwh: consumo, valorConta: conta,
      tipoTelhado: '', areaM2: 0, tipoLigacao: '', origem: 'Importação', origemOriginal: o.origem || '', campanha: '',
      vendedorId: vend, etapa: resolveEtapa(o.etapa), motivoPerda: '', score: 50,
      criadoEm: now, ultimoContato: now,
      valorEstimado: Math.round((consumo || conta / 0.95 || 0) * 12 * 4.2), duplicadoDe: null, objecoes: [],
      interacoes: [{ em: now, tipo: 'nota', texto: 'Importado (' + batch + ')', porId: SP.session.userId }],
      importLote: batch
    };
  }
  function history() { return SP.store.get().importacoes || []; }
  function addHistory(h) { SP.store.update(function (db) { (db.importacoes = db.importacoes || []).unshift(h); }); }

  function runImport(items, dupMode, label, tipo) {
    var batch = 'imp' + Date.now().toString(36), updated = 0, skipped = 0;
    items.forEach(function (it) {
      if (it.errs.indexOf('sem nome') > -1) { skipped++; return; }
      if (it.dupId || it.inFile) {
        if (dupMode === 'pular') { skipped++; return; }
        if (dupMode === 'atualizar') {
          if (!it.dupId) { skipped++; return; }
          var p = {}; ['email', 'cidade', 'cpfCnpj'].forEach(function (k) { if (it.o[k]) p[k] = it.o[k]; });
          if (it.o.consumoKwh) p.consumoKwh = num(it.o.consumoKwh);
          if (it.o.valorConta) p.valorConta = num(it.o.valorConta);
          SP.store.patch('leads', it.dupId, p); updated++; return;
        }
      }
      SP.store.upsert('leads', toLead(it.o, batch));
    });
    var ids = SP.store.collection('leads').filter(function (l) { return l.importLote === batch; }).map(function (l) { return l.id; });
    var h = { id: batch, em: new Date().toISOString(), origem: label, tipo: tipo, criados: ids.length, atualizados: updated, ignorados: skipped, leadIds: ids, desfeito: false };
    addHistory(h);
    SP.store.log('importar', 'lead', batch, label + ': ' + ids.length + ' criados, ' + updated + ' atualizados, ' + skipped + ' ignorados');
    return h;
  }

  function download(name, text) {
    var b = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- views ---------- */
  function steps() {
    var n = ['Enviar arquivo', 'Mapear colunas', 'Prévia', 'Importar'];
    return '<div class="importar-steps">' + n.map(function (t, i) {
      var c = S.step === i + 1 ? 'on' : (S.step > i + 1 ? 'done' : '');
      return '<div class="importar-step ' + c + '"><b>' + (i + 1) + '</b><span>' + t + '</span></div>';
    }).join('') + '</div>';
  }
  function stepUpload() {
    return '<div class="importar-drop" id="imp-drop">' + U().icon('file', 32) +
      '<div><b>Arraste um arquivo .csv aqui</b> ou toque para escolher</div>' +
      '<div class="muted text-sm">Aceita separador ; ou , e acentos (UTF-8). Tem um .xlsx? No Excel use Arquivo &gt; Salvar como &gt; CSV.</div>' +
      '<input type="file" id="imp-file" accept=".csv,.txt,.tsv,.xlsx,.xls" hidden></div>' +
      '<div class="mt"><b class="text-sm">Ou cole direto do Excel / Google Sheets</b>' +
      '<textarea class="importar-paste mt" id="imp-paste" placeholder="Copie as células (com o cabeçalho) e cole aqui"></textarea></div>' +
      '<div class="importar-actions"><button class="btn btn-primary" id="imp-usepaste">Usar texto colado</button>' +
      '<button class="btn" id="imp-sample">Usar planilha de exemplo</button>' +
      '<button class="btn btn-ghost" id="imp-tpl">Baixar planilha modelo</button></div>';
  }
  function stepMap() {
    var opts = function (sel) {
      return '<option value="">— ignorar —</option>' + FIELDS.map(function (f) { return '<option value="' + f.k + '"' + (f.k === sel ? ' selected' : '') + '>' + f.l + '</option>'; }).join('');
    };
    var ok = S.map.indexOf('nome') > -1;
    return '<p class="muted text-sm">' + esc(S.fileName) + ': ' + S.rows.length + ' linhas, ' + S.headers.length + ' colunas. Reconhecemos as colunas automaticamente, ajuste se precisar.</p>' +
      '<div class="importar-map">' + S.headers.map(function (h, i) {
        var ex = esc((S.rows[0] || [])[i] || '');
        return '<div><b>' + esc(h || 'Coluna ' + (i + 1)) + '</b><small>ex.: ' + (ex || '—') + '</small><select data-col="' + i + '">' + opts(S.map[i]) + '</select></div>';
      }).join('') + '</div>' +
      (ok ? '' : '<p class="mt" style="color:#EF4444">Escolha qual coluna é o Nome para continuar.</p>') +
      '<div class="importar-actions"><button class="btn" id="imp-back">Voltar</button><button class="btn btn-primary" id="imp-next"' + (ok ? '' : ' disabled') + '>Ver prévia</button></div>';
  }
  function stepPreview() {
    var items = buildItems(), bad = 0, dup = 0;
    items.forEach(function (i) { if (i.errs.length) bad++; if (i.dupId || i.inFile) dup++; });
    var cols = FIELDS.filter(function (f) { return S.map.indexOf(f.k) > -1; });
    return '<div class="importar-stats">' + U().badge(items.length + ' linhas', 'blue') + U().badge((items.length - bad) + ' válidas', 'green') +
      U().badge(dup + ' duplicadas', 'amber') + U().badge(bad + ' com problema', 'red') + '</div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>#</th>' + cols.map(function (c) { return '<th>' + c.l + '</th>'; }).join('') + '<th>Situação</th></tr></thead><tbody>' +
      items.slice(0, 50).map(function (it) {
        var cls = it.errs.length ? 'importar-row-bad' : (it.dupId || it.inFile ? 'importar-row-dup' : '');
        var st = it.errs.length ? U().badge(it.errs.join(', '), 'red') : (it.dupId ? U().badge('já existe no CRM', 'amber') : (it.inFile ? U().badge('repetida no arquivo', 'amber') : U().badge('ok', 'green')));
        return '<tr class="' + cls + '"><td>' + (it.idx + 1) + '</td>' + cols.map(function (c) { return '<td>' + esc(it.o[c.k] || '') + '</td>'; }).join('') + '<td>' + st + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (items.length > 50 ? '<p class="muted text-sm">Mostrando as 50 primeiras linhas.</p>' : '') +
      '<div class="mt"><b class="text-sm">Se o contato já existir (mesmo telefone ou CPF/CNPJ):</b><div class="importar-opts mt">' +
      [['pular', 'Pular'], ['atualizar', 'Atualizar dados'], ['criar', 'Criar mesmo assim']].map(function (o) {
        return '<label><input type="radio" name="imp-dup" value="' + o[0] + '"' + (S.dup === o[0] ? ' checked' : '') + '> ' + o[1] + '</label>';
      }).join('') + '</div></div>' +
      '<p class="muted text-sm">Linhas com telefone inválido são importadas mesmo assim; só linhas sem nome são ignoradas.</p>' +
      '<div class="importar-actions"><button class="btn" id="imp-back">Voltar</button><button class="btn btn-primary" id="imp-go">Importar leads</button></div>';
  }
  function stepDone() {
    var r = S.result;
    return '<div class="empty"><h3>Importação concluída</h3>' +
      '<p>' + r.criados + ' leads criados, ' + r.atualizados + ' atualizados, ' + r.ignorados + ' ignorados.</p>' +
      '<div class="importar-actions" style="justify-content:center"><a class="btn btn-primary" href="#/leads">Ver leads</a>' +
      '<button class="btn" id="imp-again">Nova importação</button></div></div>';
  }
  function wizard() {
    var body = S.step === 1 ? stepUpload() : S.step === 2 ? stepMap() : S.step === 3 ? stepPreview() : stepDone();
    return '<div class="card"><div class="card-title">1. Importar planilha</div>' + steps() + body + '</div>';
  }
  function systems() {
    return '<div class="card"><div class="card-title">2. Trazer de outro sistema</div><p class="muted text-sm">Mudando de ferramenta? Traga contatos, negócios e atividades sem digitar nada.</p>' +
      '<div class="importar-sys mt">' + SYSTEMS.map(function (s) {
        return '<div class="card"><div class="row" style="gap:10px"><div class="importar-logo" style="background:' + s.c + '">' + esc(s.n[0]) + '</div><div><b>' + esc(s.n) + '</b></div></div>' +
          '<div class="muted text-sm grow">' + esc(s.d) + '</div><button class="btn btn-sm btn-primary" data-sys="' + s.id + '">Conectar</button></div>';
      }).join('') + '</div></div>';
  }
  function captacao() {
    var code = '<form action="https://app.solarprime.com.br/api/leads/SEU_TOKEN" method="post">\n  <input name="nome" placeholder="Seu nome" required>\n  <input name="telefone" placeholder="WhatsApp" required>\n  <input name="consumo_kwh" placeholder="Consumo (kWh)">\n  <button>Quero economizar</button>\n</form>';
    var cards = [['Webhook', 'Envie leads de qualquer ferramenta por POST.'], ['Formulário do site', 'Cole o código abaixo na sua página.'], ['Facebook Lead Ads', 'Leads dos anúncios entram em segundos.'], ['Google Ads (formulário)', 'Cada preenchimento vira um lead.'], ['WhatsApp', 'Quem chama no número vira lead com a conversa.']];
    return '<div class="card"><div class="card-title">3. Captação automática</div>' + U().badge('No plano completo', 'purple') +
      '<div class="grid grid-3 mt">' + cards.map(function (c) { return '<div class="card"><b>' + c[0] + '</b><div class="muted text-sm">' + c[1] + '</div></div>'; }).join('') + '</div>' +
      '<b class="text-sm">Exemplo de formulário para o seu site</b><pre class="importar-code mt">' + esc(code) + '</pre>' +
      '<div class="importar-actions"><button class="btn btn-sm" id="imp-copy">Copiar código</button></div></div>';
  }
  function histCard() {
    var h = history();
    var body = !h.length ? '<div class="muted">Nenhuma importação ainda.</div>' :
      '<div class="table-wrap"><table class="table"><thead><tr><th>Quando</th><th>Origem</th><th>Criados</th><th>Atual.</th><th>Ignor.</th><th></th></tr></thead><tbody>' +
      h.map(function (x) {
        return '<tr><td>' + U().fmtDateTime(x.em) + '</td><td>' + esc(x.origem) + '</td><td>' + x.criados + '</td><td>' + x.atualizados + '</td><td>' + x.ignorados + '</td><td>' +
          (x.desfeito ? U().badge('desfeito', 'gray') : '<button class="btn btn-sm btn-danger" data-undo="' + esc(x.id) + '">Desfazer</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return '<div class="card" id="imp-hist"><div class="card-title">4. Histórico de importações</div>' + body + '</div>';
  }

  /* ---------- simulated connect ---------- */
  function connect(sys) {
    var body = sys.auth === 'file' ? '<p>Use o assistente "Importar planilha" acima: envie o arquivo .csv ou cole as células.</p>' :
      sys.auth === 'oauth' ? '<p>Você seria levado à página de login de <b>' + esc(sys.n) + '</b> para autorizar o acesso (simulado).</p>' :
      '<label class="text-sm">Chave de API / token de ' + esc(sys.n) + '</label><input class="input" id="imp-key" style="width:100%" placeholder="cole sua chave aqui (simulado)">';
    if (sys.sync) body += '<p class="muted text-sm mt">Depois de conectar, novas linhas da planilha entram sozinhas no CRM (no plano completo).</p>';
    var m = U().modal({
      title: 'Conectar ' + sys.n, body: body, size: 'sm',
      actions: sys.auth === 'file' ? [{ label: 'Fechar' }] : [{ label: 'Cancelar' }, {
        label: sys.auth === 'oauth' ? 'Autorizar' : 'Conectar', cls: 'btn-primary', keepOpen: true,
        onClick: function () { simulate(sys, m); }
      }]
    });
  }
  function simulate(sys, m) {
    var cnt = 4 + Math.floor(Math.random() * 3);
    var tot = [120 + Math.floor(Math.random() * 400), 40 + Math.floor(Math.random() * 120), 200 + Math.floor(Math.random() * 600)];
    m.body.innerHTML = '<p><b>Importando de ' + esc(sys.n) + '...</b></p><div class="importar-prog"><i id="imp-bar"></i></div><div id="imp-txt" class="muted text-sm">Conectando...</div>';
    [].forEach.call(m.el.querySelectorAll('button'), function (b) { if (/Conectar|Autorizar/.test(b.textContent)) b.disabled = true; });
    var p = 0, t = setInterval(function () {
      p += 10 + Math.random() * 12;
      var bar = m.body.querySelector('#imp-bar'), tx = m.body.querySelector('#imp-txt');
      if (!bar) { clearInterval(t); return; }
      if (p >= 100) {
        clearInterval(t);
        var items = FAKE.slice(0, cnt).map(function (f, i) {
          return { errs: [], o: { nome: f[0], cidade: f[1], telefone: '(11) 9' + (7000 + Math.floor(Math.random() * 2999)) + '-' + (1000 + Math.floor(Math.random() * 8999)), origem: sys.n, consumoKwh: String(300 + i * 90), etapa: 'Novo lead' } };
        });
        var h = runImport(items, 'criar', sys.n, 'sistema');
        m.body.innerHTML = '<p><b>Concluído!</b></p><p>Importados de ' + esc(sys.n) + ': <b>' + tot[0] + ' contatos</b>, <b>' + tot[1] + ' negócios</b> e <b>' + tot[2] + ' atividades</b>.</p>' +
          '<p class="muted text-sm">Nesta demonstração, ' + h.criados + ' leads de exemplo foram criados.</p><a class="btn btn-primary" href="#/leads">Ver leads</a>';
        SP.refresh();
        return;
      }
      bar.style.width = p + '%';
      tx.textContent = p < 35 ? 'Importando ' + Math.round(tot[0] * p / 35) + ' contatos...' : p < 70 ? 'Importando ' + Math.round(tot[1] * p / 70) + ' negócios...' : 'Importando ' + Math.round(tot[2] * p / 100) + ' atividades...';
    }, 350);
  }

  /* ---------- render ---------- */
  function readFile(f) {
    if (/\.xlsx?$/i.test(f.name)) return U().toast('Arquivos Excel (.xlsx) não são lidos aqui. No Excel, use Salvar como > CSV UTF-8 e envie de novo.', 'error');
    var r = new FileReader();
    r.onload = function () { load(r.result, f.name); };
    r.readAsText(f, 'UTF-8');
  }
  function bind(el) {
    var q = function (s) { return el.querySelector(s); };
    var on = function (s, fn) { var n = q(s); if (n) n.addEventListener('click', fn); };
    var drop = q('#imp-drop'), file = q('#imp-file');
    if (drop) {
      drop.addEventListener('click', function () { file.click(); });
      ['dragover', 'dragenter'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (ev) { if (ev.dataTransfer.files[0]) readFile(ev.dataTransfer.files[0]); });
      file.addEventListener('change', function () { if (file.files[0]) readFile(file.files[0]); });
    }
    on('#imp-usepaste', function () { var v = q('#imp-paste').value; if (!v.trim()) return U().toast('Cole as células primeiro.', 'error'); load(v, 'Texto colado'); });
    on('#imp-sample', function () { load(SAMPLE, 'Planilha de exemplo'); });
    on('#imp-tpl', function () { download('modelo-importacao-solar-prime.csv', SAMPLE.split('\n').slice(0, 4).join('\n')); });
    on('#imp-back', function () { S.step--; SP.refresh(); });
    on('#imp-next', function () { S.step = 3; SP.refresh(); });
    on('#imp-again', function () { S = fresh(); SP.refresh(); });
    on('#imp-go', function () {
      S.result = runImport(buildItems(), S.dup, S.fileName, 'planilha'); S.step = 4;
      U().toast(S.result.criados + ' leads importados', 'success'); SP.refresh();
    });
    on('#imp-copy', function () {
      try { navigator.clipboard.writeText(q('.importar-code').textContent); } catch (e) {}
      U().toast('Código copiado', 'success');
    });
    [].forEach.call(el.querySelectorAll('select[data-col]'), function (s) {
      s.addEventListener('change', function () {
        var v = s.value, i = +s.dataset.col;
        if (v) S.map = S.map.map(function (x, j) { return j !== i && x === v ? '' : x; });
        S.map[i] = v; SP.refresh();
      });
    });
    [].forEach.call(el.querySelectorAll('input[name=imp-dup]'), function (r) { r.addEventListener('change', function () { S.dup = r.value; }); });
    [].forEach.call(el.querySelectorAll('[data-sys]'), function (b) {
      b.addEventListener('click', function () { connect(SYSTEMS.filter(function (s) { return s.id === b.dataset.sys; })[0]); });
    });
    [].forEach.call(el.querySelectorAll('[data-undo]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.undo, h = history().filter(function (x) { return x.id === id; })[0];
        if (!h || !confirm('Remover os ' + h.leadIds.length + ' leads criados nesta importação?')) return;
        h.leadIds.forEach(function (lid) { SP.store.remove('leads', lid); });
        SP.store.update(function (db) { db.importacoes.forEach(function (x) { if (x.id === id) x.desfeito = true; }); });
        SP.store.log('importar_desfazer', 'lead', id, h.leadIds.length + ' leads removidos');
        U().toast('Importação desfeita', 'success'); SP.refresh();
      });
    });
  }

  SP.register({
    route: 'importar', title: 'Importar dados', icon: 'file', group: 'Gestão', order: 90,
    roles: ['dono', 'trafego', 'financeiro'],
    render: function (el) {
      if (!S) S = fresh();
      el.innerHTML = U().pageHeader('Importar dados', 'Traga seus contatos de planilhas e de outros sistemas, sem digitar nada.') +
        '<div class="stack">' + wizard() + systems() + captacao() + histCard() + '</div>';
      bind(el);
    }
  });
})();
