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
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    clip: '<path d="m21 11.5-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v6"/>',
    forward: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0-5 5v6"/>',
    pin: '<path d="M9 4h6l-1 6 4 3H6l4-3-1-6z"/><path d="M12 13v7"/>',
    mute: '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="m22 9-6 6M16 9l6 6"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
    camera: '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    location: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
    pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
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
    useq: 0, typing: new Map(), info: new Map(), players: new Map(), nodeCache: new Map(),
    showArchived: false, reply: null, editing: null, unreadMarker: null, recording: null, newBelow: 0,
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
  function avatar(who, size = '') {
    const cls = 'avatar ' + size;
    if (who && who.avatar) return h('span', { class: cls + ' photo', 'aria-hidden': 'true' }, h('img', { src: who.avatar, alt: '', loading: 'lazy' }));
    const color = COLORS[((who && who.id) || 0) % COLORS.length];
    if (who && who.type === 'group') return h('span', { class: cls + ' group', style: `--av:${color}`, 'aria-hidden': 'true' }, icon('users'));
    const name = (who && (who.display_name || who.name || who.phone)) || '?';
    const letters = name.replace(/^\+/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join('').toUpperCase() || '?';
    return h('span', { class: cls, style: `--av:${color}`, 'aria-hidden': 'true' }, letters);
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
    S.players.forEach((p) => p.audio.pause());
    S.me = null; S.chats.clear(); S.msgs.clear(); S.lastId = 0; S.rsince = 0; S.useq = 0; S.activeId = null;
    S.typing = new Map(); S.info.clear(); S.players.clear(); S.nodeCache.clear(); S.reply = null; S.editing = null;
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

  // ---------------------------------------------------------------- chat helpers
  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const EMOJI = {
    Smileys: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😋 😛 😜 🤪 😎 🤩 🥳 😏 😒 😔 😟 😕 🙁 😣 😫 😩 🥺 😢 😭 😤 😠 😡 🤯 😳 🥵 😱 😨 😥 😓 🤗 🤔 🤭 🤫 😶 😐 😑 😬 🙄 😯 😮 😲 🥱 😴 🤤 😵 🤐 🥴 🤢 🤧 😷 🤒',
    Gestures: '👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🖐️ 👋 🤝 🙏 👏 🙌 👐 🤲 💪 ✍️ 👀 🫶',
    Hearts: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 ⭐ 🌟 ✨ 🔥 💯 ✅ ❌ ⚠️ 🎉 🎊 🎁',
    Food: '☕ 🍵 🥤 🧃 🍰 🎂 🧁 🍩 🍪 🥐 🍞 🧀 🍳 🥞 🍔 🍟 🍕 🌭 🥪 🌮 🍗 🍖 🍛 🍜 🍲 🍝 🍣 🍱 🥗 🍎 🍌 🍉 🍇 🍓 🥭 🍍',
    Shop: '🛍️ 🛒 💳 💰 💵 📦 🚚 🛵 🏪 🏠 📱 💻 📷 🎁 👗 👕 👟 👜 💄 💍 ⌚ 🕐 📅 📍 ✂️ 💇 💅 🌹 🌸 🌺 🌻',
  };
  const NAME_COLORS = ['#c2410c', '#0f766e', '#7c3aed', '#be185d', '#0369a1', '#15803d', '#b45309', '#4338ca', '#9d174d', '#0e7490'];
  const nameColor = (id) => NAME_COLORS[(id || 0) % NAME_COLORS.length];
  const nowSec = () => Math.floor(Date.now() / 1000);
  const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + pad(s % 60); };
  const fmtSize = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : (b || 0) + ' B';
  const firstName = (n) => String(n || '').split(/\s+/)[0];

  function chatAvatar(c, size = '') {
    if (!c) return avatar(null, size);
    if (c.type === 'group') return avatar({ id: c.id, type: 'group', avatar: c.avatar, display_name: c.title }, size);
    return avatar(c.peer || { id: c.id, display_name: c.title, avatar: c.avatar }, size);
  }

  function previewOf(m) {
    if (m.deleted) return 'This message was deleted';
    if (m.kind === 'system') return m.text || '';
    const md = m.media || {};
    switch (m.kind) {
      case 'image': return '📷 ' + (m.body || 'Photo');
      case 'video': return '🎥 ' + (m.body || 'Video');
      case 'voice': return '🎤 Voice message (' + fmtDur(md.dur) + ')';
      case 'file': return '📄 ' + (md.name || 'Document');
      case 'location': return '📍 Location';
      default: return m.body || '';
    }
  }

  function statusOf(chat, m) {
    if (m.failed) return 'failed';
    if (m.pending || m.id < 0) return 'pending';
    if (chat.peer_read_id >= m.id) return 'read';
    if (chat.peer_delivered_id >= m.id) return 'delivered';
    return 'sent';
  }
  function tickIcon(chat, msgId) {
    const st = statusOf(chat, { id: msgId });
    if (st === 'pending') return icon('clock', 'tick pending');
    if (st === 'read') return icon('dcheck', 'tick read');
    if (st === 'delivered') return icon('dcheck', 'tick');
    return icon('check', 'tick');
  }

  function typingOf(chatId) {
    const list = (S.typing.get(chatId) || []).filter((t) => t.until > Date.now());
    return list.length ? list : null;
  }
  function typingText(chat, list) {
    if (chat.type !== 'group') return 'typing…';
    return list.length > 1 ? `${list.length} people are typing…` : `${firstName(list[0].name)} is typing…`;
  }

  // Menus: a popover on desktop, a bottom sheet on phones.
  function closeMenus() { document.querySelectorAll('.popmenu, .pm-backdrop').forEach((n) => n.remove()); }
  function popMenu(anchor, items, extra) {
    closeMenus();
    const sheet = window.innerWidth < 600;
    const menu = h('div', { class: 'popmenu' + (sheet ? ' sheet' : ''), role: 'menu' }, extra || null,
      items.filter(Boolean).map((it) => h('button', {
        class: 'pm-item' + (it.danger ? ' danger' : ''), role: 'menuitem', type: 'button',
        onclick: () => { closeMenus(); it.run(); },
      }, it.icon ? icon(it.icon) : null, h('span', { text: it.label }))));
    const backdrop = h('div', { class: 'pm-backdrop' + (sheet ? ' dim' : ''), onclick: closeMenus });
    document.body.append(backdrop, menu);
    if (!sheet) {
      const r = anchor instanceof Event
        ? { left: anchor.clientX, right: anchor.clientX, top: anchor.clientY, bottom: anchor.clientY }
        : anchor.getBoundingClientRect();
      const mw = menu.offsetWidth, mh = menu.offsetHeight;
      let left = Math.min(r.left, window.innerWidth - mw - 8);
      let top = r.bottom + 4;
      if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
      menu.style.left = Math.max(8, left) + 'px';
      menu.style.top = top + 'px';
    }
    const first = menu.querySelector('button');
    if (first && !sheet) first.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === 'Escape') { closeMenus(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
  }

  function onLongPress(el, fn) {
    let t = null, sx = 0, sy = 0, fired = false;
    el.addEventListener('touchstart', (e) => {
      const p = e.touches[0]; sx = p.clientX; sy = p.clientY; fired = false;
      t = setTimeout(() => { t = null; fired = true; if (navigator.vibrate) navigator.vibrate(12); fn(el); }, 450);
    }, { passive: true });
    const cancel = () => { clearTimeout(t); t = null; };
    el.addEventListener('touchmove', (e) => { const p = e.touches[0]; if (Math.abs(p.clientX - sx) > 10 || Math.abs(p.clientY - sy) > 10) cancel(); }, { passive: true });
    el.addEventListener('touchend', (e) => { cancel(); if (fired) { e.preventDefault(); fired = false; } });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!fired && !t) fn(e); });
  }

  function emojiPicker(anchor, onPick) {
    closeMenus();
    const grid = h('div', { class: 'emoji-grid' });
    const tabs = h('div', { class: 'emoji-tabs' });
    const show = (cat) => {
      grid.replaceChildren(...EMOJI[cat].split(' ').map((e) => h('button', { type: 'button', class: 'emoji-btn', text: e, onclick: () => onPick(e) })));
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
    };
    Object.keys(EMOJI).forEach((cat) => tabs.append(h('button', { type: 'button', dataset: { cat }, text: EMOJI[cat].split(' ')[0], 'aria-label': cat, onclick: () => show(cat) })));
    show('Smileys');
    popMenu(anchor, [], h('div', { class: 'emoji-picker' }, tabs, grid));
  }

  function insertAtCursor(ta, text) {
    const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.dispatchEvent(new Event('input'));
    ta.focus();
  }

  function xhrUpload(route, form, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', 'api.php?r=' + route);
      x.setRequestHeader('X-CSRF-Token', S.csrf);
      x.setRequestHeader('Accept', 'application/json');
      x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      x.onload = () => {
        let d = null;
        try { d = JSON.parse(x.responseText); } catch { /* not JSON */ }
        if (x.status >= 200 && x.status < 300) resolve(d);
        else reject(Object.assign(new Error((d && d.error) || `Upload failed (${x.status})`), { status: x.status }));
      };
      x.onerror = () => reject(Object.assign(new Error("You're offline. Check your connection."), { status: 0 }));
      x.send(form);
    });
  }

  // Sound + system notifications for new messages.
  let audioCtx = null, lastDing = 0;
  document.addEventListener('pointerdown', () => { if (!audioCtx && window.AudioContext) { try { audioCtx = new AudioContext(); } catch { /* no audio */ } } }, { once: true });
  function ding() {
    if (!audioCtx || Date.now() - lastDing < 1500) return;
    lastDing = Date.now();
    try {
      const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.3);
    } catch { /* ignore */ }
  }
  async function notifyIncoming(m) {
    const chat = S.chats.get(m.chat);
    if (!chat || chat.muted || m.sender === S.me.id || m.kind === 'system') return;
    const looking = document.visibilityState === 'visible' && S.activeId === m.chat && S.tab === 'chat';
    if (!looking) ding();
    if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const title = chat.type === 'group' ? `${firstName(m.sender_name)} @ ${chat.title}` : chat.title;
    const opts = { body: previewOf(m), icon: 'assets/icon-192.png', tag: 'chat-' + m.chat, data: { chat: m.chat } };
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) { reg.showNotification(title, opts); return; }
      const n = new Notification(title, opts);
      n.onclick = () => { window.focus(); location.hash = '#/c/' + m.chat; n.close(); };
    } catch { /* not supported */ }
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'open-chat') location.hash = '#/c/' + e.data.chat; });
  }
  function notifyBanner() {
    let dismissed = false;
    try { dismissed = localStorage.getItem('chatsite_notify_dismissed') === '1'; } catch { /* ignore */ }
    if (dismissed || !('Notification' in window) || Notification.permission !== 'default') return null;
    const el = h('div', { class: 'notify-banner' }, icon('bell'),
      h('span', { class: 'grow' }, h('strong', { text: 'Turn on notifications' }), h('small', { text: 'Know when someone messages you.' })),
      h('button', {
        class: 'btn small primary', type: 'button', text: 'Turn on',
        onclick: async () => {
          try { await Notification.requestPermission(); } catch { /* ignore */ }
          if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
          el.remove();
        },
      }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Dismiss', onclick: () => { try { localStorage.setItem('chatsite_notify_dismissed', '1'); } catch { /* ignore */ } el.remove(); } }, icon('close')));
    return el;
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
          h('button', { class: 'icon-btn', title: 'New group', 'aria-label': 'New group', onclick: () => openNewChat('group') }, icon('users')),
          h('button', { class: 'icon-btn', title: 'New chat', 'aria-label': 'New chat', onclick: () => openNewChat('chat') }, icon('plus'))),
        notifyBanner(),
        h('div', { class: 'search' }, icon('search'), search),
        h('div', { class: 'chat-list', role: 'list' }),
        h('button', { class: 'site-promo', onclick: () => { location.hash = '#/site'; } },
          icon('store'), h('span', {}, h('strong', { text: 'Your mini-site' }), h('small', { text: 'Show customers your products right inside the chat' })))),
      h('main', { class: 'main' })));
    if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') navigator.serviceWorker.register('sw.js').catch(() => {});
    renderChatList();
  }

  function sortChats(list) {
    return list.sort((a, b) => (b.pinned_at - a.pinned_at) || (b.updated_at - a.updated_at) || (b.id - a.id));
  }

  function renderChatList() {
    const box = $('.chat-list');
    if (!box) return;
    const q = (($('.search input') || {}).value || '').trim().toLowerCase();
    const all = [...S.chats.values()];
    const nodes = [];
    let list;
    if (q) {
      list = sortChats(all.filter((c) => [c.title, c.peer && c.peer.phone, c.last && c.last.text].join(' ').toLowerCase().includes(q)));
    } else if (S.showArchived) {
      list = sortChats(all.filter((c) => c.archived));
      nodes.push(h('button', { class: 'archived-row head', type: 'button', onclick: () => { S.showArchived = false; renderChatList(); } }, icon('back'), h('strong', { text: 'Archived' })));
    } else {
      list = sortChats(all.filter((c) => !c.archived));
      const arch = all.filter((c) => c.archived);
      if (arch.length) {
        const unread = arch.filter((c) => c.unread && !c.muted).length;
        nodes.push(h('button', { class: 'archived-row', type: 'button', onclick: () => { S.showArchived = true; renderChatList(); } },
          icon('archive'), h('span', { class: 'grow', text: 'Archived' }), unread ? h('span', { class: 'ci-count', text: unread }) : null));
      }
    }
    if (!list.length && !nodes.length) {
      nodes.push(h('div', { class: 'list-empty' },
        S.chats.size ? 'No chats match your search.' : h('div', {},
          h('p', { text: 'No chats yet.' }),
          h('button', { class: 'btn primary', onclick: () => openNewChat('chat') }, icon('plus'), 'Start a chat'))));
    }
    for (const c of list) nodes.push(chatItem(c));
    box.replaceChildren(...nodes);
    const total = all.filter((c) => !c.muted).reduce((n, c) => n + (c.unread || 0), 0);
    document.title = (total ? `(${total}) ` : '') + S.config.app_name;
  }

  function chatItem(c) {
    const typing = typingOf(c.id);
    let preview;
    if (typing) {
      preview = h('span', { class: 'ci-last typing', text: typingText(c, typing) });
    } else {
      const l = c.last;
      preview = h('span', { class: 'ci-last' },
        l && l.mine && !l.deleted && l.kind !== 'system' ? tickIcon(c, l.id) : null,
        l && c.type === 'group' && !l.mine && l.kind !== 'system' ? firstName(l.sender_name) + ': ' : '',
        l ? l.text : (c.blocked ? 'Blocked' : c.type === 'group' ? 'Group created' : 'Say hello 👋'));
    }
    const el = h('a', {
      class: 'chat-item' + (c.id === S.activeId ? ' active' : '') + (c.unread ? ' has-unread' : '') + (c.muted ? ' is-muted' : ''),
      href: '#/c/' + c.id, role: 'listitem', dataset: { id: c.id },
    },
    chatAvatar(c),
    h('div', { class: 'ci-main' },
      h('div', { class: 'ci-top' },
        h('span', { class: 'ci-name', text: c.title }),
        c.peer && c.peer.site ? h('span', { class: 'site-badge', title: 'Has a mini-site' }, icon('globe')) : null,
        h('span', { class: 'ci-time', text: listTime(c.last ? c.last.created_at : c.updated_at) })),
      h('div', { class: 'ci-bottom' }, preview,
        c.muted ? icon('mute', 'ci-ic') : null,
        c.pinned ? icon('pin', 'ci-ic') : null,
        c.unread ? h('span', { class: 'badge', text: c.unread > 99 ? '99+' : c.unread }) : null,
        h('button', { class: 'ci-more', type: 'button', 'aria-label': 'Chat options', onclick: (e) => { e.preventDefault(); e.stopPropagation(); chatMenu(c, e.currentTarget); } }, icon('down')))));
    onLongPress(el, (a) => chatMenu(c, a));
    return el;
  }

  function chatMenu(c, anchor) {
    popMenu(anchor, [
      !c.archived && { icon: 'pin', label: c.pinned ? 'Unpin chat' : 'Pin chat', run: () => chatSetting(c, { pinned: !c.pinned }) },
      { icon: 'mute', label: c.muted ? 'Unmute notifications' : 'Mute notifications', run: () => (c.muted ? chatSetting(c, { mute: 'off' }) : muteMenu(c, anchor)) },
      { icon: 'archive', label: c.archived ? 'Unarchive chat' : 'Archive chat', run: () => chatSetting(c, { archived: !c.archived }) },
      c.type === 'group' && c.active
        ? { icon: 'logout', label: 'Exit group', danger: true, run: () => exitGroup(c) }
        : { icon: 'trash', label: 'Delete chat', danger: true, run: () => deleteChat(c) },
    ]);
  }

  function muteMenu(c, anchor) {
    popMenu(anchor, [
      { label: 'Mute for 8 hours', run: () => chatSetting(c, { mute: '8h' }) },
      { label: 'Mute for 1 week', run: () => chatSetting(c, { mute: '1w' }) },
      { label: 'Mute always', run: () => chatSetting(c, { mute: 'always' }) },
    ]);
  }

  async function chatSetting(c, body) {
    try {
      const r = await post('chats/settings', { chat: c.id, ...body });
      S.chats.set(c.id, Object.assign(c, r.chat));
      renderChatList();
      if (S.activeId === c.id) updateChatHeader(c);
      if (body.archived === true) toast('Chat archived');
      if (body.mute && body.mute !== 'off') toast('Notifications muted');
    } catch (e) { fail(e); }
  }

  async function deleteChat(c) {
    if (!confirm(`Delete this chat with ${c.title}? Messages are removed from your phone only.`)) return;
    try {
      await post('chats/delete', { chat: c.id });
      S.chats.delete(c.id); S.msgs.delete(c.id);
      if (S.activeId === c.id) location.hash = '#/';
      renderChatList();
      toast('Chat deleted');
    } catch (e) { fail(e); }
  }

  async function exitGroup(c) {
    if (!confirm(`Exit "${c.title}"? You won't get new messages from this group.`)) return;
    try {
      const r = await post('groups/leave', { chat: c.id });
      Object.assign(c, r.chat);
      renderChatList();
      if (S.activeId === c.id) { updateChatHeader(c); loadMessages(c.id); }
      toast('You left the group');
    } catch (e) { fail(e); }
  }

  async function loadChats() {
    const r = await api('chats');
    const prev = S.chats;
    S.chats = new Map(r.chats.map((c) => [c.id, c]));
    for (const c of S.chats.values()) {
      if (c.last) S.lastId = Math.max(S.lastId, c.last.id);
      const old = prev.get(c.id);
      if (old && c.id === S.activeId && document.visibilityState === 'visible' && S.tab === 'chat') c.unread = 0;
      if (old && old.readUpto) c.readUpto = old.readUpto;
    }
    if (!S.rsince) S.rsince = r.now;
    if (!S.useq) S.useq = r.useq;
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

  function leaveChatView() {
    if (S.recording) S.recording.stop(true);
    S.players.forEach((p) => p.audio.pause());
    S.reply = null; S.editing = null; S.unreadMarker = null;
  }

  async function route() {
    if (!S.me || !$('.app')) return;
    closeMenus();
    const { parts, q } = parseHash();
    if (parts[0] === 'c' && parts[1]) {
      openChat(Number(parts[1]), parts[2] === 'site' ? 'site' : 'chat');
    } else if (parts[0] === 'site') {
      leaveChatView(); S.activeId = null; renderChatList(); openSiteEditor();
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
      leaveChatView(); S.activeId = null; renderChatList(); setMain(emptyMain(), false);
    }
  }

  function emptyMain() {
    return h('div', { class: 'empty-main' },
      h('img', { src: 'assets/icon.svg', alt: '', width: 72, height: 72 }),
      h('h2', { text: S.config.app_name }),
      h('p', { class: 'muted', text: 'Chat with customers and businesses, one-to-one or in groups. Every account can have a mini-site that opens right inside the chat.' }),
      h('div', { class: 'row-gap' },
        h('button', { class: 'btn primary', onclick: () => openNewChat('chat') }, icon('plus'), 'New chat'),
        h('button', { class: 'btn', onclick: () => openNewChat('group') }, icon('users'), 'New group'),
        h('a', { class: 'btn', href: '#/site' }, icon('store'), 'My mini-site')));
  }

  // ---------------------------------------------------------------- chat view
  async function openChat(id, tab = 'chat') {
    let chat = S.chats.get(id);
    if (!chat) {
      try { chat = (await api('chats/one', { query: { id } })).chat; S.chats.set(id, chat); } catch (e) { fail(e); location.replace('#/'); return; }
    }
    const switching = S.activeId !== id || !$('.chat-view');
    if (switching) {
      leaveChatView();
      S.nodeCache = new Map();
      S.newBelow = 0;
      if (chat.unread > 0) S.unreadMarker = { chat: id, after: chat.my_read_id, count: chat.unread };
    }
    S.activeId = id;
    S.tab = tab === 'site' && chat.peer && chat.peer.site ? 'site' : 'chat';
    renderChatList();
    if (switching) setMain(chatView(chat));
    else updateChatHeader(chat);
    showTab();
    if (chat.type === 'group' && switching) loadInfo(id);
    if (!S.msgs.has(id) || !S.msgs.get(id).loaded) await loadMessages(id);
    else renderMessages();
    markReadSoon();
  }

  async function loadInfo(id) {
    try {
      const r = await api('chats/info', { query: { id } });
      S.info.set(id, r);
      const c = S.chats.get(id);
      if (c) { Object.assign(c, r.chat); if (S.activeId === id) updateChatHeader(c); }
      return r;
    } catch (e) { if (e.status !== 404) fail(e); return null; }
  }

  function chatView(chat) {
    const view = h('section', { class: 'chat-view' },
      h('header', { class: 'chat-head' }),
      h('div', { class: 'search-panel', hidden: true }),
      h('div', { class: 'chat-pane' },
        h('div', { class: 'messages-wrap' },
          h('div', { class: 'messages', onscroll: onMessagesScroll }),
          h('button', { class: 'to-bottom', type: 'button', hidden: true, 'aria-label': 'Scroll to latest', onclick: () => { S.newBelow = 0; scrollToBottom(true); } },
            icon('down'), h('span', { class: 'tb-count' }))),
        h('div', { class: 'blocked-bar', hidden: true }),
        composer(chat)),
      h('div', { class: 'site-pane', hidden: true }));
    updateChatHeader(chat, view);
    return view;
  }

  function headerSubtitle(chat) {
    const t = typingOf(chat.id);
    if (t) return { text: typingText(chat, t), cls: 'typing' };
    if (chat.type === 'group') {
      if (!chat.active) return { text: "You're no longer a participant", cls: '' };
      const info = S.info.get(chat.id);
      if (info) {
        const names = info.members.filter((m) => m.id !== S.me.id).map((m) => firstName(m.name || m.display_name));
        return { text: [...names, 'You'].join(', '), cls: '' };
      }
      return { text: `${chat.members_count} members`, cls: '' };
    }
    if (chat.blocked) return { text: 'Blocked', cls: '' };
    if (!chat.peer) return { text: '', cls: '' };
    return { text: presence(chat.peer), cls: chat.peer.online ? 'online' : '' };
  }

  function updateChatHeader(chat, root = document) {
    const head = $('.chat-head', root);
    if (!head) return;
    const sub = headerSubtitle(chat);
    const tabs = chat.peer && chat.peer.site ? h('div', { class: 'tabs', role: 'tablist' },
      h('a', { class: 'tab' + (S.tab === 'chat' ? ' on' : ''), href: '#/c/' + chat.id, role: 'tab' }, icon('chat'), h('span', { text: 'Chat' })),
      h('a', { class: 'tab' + (S.tab === 'site' ? ' on' : ''), href: '#/c/' + chat.id + '/site', role: 'tab' }, icon('globe'), h('span', { text: 'Website' }))) : null;
    head.replaceChildren(...[
      h('a', { class: 'icon-btn back', href: '#/', 'aria-label': 'Back to chats' }, icon('back')),
      h('button', { class: 'peer', onclick: () => openChatInfo(chat) }, chatAvatar(chat),
        h('span', { class: 'peer-text' }, h('strong', { text: chat.title }), h('small', { class: sub.cls, text: sub.text }))),
      tabs,
      h('button', { class: 'icon-btn hide-sm', type: 'button', 'aria-label': 'Search messages', onclick: () => openSearch(chat) }, icon('search')),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Chat options', onclick: (e) => headerMenu(chat, e.currentTarget) }, icon('more')),
    ].filter(Boolean));
    const bar = $('.blocked-bar', root);
    const wrap = $('.composer-wrap', root);
    if (bar && wrap) {
      const blocked = chat.blocked, left = chat.type === 'group' && !chat.active;
      bar.hidden = !blocked && !left;
      wrap.hidden = blocked || left;
      bar.replaceChildren(...(left
        ? ["You can't send messages to this group because you're no longer a participant."]
        : ['You blocked this contact. ', h('button', { class: 'btn link', text: 'Unblock', onclick: () => setBlocked(chat, false) })]));
    }
  }

  function headerMenu(chat, anchor) {
    popMenu(anchor, [
      { icon: 'info', label: chat.type === 'group' ? 'Group info' : 'Contact info', run: () => openChatInfo(chat) },
      { icon: 'search', label: 'Search', run: () => openSearch(chat) },
      { icon: 'mute', label: chat.muted ? 'Unmute notifications' : 'Mute notifications', run: () => (chat.muted ? chatSetting(chat, { mute: 'off' }) : muteMenu(chat, anchor)) },
      chat.type === 'direct' && { icon: 'block', label: chat.blocked ? 'Unblock' : 'Block', danger: !chat.blocked, run: () => setBlocked(chat, !chat.blocked) },
      chat.type === 'group' && chat.active
        ? { icon: 'logout', label: 'Exit group', danger: true, run: () => exitGroup(chat) }
        : { icon: 'trash', label: 'Delete chat', danger: true, run: () => deleteChat(chat) },
    ]);
  }

  function showTab() {
    const chat = S.chats.get(S.activeId);
    const pane = $('.chat-pane'), sitePane = $('.site-pane');
    if (!pane || !sitePane || !chat) return;
    const site = S.tab === 'site';
    pane.hidden = site;
    sitePane.hidden = !site;
    $$('.tab').forEach((t, i) => t.classList.toggle('on', (i === 1) === site));
    if (site && chat.peer && chat.peer.site) {
      const frame = $('iframe', sitePane);
      if (!frame || frame.dataset.src !== chat.peer.site.url) {
        sitePane.replaceChildren(
          h('iframe', {
            class: 'site-frame', src: chat.peer.site.url, dataset: { src: chat.peer.site.url }, title: chat.title + ' website',
            sandbox: 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads',
            referrerpolicy: 'no-referrer', loading: 'lazy',
          }),
          h('div', { class: 'site-bar' },
            h('span', { class: 'muted', text: 'Tap a product to message ' + chat.title }),
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
    location.hash = '#/c/' + S.activeId;
    setTimeout(() => {
      const ta = $('.composer textarea');
      if (!ta) return;
      ta.value = d.text.slice(0, 1000);
      ta.dispatchEvent(new Event('input'));
      ta.focus();
      toast('Message ready — tap send');
    }, 60);
  });

  // ---------------------------------------------------------------- composer
  let typingSentAt = 0;
  function sendTyping(cid) {
    if (Date.now() - typingSentAt < 4000) return;
    typingSentAt = Date.now();
    post('chats/typing', { chat: cid }).catch(() => {});
  }
  const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  function composer(chat) {
    const ta = h('textarea', { rows: 1, placeholder: 'Message', 'aria-label': 'Message', maxlength: S.config.limits.message_length });
    const draft = S.compose.get(chat.id);
    if (draft) { ta.value = draft; S.compose.delete(chat.id); }
    const sendBtn = h('button', { class: 'send-btn', type: 'button' });
    const bar = h('div', { class: 'compose-bar', hidden: true });
    const rec = h('div', { class: 'rec-bar', hidden: true });
    const autosize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; };
    const setMode = () => {
      const mode = ta.value.trim() || S.editing || !canRecord() ? 'send' : 'mic';
      if (sendBtn.dataset.mode === mode) return;
      sendBtn.dataset.mode = mode;
      sendBtn.replaceChildren(icon(mode === 'mic' ? 'mic' : 'send'));
      sendBtn.setAttribute('aria-label', mode === 'mic' ? 'Record voice message' : 'Send');
    };
    const submit = () => {
      if (S.editing && S.editing.chat === chat.id) saveEdit(ta);
      else sendMessage(chat.id, ta);
      autosize(); setMode();
    };
    sendBtn.addEventListener('click', () => (sendBtn.dataset.mode === 'mic' ? startRecording(chat, wrap) : submit()));
    ta.addEventListener('input', () => { autosize(); setMode(); if (ta.value.trim()) sendTyping(chat.id); });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); submit(); }
      if (e.key === 'Escape' && (S.reply || S.editing)) { cancelComposeMode(); }
    });
    const form = h('form', { class: 'composer', onsubmit: (e) => { e.preventDefault(); submit(); } },
      h('button', { class: 'icon-btn cbtn', type: 'button', 'aria-label': 'Emoji', onclick: (e) => emojiPicker(e.currentTarget, (em) => insertAtCursor(ta, em)) }, icon('smile')),
      h('button', { class: 'icon-btn cbtn', type: 'button', 'aria-label': 'Attach', onclick: (e) => attachMenu(chat, e.currentTarget) }, icon('clip')),
      ta, sendBtn);
    const wrap = h('div', { class: 'composer-wrap' }, bar, rec, form);
    setMode();
    setTimeout(() => { autosize(); if (window.matchMedia('(pointer: fine)').matches) ta.focus(); }, 0);
    return wrap;
  }

  function renderComposeBar() {
    const bar = $('.compose-bar'), ta = $('.composer textarea');
    if (!bar || !ta) return;
    const r = S.reply && S.reply.chat === S.activeId ? S.reply : null;
    const ed = S.editing && S.editing.chat === S.activeId ? S.editing : null;
    bar.hidden = !r && !ed;
    if (!r && !ed) { bar.replaceChildren(); return; }
    const m = (r || ed).msg;
    bar.replaceChildren(
      icon(ed ? 'edit' : 'reply'),
      h('div', { class: 'cb-quote', style: `--q:${nameColor(m.sender)}` },
        h('strong', { text: ed ? 'Edit message' : (m.sender === S.me.id ? 'You' : m.sender_name) }),
        h('span', { text: previewOf(m) })),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cancel', onclick: cancelComposeMode }, icon('close')));
    ta.dispatchEvent(new Event('input'));
    ta.focus();
  }

  function cancelComposeMode() {
    const wasEditing = !!S.editing;
    S.reply = null; S.editing = null;
    const ta = $('.composer textarea');
    if (wasEditing && ta) ta.value = '';
    renderComposeBar();
  }

  function attachMenu(chat, anchor) {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    popMenu(anchor, [
      { icon: 'image', label: 'Photos & videos', run: () => pickFiles('image/*,video/*', true, null, (files) => openMediaPreview(chat, files)) },
      touch && { icon: 'camera', label: 'Camera', run: () => pickFiles('image/*', false, 'environment', (files) => openMediaPreview(chat, files)) },
      { icon: 'file', label: 'Document', run: () => pickFiles('', true, null, (files) => files.forEach((f) => uploadMessage(chat.id, f, 'file'))) },
      { icon: 'location', label: 'Location', run: () => shareLocation(chat) },
    ]);
  }

  function pickFiles(accept, multiple, capture, onFiles) {
    const input = h('input', { type: 'file', hidden: true });
    if (accept) input.accept = accept;
    if (multiple) input.multiple = true;
    if (capture) input.setAttribute('capture', capture);
    input.addEventListener('change', () => { const files = [...input.files]; input.remove(); if (files.length) onFiles(files); });
    document.body.append(input);
    input.click();
  }

  function openMediaPreview(chat, files) {
    files = files.slice(0, 10);
    const urls = files.map((f) => URL.createObjectURL(f));
    const caption = h('input', { placeholder: 'Add a caption…', maxlength: 1000, 'aria-label': 'Caption' });
    const sendBtn = h('button', { class: 'btn primary', type: 'submit' }, icon('send'), files.length > 1 ? `Send ${files.length}` : 'Send');
    let close = null;
    const cleanup = () => urls.forEach((u) => URL.revokeObjectURL(u));
    const form = h('form', {
      class: 'stack', onsubmit: (e) => {
        e.preventDefault();
        close();
        files.forEach((f, i) => uploadMessage(chat.id, f, f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : 'file', { caption: i === 0 ? caption.value : '' }));
      },
    },
    h('div', { class: 'preview-grid' + (files.length === 1 ? ' single' : '') }, files.map((f, i) => (f.type.startsWith('video/')
      ? h('video', { src: urls[i], muted: true, playsinline: true, controls: files.length === 1 })
      : f.type.startsWith('image/') ? h('img', { src: urls[i], alt: '' }) : h('div', { class: 'file-card' }, icon('file'), h('span', { text: f.name }))))),
    h('div', { class: 'row-gap nowrap' }, caption, sendBtn));
    close = modal(files.length > 1 ? `Send ${files.length} items` : 'Send', form, { wide: true });
    const obs = new MutationObserver(() => { if (!document.body.contains(form)) { cleanup(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
  }

  function shareLocation(chat) {
    if (!navigator.geolocation) { toast("Your browser can't share location", 'bad'); return; }
    toast('Finding your location…');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const r = await post('messages/location', { chat: chat.id, lat: pos.coords.latitude, lng: pos.coords.longitude, reply_to: replyIdFor(chat.id) });
        S.reply = null; renderComposeBar();
        addOwnMessage(chat.id, r.message);
      } catch (e) { fail(e); }
    }, () => toast('Allow location access to share where you are', 'bad'), { enableHighAccuracy: true, timeout: 15000 });
  }

  async function startRecording(chat, wrap) {
    if (S.recording) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { toast('Allow microphone access to record voice messages', 'bad'); return; }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    let rec;
    try { rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); } catch { stream.getTracks().forEach((t) => t.stop()); toast("Voice messages aren't supported in this browser", 'bad'); return; }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const started = Date.now();
    const bar = $('.rec-bar', wrap), form = $('.composer', wrap);
    const timeEl = h('span', { class: 'rec-time', text: '0:00' });
    const timer = setInterval(() => { const s = (Date.now() - started) / 1000; timeEl.textContent = fmtDur(s); if (s >= 900) stop(false); }, 250);
    const stop = (cancel) => {
      if (!S.recording) return;
      S.recording = null;
      clearInterval(timer);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        bar.hidden = true; form.hidden = false;
        if (cancel || !chunks.length) return;
        const dur = (Date.now() - started) / 1000;
        if (dur < 0.8) { toast('Hold on a little longer to record'); return; }
        const mime = (rec.mimeType || type || 'audio/webm').split(';')[0];
        const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
        uploadMessage(chat.id, new File(chunks, 'voice.' + ext, { type: mime }), 'voice', { duration: dur.toFixed(1) });
      };
      if (rec.state !== 'inactive') rec.stop(); else rec.onstop();
    };
    S.recording = { stop };
    bar.replaceChildren(
      h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': 'Cancel recording', onclick: () => stop(true) }, icon('trash')),
      h('span', { class: 'rec-dot' }), timeEl, h('span', { class: 'rec-hint', text: 'Recording…' }),
      h('button', { class: 'send-btn', type: 'button', 'aria-label': 'Send voice message', onclick: () => stop(false) }, icon('send')));
    bar.hidden = false; form.hidden = true;
    rec.start(250);
  }

  // ---------------------------------------------------------------- sending
  let tempId = -1;
  const replyIdFor = (chatId) => (S.reply && S.reply.chat === chatId ? S.reply.msg.id : 0);
  const replyPreview = (m) => ({ id: m.id, sender: m.sender, sender_name: m.sender === S.me.id ? 'You' : m.sender_name, kind: m.kind, text: previewOf(m) });

  function storeFor(chatId) {
    let store = S.msgs.get(chatId);
    if (!store) { store = { list: [], loaded: true, hasMore: false }; S.msgs.set(chatId, store); }
    return store;
  }

  function addOwnMessage(chatId, msg, temp) {
    const store = storeFor(chatId);
    const i = temp ? store.list.indexOf(temp) : -1;
    if (store.list.some((m) => m.id === msg.id)) { if (i >= 0) store.list.splice(i, 1); }
    else if (i >= 0) store.list[i] = msg;
    else store.list.push(msg);
    if (temp && temp.media && temp.media.local) {
      const p = S.players.get(temp.id);
      if (p) { S.players.delete(temp.id); }
      setTimeout(() => URL.revokeObjectURL(temp.media.local), 60000);
    }
    S.lastId = Math.max(S.lastId, msg.id);
    const chat = S.chats.get(chatId);
    if (chat) {
      chat.last = { id: msg.id, kind: msg.kind, text: previewOf(msg), mine: true, created_at: msg.created_at, deleted: false, sender_name: 'You' };
      chat.updated_at = msg.created_at;
    }
    renderChatList();
    if (S.activeId === chatId) renderMessages('bottom');
  }

  async function sendMessage(chatId, ta) {
    const body = ta.value.trim();
    if (!body) return;
    ta.value = '';
    const reply = S.reply && S.reply.chat === chatId ? S.reply.msg : null;
    S.reply = null; renderComposeBar();
    const temp = { id: tempId--, chat: chatId, sender: S.me.id, sender_name: S.me.display_name, kind: 'text', body, created_at: nowSec(), pending: true, reactions: [], reply: reply ? replyPreview(reply) : null };
    storeFor(chatId).list.push(temp);
    renderMessages('bottom');
    await deliver(chatId, temp);
  }

  async function deliver(chatId, temp) {
    try {
      let r;
      if (temp.file) {
        const fd = new FormData();
        fd.append('chat', chatId); fd.append('kind', temp.kind); fd.append('file', temp.file);
        if (temp.body) fd.append('caption', temp.body);
        if (temp.duration) fd.append('duration', temp.duration);
        if (temp.reply) fd.append('reply_to', temp.reply.id);
        r = await xhrUpload('messages/upload', fd, (p) => { temp.progress = p; if (S.activeId === chatId) renderMessages(); });
      } else {
        r = await post('messages/send', { chat: chatId, body: temp.body, reply_to: temp.reply ? temp.reply.id : 0 });
      }
      addOwnMessage(chatId, r.message, temp);
    } catch (e) {
      temp.failed = true; temp.pending = false;
      if (e.status !== 0) toast(e.message, 'bad');
      if (S.activeId === chatId) renderMessages();
    }
  }

  function retrySend(chatId, m) { m.failed = false; m.pending = true; m.progress = 0; renderMessages(); deliver(chatId, m); }

  function uploadMessage(chatId, file, kind, opts = {}) {
    const limit = (kind === 'image' ? S.config.limits.photo_mb : S.config.limits.file_mb) * 1048576;
    if (file.size > limit) { toast(`${file.name || 'That file'} is too big (max ${Math.round(limit / 1048576)} MB)`, 'bad'); return; }
    const reply = S.reply && S.reply.chat === chatId ? S.reply.msg : null;
    S.reply = null; renderComposeBar();
    const local = URL.createObjectURL(file);
    const temp = {
      id: tempId--, chat: chatId, sender: S.me.id, sender_name: S.me.display_name, kind, body: opts.caption || '', created_at: nowSec(),
      pending: true, progress: 0, reactions: [], file, duration: opts.duration || '', reply: reply ? replyPreview(reply) : null,
      media: { local, name: file.name, size: file.size, dur: Number(opts.duration) || 0, mime: file.type },
    };
    if (kind === 'image') {
      const probe = new Image();
      probe.onload = () => { temp.media.w = probe.naturalWidth; temp.media.h = probe.naturalHeight; if (S.activeId === chatId) renderMessages(); };
      probe.src = local;
    }
    storeFor(chatId).list.push(temp);
    if (S.activeId === chatId) renderMessages('bottom');
    deliver(chatId, temp);
  }

  // ---------------------------------------------------------------- loading & rendering messages
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
        const lastLoaded = (r.messages.at(-1) || { id: 0 }).id;
        store.list = [...r.messages, ...store.list.filter((m) => !ids.has(m.id) && (m.id < 0 || m.id > lastLoaded))];
        for (const m of r.messages) S.lastId = Math.max(S.lastId, m.id);
      }
      if (older || !store.loaded) store.hasMore = r.has_more;
      store.loaded = true;
    } catch (e) { fail(e); } finally { store.loading = false; }
    if (S.activeId === id) renderMessages(older ? 'top' : (S.unreadMarker && S.unreadMarker.chat === id ? 'unread' : 'bottom'));
  }

  function onMessagesScroll(e) {
    const box = e.currentTarget;
    const store = S.msgs.get(S.activeId);
    if (box.scrollTop < 80 && store && store.hasMore && !store.loading) loadMessages(S.activeId, true);
    const dist = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (dist < 40) { S.newBelow = 0; markReadSoon(); }
    updateToBottom(dist);
  }

  function updateToBottom(dist) {
    const btn = $('.to-bottom'), box = $('.messages');
    if (!btn || !box) return;
    if (dist == null) dist = box.scrollHeight - box.scrollTop - box.clientHeight;
    btn.hidden = dist < 300;
    $('.tb-count', btn).textContent = S.newBelow ? S.newBelow : '';
  }

  function scrollToBottom(smooth) {
    const box = $('.messages');
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  function nodeKey(m, chat, cont) {
    return [m.id, m.kind, m.body, m.pending ? 'p' + Math.round((m.progress || 0) * 20) : '', m.failed ? 'f' : '', m.edited ? 'e' : '', m.deleted ? 'd' : '',
      cont ? 'c' : '', JSON.stringify(m.reactions || []), m.sender === S.me.id ? statusOf(chat, m) : '', m.media && m.media.w].join('|');
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
    if (!store.list.some((m) => m.kind !== 'system') && store.loaded && chat.type === 'direct') {
      nodes.push(h('div', { class: 'chat-intro' }, chatAvatar(chat, 'xl'),
        h('h3', { text: chat.title }),
        h('p', { class: 'muted', text: (chat.peer && (chat.peer.about || chat.peer.phone)) || '' }),
        chat.peer && chat.peer.site ? h('a', { class: 'btn', href: '#/c/' + chat.id + '/site' }, icon('globe'), 'View their website') : null,
        h('p', { class: 'fine', text: 'Messages are private between you and ' + chat.title + '.' })));
    }
    const marker = S.unreadMarker && S.unreadMarker.chat === chat.id ? S.unreadMarker : null;
    let markerNode = null, lastDay = '', last = null;
    for (const m of store.list) {
      const day = dayLabel(m.created_at);
      if (day !== lastDay) { nodes.push(h('div', { class: 'day' }, h('span', { text: day }))); lastDay = day; last = null; }
      if (marker && !markerNode && m.id > marker.after && m.sender !== S.me.id && m.id > 0) {
        markerNode = h('div', { class: 'unread-divider' }, h('span', { text: `${marker.count} unread message${marker.count === 1 ? '' : 's'}` }));
        nodes.push(markerNode);
        last = null;
      }
      const cont = !!last && last.sender === m.sender && last.kind !== 'system' && m.kind !== 'system' && m.created_at - last.created_at < 300;
      const key = nodeKey(m, chat, cont);
      let node = S.nodeCache.get(m.id);
      if (!node || node._key !== key) { node = messageNode(m, chat, cont); node._key = key; S.nodeCache.set(m.id, node); }
      nodes.push(node);
      last = m;
    }
    box.replaceChildren(...nodes);
    if (keep === 'top') box.scrollTop = box.scrollHeight - prevH + prevTop;
    else if (keep === 'unread' && markerNode) { markerNode.scrollIntoView({ block: 'start' }); box.scrollTop -= 40; }
    else if (keep === 'bottom' || atBottom) box.scrollTop = box.scrollHeight;
    updateToBottom();
  }

  function messageNode(m, chat, cont) {
    if (m.kind === 'system') return h('div', { class: 'sys', dataset: { id: m.id } }, h('span', { text: m.text }));
    const mine = m.sender === S.me.id;
    const md = m.media || {};
    const bubble = h('div', { class: 'bubble' });
    if (chat.type === 'group' && !mine && !cont) bubble.append(h('div', { class: 'sender', style: `color:${nameColor(m.sender)}`, text: m.sender_name }));
    if (m.forwarded && !m.deleted) bubble.append(h('div', { class: 'fwd' }, icon('forward'), 'Forwarded'));
    if (m.reply && !m.deleted) {
      bubble.append(h('button', { class: 'quote', type: 'button', style: `--q:${nameColor(m.reply.sender)}`, onclick: (e) => { e.stopPropagation(); jumpTo(m.reply.id); } },
        h('strong', { text: m.reply.sender === S.me.id ? 'You' : m.reply.sender_name }), h('span', { text: m.reply.text })));
    }
    let hasMedia = false;
    if (m.deleted) {
      bubble.append(h('span', { class: 'text deleted' }, icon('block'), mine ? 'You deleted this message' : 'This message was deleted'));
    } else if (m.kind === 'image') {
      hasMedia = true;
      const w = md.w || 4, hh = md.h || 3;
      const box = h('button', { class: 'media-img', type: 'button', 'aria-label': 'Open photo', onclick: () => md.url && lightbox(m) },
        h('img', { src: md.local || md.thumb || md.url, alt: m.body || 'Photo', loading: 'lazy', style: `aspect-ratio:${w}/${hh}` }));
      if (m.pending) box.append(progressRing(m.progress));
      bubble.append(box);
    } else if (m.kind === 'video') {
      hasMedia = true;
      const v = h('video', { class: 'media-video', src: md.local || md.url, controls: !m.pending, preload: 'metadata', playsinline: true });
      const box = h('div', { class: 'media-img' }, v);
      if (m.pending) box.append(progressRing(m.progress));
      bubble.append(box);
    } else if (m.kind === 'voice') {
      bubble.append(voicePlayer(m));
    } else if (m.kind === 'file') {
      bubble.append(h('a', { class: 'file-card', href: md.url || '#', download: md.name || 'file', target: '_blank', rel: 'noopener', onclick: (e) => { if (!md.url) e.preventDefault(); } },
        h('span', { class: 'file-ic', text: String(md.type || (md.name || '').split('.').pop() || 'file').slice(0, 4).toUpperCase() }),
        h('span', { class: 'file-meta' }, h('strong', { text: md.name || 'Document' }), h('small', { text: m.pending ? `Uploading… ${Math.round((m.progress || 0) * 100)}%` : fmtSize(md.size) })),
        md.url ? icon('download') : null));
    } else if (m.kind === 'location') {
      bubble.append(h('a', { class: 'loc-card', href: `https://www.google.com/maps?q=${md.lat},${md.lng}`, target: '_blank', rel: 'noopener noreferrer' },
        h('span', { class: 'loc-map' }, icon('location')),
        h('span', { class: 'file-meta' }, h('strong', { text: 'Location' }), h('small', { text: `${Number(md.lat).toFixed(5)}, ${Number(md.lng).toFixed(5)} · Open in Maps` }))));
    }
    if (!m.deleted && m.body && m.kind !== 'text') bubble.append(h('span', { class: 'text caption' }, linkify(m.body)));
    if (!m.deleted && m.kind === 'text') bubble.append(h('span', { class: 'text' }, linkify(m.body)));
    bubble.append(h('span', { class: 'meta' },
      m.edited && !m.deleted ? h('span', { class: 'edited', text: 'Edited' }) : null,
      timeFmt.format(new Date(m.created_at * 1000)),
      mine && !m.deleted ? (m.failed ? icon('alert', 'tick bad') : tickIcon(chat, m.pending ? -1 : m.id)) : null));
    if (!m.deleted && m.id > 0) {
      bubble.append(h('button', { class: 'msg-more', type: 'button', 'aria-label': 'Message options', onclick: (e) => { e.stopPropagation(); messageMenu(m, chat, e.currentTarget); } }, icon('down')));
      onLongPress(bubble, (a) => messageMenu(m, chat, a instanceof Event ? a : bubble));
    }
    const row = h('div', { class: `msg ${mine ? 'out' : 'in'}${cont ? ' cont' : ''}${m.failed ? ' failed' : ''}${hasMedia ? ' has-media' : ''}`, dataset: { id: m.id } }, bubble);
    if (m.reactions && m.reactions.length) {
      row.append(h('div', { class: 'reacts' }, m.reactions.map((r) => h('button', {
        class: 'react' + (r.u.includes(S.me.id) ? ' mine' : ''), type: 'button',
        title: r.u.includes(S.me.id) ? 'Tap to remove' : '', onclick: () => react(m, r.u.includes(S.me.id) ? '' : r.e),
      }, r.e, r.u.length > 1 ? h('span', { text: r.u.length }) : null))));
    }
    if (m.failed) row.append(h('button', { class: 'retry', type: 'button', text: 'Not sent — tap to retry', onclick: () => retrySend(chat.id, m) }));
    return row;
  }

  function progressRing(p) {
    return h('span', { class: 'progress-ring', style: `--p:${Math.round((p || 0) * 100)}` }, h('span', { text: Math.round((p || 0) * 100) + '%' }));
  }

  function voicePlayer(m) {
    const md = m.media || {};
    const url = md.local || md.url;
    let p = S.players.get(m.id);
    if (!p && url) {
      p = { audio: new Audio(url) };
      p.audio.preload = 'metadata';
      ['timeupdate', 'play', 'pause', 'ended', 'loadedmetadata', 'durationchange'].forEach((ev) => p.audio.addEventListener(ev, () => p.sync && p.sync()));
      p.audio.addEventListener('ended', () => { p.audio.currentTime = 0; });
      S.players.set(m.id, p);
    }
    const btn = h('button', { class: 'vp-btn', type: 'button', 'aria-label': 'Play voice message' }, icon('play'));
    const bar = h('input', { type: 'range', class: 'vp-bar', min: 0, max: 1000, value: 0, 'aria-label': 'Position' });
    const time = h('span', { class: 'vp-time', text: fmtDur(md.dur) });
    const el = h('div', { class: 'voice' + (m.sender === S.me.id ? ' mine' : '') }, btn, h('div', { class: 'vp-mid' }, bar, time), h('span', { class: 'vp-mic' }, icon('mic')));
    if (!p) return el;
    const total = () => (isFinite(p.audio.duration) && p.audio.duration > 0 ? p.audio.duration : (md.dur || 0));
    p.sync = () => {
      const a = p.audio, d = total();
      bar.value = d ? Math.round((a.currentTime / d) * 1000) : 0;
      bar.style.setProperty('--v', (bar.value / 10) + '%');
      time.textContent = a.paused && a.currentTime === 0 ? fmtDur(d) : fmtDur(a.currentTime);
      btn.replaceChildren(icon(a.paused ? 'play' : 'pause'));
      btn.setAttribute('aria-label', a.paused ? 'Play voice message' : 'Pause');
    };
    btn.addEventListener('click', () => {
      S.players.forEach((o, id) => { if (id !== m.id) o.audio.pause(); });
      if (p.audio.paused) p.audio.play().catch(() => toast("This voice message can't be played in this browser", 'bad'));
      else p.audio.pause();
    });
    bar.addEventListener('input', () => { const d = total(); if (d) p.audio.currentTime = (bar.value / 1000) * d; });
    p.sync();
    return el;
  }

  function lightbox(m) {
    const md = m.media;
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const wrap = h('div', { class: 'lightbox', onclick: (e) => { if (e.target === wrap || e.target.tagName === 'IMG') close(); } },
      h('div', { class: 'lb-bar' },
        h('span', { class: 'grow' }, h('strong', { text: m.sender === S.me.id ? 'You' : m.sender_name }), h('small', { text: dayLabel(m.created_at) + ' ' + timeFmt.format(new Date(m.created_at * 1000)) })),
        h('a', { class: 'icon-btn', href: md.url, download: 'photo', 'aria-label': 'Download' }, icon('download')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, icon('close'))),
      h('img', { src: md.url, alt: m.body || 'Photo' }),
      m.body ? h('p', { class: 'lb-caption', text: m.body }) : null);
    document.addEventListener('keydown', onKey);
    document.body.append(wrap);
  }

  // ---------------------------------------------------------------- message actions
  function messageMenu(m, chat, anchor) {
    const mine = m.sender === S.me.id;
    const age = nowSec() - m.created_at;
    const canEdit = chat.active && mine && m.kind === 'text' && age < S.config.limits.edit_seconds;
    const canDeleteAll = chat.active && ((mine && age < S.config.limits.delete_seconds) || (chat.type === 'group' && chat.my_role === 'admin'));
    const myReaction = ((m.reactions || []).find((r) => r.u.includes(S.me.id)) || {}).e;
    const reactBar = chat.active ? h('div', { class: 'react-bar' },
      QUICK_REACTIONS.map((e) => h('button', { type: 'button', class: 'rb-btn' + (myReaction === e ? ' on' : ''), text: e, 'aria-label': 'React ' + e, onclick: () => { closeMenus(); react(m, myReaction === e ? '' : e); } })),
      h('button', { type: 'button', class: 'rb-btn more', 'aria-label': 'More emoji', onclick: () => { closeMenus(); emojiPicker(anchor, (e) => { closeMenus(); react(m, e); }); } }, icon('plus'))) : null;
    popMenu(anchor, [
      chat.active && { icon: 'reply', label: 'Reply', run: () => { S.editing = null; S.reply = { chat: chat.id, msg: m }; renderComposeBar(); } },
      m.body && { icon: 'copy', label: 'Copy', run: () => copyText(m.body) },
      { icon: 'forward', label: 'Forward', run: () => openForward(m) },
      m.media && m.media.url && m.kind !== 'location' && { icon: 'download', label: 'Download', run: () => { const a = h('a', { href: m.media.url, download: m.media.name || '' }); document.body.append(a); a.click(); a.remove(); } },
      canEdit && { icon: 'edit', label: 'Edit', run: () => startEdit(chat, m) },
      { icon: 'trash', label: 'Delete', danger: true, run: () => deleteMessage(m, canDeleteAll) },
    ], reactBar);
  }

  async function react(m, emoji) {
    const before = JSON.parse(JSON.stringify(m.reactions || []));
    const me = S.me.id;
    let list = (m.reactions || []).map((r) => ({ e: r.e, u: r.u.filter((u) => u !== me) })).filter((r) => r.u.length);
    if (emoji) { const r = list.find((x) => x.e === emoji); if (r) r.u.push(me); else list.push({ e: emoji, u: [me] }); }
    m.reactions = list;
    renderMessages();
    try { replaceMessage((await post('messages/react', { id: m.id, emoji })).message); }
    catch (e) { m.reactions = before; renderMessages(); fail(e); }
  }

  function replaceMessage(msg) {
    const store = S.msgs.get(msg.chat);
    if (store) {
      const i = store.list.findIndex((x) => x.id === msg.id);
      if (i >= 0) store.list[i] = msg;
    }
    const chat = S.chats.get(msg.chat);
    if (chat && chat.last && chat.last.id === msg.id) {
      chat.last = { ...chat.last, text: msg.deleted ? (chat.last.mine ? 'You deleted this message' : 'This message was deleted') : previewOf(msg), deleted: msg.deleted };
    }
    if (S.activeId === msg.chat) renderMessages();
  }

  function startEdit(chat, m) {
    S.reply = null;
    S.editing = { chat: chat.id, msg: m };
    const ta = $('.composer textarea');
    if (ta) { ta.value = m.body; ta.dispatchEvent(new Event('input')); }
    renderComposeBar();
  }

  async function saveEdit(ta) {
    const ed = S.editing;
    const body = ta.value.trim();
    if (!ed || !body) return;
    if (body === ed.msg.body) { cancelComposeMode(); return; }
    try {
      const r = await post('messages/edit', { id: ed.msg.id, body });
      S.editing = null; ta.value = ''; renderComposeBar();
      replaceMessage(r.message);
    } catch (e) { fail(e); }
  }

  function deleteMessage(m, canAll) {
    let close = null;
    const run = async (forAll) => {
      close();
      try {
        await post('messages/delete', { id: m.id, for: forAll ? 'everyone' : 'me' });
        if (forAll) {
          replaceMessage({ ...m, deleted: true, body: '', media: null, reactions: [], reply: null });
        } else {
          const store = S.msgs.get(m.chat);
          if (store) store.list = store.list.filter((x) => x.id !== m.id);
          S.nodeCache.delete(m.id);
          renderMessages();
        }
      } catch (e) { fail(e); }
    };
    close = modal('Delete message?', h('div', { class: 'stack' },
      canAll ? h('button', { class: 'btn danger block', type: 'button', text: 'Delete for everyone', onclick: () => run(true) }) : null,
      h('button', { class: 'btn block', type: 'button', text: 'Delete for me', onclick: () => run(false) }),
      h('button', { class: 'btn link block', type: 'button', text: 'Cancel', onclick: () => close() })));
  }

  function chatPicker({ exclude = [], max = 5, filter = () => true } = {}) {
    const chosen = new Set();
    const search = h('input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search chats' });
    const list = h('div', { class: 'pick-list' });
    const render = () => {
      const q = search.value.trim().toLowerCase();
      const items = sortChats([...S.chats.values()].filter((c) => c.active && !c.blocked && !exclude.includes(c.id) && filter(c) && (!q || c.title.toLowerCase().includes(q))));
      list.replaceChildren(...(items.length ? items.map((c) => {
        const cb = h('input', { type: 'checkbox', checked: chosen.has(c.id), disabled: !chosen.has(c.id) && chosen.size >= max });
        cb.addEventListener('change', () => { if (cb.checked) chosen.add(c.id); else chosen.delete(c.id); render(); });
        return h('label', { class: 'pick-item' }, chatAvatar(c), h('span', { class: 'grow' }, h('strong', { text: c.title }), h('small', { class: 'muted', text: c.type === 'group' ? `${c.members_count} members` : (c.peer && c.peer.phone) || '' })), cb);
      }) : [h('p', { class: 'muted center', text: 'No chats found.' })]));
    };
    search.addEventListener('input', render);
    render();
    return { el: h('div', { class: 'stack' }, search, list), chosen };
  }

  function openForward(m) {
    const picker = chatPicker({ max: 5 });
    const btn = h('button', { class: 'btn primary', type: 'submit' }, icon('forward'), 'Forward');
    let close = null;
    close = modal('Forward to…', h('form', {
      class: 'stack', onsubmit: async (e) => {
        e.preventDefault();
        if (!picker.chosen.size) { toast('Choose a chat', 'bad'); return; }
        busy(btn, true, 'Forwarding…');
        try {
          await post('messages/forward', { id: m.id, chats: [...picker.chosen] });
          close();
          toast(picker.chosen.size > 1 ? `Forwarded to ${picker.chosen.size} chats` : 'Forwarded');
          pollNow();
        } catch (err) { fail(err); busy(btn, false); }
      },
    }, picker.el, h('p', { class: 'fine', text: 'Up to 5 chats at a time.' }), btn));
  }

  async function jumpTo(id) {
    const chat = S.chats.get(S.activeId);
    if (!chat) return;
    for (let i = 0; i < 40; i++) {
      const store = S.msgs.get(chat.id);
      if (store && store.list.some((x) => x.id === id)) break;
      if (!store || !store.hasMore) { toast("That message isn't available anymore"); return; }
      await loadMessages(chat.id, true);
    }
    const node = $(`.messages [data-id="${id}"]`);
    if (node) {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
      node.classList.add('flash');
      setTimeout(() => node.classList.remove('flash'), 1800);
    }
  }

  function openSearch(chat) {
    const panel = $('.search-panel');
    if (!panel) return;
    const input = h('input', { type: 'search', placeholder: 'Search messages', 'aria-label': 'Search messages' });
    const results = h('div', { class: 'search-results' });
    const close = () => { panel.hidden = true; panel.replaceChildren(); };
    let t = null;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = input.value.trim();
        if (q.length < 2) { results.replaceChildren(); return; }
        try {
          const r = await api('messages/search', { query: { chat: chat.id, q } });
          results.replaceChildren(...(r.messages.length ? r.messages.map((m) => h('button', {
            class: 'sr-item', type: 'button', onclick: () => { close(); jumpTo(m.id); },
          }, h('small', { class: 'muted', text: `${m.sender === S.me.id ? 'You' : m.sender_name} · ${listTime(m.created_at)}` }), h('span', { text: previewOf(m) }))) : [h('p', { class: 'muted center', text: 'No messages found.' })]));
        } catch (e) { fail(e); }
      }, 300);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    panel.replaceChildren(h('div', { class: 'search-row' }, icon('search'), input, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close search', onclick: close }, icon('close'))), results);
    panel.hidden = false;
    input.focus();
  }

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
      const r = await api('poll', { query: { since: S.lastId, rsince: S.rsince, useq: S.useq } });
      failures = 0;
      S.rsince = r.now;
      S.useq = Math.max(S.useq, r.useq);
      let refresh = false, activeChanged = false;
      const box = $('.messages');
      const nearBottom = box && box.scrollHeight - box.scrollTop - box.clientHeight < 120;
      for (const m of r.messages) {
        S.lastId = Math.max(S.lastId, m.id);
        const chat = S.chats.get(m.chat);
        if (!chat) { refresh = true; notifyIncoming(m); continue; }
        if (m.kind === 'system') refresh = true;
        const store = S.msgs.get(m.chat);
        if (store && store.loaded && !store.list.some((x) => x.id === m.id)) {
          const pending = m.sender === S.me.id && store.list.find((x) => x.id < 0 && x.kind === m.kind && x.body === m.body && !x.file);
          if (pending) store.list[store.list.indexOf(pending)] = m;
          else if (!(m.sender === S.me.id && store.list.some((x) => x.id < 0 && x.file && x.pending && x.kind === m.kind))) store.list.push(m);
          if (m.chat === S.activeId) { activeChanged = true; if (!nearBottom && m.sender !== S.me.id) S.newBelow++; }
        }
        if (!chat.last || chat.last.id < m.id) {
          chat.last = { id: m.id, kind: m.kind, text: previewOf(m), mine: m.sender === S.me.id, created_at: m.created_at, deleted: false, sender_name: m.sender_short || m.sender_name };
          chat.updated_at = m.created_at;
          if (m.sender !== S.me.id && m.kind !== 'system' && !(m.chat === S.activeId && document.visibilityState === 'visible' && S.tab === 'chat' && nearBottom)) chat.unread = (chat.unread || 0) + 1;
        }
        notifyIncoming(m);
      }
      for (const m of r.updates) {
        const store = S.msgs.get(m.chat);
        if (store && store.list.some((x) => x.id === m.id)) { replaceMessage(m); if (m.chat === S.activeId) activeChanged = true; }
        const chat = S.chats.get(m.chat);
        if (chat && chat.last && chat.last.id === m.id) refresh = true;
      }
      for (const rc of r.receipts) {
        const c = S.chats.get(rc.chat);
        if (!c) continue;
        if (c.peer_read_id !== rc.peer_read_id || c.peer_delivered_id !== rc.peer_delivered_id) {
          c.peer_read_id = rc.peer_read_id; c.peer_delivered_id = rc.peer_delivered_id;
          if (rc.chat === S.activeId) activeChanged = true;
        }
      }
      const typingBefore = JSON.stringify([...S.typing.entries()].map(([k, v]) => [k, v.map((t) => t.user_id)]));
      S.typing = new Map();
      for (const t of r.typing) {
        if (!S.typing.has(t.chat)) S.typing.set(t.chat, []);
        S.typing.get(t.chat).push({ user_id: t.user_id, name: t.name, until: Date.now() + 6000 });
      }
      const typingChanged = typingBefore !== JSON.stringify([...S.typing.entries()].map(([k, v]) => [k, v.map((t) => t.user_id)]));
      if (refresh || Date.now() - chatsRefreshedAt > 60000) {
        chatsRefreshedAt = Date.now();
        await loadChats();
        const active = S.chats.get(S.activeId);
        if (active) { updateChatHeader(active); if (active.type === 'group' && refresh) loadInfo(active.id); }
      } else {
        renderChatList();
        if (typingChanged && S.chats.get(S.activeId)) updateChatHeader(S.chats.get(S.activeId));
      }
      if (activeChanged) { renderMessages(); markReadSoon(); }
      again = r.has_more;
    } catch (e) {
      if (e.status === 401) { polling = false; signedOut(); return; }
      failures = Math.min(failures + 1, 5);
    } finally {
      polling = false;
    }
    if (S.me) schedulePoll(again ? 50 : undefined);
  }

  // ---------------------------------------------------------------- dialogs
  function contactsList() {
    const seen = new Map();
    for (const c of S.chats.values()) {
      if (c.type === 'direct' && c.peer && !c.blocked && c.peer.phone) seen.set(c.peer.id, c.peer);
    }
    return [...seen.values()].sort((a, b) => a.display_name.localeCompare(b.display_name));
  }

  function lookupForm(onFound, buttonLabel = 'Find') {
    const pf = phoneField();
    const btn = h('button', { class: 'btn', type: 'submit', text: buttonLabel });
    const result = h('div', { class: 'lookup-result' });
    const form = h('form', {
      class: 'stack', onsubmit: async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!pf.input.value.trim()) { pf.input.focus(); return; }
        busy(btn, true, 'Searching…');
        try {
          const r = await api('contacts/lookup', { query: { phone: pf.value() } });
          onFound(r, result);
          pf.input.value = '';
        } catch (err) { fail(err); }
        busy(btn, false);
      },
    }, h('div', { class: 'row-gap nowrap' }, pf.el, btn), result);
    return form;
  }

  function inviteNode(phone) {
    const invite = `Join me on ${S.config.app_name}: ${location.origin}${location.pathname}`;
    return h('div', { class: 'invite' },
      h('p', {}, h('strong', { text: phone }), " isn't on " + S.config.app_name + ' yet.'),
      h('button', {
        class: 'btn', type: 'button', onclick: async () => {
          if (navigator.share) { try { await navigator.share({ text: invite }); return; } catch { /* cancelled */ } }
          copyText(invite);
        },
      }, icon('share'), 'Invite them'));
  }

  function openNewChat(startTab = 'chat') {
    let close = null;
    const body = h('div', { class: 'stack' });
    const tabs = h('div', { class: 'seg wide' },
      h('button', { type: 'button', dataset: { t: 'chat' }, onclick: () => show('chat') }, icon('chat'), 'Chat'),
      h('button', { type: 'button', dataset: { t: 'group' }, onclick: () => show('group') }, icon('users'), 'New group'));
    const show = (t) => {
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
      body.replaceChildren(t === 'chat' ? newChatPane() : newGroupPane());
    };
    const openWith = async (u) => {
      try {
        const o = await post('chats/open', { user_id: u.id });
        S.chats.set(o.chat.id, o.chat);
        close();
        location.hash = '#/c/' + o.chat.id;
      } catch (err) { fail(err); }
    };
    function newChatPane() {
      const contacts = contactsList();
      return h('div', { class: 'stack' },
        h('p', { class: 'muted', text: 'Enter the mobile number of the person or business you want to chat with.' }),
        lookupForm((r, out) => {
          if (r.user && r.user.id === S.me.id) out.replaceChildren(h('p', { class: 'muted', text: "That's your own number." }));
          else if (r.user) {
            out.replaceChildren(h('div', { class: 'person' }, avatar(r.user),
              h('div', { class: 'grow' }, h('strong', { text: r.user.display_name }), h('small', { class: 'muted', text: r.user.about || r.user.phone })),
              h('button', { class: 'btn primary', type: 'button', onclick: () => openWith(r.user) }, icon('chat'), 'Message')));
          } else out.replaceChildren(inviteNode(r.phone));
        }),
        contacts.length ? h('div', { class: 'stack' }, h('strong', { class: 'small-head', text: 'Recent contacts' }),
          h('div', { class: 'pick-list' }, contacts.slice(0, 30).map((u) => h('button', { class: 'pick-item', type: 'button', onclick: () => openWith(u) },
            avatar(u), h('span', { class: 'grow' }, h('strong', { text: u.display_name }), h('small', { class: 'muted', text: u.phone })))))) : null);
    }
    function newGroupPane() {
      const selected = new Map();
      const pool = new Map(contactsList().map((u) => [u.id, u]));
      const chips = h('div', { class: 'chips' });
      const list = h('div', { class: 'pick-list' });
      const next = h('button', { class: 'btn primary', type: 'button', text: 'Next' });
      const render = () => {
        chips.replaceChildren(...[...selected.values()].map((u) => h('button', { class: 'chip', type: 'button', onclick: () => { selected.delete(u.id); render(); } }, u.display_name, icon('close'))));
        list.replaceChildren(...(pool.size ? [...pool.values()].map((u) => {
          const cb = h('input', { type: 'checkbox', checked: selected.has(u.id) });
          cb.addEventListener('change', () => { if (cb.checked) selected.set(u.id, u); else selected.delete(u.id); render(); });
          return h('label', { class: 'pick-item' }, avatar(u), h('span', { class: 'grow' }, h('strong', { text: u.display_name }), h('small', { class: 'muted', text: u.phone })), cb);
        }) : [h('p', { class: 'muted', text: 'Add people by their mobile number below.' })]));
        next.disabled = !selected.size;
        next.textContent = selected.size ? `Next (${selected.size})` : 'Next';
      };
      next.addEventListener('click', () => body.replaceChildren(groupNamePane([...selected.keys()])));
      render();
      return h('div', { class: 'stack' },
        chips,
        h('strong', { class: 'small-head', text: 'Choose people' }),
        list,
        h('strong', { class: 'small-head', text: 'Add by mobile number' }),
        lookupForm((r, out) => {
          if (r.user && r.user.id !== S.me.id) { pool.set(r.user.id, r.user); selected.set(r.user.id, r.user); out.replaceChildren(); render(); }
          else if (r.user) out.replaceChildren(h('p', { class: 'muted', text: "That's your own number." }));
          else out.replaceChildren(inviteNode(r.phone));
        }, 'Add'),
        next);
    }
    function groupNamePane(ids) {
      const title = h('input', { maxlength: 80, placeholder: 'Group name', 'aria-label': 'Group name', required: true });
      let photo = null;
      const preview = h('span', { class: 'avatar xl group', style: '--av:#4f46e5' }, icon('camera'));
      const btn = h('button', { class: 'btn primary block', type: 'submit', text: 'Create group' });
      setTimeout(() => title.focus(), 30);
      return h('form', {
        class: 'stack', onsubmit: async (e) => {
          e.preventDefault();
          if (!title.value.trim()) { title.focus(); return; }
          busy(btn, true, 'Creating…');
          try {
            const r = await post('groups/create', { title: title.value, user_ids: ids });
            if (photo) {
              const fd = new FormData(); fd.append('chat', r.chat.id); fd.append('file', photo);
              try { await xhrUpload('groups/photo', fd); } catch (err) { fail(err); }
            }
            close();
            await loadChats();
            location.hash = '#/c/' + r.chat.id;
          } catch (err) { fail(err); busy(btn, false); }
        },
      },
      h('div', { class: 'group-name-row' },
        h('button', { class: 'avatar-pick', type: 'button', 'aria-label': 'Group photo', onclick: () => pickFiles('image/*', false, null, ([f]) => { photo = f; preview.replaceChildren(h('img', { src: URL.createObjectURL(f), alt: '' })); preview.classList.add('photo'); }) }, preview),
        h('label', { class: 'field grow' }, h('span', { text: 'Group name' }), title)),
      h('p', { class: 'fine', text: `${ids.length + 1} members including you. You'll be the group admin.` }),
      btn);
    }
    close = modal('New conversation', h('div', { class: 'stack' }, tabs, body));
    show(startTab);
  }

  function openProfile() {
    let close = null;
    const photoBtn = h('button', { class: 'avatar-pick', type: 'button', 'aria-label': 'Change profile photo', onclick: (e) => photoMenu(e.currentTarget) }, avatar(S.me, 'xl'), h('span', { class: 'ap-badge' }, icon('camera')));
    const photoMenu = (anchor) => popMenu(anchor, [
      { icon: 'image', label: S.me.avatar ? 'Change photo' : 'Add photo', run: () => pickFiles('image/*', false, null, ([f]) => uploadProfilePhoto(f)) },
      S.me.avatar && { icon: 'trash', label: 'Remove photo', danger: true, run: () => uploadProfilePhoto(null) },
    ]);
    const uploadProfilePhoto = async (f) => {
      const fd = new FormData();
      if (f) fd.append('file', f); else fd.append('remove', '1');
      try {
        const r = await xhrUpload('profile/photo', fd);
        S.me = r.user;
        close(); renderShell(); route(); openProfile();
        toast(f ? 'Profile photo updated' : 'Profile photo removed');
      } catch (e) { fail(e); }
    };
    const body = h('div', { class: 'stack' },
      h('div', { class: 'person big' }, photoBtn, h('div', { class: 'grow' }, h('strong', { text: S.me.display_name }), h('small', { class: 'muted', text: S.me.phone }))),
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
    h('p', { text: "This removes your profile, photo, mini-site and its files, and you leave all your groups. Messages you already sent stay in other people's chats." }),
    input, btn));
  }

  async function openChatInfo(chat) {
    if (chat.type === 'group') return openGroupInfo(chat);
    let close = null;
    const p = chat.peer || { display_name: chat.title };
    close = modal('Contact info', h('div', { class: 'stack' },
      h('div', { class: 'info-hero' }, avatar(p, 'xxl'), h('h3', { text: p.display_name }),
        p.business_name && p.name ? h('small', { class: 'muted', text: p.name }) : null, h('small', { class: 'muted', text: p.phone })),
      p.about ? h('p', { class: 'info-about', text: p.about }) : null,
      p.site ? h('div', { class: 'row-gap' },
        h('a', { class: 'btn primary', href: '#/c/' + chat.id + '/site', onclick: () => close() }, icon('globe'), 'Open website'),
        h('button', { class: 'btn', onclick: () => copyText(location.origin + p.site.url) }, icon('copy'), 'Copy link')) : null,
      h('div', { class: 'info-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => { close(); openSearch(chat); } }, icon('search'), 'Search'),
        h('button', { class: 'btn', type: 'button', onclick: (e) => (chat.muted ? (close(), chatSetting(chat, { mute: 'off' })) : muteMenu(chat, e.currentTarget)) }, icon('mute'), chat.muted ? 'Unmute' : 'Mute')),
      h('button', { class: 'btn ' + (chat.blocked ? '' : 'danger'), onclick: () => { close(); setBlocked(chat, !chat.blocked); } },
        icon('block'), chat.blocked ? 'Unblock ' + p.display_name : 'Block ' + p.display_name),
      h('button', { class: 'btn danger', onclick: () => { close(); deleteChat(chat); } }, icon('trash'), 'Delete chat')));
  }

  async function openGroupInfo(chat) {
    const info = await loadInfo(chat.id);
    if (!info) return;
    const c = S.chats.get(chat.id) || chat;
    const admin = c.active && c.my_role === 'admin';
    let close = null;
    const refresh = (r) => { S.info.set(c.id, r); Object.assign(c, r.chat); close(); openGroupInfo(c); updateChatHeader(c); renderChatList(); };
    const call = async (route, body) => { try { refresh(await post(route, { chat: c.id, ...body })); } catch (e) { fail(e); } };
    const photoBtn = h('button', {
      class: 'avatar-pick', type: 'button', disabled: !admin, 'aria-label': 'Group photo',
      onclick: (e) => popMenu(e.currentTarget, [
        { icon: 'image', label: c.avatar ? 'Change photo' : 'Add photo', run: () => pickFiles('image/*', false, null, async ([f]) => { const fd = new FormData(); fd.append('chat', c.id); fd.append('file', f); try { refresh(await xhrUpload('groups/photo', fd)); } catch (err) { fail(err); } }) },
        c.avatar && { icon: 'trash', label: 'Remove photo', danger: true, run: async () => { const fd = new FormData(); fd.append('chat', c.id); fd.append('remove', '1'); try { refresh(await xhrUpload('groups/photo', fd)); } catch (err) { fail(err); } } },
      ]),
    }, chatAvatar(c, 'xxl'), admin ? h('span', { class: 'ap-badge' }, icon('camera')) : null);
    const titleRow = admin ? (() => {
      const t = h('input', { value: c.title, maxlength: 80, 'aria-label': 'Group name' });
      const d = h('textarea', { rows: 2, maxlength: 500, placeholder: 'Add a group description', 'aria-label': 'Group description', value: c.description || '' });
      return h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); call('groups/update', { title: t.value, description: d.value }); } },
        h('label', { class: 'field' }, h('span', { text: 'Group name' }), t),
        h('label', { class: 'field' }, h('span', { text: 'Description' }), d),
        h('button', { class: 'btn small', type: 'submit' }, icon('check'), 'Save'));
    })() : h('div', { class: 'info-hero-text' }, h('h3', { text: c.title }), c.description ? h('p', { class: 'info-about', text: c.description }) : null);
    const members = info.members.map((u) => {
      const isMe = u.id === S.me.id;
      const row = h('div', { class: 'pick-item' }, avatar(u),
        h('span', { class: 'grow' }, h('strong', { text: isMe ? 'You' : u.display_name }), h('small', { class: 'muted', text: u.about || u.phone })),
        u.role === 'admin' ? h('span', { class: 'role-badge', text: 'Admin' }) : null,
        !isMe ? h('button', {
          class: 'icon-btn', type: 'button', 'aria-label': 'Member options', onclick: (e) => popMenu(e.currentTarget, [
            { icon: 'chat', label: 'Message ' + firstName(u.display_name), run: async () => { try { const o = await post('chats/open', { user_id: u.id }); S.chats.set(o.chat.id, o.chat); close(); location.hash = '#/c/' + o.chat.id; } catch (err) { fail(err); } } },
            admin && u.role !== 'admin' && { icon: 'users', label: 'Make group admin', run: () => call('groups/admin', { user_id: u.id, admin: true }) },
            admin && u.role === 'admin' && { icon: 'users', label: 'Dismiss as admin', run: () => call('groups/admin', { user_id: u.id, admin: false }) },
            admin && { icon: 'trash', label: 'Remove from group', danger: true, run: () => { if (confirm(`Remove ${u.display_name} from the group?`)) call('groups/remove', { user_id: u.id }); } },
          ]),
        }, icon('more')) : null);
      return row;
    });
    close = modal('Group info', h('div', { class: 'stack' },
      h('div', { class: 'info-hero' }, photoBtn, h('small', { class: 'muted', text: `Group · ${info.members.length} members` })),
      titleRow,
      admin ? h('button', { class: 'btn', type: 'button', onclick: () => { close(); openAddMembers(c, info); } }, icon('plus'), 'Add members') : null,
      h('strong', { class: 'small-head', text: `${info.members.length} members` }),
      h('div', { class: 'pick-list tall' }, members),
      h('div', { class: 'info-actions' },
        h('button', { class: 'btn', type: 'button', onclick: (e) => (c.muted ? (close(), chatSetting(c, { mute: 'off' })) : muteMenu(c, e.currentTarget)) }, icon('mute'), c.muted ? 'Unmute' : 'Mute')),
      c.active
        ? h('button', { class: 'btn danger', type: 'button', onclick: () => { close(); exitGroup(c); } }, icon('logout'), 'Exit group')
        : h('button', { class: 'btn danger', type: 'button', onclick: () => { close(); deleteChat(c); } }, icon('trash'), 'Delete group')), { wide: true });
  }

  function openAddMembers(c, info) {
    const inGroup = new Set(info.members.map((m) => m.id));
    const pool = new Map(contactsList().filter((u) => !inGroup.has(u.id)).map((u) => [u.id, u]));
    const selected = new Set();
    const list = h('div', { class: 'pick-list' });
    const btn = h('button', { class: 'btn primary', type: 'button', text: 'Add' });
    const render = () => {
      list.replaceChildren(...(pool.size ? [...pool.values()].map((u) => {
        const cb = h('input', { type: 'checkbox', checked: selected.has(u.id) });
        cb.addEventListener('change', () => { if (cb.checked) selected.add(u.id); else selected.delete(u.id); render(); });
        return h('label', { class: 'pick-item' }, avatar(u), h('span', { class: 'grow' }, h('strong', { text: u.display_name }), h('small', { class: 'muted', text: u.phone })), cb);
      }) : [h('p', { class: 'muted', text: 'Add people by their mobile number below.' })]));
      btn.disabled = !selected.size;
    };
    render();
    let close = null;
    btn.addEventListener('click', async () => {
      busy(btn, true, 'Adding…');
      try { const r = await post('groups/add', { chat: c.id, user_ids: [...selected] }); S.info.set(c.id, r); close(); toast('Members added'); pollNow(); }
      catch (e) { fail(e); busy(btn, false); }
    });
    close = modal('Add members', h('div', { class: 'stack' }, list,
      h('strong', { class: 'small-head', text: 'Add by mobile number' }),
      lookupForm((r, out) => {
        if (r.user && !inGroup.has(r.user.id) && r.user.id !== S.me.id) { pool.set(r.user.id, r.user); selected.add(r.user.id); out.replaceChildren(); render(); }
        else if (r.user) out.replaceChildren(h('p', { class: 'muted', text: 'Already in the group.' }));
        else out.replaceChildren(inviteNode(r.phone));
      }, 'Add'),
      btn));
  }

  async function setBlocked(chat, block) {
    if (block && !confirm(`Block ${chat.title}? They won't be able to message you.`)) return;
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
