/* ============ POS / Sales ============ */
const POS = {products:[], customers:[], cat:'All', q:''};

Pages.pos = async function (el) {
  [POS.products, POS.customers] = await Promise.all([load('Products'), load('Customers')]);
  POS.cat = 'All'; POS.q = '';
  const cats = ['All'].concat(Array.from(new Set(POS.products.map(p => p.category).filter(Boolean))));
  const maxD = isOwner() ? 100 : setting('maxDiscountPct');
  el.innerHTML = '<div class="pos"><div>' +
    '<div class="acts" style="margin-bottom:12px"><input id="pos-q" class="search" style="max-width:260px" placeholder="🔍 Search or scan barcode…" data-inp="posSearch">' +
    cats.map(c => '<button class="pill' + (c === 'All' ? ' active' : '') + '" data-act="posCat" data-id="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' +
    '<div class="tiles" id="tiles"></div></div>' +
    '<aside class="card cart"><b>🛒 Current sale</b>' +
    '<label class="fl" style="margin-top:10px"><span>Customer</span><select id="pos-cust" data-chg="posRecalc"><option value="">Walk-in / new customer</option>' + POS.customers.map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + ' · ' + esc(c.phone) + '</option>').join('') + '</select></label>' +
    '<div id="newcust" class="fgrid"><label class="fl"><span>Name</span><input id="pos-name" placeholder="optional"></label><label class="fl"><span>Phone</span><input id="pos-phone" placeholder="03XX-XXXXXXX"></label></div>' +
    '<div id="cart-lines" style="max-height:200px;overflow-y:auto"></div>' +
    '<div class="fgrid" style="margin-top:10px"><label class="fl"><span>Discount % (max ' + maxD + ')</span><input id="pos-disc" type="number" min="0" max="' + maxD + '" data-inp="posRecalc" placeholder="0"></label>' +
    '<label class="fl"><span>Payment</span><select id="pos-method" data-chg="posRecalc">' + ['Cash','EasyPaisa','JazzCash','Bank Transfer','Card','COD'].map(m => '<option>' + m + '</option>').join('') + '</select></label>' +
    '<label class="fl"><span id="pts-label">Redeem points</span><input id="pos-pts" type="number" min="0" data-inp="posRecalc" placeholder="0"></label>' +
    '<label class="fl"><span>Advance paid (optional)</span><input id="pos-adv" type="number" min="0" data-inp="posRecalc" placeholder="full"></label></div>' +
    '<div id="cart-totals" style="background:var(--surface);border-radius:8px;padding:12px;margin-bottom:12px"></div>' +
    '<button class="btn gold" style="width:100%;padding:12px" data-act="posPay" id="pay-btn">✓ Complete sale</button>' +
    '<button class="btn ghost" style="width:100%;margin-top:8px" data-act="posClear">Clear</button></aside></div>';
  drawTiles(); posRecalc();
  $('#pos-q').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim().toLowerCase(); if (!q) return;
    const exact = POS.products.find(p => String(p.barcode).toLowerCase() === q || String(p.sku).toLowerCase() === q);
    const hits = filtered();
    const p = exact || (hits.length === 1 ? hits[0] : null);
    if (p) { H.posAdd(p.id); e.target.value = ''; POS.q = ''; drawTiles(); }
  });
};

function filtered() {
  const q = POS.q.toLowerCase();
  return POS.products.filter(p => (POS.cat === 'All' || p.category === POS.cat) &&
    (!q || [p.name, p.sku, p.barcode].some(x => String(x).toLowerCase().includes(q))));
}
function drawTiles() {
  const list = filtered();
  $('#tiles').innerHTML = list.map(p =>
    '<div class="tile' + (p.stock <= 0 ? ' oos' : '') + '" data-act="posAdd" data-id="' + esc(p.id) + '"><div style="font-size:26px">' + esc(p.icon || '🧴') + '</div>' +
    '<div class="n">' + esc(p.name) + '</div><div class="muted" style="font-size:10px">' + esc(p.sku) + ' · ' + esc(p.unit) + '</div>' +
    '<div class="p">' + money(p.price) + '</div><div style="font-size:10px;color:' + (p.stock <= 0 ? 'var(--red)' : p.stock <= p.minStock ? 'var(--amber)' : 'var(--green)') + '">' + (p.stock <= 0 ? 'Out of stock' : 'Stock: ' + p.stock) + '</div></div>').join('') ||
    '<p class="muted">No products found. Add products in Inventory first.</p>';
}

H.posSearch = v => { POS.q = v; drawTiles(); };
H.posCat = (id, b) => { POS.cat = id; $$('.pill').forEach(x => x.classList.toggle('active', x === b)); drawTiles(); };
H.posAdd = id => {
  const p = POS.products.find(x => x.id === id); if (!p || p.stock <= 0) return;
  const ex = App.cart.find(c => c.productId === id);
  if (ex) { if (ex.qty >= p.stock) { toast('Only ' + p.stock + ' in stock', 'error'); return; } ex.qty++; }
  else App.cart.push({productId:id, name:p.name, price:p.price, qty:1, stock:p.stock});
  posRecalc();
};
H.posQty = (id, b) => {
  const c = App.cart.find(x => x.productId === id); if (!c) return;
  c.qty += Number(b.dataset.d);
  if (c.qty > c.stock) { c.qty = c.stock; toast('Only ' + c.stock + ' in stock', 'error'); }
  if (c.qty <= 0) App.cart = App.cart.filter(x => x.productId !== id);
  posRecalc();
};
H.posDel = id => { App.cart = App.cart.filter(x => x.productId !== id); posRecalc(); };
H.posClear = () => { App.cart = []; ['pos-disc','pos-pts','pos-adv','pos-name','pos-phone'].forEach(i => { $('#' + i).value = ''; }); $('#pos-cust').value = ''; posRecalc(); };
H.posRecalc = () => posRecalc();

