/* ============================================================
   common.js — site chrome (header/footer), contacts widget,
   reveal animations, confetti, shared helpers.
   ALL CONTACTS ARE CONFIGURED IN THE CONTACTS ARRAY BELOW.
   Entries with an empty `value` are hidden everywhere
   (widget, contacts section, footer).
   ============================================================ */
   (function () {
    'use strict';
  
    // --- contacts config: single source of truth for the whole site ---
    var CONTACTS = [
      {
        id: 'email', icon: '✉️', label: 'Email',
        value: 'eandrey813@gmail.com',
        href: 'mailto:eandrey813@gmail.com'
      },
      // TODO: replace with your real Telegram handle
      {
        id: 'tg', icon: '📨', label: 'Telegram',
        value: '@CybandG_16',
        href: 'https://t.me/CybandG_16'
      },
      {
        id: 'github', icon: '📦', label: 'GitHub',
        value: 'CybandG',
        href: 'https://github.com/CybandG'
      },
    ].filter(function (c) { return c.value; });
  
    function esc(s) {
      return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  
    var body = document.body;
    var root = body.getAttribute('data-root') || './';
  
    // ---------- header ----------
    var header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML =
      '<div class="wrap site-header-in">' +
        '<a class="logo" href="' + root + 'index.html">' +
          '<span class="logo-mark">AE</span>' +
          '<span class="logo-tx">Андрей Елфимов' +
            '<span class="logo-sub">AI-инженер · автоматизация процессов</span>' +
          '</span>' +
        '</a>' +
        '<nav class="top-nav">' +
          '<a href="' + root + 'index.html#cases">Кейсы</a>' +
          '<a href="' + root + 'index.html#experience">Опыт</a>' +
          '<a href="' + root + 'index.html#stack">Стек</a>' +
          '<a href="' + root + 'index.html#contacts" data-contacts-open>Связаться</a>' +
        '</nav>' +
      '</div>';
    body.insertBefore(header, body.firstChild);
  
    // ---------- footer ----------
    var footLinks = CONTACTS.map(function (c) {
      var ext = c.href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + esc(c.href) + '"' + ext + '>' + esc(c.label) + '</a>';
    }).join('');
    var footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML =
      '<div class="wrap site-footer-in">' +
        '<span>© ' + new Date().getFullYear() + ' Андрей Елфимов · AI-инженер по автоматизации бизнес-процессов</span>' +
        '<span class="foot-links">' + footLinks + '</span>' +
      '</div>';
    body.appendChild(footer);
  
    // ---------- toast ----------
    var toastEl = null;
    function toast(msg) {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'toast';
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1700);
    }
  
    // ---------- clipboard ----------
    function copyText(text) {
      function done() {
        toast('Скопировано: ' + text);
        console.log('[common] contact copied to clipboard');
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); });
      } else {
        legacyCopy(text);
        done();
      }
    }
    // fallback for old browsers / http contexts
    function legacyCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
    }
  
    // ---------- contact row renderer (widget + contacts section) ----------
    function contactRow(c) {
      var d = document.createElement('div');
      d.className = 'c-row';
      var ext = c.href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '';
      d.innerHTML =
        '<div class="c-ic">' + c.icon + '</div>' +
        '<div class="c-tx">' +
          '<div class="c-label">' + esc(c.label) + '</div>' +
          '<div class="c-value">' + esc(c.value) + '</div>' +
        '</div>' +
        '<div class="c-actions">' +
          '<button class="icon-btn" data-copy="' + esc(c.copy || c.value) + '" title="Копировать" aria-label="Копировать ' + esc(c.label) + '">⧉</button>' +
          '<a class="icon-btn" href="' + esc(c.href) + '"' + ext + ' title="Написать / открыть" aria-label="Написать: ' + esc(c.label) + '">↗</a>' +
        '</div>';
      return d;
    }
  
    // ---------- contacts widget (modal) ----------
    var overlay = document.createElement('div');
    overlay.className = 'cw-overlay';
    overlay.innerHTML =
      '<div class="cw-modal" role="dialog" aria-modal="true" aria-label="Контакты">' +
        '<div class="cw-head"><b>Как со мной связаться</b>' +
          '<button class="icon-btn" id="cwClose" aria-label="Закрыть">✕</button></div>' +
        '<div class="cw-list"></div>' +
        '<div class="cw-note">⧉ — скопировать контакт в буфер обмена · ↗ — открыть почту, мессенджер или страницу</div>' +
      '</div>';
    body.appendChild(overlay);
    var cwList = overlay.querySelector('.cw-list');
    CONTACTS.forEach(function (c) { cwList.appendChild(contactRow(c)); });
  
    function openCw() { overlay.classList.add('open'); }
    function closeCw() { overlay.classList.remove('open'); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { closeCw(); } });
    overlay.querySelector('#cwClose').addEventListener('click', closeCw);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeCw(); } });
  
    // contacts section on the main page (if present)
    var sectionList = document.getElementById('contactList');
    if (sectionList) {
      CONTACTS.forEach(function (c) { sectionList.appendChild(contactRow(c)); });
    }
  
    // delegated clicks: open widget + copy buttons anywhere on the page
    document.addEventListener('click', function (e) {
      var opener = e.target.closest('[data-contacts-open]');
      if (opener) { e.preventDefault(); openCw(); return; }
      var cp = e.target.closest('[data-copy]');
      if (cp) { e.preventDefault(); copyText(cp.getAttribute('data-copy')); }
    });
  
    window.ContactsWidget = { open: openCw, close: closeCw };
  
    // ---------- reveal-on-scroll ----------
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('revealed');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12 });
      document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });
    } else {
      document.querySelectorAll('[data-reveal]').forEach(function (el) { el.classList.add('revealed'); });
    }
  
    // ---------- helpers ----------
    window.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  
    window.confettiBurst = function (host, count) {
      count = count || 70;
      var colors = ['#38bdf8', '#8b5cf6', '#34d399', '#fbbf24', '#f472b6'];
      for (var i = 0; i < count; i++) {
        var p = document.createElement('i');
        p.className = 'cf-piece';
        p.style.left = (Math.random() * 100) + '%';
        p.style.background = colors[i % colors.length];
        p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
        p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
        p.style.animationDelay = (Math.random() * 0.25) + 's';
        p.style.animationDuration = (1.2 + Math.random() * 0.9) + 's';
        host.appendChild(p);
        (function (node) { setTimeout(function () { node.remove(); }, 2600); })(p);
      }
    };
  
    console.log('[common] site chrome initialized, contacts visible: ' + CONTACTS.length);
  })();