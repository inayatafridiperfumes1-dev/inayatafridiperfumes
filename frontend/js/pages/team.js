/* ============ Team (logins + payroll) and Tasks ============ */
const TEAM = {users:[], staff:[]}, TSK = {rows:[], users:[]};

Pages.team = async function (el) {
  const [u, staff] = await Promise.all([api('users_list'), load('Staff')]);
  TEAM.users = u.users; TEAM.staff = staff;
  el.innerHTML = '<div class="head"><h2>Login accounts</h2><div class="acts"><button class="btn gold" data-act="usrEdit">+ Add login</button></div></div>' +
    '<p class="muted" style="font-size:12px;margin-bottom:12px"><b>Owner</b> = everything · <b>Manager</b> = POS, orders, customers, shipments (no profit, costs, payroll or deleting) · <b>Staff</b> = view-only tasks</p>' +
    '<div class="tbl" style="margin-bottom:28px"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>' +
    TEAM.users.map(x => '<tr><td><strong>' + esc(x.name) + '</strong></td><td>' + esc(x.username) + '</td><td>' + badge(x.role) + '</td><td>' + badge(x.status) + '</td><td style="white-space:nowrap"><button class="btn ghost sm" data-act="usrEdit" data-id="' + esc(x.username) + '">Edit</button> <button class="btn red sm" data-act="usrDel" data-id="' + esc(x.username) + '">Del</button></td></tr>').join('') + '</tbody></table></div>' +
    '<div class="head"><h2>Staff records & payroll</h2><div class="acts"><button class="btn gold" data-act="stfEdit">+ Add staff</button></div></div>' +
    '<div class="grid g2" style="margin-bottom:16px">' + kpi('Staff members', staff.length, staff.filter(s => s.status === 'Active').length + ' active', 'var(--purple)') + kpi('Monthly payroll', money(sum(staff.filter(s => s.status === 'Active'), 'salary')), 'Active staff', 'var(--amber)') + '</div>' +
    '<div class="tbl"><table><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Salary / month</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody>' +
    (staff.map(s => '<tr><td><strong>' + esc(s.name) + '</strong></td><td>' + esc(s.role) + '</td><td>' + esc(s.phone) + '</td><td style="color:var(--gold);font-weight:700">' + money(s.salary) + '</td><td>' + esc(s.joined) + '</td><td>' + badge(s.status) + '</td><td style="white-space:nowrap"><button class="btn ghost sm" data-act="stfEdit" data-id="' + esc(s.id) + '">Edit</button> <button class="btn red sm" data-act="stfDel" data-id="' + esc(s.id) + '">Del</button></td></tr>').join('') || '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">No staff records yet</td></tr>') + '</tbody></table></div>';
};
H.usrEdit = function (username) {
  const u = username ? TEAM.users.find(x => x.username === username) : {role:'manager', status:'Active'};
  formModal(username ? 'Edit login' : 'Add login', [
    {k:'name', label:'Full name'}, {k:'username', label:'Username (or email)', ro:!!username},
    {k:'role', label:'Role', type:'select', opts:['owner','manager','staff']}, {k:'status', label:'Status', type:'select', opts:['Active','Inactive']},
    {k:'password', label:username ? 'New password (leave empty to keep)' : 'Password (min 6)', type:'text', wide:true}
  ], u, async v => { await api('user_save', {user: v}); toast('Login saved', 'success'); go('team'); });
};
H.usrDel = async function (username) {
  if (!ask('Delete the login "' + username + '"?')) return;
  try { await api('user_remove', {username: username}); go('team'); } catch (e) { toast(e.message, 'error'); }
};
H.stfEdit = function (id) {
  const s = id ? TEAM.staff.find(x => x.id === id) : {status:'Active'};
  formModal(id ? 'Edit staff' : 'Add staff', [
    {k:'name', label:'Full name'}, {k:'role', label:'Job title'}, {k:'phone', label:'Phone'}, {k:'salary', label:'Monthly salary', type:'number'},
    {k:'joined', label:'Joined', type:'date', def:today()}, {k:'status', label:'Status', type:'select', opts:['Active','Inactive']}
  ], s, async v => { if (id) v.id = id; await save('Staff', v); toast('Saved', 'success'); go('team'); });
};
H.stfDel = async function (id) { if (!ask('Remove this staff record?')) return; try { await remove('Staff', id); go('team'); } catch (e) { toast(e.message, 'error'); } };

/* ---------- Tasks ---------- */
Pages.tasks = async function (el) {
  const canEdit = App.user.role !== 'staff';
  TSK.rows = (await load('Tasks')).slice().reverse();
  if (canEdit) { try { TSK.users = (await api('users_list')).users; } catch (e) { TSK.users = []; } }
  el.innerHTML = '<div class="head"><h2>' + (canEdit ? 'Tasks & schedule' : 'My tasks') + '</h2><div class="acts">' + (canEdit ? '<button class="btn gold" data-act="tskEdit">+ New task</button>' : '') + '</div></div>' +
    (canEdit ? '' : '<p class="muted" style="font-size:12px;margin-bottom:12px">View-only: ask your manager to update a task.</p>') +
    '<div class="tbl"><table><thead><tr><th>Date</th><th>Task</th><th>Assigned to</th><th>Status</th>' + (canEdit ? '<th></th>' : '') + '</tr></thead><tbody>' +
    (TSK.rows.map(t => '<tr><td>' + esc(t.date) + '</td><td><strong>' + esc(t.title) + '</strong><br><span class="muted" style="font-size:12px">' + esc(t.note) + '</span></td><td>' + esc(t.assignee) + '</td><td>' + badge(t.status) + '</td>' +
      (canEdit ? '<td style="white-space:nowrap"><button class="btn ghost sm" data-act="tskEdit" data-id="' + esc(t.id) + '">Edit</button>' + (isOwner() ? ' <button class="btn red sm" data-act="tskDel" data-id="' + esc(t.id) + '">Del</button>' : '') + '</td>' : '') + '</tr>').join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:28px">No tasks</td></tr>') + '</tbody></table></div>';
};
H.tskEdit = function (id) {
  const t = id ? TSK.rows.find(x => x.id === id) : {};
  formModal(id ? 'Edit task' : 'New task', [
    {k:'title', label:'Task', wide:true}, {k:'assignee', label:'Assign to', type:'select', opts:[{v:'', l:'— anyone —'}].concat(TSK.users.map(u => ({v:u.username, l:u.name + ' (' + u.role + ')'})))},
    {k:'date', label:'Date', type:'date', def:today()}, {k:'status', label:'Status', type:'select', opts:['Open','Done']}, {k:'note', label:'Details'}
  ], t, async v => { if (id) v.id = id; await save('Tasks', v); toast('Task saved', 'success'); go('tasks'); });
};
H.tskDel = async function (id) { if (!ask('Delete this task?')) return; try { await remove('Tasks', id); go('tasks'); } catch (e) { toast(e.message, 'error'); } };