function posCalc() {
  const sub = App.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const maxD = isOwner() ? 100 : setting('maxDiscountPct');
  const dp = Math.min(Math.max(num($('#pos-disc').value), 0), maxD);
  const disc = Math.round(sub * dp / 100);
  const cust = POS.customers.find(c => c.id === $('#pos-cust').value);
  const rp = setting('redeemPoints') || 100, rv = setting('redeemValue');
  let units = 0;
  if (cust && rv > 0) { units = Math.floor(Math.min(Math.max(Math.floor(num($('#pos-pts').value)), 0), cust.points) / rp); units = Math.min(units, Math.floor((sub - disc) / rv)); }
  const ptsDisc = units * rv, ptsUsed = units * rp;
  const taxable = sub - disc - ptsDisc, tax = Math.round(taxable * setting('taxPct') / 100), total = taxable + tax;
  const method = $('#pos-method').value, adv = num($('#pos-adv').value);
  const paid = method === 'COD' ? 0 : (adv > 0 && adv < total ? Math.round(adv) : total);
  return {sub, dp, disc, cust, ptsDisc, ptsUsed, tax, total, paid, method};
}

function posRecalc() {
  if (!$('#cart-lines')) return;
  $('#cart-lines').innerHTML = App.cart.length ? App.cart.map(i =>
    '<div class="line"><div style="flex:1"><div style="font-weight:700">' + esc(i.name) + '</div><div style="color:var(--gold)">' + money(i.price * i.qty) + '</div></div>' +
    '<button class="qb" data-act="posQty" data-id="' + esc(i.productId) + '" data-d="-1">−</button><span>' + i.qty + '</span><button class="qb" data-act="posQty" data-id="' + esc(i.productId) + '" data-d="1">+</button>' +
    '<button class="qb" style="color:var(--red)" data-act="posDel" data-id="' + esc(i.productId) + '">✕</button></div>').join('') : '<p class="muted" style="text-align:center;padding:14px 0;font-size:12px">Tap a product to add it</p>';
  const c = posCalc();
  $('#newcust').hidden = !!$('#pos-cust').value;
  $('#pts-label').textContent = c.cust ? 'Redeem points (has ' + c.cust.points + ')' : 'Redeem points (pick a customer)';
  $('#cart-totals').innerHTML = '<div class="tot"><span>Subtotal</span><span>' + money(c.sub) + '</span></div>' +
    (c.disc ? '<div class="tot" style="color:var(--red)"><span>Discount (' + c.dp + '%)</span><span>-' + money(c.disc) + '</span></div>' : '') +
    (c.ptsDisc ? '<div class="tot" style="color:var(--amber)"><span>Points (' + c.ptsUsed + ')</span><span>-' + money(c.ptsDisc) + '</span></div>' : '') +
    (c.tax ? '<div class="tot"><span>Tax</span><span>' + money(c.tax) + '</span></div>' : '') +
    '<div class="tot big"><span>Total</span><span>' + money(c.total) + '</span></div>' +
    (c.method === 'COD' ? '<div class="tot" style="color:var(--blue)"><span>Collect on delivery</span><span>' + money(c.total) + '</span></div>' :
      c.paid < c.total ? '<div class="tot" style="color:var(--amber)"><span>Balance due</span><span>' + money(c.total - c.paid) + '</span></div>' : '');
  $('#pay-btn').disabled = !App.cart.length;
}

H.posPay = async function (_, btn) {
  if (!App.cart.length) return;
  const c = posCalc();
  btn.disabled = true; btn.textContent = 'Processing…';
  try {
    const r = await api('checkout', {
      customerId: $('#pos-cust').value, customerName: $('#pos-name').value, phone: $('#pos-phone').value,
      items: App.cart.map(i => ({productId:i.productId, qty:i.qty})), discountPct: c.dp, usePoints: c.ptsUsed,
      method: c.method, advance: num($('#pos-adv').value)
    });
    drop('Products', 'Orders', 'Customers', 'Payments');
    const o = r.order; App.cart = [];
    toast('Sale ' + o.id + ' completed', 'success');
    openModal('Sale complete — ' + o.id, receiptHtml(o) +
      '<div class="mfoot" style="margin-top:14px;flex-wrap:wrap"><button class="btn ghost" id="rc-print">🖨️ Print</button><button class="btn blue" id="rc-pdf">📄 PDF</button>' +
      (o.phone ? '<a class="btn green" target="_blank" rel="noopener" href="' + esc(waLink(o.phone, 'Thank you for shopping with ' + App.settings.businessName + '! Order ' + o.id + ', total ' + money(o.total) + '.')) + '">WhatsApp</a>' : '') +
      '<button class="btn gold" data-act="posDone">New sale</button></div>');
    $('#rc-print').onclick = () => printReceipt(o); $('#rc-pdf').onclick = () => invoicePDF(o);
  } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
  btn.textContent = '✓ Complete sale';
};
H.posDone = () => { closeModal(); go('pos'); };
