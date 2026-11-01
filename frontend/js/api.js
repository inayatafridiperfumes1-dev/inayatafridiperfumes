/* ============ Talks to the Google Apps Script backend ============ */
async function api(action, payload) {
  if (!CONFIG.API_URL || CONFIG.API_URL.indexOf('PASTE_YOUR') === 0) {
    throw new Error('The website is not connected yet. Open js/config.js and paste your Web app URL.');
  }
  const body = JSON.stringify(Object.assign({}, payload || {}, {action: action, token: App.token}));
  let res;
  try {
    // text/plain keeps the browser from sending a "preflight" request that Google Apps Script cannot answer
    res = await fetch(CONFIG.API_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: body});
  } catch (e) {
    throw new Error('Cannot reach the server. Check your internet connection.');
  }
  let j;
  try { j = await res.json(); } catch (e) {
    throw new Error('Unexpected reply from the server. Make sure the Web App is deployed with access set to "Anyone".');
  }
  if (!j.ok) {
    if (j.code === 'LOCKED') showLock(j.error);
    else if (j.code === 'AUTH' && App.token) expireSession();
    const err = new Error(j.error || 'Something went wrong'); err.code = j.code; throw err;
  }
  return j;
}

async function load(table, force) {
  if (!force && App.cache[table]) return App.cache[table];
  const r = await api('list', {table: table});
  App.cache[table] = r.rows;
  return r.rows;
}
function drop() { Array.from(arguments).forEach(t => delete App.cache[t]); }
async function save(table, record) { const r = await api('save', {table: table, record: record}); drop(table); return r.record; }
async function remove(table, id) { await api('remove', {table: table, id: id}); drop(table); }
