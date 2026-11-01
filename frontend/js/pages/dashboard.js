/* ============ Dashboard ============ */
Pages.dashboard = async function (el) {
  if (App.user.role === 'staff') return staffHome(el);
  const owner = isOwner();
  const [orders, products, customers] = await Promise.all([load('Orders'), load('Products'), load('Customers')]);
  const expenses = owner ? await load('Expenses') : [];
  const live = orders.filter(o => o.status !== 'Cancelled');
  const t = today(), mk = t.slice(0, 7);
  const todays = live.filter(o => o.date === t), month = live.filter(o => (o.date || '').slice(0, 7) === mk);
  const lowItems = products.filter(p => p.stock <= p.minStock);
  const outstanding = live.reduce((s, o) => s + Math.max(0, num(o.total) - num(o.paid)), 0);

  let ownerKpis = '';
  if (owner) {
    const gross = month.reduce((s, o) => s + (num(o.total) - num(o.tax)) - itemsOf(o).reduce((a, i) => a + num(i.cost) * num(i.qty), 0), 0);
    const opex = expenses.filter(e => (e.date || '').slice(0, 7) === mk && e.category !== 'Inventory').reduce((s, e) => s + num(e.amount), 0);
    ownerKpis = kpi('Gross Profit (month)', money(gross), 'Sales minus product cost', 'var(--green)') +
      kpi('Expenses (month)', money(opex), 'Excludes stock purchases', 'var(--red)') +
      kpi('Net Profit (month)', money(gross - opex), 'Gross profit − expenses', gross - opex >= 0 ? 'var(--green)' : 'var(--red)');
  }

  el.innerHTML =
    '<h2 style="margin-bottom:4px">Welcome, ' + esc(App.user.name) + '</h2><p class="muted" style="font-size:13px;margin-bottom:18px">' + esc(new Date().toDateString()) + '</p>' +
    '<div class="grid auto" style="margin-bottom:20px">' +
      kpi("Today's Sales", money(sum(todays, 'total')), todays.length + ' orders', 'var(--gold)') +
      kpi('Sales This Month', money(sum(month, 'total')), month.length + ' orders', 'var(--blue)') +
      kpi('Outstanding Balance', money(outstanding), 'Unpaid / COD', 'var(--amber)') +
      kpi('Stock Alerts', lowItems.length, 'Low or out of stock', lowItems.length ? 'var(--red)' : 'var(--green)') +
      kpi('Customers', customers.length, customers.filter(c => c.status === 'VIP').length + ' VIP', 'var(--purple)') + ownerKpis +
    '</div>' +
    '<div class="grid g2" style="margin-bottom:16px"><div class="card"><b>Sales' + (owner ? ' vs Expenses' : '') + ' (6 months)</b><div class="chart" style="margin-top:10px"><canvas id="c1"></canvas></div></div>' +
    '<div class="card"><b>⚠️ Stock alerts</b><div style="margin-top:10px">' +
      (lowItems.length ? lowItems.slice(0, 8).map(p => '<div class="row" style="padding:7px 0;border-bottom:1px solid var(--b)"><span>' + esc(p.name) + '</span><span>' + badge(p.stock === 0 ? 'Out of Stock' : 'Low Stock') + ' <span class="muted">' + p.stock + ' left</span></span></div>').join('') : '<p class="muted">All products are well stocked 👍</p>') +
    '</div></div></div>' +
    '<div class="card"><b>Recent orders</b><div style="margin-top:10px">' +
      (orders.slice(-6).reverse().map(o => '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--b)"><span><strong>' + esc(o.customer) + '</strong> <span class="muted">' + esc(o.id) + ' · ' + esc(o.date) + '</span></span><span>' + money(o.total) + ' ' + badge(o.status) + '</span></div>').join('') || '<p class="muted">No orders yet. Make your first sale in POS!</p>') +
    '</div></div>';

  const keys = monthKeys(6);
  const sales = keys.map(k => sum(live.filter(o => (o.date || '').slice(0, 7) === k), 'total'));
  const ds = [{label:'Sales', data:sales, borderColor:'#C9A84C', backgroundColor:'rgba(201,168,76,.12)', tension:.4, fill:true}];
  if (owner) ds.push({label:'Expenses', data:keys.map(k => sum(expenses.filter(e => (e.date || '').slice(0, 7) === k), 'amount')), borderColor:'#f87171', tension:.4, borderDash:[5, 4]});
  mkChart($('#c1'), {type:'line', data:{labels:keys, datasets:ds}, options:barOpts()});
};

async function staffHome(el) {
  const tasks = await load('Tasks');
  el.innerHTML = '<h2 style="margin-bottom:14px">Hello, ' + esc(App.user.name) + '</h2><div class="card"><b>My tasks & schedule</b><div style="margin-top:10px">' +
    (tasks.length ? tasks.map(t => '<div class="row" style="padding:9px 0;border-bottom:1px solid var(--b)"><span><strong>' + esc(t.title) + '</strong><br><span class="muted" style="font-size:12px">' + esc(t.note) + '</span></span><span>' + esc(t.date) + ' ' + badge(t.status) + '</span></div>').join('') : '<p class="muted">Nothing assigned to you right now.</p>') +
    '</div></div><p class="muted" style="margin-top:12px;font-size:12px">Your access is view-only.</p>';
}
