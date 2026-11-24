/* Módulo: Metas e gamificação (#/metas). */
(function () {
  'use strict';
  var ui = SP.ui, store = SP.store, esc = ui.esc, M = function (v) { return ui.fmtMoney(v); };
  var PREMIOS = ['Jantar para 2 + R$ 500 em bônus', 'Bônus de R$ 250', 'Voucher de R$ 100'];

  function ym(d) { d = new Date(d); return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1); }
  function offYm(off) { var n = new Date(); return ym(new Date(n.getFullYear(), n.getMonth() + off, 1)); }
  function ymLabel(k) { var p = k.split('-'); return ui.monthName(+p[1] - 1) + '/' + p[0].slice(2); }

  function stats(v, mes) {
    var cs = store.collection('contratos').filter(function (c) { return c.vendedorId === v.id && c.status === 'assinado' && c.assinadoEm && ym(c.assinadoEm) === mes; });
    var leads = store.collection('leads').filter(function (l) { return l.vendedorId === v.id; });
    var novos = leads.filter(function (l) { return ym(l.criadoEm) === mes; }).length;
    var fech = leads.filter(function (l) { return SP.consts.FECHADAS.indexOf(l.etapa) >= 0; }).length;
    var resp = leads.filter(function (l) { return l.primeiraRespostaMin != null; });
    var meta = store.where('metas', function (m) { return m.vendedorId === v.id && m.mes === mes; })[0] || { metaVendas: 100000, metaLeads: 25, metaConversao: 20 };
    return {
      v: v, n: cs.length, fat: cs.reduce(function (s, c) { return s + c.valor; }, 0), novos: novos, meta: meta,
      conv: leads.length ? fech / leads.length * 100 : 0, leadsTotal: leads.length,
      resp: resp.length ? resp.reduce(function (s, l) { return s + l.primeiraRespostaMin; }, 0) / resp.length : null,
      totalContratos: store.collection('contratos').filter(function (c) { return c.vendedorId === v.id && c.status === 'assinado'; }).length
    };
  }

  function badgesFor(s) {
    return [
      { ic: 'star', n: 'Primeira venda', d: 'Fechou o primeiro contrato', ok: s.totalContratos >= 1 },
      { ic: 'trending', n: '5 contratos no mês', d: 'Fechou 5 ou mais no mês', ok: s.n >= 5 },
      { ic: 'bolt', n: 'Resposta relâmpago', d: 'Responde leads em até 15 min', ok: s.resp != null && s.resp <= 15 },
      { ic: 'target', n: 'Meta batida', d: 'Atingiu a meta de vendas', ok: s.fat >= s.meta.metaVendas },
      { ic: 'funnel', n: 'Conversão 25%+', d: 'Converte um em cada quatro leads', ok: s.conv >= 25 }
    ];
  }

  function render(el) {
    var mes = offYm(0), isDono = SP.session.role === 'dono', me = SP.session.userId;
    var all = store.vendedores().map(function (v) { return stats(v, mes); }).sort(function (a, b) { return b.fat - a.fat; });
    var h = ui.pageHeader('Metas e ranking', 'Mês de ' + ymLabel(mes) + ' - acompanhe sua evolução e conquiste prêmios.', isDono ? '<button class="btn btn-ghost" id="mt-edit">' + ui.icon('edit', 16) + ' Editar metas</button>' : '');
    if (!all.length) { el.innerHTML = h + ui.empty({ icon: 'target', title: 'Sem vendedores' }); return; }
    if (!isDono) {
      var ix = all.map(function (s) { return s.v.id; }).indexOf(me), s = all[ix];
      if (s) h += '<div class="card mt-hero"><div class="row"><div class="mt-pos">' + (ix + 1) + 'º</div><div class="grow"><b>Você está em ' + (ix + 1) + 'º lugar de ' + all.length + '</b><div class="muted text-sm">' +
        (ix === 0 ? 'Você lidera o ranking. Continue assim!' : 'Faltam ' + M(all[ix - 1].fat - s.fat) + ' para ultrapassar ' + esc(all[ix - 1].v.nome.split(' ')[0]) + '.') + '</div></div></div></div>';
    }
    h += '<div class="card mb"><div class="card-title">Ranking do mês</div>' + podium(all) + '</div>';
    h += '<div class="grid grid-2 mb"><div class="card"><div class="card-title">' + (isDono ? 'Metas individuais' : 'Minhas metas') + '</div>' + goals(isDono ? all : all.filter(function (s) { return s.v.id === me; })) + '</div>' +
      '<div class="card"><div class="card-title">Evolução mensal (faturamento)</div>' + evolution(isDono ? null : me) + '</div></div>';
    h += '<div class="grid grid-2 mb"><div class="card"><div class="card-title">Conquistas</div>' + badges(isDono ? all : all.filter(function (s) { return s.v.id === me; })) + '</div>' + prize(all) + '</div>';
    if (isDono) h += ia(all);
    el.innerHTML = h; bind(el, all, mes);
  }

  function podium(all) {
    var top = all.slice(0, 3), order = [1, 0, 2], cls = ['gold', 'silver', 'bronze'], med = ['1º', '2º', '3º'];
    var pod = '<div class="mt-podium">' + order.filter(function (i) { return top[i]; }).map(function (i) {
      var s = top[i];
      return '<div class="mt-pod mt-' + cls[i] + '"><div class="mt-crown">' + (i === 0 ? ui.icon('star', 22) : '') + '</div>' + ui.userAvatar(s.v.id, i === 0 ? 56 : 44) + '<b>' + esc(s.v.nome.split(' ')[0]) + '</b><div class="text-sm">' + M(s.fat) + '</div><div class="mt-step">' + med[i] + '</div></div>';
    }).join('') + '</div>';
    return pod + '<div class="table-wrap mt"><table class="table"><thead><tr><th>#</th><th>Vendedor</th><th>Contratos</th><th>Faturamento</th><th>Conversão</th></tr></thead><tbody>' + all.map(function (s, i) {
      return '<tr' + (s.v.id === SP.session.userId ? ' class="mt-me"' : '') + '><td>' + (i + 1) + '</td><td><span class="row">' + ui.userAvatar(s.v.id, 24) + ' ' + esc(s.v.nome) + '</span></td><td>' + s.n + '</td><td>' + M(s.fat) + '</td><td>' + ui.fmtPct(s.conv) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  function goals(list) {
    function row(lbl, val, meta, fmt) {
      var p = meta ? val / meta * 100 : 0;
      return '<div class="mt-goal"><div class="row text-sm"><span>' + lbl + '</span><span class="grow"></span><b>' + fmt(val) + '</b><span class="muted">&nbsp;/ ' + fmt(meta) + '</span></div>' + ui.progress(p, p >= 100 ? '#16A34A' : null) + '</div>';
    }
    return list.map(function (s) {
      return '<div class="mt-person"><div class="row mb">' + ui.userAvatar(s.v.id, 26) + '<b>' + esc(s.v.nome) + '</b></div>' +
        row('Vendas', s.fat, s.meta.metaVendas, M) + row('Leads novos', s.novos, s.meta.metaLeads, String) + row('Conversão', s.conv, s.meta.metaConversao, ui.fmtPct) + '</div>';
    }).join('');
  }

  function evolution(userId) {
    var ks = [-2, -1, 0].map(offYm), cs = store.collection('contratos').filter(function (c) { return c.status === 'assinado' && c.assinadoEm && (!userId || c.vendedorId === userId); });
    var vals = ks.map(function (k) { return { k: k, v: cs.filter(function (c) { return ym(c.assinadoEm) === k; }).reduce(function (s, c) { return s + c.valor; }, 0) }; });
    var max = Math.max.apply(null, vals.map(function (x) { return x.v; }).concat([1]));
    return '<div class="mt-evo">' + vals.map(function (x) {
      return '<div class="mt-evo-col"><div class="text-sm"><b>' + ui.fmtMoney(x.v, { compact: true }) + '</b></div><div class="mt-evo-bar" style="height:' + Math.max(4, x.v / max * 130) + 'px"></div><div class="text-sm muted">' + ymLabel(x.k) + '</div></div>';
    }).join('') + '</div>';
  }

  function badges(list) {
    return list.map(function (s) {
      return (list.length > 1 ? '<div class="row mb"><b>' + esc(s.v.nome.split(' ')[0]) + '</b></div>' : '') + '<div class="mt-badges">' + badgesFor(s).map(function (b) {
        return '<div class="mt-badge' + (b.ok ? ' on' : '') + '" title="' + esc(b.d) + '">' + ui.icon(b.ic, 20) + '<span>' + esc(b.n) + '</span></div>';
      }).join('') + '</div>';
    }).join('');
  }

  function prize(all) {
    var w = all[0];
    return '<div class="card mt-prize"><div class="card-title">Premiação do mês</div><div class="row">' + ui.userAvatar(w.v.id, 48) + '<div><div class="muted text-sm">Líder atual</div><b>' + esc(w.v.nome) + '</b></div></div>' +
      '<ul class="mt-prizes">' + PREMIOS.map(function (p, i) { return '<li><b>' + (i + 1) + 'º</b> ' + esc(p) + (all[i] ? ' <span class="muted">- ' + esc(all[i].v.nome.split(' ')[0]) + '</span>' : '') + '</li>'; }).join('') + '</ul></div>';
  }

  function ia(all) {
    var items = [], low = all.slice().sort(function (a, b) { return a.conv - b.conv; })[0];
    if (low) items.push({ ic: 'alert', t: esc(low.v.nome) + ' tem a menor conversão (' + ui.fmtPct(low.conv) + ').', s: 'Sugestão: acompanhar 3 ligações e revisar a abordagem de proposta.', a: 'Agendar coaching', k: 'coach', arg: low.v.id });
    var stale = store.collection('leads').filter(function (l) { return SP.consts.EM_NEGOCIACAO.indexOf(l.etapa) >= 0 && ui.daysSince(l.ultimoContato) > 7; });
    items.push({ ic: 'clock', t: stale.length + ' oportunidades paradas há mais de 7 dias.', s: 'Valor em risco: ' + M(stale.reduce(function (s, l) { return s + (l.valorEstimado || 0); }, 0)) + '.', a: 'Criar tarefas de follow-up', k: 'stale' });
    var slow = all.filter(function (s) { return s.resp != null; }).sort(function (a, b) { return b.resp - a.resp; })[0];
    if (slow) items.push({ ic: 'bolt', t: esc(slow.v.nome) + ' leva em média ' + ui.fmtDuration(slow.resp) + ' para responder.', s: 'Leads respondidos em até 5 min convertem muito mais.', a: 'Enviar lembrete', k: 'remind', arg: slow.v.id });
    var best = all[0];
    items.push({ ic: 'star', t: esc(best.v.nome) + ' lidera o mês com ' + M(best.fat) + '.', s: 'Reconheça publicamente para manter o time motivado.', a: 'Parabenizar equipe', k: 'cheer', arg: best.v.id });
    return '<div class="card mt-ia"><div class="card-title">' + ui.icon('bolt', 18) + ' IA gerente comercial</div><div class="stack">' + items.map(function (i) {
      return '<div class="mt-insight">' + ui.icon(i.ic, 20) + '<div class="grow"><b>' + i.t + '</b><div class="text-sm muted">' + i.s + '</div></div><button class="btn btn-sm btn-primary" data-ia="' + i.k + '" data-arg="' + (i.arg || '') + '">' + i.a + '</button></div>';
    }).join('') + '</div></div>';
  }

  function editModal(mes) {
    var vs = store.vendedores(), body = document.createElement('div');
    body.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Vendedor</th><th>Vendas (R$)</th><th>Leads</th><th>Conversão (%)</th></tr></thead><tbody>' + vs.map(function (v) {
      var m = store.where('metas', function (x) { return x.vendedorId === v.id && x.mes === mes; })[0] || { metaVendas: 100000, metaLeads: 25, metaConversao: 20 };
      return '<tr data-v="' + v.id + '"><td>' + esc(v.nome) + '</td><td><input class="input" type="number" data-f="metaVendas" value="' + m.metaVendas + '" style="width:110px"></td><td><input class="input" type="number" data-f="metaLeads" value="' + m.metaLeads + '" style="width:70px"></td><td><input class="input" type="number" data-f="metaConversao" value="' + m.metaConversao + '" style="width:70px"></td></tr>';
    }).join('') + '</tbody></table></div>';
    ui.modal({
      title: 'Editar metas de ' + ymLabel(mes), size: 'lg', body: body, actions: [{ label: 'Cancelar', cls: 'btn-ghost' }, {
        label: 'Salvar', cls: 'btn-primary', onClick: function () {
          body.querySelectorAll('tr[data-v]').forEach(function (tr) {
            var id = tr.dataset.v, cur = store.where('metas', function (x) { return x.vendedorId === id && x.mes === mes; })[0] || { vendedorId: id, mes: mes };
            tr.querySelectorAll('input').forEach(function (i) { cur[i.dataset.f] = Number(i.value) || 0; });
            store.upsert('metas', cur);
          });
          store.log('editou metas', 'metas', mes, 'Metas do mês ' + mes); ui.toast('Metas atualizadas', 'success'); SP.refresh();
        }
      }]
    });
  }

  function bind(el, all, mes) {
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.id === 'mt-edit') return editModal(mes);
      var k = b.dataset.ia; if (!k) return;
      var u = b.dataset.arg ? store.user(b.dataset.arg) : null, nome = u ? u.nome.split(' ')[0] : '';
      if (k === 'stale') {
        var stale = store.collection('leads').filter(function (l) { return SP.consts.EM_NEGOCIACAO.indexOf(l.etapa) >= 0 && ui.daysSince(l.ultimoContato) > 7; }).slice(0, 10);
        stale.forEach(function (l) { store.upsert('tarefas', { leadId: l.id, tipo: 'followup', titulo: 'Follow-up com ' + l.nome.split(' ')[0] + ' (sugerido pela IA)', responsavelId: l.vendedorId, vencimento: new Date(Date.now() + 86400000).toISOString(), concluida: false }); });
        store.log('IA criou tarefas', 'metas', 'ia', stale.length + ' follow-ups'); ui.toast(stale.length + ' tarefas de follow-up criadas', 'success');
      } else {
        var msg = { coach: 'Coaching agendado com ' + nome, remind: 'Lembrete de tempo de resposta enviado a ' + nome, cheer: 'Parabéns enviados ao time por ' + nome };
        store.log('IA gerente: ' + k, 'metas', b.dataset.arg, msg[k]); ui.toast(msg[k], 'success');
      }
      b.disabled = true; b.textContent = 'Feito';
    });
  }

  SP.register({
    route: 'metas', title: 'Metas', icon: 'target', group: 'Gestão', order: 31, roles: ['dono', 'vendedor'],
    render: function (el) { render(el); }
  });
})();
