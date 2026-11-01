/* ============ App shell: menu, page switching, branding, button handling ============ */
const NAV = [
  {id:'dashboard', label:'Dashboard', icon:'◈',  roles:['owner','manager','staff']},
  {id:'pos',       label:'POS / Sales', icon:'🛒', roles:['owner','manager']},
  {id:'orders',    label:'Orders', icon:'📋',     roles:['owner','manager']},
  {id:'inventory', label:'Inventory', icon:'📦',  roles:['owner','manager']},
  {id:'customers', label:'Customers', icon:'👥',  roles:['owner','manager']},
  {id:'shipments', label:'Shipments', icon:'🚚',  roles:['owner','manager']},
  {id:'payments',  label:'Payments', icon:'💳',   roles:['owner','manager']},
  {id:'bookings',  label:'Bookings', icon:'📅',   roles:['owner','manager']},
  {id:'expenses',  label:'Expenses', icon:'📉',   roles:['owner']},
  {id:'reports',   label:'Analytics', icon:'📊',  roles:['owner']},
  {id:'tasks',     label:'Tasks', icon:'✅',      roles:['owner','manager','staff']},
  {id:'team',      label:'Team & Payroll', icon:'🧑‍💼', roles:['owner']},
  {id:'settings',  label:'Settings', icon:'⚙️',   roles:['owner','manager','staff']},
  {id:'tenants',   label:'Businesses', icon:'🏢',  roles:['superadmin']}
];

function buildNav() {
  const role = App.user.role;
  $('#nav').innerHTML = NAV.filter(n => n.roles.includes(role)).map(n =>
    '<button class="nav-btn" id="nav-' + n.id + '" data-act="go" data-id="' + n.id + '"><span>' + n.icon + '</span>' + n.label + '</button>').join('');
  $('#who-name').textContent = App.user.name;
  $('#who-role').textContent = role === 'superadmin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1);
  $('#avatar').textContent = (App.user.name || 'U').charAt(0).toUpperCase();
}

async function go(id) {
  const item = NAV.find(n => n.id === id);
  if (!item || !item.roles.includes(App.user.role)) { toast('You do not have access to that page', 'error'); return; }
  App.page = id; App.cache = {}; destroyCharts(); closeSide();
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.id === 'nav-' + id));
  $('#page-title').textContent = item.icon + ' ' + item.label;
  const el = $('#main');
  el.innerHTML = '<div class="loading">Loading…</div>';
  try { await Pages[id](el); }
  catch (e) { if (e.code !== 'LOCKED' && e.code !== 'AUTH') el.innerHTML = '<div class="card"><div class="alert error">⚠️ ' + esc(e.message) + '</div></div>'; }
}
H.go = id => go(id);

function applyBranding() {
  const st = App.settings;
  if (App.superadmin) { $('#brand-name').textContent = CONFIG.PLATFORM_NAME; $('#brand-sub').textContent = 'Super Admin'; document.title = CONFIG.PLATFORM_NAME + ' — Admin'; licenceBadge(); return; }
  if (st.brandColor && /^#[0-9a-fA-F]{6}$/.test(st.brandColor)) document.documentElement.style.setProperty('--gold', st.brandColor);
  $('#brand-name').textContent = st.businessName || 'Business';
  $('#brand-sub').textContent = 'Portal';
  const logo = st.logo || '🏢';
  $('#brand-icon').innerHTML = /^https?:\/\//.test(logo) ? '<img src="' + esc(logo) + '" alt="">' : esc(logo);
  document.title = (st.businessName || 'Portal') + ' — Portal';
  licenceBadge();
}

/* ---- theme + mobile menu ---- */
H.theme = function () {
  const d = document.documentElement, next = d.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  d.setAttribute('data-theme', next); $('#theme-btn').textContent = next === 'dark' ? '🌙' : '☀️';
  try { localStorage.setItem('portal_theme', next); } catch (e) {}
  if (App.user) go(App.page);
};
function openSide() { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); }
function closeSide() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }
H.openSide = openSide; H.closeSide = closeSide;

/* ---- one listener handles every button/typing action on the page ---- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (b.tagName === 'A') e.preventDefault();
  const fn = H[b.dataset.act];
  if (fn) fn(b.dataset.id, b, e);
});
document.addEventListener('change', e => { const b = e.target.closest('[data-chg]'); if (b && H[b.dataset.chg]) H[b.dataset.chg](b.value, b, e); });
document.addEventListener('input', e => { const b = e.target.closest('[data-inp]'); if (b && H[b.dataset.inp]) H[b.dataset.inp](b.value, b, e); });
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !$('#login-screen').hidden && e.target.closest('#login-screen')) H.doLogin();
  if (e.key === 'Escape') closeModal();
});

window.addEventListener('load', () => {
  try {
    const th = localStorage.getItem('portal_theme');
    if (th) { document.documentElement.setAttribute('data-theme', th); $('#theme-btn').textContent = th === 'dark' ? '🌙' : '☀️'; }
    const tid = localStorage.getItem('portal_tenant'); if (tid) $('#lg-tenant').value = tid;
  } catch (e) {}
  $('#login-title').textContent = CONFIG.PLATFORM_NAME;
  document.title = CONFIG.PLATFORM_NAME;
  tryResume();
});
