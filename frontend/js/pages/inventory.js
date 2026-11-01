/* ============ Inventory ============ */
const INV = {rows:[], q:'', cat:'All'};

Pages.inventory = async function (el) {
  INV.rows = await load('Products'); INV.q = ''; INV.cat = 'All';
  const owner = isOwner();
  const alerts = INV.rows.filter(p => p.stock <= p.minStock);
  const cats = ['All'].concat(Array.from(new Set(INV.rows.map(p => p.category).filter(Boolean))));
  el.innerHTML = '<div class="head"><h2>Inventory</h2><div class="acts"><input class="search" placeholder="Search…" data-inp="invSearch">' +
    (owner ? '<button class="btn ghost sm" data-act="invImport">📥 Import Excel</button><button class="btn ghost sm" data-act="invExport">📤 Export Excel</button><button class="btn gold" data-act="invEdit">+ Add product</button>' : '') + '</div></div>' +
    (alerts.length ? '<div class="alert warn">⚠️ <b>Stock alerts:</b> ' + alerts.map(p => esc(p.name) + (p.stock === 0 ? ' (OUT)' : ' (' + p.stock + ' left)')).join(' · ') + '</div>' : '') +
    '<div class="acts" style="margin-bottom:14px">' + cats.map(c => '<button class="pill' + (c === 'All' ? ' active' : '') + '" data-act="invCat" data-id="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' +
    '<div class="tbl"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Unit</th>' + (owner ? '<th>Cost</th>' : '') + '<th>Price</th>' + (owner ? '<th>Margin</th>' : '') + '<th>Stock</th><th>Status</th>' + (owner ? '<th></th>' : '') + '</tr></thead><tbody id="inv-body"></tbody></table></div>';
  drawInv();
};
function drawInv() {
  const q = INV.q.toLowerCase(), owner = isOwner();
  const rows = INV.rows.filter(p => (INV.cat === 'All' || p.category === INV.cat) && (!q || [p.name, p.sku, p.barcode].some(x => String(x).toLowerCase().includes(q))));
  $('#inv-body').innerHTML = rows.map(p => {
    const col = p.stock === 0 ? 'var(--red)' : p.stock <= p.minStock ? 'var(--amber)' : 'var(--green)';
    return '<tr><td><strong>' + esc(p.icon) + ' ' + esc(p.name) + '</strong></td><td style="font-family:monospace;font-size:11px">' + esc(p.sku) + '</td><td>' + esc(p.category) + '</td><td>' + esc(p.unit) + '</td>' +
      (owner ? '<td>' + money(p.cost) + '</td>' : '') + '<td style="color:var(--gold);font-weight:700">' + money(p.price) + '</td>' + (owner ? '<td style="color:var(--green)">' + money(p.price - p.cost) + '</td>' : '') +
      '<td><span class="bar"><i style="width:' + Math.min(100, p.stock / Math.max(p.minStock * 3, 1) * 100) + '%;background:' + col + '"></i></span>' + p.stock + '</td>' +
      '<td>' + badge(p.stock === 0 ? 'Out of Stock' : p.stock <= p.minStock ? 'Low Stock' : 'In Stock') + '</td>' +
      (owner ? '<td style="white-space:nowrap"><button class="btn ghost sm" data-act="invEdit" data-id="' + esc(p.id) + '">Edit</button> <button class="btn red sm" data-act="invDel" data-id="' + esc(p.id) + '">Del</button></td>' : '') + '</tr>';
  }).join('') || '<tr><td colspan="10" class="muted" style="text-align:center;padding:30px">No products yet' + (owner ? ' — click “+ Add product” or import an Excel file.' : '.') + '</td></tr>';
}
H.invSearch = v => { INV.q = v; drawInv(); };
H.invCat = (id, b) => { INV.cat = id; $$('.pill').forEach(x => x.classList.toggle('active', x === b)); drawInv(); };

H.invEdit = function (id) {
  const p = id ? INV.rows.find(x => x.id === id) : {unit:'50ml', icon:'🧴', minStock:setting('lowStockDefault') || 10};
  formModal(id ? 'Edit product' : 'Add product', [
    {k:'name', label:'Name', ph:'Product name'}, {k:'sku', label:'SKU', ph:'ABC-001'},
    {k:'category', label:'Category', ph:'e.g. Oud'}, {k:'unit', label:'Unit / size'},
    {k:'cost', label:'Cost price', type:'number'}, {k:'price', label:'Sale price', type:'number'},
    {k:'stock', label:'Stock quantity', type:'number'}, {k:'minStock', label:'Low-stock alert at', type:'number'},
    {k:'barcode', label:'Barcode (optional)'}, {k:'icon', label:'Icon (emoji)'}
  ], p, async v => { if (id) v.id = id; await save('Products', v); toast('Product saved', 'success'); go('inventory'); });
};
H.invDel = async function (id) {
  if (!ask('Delete this product permanently?')) return;
  try { await remove('Products', id); toast('Product deleted', 'success'); go('inventory'); } catch (e) { toast(e.message, 'error'); }
};
H.invExport = () => xlsxSave('Inventory.xlsx', {Inventory: INV.rows.map(p => ({SKU:p.sku, Name:p.name, Category:p.category, Unit:p.unit, 'Cost Price':p.cost, 'Sale Price':p.price, 'Stock Qty':p.stock, 'Min Stock':p.minStock, Barcode:p.barcode}))});

H.invImport = function () {
  openModal('Import products from Excel', '<p style="font-size:13px;color:var(--t2);margin-bottom:12px">Use an .xlsx or .csv file with these column titles: <b>SKU, Name, Category, Unit, Cost Price, Sale Price, Stock Qty, Min Stock, Barcode</b>. Rows with an existing SKU are updated; new SKUs are added.</p>' +
    '<input type="file" id="imp-file" accept=".xlsx,.xls,.csv"><div class="mfoot" style="margin-top:14px"><button class="btn ghost" data-act="invExport">Download template</button><button class="btn gold" data-act="invDoImport">Import</button></div>');
};
H.invDoImport = async function (_, btn) {
  const f = $('#imp-file').files[0]; if (!f) { toast('Choose a file first', 'error'); return; }
  btn.disabled = true;
  try {
    const raw = await xlsxRead(f), g = (r, ...keys) => { for (const k of keys) if (r[k] !== undefined) return r[k]; return ''; };
    const rows = raw.map(r => ({sku:g(r, 'SKU', 'sku'), name:g(r, 'Name', 'name'), category:g(r, 'Category', 'category'), unit:g(r, 'Unit', 'unit'), cost:g(r, 'Cost Price', 'cost'), price:g(r, 'Sale Price', 'price'), stock:g(r, 'Stock Qty', 'stock'), minStock:g(r, 'Min Stock', 'minStock'), barcode:g(r, 'Barcode', 'barcode')}));
    const r = await api('import_products', {rows: rows});
    toast('Imported: ' + r.added + ' added, ' + r.updated + ' updated' + (r.skipped ? ', ' + r.skipped + ' skipped' : ''), 'success');
    closeModal(); go('inventory');
  } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
};
