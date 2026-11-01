/* ============ Super Admin: the master list of businesses ============ */
const SA = {rows:[]};

Pages.tenants = async function (el) {
  SA.rows = (await api('master_list')).tenants;
  const c = s => SA.rows.filter(t => t.effective === s).length;
  el.innerHTML = '<div class="head"><h2>Businesses (tenants)</h2><div class="acts"><button class="btn gold" data-act="saCreate">+ Onboard new business</button></div></div>' +
    '<div class="grid auto" style="margin-bottom:20px">' + kpi('Total', SA.rows.length, '', 'var(--gold)') + kpi('Active', c('Active'), '', 'var(--green)') + kpi('Trial', c('Trial'), '', 'var(--amber)') + kpi('Blocked / Expired', c('Blocked') + c('Expired'), '', 'var(--red)') + '</div>' +
    '<div class="tbl"><table><thead><tr><th>Business ID</th><th>Business</th><th>Owner</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead><tbody>' +
    (SA.rows.map(t => '<tr><td style="font-family:monospace;font-weight:700;color:var(--gold)">' + esc(t.tenantId) + '</td><td><strong>' + esc(t.businessName) + '</strong><br><span class="muted" style="font-size:11px">' + esc(t.notes) + '</span></td>' +
      '<td>' + esc(t.ownerName) + '<br><span class="muted" style="font-size:11px">' + esc(t.ownerEmail) + '</span></td>' +
      '<td>' + badge(t.effective) + (t.effective !== t.status ? '<br><span class="muted" style="font-size:10px">set: ' + esc(t.status) + '</span>' : '') + '</td>' +
      '<td>' + esc(t.expiry || '—') + (t.daysLeft !== null ? '<br><span class="muted" style="font-size:11px">' + (t.daysLeft >= 0 ? t.daysLeft + ' days left' : Math.abs(t.daysLeft) + ' days ago') + '</span>' : '') + '</td>' +
      '<td><div class="acts">' + (t.status === 'Blocked' ? '<button class="btn green sm" data-act="saStatus" data-id="' + esc(t.tenantId) + '" data-s="Active">Unblock</button>' : '<button class="btn red sm" data-act="saStatus" data-id="' + esc(t.tenantId) + '" data-s="Blocked">Block</button>') +
      '<button class="btn blue sm" data-act="saExtend" data-id="' + esc(t.tenantId) + '" data-d="30">+30d</button><button class="btn blue sm" data-act="saExtend" data-id="' + esc(t.tenantId) + '" data-d="365">+1yr</button>' +
      '<button class="btn ghost sm" data-act="saEdit" data-id="' + esc(t.tenantId) + '">Edit</button><button class="btn ghost sm" data-act="saReset" data-id="' + esc(t.tenantId) + '">Reset password</button>' +
      '<a class="btn ghost sm" target="_blank" rel="noopener" href="' + esc(t.sheetUrl) + '">Open data</a></div></td></tr>').join('') || '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px">No businesses yet — click “Onboard new business”.</td></tr>') + '</tbody></table></div>';
};

function randPw() { const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 10; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }

H.saCreate = function () {
  formModal('Onboard a new business', [
    {k:'businessName', label:'Business name'}, {k:'ownerName', label:'Owner name'},
    {k:'ownerEmail', label:'Owner email (this is their username)', type:'email'}, {k:'password', label:'Starting password', type:'text', def:randPw()},
    {k:'status', label:'Plan', type:'select', opts:['Trial', 'Active']}, {k:'expiry', label:'Expiry date', type:'date', def:addDays(today(), 14)},
    {k:'notes', label:'Notes (private)', wide:true}
  ], {}, async v => {
    toast('Creating the business database… this takes about 15 seconds', 'info');
    const r = await api('master_create', v);
    openModal('✅ Business created', '<p style="font-size:13px;margin-bottom:12px">Send these sign-in details to the owner. The password is shown only now.</p>' +
      '<div class="card" style="font-family:monospace;font-size:14px;line-height:2">Website: <b>' + esc(location.href.split('#')[0]) + '</b><br>Business ID: <b>' + esc(r.tenantId) + '</b><br>Username: <b>' + esc(r.username) + '</b><br>Password: <b>' + esc(r.password) + '</b><br>Valid until: <b>' + esc(r.expiry) + '</b></div>' +
      '<div class="mfoot"><button class="btn gold" data-act="closeModal">Done</button></div>');
    go('tenants');
  });
};
H.saStatus = async function (id, b) {
  if (b.dataset.s === 'Blocked' && !ask('Block ' + id + '? Everyone in that business is locked out immediately.')) return;
  try { await api('master_update', {tenantId: id, status: b.dataset.s}); toast(id + ' is now ' + b.dataset.s, 'success'); go('tenants'); } catch (e) { toast(e.message, 'error'); }
};
H.saExtend = async function (id, b) {
  const t = SA.rows.find(x => x.tenantId === id), base = (t.expiry && t.expiry > today()) ? t.expiry : today();
  const nx = addDays(base, Number(b.dataset.d));
  try { await api('master_update', {tenantId: id, expiry: nx, status: t.status === 'Blocked' || t.status === 'Expired' ? 'Active' : t.status}); toast('Valid until ' + nx, 'success'); go('tenants'); } catch (e) { toast(e.message, 'error'); }
};
H.saEdit = function (id) {
  const t = SA.rows.find(x => x.tenantId === id);
  formModal('Edit ' + id, [
    {k:'businessName', label:'Business name'}, {k:'status', label:'Status', type:'select', opts:['Active','Trial','Blocked','Expired']},
    {k:'expiry', label:'Expiry date', type:'date'}, {k:'notes', label:'Notes'}
  ], t, async v => { v.tenantId = id; await api('master_update', v); toast('Saved', 'success'); go('tenants'); });
};
H.saReset = function (id) {
  formModal('Reset owner password — ' + id, [{k:'newPassword', label:'New password (min 6)', type:'text', def:randPw(), wide:true}], {}, async v => {
    await api('master_resetpw', {tenantId: id, newPassword: v.newPassword});
    toast('Password reset. New password: ' + v.newPassword, 'success');
  });
};
