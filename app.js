(function () {
  'use strict';
  var KEY = 'dung_spa_state_v2', MAX = 2, WIN = 60;
  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var ICONS = {
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    back: '<path d="M15 18l-6-6 6-6"/>'
  };
  function icon(n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }
  function hydrateIcons() {
    document.querySelectorAll('svg[data-i]').forEach(function (s) {
      s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
      s.innerHTML = ICONS[s.getAttribute('data-i')]; s.removeAttribute('data-i');
    });
  }

  var CONFIG = {
    services: ['Làm mặt', 'Trị mụn', 'Bắn nốt ruồi', 'Trị nám', 'Tàn nhang', 'Đồi mồi', 'Gội đầu', 'Trẻ hóa da', 'Massage body'],
    slots: ['09:00', '10:30', '13:30', '15:00', '16:30', '18:00', '19:30']
  };
  var DEFAULT = {
    spaName: 'Dung Spa',
    branches: [
      { id: 'branch_a', branchLabel: 'Cơ sở 1', address: 'K40/40 Nguyễn Huy Tưởng', staffName: 'Đào Thị Đinh Lăng', phone: '0775 138 195' },
      { id: 'branch_b', branchLabel: 'Cơ sở 2', address: '75 Nguyễn Nhàn', staffName: 'Nguyễn Thị Dung', phone: '0392 212 859' }
    ],
    bookings: [], notifications: []
  };

  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(KEY));
      if (p && Array.isArray(p.branches) && Array.isArray(p.bookings)) return p;
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  var S = load();
  var today = iso(new Date());
  var sel = { branch: S.branches[0].id, service: 0, date: today, time: '' };
  var filter = 'all';
  var PINKEY = 'dung_admin_pin', adminOk = false, adminPin = '';
  try { adminPin = sessionStorage.getItem(PINKEY) || ''; } catch (e) {}

  function branch(id) { return S.branches.filter(function (b) { return b.id === id; })[0] || S.branches[0]; }
  function mins(t) { if (!t || t.indexOf(':') < 0) return -1; var p = t.split(':'); return +p[0] * 60 + +p[1]; }
  function nowMins() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function isPast(date, time) { return date === today && mins(time) <= nowMins(); }
  function used(b, date, time) {
    var m = mins(time); if (m < 0) return 0;
    return S.bookings.filter(function (k) { return k.branchId === b && k.date === date && k.status !== 'cancelled' && Math.abs(mins(k.time) - m) < WIN; }).length;
  }
  function usable(time) { return !!time && !isPast(sel.date, time) && used(sel.branch, sel.date, time) < MAX; }
  function prettyDate(d) { var x = new Date(d + 'T00:00:00'); return DOW[x.getDay()] + ' ' + pad(x.getDate()) + '/' + pad(x.getMonth() + 1); }
  function tel(p) { return 'tel:' + String(p).replace(/\s+/g, ''); }

  /* ---------- Server (tùy chọn) ---------- */
  function api(path, opt) {
    return fetch(path, opt).then(function (r) {
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('json') < 0) return { offline: true };
      return r.json().then(function (j) { return { status: r.status, ok: r.ok, data: j }; });
    }).catch(function () { return { offline: true }; });
  }
  function sync() {
    return api('/api/state', { headers: adminPin ? { 'x-admin-pin': adminPin } : {} }).then(function (r) {
      if (r.offline || !r.ok || !r.data || !Array.isArray(r.data.bookings)) return;
      adminOk = !!r.data.admin;
      if (adminPin && !adminOk) { adminPin = ''; try { sessionStorage.removeItem(PINKEY); } catch (e) {} }
      S.bookings = r.data.bookings;
      if (Array.isArray(r.data.notifications)) S.notifications = r.data.notifications;
      save(); renderAll();
    });
  }

  /* ---------- Render: đặt lịch ---------- */
  function renderHero() {
    $('brand').textContent = S.spaName;
    $('hero-calls').innerHTML = S.branches.map(function (b) {
      return '<a class="callrow" href="' + tel(b.phone) + '"><div><b>' + esc(b.branchLabel) + ' · ' + esc(b.address) + '</b><span>' + esc(b.phone) + '</span></div><span class="go">' + icon('phone') + 'Gọi</span></a>';
    }).join('');
    $('foot-addr').textContent = S.branches.map(function (b) { return b.branchLabel + ': ' + b.address; }).join(' · ');
  }
  function renderBranches() {
    $('branches').innerHTML = S.branches.map(function (b, i) {
      return '<button type="button" class="opt" data-b="' + b.id + '" aria-pressed="' + (b.id === sel.branch) + '"><b>' + esc(b.staffName) + '<span class="tag' + (i ? ' b' : '') + '">' + esc(b.branchLabel) + '</span></b><small>' + icon('pin') + esc(b.address) + '</small></button>';
    }).join('');
  }
  function renderServices() {
    $('services').innerHTML = CONFIG.services.map(function (n, i) {
      return '<button type="button" class="chip" data-s="' + i + '" aria-pressed="' + (i === sel.service) + '"><span>' + esc(n) + '</span>' + (i === sel.service ? icon('check') : '') + '</button>';
    }).join('');
  }
  function renderDays() {
    var h = '', d = new Date();
    for (var i = 0; i < 14; i++) {
      var v = iso(d);
      h += '<button type="button" class="day" data-d="' + v + '" aria-pressed="' + (v === sel.date) + '"><small>' + (i === 0 ? 'Nay' : DOW[d.getDay()]) + '</small><b>' + d.getDate() + '</b></button>';
      d.setDate(d.getDate() + 1);
    }
    $('days').innerHTML = h;
  }
  function renderSlots() {
    $('slots').innerHTML = CONFIG.slots.map(function (t) {
      var past = isPast(sel.date, t), c = used(sel.branch, sel.date, t), full = c >= MAX;
      var note = past ? 'Đã qua' : full ? 'Hết chỗ' : c === 1 ? 'Còn 1 chỗ' : '';
      return '<button type="button" class="slot" data-t="' + t + '"' + (past || full ? ' disabled' : '') + ' aria-pressed="' + (t === sel.time) + '">' + t + (note ? '<small>' + note + '</small>' : '') + '</button>';
    }).join('');
    var other = $('time-other');
    other.value = CONFIG.slots.indexOf(sel.time) < 0 ? sel.time : '';
    var el = $('avail');
    if (!sel.time) { el.className = 'status warn'; el.textContent = 'Chọn một khung giờ ở trên hoặc nhập giờ khác.'; return; }
    if (isPast(sel.date, sel.time)) { el.className = 'status bad'; el.textContent = 'Giờ này đã qua. Vui lòng chọn giờ khác.'; return; }
    var u = used(sel.branch, sel.date, sel.time);
    if (u >= MAX) { el.className = 'status bad'; el.textContent = 'Giờ này đã đủ 2 khách. Vui lòng chọn giờ khác hoặc cơ sở còn lại.'; }
    else if (u === 1) { el.className = 'status warn'; el.textContent = 'Đã có 1 khách ở giờ này, còn 1 chỗ.'; }
    else { el.className = 'status ok'; el.textContent = 'Giờ này còn trống.'; }
  }
  function renderBar() {
    var b = branch(sel.branch);
    $('sum-1').textContent = b.branchLabel + ' · ' + CONFIG.services[sel.service];
    $('sum-2').textContent = sel.time ? sel.time + ' · ' + prettyDate(sel.date) : 'Chưa chọn giờ';
  }

  /* ---------- Render: chủ tiệm ---------- */
  function renderAdmin() {
    $('admin-gate').hidden = adminOk; $('admin-body').hidden = !adminOk;
    if (!adminOk) return;
    var act = S.bookings.filter(function (b) { return b.status !== 'cancelled'; });
    var cnt = function (id) { return act.filter(function (b) { return id === 'all' || b.branchId === id; }).length; };
    $('filters').innerHTML = [{ id: 'all', t: 'Tất cả' }].concat(S.branches.map(function (b) { return { id: b.id, t: b.branchLabel }; })).map(function (f) {
      return '<button type="button" class="chip" data-f="' + f.id + '" aria-pressed="' + (f.id === filter) + '">' + esc(f.t) + ' (' + cnt(f.id) + ')</button>';
    }).join('');
    var list = S.bookings.filter(function (b) { return filter === 'all' || b.branchId === filter; }).slice().sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
    var lbl = { confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
    $('admin-list').innerHTML = list.length ? list.map(function (k) {
      return '<div class="card"><div class="row"><div><div class="who">' + esc(k.customerName) + '</div><div class="meta">' + esc(k.serviceName) + ' · ' + esc(k.branchLabel) + ' (' + esc(k.staffName) + ')</div></div><span class="st ' + esc(k.status) + '">' + (lbl[k.status] || '') + '</span></div>' +
        '<div class="meta"><b style="color:var(--ink)">' + esc(k.time) + ' · ' + esc(prettyDate(k.date)) + '</b> · #' + esc(k.id) + '</div>' +
        '<div class="meta">' + esc(k.phone) + ' · ' + esc(k.email) + '</div>' + (k.note ? '<div class="meta"><i>Ghi chú: ' + esc(k.note) + '</i></div>' : '') +
        '<div class="acts"><a class="btn ghost sm" href="' + tel(k.phone) + '">' + icon('phone') + 'Gọi khách</a>' +
        (k.status === 'confirmed' ? '<button type="button" class="btn sm" data-a="completed" data-id="' + esc(k.id) + '">Đã xong</button><button type="button" class="btn ghost sm" data-a="cancelled" data-id="' + esc(k.id) + '">Hủy lịch</button>' : '') + '</div></div>';
    }).join('') : '<div class="card empty">Chưa có lịch hẹn nào.</div>';
    var logs = S.notifications.filter(function (n) { return filter === 'all' || n.branchId === filter; }).slice().reverse().slice(0, 15);
    $('admin-log').innerHTML = logs.length ? logs.map(function (n) { return '<div class="log"><small>' + esc(n.time) + '</small><br>' + esc(n.text) + '</div>'; }).join('') : '<div class="empty">Chưa có thông báo.</div>';
  }

  function renderAll() { renderHero(); renderBranches(); renderServices(); renderDays(); renderSlots(); renderBar(); renderAdmin(); }

  /* ---------- Sheet & toast ---------- */
  function openSheet(html) { $('sheet-body').innerHTML = '<div class="grab"></div>' + html; $('sheet').hidden = false; document.body.style.overflow = 'hidden'; var f = $('sheet-body').querySelector('input,button,a'); if (f) f.focus(); }
  function closeSheet() { $('sheet').hidden = true; document.body.style.overflow = ''; }
  function toast(m) { var t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2400); }

  function callSheet() {
    openSheet('<h3>Gọi đặt lịch</h3>' + S.branches.map(function (b) {
      return '<a class="callrow" style="background:var(--blush);color:var(--ink);margin-bottom:10px" href="' + tel(b.phone) + '"><div><b>' + esc(b.staffName) + ' · ' + esc(b.branchLabel) + '</b><span style="color:var(--muted)">' + esc(b.phone) + ' · ' + esc(b.address) + '</span></div><span class="go" style="background:var(--pink);color:#fff">' + icon('phone') + 'Gọi</span></a>';
    }).join('') + '<button class="btn ghost block" type="button" data-close>Đóng</button>');
  }
  function settingsSheet() {
    var a = S.branches[0], b = S.branches[1];
    var f = function (id, l, v, t) { return '<div class="field"><label for="' + id + '">' + l + '</label><input id="' + id + '" type="' + (t || 'text') + '" value="' + esc(v) + '" required /></div>'; };
    openSheet('<h3>Thông tin 2 cơ sở</h3><form id="settings-form">' + f('s-name', 'Tên spa', S.spaName) + f('s-an', 'Chuyên viên Cơ sở 1', a.staffName) + f('s-ap', 'SĐT Cơ sở 1', a.phone, 'tel') + f('s-bn', 'Chuyên viên Cơ sở 2', b.staffName) + f('s-bp', 'SĐT Cơ sở 2', b.phone, 'tel') + '<button class="btn block" type="submit">Lưu thay đổi</button></form>');
  }
  function successSheet(k, offline) {
    var b = branch(k.branchId);
    openSheet('<div class="okmark">' + icon('check') + '</div><h3>Đặt lịch thành công</h3>' +
      '<div class="kv"><span>Mã đơn</span><b>#' + esc(k.id) + '</b></div><div class="kv"><span>Dịch vụ</span><b>' + esc(k.serviceName) + '</b></div>' +
      '<div class="kv"><span>Thời gian</span><b>' + esc(k.time) + ' · ' + esc(prettyDate(k.date)) + '</b></div><div class="kv"><span>Chuyên viên</span><b>' + esc(k.staffName) + '</b></div>' +
      '<div class="kv"><span>Địa chỉ</span><b>' + esc(b.address) + '</b></div>' +
      '<p style="font-size:14px;color:var(--muted);margin:14px 0">' + (offline ? 'Lịch được lưu trên thiết bị này. Bạn hãy gọi cơ sở để chắc chắn spa đã nhận lịch.' : 'Spa đã nhận lịch của bạn và sẽ xác nhận qua ' + (k.notifyChannel === 'phone' ? 'SĐT' : k.notifyChannel === 'gmail' ? 'Gmail' : 'Gmail và SĐT') + '.') + '</p>' +
      (offline ? '<a class="btn block" style="margin-bottom:10px" href="' + tel(b.phone) + '">' + icon('phone') + 'Gọi ' + esc(b.branchLabel) + '</a>' : '') + '<button class="btn ghost block" type="button" data-close>Đóng</button>');
  }

  /* ---------- Gửi lịch ---------- */
  function submit(e) {
    e.preventDefault();
    var err = $('form-error'), show = function (m, id) { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (id) $(id).focus(); };
    err.hidden = true;
    var name = $('f-name').value.trim(), phone = $('f-phone').value.trim(), email = $('f-email').value.trim();
    if (!sel.time) return show('Bạn chưa chọn giờ hẹn.');
    if (!usable(sel.time)) return show('Giờ này không còn nhận lịch. Vui lòng chọn giờ khác.');
    if (!name) return show('Vui lòng nhập họ và tên.', 'f-name');
    if (!/^(0|\+84)\d{9}$/.test(phone.replace(/[\s.\-]/g, ''))) return show('Số điện thoại chưa đúng. Ví dụ: 0901 234 567.', 'f-phone');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show('Gmail chưa đúng. Ví dụ: minhanh@gmail.com.', 'f-email');
    var b = branch(sel.branch), now = new Date();
    var k = { id: 'SPA-' + Date.now().toString(36).slice(-4).toUpperCase(), branchId: b.id, staffName: b.staffName, branchLabel: b.branchLabel, serviceId: 'svc_' + (sel.service + 1), serviceName: CONFIG.services[sel.service],
      date: sel.date, time: sel.time, customerName: name, phone: phone, email: email, notifyChannel: $('f-channel').value, note: $('f-note').value.trim(), status: 'confirmed', createdAt: pad(now.getHours()) + ':' + pad(now.getMinutes()) };
    var btn = $('submit'); btn.disabled = true; btn.textContent = 'Đang gửi…';
    api('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(k) }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Đặt lịch';
      if (r.status === 409) { sync(); return show(r.data.error || 'Giờ này đã đủ khách. Vui lòng chọn giờ khác.'); }
      if (r.offline || !r.ok) {
        S.bookings.push(k);
        S.notifications.push({ id: 'n_' + Date.now(), branchId: b.id, time: k.createdAt, text: b.branchLabel + ' (' + b.staffName + '): ' + name + ' (' + phone + ') đặt ' + k.serviceName + ' lúc ' + k.time + ' ngày ' + k.date + '.' });
        save();
      } else { sync(); }
      successSheet(k, !!(r.offline || !r.ok));
      $('booking-form').reset(); sel.time = ''; renderAll();
    });
  }

  /* ---------- Sự kiện ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-b],[data-s],[data-d],[data-t],[data-f],[data-a],[data-close]'); if (!t) return;
    if (t.hasAttribute('data-close')) return closeSheet();
    if (t.dataset.b) { sel.branch = t.dataset.b; sel.time = usable(sel.time) ? sel.time : ''; }
    else if (t.dataset.s) sel.service = +t.dataset.s;
    else if (t.dataset.d) { sel.date = t.dataset.d; if (!usable(sel.time)) sel.time = ''; }
    else if (t.dataset.t) sel.time = t.dataset.t;
    else if (t.dataset.f) filter = t.dataset.f;
    else if (t.dataset.a) {
      var k = S.bookings.filter(function (x) { return x.id === t.dataset.id; })[0]; if (!k) return;
      k.status = t.dataset.a; save();
      api('/api/bookings/' + encodeURIComponent(k.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-pin': adminPin }, body: JSON.stringify({ status: k.status }) });
      toast(k.status === 'completed' ? 'Đã đánh dấu xong #' + k.id : 'Đã hủy #' + k.id + ', giờ này được mở lại');
    }
    renderAll();
  });
  $('sheet').addEventListener('click', function (e) { if (e.target === $('sheet')) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });
  $('open-call').addEventListener('click', callSheet);
  $('open-settings').addEventListener('click', settingsSheet);
  $('booking-form').addEventListener('submit', submit);
  $('pin-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('pin-err'); err.hidden = true; adminPin = $('pin').value.trim();
    sync().then(function () {
      if (adminOk) { try { sessionStorage.setItem(PINKEY, adminPin); } catch (x) {} $('pin').value = ''; return; }
      adminPin = ''; err.textContent = 'Sai mã PIN, hoặc server chưa chạy. Trang quản lý cần chạy cùng server.'; err.hidden = false;
    });
  });
  $('time-other').addEventListener('input', function (e) { sel.time = e.target.value; renderSlots(); renderBar(); });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'settings-form') return;
    e.preventDefault();
    var v = function (id) { return $(id).value.trim(); };
    S.spaName = v('s-name') || DEFAULT.spaName;
    S.branches[0].staffName = v('s-an'); S.branches[0].phone = v('s-ap');
    S.branches[1].staffName = v('s-bn'); S.branches[1].phone = v('s-bp');
    save(); closeSheet(); renderAll(); toast('Đã lưu thông tin');
  });

  function route() {
    var admin = location.hash === '#quan-ly';
    $('view-booking').hidden = admin; $('view-admin').hidden = !admin; $('bar').hidden = admin;
    document.body.classList.toggle('admin', admin); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  setInterval(function () { if (!document.hidden) { sync(); renderSlots(); } }, 60000);

  hydrateIcons(); renderAll(); route(); sync();
})();
