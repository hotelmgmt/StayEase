/* StayEase Nepal | Super Admin and delegated Admin dashboard */
'use strict';
let currentUser = null;
let hotelRecords = [];
let userRecords = [];
let paymentRecords = [];
const permissions = ['hotels.review', 'hotels.manage', 'users.manage', 'payments.review', 'reports.view'];

async function controlLoad() {
  currentUser = await requireRole(window.STAY_ROLE);
  if (!currentUser) return;
  $('welcome').textContent = currentUser.name || currentUser.username;
  await Promise.all([loadHotels(), loadUsers(), loadPayments()]);
}

async function loadHotels() {
  const result = await api('listHotels');
  if (!result.success) {
    $('hotelArea').innerHTML = `<p class="muted">${esc(result.message)}</p>`;
    return;
  }
  hotelRecords = result.hotels;
  const hotels = [...result.hotels].sort((a, b) => Number(a.active) - Number(b.active) || a.remainingDays - b.remainingDays);
  $('hotelArea').innerHTML = `<div class="tablewrap"><table><thead><tr><th>होटल</th><th>स्थिति</th><th>म्याद</th><th>कार्य</th></tr></thead><tbody>${hotels.map(h => `
    <tr>
      <td><strong>${esc(h.name)}</strong><br><small>${esc(h.id)} · ${esc(h.district)}</small></td>
      <td>${badge(h.active ? 'Active' : h.registration || 'Inactive')}</td>
      <td>${h.remainingDays} दिन<br><small>${esc(h.expiry)}</small></td>
      <td><div class="row">
        <button class="btn small secondary" data-edit-hotel="${esc(h.id)}">Edit</button>
        ${h.registration === 'Pending_Admin' || h.registration === 'Pending_Super_Admin' ? `<button class="btn small" data-review="${esc(h.id)}">Review</button>` : ''}
        ${h.registration === 'Approved' ? `<button class="btn small success" data-payment="${esc(h.id)}">Renew</button>` : ''}
      </div></td>
    </tr>`).join('')}</tbody></table></div>`;
  $('hotelCount').textContent = hotels.length;
  $('inactiveCount').textContent = hotels.filter(h => !h.active).length;
}

