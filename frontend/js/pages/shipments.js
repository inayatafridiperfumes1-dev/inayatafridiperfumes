/* ============ Shipments & Tracking ============ */
const SHP = {rows:[], f:'All'};
const SHIP_STEPS = ['Processing', 'In Transit', 'Out for Delivery', 'Delivered'];

Pages.shipments = async function (el) {
  SHP.rows = (await load('Shipments')).slice().reverse(); SHP.f = 'All';
  el.innerHTML = '<div class="head"><h2>Shipments & Tracking</h2><div class="acts"><button class="btn gold" data-act="shpEdit">+ New shipment</button></div></div>' +
    '<div class="acts" style="margin-bottom:16px" id="shp-filters"></div><div class="list" id="shp-list"></div>';
  drawShp();
};
function drawShp() {
  $('#shp-filters').innerHTML = ['All'].concat(SHIP_STEPS).map(s => '<button class="pill' + (SHP.f === s ? ' active' : '') + '" data-act="shpFilter" data-id="' + s + '">' + s + '</button>').join('');
  const rows = SHP.rows.filter(s => SHP.f === 'All' || s.status === SHP.f);
  $('#shp-list').innerHTML = rows.map(s => {
    const ci = SHIP_STEPS.indexOf(s.status), url = CONFIG.COURIERS[s.courier] || '', next = SHIP_STEPS[ci + 1];
    return '<div class="card sm"><div class="row"><div><b style="color:var(--gold);font-family:monospace">' + esc(s.id) + '</b> <span class="muted" style="font-size:11px">→ ' + esc(s.orderId) + '</span> ' + badge(s.status) +
      '<div style="font-size:15px;font-weight:700;margin-top:6px">' + esc(s.customer) + '</div><div class="muted" style="font-size:12px">' + esc(s.product) + ' · ' + esc(s.city) + '</div></div>' +
      '<div style="text-align:right;font-size:12px"><div>Courier: <b>' + esc(s.courier) + '</b></div>' +
      (s.tracking ? (url ? '<a target="_blank" rel="noopener" href="' + esc(url + s.tracking) + '" style="font-family:monospace">' + esc(s.tracking) + ' 🔗</a>' : '<span style="font-family:monospace">' + esc(s.tracking) + '</span>') : '') +
      '<div class="muted">Sent ' + esc(s.sent) + ' · ETA ' + esc(s.eta) + '</div></div></div>' +
      '<div class="steps">' + SHIP_STEPS.map((st, i) => '<div class="step' + (i <= ci ? ' done' : '') + '"><i></i>' + st + '</div>').join('') + '</div>' +
      '<div class="acts">' + (next ? '<button class="btn blue sm" data-act="shpAdvance" data-id="' + esc(s.id) + '">Mark: ' + next + '</button>' : '<span style="color:var(--green);font-size:12px">✓ Delivered</span>') +
      (s.phone ? '<a class="btn green sm" target="_blank" rel="noopener" href="' + esc(waLink(s.phone, 'Hello ' + s.customer + ', your order ' + s.orderId + ' is now: ' + s.status + (s.tracking ? '. Tracking: ' + s.courier + ' ' + s.tracking : '') + '.')) + '">WhatsApp update</a>' : '') +
      '<button class="btn ghost sm" data-act="shpEdit" data-id="' + esc(s.id) + '">Edit</button>' +
      (isOwner() ? '<button class="btn red sm" data-act="shpDel" data-id="' + esc(s.id) + '">Del</button>' : '') +
      (s.email ? '<span class="muted" style="font-size:11px">' + (s.notified ? '📧 customer emailed' : '📧 email on next update') + '</span>' : '') + '</div></div>';
  }).join('') || '<div class="card muted" style="text-align:center">No shipments</div>';
}
H.shpFilter = id => { SHP.f = id; drawShp(); };

H.shpAdvance = async function (id) {
  const s = SHP.rows.find(x => x.id === id), next = SHIP_STEPS[SHIP_STEPS.indexOf(s.status) + 1];
  try { await save('Shipments', {id: id, status: next, notified: s.email ? true : s.notified}); s.status = next; if (s.email) s.notified = true; toast(id + ' → ' + next + (s.email ? ' (customer emailed)' : ''), 'success'); drawShp(); }
  catch (e) { toast(e.message, 'error'); }
};
H.shpDel = async function (id) { if (!ask('Delete this shipment?')) return; try { await remove('Shipments', id); go('shipments'); } catch (e) { toast(e.message, 'error'); } };

H.shpEdit = async function (id) {
  const s = id ? SHP.rows.find(x => x.id === id) : {courier:Object.keys(CONFIG.COURIERS)[0], eta:addDays(today(), 3)};
  let orders = [];
  try { orders = await load('Orders'); } catch (e) {}
  const opts = [{v:'', l:'— choose an order —'}].concat(orders.filter(o => o.status !== 'Cancelled').slice().reverse().map(o => ({v:o.id, l:o.id + ' · ' + o.customer})));
  formModal(id ? 'Edit shipment' : 'New shipment', [
    {k:'orderId', label:'Order', type:'select', opts:opts}, {k:'customer', label:'Customer name'},
    {k:'phone', label:'Customer phone'}, {k:'email', label:'Customer email (for auto-notify)', type:'email'},
    {k:'product', label:'Product(s)'}, {k:'city', label:'City'},
    {k:'courier', label:'Courier', type:'select', opts:Object.keys(CONFIG.COURIERS)}, {k:'tracking', label:'Tracking number'},
    {k:'sent', label:'Sent date', type:'date', def:today()}, {k:'eta', label:'Expected delivery', type:'date'},
    {k:'cost', label:'Shipping cost', type:'number'}, {k:'status', label:'Status', type:'select', opts:SHIP_STEPS}
  ], s, async v => {
    if (id) v.id = id;
    else if (v.orderId) {   // new shipment: fill gaps from the chosen order
      const o = orders.find(x => x.id === v.orderId);
      if (o) { if (!v.customer) v.customer = o.customer; if (!v.phone) v.phone = o.phone; if (!v.city) v.city = o.city; if (!v.product) v.product = itemsOf(o).map(i => i.name + ' ×' + i.qty).join(', '); }
    }
    await save('Shipments', v); toast('Shipment saved', 'success'); go('shipments');
  });
};
