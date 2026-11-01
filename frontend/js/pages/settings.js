/* ============ Settings (owner) + My password (everyone) ============ */
Pages.settings = async function (el) {
  const st = App.settings, owner = isOwner();
  const inp = (k, label, type, ph) => '<label class="fl"><span>' + label + '</span><input id="s_' + k + '" type="' + (type || 'text') + '" value="' + esc(st[k]) + '" placeholder="' + esc(ph || '') + '"></label>';
  el.innerHTML = '<div class="head"><h2>Settings</h2></div><div class="grid g2">' +
    (owner ?
      '<div class="card"><b>🏪 Business & branding (white-label)</b><div style="margin-top:12px">' + inp('businessName', 'Business name') + inp('logo', 'Logo — an emoji or an image link (https://…)') +
        '<label class="fl"><span>Brand colour</span><input id="s_brandColor" type="color" value="' + esc(st.brandColor || '#C9A84C') + '" style="height:42px;padding:3px"></label>' + inp('phone', 'Phone (shown on receipts)') + inp('address', 'Address (shown on receipts)') + inp('receiptFooter', 'Receipt footer message') + '</div></div>' +
      '<div class="card"><b>💰 Money, tax & loyalty</b><div style="margin-top:12px">' + inp('currencySymbol', 'Currency symbol (use plain letters like Rs, USD, AED)') + inp('taxPct', 'Sales tax %', 'number') +
        '<div class="fgrid">' + inp('pointsPer', 'Earn 1 point per (amount spent)', 'number') + inp('redeemPoints', 'Points needed to redeem', 'number') + inp('redeemValue', 'Discount value of those points', 'number') + inp('vipSpend', 'VIP after lifetime spend of', 'number') + '</div>' +
        inp('maxDiscountPct', 'Max discount % a Manager may give', 'number') + inp('lowStockDefault', 'Default low-stock alert level', 'number') + inp('countryCode', 'Phone country code for WhatsApp (92 = Pakistan)') +
        '<label class="fl"><span>Email customers on shipment updates</span><select id="s_notifyEmail"><option value="true"' + (st.notifyEmail === 'true' ? ' selected' : '') + '>Yes</option><option value="false"' + (st.notifyEmail !== 'true' ? ' selected' : '') + '>No</option></select></label></div></div>' : '') +
    '<div class="card"><b>🔒 Change my password</b><div style="margin-top:12px"><label class="fl"><span>Current password</span><input id="pw_old" type="password"></label><label class="fl"><span>New password (min 6)</span><input id="pw_new" type="password"></label><button class="btn gold" data-act="changePw">Update password</button></div></div>' +
    '<div class="card"><b>ℹ️ Subscription</b><div style="margin-top:12px;font-size:13px;line-height:1.9">Business ID: <b>' + esc(App.tenant.tenantId) + '</b><br>Status: ' + badge(App.tenant.status) + '<br>Valid until: <b>' + esc(App.tenant.expiry || '—') + '</b>' + (App.tenant.daysLeft !== null ? ' (' + App.tenant.daysLeft + ' days left)' : '') + '<br><span class="muted">Contact your administrator to renew.</span></div></div></div>' +
    (owner ? '<div style="margin-top:18px"><button class="btn gold" data-act="saveSettings">💾 Save settings</button></div>' : '');
};
H.saveSettings = async function (_, btn) {
  const keys = ['businessName','logo','brandColor','phone','address','receiptFooter','currencySymbol','taxPct','pointsPer','redeemPoints','redeemValue','vipSpend','maxDiscountPct','lowStockDefault','countryCode','notifyEmail'];
  const s = {}; keys.forEach(k => { s[k] = $('#s_' + k).value; });
  btn.disabled = true;
  try { const r = await api('settings_save', {settings: s}); App.settings = r.settings; applyBranding(); toast('Settings saved', 'success'); }
  catch (e) { toast(e.message, 'error'); }
  btn.disabled = false;
};
H.changePw = async function (_, btn) {
  btn.disabled = true;
  try { await api('change_password', {oldPassword: $('#pw_old').value, newPassword: $('#pw_new').value}); $('#pw_old').value = ''; $('#pw_new').value = ''; toast('Password updated', 'success'); }
  catch (e) { toast(e.message, 'error'); }
  btn.disabled = false;
};
