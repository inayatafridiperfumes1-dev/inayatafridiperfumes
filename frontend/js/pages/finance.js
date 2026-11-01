/* ============ Payments, Expenses, Bookings ============ */
const PAYS = {rows:[]}, EXPS = {rows:[]}, BKS = {rows:[]};

/* ---------- Payments ---------- */
Pages.payments = async function (el) {
  PAYS.rows = (await load('Payments')).slice().reverse();
  const conf = PAYS.rows.filter(p => p.status === 'Confirmed'), pend = PAYS.rows.filter(p => p.status === 'Pending');
  const net = conf.reduce((s, p) => s + (p.type === 'Refund' ? -p.amount : p.amount), 0);
  el.innerHTML = '<div class="head"><h2>Payments & Ledger</h2><div class="acts">' + (isOwner() ? '<button class="btn ghost sm" data-act="payExport">📤 Excel</button>' : '') + '<button class="btn gold" data-act="payEdit">+ Record payment</button></div></div>' +
    '<div class="grid g3" style="margin-bottom:20px">' + kpi('Confirmed (net)', money(net), conf.length + ' payments', 'var(--green)') + kpi('Pending / COD', money(sum(pend, 'amount')), pend.length + ' waiting', 'var(--amber)') + kpi('All entries', PAYS.rows.length, '', 'var(--gold)') + '</div>' +
    '<div class="tbl"><table><thead><tr><th>Ref</th><th>Date</th><th>Customer</th><th>Order</th><th>Amount</th><th>Method</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>' +
    (PAYS.rows.map(p => '<tr><td style="font-family:monospace;font-size:11px">' + esc(p.id) + '</td><td>' + esc(p.date) + '</td><td><strong>' + esc(p.customer) + '</strong></td><td>' + esc(p.orderId) + '</td><td style="font-weight:700;color:' + (p.type === 'Refund' ? 'var(--red)' : 'var(--gold)') + '">' + (p.type === 'Refund' ? '-' : '') + money(p.amount) + '</td><td>' + esc(p.method) + '</td><td>' + esc(p.type) + '</td><td>' + badge(p.status) + '</td><td style="white-space:nowrap">' +
      (p.status === 'Pending' ? '<button class="btn green sm" data-act="payConfirm" data-id="' + esc(p.id) + '">Mark received</button> ' : '') +
      (isOwner() ? '<button class="btn red sm" data-act="payDel" data-id="' + esc(p.id) + '">Del</button>' : '') + '</td></tr>').join('') || '<tr><td colspan="9" class="muted" style="text-align:center;padding:30px">No payments yet</td></tr>') +
    '</tbody></table></div>';
};
H.payConfirm = async function (id) { try { await save('Payments', {id: id, status: 'Confirmed'}); toast('Payment confirmed — order balance updated', 'success'); go('payments'); } catch (e) { toast(e.message, 'error'); } };
H.payDel = async function (id) { if (!ask('Delete this payment record permanently?')) return; try { await remove('Payments', id); go('payments'); } catch (e) { toast(e.message, 'error'); } };
H.payExport = () => xlsxSave('Payments.xlsx', {Payments: PAYS.rows.map(p => ({Ref:p.id, Date:p.date, Customer:p.customer, Order:p.orderId, Amount:p.amount, Method:p.method, Type:p.type, Status:p.status, Note:p.note}))});
H.payEdit = async function () {
  const orders = (await load('Orders')).filter(o => o.status !== 'Cancelled').slice().reverse();
  formModal('Record payment', [
    {k:'orderId', label:'Order (optional)', type:'select', opts:[{v:'', l:'— none —'}].concat(orders.map(o => ({v:o.id, l:o.id + ' · ' + o.customer + ' (due ' + money(Math.max(0, o.total - o.paid)) + ')'})))},
    {k:'customer', label:'Customer name'}, {k:'amount', label:'Amount', type:'number'},
    {k:'method', label:'Method', type:'select', opts:['Cash','EasyPaisa','JazzCash','Bank Transfer','Card','COD']},
    {k:'type', label:'Type', type:'select', opts:['Full Payment','Advance','Partial','COD','Refund']},
    {k:'status', label:'Status', type:'select', opts:['Confirmed','Pending']},
    {k:'date', label:'Date', type:'date', def:today()}, {k:'note', label:'Note'}
  ], {}, async v => {
    if (!v.customer && v.orderId) { const o = orders.find(x => x.id === v.orderId); if (o) v.customer = o.customer; }
    if (!v.customer) throw new Error('Please enter the customer name.');
    await save('Payments', v); toast('Payment recorded', 'success'); go('payments');
  });
};

