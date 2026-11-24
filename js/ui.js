/* SP.ui - helpers de interface (HTML em string; ícones SVG inline). */
(function () {
  'use strict';
  window.SP = window.SP || {};

  var ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8"/><path d="M18 14.3c2.2.7 3.5 2.6 3.5 5.7"/>',
    funnel: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
    chat: '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>',
    file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    contract: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 17c1.5-2 2.5-2 3 0s1.5 1 3-1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    tool: '<path d="M14.7 6.3a4 4 0 005 5L21 13l-8 8-9-9 8-8z" transform="scale(.85) translate(2 1)"/><path d="M4 20l5-5"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    wallet: '<path d="M3 7a2 2 0 012-2h13v4"/><path d="M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2z"/><circle cx="16.5" cy="14.5" r="1.2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    megaphone: '<path d="M3 11v3a1 1 0 001 1h3l7 4V6L7 10H4a1 1 0 00-1 1z"/><path d="M18 9a4 4 0 010 6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a2 2 0 003.4 0"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/>',
    phone: '<path d="M22 17v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0122 17z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trending: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    sunpower: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
    dollar: '<path d="M12 2v20"/><path d="M17 6.5C16 5 14.2 4.5 12 4.5c-2.8 0-4.5 1.3-4.5 3.2 0 4.5 9.5 2.3 9.5 7 0 2-1.9 3.3-5 3.3-2.3 0-4.2-.8-5-2.5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
    refresh: '<path d="M21 12a9 9 0 01-15.5 6.2L3 16M3 12A9 9 0 0118.5 5.8L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8"/>',
    whatsapp: '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/><path d="M9 9.5c.5 2.5 2.5 4.5 5 5l1.2-1.2-2-1-.8.8c-.8-.3-1.5-1-1.8-1.8l.8-.8-1-2z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    hardhat: '<path d="M3 18h18v2H3z"/><path d="M5 18a7 7 0 0114 0"/><path d="M12 6v5M9 8v3"/>'
  };

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  var ui = {
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    /** icon(name, size=20) -> string SVG inline (stroke currentColor). */
    icon: function (name, size) {
      var p = ICONS[name] || ICONS.box, s = size || 20;
      return '<svg class="icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
    },
    iconNames: function () { return Object.keys(ICONS); },
    fmtMoney: function (v, opts) {
      v = Number(v) || 0;
      if (opts && opts.compact) {
        var a = Math.abs(v);
        if (a >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + ' mi';
        if (a >= 1e4) return 'R$ ' + Math.round(v / 1e3) + ' mil';
        if (a >= 1e3) return 'R$ ' + (v / 1e3).toFixed(1).replace('.', ',') + ' mil';
      }
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: (opts && opts.cents) ? 2 : 0, maximumFractionDigits: (opts && opts.cents) ? 2 : 0 });
    },
    fmtNum: function (v) { return (Number(v) || 0).toLocaleString('pt-BR'); },
    fmtPct: function (v) { return (Math.round(v * 10) / 10).toString().replace('.', ',') + '%'; },
    fmtDate: function (iso) { if (!iso) return '-'; var d = new Date(iso); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); },
    fmtDateTime: function (iso) { if (!iso) return '-'; var d = new Date(iso); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    fmtDuration: function (min) { if (min == null) return '-'; min = Math.round(min); if (min < 60) return min + ' min'; if (min < 1440) return (Math.round(min / 6) / 10).toString().replace('.', ',') + ' h'; return Math.round(min / 144) / 10 + ' d'; },
    monthName: function (i) { return MESES[i]; },
    timeAgo: function (iso) {
      if (!iso) return 'nunca';
      var s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 0) { var f = -s; if (f < 3600) return 'em ' + Math.round(f / 60) + ' min'; if (f < 86400) return 'em ' + Math.round(f / 3600) + ' h'; return 'em ' + Math.round(f / 86400) + ' dias'; }
      if (s < 60) return 'agora';
      if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
      if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
      if (s < 86400 * 30) { var d = Math.floor(s / 86400); return 'há ' + d + (d === 1 ? ' dia' : ' dias'); }
      return ui.fmtDate(iso);
    },
    daysSince: function (iso) { return iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity; },

    toast: function (msg, type) {
      var box = document.getElementById('toasts');
      if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
      var t = document.createElement('div'); t.className = 'toast toast-' + (type || 'info'); t.textContent = msg;
      box.appendChild(t);
      setTimeout(function () { t.classList.add('out'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300); }, 3200);
    },

    /** modal({title, body: string|Node, actions:[{label, cls, onClick(ctx), keepOpen}], size:'sm'|'lg'}) -> {el, close} */
    modal: function (o) { return overlay(o, 'modal'); },
    /** drawer({...igual modal}) painel lateral direito. */
    drawer: function (o) { return overlay(o, 'drawer'); },

    badge: function (text, variant) { return '<span class="badge badge-' + (variant || 'gray') + '">' + ui.esc(text) + '</span>'; },
    badgeEtapa: function (id) { var e = SP.consts.etapa(id); return '<span class="badge" style="background:' + e.cor + '22;color:' + e.cor + '">' + ui.esc(e.nome) + '</span>'; },
    avatar: function (name, o) {
      o = o || {}; var parts = String(name || '?').trim().split(/\s+/), ini = (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
      var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
      var sz = o.size || 32;
      return '<span class="avatar" style="width:' + sz + 'px;height:' + sz + 'px;font-size:' + Math.round(sz * 0.38) + 'px;background:' + (o.color || 'hsl(' + h + ',55%,48%)') + '" title="' + ui.esc(name) + '">' + ui.esc(ini) + '</span>';
    },
    userAvatar: function (id, size) { var u = SP.store.user(id); return u ? ui.avatar(u.nome, { size: size, color: u.cor }) : ''; },
    empty: function (o) {
      o = o || {};
      return '<div class="empty">' + ui.icon(o.icon || 'box', 40) + '<h3>' + ui.esc(o.title || 'Nada por aqui') + '</h3>' + (o.text ? '<p>' + ui.esc(o.text) + '</p>' : '') + (o.actionHtml || '') + '</div>';
    },
    pageHeader: function (title, subtitle, actionsHtml) {
      return '<div class="page-head"><div><h1>' + ui.esc(title) + '</h1>' + (subtitle ? '<p class="muted">' + ui.esc(subtitle) + '</p>' : '') + '</div><div class="page-actions">' + (actionsHtml || '') + '</div></div>';
    },
    /** kpi({label, value, sub, icon, tone:'orange|green|red|blue', href}) */
    kpi: function (o) {
      var tag = o.href ? 'a href="' + o.href + '"' : 'div';
      return '<' + tag + ' class="kpi kpi-' + (o.tone || 'orange') + '"><div class="kpi-icon">' + ui.icon(o.icon || 'trending', 20) + '</div><div class="kpi-body"><div class="kpi-label">' + ui.esc(o.label) + '</div><div class="kpi-value">' + o.value + '</div>' + (o.sub ? '<div class="kpi-sub">' + o.sub + '</div>' : '') + '</div></' + (o.href ? 'a' : 'div') + '>';
    },
    progress: function (pct, color) {
      pct = Math.max(0, Math.min(100, pct || 0));
      return '<div class="progress"><span style="width:' + pct + '%;' + (color ? 'background:' + color : '') + '"></span></div>';
    },
    /** barChart(items:[{label,value,color,href,display}], {format}) -> barras horizontais em CSS */
    barChart: function (items, o) {
      o = o || {}; var max = o.max || Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
      if (!items.length) return ui.empty({ icon: 'trending', title: 'Sem dados no período' });
      return '<div class="bars">' + items.map(function (i) {
        var disp = i.display != null ? i.display : (o.format ? o.format(i.value) : ui.fmtNum(i.value));
        var tag = i.href ? 'a href="' + i.href + '"' : 'div';
        return '<' + tag + ' class="bar-row"><span class="bar-label">' + ui.esc(i.label) + '</span><span class="bar-track"><span class="bar-fill" style="width:' + Math.max(2, i.value / max * 100) + '%;background:' + (i.color || 'var(--primary)') + '"></span></span><span class="bar-val">' + disp + '</span></' + (i.href ? 'a' : 'div') + '>';
      }).join('') + '</div>';
    },
    /** donut(items:[{label,value,color}], {size, center}) */
    donut: function (items, o) {
      o = o || {}; var size = o.size || 150, r = 52, c = 2 * Math.PI * r, tot = items.reduce(function (s, i) { return s + i.value; }, 0);
      if (!tot) return ui.empty({ icon: 'target', title: 'Sem dados no período' });
      var pal = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EAB308', '#EC4899', '#64748B'], off = 0;
      var segs = items.map(function (it, k) {
        var len = it.value / tot * c, col = it.color || pal[k % pal.length];
        var s = '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="18" stroke-dasharray="' + len.toFixed(2) + ' ' + (c - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 70 70)"/>';
        off += len; return s;
      }).join('');
      var legend = items.map(function (it, k) { return '<li><i style="background:' + (it.color || pal[k % pal.length]) + '"></i><span>' + ui.esc(it.label) + '</span><b>' + it.value + '</b></li>'; }).join('');
      return '<div class="donut"><svg width="' + size + '" height="' + size + '" viewBox="0 0 140 140"><circle cx="70" cy="70" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="18"/>' + segs + '<text x="70" y="68" text-anchor="middle" class="donut-n">' + (o.center != null ? o.center : tot) + '</text><text x="70" y="86" text-anchor="middle" class="donut-t">' + (o.centerLabel || 'total') + '</text></svg><ul class="legend">' + legend + '</ul></div>';
    },
    /** tabs({id, items:[{id,label}], active}) -> html; escute cliques em [data-tab] */
    tabs: function (items, active) {
      return '<div class="tabs">' + items.map(function (t) { return '<button class="tab' + (t.id === active ? ' active' : '') + '" data-tab="' + t.id + '">' + ui.esc(t.label) + '</button>'; }).join('') + '</div>';
    },
    /** kanban(el, {columns:[{id,title,color}], items, getCol(item), card(item)->html, onMove(item, colId), onClick(item)}) */
    kanban: function (el, o) {
      el.innerHTML = '<div class="kanban">' + o.columns.map(function (c) {
        var its = o.items.filter(function (i) { return o.getCol(i) === c.id; });
        return '<div class="kanban-col" data-col="' + c.id + '"><div class="kanban-head"><span class="dot" style="background:' + (c.color || 'var(--primary)') + '"></span><b>' + ui.esc(c.title) + '</b><span class="chip">' + its.length + '</span></div><div class="kanban-body">' +
          its.map(function (i) { return '<div class="kanban-card" draggable="true" data-id="' + i.id + '">' + o.card(i) + '</div>'; }).join('') + '</div></div>';
      }).join('') + '</div>';
      var drag = null;
      el.querySelectorAll('.kanban-card').forEach(function (cd) {
        cd.addEventListener('dragstart', function (e) { drag = cd.getAttribute('data-id'); cd.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', drag); } catch (x) { /* ignora */ } });
        cd.addEventListener('dragend', function () { cd.classList.remove('dragging'); });
        cd.addEventListener('click', function () { var it = o.items.filter(function (i) { return i.id === cd.getAttribute('data-id'); })[0]; if (it && o.onClick) o.onClick(it); });
      });
      el.querySelectorAll('.kanban-col').forEach(function (col) {
        col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); });
        col.addEventListener('dragleave', function () { col.classList.remove('over'); });
        col.addEventListener('drop', function (e) {
          e.preventDefault(); col.classList.remove('over');
          var it = o.items.filter(function (i) { return i.id === drag; })[0];
          if (it && o.getCol(it) !== col.getAttribute('data-col') && o.onMove) o.onMove(it, col.getAttribute('data-col'));
        });
      });
    }
  };

  function overlay(o, kind) {
    var back = document.createElement('div'); back.className = kind + '-backdrop';
    var box = document.createElement('div'); box.className = kind + (o.size ? ' ' + kind + '-' + o.size : '');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<div class="' + kind + '-head"><h3>' + ui.esc(o.title || '') + '</h3><button class="btn btn-ghost btn-icon" data-close aria-label="Fechar">' + ui.icon('x') + '</button></div><div class="' + kind + '-body"></div>' + ((o.actions && o.actions.length) ? '<div class="' + kind + '-foot"></div>' : '');
    var body = box.querySelector('.' + kind + '-body');
    if (o.body instanceof Node) body.appendChild(o.body); else body.innerHTML = o.body || '';
    back.appendChild(box); document.body.appendChild(back);
    requestAnimationFrame(function () { back.classList.add('open'); });
    function close() {
      document.removeEventListener('keydown', onKey); back.classList.remove('open');
      setTimeout(function () { if (back.parentNode) back.parentNode.removeChild(back); }, 200);
      if (o.onClose) o.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    box.querySelector('[data-close]').addEventListener('click', close);
    var ctx = { el: box, body: body, close: close };
    var foot = box.querySelector('.' + kind + '-foot');
    (o.actions || []).forEach(function (a) {
      var b = document.createElement('button'); b.className = 'btn ' + (a.cls || 'btn-ghost'); b.textContent = a.label;
      b.addEventListener('click', function () { var r = a.onClick ? a.onClick(ctx) : null; if (!a.keepOpen && r !== false) close(); });
      foot.appendChild(b);
    });
    return ctx;
  }

  SP.ui = ui;
})();
