/* Módulo: Funil (#/funil) - kanban das etapas. Config em db.config.etapas = [{id,nome,oculta}] (ordem = ordem das colunas). */
(function () {
  'use strict';
  var ui = SP.ui, esc = ui.esc, S = SP.store;
  var filt = { vendedor: '', origem: '' }, perdidosAberto = false;

  var PALETA = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#84CC16'];
  function okCor(c) { return /^#[0-9a-f]{6}$/i.test(c || ''); }
  function corBase(id) { var e = null; try { e = SP.consts.etapa(id); } catch (x) { /* ignora */ } return (e && e.cor) || '#64748B'; }
  function getCfg() {
    var db = S.get(), saved = (db.config && db.config.etapas) || [], out = [], seen = {};
    var base = SP.consts.ETAPAS;
    saved.forEach(function (c) {
      if (!c || !c.id || seen[c.id] || c.id === 'perdido') return;
      var e = base.filter(function (x) { return x.id === c.id; })[0];
      if (!e && !c.custom) return;
      seen[c.id] = 1; out.push({ id: c.id, nome: c.nome || (e && e.nome) || 'Etapa', oculta: !!c.oculta, cor: okCor(c.cor) ? c.cor : (e ? e.cor : '#64748B'), custom: !e });
    });
    if (!saved.length) base.forEach(function (e) { if (!seen[e.id] && e.id !== 'perdido') out.push({ id: e.id, nome: e.nome, oculta: false, cor: e.cor, custom: false }); });
    else base.forEach(function (e) { if (!seen[e.id] && e.id !== 'perdido' && !(db.config.etapasRemovidas || []).some(function (r) { return r === e.id; })) out.push({ id: e.id, nome: e.nome, oculta: false, cor: e.cor, custom: false }); });
    return out;
  }
  function saveCfg(list) {
    var db = S.get(); db.config = db.config || {};
    db.config.etapas = list.map(function (c) { var o = { id: c.id, nome: c.nome, oculta: !!c.oculta, cor: okCor(c.cor) ? c.cor : corBase(c.id) }; if (c.custom) o.custom = true; return o; });
    db.config.etapasRemovidas = SP.consts.ETAPAS.filter(function (e) { return e.id !== 'perdido' && !list.some(function (c) { return c.id === e.id; }); }).map(function (e) { return e.id; });
    S.save(); S.log('config', 'funil', 'etapas', 'Etapas do funil personalizadas');
  }
  function corEtapa(id) { var c = getCfg().filter(function (x) { return x.id === id; })[0]; return c ? c.cor : corBase(id); }
  function nomeEtapa(id) { var c = getCfg().filter(function (x) { return x.id === id; })[0]; return c ? c.nome : (id === 'perdido' ? SP.consts.etapa(id).nome : (function () { try { return SP.consts.etapa(id).nome; } catch (x) { return id; } })()); }
  function novoId() { return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36); }
  function leadsDaEtapa(id) { return S.collection('leads').filter(function (l) { return l.etapa === id; }); }
  /* pergunta para onde mover os leads de uma etapa a excluir; cb(destino|'' ) so se confirmado */
  function askDelete(list, id, cb) {
    var c = list.filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var n = leadsDaEtapa(id).length, outras = list.filter(function (x) { return x.id !== id; });
    if (n && !outras.length) { ui.toast('Mantenha ao menos uma etapa para receber os leads.', 'error'); return; }
    var body = '<p>Excluir a etapa <b>' + esc(c.nome) + '</b>?</p>' + (n ? '<label class="full"><span class="text-sm muted">Esta etapa tem ' + n + ' lead(s). Mover para:</span><select id="fn-dest">' + outras.map(function (x) { return '<option value="' + x.id + '">' + esc(x.nome) + '</option>'; }).join('') + '<option value="perdido">Perdido</option></select></label>' : '<p class="muted text-sm">Nenhum lead nesta etapa.</p>');
    ui.modal({ title: 'Excluir etapa', size: 'sm', body: body, actions: [{ label: 'Cancelar' }, { label: 'Excluir', cls: 'btn-danger', keepOpen: true, onClick: function (ctx) {
      var sel = ctx.el.querySelector('#fn-dest'), dest = sel ? sel.value : '';
      if (dest === 'perdido') { ui.toast('Para mover a Perdido use o motivo no cartão; escolha outra etapa.', 'error'); return; }
      ctx.close(); cb(dest);
    } }] });
  }
  function moverTodos(id, dest) {
    if (!dest) return;
    leadsDaEtapa(id).forEach(function (l) { var old = l.etapa; l.etapa = dest; addInteracao(l, 'Etapa removida do funil: ' + old + ' -> ' + nomeEtapa(dest)); });
  }
  function addInteracao(l, texto) { l.interacoes = l.interacoes || []; l.interacoes.unshift({ em: new Date().toISOString(), tipo: 'sistema', texto: texto, porId: SP.session.userId }); }
  function scoreColor(s) { return s >= 70 ? '#22C55E' : s >= 40 ? '#F59E0B' : '#94A3B8'; }

  function moveLead(l, novo, motivo) {
    var old = l.etapa; if (old === novo) return;
    l.etapa = novo;
    if (novo === 'perdido') { l.motivoPerda = motivo || ''; } else if (old === 'perdido') { l.motivoPerda = ''; }
    addInteracao(l, 'Etapa alterada no funil: ' + nomeEtapa(old) + ' -> ' + nomeEtapa(novo) + (motivo ? ' (motivo: ' + motivo + ')' : ''));
    S.save(); S.log(novo === 'perdido' ? 'perdido' : 'etapa', 'lead', l.id, old + ' -> ' + novo + (motivo ? ' | ' + motivo : ''));
    ui.toast(l.nome + ' movido para ' + nomeEtapa(novo) + '.', 'success'); SP.refresh();
  }
  function requestMove(l, novo) {
    if (novo === 'perdido') {
      ui.modal({ title: 'Marcar "' + l.nome + '" como perdido', size: 'sm',
        body: '<div class="form"><label class="full"><span class="text-sm muted">Motivo da perda *</span><select id="fn-mot"><option value="">Selecione...</option>' + SP.consts.MOTIVOS_PERDA.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select></label></div>',
        actions: [{ label: 'Cancelar' }, { label: 'Marcar perdido', cls: 'btn-danger', keepOpen: true, onClick: function (ctx) {
          var m = ctx.el.querySelector('#fn-mot').value; if (!m) { ui.toast('Selecione o motivo.', 'error'); return; }
          ctx.close(); moveLead(l, 'perdido', m);
        } }] });
    } else moveLead(l, novo);
  }

  function cardHtml(l) {
    var ref = l.ultimoContato || l.criadoEm, idle = ref ? Math.max(0, Math.floor(ui.daysSince(ref))) : -1, u = S.user(l.vendedorId);
    return '<div class="fn-card" draggable="true" data-id="' + l.id + '">' +
      '<div class="fn-card-top"><b class="fn-name">' + esc(l.nome) + '</b><span class="fn-score" style="background:' + scoreColor(l.score || 0) + '" title="Score ' + (l.score || 0) + '">' + (l.score || 0) + '</span></div>' +
      '<div class="muted text-sm">' + esc(l.cidade || '') + ' · ' + ui.fmtNum(l.consumoKwh || 0) + ' kWh</div>' +
      '<div class="fn-card-mid"><b>' + ui.fmtMoney(l.valorEstimado || 0, { compact: true }) + '</b>' + (u ? ui.userAvatar(u.id, 22) : '<span class="muted text-sm">Sem vendedor</span>') + '</div>' +
      '<div class="fn-card-foot"><span class="fn-idle' + (idle > 3 ? ' fn-idle-red' : '') + '">' + ui.icon('clock', 13) + ' ' + (idle < 0 ? 'novo' : idle === 0 ? 'hoje' : idle + ' d parado') + '</span>' +
      '<button class="btn btn-ghost btn-sm fn-move" data-move="' + l.id + '" title="Mover para outra etapa">Mover &#9662;</button></div></div>';
  }

  function render(el) {
    var cfg = getCfg(), leads = S.visibleLeads().filter(function (l) { return (!filt.vendedor || l.vendedorId === filt.vendedor) && (!filt.origem || l.origem === filt.origem); });
    var dono = SP.session.role === 'dono';
    var cols = cfg.filter(function (c) { return !c.oculta; }).map(function (c) { return { id: c.id, nome: c.nome, cor: c.cor }; });
    var hidden = cfg.filter(function (c) { return c.oculta; }).map(function (c) { return c.id; });
    var perdCol = { id: 'perdido', nome: nomeEtapa('perdido'), cor: corBase('perdido') };
    var byCol = function (id) { return leads.filter(function (l) { return l.etapa === id; }); };
    var hiddenCount = leads.filter(function (l) { return hidden.indexOf(l.etapa) >= 0; }).length;
    var total = leads.filter(function (l) { return l.etapa !== 'perdido'; }).reduce(function (s, l) { return s + (l.valorEstimado || 0); }, 0);

    function colHtml(c, collapsible) {
      var its = byCol(c.id), sum = its.reduce(function (s, l) { return s + (l.valorEstimado || 0); }, 0);
      var collapsed = collapsible && !perdidosAberto;
      return '<div class="fn-col' + (collapsed ? ' fn-col-collapsed' : '') + '" data-col="' + c.id + '">' +
        '<div class="fn-col-head"' + (collapsible ? ' data-toggle="1" style="cursor:pointer"' : '') + '><span class="dot" style="background:' + c.cor + '"></span><b class="grow fn-col-name">' + esc(c.nome) + '</b><span class="chip">' + its.length + '</span>' + (dono && !collapsible ? '<button class="btn btn-ghost btn-icon fn-kebab" data-kebab="' + c.id + '" aria-label="Opções da etapa" title="Opções da etapa">&#8942;</button>' : '') + (collapsible ? '<span class="fn-chev">' + (collapsed ? '&#9656;' : '&#9662;') + '</span>' : '') + '</div>' +
        '<div class="fn-col-sum muted text-sm">' + ui.fmtMoney(sum, { compact: true }) + '</div>' +
        (collapsed ? '' : '<div class="fn-col-body">' + (its.length ? its.map(cardHtml).join('') : '<div class="fn-empty">Arraste leads para cá</div>') + '</div>') + '</div>';
    }
    el.innerHTML = '<div class="funil">' + ui.pageHeader('Funil de vendas', leads.length + ' leads · ' + ui.fmtMoney(total, { compact: true }) + ' em oportunidades abertas',
      (dono ? '<button class="btn" id="fn-cfg">Personalizar etapas</button>' : '')) +
      '<div class="card fn-filters"><select id="fn-v"' + (dono ? '' : ' disabled') + '><option value="">' + (dono ? 'Todos os vendedores' : 'Meus leads') + '</option>' +
      (dono ? S.vendedores().map(function (u) { return '<option value="' + u.id + '"' + (filt.vendedor === u.id ? ' selected' : '') + '>' + esc(u.nome) + '</option>'; }).join('') : '') + '</select>' +
      '<select id="fn-o"><option value="">Todas as origens</option>' + SP.consts.ORIGENS.map(function (o) { return '<option' + (filt.origem === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>' +
      '<span class="muted text-sm fn-tip">Arraste os cartões entre as colunas ou use o botão "Mover".</span></div>' +
      (hiddenCount ? '<div class="fn-warn">' + hiddenCount + ' lead(s) estão em etapas ocultas. Use "Personalizar etapas" para exibi-las.</div>' : '') +
      '<div class="fn-topscroll" id="fn-top"><div id="fn-top-in"></div></div>' +
      '<div class="fn-boardwrap"><button class="fn-arrow fn-arrow-l" id="fn-al" aria-label="Rolar para a esquerda">&#8249;</button><button class="fn-arrow fn-arrow-r" id="fn-ar" aria-label="Rolar para a direita">&#8250;</button>' +
      '<div class="fn-board" id="fn-board">' + cols.map(function (c) { return colHtml(c); }).join('') + colHtml(perdCol, true) +
      (dono ? '<div class="fn-col fn-col-add" data-add="1"><div class="fn-col-head"><b>+ Nova etapa</b></div><div class="fn-add-form"><input id="fn-new-name" placeholder="Nome da etapa" maxlength="40"><div class="fn-add-row"><input type="color" id="fn-new-cor" value="' + PALETA[cols.length % PALETA.length] + '" aria-label="Cor"><button class="btn btn-primary btn-sm" id="fn-new-ok">Adicionar</button></div></div></div>' : '') +
      '</div></div></div>';

    var v = el.querySelector('#fn-v'), o = el.querySelector('#fn-o');
    v.addEventListener('change', function () { filt.vendedor = v.value; render(el); });
    o.addEventListener('change', function () { filt.origem = o.value; render(el); });
    var cfgBtn = el.querySelector('#fn-cfg'); if (cfgBtn) cfgBtn.addEventListener('click', function () { openConfig(); });
    var tg = el.querySelector('[data-toggle]'); if (tg) tg.addEventListener('click', function () { perdidosAberto = !perdidosAberto; render(el); });

    var board = el.querySelector('#fn-board'), top = el.querySelector('#fn-top'), topIn = el.querySelector('#fn-top-in'), al = el.querySelector('#fn-al'), ar = el.querySelector('#fn-ar');
    setupBoard(el, board, top, topIn, al, ar);
    var addOk = el.querySelector('#fn-new-ok');
    if (addOk) {
      var addNome = el.querySelector('#fn-new-name'), addCor = el.querySelector('#fn-new-cor');
      var doAdd = function () {
        var nome = addNome.value.trim(); if (!nome) { ui.toast('Informe o nome da etapa.', 'error'); addNome.focus(); return; }
        var list = getCfg(); list.push({ id: novoId(), nome: nome, oculta: false, cor: addCor.value, custom: true });
        saveCfg(list); ui.toast('Etapa "' + nome + '" criada.', 'success'); SP.refresh();
      };
      addOk.addEventListener('click', doAdd);
      addNome.addEventListener('keydown', function (e) { if (e.key === 'Enter') doAdd(); });
    }
    el.querySelectorAll('[data-kebab]').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); editStage(b.getAttribute('data-kebab')); }); });

    var drag = null;
    el.querySelectorAll('.fn-card').forEach(function (cd) {
      cd.addEventListener('dragstart', function (e) { drag = cd.getAttribute('data-id'); cd.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', drag); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ignora */ } });
      cd.addEventListener('dragend', function () { cd.classList.remove('dragging'); });
      cd.addEventListener('click', function (e) { if (e.target.closest('[data-move]')) return; SP.go('leads/' + cd.getAttribute('data-id')); });
    });
    el.querySelectorAll('.fn-col[data-col]').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', function () { col.classList.remove('over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('over');
        var l = drag && S.lead(drag); drag = null; if (l) requestMove(l, col.getAttribute('data-col'));
      });
    });
    el.querySelectorAll('[data-move]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation(); var l = S.lead(b.getAttribute('data-move')); if (!l) return;
        var list = cols.concat([perdCol]);
        ui.modal({ title: 'Mover "' + l.nome + '"', size: 'sm', body: '<div class="fn-menu">' + list.map(function (c) {
          return '<button class="btn fn-menu-item' + (c.id === l.etapa ? ' btn-primary' : ' btn-ghost') + '" data-to="' + c.id + '"><span class="dot" style="background:' + c.cor + '"></span> ' + esc(c.nome) + (c.id === l.etapa ? ' (atual)' : '') + '</button>';
        }).join('') + '</div>' });
        document.querySelectorAll('.fn-menu-item').forEach(function (mb) {
          mb.addEventListener('click', function () {
            var to = mb.getAttribute('data-to'), bd = document.querySelector('.modal-backdrop:last-of-type, .modal-backdrop');
            var close = mb.closest('.modal-backdrop'); if (close) close.querySelector('[data-close]').click();
            if (to !== l.etapa) requestMove(l, to);
          });
        });
      });
    });
  }

  function setupBoard(el, board, top, topIn, al, ar) {
    var speed = 0, raf = 0, EDGE = 80, MAXV = 18, panning = false;
    function alive() { return document.body.contains(board); }
    function upd() {
      topIn.style.width = board.scrollWidth + 'px';
      top.style.display = board.scrollWidth > board.clientWidth + 2 ? '' : 'none';
      al.classList.toggle('fn-arrow-off', board.scrollLeft <= 2);
      ar.classList.toggle('fn-arrow-off', board.scrollLeft >= board.scrollWidth - board.clientWidth - 2);
    }
    function loop() { raf = 0; if (!speed || !alive()) return; board.scrollLeft += speed; raf = requestAnimationFrame(loop); }
    function edge(x) {
      var r = board.getBoundingClientRect(), v = 0;
      if (x - r.left < EDGE) v = -MAXV * Math.min(1, (EDGE - (x - r.left)) / EDGE);
      else if (r.right - x < EDGE) v = MAXV * Math.min(1, (EDGE - (r.right - x)) / EDGE);
      speed = v; if (v && !raf) raf = requestAnimationFrame(loop);
    }
    function stop() { speed = 0; }
    var wrap = board.parentNode;
    wrap.addEventListener('mousemove', function (e) { if (!panning) edge(e.clientX); });
    wrap.addEventListener('mouseleave', stop);
    board.addEventListener('dragover', function (e) { edge(e.clientX); });
    board.addEventListener('dragleave', function (e) { if (!board.contains(e.relatedTarget)) stop(); });
    board.addEventListener('drop', stop);
    document.addEventListener('dragend', stop);
    board.addEventListener('scroll', function () { if (top.scrollLeft !== board.scrollLeft) top.scrollLeft = board.scrollLeft; upd(); });
    top.addEventListener('scroll', function () { if (board.scrollLeft !== top.scrollLeft) board.scrollLeft = top.scrollLeft; });
    al.addEventListener('click', function () { board.scrollBy({ left: -320, behavior: 'smooth' }); });
    ar.addEventListener('click', function () { board.scrollBy({ left: 320, behavior: 'smooth' }); });
    board.addEventListener('wheel', function (e) {
      if (e.shiftKey || (e.target.closest && e.target.closest('.fn-col-head') && Math.abs(e.deltaY) >= Math.abs(e.deltaX))) { e.preventDefault(); board.scrollLeft += e.deltaY || e.deltaX; }
    }, { passive: false });
    board.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || e.target.closest('.fn-card, button, input, select, .fn-col-head, .fn-add-form')) return;
      var x0 = e.clientX, s0 = board.scrollLeft; panning = true; stop(); board.classList.add('fn-panning'); e.preventDefault();
      function mv(ev) { board.scrollLeft = s0 - (ev.clientX - x0); }
      function up() { panning = false; board.classList.remove('fn-panning'); window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); }
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    });
    window.addEventListener('resize', function rs() { if (!alive()) { window.removeEventListener('resize', rs); return; } upd(); });
    requestAnimationFrame(upd); setTimeout(upd, 200);
  }

  function editStage(id) {
    var list = getCfg(), c = list.filter(function (x) { return x.id === id; })[0]; if (!c) return;
    ui.modal({ title: 'Etapa "' + c.nome + '"', size: 'sm', body: '<div class="form"><label class="full"><span class="text-sm muted">Nome</span><input id="fe-nome" maxlength="40" value="' + esc(c.nome) + '"></label><label class="full"><span class="text-sm muted">Cor</span><input type="color" id="fe-cor" value="' + c.cor + '"></label></div>',
      actions: [{ label: 'Excluir etapa', cls: 'btn-danger', keepOpen: true, onClick: function (ctx) {
        ctx.close(); askDelete(list, id, function (dest) { moverTodos(id, dest); saveCfg(list.filter(function (x) { return x.id !== id; })); ui.toast('Etapa excluída.', 'success'); SP.refresh(); });
      } }, { label: 'Cancelar' }, { label: 'Salvar', cls: 'btn-primary', keepOpen: true, onClick: function (ctx) {
        var n = ctx.el.querySelector('#fe-nome').value.trim(); if (!n) { ui.toast('Informe o nome.', 'error'); return; }
        c.nome = n; c.cor = ctx.el.querySelector('#fe-cor').value; saveCfg(list); ctx.close(); ui.toast('Etapa atualizada.', 'success'); SP.refresh();
      } }] });
  }

  function openConfig() {
    var list = getCfg(), moves = {}, dragI = null;
    var m = ui.modal({ title: 'Personalizar etapas', size: 'lg', body: '<div id="fc-body"></div>', actions: [
      { label: 'Restaurar padrão', cls: 'btn-ghost', keepOpen: true, onClick: function () {
        sync(); var cust = list.filter(function (c) { return c.custom; });
        list = SP.consts.ETAPAS.filter(function (e) { return e.id !== 'perdido'; }).map(function (e) { return { id: e.id, nome: e.nome, oculta: false, cor: e.cor, custom: false }; }).concat(cust); draw(); } },
      { label: 'Cancelar' },
      { label: 'Salvar', cls: 'btn-primary', onClick: function () {
        sync(); list.forEach(function (c) { c.nome = c.nome.trim() || 'Etapa'; });
        Object.keys(moves).forEach(function (id) { moverTodos(id, moves[id]); });
        saveCfg(list); ui.toast('Etapas atualizadas.', 'success'); SP.refresh();
      } }] });
    function sync() {
      m.el.querySelectorAll('[data-name]').forEach(function (inp) { var c = list.filter(function (x) { return x.id === inp.getAttribute('data-name'); })[0]; if (c) c.nome = inp.value; });
      m.el.querySelectorAll('[data-cor]').forEach(function (inp) { var c = list.filter(function (x) { return x.id === inp.getAttribute('data-cor'); })[0]; if (c) c.cor = inp.value; });
    }
    function mv(from, to) { if (to < 0 || to >= list.length || from === to) return; sync(); list.splice(to, 0, list.splice(from, 1)[0]); draw(); }
    function draw() {
      var b = m.el.querySelector('#fc-body');
      b.innerHTML = '<p class="muted text-sm">Arraste pela alça (ou use as setas) para reordenar, renomeie, troque a cor, oculte ou exclua etapas. "Perdido" é fixa.</p><div class="fn-cfg-list">' + list.map(function (c, i) {
        return '<div class="fn-cfg-row" draggable="true" data-row="' + i + '"><span class="fn-grip" title="Arrastar" aria-hidden="true">&#8942;&#8942;</span><input type="color" data-cor="' + c.id + '" value="' + c.cor + '" aria-label="Cor"><input data-name="' + c.id + '" value="' + esc(c.nome) + '" maxlength="40">' +
          '<button class="btn btn-ghost btn-icon" data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir">&#9650;</button><button class="btn btn-ghost btn-icon" data-down="' + i + '"' + (i === list.length - 1 ? ' disabled' : '') + ' aria-label="Descer">&#9660;</button>' +
          '<label class="fn-cfg-vis"><input type="checkbox" data-vis="' + i + '"' + (c.oculta ? '' : ' checked') + '> Visível</label><button class="btn btn-ghost btn-icon" data-del="' + i + '" aria-label="Excluir etapa" title="Excluir">&#10005;</button></div>';
      }).join('') + '</div><button class="btn" id="fc-add" style="margin-top:10px">+ Adicionar etapa</button>';
      b.querySelectorAll('[data-up]').forEach(function (x) { x.addEventListener('click', function () { var i = +x.getAttribute('data-up'); mv(i, i - 1); }); });
      b.querySelectorAll('[data-down]').forEach(function (x) { x.addEventListener('click', function () { var i = +x.getAttribute('data-down'); mv(i, i + 1); }); });
      b.querySelectorAll('[data-vis]').forEach(function (x) { x.addEventListener('change', function () { sync(); list[+x.getAttribute('data-vis')].oculta = !x.checked; }); });
      b.querySelectorAll('[data-del]').forEach(function (x) { x.addEventListener('click', function () {
        sync(); var c = list[+x.getAttribute('data-del')];
        askDelete(list, c.id, function (dest) { if (dest) moves[c.id] = dest; else delete moves[c.id]; list = list.filter(function (y) { return y.id !== c.id; }); draw(); });
      }); });
      b.querySelector('#fc-add').addEventListener('click', function () { sync(); list.push({ id: novoId(), nome: 'Nova etapa', oculta: false, cor: PALETA[list.length % PALETA.length], custom: true }); draw(); var ins = b.querySelectorAll('[data-name]'), last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } });
      b.querySelectorAll('[data-row]').forEach(function (row) {
        row.addEventListener('dragstart', function (e) { if (e.target !== row) return; dragI = +row.getAttribute('data-row'); try { e.dataTransfer.setData('text/plain', 'r' + dragI); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ignora */ } });
        row.addEventListener('dragover', function (e) { if (dragI !== null) { e.preventDefault(); row.classList.add('over'); } });
        row.addEventListener('dragleave', function () { row.classList.remove('over'); });
        row.addEventListener('drop', function (e) { e.preventDefault(); var to = +row.getAttribute('data-row'), from = dragI; dragI = null; if (from !== null) mv(from, to); });
      });
    }
    draw();
  }

  SP.register({
    route: 'funil', title: 'Funil', icon: 'funnel', group: 'Vendas', order: 11, roles: ['dono', 'vendedor'],
    render: function (el) { render(el); }
  });
})();
