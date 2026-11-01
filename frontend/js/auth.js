/* ============ Sign in / sign out / licence lock ============ */
let saMode = false;

H.toggleSA = function () {
  saMode = !saMode;
  $('#tenant-fields').hidden = saMode;
  $('#login-title').textContent = saMode ? 'Platform Admin' : CONFIG.PLATFORM_NAME;
  $('#sa-link').textContent = saMode ? '← Back to business sign in' : 'Platform administrator? Sign in here';
  $('#login-error').hidden = true;
};

H.doLogin = async function () {
  const err = $('#login-error'), btn = $('#lg-btn');
  err.hidden = true;
  const pass = $('#lg-pass').value;
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    let r;
    if (saMode) r = await api('master_login', {password: pass});
    else {
      const tid = $('#lg-tenant').value.trim(), usr = $('#lg-user').value.trim();
      try { localStorage.setItem('portal_tenant', tid); } catch (e) {}
      r = await api('login', {tenantId: tid, username: usr, password: pass});
    }
    App.token = r.token;
    try { sessionStorage.setItem('portal_token', r.token); } catch (e) {}
    $('#lg-pass').value = '';
    startApp(r);
  } catch (e) {
    if (e.code !== 'LOCKED') { err.textContent = e.message; err.hidden = false; }
  } finally { btn.disabled = false; btn.textContent = 'Sign In →'; }
};

function startApp(r) {
  App.user = r.user; App.tenant = r.tenant; App.settings = r.settings || {}; App.superadmin = (r.user.role === 'superadmin');
  $('#login-screen').hidden = true; $('#lock-screen').hidden = true; $('#app').hidden = false;
  applyBranding(); buildNav();
  go(App.superadmin ? 'tenants' : 'dashboard');
  clearInterval(App.pinger);
  if (!App.superadmin) App.pinger = setInterval(checkLicence, 5 * 60 * 1000);
}

async function checkLicence() {
  try { const r = await api('ping'); App.tenant = r.tenant; licenceBadge(); } catch (e) { /* lock screen handled in api() */ }
}

function licenceBadge() {
  const t = App.tenant, el = $('#lic-badge');
  if (!t) { el.innerHTML = ''; return; }
  if (t.status === 'Trial') el.innerHTML = '<span class="badge b-amber">Trial · ' + (t.daysLeft === null ? '' : t.daysLeft + ' days left') + '</span>';
  else if (t.daysLeft !== null && t.daysLeft <= 7) el.innerHTML = '<span class="badge b-amber">Renew in ' + t.daysLeft + ' days</span>';
  else el.innerHTML = '';
}

function showLock(msg) {
  clearInterval(App.pinger);
  App.token = null; try { sessionStorage.removeItem('portal_token'); } catch (e) {}
  $('#lock-msg').textContent = msg || 'Subscription Expired / Contact Administrator to Renew';
  $('#app').hidden = true; $('#login-screen').hidden = true; $('#lock-screen').hidden = false;
  closeModal();
}
function expireSession() {
  clearInterval(App.pinger);
  App.token = null; try { sessionStorage.removeItem('portal_token'); } catch (e) {}
  $('#app').hidden = true; $('#login-screen').hidden = false;
  const err = $('#login-error'); err.textContent = 'Your session ended. Please sign in again.'; err.hidden = false;
}
H.backToLogin = function () { $('#lock-screen').hidden = true; $('#login-screen').hidden = false; };

H.logout = async function () {
  try { await api('logout'); } catch (e) {}
  clearInterval(App.pinger);
  try { sessionStorage.removeItem('portal_token'); } catch (e) {}
  location.reload();
};

async function tryResume() {
  let t = null; try { t = sessionStorage.getItem('portal_token'); } catch (e) {}
  if (!t) return;
  App.token = t;
  try { startApp(await api('bootstrap')); } catch (e) { App.token = null; }
}
