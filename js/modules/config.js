/* Módulo: Configurações (#/config) - empresa, permissões, auditoria, integrações, distribuição, dados da demo. */
(function () {
  'use strict';
  var ui = SP.ui, store = SP.store, esc = ui.esc;
  var st = { tab: 'empresa', fUser: '', fAcao: '' };
  var TABS = [{ id: 'empresa', label: 'Empresa' }, { id: 'usuarios', label: 'Usuários e permissões' }, { id: 'auditoria', label: 'Auditoria' }, { id: 'integracoes', label: 'Integrações' }, { id: 'distribuicao', label: 'Distribuição de leads' }, { id: 'demo', label: 'Dados da demo' }];
  var PAPEIS = [['dono', 'Dono'], ['vendedor', 'Vendedor'], ['tecnico', 'Técnico'], ['financeiro', 'Financeiro']];
  var AREAS = [['Leads e funil', [1, 1, 1, 0]], ['Propostas e contratos', [1, 1, 0, 1]], ['Obras e estoque', [1, 0, 1, 0]], ['Financeiro', [1, 0, 0, 1]], ['Metas e ranking', [1, 1, 0, 0]], ['Marketing', [1, 0, 0, 0]], ['Configurações', [1, 0, 0, 0]]];
  var INTEGS = [
    ['whatsapp', 'WhatsApp Business API', 'whatsapp', 'Atenda e dispare mensagens pelo número oficial.', 'Demo'],
    ['instagram', 'Instagram Direct', 'instagram', 'Receba mensagens do Instagram no CRM.', 'Demo'],
    ['fb', 'Facebook Lead Ads', 'users', 'Leads dos formulários caem direto no funil.', 'Disponível no plano'],
    ['gads', 'Google Ads', 'megaphone', 'Importe custos e conversões das campanhas.', 'Disponível no plano'],
    ['gcal', 'Google Calendar', 'calendar', 'Sincronize visitas e instalações na agenda.', 'Demo'],
    ['sign', 'Assinatura eletrônica', 'contract', 'Contratos assinados com validade jurídica.', 'Demo'],
    ['fin', 'Financiamento', 'dollar', 'Simule e aprove crédito com bancos parceiros.', 'Disponível no plano'],
    ['dim', 'Dimensionamento', 'sunpower', 'Cálculo de kWp e geração a partir da conta de luz.', 'Demo'],
    ['erp', 'ERP', 'wallet', 'Omie, Conta Azul, Bling, Tiny e SAP B1 (veja Financeiro).', 'Disponível no plano'],
    ['mail', 'E-mail', 'mail', 'Envio de propostas e notificações.', 'Demo'],
    ['storage', 'Armazenamento', 'box', 'Documentos, fotos de obra e contratos na nuvem.', 'Disponível no plano']
  ];

  function cfg() { var db = store.get(); if (!db.config) db.config = {}; return db.config; }

  function render(el) {
    var tab = st.tab;
    el.innerHTML = ui.pageHeader('Configurações', 'Ajuste a empresa, permissões e integrações.') + ui.tabs(TABS, tab) + '<div class="mt cfg-body">' + ({ empresa: empresa, usuarios: usuarios, auditoria: auditoria, integracoes: integracoes, distribuicao: distribuicao, demo: demo }[tab])() + '</div>';
    el.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { st.tab = b.dataset.tab; SP.refresh(); }); });
    bind[tab](el);
  }

  /* ---- Empresa ---- */
  function empresa() {
    var e = store.get().empresa || {}, cor = cfg().logoCor || '#F97316';
    return '<div class="card"><div class="card-title">Dados da empresa</div><div class="form">' +
      f('Nome da empresa', 'e-nome', e.nome) + f('CNPJ', 'e-cnpj', e.cnpj) + f('Cidade', 'e-cidade', e.cidade) + f('Telefone', 'e-tel', e.telefone) + f('E-mail', 'e-mail', e.email, 'full') +
      '<label class="full">Cor da marca<div class="row"><input type="color" id="e-cor" value="' + cor + '" style="width:60px;padding:2px"><span class="cfg-logo" id="e-prev" style="background:' + cor + '">' + esc((e.nome || 'S').charAt(0)) + '</span><span class="text-sm muted">Prévia do logo</span></div></label></div>' +
      '<div class="mt"><button class="btn btn-primary" id="e-save">Salvar alterações</button></div></div>';
  }
  function f(l, id, v, cls) { return '<label class="' + (cls || '') + '">' + l + '<input id="' + id + '" value="' + esc(v || '') + '"></label>'; }

  /* ---- Usuários ---- */
  function usuarios() {
    var p = cfg().permissoes; if (!p) { p = cfg().permissoes = {}; AREAS.forEach(function (a) { p[a[0]] = a[1].slice(); }); }
    var h = '<div class="card mb"><div class="card-title">Permissões por papel</div><p class="muted text-sm mb">Marque o que cada papel pode acessar. O papel Dono sempre tem acesso total.</p><div class="table-wrap"><table class="table"><thead><tr><th>Área</th>' + PAPEIS.map(function (x) { return '<th>' + x[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      AREAS.map(function (a) {
        return '<tr><td>' + a[0] + '</td>' + PAPEIS.map(function (x, i) { return '<td><label class="cfg-sw"><input type="checkbox" data-perm="' + esc(a[0]) + '|' + i + '"' + (p[a[0]][i] ? ' checked' : '') + (i === 0 ? ' disabled' : '') + '><span></span></label></td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>';
    h += '<div class="card"><div class="card-title">Equipe</div><div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th></tr></thead><tbody>' + store.collection('usuarios').map(function (u) {
      return '<tr><td><span class="row">' + ui.userAvatar(u.id, 26) + ' ' + esc(u.nome) + '</span></td><td>' + esc(u.email) + '</td><td>' + ui.badge((SP.consts.PAPEIS && SP.consts.PAPEIS[u.papel]) || u.papel, u.papel === 'dono' ? 'orange' : 'blue') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
    return h;
  }

  /* ---- Auditoria ---- */
  function auditoria() {
    var all = store.collection('auditoria'), acoes = {};
    all.forEach(function (a) { acoes[a.acao] = 1; });
    var rows = all.filter(function (a) { return (!st.fUser || a.usuarioId === st.fUser) && (!st.fAcao || a.acao === st.fAcao); }).slice(0, 100);
    return '<div class="card"><div class="card-title">Registro de atividades</div><div class="row mb cfg-filters"><select class="input" id="a-user"><option value="">Todos os usuários</option>' + store.collection('usuarios').map(function (u) { return '<option value="' + u.id + '"' + (st.fUser === u.id ? ' selected' : '') + '>' + esc(u.nome) + '</option>'; }).join('') + '</select>' +
      '<select class="input" id="a-acao"><option value="">Todas as ações</option>' + Object.keys(acoes).sort().map(function (a) { return '<option' + (st.fAcao === a ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></div>' +
      (rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>' + rows.map(function (a) {
        var u = store.user(a.usuarioId); return '<tr><td>' + ui.fmtDateTime(a.em) + '</td><td>' + esc(u ? u.nome : '-') + '</td><td>' + esc(a.acao) + '<div class="text-sm muted">' + esc(a.entidade) + '</div></td><td>' + esc(a.detalhe) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : ui.empty({ icon: 'search', title: 'Nada encontrado', text: 'Ajuste os filtros.' })) + '</div>';
  }

  /* ---- Integrações ---- */
  function integracoes() {
    var c = cfg().integracoes || {};
    return '<div class="grid grid-3">' + INTEGS.map(function (i) {
      var on = c[i[0]];
      return '<div class="card cfg-int"><div class="row"><span class="cfg-ic">' + ui.icon(i[2], 22) + '</span><b class="grow">' + i[1] + '</b></div><p class="text-sm muted">' + i[3] + '</p><div class="row">' +
        (on ? ui.badge('Conectado (simulado)', 'green') : ui.badge(i[4], i[4] === 'Demo' ? 'blue' : 'gray')) + '<span class="grow"></span><button class="btn btn-sm ' + (on ? 'btn-ghost' : 'btn-primary') + '" data-int="' + i[0] + '">' + (on ? 'Desconectar' : 'Simular conexão') + '</button></div></div>';
    }).join('') + '</div>';
  }

  /* ---- Distribuição ---- */
  function distribuicao() {
    var d = cfg().distribuicao || { modo: 'roundrobin', regioes: {}, origens: {} }, vs = store.vendedores();
    var modos = [['roundrobin', 'Rodízio (round-robin)', 'Cada novo lead vai para o próximo vendedor da fila.'], ['regiao', 'Por região', 'O lead vai para o vendedor responsável pela cidade.'], ['origem', 'Por origem', 'Cada canal de entrada tem um vendedor dedicado.']];
    var opts = function (cur) { return '<option value="">Rodízio</option>' + vs.map(function (v) { return '<option value="' + v.id + '"' + (cur === v.id ? ' selected' : '') + '>' + esc(v.nome) + '</option>'; }).join(''); };
    var cidades = {}; store.collection('leads').forEach(function (l) { if (l.cidade) cidades[l.cidade] = (cidades[l.cidade] || 0) + 1; });
    var top = Object.keys(cidades).sort(function (a, b) { return cidades[b] - cidades[a]; }).slice(0, 5);
    return '<div class="card"><div class="card-title">Como distribuir novos leads</div><div class="stack">' + modos.map(function (m) {
      return '<label class="cfg-radio' + (d.modo === m[0] ? ' on' : '') + '"><input type="radio" name="dist" value="' + m[0] + '"' + (d.modo === m[0] ? ' checked' : '') + '><div><b>' + m[1] + '</b><div class="text-sm muted">' + m[2] + '</div></div></label>';
    }).join('') + '</div>' +
      (d.modo === 'regiao' ? '<div class="mt"><b>Vendedor por cidade</b><div class="form mt">' + top.map(function (c) { return '<label>' + esc(c) + '<select data-reg="' + esc(c) + '">' + opts(d.regioes[c]) + '</select></label>'; }).join('') + '</div></div>' : '') +
      (d.modo === 'origem' ? '<div class="mt"><b>Vendedor por origem</b><div class="form mt">' + SP.consts.ORIGENS.map(function (o) { return '<label>' + esc(o) + '<select data-ori="' + esc(o) + '">' + opts(d.origens[o]) + '</select></label>'; }).join('') + '</div></div>' : '') +
      '<div class="mt"><button class="btn btn-primary" id="d-save">Salvar regras</button></div></div>';
  }

  /* ---- Demo ---- */
  function demo() {
    return '<div class="card"><div class="card-title">Dados da demonstração</div><p class="muted">Todos os dados são fictícios e ficam salvos só neste navegador. Restaurar apaga alterações e volta ao estado inicial.</p>' +
      '<p class="text-sm muted mt">' + store.collection('leads').length + ' leads, ' + store.collection('contratos').length + ' contratos, ' + store.collection('lancamentos').length + ' lançamentos.</p>' +
      '<div class="mt"><button class="btn btn-danger" id="d-reset">' + ui.icon('refresh', 16) + ' Restaurar dados da demo</button></div></div>';
  }

  var bind = {
    empresa: function (el) {
      el.querySelector('#e-cor').addEventListener('input', function (e) { el.querySelector('#e-prev').style.background = e.target.value; });
      el.querySelector('#e-save').addEventListener('click', function () {
        var g = function (i) { return el.querySelector(i).value.trim(); };
        if (!g('#e-nome')) return ui.toast('Informe o nome da empresa', 'error');
        var e = store.get().empresa; e.nome = g('#e-nome'); e.cnpj = g('#e-cnpj'); e.cidade = g('#e-cidade'); e.telefone = g('#e-tel'); e.email = g('#e-mail');
        cfg().logoCor = el.querySelector('#e-cor').value; document.documentElement.style.setProperty('--primary', cfg().logoCor);
        store.save(); store.log('editou dados da empresa', 'config', 'empresa', e.nome); ui.toast('Empresa atualizada', 'success');
      });
    },
    usuarios: function (el) {
      el.querySelectorAll('[data-perm]').forEach(function (c) {
        c.addEventListener('change', function () {
          var p = c.dataset.perm.split('|'); cfg().permissoes[p[0]][+p[1]] = c.checked ? 1 : 0; store.save();
          store.log('alterou permissão', 'config', p[0], PAPEIS[+p[1]][1] + (c.checked ? ' liberado' : ' bloqueado')); ui.toast('Permissão atualizada (demonstração)', 'success');
        });
      });
    },
    auditoria: function (el) {
      el.querySelector('#a-user').addEventListener('change', function (e) { st.fUser = e.target.value; SP.refresh(); });
      el.querySelector('#a-acao').addEventListener('change', function (e) { st.fAcao = e.target.value; SP.refresh(); });
    },
    integracoes: function (el) {
      el.querySelectorAll('[data-int]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.dataset.int, c = cfg(); c.integracoes = c.integracoes || {};
          var nome = INTEGS.filter(function (i) { return i[0] === id; })[0][1];
          if (c.integracoes[id]) { delete c.integracoes[id]; store.save(); store.log('desconectou integração', 'config', id, nome); return SP.refresh(); }
          b.disabled = true; b.textContent = 'Conectando...';
          setTimeout(function () { c.integracoes[id] = true; store.save(); store.log('conectou integração (simulado)', 'config', id, nome); ui.toast(nome + ' conectado (simulação)', 'success'); SP.refresh(); }, 900);
        });
      });
    },
    distribuicao: function (el) {
      el.querySelectorAll('[name=dist]').forEach(function (r) { r.addEventListener('change', function () { var d = cfg().distribuicao || (cfg().distribuicao = { modo: 'roundrobin', regioes: {}, origens: {} }); d.modo = r.value; store.save(); SP.refresh(); }); });
      el.querySelector('#d-save').addEventListener('click', function () {
        var d = cfg().distribuicao || (cfg().distribuicao = { modo: 'roundrobin', regioes: {}, origens: {} });
        el.querySelectorAll('[data-reg]').forEach(function (s) { d.regioes[s.dataset.reg] = s.value; });
        el.querySelectorAll('[data-ori]').forEach(function (s) { d.origens[s.dataset.ori] = s.value; });
        store.save(); store.log('alterou distribuição de leads', 'config', d.modo, 'Modo: ' + d.modo); ui.toast('Regras salvas', 'success');
      });
    },
    demo: function (el) {
      el.querySelector('#d-reset').addEventListener('click', function () {
        ui.modal({
          title: 'Restaurar dados?', size: 'sm', body: '<p>Todas as alterações feitas na demonstração serão perdidas.</p>',
          actions: [{ label: 'Cancelar', cls: 'btn-ghost' }, { label: 'Restaurar', cls: 'btn-danger', onClick: function () { store.reset(); ui.toast('Dados restaurados', 'success'); SP.refresh(); } }]
        });
      });
    }
  };

  SP.register({
    route: 'config', title: 'Configurações', icon: 'settings', group: 'Gestão', order: 33, roles: ['dono'],
    render: function (el) { render(el); }
  });
})();
