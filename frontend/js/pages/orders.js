/* ============ Orders ============ */
const ORD = {rows:[], f:'All', q:''};
const ORDER_STATUSES = ['Pending','Processing','Dispatched','Delivered','Cancelled'];

Pages.orders = async function (el) {
  ORD.rows = (await load('Orders')).slice().reverse(); ORD.f = 'All'; ORD.q = '';
  el.innerHTML = '<div class="head"><h2>Orders</h2><div class="acts"><input class="search" placeholder="Search…" data-inp="ordSearch">' +
    (isOwner() ? '<button class="btn ghost sm" data-act="ordExport">📤 Excel</button>' : '') + '</div></div>' +
    '<div class="acts" style="margin-bottom:16px" id="ord-filters"></div><div class="list" id="ord-list"></div>';
  drawOrdFilters(); drawOrders();
};
function drawOrdFilters() {
  $('#ord-filters').innerHTML = ['All'].concat(ORDER_STATUSES).map(s => '<button class="pill' + (ORD.f === s ? ' active' : '') + '" data-act="ordFilter" data-id="' + s + '">' + s + '</button>').join('');
}
function drawOrders() {
  const q = ORD.q.toLowerCase();
  const rows = ORD.rows.filter(o => (ORD.f === 'All' || o.status === ORD.f) && (!q || [o.id, o.customer, o.phone].some(x => String(x).toLowerCase().includes(q))));
  $('#ord-list').innerHTML = rows.map(o =>
    '<div class="card sm"><div class="row"><div><div style="margin-bottom:6px"><b style="color:var(--gold);font-family:monospace">' + esc(o.id) + '</b> ' + badge(o.status) + ' <span class="muted" style="font-size:11px">' + esc(o.date) + ' · ' + esc(o.method) + ' · by ' + esc(o.cashier) + '</span></div>' +
    '<div style="font-size:15px;font-weight:700">' + esc(o.customer) + '</div><div class="muted" style="font-size:12px">' + esc(o.phone) + '</div>' +
    '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' + itemsOf(o).map(i => '<span class="chip">' + esc(i.name) + ' ×' + esc(i.qty) + '</span>').join('') + '</div></div>' +
    '<div style="text-align:right"><div style="font-size:18px;font-weight:800;color:var(--gold)">' + money(o.total) + '</div>' +
    '<div style="font-size:11px;color:var(--green)">Paid ' + money(o.paid) + '</div>' + (num(o.total) > num(o.paid) ? '<div style="font-size:11px;color:var(--amber)">Due ' + money(num(o.total) - num(o.paid)) + '</div>' : '') +
    '<select style="width:auto;margin:8px 0" data-chg="ordStatus" data-id="' + esc(o.id) + '"' + (o.status === 'Cancelled' ? ' disabled' : '') + '>' + ORDER_STATUSES.map(s => '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
    '<div class="acts" style="justify-content:flex-end"><button class="btn blue sm" data-act="ordView" data-id="' + esc(o.id) + '">Receipt</button><button class="btn ghost sm" data-act="ordPdf" data-id="' + esc(o.id) + '">📄 PDF</button></div></div></div></div>').join('') ||
    '<div class="card muted" style="text-align:center">No orders found</div>';
}
H.ordSearch = v => { ORD.q = v; drawOrders(); };
H.ordFilter = id => { ORD.f = id; drawOrdFilters(); drawOrders(); };
H.ordView = id => { const o = ORD.rows.find(x => x.id === id); openModal('Receipt ' + id, receiptHtml(o) + '<div class="mfoot"><button class="btn ghost" id="rv-print">🖨️ Print</button><button class="btn gold" id="rv-pdf">📄 PDF</button></div>'); $('#rv-print').onclick = () => printReceipt(o); $('#rv-pdf').onclick = () => invoicePDF(o); };
H.ordPdf = id => invoicePDF(ORD.rows.find(x => x.id === id));
H.ordStatus = async function (val, el) {
  const id = el.dataset.id, o = ORD.rows.find(x => x.id === id), prev = o.status;
  if (val === 'Cancelled' && !ask('Cancel order ' + id + '? Stock will be returned and points reversed. This cannot be undone.')) { el.value = prev; return; }
  try { await save('Orders', {id: id, status: val}); o.status = val; toast(id + ' → ' + val, 'success'); if (val === 'Cancelled') drawOrders(); }
  catch (e) { toast(e.message, 'error'); el.value = prev; }
};
H.ordExport = () => xlsxSave('Orders.xlsx', {Orders: ORD.rows.map(o => ({ID:o.id, Date:o.date, Customer:o.customer, Phone:o.phone, Items:itemsOf(o).map(i => i.name + ' x' + i.qty).join(', '), Total:o.total, Discount:o.discount, Tax:o.tax, Paid:o.paid, Method:o.method, Status:o.status, Cashier:o.cashier}))});
