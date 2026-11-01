/* ============ Shared helpers used by every page ============ */
const App = { token:null, user:null, tenant:null, settings:{}, page:'dashboard', cache:{}, charts:[], cart:[], superadmin:false };
const Pages = {};   // each page file adds its screen here
const H = {};       // each page file adds its button/typing handlers here

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

// Escapes text so data from the database can never run as code on the page
function esc(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function num(v) { return Number(v) || 0; }
function sum(arr, k) { return arr.reduce((s, x) => s + num(x[k]), 0); }
function setting(k) { return num(App.settings[k]); }
function money(n) { return (App.settings.currencySymbol || 'Rs') + ' ' + Math.round(num(n)).toLocaleString(); }
function today() { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function addDays(dateStr, days) { const d = new Date((dateStr || today()) + 'T00:00:00'); d.setDate(d.getDate() + days); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function monthKeys(n) { const out = [], d = new Date(); d.setDate(1); for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')); } return out; }
function itemsOf(o) { if (Array.isArray(o.items)) return o.items; try { return JSON.parse(o.items || '[]'); } catch (e) { return []; } }
function isOwner() { return App.user && App.user.role === 'owner'; }
function isStaffLevel(role) { return App.user && App.user.role === role; }

const BADGES = {Delivered:'green',Confirmed:'green',Active:'green','In Stock':'green',Paid:'green',Fulfilled:'green',Done:'green',New:'green',
  Pending:'amber','Low Stock':'amber','Awaiting Stock':'amber',Open:'amber',Trial:'amber','Out for Delivery':'amber',Advance:'amber',
  'Out of Stock':'red',Blocked:'red',Expired:'red',Cancelled:'red',Inactive:'red',Refund:'red',
  Processing:'gray',Dispatched:'blue','In Transit':'blue',Regular:'blue',COD:'blue',VIP:'gold',owner:'gold',manager:'blue',staff:'gray'};
function badge(t) { return '<span class="badge b-' + (BADGES[t] || 'gray') + '">' + esc(t) + '</span>'; }

/* ---- toasts ---- */
function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'info'); el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 5000 : 2800);
}

/* ---- modals ---- */
function openModal(title, html, large) {
  closeModal();
  const el = document.createElement('div');
  el.className = 'overlay'; el.id = 'ov';
  el.innerHTML = '<div class="modal' + (large ? ' lg' : '') + '"><div class="mhead"><h3>' + esc(title) + '</h3><button class="x" data-act="closeModal">✕</button></div><div class="mbody">' + html + '</div></div>';
  el.addEventListener('mousedown', e => { if (e.target === el) closeModal(); });
  $('#modal-root').appendChild(el);
}
function closeModal() { const m = $('#ov'); if (m) m.remove(); }
H.closeModal = closeModal;

/* ---- one helper builds every "add / edit" form ---- */
function fieldHtml(f, val) {
  const v = (val === undefined || val === null) ? (f.def !== undefined ? f.def : '') : val;
  let inner;
  if (f.type === 'select') {
    inner = '<select id="f_' + f.k + '">' + f.opts.map(o => { const ov = typeof o === 'object' ? o.v : o, ol = typeof o === 'object' ? o.l : o; return '<option value="' + esc(ov) + '"' + (String(ov) === String(v) ? ' selected' : '') + '>' + esc(ol) + '</option>'; }).join('') + '</select>';
  } else if (f.type === 'textarea') {
    inner = '<textarea id="f_' + f.k + '" placeholder="' + esc(f.ph || '') + '">' + esc(v) + '</textarea>';
  } else {
    inner = '<input id="f_' + f.k + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '" placeholder="' + esc(f.ph || '') + '"' + (f.step ? ' step="' + f.step + '"' : '') + (f.type === 'number' ? ' min="0"' : '') + (f.ro ? ' readonly' : '') + '>';
  }
  return '<label class="fl' + (f.wide || f.type === 'textarea' ? ' wide' : '') + '"><span>' + esc(f.label) + '</span>' + inner + '</label>';
}
function formModal(title, fields, vals, onSave, saveLabel) {
  vals = vals || {};
  openModal(title, '<form id="fm" autocomplete="off"><div class="fgrid">' + fields.map(f => fieldHtml(f, vals[f.k])).join('') +
    '</div><div class="mfoot"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button type="submit" class="btn gold">' + esc(saveLabel || 'Save') + '</button></div></form>');
  $('#fm').onsubmit = async ev => {
    ev.preventDefault();
    const out = {};
    fields.forEach(f => { const el = $('#f_' + f.k); out[f.k] = f.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; });
    const btn = $('#fm button[type=submit]'); btn.disabled = true;
    try { await onSave(out); closeModal(); } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
  };
}

function ask(msg) { return window.confirm(msg); }

/* ---- WhatsApp link (opens WhatsApp with a ready message) ---- */
function waLink(phone, msg) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = (App.settings.countryCode || '92') + d.slice(1);
  return 'https://wa.me/' + d + '?text=' + encodeURIComponent(msg);
}

