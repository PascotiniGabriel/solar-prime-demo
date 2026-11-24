/* Módulo: Agenda (#/agenda) - tarefas e follow-up: Hoje / Semana / Lista, sugestões da IA, reativação de leads. */
(function () {
  'use strict';
  var ui = SP.ui, esc = ui.esc, store = SP.store;
  var S = { view: 'hoje', vend: '', week: 0, gcal: false, showDone: false };
  try { S.gcal = localStorage.getItem('sp_agenda_gcal') === '1'; } catch (e) { /* ignora */ }

  var TIPOS = { ligacao: ['Ligação', 'phone'], whatsapp: ['WhatsApp', 'whatsapp'], visita: ['Visita', 'pin'], reuniao: ['Reunião', 'users'], proposta: ['Proposta', 'file'], followup: ['Follow-up', 'refresh'], instalacao: ['Instalação', 'hardhat'] };
  var DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var CLOSED = ['venda_fechada', 'instalacao', 'pos_venda', 'perdido'];

  function tinfo(t) { return TIPOS[t] || [t, 'calendar']; }
  function sod(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function sameDay(a, b) { return sod(a).getTime() === sod(b).getTime(); }
  function hhmm(iso) { var d = new Date(iso); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function toLocalInput(iso) { var d = new Date(iso), p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function dayTitle(d) { return DIAS[d.getDay()] + ', ' + ui.fmtDate(d.toISOString()).slice(0, 5); }

  function scopeUserId() { return SP.session.role === 'dono' ? S.vend : SP.session.userId; }
  function myTasks() {
    var role = SP.session.role, uid = scopeUserId(), tech = role === 'tecnico';
    var list = store.collection('tarefas').filter(function (t) {
      if (tech) return t.responsavelId === SP.session.userId || t.tipo === 'visita' || t.tipo === 'instalacao';
      return !uid || t.responsavelId === uid;
    });
    if (tech) { /* eventos de obra (somente leitura) */
      store.collection('obras').filter(function (o) { return o.tecnicoId === SP.session.userId && o.status !== 'concluida'; }).forEach(function (o) {
        var lead = store.lead(o.leadId);
        var nx = (o.etapas || []).filter(function (e) { return e.status !== 'concluida' && e.previstaEm; })[0];
        if (nx) list.push({ id: 'obra_' + o.id + nx.id, ro: true, leadId: o.leadId, tipo: 'instalacao', titulo: 'Obra: ' + SP.consts.OBRA_ETAPAS.filter(function (x) { return x.id === nx.id; }).map(function (x) { return x.nome; }).join('') + ' - ' + (lead ? lead.nome : o.cidade), responsavelId: o.tecnicoId, vencimento: nx.previstaEm, concluida: false });
      });
    }
    return list.sort(function (a, b) { return new Date(a.vencimento) - new Date(b.vencimento); });
  }
  function isOverdue(t) { return !t.concluida && new Date(t.vencimento) < new Date() && !sameDayAfterNow(t); }
  function sameDayAfterNow(t) { return false; }

  function taskHtml(t, compact) {
    var l = store.lead(t.leadId), ti = tinfo(t.tipo), od = isOverdue(t), u = store.user(t.responsavelId);
    return '<div class="ag-task' + (t.concluida ? ' done' : '') + (od ? ' over' : '') + '" data-id="' + t.id + '">' +
      (t.ro ? '<span class="ag-ro">' + ui.icon('hardhat', 16) + '</span>' : '<button class="ag-check" data-done="' + t.id + '" aria-label="Concluir">' + (t.concluida ? ui.icon('check', 14) : '') + '</button>') +
      '<div class="ag-body"' + (t.ro ? '' : ' data-edit="' + t.id + '"') + '><div class="ag-title">' + esc(t.titulo) + '</div>' +
      '<div class="ag-meta"><span class="ag-type">' + ui.icon(ti[1], 12) + ' ' + ti[0] + '</span><span class="' + (od ? 'ag-late' : '') + '">' + (compact ? hhmm(t.vencimento) : ui.fmtDateTime(t.vencimento)) + '</span>' +
      (l && !compact ? '<a href="#/leads/' + l.id + '">' + esc(l.nome) + '</a>' : '') + (u && SP.session.role === 'dono' && !compact ? '<span>' + esc(u.nome.split(' ')[0]) + '</span>' : '') + '</div></div>' +
      (t.ro ? '' : '<button class="btn btn-ghost btn-icon btn-sm" data-edit="' + t.id + '" aria-label="Editar">' + ui.icon('edit', 14) + '</button>') + '</div>';
  }

  /* ---------- modal de tarefa ---------- */
  function openTask(t, defDate) {
    var isNew = !t, leads = store.visibleLeads().slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    if (t && t.leadId && !leads.some(function (l) { return l.id === t.leadId; }) && store.lead(t.leadId)) leads.unshift(store.lead(t.leadId));
    var resp = store.collection('usuarios').filter(function (u) { return u.papel !== 'financeiro'; });
    if (SP.session.role !== 'dono') resp = resp.filter(function (u) { return u.id === SP.session.userId || SP.session.role === 'tecnico'; });
    t = t || { tipo: 'ligacao', titulo: '', leadId: '', responsavelId: scopeUserId() || SP.session.userId, vencimento: (defDate || nextHour()).toISOString(), concluida: false };
    var body = '<div class="form">' +
      '<label class="full">Título<input id="agT" value="' + esc(t.titulo) + '" placeholder="Ex.: Ligar para apresentar a proposta"></label>' +
      '<label>Tipo<select id="agTipo">' + Object.keys(TIPOS).map(function (k) { return '<option value="' + k + '"' + (k === t.tipo ? ' selected' : '') + '>' + TIPOS[k][0] + '</option>'; }).join('') + '</select></label>' +
      '<label>Data e hora<input id="agD" type="datetime-local" value="' + toLocalInput(t.vencimento) + '"></label>' +
      '<label>Lead<select id="agL"><option value="">Sem lead</option>' + leads.map(function (l) { return '<option value="' + l.id + '"' + (l.id === t.leadId ? ' selected' : '') + '>' + esc(l.nome) + '</option>'; }).join('') + '</select></label>' +
      '<label>Responsável<select id="agR">' + resp.map(function (u) { return '<option value="' + u.id + '"' + (u.id === t.responsavelId ? ' selected' : '') + '>' + esc(u.nome) + '</option>'; }).join('') + '</select></label></div>';
    var actions = [{ label: 'Cancelar' }];
    if (!isNew) actions.push({ label: 'Excluir', cls: 'btn-danger', onClick: function () { store.remove('tarefas', t.id); store.log('excluiu tarefa', 'tarefa', t.id, t.titulo); ui.toast('Tarefa excluída'); SP.refresh(); } });
    actions.push({ label: isNew ? 'Criar tarefa' : 'Salvar', cls: 'btn-primary', onClick: function (ctx) {
      var q = function (s) { return ctx.body.querySelector(s).value; };
      if (!q('#agT').trim()) { ui.toast('Informe um título', 'error'); return false; }
      if (!q('#agD')) { ui.toast('Informe data e hora', 'error'); return false; }
      var item = Object.assign({}, t, { titulo: q('#agT').trim(), tipo: q('#agTipo'), vencimento: new Date(q('#agD')).toISOString(), leadId: q('#agL') || null, responsavelId: q('#agR') });
      store.upsert('tarefas', item); store.log(isNew ? 'criou tarefa' : 'editou tarefa', 'tarefa', item.id, item.titulo);
      ui.toast(isNew ? 'Tarefa criada' : 'Tarefa atualizada', 'success'); SP.refresh();
    } });
    ui.modal({ title: isNew ? 'Nova tarefa' : 'Editar tarefa', body: body, actions: actions });
  }
  function nextHour() { var d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return d; }

  function toggle(id) {
    var t = store.find('tarefas', id); if (!t) return;
    store.patch('tarefas', id, { concluida: !t.concluida });
    store.log(t.concluida ? 'concluiu tarefa' : 'reabriu tarefa', 'tarefa', id, t.titulo); SP.refresh();
  }

  /* ---------- IA ---------- */
  function openTaskLeadIds() { var m = {}; store.collection('tarefas').forEach(function (t) { if (!t.concluida && t.leadId) m[t.leadId] = true; }); return m; }
  function suggestions() {
    var hasTask = openTaskLeadIds(), props = store.collection('propostas');
    return store.visibleLeads().filter(function (l) { return CLOSED.indexOf(l.etapa) < 0 && !hasTask[l.id] && (SP.session.role !== 'dono' || !S.vend || l.vendedorId === S.vend); }).map(function (l) {
      var idle = Math.min(60, ui.daysSince(l.ultimoContato)), why = [], sc = (l.score || 0);
      var pend = props.filter(function (p) { return p.leadId === l.id && (p.status === 'enviada' || p.status === 'visualizada') && ui.daysSince(p.enviadaEm || p.criadaEm) >= 2; })[0];
      var pr = sc + idle * 1.2 + (pend ? 30 : 0);
      if (sc >= 70) why.push('score alto (' + sc + ')');
      if (idle >= 3) why.push('sem contato há ' + Math.floor(idle) + ' dias');
      if (pend) why.push('proposta ' + (pend.status === 'visualizada' ? 'visualizada' : 'enviada') + ' sem resposta');
      return { lead: l, pr: pr, why: why.length ? why.join(' · ') : 'oportunidade em andamento', pend: pend };
    }).sort(function (a, b) { return b.pr - a.pr; }).slice(0, 5);
  }
  function reactivation() {
    var hasTask = openTaskLeadIds();
    return store.visibleLeads().filter(function (l) {
      if (hasTask[l.id] || ['venda_fechada', 'instalacao', 'pos_venda'].indexOf(l.etapa) >= 0) return false;
      return l.etapa === 'perdido' || ui.daysSince(l.ultimoContato) > 30;
    });
  }
  function reactMsg(l) {
    var n = l.nome.split(' ')[0];
    if (l.etapa === 'perdido' && l.motivoPerda) return 'Oi ' + n + ', tudo bem? Temos novas condições de financiamento e a tarifa de energia subiu. Vale uma nova simulação?';
    if (l.valorConta) return 'Oi ' + n + '! Sua conta de luz de ~' + ui.fmtMoney(l.valorConta) + ' pode cair até 90% com energia solar. Posso refazer a proposta com as condições atuais?';
    return 'Oi ' + n + ', faz um tempo que conversamos. Posso te mostrar quanto você economizaria hoje com energia solar?';
  }

  /* ---------- render ---------- */
  SP.register({
    route: 'agenda', title: 'Agenda', icon: 'calendar', group: 'Vendas', order: 13, roles: ['dono', 'vendedor', 'tecnico'],
    render: function (el) {
      var role = SP.session.role, tasks = myTasks(), now = new Date();
      var canIA = role !== 'tecnico';
      var open = tasks.filter(function (t) { return !t.concluida; });
      var over = open.filter(isOverdue);
      var vends = store.vendedores();

      var actions = '<button class="btn btn-primary" data-act="new">' + ui.icon('plus', 16) + ' Nova tarefa</button>';
      el.innerHTML = ui.pageHeader('Agenda', role === 'tecnico' ? 'Visitas e instalações' : 'Tarefas e follow-ups', actions) +
        '<div class="ag-bar">' + ui.tabs([{ id: 'hoje', label: 'Hoje' }, { id: 'semana', label: 'Semana' }, { id: 'lista', label: 'Lista' }], S.view) +
        '<div class="ag-tools">' + (role === 'dono' ? '<select class="input" id="agV"><option value="">Todos os vendedores</option>' + vends.map(function (v) { return '<option value="' + v.id + '"' + (S.vend === v.id ? ' selected' : '') + '>' + esc(v.nome) + '</option>'; }).join('') + '</select>' : '') +
        '<label class="ag-gc"><input type="checkbox" id="agG"' + (S.gcal ? ' checked' : '') + '> ' + ui.icon('calendar', 14) + ' Google Calendar</label></div></div>' +
        (S.gcal ? '<div class="ag-sync">' + ui.icon('check', 14) + ' Sincronização simulada ativa: suas tarefas aparecem no Google Calendar (demonstração).</div>' : '') +
        '<div class="ag-layout"><div class="ag-main"></div>' + (canIA ? '<aside class="ag-side"></aside>' : '') + '</div>';
      var main = el.querySelector('.ag-main'), side = el.querySelector('.ag-side');

      /* vermelho: atrasadas */
      var html = '';
      if (over.length && S.view !== 'semana') html += '<div class="card ag-over"><div class="card-title">' + ui.icon('alert', 16) + ' Atrasadas (' + over.length + ')</div>' + over.map(function (t) { return taskHtml(t); }).join('') + '</div>';

      if (S.view === 'hoje') {
        var today = open.filter(function (t) { return sameDay(t.vencimento, now) && !isOverdue(t) || (sameDay(t.vencimento, now) && isOverdue(t) && false); });
        var todayAll = tasks.filter(function (t) { return sameDay(t.vencimento, now) && !isOverdue(t); });
        html += '<div class="card"><div class="card-title">Hoje · ' + dayTitle(now) + ' <span class="badge badge-orange">' + today.length + ' pendentes</span></div>' +
          (todayAll.length ? todayAll.map(function (t) { return taskHtml(t); }).join('') : ui.empty({ icon: 'calendar', title: 'Dia livre', text: 'Nenhuma tarefa para hoje. Veja as sugestões da IA ou crie uma nova.' })) + '</div>';
        var tm = open.filter(function (t) { var d = sod(now); d.setDate(d.getDate() + 1); return sameDay(t.vencimento, d); });
        if (tm.length) html += '<div class="card"><div class="card-title">Amanhã</div>' + tm.map(function (t) { return taskHtml(t); }).join('') + '</div>';
      } else if (S.view === 'semana') {
        var start = sod(now); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + S.week * 7);
        var end = new Date(start); end.setDate(end.getDate() + 6);
        html += '<div class="card"><div class="ag-wk-head"><button class="btn btn-sm" data-wk="-1">&lsaquo;</button><b>' + ui.fmtDate(start.toISOString()).slice(0, 5) + ' a ' + ui.fmtDate(end.toISOString()).slice(0, 5) + '</b><button class="btn btn-sm" data-wk="1">&rsaquo;</button><button class="btn btn-sm btn-ghost" data-wk="0">Hoje</button></div><div class="ag-week">';
        for (var i = 0; i < 7; i++) {
          var d = new Date(start); d.setDate(d.getDate() + i);
          var dt = tasks.filter(function (t) { return sameDay(t.vencimento, d); });
          html += '<div class="ag-day' + (sameDay(d, now) ? ' today' : '') + '"><div class="ag-day-h"><span>' + dayTitle(d) + '</span><button class="btn btn-ghost btn-icon btn-sm" data-newday="' + d.toISOString() + '" aria-label="Adicionar">' + ui.icon('plus', 14) + '</button></div>' +
            (dt.map(function (t) { var ti = tinfo(t.tipo); return '<div class="ag-chip' + (t.concluida ? ' done' : '') + (isOverdue(t) ? ' over' : '') + '" ' + (t.ro ? '' : 'data-edit="' + t.id + '"') + ' title="' + esc(t.titulo) + '"><b>' + hhmm(t.vencimento) + '</b> ' + ui.icon(ti[1], 11) + ' ' + esc(t.titulo) + '</div>'; }).join('') || '<div class="muted text-sm ag-none">Livre</div>') + '</div>';
        }
        html += '</div></div>';
      } else {
        var rest = tasks.filter(function (t) { return S.showDone ? true : !t.concluida; }).filter(function (t) { return !isOverdue(t); });
        html += '<div class="card"><div class="card-title">Todas as tarefas <label class="ag-gc right"><input type="checkbox" id="agDone"' + (S.showDone ? ' checked' : '') + '> mostrar concluídas</label></div>' +
          (rest.length ? rest.map(function (t) { return taskHtml(t); }).join('') : ui.empty({ icon: 'check', title: 'Tudo em dia', text: 'Nenhuma tarefa pendente.' })) + '</div>';
      }
      main.innerHTML = html;

      /* sugestões IA */
      if (side) {
        var sg = suggestions(), re = reactivation();
        side.innerHTML = '<div class="card"><div class="card-title">' + ui.icon('star', 16) + ' Sugestões da IA</div><div class="muted text-sm mb">Quem contatar primeiro (score, tempo parado e propostas sem resposta)</div>' +
          (sg.length ? sg.map(function (s, i) { return '<div class="ag-sg"><div class="ag-sg-n">' + (i + 1) + '</div><div class="grow"><a href="#/leads/' + s.lead.id + '"><b>' + esc(s.lead.nome) + '</b></a><div class="muted text-sm">' + esc(s.why) + '</div></div><button class="btn btn-sm btn-primary" data-sg="' + s.lead.id + '">Criar tarefa</button></div>'; }).join('') : '<div class="muted text-sm">Todos os leads quentes já têm tarefa. Bom trabalho!</div>') + '</div>' +
          '<div class="card"><div class="card-title">' + ui.icon('refresh', 16) + ' Reativar leads antigos</div><div class="text-sm muted mb">' + re.length + ' leads perdidos ou sem contato há mais de 30 dias.</div><button class="btn" data-act="react"' + (re.length ? '' : ' disabled') + '>Criar campanha de reativação</button></div>';
      }

      /* eventos */
      el.querySelector('[data-act=new]').addEventListener('click', function () { openTask(); });
      el.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { S.view = b.getAttribute('data-tab'); SP.refresh(); }); });
      var sv = el.querySelector('#agV'); if (sv) sv.addEventListener('change', function () { S.vend = sv.value; SP.refresh(); });
      el.querySelector('#agG').addEventListener('change', function (e) {
        S.gcal = e.target.checked; try { localStorage.setItem('sp_agenda_gcal', S.gcal ? '1' : '0'); } catch (x) { /* ignora */ }
        ui.toast(S.gcal ? 'Google Calendar conectado (simulado)' : 'Google Calendar desconectado'); SP.refresh();
      });
      var sd = el.querySelector('#agDone'); if (sd) sd.addEventListener('change', function () { S.showDone = sd.checked; SP.refresh(); });
      el.querySelectorAll('[data-done]').forEach(function (b) { b.addEventListener('click', function () { toggle(b.getAttribute('data-done')); }); });
      el.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function (e) { if (e.target.closest('a')) return; openTask(store.find('tarefas', b.getAttribute('data-edit'))); }); });
      el.querySelectorAll('[data-wk]').forEach(function (b) { b.addEventListener('click', function () { var v = +b.getAttribute('data-wk'); S.week = v === 0 ? 0 : S.week + v; SP.refresh(); }); });
      el.querySelectorAll('[data-newday]').forEach(function (b) { b.addEventListener('click', function () { var d = new Date(b.getAttribute('data-newday')); d.setHours(9, 0, 0, 0); openTask(null, d); }); });
      el.querySelectorAll('[data-sg]').forEach(function (b) { b.addEventListener('click', function () {
        var l = store.lead(b.getAttribute('data-sg')), s = sg.filter(function (x) { return x.lead.id === l.id; })[0], d = nextHour();
        store.upsert('tarefas', { leadId: l.id, tipo: s && s.pend ? 'followup' : 'ligacao', titulo: (s && s.pend ? 'Follow-up da proposta com ' : 'Ligar para ') + l.nome.split(' ')[0], responsavelId: l.vendedorId, vencimento: d.toISOString(), concluida: false });
        store.log('criou tarefa (sugestão IA)', 'lead', l.id, l.nome); ui.toast('Tarefa criada para hoje às ' + hhmm(d.toISOString()), 'success'); SP.refresh();
      }); });
      var rb = el.querySelector('[data-act=react]');
      if (rb) rb.addEventListener('click', function () {
        var re2 = reactivation();
        var body = '<p class="text-sm muted">Serão criadas ' + re2.length + ' tarefas de WhatsApp, uma por lead, com mensagem personalizada sugerida. Prévia:</p><div class="ag-prev">' +
          re2.slice(0, 4).map(function (l) { return '<div class="ag-prev-i"><b>' + esc(l.nome) + '</b><div class="text-sm muted">' + esc(reactMsg(l)) + '</div></div>'; }).join('') + (re2.length > 4 ? '<div class="muted text-sm">... e mais ' + (re2.length - 4) + '</div>' : '') + '</div>';
        ui.modal({ title: 'Campanha de reativação', body: body, actions: [{ label: 'Cancelar' }, { label: 'Criar ' + re2.length + ' tarefas', cls: 'btn-primary', onClick: function () {
          var base = nextHour();
          re2.forEach(function (l, i) {
            var d = new Date(base.getTime() + Math.floor(i / 6) * 86400000 + (i % 6) * 1800000);
            store.upsert('tarefas', { leadId: l.id, tipo: 'whatsapp', titulo: 'Reativação: ' + l.nome.split(' ')[0] + ' - "' + reactMsg(l) + '"', responsavelId: l.vendedorId, vencimento: d.toISOString(), concluida: false });
          });
          store.log('campanha de reativação', 'tarefa', '-', re2.length + ' leads'); ui.toast(re2.length + ' tarefas de reativação criadas', 'success'); SP.refresh();
        } }] });
      });
    }
  });
})();
