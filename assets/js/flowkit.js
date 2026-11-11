/* ============================================================
   FlowKit — tiny n8n-like interactive flow engine.
   Renders nodes + bezier "pipes", animates pipe filling and a
   glowing particle along the edge, tracks node states and logs.
   Node layout: [icon + title] row, description row below it —
   no text truncation. Horizontal mode auto-centers the diagram
   by remapping the config bounding box into a padded symmetric
   area; below VERTICAL_BREAKPOINT nodes stack in rows
   (mobileRows supports side-by-side branch nodes).
   Edge gradients use gradientUnits="userSpaceOnUse" per edge so
   they render on straight horizontal/vertical lines too
   (objectBoundingBox gradients vanish on degenerate bboxes).
   No dependencies.
   ============================================================ */
   (function () {
    'use strict';
  
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var VERTICAL_BREAKPOINT = 820; // px: below this width nodes stack vertically
  
    function ease(t) { return t * t * (3 - 2 * t); }
  
    function makeGradient(defs, id) {
      var lg = document.createElementNS(SVG_NS, 'linearGradient');
      lg.setAttribute('id', id);
      lg.setAttribute('gradientUnits', 'userSpaceOnUse');
      [['0%', '#38bdf8'], ['100%', '#8b5cf6']].forEach(function (s) {
        var stop = document.createElementNS(SVG_NS, 'stop');
        stop.setAttribute('offset', s[0]);
        stop.setAttribute('stop-color', s[1]);
        lg.appendChild(stop);
      });
      defs.appendChild(lg);
      return lg;
    }
  
    function mount(host, cfg) {
      host.classList.add('fk-canvas');
      host.innerHTML = '';
  
      // svg layer
      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'fk-svg');
      var defs = document.createElementNS(SVG_NS, 'defs');
      svg.appendChild(defs);
      var gEdges = document.createElementNS(SVG_NS, 'g');
      svg.appendChild(gEdges);
      host.appendChild(svg);
  
      // nodes: column layout => head row (icon + title + badge), then description
      var nodes = new Map();
      cfg.nodes.forEach(function (n) {
        var d = document.createElement('div');
        d.className = 'fk-node' + (n.dim ? ' is-dim' : '');
        d.dataset.id = n.id;
        d.innerHTML =
          '<div class="fk-head">' +
            '<div class="fk-ic">' + n.icon + '</div>' +
            '<div class="fk-title">' + n.title + '</div>' +
            '<div class="fk-badge"></div>' +
          '</div>' +
          (n.sub ? '<div class="fk-sub">' + n.sub + '</div>' : '');
        host.appendChild(d);
        nodes.set(n.id, { cfg: n, el: d });
      });
  
      // edges, each with its own userSpace gradient along the edge vector
      var edges = [];
      (cfg.edges || []).forEach(function (e, i) {
        var opt = e[2] || {};
        var gid = 'fk-grad-' + Math.random().toString(36).slice(2, 7) + '-' + i;
        var grad = makeGradient(defs, gid);
        var pipe = document.createElementNS(SVG_NS, 'path');
        pipe.setAttribute('class', 'fk-pipe' + (opt.dashed ? ' is-dashed' : ''));
        var fill = document.createElementNS(SVG_NS, 'path');
        fill.setAttribute('class', 'fk-fill');
        fill.setAttribute('stroke', 'url(#' + gid + ')');
        var dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('class', 'fk-dot');
        dot.setAttribute('r', '5');
        gEdges.appendChild(pipe);
        gEdges.appendChild(fill);
        gEdges.appendChild(dot);
        edges.push({ a: e[0], b: e[1], dashed: !!opt.dashed, pipe: pipe, fill: fill, dot: dot, grad: grad, len: 0, filled: false });
      });
  
      var logEl = cfg.log ? document.querySelector(cfg.log) : null;
      var t0 = performance.now();
  
      // coords in svg space = host padding box; compensate the 1px border
      // so pipe endpoints land exactly on port centers
      function centerOf(id) {
        var n = nodes.get(id);
        var hr = host.getBoundingClientRect();
        var nr = n.el.getBoundingClientRect();
        var ox = hr.left + host.clientLeft;
        var oy = hr.top + host.clientTop;
        return { x: nr.left - ox + nr.width / 2, y: nr.top - oy + nr.height / 2, w: nr.width, h: nr.height };
      }
  
      function anchors(A, B) {
        var dx = B.x - A.x, dy = B.y - A.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
          var s = dx >= 0 ? 1 : -1;
          return { x1: A.x + s * A.w / 2, y1: A.y, x2: B.x - s * B.w / 2, y2: B.y, horiz: true, s: s };
        }
        var sv = dy >= 0 ? 1 : -1;
        return { x1: A.x, y1: A.y + sv * A.h / 2, x2: B.x, y2: B.y - sv * B.h / 2, horiz: false, s: sv };
      }
  
      function rebuildEdges() {
        edges.forEach(function (e) {
          var A = centerOf(e.a), B = centerOf(e.b);
          var an = anchors(A, B);
          var off = an.horiz
            ? Math.max(30, Math.min(90, Math.abs(an.x2 - an.x1) * 0.45))
            : Math.max(26, Math.min(70, Math.abs(an.y2 - an.y1) * 0.45));
          var c1x = an.horiz ? an.x1 + off * an.s : an.x1;
          var c1y = an.horiz ? an.y1 : an.y1 + off * an.s;
          var c2x = an.horiz ? an.x2 - off * an.s : an.x2;
          var c2y = an.horiz ? an.y2 : an.y2 - off * an.s;
          var d = 'M ' + an.x1 + ' ' + an.y1 + ' C ' + c1x + ' ' + c1y + ', ' + c2x + ' ' + c2y + ', ' + an.x2 + ' ' + an.y2;
          e.pipe.setAttribute('d', d);
          e.fill.setAttribute('d', d);
          // gradient vector follows the edge => works in any orientation
          e.grad.setAttribute('x1', an.x1); e.grad.setAttribute('y1', an.y1);
          e.grad.setAttribute('x2', an.x2); e.grad.setAttribute('y2', an.y2);
          e.len = e.pipe.getTotalLength();
          e.fill.style.strokeDasharray = e.len;
          if (!e.filled) { e.fill.style.strokeDashoffset = e.len; }
        });
      }
  
      function layout() {
        var w = host.clientWidth;
        var vertical = w < VERTICAL_BREAKPOINT;
        host.classList.toggle('is-vertical', vertical);
  
        if (vertical) {
          // rows: mobileRows = [['a'],['b','c']] — multi-node rows sit side by side
          var rows = cfg.mobileRows ||
            (cfg.mobileOrder || cfg.nodes.map(function (n) { return n.id; }))
              .map(function (id) { return [id]; });
          var step = 100 / rows.length;
          rows.forEach(function (row, i) {
            row.forEach(function (id, j) {
              var n = nodes.get(id);
              var multi = row.length > 1;
              n.el.classList.toggle('fk-half', multi);
              var leftPct = multi
                ? (row.length === 2 ? (j === 0 ? 27 : 73) : (100 / (row.length + 1)) * (j + 1))
                : 50;
              n.el.style.left = leftPct + '%';
              n.el.style.top = (step * (i + 0.5)) + '%';
            });
          });
        } else {
          // auto-centering: remap config bounding box into a padded,
          // symmetric box so the diagram always sits in the middle
          var xs = cfg.nodes.map(function (n) { return n.x; });
          var ys = cfg.nodes.map(function (n) { return n.y; });
          var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
          var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
          var spanX = maxX - minX, spanY = maxY - minY;
          var padX = Math.min(18, Math.max(10, (130 / w) * 100));
          var innerW = 100 - padX * 2;
          cfg.nodes.forEach(function (n) {
            var nd = nodes.get(n.id);
            nd.el.classList.remove('fk-half');
            var nx = spanX ? padX + ((n.x - minX) / spanX) * innerW : 50;
            var ny = spanY ? 24 + ((n.y - minY) / spanY) * 52 : 50;
            nd.el.style.left = nx + '%';
            nd.el.style.top = ny + '%';
          });
        }
  
        svg.setAttribute('width', w);
        svg.setAttribute('height', host.clientHeight);
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + host.clientHeight);
        requestAnimationFrame(rebuildEdges);
        console.log('[flowkit] layout mode: ' + (vertical ? 'vertical' : 'horizontal') + ' @' + w + 'px');
      }
  
      // --- public api ---
      function setNode(id, st) {
        var n = nodes.get(id);
        if (!n) { return; }
        n.el.classList.remove('is-active', 'is-done', 'is-error', 'is-busy');
        var badge = n.el.querySelector('.fk-badge');
        badge.textContent = '';
        if (st === 'active') { n.el.classList.add('is-active', 'is-busy'); }
        else if (st === 'done') { n.el.classList.add('is-done'); badge.textContent = '✓'; }
        else if (st === 'error') { n.el.classList.add('is-error'); badge.textContent = '!'; }
      }
  
      function findEdge(a, b) {
        for (var i = 0; i < edges.length; i++) {
          if (edges[i].a === a && edges[i].b === b) { return edges[i]; }
        }
        return null;
      }
  
      // "pipe filling" + particle travel
      function runEdge(a, b, dur) {
        dur = dur || 900;
        var e = findEdge(a, b);
        return new Promise(function (res) {
          if (!e) { res(); return; }
          e.filled = true;
          e.pipe.classList.add('is-live');
          e.dot.style.opacity = '1';
          var start = performance.now();
          function frame(now) {
            var t = Math.min(1, (now - start) / dur);
            var k = ease(t);
            e.fill.style.strokeDashoffset = String(e.len * (1 - k));
            var p = e.pipe.getPointAtLength(e.len * k);
            e.dot.setAttribute('cx', p.x);
            e.dot.setAttribute('cy', p.y);
            if (t < 1) { requestAnimationFrame(frame); }
            else {
              e.dot.style.opacity = '0';
              e.pipe.classList.remove('is-live');
              e.pipe.classList.add('is-filled');
              res();
            }
          }
          requestAnimationFrame(frame);
        });
      }
  
      function pulseEdge(a, b, ms) {
        var e = findEdge(a, b);
        if (!e) { return; }
        e.pipe.classList.add('is-warn');
        setTimeout(function () { e.pipe.classList.remove('is-warn'); }, ms || 1000);
      }
  
      function log(msg, cls) {
        if (!logEl) { return; }
        var line = document.createElement('div');
        line.className = 'fl-line fl-' + (cls || 'info');
        var sec = ((performance.now() - t0) / 1000).toFixed(1);
        line.innerHTML = '<span class="fl-t">[+' + sec + 's]</span>' + msg;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
      }
  
      function reset() {
        t0 = performance.now();
        nodes.forEach(function (n) { setNode(n.cfg.id, 'idle'); });
        edges.forEach(function (e) {
          e.filled = false;
          e.fill.style.strokeDashoffset = e.len;
          e.dot.style.opacity = '0';
          e.pipe.classList.remove('is-live', 'is-filled', 'is-warn');
        });
        if (logEl) { logEl.innerHTML = ''; }
      }
  
      if ('ResizeObserver' in window) {
        new ResizeObserver(function () { layout(); }).observe(host);
      }
      window.addEventListener('resize', layout);
      window.addEventListener('load', layout);
      layout();
  
      console.log('[flowkit] engine mounted, nodes=' + nodes.size + ', edges=' + edges.length);
  
      return {
        host: host,
        setNode: setNode,
        runEdge: runEdge,
        pulseEdge: pulseEdge,
        log: log,
        reset: reset,
        layout: layout,
        nodeEl: function (id) { var n = nodes.get(id); return n ? n.el : null; }
      };
    }
  
    window.FlowKit = { mount: mount };
  })();