/* ---- Excel helpers (SheetJS) ---- */
function xlsxSave(filename, sheets) {
  const wb = XLSX.utils.book_new();
  Object.keys(sheets).forEach(n => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets[n]), n.slice(0, 31)));
  XLSX.writeFile(wb, filename);
  toast('Excel file downloaded', 'success');
}
function xlsxRead(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => { try { const wb = XLSX.read(e.target.result, {type:'array'}); res(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])); } catch (err) { rej(err); } };
    r.onerror = () => rej(new Error('Could not read the file'));
    r.readAsArrayBuffer(file);
  });
}

/* ---- Receipts ---- */
function receiptHtml(o) {
  const st = App.settings, items = itemsOf(o);
  return '<div id="receipt" style="font-family:Georgia,serif">' +
    '<div style="text-align:center;border-bottom:1px dashed var(--b2);padding-bottom:12px;margin-bottom:12px">' +
    '<div style="font-size:20px;font-weight:700;color:var(--gold)">' + esc(st.businessName) + '</div>' +
    (st.address ? '<div class="muted" style="font-size:11px">' + esc(st.address) + '</div>' : '') +
    (st.phone ? '<div class="muted" style="font-size:11px">' + esc(st.phone) + '</div>' : '') +
    '<div class="muted" style="font-size:11px;margin-top:6px">Receipt ' + esc(o.id) + ' · ' + esc(o.date) + '</div>' +
    '<div style="font-size:12px">' + esc(o.customer) + '</div></div>' +
    items.map(i => '<div class="tot"><span>' + esc(i.name) + ' × ' + esc(i.qty) + '</span><span>' + money(i.price * i.qty) + '</span></div>').join('') +
    '<div style="border-top:1px dashed var(--b2);margin:10px 0"></div>' +
    '<div class="tot"><span>Subtotal</span><span>' + money(o.subtotal) + '</span></div>' +
    (num(o.discount) > 0 ? '<div class="tot" style="color:var(--red)"><span>Discount</span><span>-' + money(o.discount) + '</span></div>' : '') +
    (num(o.tax) > 0 ? '<div class="tot"><span>Tax</span><span>' + money(o.tax) + '</span></div>' : '') +
    '<div class="tot big"><span>Total</span><span>' + money(o.total) + '</span></div>' +
    '<div class="tot"><span>Paid (' + esc(o.method) + ')</span><span>' + money(o.paid) + '</span></div>' +
    (num(o.total) > num(o.paid) ? '<div class="tot" style="color:var(--amber)"><span>Balance due</span><span>' + money(num(o.total) - num(o.paid)) + '</span></div>' : '') +
    (num(o.pointsEarned) > 0 ? '<div class="alert warn" style="margin-top:12px;text-align:center">Loyalty points earned: +' + esc(o.pointsEarned) + '</div>' : '') +
    '<div class="muted" style="text-align:center;font-size:11px;margin-top:10px">' + esc(st.receiptFooter) + '</div></div>';
}

function printReceipt(o) {
  const st = App.settings, items = itemsOf(o);
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) { toast('Please allow pop-ups to print', 'error'); return; }
  w.document.write('<html><head><title>Receipt ' + esc(o.id) + '</title><style>body{font-family:Georgia,serif;padding:18px;max-width:380px;margin:auto}.r{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}.t{font-size:17px;font-weight:700;border-top:2px solid #000;margin-top:8px;padding-top:6px}</style></head><body>' +
    '<h2 style="text-align:center">' + esc(st.businessName) + '</h2><p style="text-align:center;font-size:12px">' + esc(st.address || '') + ' ' + esc(st.phone || '') + '<br>Receipt ' + esc(o.id) + ' · ' + esc(o.date) + '<br>' + esc(o.customer) + '</p><hr>' +
    items.map(i => '<div class="r"><span>' + esc(i.name) + ' × ' + esc(i.qty) + '</span><span>' + money(i.price * i.qty) + '</span></div>').join('') +
    (num(o.discount) > 0 ? '<div class="r"><span>Discount</span><span>-' + money(o.discount) + '</span></div>' : '') +
    (num(o.tax) > 0 ? '<div class="r"><span>Tax</span><span>' + money(o.tax) + '</span></div>' : '') +
    '<div class="r t"><span>TOTAL</span><span>' + money(o.total) + '</span></div><div class="r"><span>Paid (' + esc(o.method) + ')</span><span>' + money(o.paid) + '</span></div>' +
    '<p style="text-align:center;font-size:12px;margin-top:14px">' + esc(st.receiptFooter) + '</p></body></html>');
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

