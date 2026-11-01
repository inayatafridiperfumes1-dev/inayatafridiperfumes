/* ============ Customers & Loyalty ============ */
const CUS = {rows:[], orders:[], q:''};

Pages.customers = async function (el) {
  [CUS.rows, CUS.orders] = await Promise.all([load('Customers'), load('Orders')]); CUS.q = '';
  el.innerHTML = '<div class="head"><h2>Customers <span class="muted" style="font-size:13px;font-family:DM Sans">⭐ ' + sum(CUS.rows, 'points').toLocaleString() + ' points active</span></h2><div class="acts"><input class="search" placeholder="Search…" data-inp="cusSearch"><button class="btn ghost sm" data-act="cusExport">📤 Excel</button><button class="btn gold" data-act="cusEdit">+ Add customer</button></div></div>' +
    '<div class="tbl"><table><thead><tr><th>Customer</th><th>Phone</th><th>City</th><th>Orders</th><th>Spent</th><th>Points</th><th>Status</th><th></th></tr></thead><tbody id="cus-body"></tbody></table></div>';
  drawCus();
};
function drawCus() {
  const q = CUS.q.toLowerCase();
  $('#cus-body').innerHTML = CUS.rows.filter(c => !q || [c.name, c.phone, c.city, c.email].some(x => String(x).toLowerCase().includes(q))).map(c =>
    '<tr><td><strong>' + esc(c.name) + '</strong></td><td>' + esc(c.phone) + '</td><td>' + esc(c.city) + '</td><td>' + c.orders + '</td><td style="color:var(--gold);font-weight:700">' + money(c.spent) + '</td><td>⭐ ' + c.points + '</td><td>' + badge(c.status) + '</td>' +
    '<td><button class="btn ghost sm" data-act="cusView" data-id="' + esc(c.id) + '">View</button></td></tr>').join('') || '<tr><td colspan="8" class="muted" style="text-align:center;padding:30px">No customers yet. They are also created automatically at checkout when you enter a phone number.</td></tr>';
}
H.cusSearch = v => { CUS.q = v; drawCus(); };
H.cusExport = () => xlsxSave('Customers.xlsx', {Customers: CUS.rows.map(c => ({Name:c.name, Phone:c.phone, Email:c.email, City:c.city, Address:c.address, Orders:c.orders, 'Total Spent':c.spent, Points:c.points, Status:c.status, Joined:c.joined}))});

H.cusEdit = function (id) {
  const c = id ? CUS.rows.find(x => x.id === id) : {status:'New'};
  const fields = [{k:'name', label:'Full name'}, {k:'phone', label:'Phone'}, {k:'email', label:'Email', type:'email'}, {k:'city', label:'City'}, {k:'address', label:'Address', wide:true}];
  if (isOwner()) fields.push({k:'status', label:'Status', type:'select', opts:['New','Regular','VIP']}, {k:'points', label:'Loyalty points', type:'number'});
  formModal(id ? 'Edit customer' : 'Add customer', fields, c, async v => { if (id) v.id = id; await save('Customers', v); toast('Customer saved', 'success'); go('customers'); });
};
H.cusView = function (id) {
  const c = CUS.rows.find(x => x.id === id);
  const mine = CUS.orders.filter(o => o.customerId === id).slice().reverse();
  const rp = setting('redeemPoints') || 100, rv = setting('redeemValue');
  openModal(c.name, '<div class="row" style="margin-bottom:12px"><div><div class="muted" style="font-size:12px">' + esc(c.phone) + ' · ' + esc(c.email) + '<br>' + esc(c.address) + ' ' + esc(c.city) + '</div></div><div>' + badge(c.status) + '</div></div>' +
    '<div class="grid g3" style="margin-bottom:14px">' + kpi('Orders', c.orders, '') + kpi('Lifetime spend', money(c.spent), '') + kpi('Points', c.points, '≈ ' + money(Math.floor(c.points / rp) * rv) + ' discount', 'var(--amber)') + '</div>' +
    '<p class="muted" style="font-size:12px;margin-bottom:10px">Earn 1 point per ' + money(setting('pointsPer') || 100) + ' paid · ' + rp + ' points = ' + money(rv) + ' off · VIP at ' + money(setting('vipSpend')) + ' lifetime spend</p>' +
    '<b>Order history</b><div style="margin:8px 0 14px">' + (mine.map(o => '<div class="row" style="padding:7px 0;border-bottom:1px solid var(--b);font-size:13px"><span>' + esc(o.id) + ' · ' + esc(o.date) + '</span><span>' + money(o.total) + ' ' + badge(o.status) + '</span></div>').join('') || '<p class="muted">No orders yet</p>') + '</div>' +
    '<div class="mfoot"><button class="btn ghost" data-act="cusEdit" data-id="' + esc(id) + '">✏️ Edit</button>' + (c.phone ? '<a class="btn green" target="_blank" rel="noopener" href="' + esc(waLink(c.phone, 'Hello ' + c.name + ', ')) + '">WhatsApp</a>' : '') +
    (isOwner() ? '<button class="btn red" data-act="cusDel" data-id="' + esc(id) + '">Delete</button>' : '') + '</div>', true);
};
H.cusDel = async function (id) {
  if (!ask('Delete this customer? Their past orders stay in the system.')) return;
  try { await remove('Customers', id); closeModal(); toast('Customer deleted', 'success'); go('customers'); } catch (e) { toast(e.message, 'error'); }
};
