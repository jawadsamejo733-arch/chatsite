/* ChatSite web app — plain JavaScript, no build step. */
(() => {
  'use strict';

  // ---------------------------------------------------------------- helpers
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v; // trusted, constant SVG only
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = !!v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : String(kid));
    }
    return el;
  }

  const ICONS = {
    send: '<path d="M4 12 20 4l-4 16-4.5-6.5L4 12z"/><path d="m11.5 13.5 4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    store: '<path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9"/><path d="M3 10 5 4h14l2 6a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M10 20v-5h4v5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    dcheck: '<path d="m2 12 5 5 9-10"/><path d="m11 16 1 1 9-10"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
    logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
    block: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
  };
  const icon = (name, cls = '') => h('span', {
    class: 'ic ' + cls, 'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`,
  });

  const COUNTRIES = [
    ['1', 'US/Canada'], ['44', 'United Kingdom'], ['92', 'Pakistan'], ['91', 'India'], ['971', 'UAE'], ['966', 'Saudi Arabia'],
    ['974', 'Qatar'], ['965', 'Kuwait'], ['973', 'Bahrain'], ['968', 'Oman'], ['880', 'Bangladesh'], ['94', 'Sri Lanka'],
    ['977', 'Nepal'], ['93', 'Afghanistan'], ['98', 'Iran'], ['90', 'Türkiye'], ['20', 'Egypt'], ['212', 'Morocco'],
    ['234', 'Nigeria'], ['254', 'Kenya'], ['27', 'South Africa'], ['233', 'Ghana'], ['255', 'Tanzania'], ['256', 'Uganda'],
    ['49', 'Germany'], ['33', 'France'], ['39', 'Italy'], ['34', 'Spain'], ['31', 'Netherlands'], ['46', 'Sweden'],
    ['47', 'Norway'], ['41', 'Switzerland'], ['48', 'Poland'], ['353', 'Ireland'], ['7', 'Russia/Kazakhstan'], ['380', 'Ukraine'],
    ['61', 'Australia'], ['64', 'New Zealand'], ['65', 'Singapore'], ['60', 'Malaysia'], ['62', 'Indonesia'], ['63', 'Philippines'],
    ['66', 'Thailand'], ['84', 'Vietnam'], ['86', 'China'], ['852', 'Hong Kong'], ['81', 'Japan'], ['82', 'South Korea'],
    ['55', 'Brazil'], ['52', 'Mexico'], ['54', 'Argentina'], ['57', 'Colombia'], ['56', 'Chile'], ['51', 'Peru'],
  ];

  const S = {
    config: null, me: null, csrf: '',
    chats: new Map(), msgs: new Map(),
    lastId: 0, rsince: 0, activeId: null, tab: 'chat',
    compose: new Map(), site: null, draft: null,
  };

  // ---------------------------------------------------------------- API
  async function api(route, { method = 'GET', body, form, query } = {}) {
    let url = 'api.php?r=' + route;
    if (query) url += '&' + new URLSearchParams(query).toString();
    const opts = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
    if (method !== 'GET') opts.headers['X-CSRF-Token'] = S.csrf;
    if (form) opts.body = form;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(url, opts); } catch { throw Object.assign(new Error("You're offline. Check your connection."), { status: 0 }); }
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) throw Object.assign(new Error((data && data.error) || `Request failed (${res.status})`), { status: res.status, data });
    if (data && data.csrf) S.csrf = data.csrf;
    return data;
  }
  const post = (route, body) => api(route, { method: 'POST', body: body || {} });

  // ---------------------------------------------------------------- UI bits
  function toast(msg, kind = '') {
    let box = $('.toasts');
    if (!box) document.body.append(box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }));
    const t = h('div', { class: 'toast ' + kind, text: msg });
    box.append(t);
    setTimeout(() => t.classList.add('out'), 3600);
    setTimeout(() => t.remove(), 4000);
  }
  const fail = (e) => { if (e && e.status === 401) return signedOut(); toast(e && e.message ? e.message : String(e), 'bad'); };

  function modal(title, body, { wide = false } = {}) {
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const wrap = h('div', { class: 'overlay', onclick: (e) => { if (e.target === wrap) close(); } },
      h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'modal-head' }, h('h2', { text: title }),
          h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon('close'))),
        body));
    document.addEventListener('keydown', onKey);
    document.body.append(wrap);
    setTimeout(() => { const f = wrap.querySelector('input,textarea,select,button.primary'); if (f) f.focus(); }, 30);
    return close;
  }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; if (label) btn.textContent = label; }
    else { btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
  }

  const COLORS = ['#4f46e5', '#0f766e', '#c2410c', '#be185d', '#7c3aed', '#0369a1', '#15803d', '#b45309', '#9d174d', '#1d4ed8'];
  function avatar(user, size = '') {
    const name = (user && (user.display_name || user.name || user.phone)) || '?';
    const letters = name.replace(/^\+/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join('').toUpperCase() || '?';
    return h('span', { class: 'avatar ' + size, style: `--av:${COLORS[(user && user.id || 0) % COLORS.length]}`, 'aria-hidden': 'true' }, letters);
  }

  const pad = (n) => String(n).padStart(2, '0');
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  function dayLabel(ts) {
    const d = new Date(ts * 1000), today = dayStart(new Date()), diff = Math.round((today - dayStart(d)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }
  function listTime(ts) {
    if (!ts) return '';
    const l = dayLabel(ts);
    return l === 'Today' ? timeFmt.format(new Date(ts * 1000)) : l;
  }
  function presence(peer) {
    if (peer.online) return 'online';
    if (!peer.last_seen_at) return peer.phone;
    const l = dayLabel(peer.last_seen_at);
    return 'last seen ' + (l === 'Today' ? 'today' : l === 'Yesterday' ? 'yesterday' : l) + ' at ' + timeFmt.format(new Date(peer.last_seen_at * 1000));
  }

  function linkify(text) {
    const out = [];
    const re = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer nofollow', text: m[0] }));
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  function phoneField(defaultCc) {
    const cc = defaultCc || (S.config && S.config.default_country_code) || '1';
    const list = COUNTRIES.some((c) => c[0] === cc) ? COUNTRIES : [[cc, 'Default'], ...COUNTRIES];
    const sel = h('select', { class: 'cc', 'aria-label': 'Country code' },
      list.map(([code, name]) => h('option', { value: code, selected: code === cc }, `+${code} ${name}`)));
    const num = h('input', { type: 'tel', inputmode: 'tel', autocomplete: 'tel-national', placeholder: 'Mobile number', 'aria-label': 'Mobile number', maxlength: 20 });
    const wrap = h('div', { class: 'phone-field' }, sel, num);
    const value = () => {
      const raw = num.value.trim();
      if (raw.startsWith('+') || raw.startsWith('00')) return raw;
      return '+' + sel.value + raw.replace(/\D/g, '').replace(/^0+/, '');
    };
    return { el: wrap, input: num, value };
  }

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); toast('Copied'); }
    catch { window.prompt('Copy this:', text); }
  };

  // ---------------------------------------------------------------- auth screens
  function screen(...kids) {
    const root = $('#root');
    root.className = '';
    root.replaceChildren(...kids);
  }

  function renderLogin(step = 'phone', state = {}) {
    const app = S.config.app_name;
    const brand = h('div', { class: 'brand' }, h('img', { src: 'assets/icon.svg', alt: '', width: 56, height: 56 }), h('h1', { text: app }));

    if (step === 'phone') {
      const pf = phoneField();
      if (state.phone) pf.input.value = state.phone;
      const btn = h('button', { class: 'btn primary block', type: 'submit', text: 'Send code' });
      const form = h('form', {
        class: 'auth-card', onsubmit: async (e) => {
          e.preventDefault();
          if (!pf.input.value.trim()) return pf.input.focus();
          busy(btn, true, 'Sending…');
          try {
            const r = await post('auth/request-code', { phone: pf.value() });
            renderLogin('code', { phone: r.phone, resendAfter: r.resend_after, devCode: r.dev_code });
          } catch (err) { fail(err); busy(btn, false); }
        },
      },
      brand,
      h('h2', { text: 'Sign in with your phone' }),
      h('p', { class: 'muted', text: "We'll text you a 6-digit code. No password needed." }),
      pf.el, btn,
      h('p', { class: 'fine', text: 'Businesses and customers use the same app. After signing in you can chat and build your own mini-site.' }));
      screen(h('div', { class: 'auth' }, form));
      pf.input.focus();
      return;
    }

    const code = h('input', { class: 'code-input', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, placeholder: '••••••', 'aria-label': '6-digit code', pattern: '[0-9]*' });
    const btn = h('button', { class: 'btn primary block', type: 'submit', text: 'Verify' });
    const resend = h('button', { class: 'btn link', type: 'button', disabled: true });
    let left = state.resendAfter || 45;
    const tick = () => {
      if (!document.body.contains(resend)) return clearInterval(timer);
      left -= 1;
      resend.disabled = left > 0;
      resend.textContent = left > 0 ? `Resend code in ${left}s` : 'Resend code';
    };
    const timer = setInterval(tick, 1000); tick();
    resend.addEventListener('click', async () => {
      try {
        const r = await post('auth/request-code', { phone: state.phone });
        toast('A new code is on its way');
        renderLogin('code', { phone: r.phone, resendAfter: r.resend_after, devCode: r.dev_code });
      } catch (err) { fail(err); }
    });
    const verify = async () => {
      if (code.value.replace(/\D/g, '').length !== 6) return;
      busy(btn, true, 'Checking…');
      try {
        const r = await post('auth/verify-code', { phone: state.phone, code: code.value });
        S.me = r.user;
        clearInterval(timer);
        afterSignIn();
      } catch (err) { fail(err); busy(btn, false); code.select(); }
    };
    code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 6); if (code.value.length === 6) verify(); });
    const form = h('form', { class: 'auth-card', onsubmit: (e) => { e.preventDefault(); verify(); } },
      brand,
      h('h2', { text: 'Enter your code' }),
      h('p', { class: 'muted' }, 'Sent by SMS to ', h('strong', { text: state.phone })),
      state.devCode ? h('div', { class: 'dev-note' }, 'Development mode — no SMS was sent. Your code is ', h('strong', { text: state.devCode })) : null,
      code, btn,
      h('div', { class: 'row-between' },
        h('button', { class: 'btn link', type: 'button', text: 'Change number', onclick: () => { clearInterval(timer); renderLogin('phone', { phone: state.phone }); } }),
        resend));
    screen(h('div', { class: 'auth' }, form));
    code.focus();
  }

  function profileForm(onDone, { first = false } = {}) {
    const me = S.me;
    const name = h('input', { value: me.name, maxlength: 60, required: true, autocomplete: 'name', placeholder: 'e.g. Sara Khan' });
    const biz = h('input', { value: me.business_name, maxlength: 60, placeholder: "e.g. Sara's Bakery (optional)" });
    const about = h('input', { value: me.about, maxlength: 160, placeholder: 'A short status or description (optional)' });
    const btn = h('button', { class: 'btn primary block', type: 'submit', text: first ? 'Continue' : 'Save' });
    return h('form', {
      class: 'stack', onsubmit: async (e) => {
        e.preventDefault();
        busy(btn, true, 'Saving…');
        try {
          const r = await post('profile/update', { name: name.value, business_name: biz.value, about: about.value });
          S.me = r.user;
          onDone();
        } catch (err) { fail(err); busy(btn, false); }
      },
    },
    h('label', {}, h('span', { text: 'Your name' }), name),
    h('label', {}, h('span', { text: 'Business name' }), biz, h('small', { text: 'Shown to customers instead of your name if you fill it in.' })),
    h('label', {}, h('span', { text: 'About' }), about),
    btn);
  }

  function renderOnboarding() {
    screen(h('div', { class: 'auth' }, h('div', { class: 'auth-card' },
      h('div', { class: 'brand' }, avatar(S.me, 'xl')),
      h('h2', { text: 'Set up your profile' }),
      h('p', { class: 'muted', text: 'This is how people will see you in their chats.' }),
      profileForm(() => afterSignIn(), { first: true }))));
    setTimeout(() => { const i = $('.auth input'); if (i) i.focus(); }, 30);
  }

  function signedOut() {
    stopPolling();
    S.me = null; S.chats.clear(); S.msgs.clear(); S.lastId = 0; S.rsince = 0; S.activeId = null;
    api('auth/me').then((r) => { S.csrf = r.csrf; renderLogin(); }).catch(() => renderLogin());
  }

  function afterSignIn() {
    if (!S.me.name) return renderOnboarding();
    renderShell();
    let pending = null;
    try { pending = sessionStorage.getItem('chatsite_link'); sessionStorage.removeItem('chatsite_link'); } catch { /* storage blocked */ }
    if (pending && pending.startsWith('#/to/')) location.hash = pending;
    loadChats().then(() => { route(); startPolling(); }).catch(fail);
  }

  // ---------------------------------------------------------------- main shell
  function renderShell() {
    const root = $('#root');
    root.className = '';
    const search = h('input', { type: 'search', placeholder: 'Search chats', 'aria-label': 'Search chats', oninput: () => renderChatList() });
    root.replaceChildren(h('div', { class: 'app' },
      h('aside', { class: 'sidebar' },
        h('header', { class: 'side-head' },
          h('button', { class: 'me-btn', 'aria-label': 'Your profile', onclick: openProfile }, avatar(S.me)),
          h('div', { class: 'side-title', text: S.config.app_name }),
          h('button', { class: 'icon-btn', title: 'My mini-site', 'aria-label': 'My mini-site', onclick: () => { location.hash = '#/site'; } }, icon('store')),
          h('button', { class: 'icon-btn', title: 'New chat', 'aria-label': 'New chat', onclick: openNewChat }, icon('plus'))),
        h('div', { class: 'search' }, icon('search'), search),
        h('div', { class: 'chat-list', role: 'list' }),
        h('button', { class: 'site-promo', onclick: () => { location.hash = '#/site'; } },
          icon('store'), h('span', {}, h('strong', { text: 'Your mini-site' }), h('small', { text: 'Show customers your products right inside the chat' })))),
      h('main', { class: 'main' })));
    renderChatList();
  }

  function filteredChats() {
    const q = (($('.search input') || {}).value || '').trim().toLowerCase();
    const list = [...S.chats.values()].sort((a, b) => (b.updated_at - a.updated_at) || (b.id - a.id));
    if (!q) return list;
    return list.filter((c) => [c.peer.display_name, c.peer.name, c.peer.phone, c.last && c.last.body].join(' ').toLowerCase().includes(q));
  }

  function tickIcon(chat, msgId) {
    if (msgId < 0) return icon('clock', 'tick pending');
    if (chat.peer_read_id >= msgId) return icon('dcheck', 'tick read');
    if (chat.peer_delivered_id >= msgId) return icon('dcheck', 'tick');
    return icon('check', 'tick');
  }

  function renderChatList() {
    const box = $('.chat-list');
    if (!box) return;
    const list = filteredChats();
    if (!list.length) {
      box.replaceChildren(h('div', { class: 'list-empty' },
        S.chats.size ? 'No chats match your search.' : h('div', {},
          h('p', { text: 'No chats yet.' }),
          h('button', { class: 'btn primary', onclick: openNewChat }, icon('plus'), 'Start a chat'))));
    } else {
      box.replaceChildren(...list.map((c) => h('a', {
        class: 'chat-item' + (c.id === S.activeId ? ' active' : '') + (c.unread ? ' has-unread' : ''),
        href: '#/c/' + c.id, role: 'listitem',
      },
      avatar(c.peer),
      h('div', { class: 'ci-main' },
        h('div', { class: 'ci-top' },
          h('span', { class: 'ci-name', text: c.peer.display_name }),
          c.peer.site ? h('span', { class: 'site-badge', title: 'Has a mini-site' }, icon('globe')) : null,
          h('span', { class: 'ci-time', text: listTime(c.last ? c.last.created_at : c.updated_at) })),
        h('div', { class: 'ci-bottom' },
          c.last && c.last.mine ? tickIcon(c, c.last.id) : null,
          h('span', { class: 'ci-last', text: c.last ? c.last.body : (c.blocked ? 'Blocked' : 'Say hello 👋') }),
          c.unread ? h('span', { class: 'badge', text: c.unread > 99 ? '99+' : c.unread }) : null)))));
    }
    const total = [...S.chats.values()].reduce((n, c) => n + (c.unread || 0), 0);
    document.title = (total ? `(${total}) ` : '') + S.config.app_name;
  }

  async function loadChats() {
    const r = await api('chats');
    const prev = S.chats;
    S.chats = new Map(r.chats.map((c) => [c.id, c]));
    for (const c of S.chats.values()) {
      if (c.last) S.lastId = Math.max(S.lastId, c.last.id);
      const old = prev.get(c.id);
      if (old && old.id === S.activeId && c.id === S.activeId && document.visibilityState === 'visible') c.unread = 0;
    }
    if (!S.rsince) S.rsince = r.now;
    renderChatList();
  }

  // ---------------------------------------------------------------- routing
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
  }

  function setMain(node, inMain = true) {
    const main = $('.main');
    if (!main) return;
    main.replaceChildren(node);
    $('.app').classList.toggle('in-main', inMain);
  }

  async function route() {
    if (!S.me || !$('.app')) return;
    const { parts, q } = parseHash();
    if (parts[0] === 'c' && parts[1]) {
      openChat(Number(parts[1]), parts[2] === 'site' ? 'site' : 'chat');
    } else if (parts[0] === 'site') {
      S.activeId = null; renderChatList(); openSiteEditor();
    } else if (parts[0] === 'to' && parts[1]) {
      try {
        const r = await api('sites/resolve', { query: { slug: parts[1] } });
        if (r.user.id === S.me.id) { location.hash = '#/site'; return; }
        const o = await post('chats/open', { user_id: r.user.id });
        S.chats.set(o.chat.id, o.chat);
        if (q.get('text')) S.compose.set(o.chat.id, q.get('text').slice(0, 1000));
        location.replace('#/c/' + o.chat.id);
      } catch (e) { fail(e); location.replace('#/'); }
    } else {
      S.activeId = null; renderChatList(); setMain(emptyMain(), false);
    }
  }

  function emptyMain() {
    return h('div', { class: 'empty-main' },
      h('img', { src: 'assets/icon.svg', alt: '', width: 72, height: 72 }),
      h('h2', { text: S.config.app_name }),
      h('p', { class: 'muted', text: 'Chat with customers and businesses. Every account can have a mini-site that opens right inside the chat.' }),
      h('div', { class: 'row-gap' },
        h('button', { class: 'btn primary', onclick: openNewChat }, icon('plus'), 'New chat'),
        h('a', { class: 'btn', href: '#/site' }, icon('store'), 'Build my mini-site')));
  }

  // ---------------------------------------------------------------- chat view
  async function openChat(id, tab = 'chat') {
    let chat = S.chats.get(id);
    if (!chat) {
      try { chat = (await api('chats/one', { query: { id } })).chat; S.chats.set(id, chat); } catch (e) { fail(e); location.replace('#/'); return; }
    }
    const switching = S.activeId !== id || !$('.chat-view');
    S.activeId = id;
    S.tab = tab === 'site' && chat.peer.site ? 'site' : 'chat';
    renderChatList();
    if (switching) setMain(chatView(chat));
    else updateChatHeader(chat);
    showTab();
    if (!S.msgs.has(id) || !S.msgs.get(id).loaded) await loadMessages(id);
    else renderMessages('bottom');
    markReadSoon();
  }

  function chatView(chat) {
    const ta = h('textarea', { rows: 1, placeholder: 'Type a message', 'aria-label': 'Message', maxlength: S.config.limits.message_length });
    const draft = S.compose.get(chat.id);
    if (draft) { ta.value = draft; S.compose.delete(chat.id); }
    const sendBtn = h('button', { class: 'send-btn', type: 'submit', 'aria-label': 'Send' }, icon('send'));
    const autosize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; };
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); form.requestSubmit(); }
    });
    const form = h('form', { class: 'composer', onsubmit: (e) => { e.preventDefault(); sendMessage(chat.id, ta); autosize(); } }, ta, sendBtn);
    const messages = h('div', { class: 'messages', onscroll: onMessagesScroll });
    const view = h('section', { class: 'chat-view' },
      h('header', { class: 'chat-head' }),
      h('div', { class: 'chat-pane' }, messages, h('div', { class: 'blocked-bar', hidden: true }), form),
      h('div', { class: 'site-pane', hidden: true }));
    updateChatHeader(chat, view);
    setTimeout(() => { autosize(); if (window.matchMedia('(pointer: fine)').matches) ta.focus(); }, 0);
    return view;
  }

  function updateChatHeader(chat, root = document) {
    const head = $('.chat-head', root);
    if (!head) return;
    const tabs = chat.peer.site ? h('div', { class: 'tabs', role: 'tablist' },
      h('a', { class: 'tab' + (S.tab === 'chat' ? ' on' : ''), href: '#/c/' + chat.id, role: 'tab' }, icon('chat'), h('span', { text: 'Chat' })),
      h('a', { class: 'tab' + (S.tab === 'site' ? ' on' : ''), href: '#/c/' + chat.id + '/site', role: 'tab' }, icon('globe'), h('span', { text: 'Website' }))) : null;
    head.replaceChildren(...[
      h('a', { class: 'icon-btn back', href: '#/', 'aria-label': 'Back to chats' }, icon('back')),
      h('button', { class: 'peer', onclick: () => openPeerInfo(chat) }, avatar(chat.peer),
        h('span', { class: 'peer-text' }, h('strong', { text: chat.peer.display_name }),
          h('small', { class: chat.peer.online ? 'online' : '', text: chat.blocked ? 'Blocked' : presence(chat.peer) }))),
      tabs,
      h('button', { class: 'icon-btn', 'aria-label': 'Chat options', onclick: () => openPeerInfo(chat) }, icon('more')),
    ].filter(Boolean));
    const bar = $('.blocked-bar', root);
    const form = $('.composer', root);
    if (bar && form) {
      bar.hidden = !chat.blocked;
      form.hidden = !!chat.blocked;
      bar.replaceChildren('You blocked this contact. ', h('button', { class: 'btn link', text: 'Unblock', onclick: () => setBlocked(chat, false) }));
    }
  }

  function showTab() {
    const chat = S.chats.get(S.activeId);
    const pane = $('.chat-pane'), sitePane = $('.site-pane');
    if (!pane || !sitePane || !chat) return;
    const site = S.tab === 'site';
    pane.hidden = site;
    sitePane.hidden = !site;
    $$('.tab').forEach((t, i) => t.classList.toggle('on', (i === 1) === site));
    if (site && chat.peer.site) {
      const frame = $('iframe', sitePane);
      if (!frame || frame.dataset.src !== chat.peer.site.url) {
        sitePane.replaceChildren(
          h('iframe', {
            class: 'site-frame', src: chat.peer.site.url, dataset: { src: chat.peer.site.url }, title: chat.peer.display_name + ' website',
            sandbox: 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads',
            referrerpolicy: 'no-referrer', loading: 'lazy',
          }),
          h('div', { class: 'site-bar' },
            h('span', { class: 'muted', text: 'Tap a product to message ' + chat.peer.display_name }),
            h('a', { class: 'btn small', href: chat.peer.site.url, target: '_blank', rel: 'noopener' }, icon('external'), 'Open')));
      }
    }
  }
  // Messages from a mini-site ("Order in chat" buttons) prefill the composer. Never auto-sent.
  window.addEventListener('message', (ev) => {
    const frame = $('.site-frame');
    if (!frame || ev.source !== frame.contentWindow) return;
    const d = ev.data;
    if (!d || d.type !== 'chatsite:compose' || typeof d.text !== 'string' || !S.activeId) return;
    const id = S.activeId;
    location.hash = '#/c/' + id;
    setTimeout(() => {
      const ta = $('.composer textarea');
      if (!ta) return;
      ta.value = d.text.slice(0, 1000);
      ta.dispatchEvent(new Event('input'));
      ta.focus();
      toast('Message ready — tap send');
    }, 60);
  });

  async function loadMessages(id, older = false) {
    const store = S.msgs.get(id) || { list: [], hasMore: false, loaded: false, loading: false };
    S.msgs.set(id, store);
    if (store.loading) return;
    store.loading = true;
    try {
      const firstReal = store.list.find((m) => m.id > 0);
      const r = await api('messages', { query: { chat: id, before: older && firstReal ? firstReal.id : 0 } });
      if (older) {
        const ids = new Set(store.list.map((m) => m.id));
        store.list = [...r.messages.filter((m) => !ids.has(m.id)), ...store.list];
      } else {
        const ids = new Set(r.messages.map((m) => m.id));
        store.list = [...r.messages, ...store.list.filter((m) => !ids.has(m.id) && (m.id < 0 || m.id > (r.messages.at(-1) || { id: 0 }).id))];
        for (const m of r.messages) S.lastId = Math.max(S.lastId, m.id);
      }
      if (older || !store.loaded) store.hasMore = r.has_more;
      store.loaded = true;
    } catch (e) { fail(e); } finally { store.loading = false; }
    if (S.activeId === id) renderMessages(older ? 'top' : 'bottom');
  }

  function onMessagesScroll(e) {
    const box = e.currentTarget;
    const store = S.msgs.get(S.activeId);
    if (box.scrollTop < 60 && store && store.hasMore && !store.loading) loadMessages(S.activeId, true);
    if (box.scrollHeight - box.scrollTop - box.clientHeight < 40) markReadSoon();
  }

  function renderMessages(keep) {
    const box = $('.messages');
    const chat = S.chats.get(S.activeId);
    if (!box || !chat) return;
    const store = S.msgs.get(chat.id) || { list: [] };
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
    const prevH = box.scrollHeight, prevTop = box.scrollTop;
    const nodes = [];
    if (store.hasMore) nodes.push(h('div', { class: 'loading-older', text: 'Loading earlier messages…' }));
    if (!store.list.length && store.loaded) {
      nodes.push(h('div', { class: 'chat-intro' }, avatar(chat.peer, 'xl'),
        h('h3', { text: chat.peer.display_name }),
        h('p', { class: 'muted', text: chat.peer.about || chat.peer.phone }),
        chat.peer.site ? h('a', { class: 'btn', href: '#/c/' + chat.id + '/site' }, icon('globe'), 'View their website') : null,
        h('p', { class: 'fine', text: 'Messages are private between you and ' + chat.peer.display_name + '.' })));
    }
    let lastDay = '', lastSender = null;
    for (const m of store.list) {
      const day = dayLabel(m.created_at);
      if (day !== lastDay) { nodes.push(h('div', { class: 'day' }, h('span', { text: day }))); lastDay = day; lastSender = null; }
      const mine = m.sender === S.me.id;
      nodes.push(h('div', { class: 'msg ' + (mine ? 'out' : 'in') + (lastSender === m.sender ? ' cont' : '') + (m.failed ? ' failed' : ''), dataset: { id: m.id } },
        h('div', { class: 'bubble' },
          h('span', { class: 'text' }, linkify(m.body)),
          h('span', { class: 'meta' }, timeFmt.format(new Date(m.created_at * 1000)), mine ? (m.failed ? icon('alert', 'tick bad') : tickIcon(chat, m.id)) : null)),
        m.failed ? h('button', { class: 'retry', text: 'Not sent — tap to retry', onclick: () => retrySend(chat.id, m) }) : null));
      lastSender = m.sender;
    }
    box.replaceChildren(...nodes);
    if (keep === 'top') box.scrollTop = box.scrollHeight - prevH + prevTop;
    else if (keep === 'bottom' || atBottom) box.scrollTop = box.scrollHeight;
  }

  let tempId = -1;
  async function sendMessage(chatId, ta) {
    const body = ta.value.trim();
    if (!body) return;
    ta.value = '';
    const store = S.msgs.get(chatId) || { list: [], loaded: true, hasMore: false };
    S.msgs.set(chatId, store);
    const temp = { id: tempId--, chat: chatId, sender: S.me.id, body, created_at: Math.floor(Date.now() / 1000), pending: true };
    store.list.push(temp);
    renderMessages('bottom');
    await deliver(chatId, temp);
  }

  async function deliver(chatId, temp) {
    const store = S.msgs.get(chatId);
    try {
      const r = await post('messages/send', { chat: chatId, body: temp.body });
      const i = store.list.indexOf(temp);
      if (store.list.some((m) => m.id === r.message.id)) { if (i >= 0) store.list.splice(i, 1); }
      else if (i >= 0) store.list[i] = r.message;
      else store.list.push(r.message);
      S.lastId = Math.max(S.lastId, r.message.id);
      const chat = S.chats.get(chatId);
      if (chat) {
        chat.last = { id: r.message.id, body: r.message.body.slice(0, 120), mine: true, created_at: r.message.created_at };
        chat.updated_at = r.message.created_at;
      }
      renderChatList();
    } catch (e) {
      temp.failed = true;
      if (e.status !== 0) toast(e.message, 'bad');
    }
    if (S.activeId === chatId) renderMessages();
  }

  function retrySend(chatId, m) { m.failed = false; renderMessages(); deliver(chatId, m); }

  let readTimer = null;
  function markReadSoon() {
    clearTimeout(readTimer);
    readTimer = setTimeout(() => {
      const chat = S.chats.get(S.activeId);
      const store = chat && S.msgs.get(chat.id);
      const box = $('.messages');
      if (!chat || !store || document.visibilityState !== 'visible' || S.tab !== 'chat' || !box) return;
      if (box.scrollHeight - box.scrollTop - box.clientHeight > 120) return;
      const lastIn = [...store.list].reverse().find((m) => m.id > 0 && m.sender !== S.me.id);
      if (!lastIn || (chat.readUpto || 0) >= lastIn.id) { if (chat.unread) { chat.unread = 0; renderChatList(); } return; }
      chat.readUpto = lastIn.id;
      chat.unread = 0;
      renderChatList();
      post('chats/read', { chat: chat.id, upto: lastIn.id }).catch(() => { chat.readUpto = 0; });
    }, 250);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { markReadSoon(); pollNow(); } });

  // ---------------------------------------------------------------- polling
  let pollTimer = null, polling = false, failures = 0, chatsRefreshedAt = Date.now();
  function startPolling() { stopPolling(); schedulePoll(1500); }
  function stopPolling() { clearTimeout(pollTimer); pollTimer = null; }
  function pollNow() { if (S.me) { clearTimeout(pollTimer); poll(); } }
  function schedulePoll(ms) {
    clearTimeout(pollTimer);
    const base = document.visibilityState === 'visible' ? 2500 : 12000;
    pollTimer = setTimeout(poll, ms != null ? ms : Math.min(base * Math.pow(2, failures), 60000));
  }

  async function poll() {
    if (polling || !S.me) return;
    polling = true;
    let again = false;
    try {
      const r = await api('poll', { query: { since: S.lastId, rsince: S.rsince } });
      failures = 0;
      S.rsince = r.now;
      let unknown = false, activeChanged = false, receiptsActive = false;
      for (const m of r.messages) {
        S.lastId = Math.max(S.lastId, m.id);
        const chat = S.chats.get(m.chat);
        if (!chat) { unknown = true; continue; }
        const store = S.msgs.get(m.chat);
        if (store && store.loaded && !store.list.some((x) => x.id === m.id)) {
          const pending = m.sender === S.me.id && store.list.find((x) => x.id < 0 && x.body === m.body);
          if (pending) store.list[store.list.indexOf(pending)] = m; else store.list.push(m);
          if (m.chat === S.activeId) activeChanged = true;
        }
        if (!chat.last || chat.last.id < m.id) {
          chat.last = { id: m.id, body: m.body.slice(0, 120), mine: m.sender === S.me.id, created_at: m.created_at };
          chat.updated_at = m.created_at;
          if (m.sender !== S.me.id && !(m.chat === S.activeId && document.visibilityState === 'visible' && S.tab === 'chat')) chat.unread = (chat.unread || 0) + 1;
        }
      }
      for (const rc of r.receipts) {
        const c = S.chats.get(rc.chat);
        if (!c) continue;
        if (c.peer_read_id !== rc.peer_read_id || c.peer_delivered_id !== rc.peer_delivered_id) {
          c.peer_read_id = rc.peer_read_id; c.peer_delivered_id = rc.peer_delivered_id;
          if (rc.chat === S.activeId) receiptsActive = true;
        }
      }
      if (unknown || Date.now() - chatsRefreshedAt > 60000) {
        chatsRefreshedAt = Date.now();
        await loadChats();
        const active = S.chats.get(S.activeId);
        if (active) updateChatHeader(active);
      } else renderChatList();
      if (activeChanged || receiptsActive) { renderMessages(); markReadSoon(); }
      again = r.has_more;
    } catch (e) {
      if (e.status === 401) { polling = false; return signedOut(); }
      failures = Math.min(failures + 1, 5);
    } finally {
      polling = false;
    }
    if (S.me) schedulePoll(again ? 50 : undefined);
  }

  // ---------------------------------------------------------------- dialogs
  function openNewChat() {
    const pf = phoneField();
    const result = h('div', { class: 'lookup-result' });
    const btn = h('button', { class: 'btn primary', type: 'submit', text: 'Find' });
    let close = null;
    const form = h('form', {
      class: 'stack', onsubmit: async (e) => {
        e.preventDefault();
        if (!pf.input.value.trim()) return pf.input.focus();
        busy(btn, true, 'Searching…');
        try {
          const r = await api('contacts/lookup', { query: { phone: pf.value() } });
          if (r.user && r.user.id === S.me.id) {
            result.replaceChildren(h('p', { class: 'muted', text: "That's your own number." }));
          } else if (r.user) {
            result.replaceChildren(h('div', { class: 'person' }, avatar(r.user),
              h('div', { class: 'grow' }, h('strong', { text: r.user.display_name }), h('small', { class: 'muted', text: r.user.about || r.user.phone })),
              h('button', {
                class: 'btn primary', type: 'button', onclick: async () => {
                  try {
                    const o = await post('chats/open', { user_id: r.user.id });
                    S.chats.set(o.chat.id, o.chat);
                    close();
                    location.hash = '#/c/' + o.chat.id;
                  } catch (err) { fail(err); }
                },
              }, icon('chat'), 'Message')));
          } else {
            const invite = `Join me on ${S.config.app_name}: ${location.origin}${location.pathname}`;
            result.replaceChildren(h('div', { class: 'invite' },
              h('p', {}, h('strong', { text: r.phone }), ' isn\'t on ' + S.config.app_name + ' yet.'),
              h('button', {
                class: 'btn', type: 'button', onclick: async () => {
                  if (navigator.share) { try { await navigator.share({ text: invite }); return; } catch { /* cancelled */ } }
                  copyText(invite);
                },
              }, icon('share'), 'Invite them')));
          }
        } catch (err) { fail(err); }
        busy(btn, false);
      },
    },
    h('p', { class: 'muted', text: 'Enter the mobile number of the person or business you want to chat with.' }),
    h('div', { class: 'row-gap' }, pf.el, btn), result);
    close = modal('New chat', form);
  }

  function openProfile() {
    let close = null;
    const body = h('div', { class: 'stack' },
      h('div', { class: 'person big' }, avatar(S.me, 'xl'), h('div', { class: 'grow' }, h('strong', { text: S.me.display_name }), h('small', { class: 'muted', text: S.me.phone }))),
      profileForm(() => { close(); renderShell(); route(); toast('Profile saved'); }),
      h('div', { class: 'row-between' },
        h('button', {
          class: 'btn', onclick: async () => {
            try { await post('auth/logout'); } catch { /* ignore */ }
            close(); signedOut();
          },
        }, icon('logout'), 'Log out'),
        h('button', { class: 'btn link danger', text: 'Delete account', onclick: () => { close(); openDeleteAccount(); } })));
    close = modal('Your profile', body);
  }

  function openDeleteAccount() {
    const input = h('input', { placeholder: 'Type DELETE', autocomplete: 'off' });
    const btn = h('button', { class: 'btn danger-fill', type: 'submit', text: 'Delete my account' });
    let close = null;
    close = modal('Delete account', h('form', {
      class: 'stack', onsubmit: async (e) => {
        e.preventDefault();
        busy(btn, true, 'Deleting…');
        try { await post('profile/delete', { confirm: input.value.trim() }); close(); signedOut(); toast('Your account was deleted'); }
        catch (err) { fail(err); busy(btn, false); }
      },
    },
    h('p', { text: 'This removes your profile, your mini-site and its files, and signs you out. Messages you already sent stay in the other person\'s chat.' }),
    input, btn));
  }

  function openPeerInfo(chat) {
    let close = null;
    const p = chat.peer;
    close = modal('Contact info', h('div', { class: 'stack' },
      h('div', { class: 'person big' }, avatar(p, 'xl'), h('div', { class: 'grow' }, h('strong', { text: p.display_name }),
        p.business_name && p.name ? h('small', { class: 'muted', text: p.name }) : null, h('small', { class: 'muted', text: p.phone }))),
      p.about ? h('p', { text: p.about }) : null,
      p.site ? h('div', { class: 'row-gap' },
        h('a', { class: 'btn primary', href: '#/c/' + chat.id + '/site', onclick: () => close() }, icon('globe'), 'Open website'),
        h('button', { class: 'btn', onclick: () => copyText(location.origin + p.site.url) }, icon('copy'), 'Copy link')) : null,
      h('button', { class: 'btn ' + (chat.blocked ? '' : 'danger'), onclick: () => { close(); setBlocked(chat, !chat.blocked); } },
        icon('block'), chat.blocked ? 'Unblock ' + p.display_name : 'Block ' + p.display_name)));
  }

  async function setBlocked(chat, block) {
    if (block && !confirm(`Block ${chat.peer.display_name}? They won't be able to message you.`)) return;
    try {
      const r = await post(block ? 'chats/block' : 'chats/unblock', { chat: chat.id });
      Object.assign(chat, r.chat);
      updateChatHeader(chat);
      renderChatList();
      toast(block ? 'Contact blocked' : 'Contact unblocked');
    } catch (e) { fail(e); }
  }

  // ---------------------------------------------------------------- mini-site editor
  async function openSiteEditor() {
    setMain(h('div', { class: 'editor loading' }, h('p', { class: 'muted', text: 'Loading your site…' })));
    try {
      const r = await api('site');
      S.site = r.site;
      S.draft = JSON.parse(JSON.stringify(r.site));
      S.draft.dirty = false;
      if (!S.draft.data.items) S.draft.data.items = [];
      if (!S.draft.data.links) S.draft.data.links = [];
      setMain(editorView());
      refreshPreview(true);
    } catch (e) { fail(e); }
  }

  const tplMeta = (id) => S.config.templates.find((t) => t.id === id) || S.config.templates[0];

  function editorView() {
    const d = S.draft;
    const saveBtn = h('button', { class: 'btn primary', onclick: saveSite, text: 'Save' });
    const status = h('span', { class: 'pill ' + (S.site.live ? 'live' : '') , text: S.site.live ? 'Published' : 'Draft' });
    const view = h('section', { class: 'editor' },
      h('header', { class: 'editor-head' },
        h('a', { class: 'icon-btn back', href: '#/', 'aria-label': 'Back' }, icon('back')),
        h('div', { class: 'grow' }, h('h2', { text: 'My mini-site' }), status),
        h('div', { class: 'seg mobile-only' },
          h('button', { class: 'on', dataset: { pane: 'form' }, onclick: segSwitch }, icon('edit'), 'Edit'),
          h('button', { dataset: { pane: 'preview' }, onclick: segSwitch }, icon('eye'), 'Preview')),
        saveBtn),
      h('div', { class: 'editor-body' },
        h('div', { class: 'editor-form' }, editorForm()),
        h('div', { class: 'editor-preview' },
          h('div', { class: 'device' }, h('iframe', {
            class: 'preview-frame', title: 'Preview',
            sandbox: 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals',
            referrerpolicy: 'no-referrer',
          })),
          h('p', { class: 'fine center', text: 'Live preview — this is what customers see in the Website tab of your chat.' }))));
    view.addEventListener('input', () => markDirty());
    function segSwitch(e) {
      const pane = e.currentTarget.dataset.pane;
      view.classList.toggle('show-preview', pane === 'preview');
      view.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.pane === pane));
      if (pane === 'preview') refreshPreview(true);
    }
    d.saveBtn = saveBtn;
    return view;
  }

  function markDirty() {
    S.draft.dirty = true;
    if (S.draft.saveBtn) S.draft.saveBtn.textContent = 'Save changes';
    refreshPreview();
  }

  function field(label, input, hint) {
    return h('label', { class: 'field' }, h('span', { text: label }), input, hint ? h('small', { text: hint }) : null);
  }
  function bindText(obj, key, opts = {}) {
    const el = opts.multiline
      ? h('textarea', { rows: opts.rows || 3, maxlength: opts.max, placeholder: opts.placeholder || '', value: obj[key] || '' })
      : h('input', { type: opts.type || 'text', maxlength: opts.max, placeholder: opts.placeholder || '', value: obj[key] || '' });
    el.addEventListener('input', () => { obj[key] = el.value; });
    return el;
  }

  function editorForm() {
    const d = S.draft;
    const wrap = h('div', { class: 'form-inner' });
    const rerender = () => { wrap.replaceChildren(...editorSections()); };
    function editorSections() {
      const modeTabs = h('div', { class: 'mode-tabs' },
        h('button', { class: d.mode === 'template' ? 'on' : '', onclick: () => { d.mode = 'template'; markDirty(); rerender(); refreshPreview(true); } },
          icon('layout'), h('span', {}, h('strong', { text: 'Use a template' }), h('small', { text: 'Fill in a form. Easiest.' }))),
        h('button', { class: d.mode === 'custom' ? 'on' : '', onclick: () => { d.mode = 'custom'; markDirty(); rerender(); refreshPreview(true); } },
          icon('code'), h('span', {}, h('strong', { text: 'Use my own code' }), h('small', { text: 'Paste from ChatGPT, Claude… or upload' }))));
      return d.mode === 'custom' ? [modeTabs, customSection(), publishCard()] : [modeTabs, publishCard(), templateSections(rerender)];
    }
    rerender();
    return wrap;
  }

  function publishCard() {
    const d = S.draft;
    const origin = location.origin + location.pathname.replace(/[^/]*$/, '');
    const slug = h('input', { value: d.slug, maxlength: 40, 'aria-label': 'Site address', spellcheck: 'false', autocapitalize: 'off' });
    const msg = h('small', { class: 'slug-msg' });
    let t = null;
    slug.addEventListener('input', () => {
      slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-');
      d.slug = slug.value;
      clearTimeout(t);
      t = setTimeout(async () => {
        try {
          const r = await api('site/check-slug', { query: { slug: d.slug } });
          msg.textContent = r.ok ? '✓ Available' : r.error;
          msg.className = 'slug-msg ' + (r.ok ? 'ok' : 'bad');
        } catch { /* ignore */ }
      }, 350);
    });
    const pub = h('input', { type: 'checkbox', checked: d.published, role: 'switch' });
    pub.addEventListener('change', () => { d.published = pub.checked; markDirty(); });
    const url = origin + 's/' + S.site.slug + '/';
    return h('div', { class: 'card' },
      h('label', { class: 'switch-row' }, h('span', {}, h('strong', { text: 'Publish my site' }),
        h('small', { text: 'When on, a Website tab appears in every chat with you, and the link works for anyone.' })), pub, h('i', { class: 'switch' })),
      h('label', { class: 'field' }, h('span', { text: 'Site address' }),
        h('div', { class: 'prefixed' }, h('span', { class: 'prefix', text: origin.replace(/^https?:\/\//, '') + 's/' }), slug), msg),
      S.site.live ? h('div', { class: 'row-gap' },
        h('a', { class: 'btn small', href: url, target: '_blank', rel: 'noopener' }, icon('external'), 'Open'),
        h('button', { class: 'btn small', onclick: () => copyText(url) }, icon('copy'), 'Copy link'),
        navigator.share ? h('button', { class: 'btn small', onclick: () => navigator.share({ url, title: (S.site.data && S.site.data.title) || '' }).catch(() => {}) }, icon('share'), 'Share') : null) : null);
  }

  function imagePicker(label, obj, key, rerender, square = false) {
    const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', hidden: true });
    input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      if (f.size > S.config.limits.image_mb * 1024 * 1024) return toast(`Images can be up to ${S.config.limits.image_mb} MB`, 'bad');
      const fd = new FormData(); fd.append('file', f);
      toast('Uploading image…');
      try {
        const r = await api('site/image', { method: 'POST', form: fd });
        obj[key] = r.path; markDirty(); rerender(); refreshPreview(true);
      } catch (e) { fail(e); }
    });
    const src = obj[key] ? S.site.url + obj[key] : '';
    return h('div', { class: 'img-pick' + (square ? ' square' : '') },
      src ? h('img', { src, alt: '' }) : h('span', { class: 'img-ph' }, icon('image')),
      h('div', { class: 'grow' }, h('strong', { text: label }),
        h('div', { class: 'row-gap' },
          h('button', { class: 'btn small', type: 'button', onclick: () => input.click() }, icon('upload'), src ? 'Change' : 'Upload'),
          src ? h('button', { class: 'btn small link danger', type: 'button', text: 'Remove', onclick: () => { obj[key] = ''; markDirty(); rerender(); refreshPreview(true); } }) : null)),
      input);
  }

  function templateSections(rerender) {
    const d = S.draft, data = d.data, meta = tplMeta(d.template);
    const accent = h('input', { type: 'color', value: data.accent || meta.accent, 'aria-label': 'Brand colour' });
    accent.addEventListener('input', () => { data.accent = accent.value; });
    const showPhone = h('input', { type: 'checkbox', checked: data.show_phone !== false });
    showPhone.addEventListener('change', () => { data.show_phone = showPhone.checked; markDirty(); });

    const items = h('div', { class: 'items' }, data.items.map((it, i) => itemCard(it, i, rerender, d.template)));
    const links = h('div', { class: 'links' }, data.links.map((ln, i) => h('div', { class: 'link-row' },
      bindText(ln, 'label', { max: 60, placeholder: 'Label, e.g. Instagram' }),
      bindText(ln, 'url', { max: 300, placeholder: 'https://…', type: 'url' }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove link', onclick: () => { data.links.splice(i, 1); markDirty(); rerender(); } }, icon('trash')))));

    return h('div', { class: 'sections' },
      h('div', { class: 'card' }, h('h3', { text: 'Template' }),
        h('div', { class: 'tpl-grid' }, S.config.templates.map((t) => h('button', {
          class: 'tpl' + (t.id === d.template ? ' on' : ''), type: 'button',
          onclick: () => {
            const oldMeta = tplMeta(d.template);
            d.template = t.id;
            if (!data.accent || data.accent === oldMeta.accent) data.accent = t.accent;
            markDirty(); rerender(); refreshPreview(true);
          },
        }, h('span', { class: 'tpl-swatch', style: `--c:${t.accent}` }, h('i'), h('i'), h('i')), h('strong', { text: t.name }))))),
      h('div', { class: 'card' }, h('h3', { text: 'Basics' }),
        field('Title', bindText(data, 'title', { max: 80, placeholder: 'Your business name' })),
        field('Tagline', bindText(data, 'tagline', { max: 140, placeholder: 'One line about what you offer' })),
        field('About', bindText(data, 'about', { max: 1500, multiline: true, rows: 4, placeholder: 'Tell customers your story, delivery areas, payment options…' })),
        h('div', { class: 'two' },
          h('label', { class: 'field' }, h('span', { text: 'Brand colour' }), accent),
          h('label', { class: 'switch-row compact' }, h('span', {}, h('strong', { text: 'Show my phone number' })), showPhone, h('i', { class: 'switch' }))),
        imagePicker('Logo', data, 'logo', rerender, true),
        d.template !== 'links' ? imagePicker('Cover photo', data, 'cover', rerender) : null),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', { text: meta.items }), h('small', { class: 'muted', text: `${data.items.length} / 100` })),
        h('p', { class: 'fine', text: `Each one gets a button that starts a chat with you: "${meta.cta}: …"` }),
        items,
        h('button', {
          class: 'btn block', type: 'button', disabled: data.items.length >= 100,
          onclick: () => { data.items.push({ name: '', price: '', description: '', image: '', category: '' }); markDirty(); rerender(); setTimeout(() => { const l = $$('.item-card input'); const n = l[l.length - 4] || l[l.length - 1]; if (n) n.focus(); }, 30); },
        }, icon('plus'), 'Add ' + meta.items.toLowerCase().replace(/s$/, ''))),
      h('div', { class: 'card' }, h('h3', { text: 'Contact & hours' }),
        field('Opening hours', bindText(data, 'hours', { max: 300, multiline: true, rows: 2, placeholder: 'Mon–Sat 9am – 8pm' })),
        field('Address', bindText(data, 'address', { max: 200, multiline: true, rows: 2, placeholder: 'Shop 4, Main Market, City' }))),
      h('div', { class: 'card' }, h('h3', { text: 'Links' }),
        h('p', { class: 'fine', text: 'Instagram, Facebook, TikTok, your other website…' }),
        links,
        h('button', { class: 'btn block', type: 'button', disabled: data.links.length >= 20, onclick: () => { data.links.push({ label: '', url: '' }); rerender(); } }, icon('plus'), 'Add link')));
  }

  function itemCard(it, i, rerender, template) {
    const data = S.draft.data;
    const move = (dir) => { const j = i + dir; if (j < 0 || j >= data.items.length) return; [data.items[i], data.items[j]] = [data.items[j], data.items[i]]; markDirty(); rerender(); };
    return h('div', { class: 'item-card' },
      h('div', { class: 'item-top' },
        imagePicker('', it, 'image', rerender, true),
        h('div', { class: 'item-actions' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(-1) }, icon('up')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move down', disabled: i === data.items.length - 1, onclick: () => move(1) }, icon('down')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete', onclick: () => { data.items.splice(i, 1); markDirty(); rerender(); } }, icon('trash')))),
      h('div', { class: 'two' },
        field('Name', bindText(it, 'name', { max: 80, placeholder: 'e.g. Chocolate cake' })),
        field('Price', bindText(it, 'price', { max: 30, placeholder: 'e.g. Rs 1,200' }))),
      template === 'menu' ? field('Category', bindText(it, 'category', { max: 40, placeholder: 'e.g. Starters, Mains, Drinks' })) : null,
      field('Description', bindText(it, 'description', { max: 400, multiline: true, rows: 2, placeholder: 'Size, ingredients, duration…' })));
  }

  function aiPrompt() {
    const name = (S.me && (S.me.business_name || S.me.name)) || 'my business';
    return [
      `Make a complete, beautiful, mobile-friendly one-page website for my business "${name}".`,
      '',
      'About us: [what you sell or do, your city, what makes you special]',
      'Products or services with prices:',
      '- [item] – [price]',
      '- [item] – [price]',
      'Opening hours: [hours]',
      'Address: [address]',
      'Style and colours: [for example: warm and friendly, green and white]',
      '',
      'Technical rules (important):',
      '1. Give me ONE single HTML file with all the CSS and JavaScript inside it. Start with <!DOCTYPE html>.',
      '2. Every "Order", "Book", "Buy" or "Contact" button must run ChatSite.compose("Hi! I\'d like to order: ITEM (PRICE)") when clicked, using the real item name and price. Do not use forms that send data to a server.',
      '3. Do not use logins, databases, localStorage or cookies. For pictures use emoji, icons or CSS gradients.',
      '4. Reply with only the code, no explanation.',
    ].join('\n');
  }

  function applySavedSite(site) {
    S.site = site;
    S.draft = JSON.parse(JSON.stringify(site));
    S.draft.dirty = false;
    if (!S.draft.data.items) S.draft.data.items = [];
    if (!S.draft.data.links) S.draft.data.links = [];
    setMain(editorView());
    refreshPreview(true);
  }

  function customSection() {
    const liveUrl = location.origin + S.site.url;
    const code = h('textarea', {
      class: 'code-box', rows: 12, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', 'aria-label': 'Website code',
      placeholder: '<!DOCTYPE html>\n<html>\n  … paste the code from ChatGPT, Claude, Gemini …\n</html>',
    });
    if (S.site.custom_files) api('site/code').then((r) => { if (!code.value && r.html) code.value = r.html; }).catch(() => {});

    const publishBtn = h('button', { class: 'btn primary', type: 'button' }, icon('upload'), 'Publish my site');
    publishBtn.addEventListener('click', async () => {
      if (!code.value.trim()) { code.focus(); toast('Paste your website code first', 'bad'); return; }
      if (S.site.custom_files > 1 && !confirm('Publishing pasted code replaces the files you uploaded before. Continue?')) return;
      busy(publishBtn, true, 'Publishing…');
      try {
        const r = await post('site/paste', { code: code.value, publish: true });
        applySavedSite(r.site);
        toast('Your site is live 🎉');
      } catch (e) { busy(publishBtn, false); fail(e); }
    });

    const input = h('input', { type: 'file', accept: '.zip,.html,.htm,application/zip,text/html', hidden: true });
    const drop = h('div', { class: 'drop', tabindex: 0, role: 'button', onclick: () => input.click(), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } } },
      icon('upload'), h('strong', { text: 'Choose a file' }),
      h('small', { text: `A .zip with index.html at the top, or a single .html file · up to ${S.config.limits.custom_upload_mb} MB` }));
    const upload = async (f) => {
      if (!f) return;
      if (f.size > S.config.limits.custom_upload_mb * 1024 * 1024) { toast(`Uploads can be up to ${S.config.limits.custom_upload_mb} MB`, 'bad'); return; }
      const fd = new FormData(); fd.append('file', f);
      drop.classList.add('busy');
      try {
        const r = await api('site/upload', { method: 'POST', form: fd });
        applySavedSite(r.site);
        toast(`Uploaded ${r.site.custom_files} file${r.site.custom_files === 1 ? '' : 's'}. Switch on "Publish my site" and save to go live.`);
      } catch (e) { fail(e); drop.classList.remove('busy'); }
    };
    input.addEventListener('change', () => upload(input.files[0]));
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); upload(e.dataTransfer.files[0]); });

    const step = (n, title) => h('div', { class: 'step' }, h('span', { class: 'step-n', text: n }), h('h3', { text: title }));
    return h('div', { class: 'sections' },
      h('div', { class: 'card' },
        step('1', 'Get your code from AI'),
        h('p', { class: 'fine', text: 'No coding needed. Copy this prompt into ChatGPT, Claude, Gemini or any AI chat, fill in the [brackets], and it writes your website for you.' }),
        h('pre', { class: 'prompt-box', text: aiPrompt() }),
        h('div', { class: 'row-gap' }, h('button', { class: 'btn', type: 'button', onclick: () => copyText(aiPrompt()) }, icon('copy'), 'Copy prompt'))),
      h('div', { class: 'card' },
        step('2', 'Paste it and publish'),
        h('p', { class: 'fine', text: "Paste the AI's answer here. It's fine if it includes extra words; we keep just the code." }),
        code,
        h('div', { class: 'row-between' },
          h('small', { class: 'muted url-note', text: 'Goes live at ' + liveUrl.replace(/^https?:\/\//, '') }),
          publishBtn),
        S.site.custom_files
          ? h('p', { class: 'ok-line' }, icon('check'), (S.site.live ? 'Live · ' : 'Saved · ') + `updated ${listTime(S.site.custom_at).toLowerCase()}`)
          : null),
      h('div', { class: 'card' },
        h('details', {},
          h('summary', { text: 'Or upload files (.zip or .html)' }),
          h('div', { class: 'stack' }, drop, input,
            S.site.custom_files ? h('button', {
              class: 'btn small link danger', type: 'button', text: 'Remove my code and go back to templates',
              onclick: async () => {
                if (!confirm('Delete your website code?')) return;
                try { applySavedSite((await post('site/remove-custom')).site); } catch (e) { fail(e); }
              },
            }) : null))),
      h('div', { class: 'card' }, h('h3', { text: 'Notes for developers' }),
        h('ul', { class: 'notes' },
          h('li', {}, 'Any HTML, CSS and JavaScript works, including libraries from CDNs. Server code (PHP etc.) does not run.'),
          h('li', {}, 'For several pages or your own images, upload a .zip with ', h('code', { text: 'index.html' }), ' at the top and use relative links (', h('code', { text: 'css/style.css' }), ').'),
          h('li', {}, 'Let visitors message you from any button: ', h('code', { text: 'ChatSite.compose("I want to order …")' }), '.'),
          h('li', {}, 'Sites run in a secure sandbox: localStorage and cookies work only until the page is closed.'))));
  }

  let previewTimer = null, previewSeq = 0;
  function refreshPreview(now = false) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      const frame = $('.preview-frame');
      if (!frame || !S.draft) return;
      const seq = ++previewSeq;
      if (S.draft.mode === 'custom') {
        frame.removeAttribute('srcdoc');
        const src = S.site.preview_url || '';
        if (!src) {
          frame.srcdoc = '<!doctype html><meta charset="utf-8"><body style="font:15px system-ui;display:grid;place-items:center;height:90vh;color:#888;text-align:center;padding:20px">Paste your code and publish to see it here.</body>';
        } else if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
        return;
      }
      try {
        const r = await post('site/preview', { template: S.draft.template, data: S.draft.data });
        if (seq !== previewSeq) return;
        frame.removeAttribute('src');
        frame.srcdoc = r.html;
      } catch (e) {
        if (e.status === 401) fail(e);
      }
    }, now ? 0 : 450);
  }

  async function saveSite() {
    const d = S.draft;
    const btn = d.saveBtn;
    busy(btn, true, 'Saving…');
    try {
      const r = await post('site/save', { slug: d.slug, mode: d.mode, template: d.template, published: d.published, data: d.data });
      applySavedSite(r.site);
      toast(r.site.live ? 'Saved — your site is live' : 'Saved as draft');
    } catch (e) {
      busy(btn, false);
      fail(e);
    }
  }

  window.addEventListener('beforeunload', (e) => { if (S.draft && S.draft.dirty && $('.editor')) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------------------------------------------------------- boot
  window.addEventListener('hashchange', () => {
    if (S.draft && S.draft.dirty && !location.hash.startsWith('#/site') && $('.editor')) {
      if (!confirm('You have unsaved changes to your mini-site. Leave without saving?')) { history.replaceState(null, '', '#/site'); return; }
      S.draft.dirty = false;
    }
    if (!S.me) {
      if (location.hash.startsWith('#/to/')) { try { sessionStorage.setItem('chatsite_link', location.hash); } catch { /* ignore */ } }
      return;
    }
    route();
  });

  async function boot() {
    try {
      const r = await api('auth/me');
      S.config = r.config;
      S.me = r.user;
      if (!S.me) {
        if (location.hash.startsWith('#/to/')) { try { sessionStorage.setItem('chatsite_link', location.hash); } catch { /* ignore */ } }
        renderLogin();
      } else afterSignIn();
    } catch (e) {
      screen(h('div', { class: 'auth' }, h('div', { class: 'auth-card' },
        h('h2', { text: "Can't reach the server" }), h('p', { class: 'muted', text: e.message }),
        h('button', { class: 'btn primary block', text: 'Try again', onclick: () => location.reload() }))));
    }
  }
  boot();
})();