function invoicePDF(o) {
  if (!window.jspdf) { toast('PDF library did not load. Check your internet.', 'error'); return; }
  const a = s => String(s === undefined || s === null ? '' : s).replace(/[^\x20-\x7E]/g, '');   // PDF default font = plain English letters only
  const st = App.settings, items = itemsOf(o), sym = a(st.currencySymbol) || 'Rs';
  const m = n => sym + ' ' + Math.round(num(n)).toLocaleString();
  const doc = new window.jspdf.jsPDF({unit:'mm', format:'a4'});
  doc.setFillColor(20, 20, 20); doc.rect(0, 0, 210, 42, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(201, 168, 76); doc.text(a(st.businessName) || 'Invoice', 20, 20);
  doc.setFontSize(9); doc.setTextColor(170, 170, 170); doc.text(a(st.address) + '  ' + a(st.phone), 20, 28);
  doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.text('INVOICE', 190, 20, {align:'right'});
  doc.setFontSize(9); doc.setTextColor(170, 170, 170); doc.text('#' + a(o.id), 190, 28, {align:'right'}); doc.text('Date: ' + a(o.date), 190, 34, {align:'right'});
  doc.setTextColor(110, 110, 110); doc.setFontSize(9); doc.text('BILL TO', 20, 54);
  doc.setTextColor(30, 30, 30); doc.setFontSize(12); doc.text(a(o.customer), 20, 61);
  doc.setFontSize(10); doc.setTextColor(100, 100, 100); if (o.phone) doc.text(a(o.phone), 20, 67);
  doc.setFillColor(245, 242, 236); doc.rect(20, 76, 170, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text('ITEM', 24, 81.5); doc.text('QTY', 125, 81.5); doc.text('PRICE', 150, 81.5); doc.text('TOTAL', 186, 81.5, {align:'right'});
  let y = 92; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  items.forEach(i => {
    doc.setTextColor(30, 30, 30); doc.text(a(i.name).slice(0, 48), 24, y); doc.setTextColor(100, 100, 100);
    doc.text(String(i.qty), 127, y); doc.text(m(i.price), 150, y); doc.setTextColor(30, 30, 30); doc.text(m(i.price * i.qty), 186, y, {align:'right'});
    doc.setDrawColor(230, 230, 230); doc.line(20, y + 3, 190, y + 3); y += 10;
    if (y > 240) { doc.addPage(); y = 25; }
  });
  y += 4; doc.setFontSize(10);
  const line = (l, v, c) => { doc.setTextColor(c || 70, c ? 60 : 70, c ? 60 : 70); doc.text(l, 140, y); doc.text(v, 188, y, {align:'right'}); y += 7; };
  line('Subtotal:', m(o.subtotal));
  if (num(o.discount) > 0) line('Discount:', '-' + m(o.discount), 200);
  if (num(o.tax) > 0) line('Tax:', m(o.tax));
  doc.setFillColor(201, 168, 76); doc.rect(120, y - 5, 70, 10, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(0, 0, 0);
  doc.text('TOTAL:', 125, y + 2); doc.text(m(o.total), 188, y + 2, {align:'right'}); y += 16;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(70, 70, 70);
  doc.text('Payment method: ' + a(o.method), 20, y); doc.text('Amount paid: ' + m(o.paid), 20, y + 6);
  if (num(o.total) > num(o.paid)) { doc.setTextColor(200, 120, 0); doc.text('Balance due: ' + m(num(o.total) - num(o.paid)), 20, y + 12); }
  if (num(o.pointsEarned) > 0) { doc.setTextColor(120, 100, 30); doc.text('Loyalty points earned: +' + num(o.pointsEarned), 120, y); }
  doc.setFillColor(20, 20, 20); doc.rect(0, 275, 210, 22, 'F'); doc.setTextColor(170, 170, 170); doc.setFontSize(9);
  doc.text(a(st.receiptFooter), 105, 286, {align:'center'});
  doc.save('Invoice-' + a(o.id) + '.pdf');
  toast('Invoice PDF downloaded', 'success');
}

function destroyCharts() { App.charts.forEach(c => { try { c.destroy(); } catch (e) {} }); App.charts = []; }
function chartColors() { const l = document.documentElement.getAttribute('data-theme') === 'light'; return {grid:l ? '#e5e5e5' : '#2a2a2a', text:'#888'}; }
function barOpts() { const c = chartColors(); return {responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:c.text}}}, scales:{x:{grid:{color:c.grid}, ticks:{color:c.text}}, y:{grid:{color:c.grid}, ticks:{color:c.text}}}}; }
function kpi(label, val, sub, color) { return '<div class="kpi"' + (color ? ' style="border-left-color:' + color + '"' : '') + '><div class="l">' + esc(label) + '</div><div class="v"' + (color ? ' style="color:' + color + '"' : '') + '>' + val + '</div><div class="s">' + esc(sub || '') + '</div></div>'; }

/* ---- charts: if the chart library could not load (offline / blocked), show a friendly note instead of crashing ---- */
function mkChart(canvas, cfg) {
  if (!canvas) return;
  if (typeof Chart === 'undefined') { canvas.parentNode.innerHTML = '<div class="muted" style="padding:30px;text-align:center">Chart could not load. Check your internet connection and refresh.</div>'; return; }
  App.charts.push(new Chart(canvas, cfg));
}
