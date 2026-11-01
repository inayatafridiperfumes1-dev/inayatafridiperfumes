/* ============ Analytics (owner only) ============ */
Pages.reports = async function (el) {
  const [orders, expenses, customers, products] = await Promise.all([load('Orders'), load('Expenses'), load('Customers'), load('Products')]);
  const live = orders.filter(o => o.status !== 'Cancelled');
  const cogs = o => itemsOf(o).reduce((a, i) => a + num(i.cost) * num(i.qty), 0);
  const gross = o => (num(o.total) - num(o.tax)) - cogs(o);
  const opexOf = list => list.filter(e => e.category !== 'Inventory').reduce((s, e) => s + num(e.amount), 0);
  const revenue = sum(live, 'total'), grossAll = live.reduce((s, o) => s + gross(o), 0), opexAll = opexOf(expenses), net = grossAll - opexAll;
  const stockValue = products.reduce((s, p) => s + p.stock * p.cost, 0);

  const keys = monthKeys(6);
  const rows = keys.map(k => {
    const ol = live.filter(o => (o.date || '').slice(0, 7) === k), ex = expenses.filter(e => (e.date || '').slice(0, 7) === k);
    const g = ol.reduce((s, o) => s + gross(o), 0), ox = opexOf(ex);
    return {k, sales:sum(ol, 'total'), orders:ol.length, gross:g, opex:ox, net:g - ox};
  });

  const units = {}; live.forEach(o => itemsOf(o).forEach(i => { units[i.name] = (units[i.name] || 0) + num(i.qty); }));
  const top = Object.keys(units).sort((a, b) => units[b] - units[a]).slice(0, 6);
  const topC = customers.slice().sort((a, b) => b.spent - a.spent).slice(0, 5);

  el.innerHTML = '<div class="head"><h2>Analytics</h2><div class="acts"><button class="btn gold sm" data-act="rptExport">📊 Export full report</button></div></div>' +
    '<div class="grid auto" style="margin-bottom:20px">' + kpi('Total Sales', money(revenue), live.length + ' orders', 'var(--gold)') + kpi('Gross Profit', money(grossAll), revenue ? Math.round(grossAll / revenue * 100) + '% of sales' : '', 'var(--green)') +
    kpi('Operating Expenses', money(opexAll), 'Excludes stock purchases', 'var(--red)') + kpi('Net Profit', money(net), 'Gross − expenses', net >= 0 ? 'var(--green)' : 'var(--red)') +
    kpi('Avg Order', money(live.length ? revenue / live.length : 0), '', 'var(--blue)') + kpi('Stock Value (cost)', money(stockValue), 'Cost × quantity', 'var(--purple)') + '</div>' +
    '<div class="grid g2" style="margin-bottom:16px"><div class="card"><b>Sales vs Net profit</b><div class="chart" style="margin-top:10px"><canvas id="r1"></canvas></div></div><div class="card"><b>Best sellers (units)</b><div class="chart" style="margin-top:10px"><canvas id="r2"></canvas></div></div></div>' +
    '<div class="grid g2" style="margin-bottom:16px"><div class="card sm"><b>Top customers</b>' + (topC.map((c, i) => '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--b)"><span>#' + (i + 1) + ' <strong>' + esc(c.name) + '</strong></span><span style="color:var(--gold);font-weight:700">' + money(c.spent) + '</span></div>').join('') || '<p class="muted">No data yet</p>') + '</div>' +
    '<div class="card sm"><b>Loyalty</b><div style="margin-top:10px;font-size:13px;line-height:1.9">Total points outstanding: <b>' + sum(customers, 'points').toLocaleString() + '</b><br>VIP customers: <b>' + customers.filter(c => c.status === 'VIP').length + '</b><br>Customers: <b>' + customers.length + '</b></div></div></div>' +
    '<div class="card"><b>Month by month</b><div class="tbl" style="margin-top:10px"><table><thead><tr><th>Month</th><th>Sales</th><th>Orders</th><th>Gross profit</th><th>Expenses</th><th>Net profit</th></tr></thead><tbody>' +
    rows.map(r => '<tr><td><strong>' + r.k + '</strong></td><td style="color:var(--gold)">' + money(r.sales) + '</td><td>' + r.orders + '</td><td>' + money(r.gross) + '</td><td style="color:var(--red)">' + money(r.opex) + '</td><td style="font-weight:700;color:' + (r.net >= 0 ? 'var(--green)' : 'var(--red)') + '">' + money(r.net) + '</td></tr>').join('') + '</tbody></table></div></div>' +
    '<p class="muted" style="font-size:11px;margin-top:10px">Profit method: Gross profit = (order total − tax) − product cost at time of sale. Net profit = gross profit − expenses (stock purchases are not counted again).</p>';
  App.reportRows = rows;

  mkChart($('#r1'), {type:'bar', data:{labels:keys, datasets:[{label:'Sales', data:rows.map(r => r.sales), backgroundColor:'rgba(201,168,76,.8)', borderRadius:4}, {label:'Net profit', data:rows.map(r => r.net), backgroundColor:'rgba(52,211,153,.7)', borderRadius:4}]}, options:barOpts()});
  mkChart($('#r2'), {type:'bar', data:{labels:top, datasets:[{label:'Units sold', data:top.map(n => units[n]), backgroundColor:'rgba(96,165,250,.8)', borderRadius:4}]}, options:Object.assign(barOpts(), {indexAxis:'y'})});
};

H.rptExport = async function () {
  const [orders, expenses, customers, products] = await Promise.all([load('Orders'), load('Expenses'), load('Customers'), load('Products')]);
  xlsxSave('Full-Report.xlsx', {
    Monthly: (App.reportRows || []).map(r => ({Month:r.k, Sales:r.sales, Orders:r.orders, 'Gross Profit':r.gross, Expenses:r.opex, 'Net Profit':r.net})),
    Orders: orders.map(o => ({ID:o.id, Date:o.date, Customer:o.customer, Total:o.total, Paid:o.paid, Method:o.method, Status:o.status})),
    Expenses: expenses.map(e => ({Date:e.date, Title:e.title, Category:e.category, Amount:e.amount})),
    Customers: customers.map(c => ({Name:c.name, Phone:c.phone, Orders:c.orders, Spent:c.spent, Points:c.points, Status:c.status})),
    Products: products.map(p => ({SKU:p.sku, Name:p.name, Cost:p.cost, Price:p.price, Margin:p.price - p.cost, Stock:p.stock}))
  });
};