/* ---------- Expenses (owner only) ---------- */
Pages.expenses = async function (el) {
  EXPS.rows = (await load('Expenses')).slice().reverse();
  const cats = {}; EXPS.rows.forEach(e => { cats[e.category || 'Other'] = (cats[e.category || 'Other'] || 0) + e.amount; });
  const names = Object.keys(cats), total = sum(EXPS.rows, 'amount');
  el.innerHTML = '<div class="head"><h2>Expenses</h2><div class="acts"><button class="btn ghost sm" data-act="expExport">📤 Excel</button><button class="btn gold" data-act="expEdit">+ Add expense</button></div></div>' +
    '<div class="grid g2" style="margin-bottom:18px"><div class="card"><div class="kpi" style="border:none;padding:0"><div class="l">Total expenses (all time)</div><div class="v" style="color:var(--red)">' + money(total) + '</div></div>' +
    names.sort((a, b) => cats[b] - cats[a]).map(n => '<div class="row" style="padding:6px 0;border-bottom:1px solid var(--b);font-size:13px"><span>' + esc(n) + '</span><span><b>' + money(cats[n]) + '</b> <span class="muted">' + Math.round(cats[n] / total * 100) + '%</span></span></div>').join('') + '</div>' +
    '<div class="card"><b>Breakdown</b><div class="chart" style="margin-top:10px"><canvas id="exp-c"></canvas></div></div></div>' +
    '<div class="tbl"><table><thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Paid via</th><th>Note</th><th></th></tr></thead><tbody>' +
    (EXPS.rows.map(e => '<tr><td>' + esc(e.date) + '</td><td><strong>' + esc(e.title) + '</strong></td><td>' + esc(e.category) + '</td><td style="color:var(--red);font-weight:700">' + money(e.amount) + '</td><td>' + esc(e.paidVia) + '</td><td>' + esc(e.note) + '</td><td style="white-space:nowrap"><button class="btn ghost sm" data-act="expEdit" data-id="' + esc(e.id) + '">Edit</button> <button class="btn red sm" data-act="expDel" data-id="' + esc(e.id) + '">Del</button></td></tr>').join('') || '<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">No expenses yet</td></tr>') + '</tbody></table></div>';
  if (names.length) mkChart($('#exp-c'), {type:'doughnut', data:{labels:names, datasets:[{data:names.map(n => cats[n]), backgroundColor:['#C9A84C','#f472b6','#60a5fa','#a78bfa','#34d399','#f87171','#fb923c'], borderWidth:0}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{color:chartColors().text}}}}});
};
H.expEdit = function (id) {
  const e = id ? EXPS.rows.find(x => x.id === id) : {};
  formModal(id ? 'Edit expense' : 'Add expense', [
    {k:'title', label:'Title', wide:true}, {k:'category', label:'Category', type:'select', opts:['Operations','Shipping','Marketing','Inventory','Salaries','Utilities','Rent','Other']},
    {k:'amount', label:'Amount', type:'number'}, {k:'paidVia', label:'Paid via', type:'select', opts:['Cash','Bank','EasyPaisa','JazzCash','Card']},
    {k:'date', label:'Date', type:'date', def:today()}, {k:'note', label:'Note', type:'text'}
  ], e, async v => { if (id) v.id = id; await save('Expenses', v); toast('Expense saved', 'success'); go('expenses'); });
};
H.expDel = async function (id) { if (!ask('Delete this expense?')) return; try { await remove('Expenses', id); go('expenses'); } catch (e) { toast(e.message, 'error'); } };
H.expExport = () => xlsxSave('Expenses.xlsx', {Expenses: EXPS.rows.map(e => ({Date:e.date, Title:e.title, Category:e.category, Amount:e.amount, 'Paid Via':e.paidVia, Note:e.note}))});

