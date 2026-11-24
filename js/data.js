/* Solar Prime CRM - dados fictícios (seed).
 * Define SP.consts (constantes de domínio) e SP.buildSeed() (gera o banco inicial).
 * Todas as datas são relativas a "agora", então a demo sempre parece atual.
 * Gerador pseudo-aleatório com semente fixa: mesma "forma" de dados a cada reset. */
(function () {
  'use strict';
  window.SP = window.SP || {};

  var ETAPAS = [
    { id: 'novo', nome: 'Novo lead', cor: '#64748B' },
    { id: 'primeiro_contato', nome: 'Primeiro contato', cor: '#3B82F6' },
    { id: 'qualificacao', nome: 'Qualificação', cor: '#6366F1' },
    { id: 'analise_tecnica', nome: 'Análise técnica', cor: '#8B5CF6' },
    { id: 'proposta_enviada', nome: 'Proposta enviada', cor: '#F59E0B' },
    { id: 'negociacao', nome: 'Negociação', cor: '#F97316' },
    { id: 'contrato_enviado', nome: 'Contrato enviado', cor: '#EAB308' },
    { id: 'venda_fechada', nome: 'Venda fechada', cor: '#22C55E' },
    { id: 'instalacao', nome: 'Instalação', cor: '#14B8A6' },
    { id: 'pos_venda', nome: 'Pós-venda', cor: '#10B981' },
    { id: 'perdido', nome: 'Perdido', cor: '#EF4444' }
  ];
  var OBRA_ETAPAS = [
    { id: 'projeto', nome: 'Projeto' }, { id: 'visita', nome: 'Visita técnica' },
    { id: 'documentacao', nome: 'Documentação' }, { id: 'homologacao', nome: 'Homologação' },
    { id: 'aprovacao', nome: 'Aprovação da concessionária' }, { id: 'compra', nome: 'Compra de materiais' },
    { id: 'agendamento', nome: 'Agendamento' }, { id: 'instalacao', nome: 'Instalação' },
    { id: 'vistoria', nome: 'Vistoria' }, { id: 'entrega', nome: 'Entrega' }
  ];
  var C = SP.consts = {
    ETAPAS: ETAPAS,
    OBRA_ETAPAS: OBRA_ETAPAS,
    FECHADAS: ['venda_fechada', 'instalacao', 'pos_venda'],
    EM_NEGOCIACAO: ['proposta_enviada', 'negociacao', 'contrato_enviado'],
    ORIGENS: ['WhatsApp', 'Instagram', 'Facebook Ads', 'Google Ads', 'Site', 'Indicação', 'Manual'],
    PAPEIS: { dono: 'Dono', vendedor: 'Vendedor', tecnico: 'Técnico', financeiro: 'Financeiro', trafego: 'Gestora de tráfego' },
    MOTIVOS_PERDA: ['Preço alto', 'Optou por concorrente', 'Sem crédito aprovado', 'Adiou a decisão', 'Imóvel alugado', 'Sem resposta'],
    etapa: function (id) { for (var i = 0; i < ETAPAS.length; i++) if (ETAPAS[i].id === id) return ETAPAS[i]; return { id: id, nome: id, cor: '#64748B' }; }
  };

  SP.buildSeed = function () {
    var DAY = 86400000, NOW = Date.now();
    var seed = 20260101;
    function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function wpick(pairs) { var s = 0, i; for (i = 0; i < pairs.length; i++) s += pairs[i][1]; var x = rnd() * s; for (i = 0; i < pairs.length; i++) { x -= pairs[i][1]; if (x <= 0) return pairs[i][0]; } return pairs[0][0]; }
    function iso(ms) { return new Date(ms).toISOString(); }
    function agoMin(m) { return iso(NOW - m * 60000); }
    function ago(d, h) { return agoMin(d * 1440 + (h || 0) * 60); }
    function fut(d, h) { return iso(NOW + (d * 24 + (h || 0)) * 3600000); }
    function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }
    function round(n, s) { return Math.round(n / s) * s; }

    /* ---------- usuários ---------- */
    var usuarios = [
      { id: 'u1', nome: 'Ricardo Almeida', papel: 'dono', email: 'ricardo@solarprime.com.br', cor: '#F97316' },
      { id: 'u2', nome: 'Camila Ferreira', papel: 'vendedor', email: 'camila@solarprime.com.br', cor: '#3B82F6' },
      { id: 'u3', nome: 'Bruno Tavares', papel: 'vendedor', email: 'bruno@solarprime.com.br', cor: '#8B5CF6' },
      { id: 'u4', nome: 'Juliana Moraes', papel: 'vendedor', email: 'juliana@solarprime.com.br', cor: '#10B981' },
      { id: 'u5', nome: 'Rafael Nogueira', papel: 'vendedor', email: 'rafael@solarprime.com.br', cor: '#EAB308' },
      { id: 'u6', nome: 'Patrícia Lima', papel: 'vendedor', email: 'patricia@solarprime.com.br', cor: '#EC4899' },
      { id: 'u7', nome: 'Anderson Souza', papel: 'tecnico', email: 'anderson@solarprime.com.br', cor: '#14B8A6' },
      { id: 'u8', nome: 'Fernanda Castro', papel: 'financeiro', email: 'fernanda@solarprime.com.br', cor: '#64748B' },
      { id: 'u_trafego', nome: 'Mariana (Tráfego)', papel: 'trafego', email: 'mariana@solarprime.com.br', cor: '#0EA5E9' }
    ];
    var vendedores = ['u2', 'u3', 'u4', 'u5', 'u6'];
    function primeiroNome(id) { for (var i = 0; i < usuarios.length; i++) if (usuarios[i].id === id) return usuarios[i].nome.split(' ')[0]; return ''; }

    /* ---------- geografia ---------- */
    var CIDADES = [
      { c: 'São Paulo', uf: 'SP', conc: 'Enel', ddd: ['11'] }, { c: 'Guarulhos', uf: 'SP', conc: 'Enel', ddd: ['11'] },
      { c: 'Osasco', uf: 'SP', conc: 'Enel', ddd: ['11'] }, { c: 'Campinas', uf: 'SP', conc: 'CPFL', ddd: ['19'] },
      { c: 'Ribeirão Preto', uf: 'SP', conc: 'CPFL', ddd: ['16'] }, { c: 'Sorocaba', uf: 'SP', conc: 'CPFL', ddd: ['15'] },
      { c: 'Jundiaí', uf: 'SP', conc: 'CPFL', ddd: ['11'] }, { c: 'Belo Horizonte', uf: 'MG', conc: 'CEMIG', ddd: ['31'] },
      { c: 'Uberlândia', uf: 'MG', conc: 'CEMIG', ddd: ['34'] }, { c: 'Juiz de Fora', uf: 'MG', conc: 'CEMIG', ddd: ['32'] },
      { c: 'Contagem', uf: 'MG', conc: 'CEMIG', ddd: ['31'] }, { c: 'Montes Claros', uf: 'MG', conc: 'CEMIG', ddd: ['38'] },
      { c: 'Curitiba', uf: 'PR', conc: 'Copel', ddd: ['41'] }, { c: 'Londrina', uf: 'PR', conc: 'Copel', ddd: ['43'] },
      { c: 'Maringá', uf: 'PR', conc: 'Copel', ddd: ['44'] }, { c: 'Cascavel', uf: 'PR', conc: 'Copel', ddd: ['45'] },
      { c: 'Ponta Grossa', uf: 'PR', conc: 'Copel', ddd: ['42'] }
    ];
    var NOMES = ['João', 'Maria', 'José', 'Ana', 'Carlos', 'Fernanda', 'Paulo', 'Luciana', 'Marcos', 'Patrícia', 'Roberto', 'Aline', 'Eduardo', 'Renata', 'Sérgio', 'Cláudia', 'Fábio', 'Vanessa', 'Gustavo', 'Tatiane', 'Leandro', 'Simone', 'Diego', 'Carla', 'Thiago', 'Mariana', 'Alexandre', 'Débora', 'Márcio', 'Priscila', 'Henrique', 'Sandra', 'Vinícius', 'Elaine', 'Rodrigo', 'Beatriz', 'Antônio', 'Adriana', 'Felipe', 'Rosana'];
    var SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Araújo', 'Barbosa', 'Rocha', 'Dias', 'Monteiro', 'Cardoso', 'Teixeira', 'Moreira', 'Nunes', 'Mendes', 'Freitas', 'Pinto', 'Correia', 'Batista', 'Campos', 'Andrade'];
    var EMP_COM = ['Padaria Pão Dourado', 'Supermercado Bom Preço', 'Clínica Odontológica Sorriso', 'Academia Corpo em Forma', 'Auto Center Irmãos Rocha', 'Restaurante Sabor da Terra', 'Farmácia Vida Plena', 'Escola Pequeno Aprendiz', 'Hotel Vista Verde', 'Lavanderia Brilho', 'Pet Shop Amigo Fiel', 'Laboratório Saúde Total'];
    var EMP_IND = ['Metalúrgica Santa Rita Ltda', 'Indústria de Plásticos Paraná', 'Frigorífico Boa Carne', 'Cerâmica Vale do Sol', 'Gráfica Impressão Rápida', 'Marcenaria Móveis Nobre', 'Usinagem Precisão Ltda', 'Têxtil Fios de Ouro'];
    var EMP_RUR = ['Fazenda Boa Esperança', 'Sítio Recanto Verde', 'Granja Três Irmãos', 'Agropecuária Horizonte', 'Fazenda Santa Clara', 'Chácara Pôr do Sol'];
    var RUAS = ['Rua das Palmeiras', 'Av. Brasil', 'Rua XV de Novembro', 'Rua Sete de Setembro', 'Av. Presidente Vargas', 'Rua das Acácias', 'Rua Tiradentes', 'Av. Independência', 'Rua dos Ipês', 'Rua Santos Dumont', 'Av. Getúlio Vargas', 'Rua Minas Gerais'];
    var BAIRROS = ['Centro', 'Jardim América', 'Vila Nova', 'Bela Vista', 'Jardim Primavera', 'Parque das Flores', 'Vila Industrial', 'São José', 'Boa Vista', 'Cidade Jardim'];
    var CAMPANHAS = {
      'Facebook Ads': ['Solar Residencial - FB Ads', 'Black Friday Solar'],
      'Google Ads': ['Google - Energia Solar SP', 'Google - Instalação Solar'],
      'Instagram': ['Reels Economia na Conta', 'Stories Orçamento'],
      'WhatsApp': ['Click to WhatsApp'], 'Site': ['Orgânico / SEO'], 'Indicação': ['Indique e Ganhe'], 'Manual': ['']
    };
    var OBJECOES = ['Preço alto', 'Medo de financiamento', 'Dúvida sobre payback', 'Telhado frágil', 'Vai mudar de imóvel', 'Quer comparar orçamentos', 'Prazo de instalação', 'Desconfiança com garantia'];

    function cpf() { return pad(ri(100, 999), 3) + '.' + pad(ri(100, 999), 3) + '.' + pad(ri(100, 999), 3) + '-' + pad(ri(10, 99), 2); }
    function cnpj() { return pad(ri(10, 99), 2) + '.' + pad(ri(100, 999), 3) + '.' + pad(ri(100, 999), 3) + '/0001-' + pad(ri(10, 99), 2); }
    function fone(ddd) { return '(' + ddd + ') 9' + ri(1000, 9999) + '-' + ri(1000, 9999); }

    /* ---------- leads ---------- */
    var dist = [['novo', 14], ['primeiro_contato', 9], ['qualificacao', 8], ['analise_tecnica', 6], ['proposta_enviada', 8], ['negociacao', 7], ['contrato_enviado', 4], ['venda_fechada', 5], ['instalacao', 6], ['pos_venda', 4], ['perdido', 9]];
    var etapasLista = [];
    dist.forEach(function (d) { for (var k = 0; k < d[1]; k++) etapasLista.push(d[0]); });
    shuffle(etapasLista);
    var DIAS = { novo: [0, 5], primeiro_contato: [1, 10], qualificacao: [3, 18], analise_tecnica: [5, 25], proposta_enviada: [8, 35], negociacao: [12, 45], contrato_enviado: [15, 50], venda_fechada: [20, 70], instalacao: [30, 80], pos_venda: [40, 88], perdido: [5, 80] };
    var IDX = {}; ETAPAS.forEach(function (e, i) { IDX[e.id] = i; });
    var IT = {
      ligacao: ['Ligação realizada, cliente pediu simulação', 'Cliente não atendeu, deixei recado', 'Conversamos sobre o consumo e a conta de luz'],
      whatsapp: ['Enviei a apresentação da empresa', 'Cliente enviou foto da conta de luz', 'Enviada simulação de economia', 'Follow-up sobre a proposta'],
      email: ['Enviado e-mail com proposta em PDF', 'Enviado material sobre financiamento'],
      visita: ['Visita técnica agendada', 'Visita técnica realizada, telhado em boas condições'],
      nota: ['Cliente quer decidir com o cônjuge', 'Interessado em financiamento', 'Comparando com outro orçamento']
    };
    var leads = [];
    for (var i = 0; i < 80; i++) {
      var etapa = etapasLista[i];
      var cid = pick(CIDADES);
      var tipo = wpick([['residencial', 55], ['comercial', 22], ['industrial', 9], ['rural', 14]]);
      var nome;
      if (tipo === 'residencial') nome = pick(NOMES) + ' ' + pick(SOBRENOMES) + ' ' + pick(SOBRENOMES);
      else if (tipo === 'comercial') nome = pick(EMP_COM);
      else if (tipo === 'industrial') nome = pick(EMP_IND);
      else nome = pick(EMP_RUR);
      var consumo = tipo === 'residencial' ? ri(250, 900) : tipo === 'comercial' ? ri(800, 3500) : tipo === 'industrial' ? ri(3000, 12000) : ri(600, 2500);
      consumo = round(consumo, 10);
      var tarifa = 0.88 + rnd() * 0.18;
      var kwp = consumo / 120;
      var dias = ri(DIAS[etapa][0], DIAS[etapa][1]);
      var criadoMs = NOW - dias * DAY - ri(0, 1000) * 60000;
      var lastDays = Math.min(dias, ri(0, 9));
      var ultimoMs = Math.min(NOW, Math.max(criadoMs, NOW - lastDays * DAY - ri(0, 600) * 60000));
      var origem = wpick([['WhatsApp', 25], ['Instagram', 15], ['Facebook Ads', 18], ['Google Ads', 15], ['Site', 8], ['Indicação', 12], ['Manual', 7]]);
      var vend = pick(vendedores);
      var idx = IDX[etapa] > 9 ? 3 : IDX[etapa];
      var semInter = etapa === 'novo' && rnd() < 0.45;
      var inter = [];
      if (!semInter) {
        var n = Math.min(1 + Math.floor(idx / 1.5) + ri(0, 1), 6);
        for (var k = 0; k < n; k++) {
          var tp = pick(['ligacao', 'whatsapp', 'whatsapp', 'email', 'visita', 'nota']);
          if (tp === 'visita' && idx < 3) tp = 'ligacao';
          var tms = criadoMs + (ultimoMs - criadoMs) * (k + 1) / n;
          inter.push({ em: iso(tms), tipo: tp, texto: pick(IT[tp]), porId: vend });
        }
      }
      var score = etapa === 'perdido' ? ri(5, 35) : Math.max(5, Math.min(100, Math.round(20 + idx * 6 + consumo / 150 + ri(-10, 10))));
      var obj = [];
      var no = ri(0, 2);
      for (var q = 0; q < no; q++) { var ob = pick(OBJECOES); if (obj.indexOf(ob) < 0) obj.push(ob); }
      leads.push({
        id: 'l' + (i + 1), nome: nome, telefone: fone(pick(cid.ddd)), cpfCnpj: (tipo === 'residencial' || tipo === 'rural' && rnd() < 0.4) ? cpf() : cnpj(),
        cidade: cid.c + ' - ' + cid.uf, endereco: pick(RUAS) + ', ' + ri(10, 1999) + ' - ' + pick(BAIRROS),
        tipo: tipo, concessionaria: cid.conc, consumoKwh: consumo, valorConta: round(consumo * tarifa, 1),
        tipoTelhado: pick(['cerâmico', 'fibrocimento', 'metálico', 'laje', 'solo']), areaM2: Math.round(kwp * 6 * (0.9 + rnd() * 0.4)),
        tipoLigacao: consumo > 2000 ? 'trifásico' : consumo > 600 ? pick(['bifásico', 'trifásico']) : pick(['monofásico', 'bifásico']),
        origem: origem, campanha: pick(CAMPANHAS[origem]), vendedorId: vend, etapa: etapa, motivoPerda: etapa === 'perdido' ? wpick([['Preço alto', 30], ['Optou por concorrente', 22], ['Sem crédito aprovado', 15], ['Adiou a decisão', 15], ['Imóvel alugado', 8], ['Sem resposta', 10]]) : null,
        score: score, criadoEm: iso(criadoMs), ultimoContato: inter.length ? inter[inter.length - 1].em : null,
        valorEstimado: round(kwp * 4300, 100), duplicadoDe: null, objecoes: obj, interacoes: inter,
        primeiraRespostaMin: inter.length ? wpick([[ri(2, 15), 45], [ri(15, 60), 30], [ri(60, 240), 18], [ri(240, 1500), 7]]) : null
      });
    }
    /* caso especial: João, 850 kWh, R$ 780, financiamento */
    Object.assign(leads[0], {
      nome: 'João Batista Almeida', telefone: '(19) 99812-4470', cpfCnpj: '218.774.936-05', cidade: 'Campinas - SP', endereco: 'Rua das Acácias, 412 - Jardim Primavera',
      tipo: 'residencial', concessionaria: 'CPFL', consumoKwh: 850, valorConta: 780, tipoTelhado: 'cerâmico', areaM2: 48, tipoLigacao: 'bifásico',
      origem: 'WhatsApp', campanha: 'Click to WhatsApp', vendedorId: 'u2', etapa: 'negociacao', motivoPerda: null, score: 82, valorEstimado: 30500,
      objecoes: ['Medo de financiamento', 'Dúvida sobre payback'], criadoEm: ago(12, 3), ultimoContato: ago(1, 2), primeiraRespostaMin: 6,
      interacoes: [
        { em: ago(12, 3), tipo: 'whatsapp', texto: 'Cliente chegou pelo anúncio, enviou foto da conta (850 kWh, R$ 780)', porId: 'u2' },
        { em: ago(10, 5), tipo: 'ligacao', texto: 'Ligação de qualificação: casa própria, telhado cerâmico, quer financiar', porId: 'u2' },
        { em: ago(7, 1), tipo: 'visita', texto: 'Visita técnica realizada, telhado ok, 14 módulos cabem', porId: 'u7' },
        { em: ago(4, 2), tipo: 'email', texto: 'Enviada proposta em PDF com simulação de financiamento', porId: 'u2' },
        { em: ago(1, 2), tipo: 'whatsapp', texto: 'Cliente pediu simulação de parcela em 60x e 84x', porId: 'u2' }
      ]
    });
    /* duplicados */
    [[77, 10], [78, 11], [79, 12]].forEach(function (p) {
      var a = leads[p[0]], b = leads[p[1]];
      a.duplicadoDe = b.id; a.nome = b.nome; a.telefone = b.telefone; a.cidade = b.cidade; a.origem = 'Site'; a.campanha = 'Orgânico / SEO';
    });
    var leadById = {}; leads.forEach(function (l) { leadById[l.id] = l; });
    function diasDesde(iso_) { return Math.floor((NOW - new Date(iso_).getTime()) / DAY); }

    /* ---------- conversas ---------- */
    function T(l, vn) {
      var n = l.nome.split(' ')[0], conta = 'R$ ' + l.valorConta, kwh = l.consumoKwh, kwp = (l.consumoKwh / 120).toFixed(1).replace('.', ',');
      var tpl = {
        inicial: [['cliente', 'Oi, vi o anúncio de vocês de energia solar. Quanto custa pra instalar?'], ['vendedor', 'Olá, ' + n + '! Tudo bem? Aqui é ' + vn + ', da Solar Prime. Pra te passar um valor certinho, me conta: quanto vem a sua conta de luz por mês?'], ['cliente', 'Em média ' + conta + '.'], ['vendedor', 'Perfeito! Com esse consumo (uns ' + kwh + ' kWh) um sistema de ' + kwp + ' kWp resolveria. Posso te mandar uma simulação ainda hoje?'], ['cliente', 'Pode sim, manda por aqui mesmo.'], ['vendedor', 'Enviado! Qualquer dúvida estou por aqui 😊']],
        financiamento: [['cliente', 'Boa tarde, queria saber se dá pra financiar a energia solar'], ['vendedor', 'Boa tarde, ' + n + '! Dá sim, trabalhamos com financiamento em até 84x com parceiros. A parcela costuma ficar próxima do valor da conta de luz.'], ['cliente', 'Hum, e se eu não conseguir pagar? Tenho medo de me enrolar'], ['vendedor', 'Entendo a preocupação. Como a economia na conta já cobre boa parte da parcela, o impacto no bolso é pequeno. Posso simular sem compromisso?'], ['cliente', 'Pode simular sim']],
        visita: [['vendedor', 'Oi ' + n + ', confirmando a visita técnica amanhã às 14h. Tudo certo?'], ['cliente', 'Tudo certo! Vou estar em casa'], ['vendedor', 'Nosso técnico Anderson vai medir o telhado e olhar o quadro de energia. Leva uns 40 minutos.'], ['cliente', 'Beleza, obrigado!']],
        negociacao: [['cliente', 'Recebi a proposta. Achei o valor um pouco alto, um concorrente me passou menos'], ['vendedor', 'Obrigado pelo retorno, ' + n + '! Você consegue me passar o orçamento deles? Quero comparar marca dos módulos e garantia, porque costuma ser aí que muda.'], ['cliente', 'Vou te mandar'], ['vendedor', 'Fechado. Se estiver em condições iguais eu consigo melhorar a condição de pagamento pra você.'], ['cliente', 'Ok, vou ver e te falo']],
        followup: [['vendedor', 'Oi ' + n + ', tudo bem? Passando pra saber se conseguiu olhar a proposta que enviei.'], ['vendedor', 'Qualquer dúvida sobre payback ou instalação, é só chamar!'], ['cliente', 'Oi, ainda não deu tempo, essa semana está corrida'], ['vendedor', 'Sem problema! Posso te ligar na quinta?'], ['cliente', 'Pode sim, depois das 18h']],
        posvenda: [['vendedor', 'Oi ' + n + '! Boa notícia: a concessionária aprovou o projeto 🎉'], ['cliente', 'Que ótimo!! E quando instalam?'], ['vendedor', 'Nossa equipe já está agendando. Te aviso a data hoje ainda.'], ['cliente', 'Perfeito, obrigado pela atenção de vocês']]
      };
      return tpl;
    }
    var conversas = [];
    var candidatos = leads.filter(function (l, ix) { return ix > 0 && l.interacoes.length; }).slice(0, 24);
    candidatos.unshift(leads[0]);
    candidatos.forEach(function (l, ix) {
      var vn = primeiroNome(l.vendedorId), msgs, tp = T(l, vn);
      if (l.id === 'l1') {
        msgs = [['cliente', 'Boa tarde! Vi o anúncio de vocês. Minha conta de luz tá vindo uns R$ 780 por mês, uns 850 kWh'], ['vendedor', 'Boa tarde, João! Aqui é a Camila, da Solar Prime. Com 850 kWh dá pra zerar quase toda a conta com um sistema de uns 7 kWp. Você mora em casa própria?'], ['cliente', 'Sim, casa própria, telhado de telha cerâmica'], ['vendedor', 'Ótimo, é o melhor cenário. Vou agendar uma visita técnica gratuita pra medir o telhado, pode ser?'], ['cliente', 'Pode. Mas já adianto: não tenho todo esse dinheiro à vista, queria financiamento'], ['vendedor', 'Sem problema! Trabalhamos com financiamento em até 84x. Te mando uma simulação depois da visita.'], ['cliente', 'Fechado'], ['vendedor', 'João, enviei a proposta por e-mail: 14 módulos de 550W, inversor Fronius, geração média de 1.000 kWh/mês. Investimento de R$ 30.500.'], ['cliente', 'Vi aqui. Quanto ficaria a parcela financiando tudo?'], ['vendedor', 'Em 84x fica em torno de R$ 640 por mês. Ou seja, abaixo do que você paga hoje de luz, e depois de quitar a energia é praticamente de graça por mais de 15 anos.'], ['cliente', 'Hum, e se eu atrasar alguma parcela? Tenho receio de financiar'], ['vendedor', 'Faz todo sentido ter esse cuidado. A economia na conta cobre a parcela, então o impacto no orçamento é neutro. Posso te ligar pra tirar todas as dúvidas?'], ['cliente', 'Pode simular de novo em 60x e 84x? Quero comparar o total que vou pagar'], ['vendedor', 'Claro! Te mando agora as duas simulações lado a lado.']];
      } else {
        var key = l.etapa === 'novo' || l.etapa === 'primeiro_contato' ? (ix % 2 ? 'inicial' : 'financiamento') : l.etapa === 'qualificacao' ? 'financiamento' : l.etapa === 'analise_tecnica' ? 'visita' : (l.etapa === 'proposta_enviada' ? (ix % 2 ? 'followup' : 'negociacao') : l.etapa === 'negociacao' || l.etapa === 'perdido' ? 'negociacao' : l.etapa === 'contrato_enviado' ? 'followup' : 'posvenda');
        msgs = tp[key];
      }
      var base = l.ultimoContato ? new Date(l.ultimoContato).getTime() : new Date(l.criadoEm).getTime();
      var mensagens = msgs.map(function (m, j) {
        var t = base - (msgs.length - 1 - j) * ri(2, 30) * 60000;
        return { id: 'cv' + (ix + 1) + 'm' + (j + 1), de: m[0], texto: m[1], em: iso(Math.min(t, NOW)) };
      });
      var last = mensagens[mensagens.length - 1];
      conversas.push({
        id: 'cv' + (ix + 1), leadId: l.id, canal: l.origem === 'Instagram' ? 'instagram' : 'whatsapp',
        naoLidas: last.de === 'cliente' ? ri(1, 3) : 0, atualizadoEm: last.em, mensagens: mensagens
      });
    });

    /* ---------- propostas ---------- */
    var propostas = [], propByLead = {};
    function mkProposta(l, status, enviadaDias) {
      var mod = Math.max(4, Math.ceil(l.consumoKwh / 120 * 1000 / 585)), kw = Math.round(mod * 0.585 * 100) / 100;
      var inv = kw <= 4 ? 'Growatt MIN 3000TL-X' : kw <= 6.5 ? 'Fronius Primo 5.0' : kw <= 12 ? 'Fronius Symo 10.0' : kw <= 30 ? 'Growatt MID 25KTL3-X' : 'Growatt MAX 60KTL3-X';
      var ger = Math.round(kw * 125), tar = l.valorConta / l.consumoKwh, eco = Math.round(Math.min(ger, l.consumoKwh) * tar * 0.93);
      var p = {
        id: 'p' + (propostas.length + 1), numero: 'PR-' + pad(propostas.length + 101, 4), leadId: l.id, vendedorId: l.vendedorId, potenciaKwp: kw, modulos: mod,
        moduloModelo: kw > 20 ? 'Módulo 585W Trina Vertex' : 'Módulo 550W Canadian Solar', inversor: inv, valor: l.valorEstimado,
        geracaoMensalKwh: ger, economiaMensal: eco, paybackAnos: Math.round(l.valorEstimado / (eco * 12) * 10) / 10,
        formaPagamento: pick(['À vista', 'Financiamento 60x', 'Financiamento 84x', 'Cartão 12x', 'Entrada + saldo']), status: status,
        criadaEm: iso(new Date(l.criadoEm).getTime() + (NOW - new Date(l.criadoEm).getTime()) * 0.4),
        enviadaEm: status === 'rascunho' ? null : ago(enviadaDias), validadeEm: fut(Math.max(2, 15 - enviadaDias))
      };
      propostas.push(p); propByLead[l.id] = p; return p;
    }
    leads.forEach(function (l) {
      var e = l.etapa;
      if (e === 'proposta_enviada') mkProposta(l, rnd() < 0.5 ? 'enviada' : 'visualizada', ri(1, 8));
      else if (e === 'negociacao') mkProposta(l, 'visualizada', l.id === 'l1' ? 4 : ri(2, 12));
      else if (e === 'contrato_enviado' || C.FECHADAS.indexOf(e) >= 0) mkProposta(l, 'aprovada', Math.max(1, Math.floor(diasDesde(l.criadoEm) * 0.5)));
      else if (e === 'perdido' && l.score < 20 && propostas.length < 40) mkProposta(l, 'recusada', ri(5, 20));
      else if (e === 'analise_tecnica' && rnd() < 0.3) mkProposta(l, 'rascunho', 0);
    });
    propostas.forEach(function (p) { if (p.status === 'recusada' || p.status === 'rascunho') return; });

    /* ---------- contratos ---------- */
    var contratos = [];
    var fac = { venda_fechada: [0.1, 0.3], instalacao: [0.35, 0.55], pos_venda: [0.5, 0.7] };
    leads.forEach(function (l) {
      var p = propByLead[l.id];
      if (l.etapa === 'contrato_enviado') {
        contratos.push({ id: 'c' + (contratos.length + 1), numero: 'CT-2026-' + pad(contratos.length + 1, 4), leadId: l.id, propostaId: p.id, vendedorId: l.vendedorId, valor: p.valor, formaPagamento: p.formaPagamento, status: 'aguardando_assinatura', criadoEm: ago(ri(0, 4)), assinadoEm: null });
      } else if (fac[l.etapa]) {
        var d = Math.max(1, Math.floor(diasDesde(l.criadoEm) * (fac[l.etapa][0] + rnd() * (fac[l.etapa][1] - fac[l.etapa][0]))));
        contratos.push({ id: 'c' + (contratos.length + 1), numero: 'CT-2026-' + pad(contratos.length + 1, 4), leadId: l.id, propostaId: p.id, vendedorId: l.vendedorId, valor: p.valor, formaPagamento: p.formaPagamento, status: 'assinado', criadoEm: ago(d + 1), assinadoEm: ago(d) });
      }
    });
    var contratoByLead = {}; contratos.forEach(function (c) { contratoByLead[c.leadId] = c; });

    /* ---------- obras ---------- */
    var obras = [];
    var prog = { venda_fechada: [1, 4], instalacao: [5, 9], pos_venda: [10, 10] };
    leads.forEach(function (l) {
      var c = contratoByLead[l.id];
      if (!c || c.status !== 'assinado') return;
      var done = ri(prog[l.etapa][0], prog[l.etapa][1]), p = propByLead[l.id];
      var t0 = new Date(c.assinadoEm).getTime(), step = Math.max(1, Math.floor((NOW - t0) / DAY / Math.max(done, 1)));
      var etapas = OBRA_ETAPAS.map(function (e, k) {
        var prevista = t0 + (k + 1) * 4 * DAY;
        return { id: e.id, status: k < done ? 'concluida' : k === done ? 'andamento' : 'pendente', previstaEm: iso(prevista), concluidaEm: k < done ? iso(Math.min(NOW - DAY / 2, t0 + (k + 1) * step * DAY * 0.9)) : null };
      });
      obras.push({ id: 'o' + (obras.length + 1), leadId: l.id, contratoId: c.id, propostaId: p.id, tecnicoId: 'u7', cidade: l.cidade, potenciaKwp: p.potenciaKwp, modulos: p.modulos, status: done >= 10 ? 'concluida' : 'andamento', etapas: etapas, inicioEm: c.assinadoEm, previsaoEntrega: iso(t0 + 42 * DAY), observacoes: '' });
    });

    /* ---------- estoque ---------- */
    var estoque = [
      ['Módulo', 'Módulo 550W Canadian Solar', 'Canadian Solar', 'CS6W-550MS', 'un', 180, 60, 610, 790],
      ['Módulo', 'Módulo 550W Jinko Tiger Neo', 'Jinko', 'JKM550M-72HL4', 'un', 96, 60, 595, 770],
      ['Módulo', 'Módulo 585W Trina Vertex', 'Trina Solar', 'TSM-585DE', 'un', 380, 60, 655, 840],
      ['Módulo', 'Módulo 585W JA Solar', 'JA Solar', 'JAM72D40-585', 'un', 24, 60, 648, 830],
      ['Módulo', 'Módulo 585W Risen', 'Risen', 'RSM144-585', 'un', 72, 40, 640, 820],
      ['Inversor', 'Inversor Growatt MIN 3000TL-X', 'Growatt', 'MIN3000TL-X', 'un', 9, 4, 2100, 2890],
      ['Inversor', 'Inversor Growatt MID 25KTL3-X', 'Growatt', 'MID25KTL3-X', 'un', 3, 2, 9800, 12900],
      ['Inversor', 'Inversor Fronius Primo 5.0', 'Fronius', 'Primo 5.0-1', 'un', 5, 3, 5600, 7400],
      ['Inversor', 'Inversor Fronius Symo 10.0', 'Fronius', 'Symo 10.0-3-M', 'un', 2, 2, 11200, 14600],
      ['Inversor', 'Inversor WEG SIW200G 10kW', 'WEG', 'SIW200G-M100', 'un', 4, 2, 10400, 13500],
      ['Estrutura', 'Kit fixação telhado cerâmico (por módulo)', 'Romagnole', 'KIT-CER', 'un', 520, 80, 58, 89],
      ['Estrutura', 'Kit fixação fibrocimento (por módulo)', 'Romagnole', 'KIT-FIB', 'un', 45, 80, 52, 82],
      ['Estrutura', 'Kit fixação metálico (por módulo)', 'ArcelorSol', 'KIT-MET', 'un', 130, 60, 49, 76],
      ['Estrutura', 'Estrutura de solo (4 módulos)', 'ArcelorSol', 'EST-SOLO4', 'un', 18, 10, 780, 1150],
      ['Cabo', 'Cabo solar 6mm² vermelho', 'Prysmian', 'CS6-VM', 'm', 1800, 500, 5.2, 8.5],
      ['Cabo', 'Cabo solar 6mm² preto', 'Prysmian', 'CS6-PT', 'm', 1650, 500, 5.2, 8.5],
      ['Cabo', 'Conector MC4 (par)', 'Stäubli', 'MC4-PAR', 'un', 340, 100, 11, 19],
      ['String box', 'String box 2E/2S', 'Clamper', 'SB-2E2S', 'un', 14, 6, 340, 520],
      ['String box', 'String box 4E/4S', 'Clamper', 'SB-4E4S', 'un', 3, 4, 690, 980]
    ].map(function (r, k) { return { id: 'e' + (k + 1), categoria: r[0], nome: r[1], marca: r[2], sku: r[3], unidade: r[4], qtd: r[5], min: r[6], custo: r[7], preco: r[8], reservas: [] }; });
    obras.forEach(function (o) {
      if (o.status === 'concluida') return;
      var item = estoque[o.potenciaKwp > 20 ? 2 : (ri(0, 1))];
      item.reservas.push({ obraId: o.id, qtd: o.modulos });
      estoque[10].reservas.push({ obraId: o.id, qtd: o.modulos });
    });
    estoque.forEach(function (e) { e.reservado = e.reservas.reduce(function (s, r) { return s + r.qtd; }, 0); });
    estoque.forEach(function (e) { if (e.qtd < e.reservado) e.qtd = e.reservado; });

    /* ---------- campanhas ---------- */
    var campanhas = [
      ['Solar Residencial - FB Ads', 'Facebook Ads', 4200, 'ativa'], ['Black Friday Solar', 'Facebook Ads', 6500, 'ativa'],
      ['Google - Energia Solar SP', 'Google Ads', 5800, 'ativa'], ['Google - Instalação Solar', 'Google Ads', 3900, 'ativa'],
      ['Reels Economia na Conta', 'Instagram', 2100, 'ativa'], ['Stories Orçamento', 'Instagram', 1500, 'pausada'],
      ['Click to WhatsApp', 'WhatsApp', 3200, 'ativa'], ['Orgânico / SEO', 'Site', 900, 'ativa'], ['Indique e Ganhe', 'Indicação', 1800, 'ativa']
    ].map(function (c, k) { return { id: 'm' + (k + 1), nome: c[0], canal: c[1], investimento: c[2], status: c[3], inicioEm: ago(ri(30, 85)) }; });

    /* ---------- tarefas ---------- */
    var tarefas = [], ativos = leads.filter(function (l) { return ['perdido', 'pos_venda'].indexOf(l.etapa) < 0; });
    var TT = [['ligacao', 'Ligar para'], ['whatsapp', 'Enviar WhatsApp para'], ['visita', 'Agendar visita técnica com'], ['proposta', 'Enviar proposta para'], ['followup', 'Follow-up com']];
    for (var t = 0; t < 40; t++) {
      var lt = ativos[t % ativos.length], tt = pick(TT), off = ri(-5, 6);
      tarefas.push({ id: 't' + (t + 1), leadId: lt.id, tipo: tt[0], titulo: tt[1] + ' ' + lt.nome.split(' ')[0] + (lt.tipo !== 'residencial' ? '' : ''), responsavelId: lt.vendedorId, vencimento: iso(NOW + off * DAY + ri(-8, 8) * 3600000), concluida: off < 0 ? rnd() < 0.65 : false });
    }
    tarefas[0] = { id: 't1', leadId: 'l1', tipo: 'ligacao', titulo: 'Ligar para João e apresentar simulação em 60x e 84x', responsavelId: 'u2', vencimento: fut(0, 3), concluida: false };

    /* ---------- financeiro ---------- */
    var lanc = [];
    function addL(o) { o.id = 'f' + (lanc.length + 1); if (!o.pagoEm) o.pagoEm = null; var v = new Date(o.vencimento).getTime(); o.status = o.pagoEm ? 'pago' : v < NOW ? 'atrasado' : 'pendente'; lanc.push(o); }
    function pagoSe(msv, chance) { return msv < NOW && rnd() < chance ? iso(msv + ri(0, 2) * DAY) : null; }
    contratos.forEach(function (c) {
      if (c.status !== 'assinado') return;
      var l = leadById[c.leadId], t0 = new Date(c.assinadoEm).getTime();
      var v1 = t0 + 2 * DAY, v2 = t0 + 20 * DAY, v3 = t0 + 15 * DAY, v4 = t0 + 8 * DAY;
      addL({ tipo: 'receber', descricao: 'Entrada 40% - ' + l.nome, valor: Math.round(c.valor * 0.4), vencimento: iso(v1), pagoEm: pagoSe(v1, 0.95), categoria: 'venda', contratoId: c.id, leadId: l.id });
      addL({ tipo: 'receber', descricao: 'Saldo 60% - ' + l.nome, valor: Math.round(c.valor * 0.6), vencimento: iso(v2), pagoEm: pagoSe(v2, 0.8), categoria: 'venda', contratoId: c.id, leadId: l.id });
      addL({ tipo: 'pagar', descricao: 'Comissão ' + primeiroNome(c.vendedorId) + ' - ' + l.nome, valor: Math.round(c.valor * 0.05), vencimento: iso(v3), pagoEm: pagoSe(v3, 0.9), categoria: 'comissao', contratoId: c.id, usuarioId: c.vendedorId });
      addL({ tipo: 'pagar', descricao: 'Materiais e equipamentos - ' + l.nome, valor: Math.round(c.valor * 0.52), vencimento: iso(v4), pagoEm: pagoSe(v4, 0.95), categoria: 'fornecedor', contratoId: c.id });
    });
    var d0 = new Date(NOW);
    for (var m = 2; m >= 0; m--) {
      var mes = new Date(d0.getFullYear(), d0.getMonth() - m, 1);
      [['Aluguel do escritório e galpão', 6500, 5, 'fixo'], ['Folha administrativa e equipe técnica', 18500, 10, 'folha'], ['Impostos (Simples Nacional)', 7800, 20, 'impostos'], ['Marketing e anúncios', 9400, 8, 'marketing'], ['Combustível e frota', 3200, 15, 'fixo'], ['Software e telefonia', 1250, 12, 'fixo']].forEach(function (f) {
        var v = new Date(mes.getFullYear(), mes.getMonth(), f[2], 12).getTime();
        addL({ tipo: 'pagar', descricao: f[0], valor: f[1], vencimento: iso(v), pagoEm: v < NOW ? iso(v) : null, categoria: f[3] });
      });
    }

    /* ---------- metas ---------- */
    var metas = [];
    for (var mm = 0; mm < 3; mm++) {
      var ref = new Date(d0.getFullYear(), d0.getMonth() - mm, 1), ym = ref.getFullYear() + '-' + pad(ref.getMonth() + 1, 2);
      vendedores.forEach(function (v, k) { metas.push({ id: 'mt' + (metas.length + 1), vendedorId: v, mes: ym, metaVendas: 100000 + k * 15000, metaLeads: 25, metaConversao: 20 }); });
    }

    /* ---------- auditoria ---------- */
    var AC = [['moveu o lead de etapa', 'lead'], ['enviou proposta', 'proposta'], ['editou dados do lead', 'lead'], ['registrou pagamento', 'financeiro'], ['ajustou estoque', 'estoque'], ['atualizou etapa da obra', 'obra'], ['concluiu tarefa', 'tarefa'], ['gerou contrato', 'contrato']];
    var auditoria = [];
    for (var a = 0; a < 32; a++) {
      var ac = pick(AC), u = ac[1] === 'financeiro' ? 'u8' : ac[1] === 'obra' || ac[1] === 'estoque' ? 'u7' : pick(vendedores.concat(['u1'])), lx = pick(leads);
      auditoria.push({ id: 'a' + (a + 1), usuarioId: u, acao: ac[0], entidade: ac[1], entidadeId: lx.id, detalhe: lx.nome, em: agoMin(ri(20, 90 * 1440)) });
    }
    auditoria.sort(function (x, y) { return y.em < x.em ? -1 : 1; });

    return {
      versao: 1,
      empresa: { nome: 'Solar Prime', cnpj: '12.345.678/0001-90', cidade: 'Campinas - SP', telefone: '(19) 3500-1234', email: 'contato@solarprime.com.br' },
      usuarios: usuarios, leads: leads, conversas: conversas, propostas: propostas, contratos: contratos, tarefas: tarefas,
      obras: obras, estoque: estoque, lancamentos: lanc, campanhas: campanhas, metas: metas, auditoria: auditoria
    };
  };
})();