async function loadUsers() {
  const result = await api('listUsers');
  if (!result.success) {
    $('userArea').innerHTML = `<p class="muted">${esc(result.message)}</p>`;
    return;
  }
  userRecords = result.users;
  $('userArea').innerHTML = `<div class="tablewrap"><table><thead><tr><th>Username</th><th>भूमिका</th><th>अवस्था</th><th>कार्य</th></tr></thead><tbody>${result.users.map(u => `
    <tr>
      <td>${esc(u.username)}<br><small>${esc(u.hotelId || u.email)}</small></td>
      <td>${esc(u.role)}</td>
      <td>${badge(u.status)}</td>
      <td>${u.role === 'Super_Admin' ? 'मुख्य Controller' : `<div class="row"><button class="btn small secondary" data-user-status="${esc(u.id)}">${u.status === 'Active' ? 'Deactivate' : 'Activate'}</button>${u.role === 'Admin' && window.STAY_ROLE === 'Super_Admin' ? `<button class="btn small ghost" data-permissions="${esc(u.id)}">Permissions</button>` : ''}</div>`}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function loadPayments() {
  const result = await api('listPayments');
  if (!result.success) {
    $('paymentArea').innerHTML = `<p class="muted">${esc(result.message)}</p>`;
    return;
  }
  paymentRecords = result.payments;
  $('paymentArea').innerHTML = `<div class="tablewrap"><table><thead><tr><th>होटल</th><th>रकम</th><th>भुक्तानी</th><th>अवधि</th></tr></thead><tbody>${result.payments.map(p => `
    <tr><td>${esc(p.hotelId)}</td><td>रु. ${p.amount.toLocaleString()}</td><td>${esc(p.reference)}<br>${badge(p.status)}</td><td>${esc(String(p.start || '').slice(0, 10))} — ${esc(String(p.end || '').slice(0, 10))}</td></tr>
  `).join('')}</tbody></table></div>`;
  $('revenue').textContent = 'रु. ' + result.payments.filter(p => p.status === 'Verified').reduce((s, p) => s + p.amount, 0).toLocaleString();
  const month = new Date().toISOString().slice(0, 7);
  const monthly = result.payments.filter(p => p.status === 'Verified' && String(p.date || '').slice(0, 7) === month);
  $('monthlyRevenue').textContent = 'रु. ' + monthly.reduce((sum, p) => sum + p.amount, 0).toLocaleString();
}

function openControl(title, html, submitHandler) {
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = `<form id="controlForm" class="stack">${html}<button class="btn full" type="submit">सुरक्षित गर्नुहोस्</button></form>`;
  $('modal').classList.remove('hidden');
  const requestId = crypto.randomUUID();
  $('controlForm').onsubmit = event => {
    event.preventDefault();
    busy(event.submitter, async () => {
      const result = await submitHandler({ ...formData(event.target), requestId });
      if (!result.success) throw new Error(result.message);
      $('modal').classList.add('hidden');
      notify(result.message);
      await Promise.all([loadHotels(), loadUsers(), loadPayments()]);
    });
  };
}

function hotelForm(h = {}) {
  return `
    <input type="hidden" name="hotelId" value="${esc(h.id || '')}">
    <label class="field">होटलको नाम<input name="name" required value="${esc(h.name || '')}"></label>
    <div class="formgrid">
      <label class="field">सम्पर्क नम्बर<input name="phone" value="${esc(h.phone || '')}"></label>
      <label class="field">इमेल<input type="email" name="email" value="${esc(h.email || '')}"></label>
      <label class="field">प्रदेश<input name="province"></label>
      <label class="field">जिल्ला<input name="district" value="${esc(h.district || '')}"></label>
    </div>
    <label class="field">नगरपालिका<input name="municipality" value="${esc(h.municipality || '')}"></label>
    <label class="field">ठेगाना<input name="address" value="${esc(h.address || '')}"></label>
    <label class="field">Google Maps Link<input name="maps" value="${esc(h.maps || '')}"></label>
    <label class="field">Package<select name="plan"><option>Standard</option><option>Premium</option><option>Enterprise</option></select></label>
  `;
}

$('changePassword').onclick = () => openControl('Password Change', `
  <label class="field">हालको Password<input name="currentPassword" type="password" required></label>
  <label class="field">नयाँ Password<input name="newPassword" type="password" minlength="10" required></label>
`, data => api('changePassword', data));

$('newHotel').onclick = () => openControl('नयाँ होटल दर्ता', hotelForm(), data => api('saveHotel', data));
$('newUser').onclick = () => openControl('नयाँ User बनाउनुहोस्', `
  <label class="field">Username<input name="username" required minlength="4"></label>
  <label class="field">Temporary Password<input name="password" type="password" required minlength="10"></label>
  <label class="field">पूरा नाम<input name="fullName"></label>
  <label class="field">भूमिका<select name="role"><option value="Hotel_Admin">Hotel Admin</option>${window.STAY_ROLE === 'Super_Admin' ? '<option value="Admin">Admin</option>' : ''}</select></label>
  <label class="field">Hotel ID (Hotel Admin का लागि)<input name="hotelId" placeholder="H-... "></label>
`, data => api('createUser', data));

$('hotelArea').onclick = event => {
  const edit = event.target.closest('[data-edit-hotel]');
  if (edit) {
    const h = hotelRecords.find(x => x.id === edit.dataset.editHotel);
    return openControl('होटल सम्पादन', hotelForm(h), data => api('saveHotel', data));
  }
  const review = event.target.closest('[data-review]');
  if (review) {
    const id = review.dataset.review;
    return openControl('होटल Approval', `
      <input type="hidden" name="hotelId" value="${esc(id)}">
      <label class="field">निर्णय<select name="decision"><option value="Approve">Approve</option><option value="Reject">Reject</option></select></label>
    `, data => api('reviewHotel', data));
  }
  const payment = event.target.closest('[data-payment]');
  if (payment) return openControl('वार्षिक Payment / Renewal', `
    <input type="hidden" name="hotelId" value="${esc(payment.dataset.payment)}">
    <label class="field">रकम<input name="amount" type="number" min="1" required></label>
    <label class="field">भुक्तानी मिति<input name="paymentDate" type="date" required></label>
    <label class="field">Payment Method<input name="method" required placeholder="Bank / Cash / eSewa"></label>
    <label class="field">Transaction Reference<input name="reference" required></label>
  `, data => api('verifyPayment', data));
};

$('userArea').onclick = event => {
  const status = event.target.closest('[data-user-status]');
  if (status) {
    const user = userRecords.find(x => x.id === status.dataset.userStatus);
    const next = user.status === 'Active' ? 'Inactive' : 'Active';
    if (!confirm(`${user.username} लाई ${next} बनाउने ?`)) return;
    return busy(status, async () => {
      const result = await api('setUserStatus', { userId: user.id, status: next });
      if (!result.success) throw new Error(result.message);
      notify(result.message);
      await loadUsers();
    });
  }
  const perm = event.target.closest('[data-permissions]');
  if (perm) return openControl('Admin Permission', `
    <input type="hidden" name="userId" value="${esc(perm.dataset.permissions)}">
    <label class="field">Permission<select name="permission">${permissions.map(p => `<option value="${p}">${p}</option>`).join('')}</select></label>
    <label class="field">अनुमति<select name="allowed"><option value="true">Allow</option><option value="false">Deny</option></select></label>
  `, data => api('setPermission', { ...data, allowed: data.allowed === 'true' }));
};

$('closeModal').onclick = () => $('modal').classList.add('hidden');
$('logout').onclick = event => busy(event.currentTarget, logout);
$('printReport').onclick = () => window.print();
controlLoad().catch(error => notify(error.message, true));