/* ---------- Bookings (advance orders) ---------- */
Pages.bookings = async function (el) {
  BKS.rows = (await load('Bookings')).slice().reverse();
  const act = BKS.rows.filter(b => b.status !== 'Cancelled' && b.status !== 'Fulfilled');
  el.innerHTML = '<div class="head"><h2>Advance Bookings</h2><div class="acts"><button class="btn gold" data-act="bkEdit">+ New booking</button></div></div>' +
    '<div class="grid g3" style="margin-bottom:20px">' + kpi('Open bookings', act.length, 'Waiting to fulfil', 'var(--gold)') + kpi('Advance held', money(sum(act, 'advance')), '', 'var(--green)') + kpi('Balance due', money(sum(act, 'due')), 'On delivery', 'var(--amber)') + '</div>' +
    '<div class="list">' + (BKS.rows.map(b => '<div class="card sm"><div class="row"><div><b style="color:var(--gold);font-family:monospace">' + esc(b.id) + '</b> ' + badge(b.status) + '<div style="font-size:15px;font-weight:700;margin-top:6px">' + esc(b.customer) + '</div><div class="muted" style="font-size:12px">' + esc(b.phone) + '</div><div style="margin-top:6px;font-size:13px">📦 ' + esc(b.product) + ' × ' + b.qty + '</div>' + (b.note ? '<div class="muted" style="font-size:12px;font-style:italic">' + esc(b.note) + '</div>' : '') + '<div class="muted" style="font-size:11px;margin-top:4px">Booked ' + esc(b.booked) + ' · Delivery ' + esc(b.delivery) + '</div></div>' +
      '<div style="text-align:right"><div class="tot"><span style="margin-right:14px">Total</span><b>' + money(b.total) + '</b></div><div class="tot" style="color:var(--green)"><span>Advance</span><b>' + money(b.advance) + '</b></div><div class="tot" style="color:var(--amber)"><span>Due</span><b>' + money(b.due) + '</b></div><div class="acts" style="margin-top:8px;justify-content:flex-end"><button class="btn ghost sm" data-act="bkEdit" data-id="' + esc(b.id) + '">Edit</button>' + (isOwner() ? '<button class="btn red sm" data-act="bkDel" data-id="' + esc(b.id) + '">Del</button>' : '') + '</div></div></div></div>').join('') || '<div class="card muted" style="text-align:center">No bookings yet</div>') + '</div>';
};
H.bkEdit = async function (id) {
  const b = id ? BKS.rows.find(x => x.id === id) : {};
  let prods = []; try { prods = await load('Products'); } catch (e) {}
  formModal(id ? 'Edit booking' : 'New booking', [
    {k:'customer', label:'Customer'}, {k:'phone', label:'Phone'},
    {k:'product', label:'Product', type:'select', opts:[''].concat(prods.map(p => p.name))}, {k:'qty', label:'Quantity', type:'number', def:1},
    {k:'total', label:'Total amount', type:'number'}, {k:'advance', label:'Advance paid', type:'number'},
    {k:'booked', label:'Booking date', type:'date', def:today()}, {k:'delivery', label:'Delivery date', type:'date'},
    {k:'status', label:'Status', type:'select', opts:['Confirmed','Awaiting Stock','Fulfilled','Cancelled']}, {k:'note', label:'Note'}
  ], b, async v => { if (id) v.id = id; await save('Bookings', v); toast('Booking saved', 'success'); go('bookings'); });
};
H.bkDel = async function (id) { if (!ask('Delete this booking?')) return; try { await remove('Bookings', id); go('bookings'); } catch (e) { toast(e.message, 'error'); } };
