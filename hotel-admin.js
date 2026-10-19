/* StayEase Nepal | Hotel Admin actions */
'use strict';
let hotelUser = null;
let hotelRooms = [];

async function hotelLoad() {
  hotelUser = await requireRole('Hotel_Admin');
  if (!hotelUser) return;
  const setupRequired = !hotelUser.mobile || !hotelUser.emailVerified || hotelUser.mustChangePassword;
  $('firstLogin').classList.toggle('hidden', !setupRequired);
  document.querySelectorAll('[data-requires-profile]').forEach(section => {
    section.classList.toggle('hidden', setupRequired);
  });
  if (setupRequired) { initHotelNavigation('onboarding'); return; }
  const result = await api('dashboard');
  if (!result.success) throw new Error(result.message);
  $('heading').textContent = result.hotel.name;
  $('hotelName').textContent = result.hotel.name;
  $('total').textContent = result.summary.total;
  $('available').textContent = result.summary.available;
  $('processing').textContent = result.summary.processing;
  const fields = ['province', 'district', 'municipality', 'address', 'maps', 'description', 'facilities'];
  fields.forEach(key => {
    const input = $('hotelForm').elements.namedItem(key);
    if (input && document.activeElement !== input) input.value = result.hotel[key] || '';
  });
  hotelRooms = result.rooms;
  $('roomArea').innerHTML = result.rooms.map(r => `
    <article class="card" style="padding:14px">
      ${r.photo1 ? `<img class="picture" src="${esc(r.photo1)}" alt="Room ${esc(r.roomNumber)}">` : '<div class="picture" style="display:grid;place-items:center">🛏️</div>'}
      <div class="row between"><h3>Room ${esc(r.roomNumber)}</h3>${badge(r.status)}</div>
      <p class="muted mini">${esc(r.type)} · रु. ${r.price.toLocaleString()}</p>
      <div class="row">
        <button class="btn small secondary" data-edit="${esc(r.roomNumber)}">Edit</button>
        <button class="btn small secondary" data-photo="${esc(r.roomNumber)}">Photos</button>
        <button class="btn small ghost" data-status="${esc(r.roomNumber)}">Status</button>
        <button class="btn small danger" data-delete="${esc(r.roomNumber)}">Remove</button>
      </div>
    </article>
  `).join('') || '<p>अहिलेसम्म कोठा छैन ।</p>';
  await loadBookings();
  initHotelNavigation('overview');
}

async function loadBookings() {
  const result = await api('listBookings');
  if (!result.success) throw new Error(result.message);
  $('bookingArea').innerHTML = `<div class="tablewrap"><table><thead><tr><th>कोठा / ग्राहक</th><th>स्थिति</th><th>कार्य</th></tr></thead><tbody>${result.bookings.map(b => `
    <tr><td><strong>${esc(b.room)}</strong><br>${esc(b.guest)}<br><small>${esc(b.phone)}</small></td><td>${badge(b.status)}</td><td><div class="row">
      ${b.status === 'Hold' ? `<button class="btn small success" data-decision="Approve" data-id="${esc(b.id)}">Approve</button><button class="btn small danger" data-decision="Reject" data-id="${esc(b.id)}">Reject</button>` : ''}
      ${b.status === 'Confirmed' ? `<button class="btn small" data-decision="CheckIn" data-id="${esc(b.id)}">Check-In</button>` : ''}
      ${['Confirmed', 'Checked-In'].includes(b.status) ? `<button class="btn small secondary" data-decision="CheckOut" data-id="${esc(b.id)}">Checkout</button>` : ''}
    </div></td></tr>
  `).join('')}</tbody></table></div>`;
}

function roomDialog(room = {}) {
  $('modalTitle').textContent = room.roomNumber ? 'कोठा सम्पादन' : 'नयाँ कोठा';
  $('modalBody').innerHTML = `<form id="roomForm" class="stack">
    <label class="field">Room Number<input name="roomNumber" required value="${esc(room.roomNumber || '')}" ${room.roomNumber ? 'readonly' : ''}></label>
    <label class="field">Price (NPR)<input name="price" type="number" min="1" required value="${room.price || ''}"></label>
    <label class="field">Room Type<input name="type" value="${esc(room.type || '')}"></label>
    <label class="field">Capacity<input name="capacity" value="${esc(room.capacity || '')}"></label>
    <label class="field">Facilities<input name="facilities" value="${esc(room.facilities || '')}"></label>
    <label class="field">Description<textarea name="description">${esc(room.description || '')}</textarea></label>
    <button class="btn full" type="submit">कोठा सुरक्षित गर्नुहोस्</button>
  </form>`;
  $('modal').classList.remove('hidden');
  $('roomForm').onsubmit = event => {
    event.preventDefault();
    busy(event.submitter, async () => {
      const result = await api('saveRoom', formData(event.target));
      if (!result.success) throw new Error(result.message);
      $('modal').classList.add('hidden');
      notify(result.message);
      await hotelLoad();
    });
  };
}

function photoDialog(number) {
  $('modalTitle').textContent = 'Room ' + number + ' · फोटो';
  $('modalBody').innerHTML = `<form id="photoForm" class="stack">
    <label class="field">फोटोको प्रकार<select name="type"><option value="main">मुख्य कोठा</option><option value="bathroom">बाथरूम</option><option value="extra">अतिरिक्त फोटो</option></select></label>
    <label class="field">फोटो छान्नुहोस्<input name="photo" type="file" accept="image/*" required></label>
    <button class="btn full" type="submit">Compress र Upload</button>
  </form>`;
  $('modal').classList.remove('hidden');
  $('photoForm').onsubmit = event => {
    event.preventDefault();
    busy(event.submitter, async () => {
      const data = formData(event.target);
      const photo = await compressPhoto(event.target.elements.photo.files[0]);
      const result = await api('uploadPhoto', { ...photo, type: data.type, roomNumber: number });
      if (!result.success) throw new Error(result.message);
      $('modal').classList.add('hidden');
      notify(result.message);
      await hotelLoad();
    });
  };
}

$('addRoom').onclick = () => roomDialog();
$('roomArea').onclick = event => {
  const remove = event.target.closest('[data-delete]');
  if (remove) {
    if (!confirm('कोठा सार्वजनिक सूचीबाट हटाउने ?')) return;
    return busy(remove, async () => {
      const result = await api('deleteRoom', { roomNumber: remove.dataset.delete });
      if (!result.success) throw new Error(result.message);
      notify(result.message);
      await hotelLoad();
    });
  }
  const edit = event.target.closest('[data-edit]');
  if (edit) return roomDialog(hotelRooms.find(r => r.roomNumber === edit.dataset.edit));
  const photo = event.target.closest('[data-photo]');
  if (photo) return photoDialog(photo.dataset.photo);
  const status = event.target.closest('[data-status]');
  if (status) {
    $('modalTitle').textContent = 'कोठाको अवस्था';
    $('modalBody').innerHTML = `<form id="statusForm" class="stack">
      <label class="field">अवस्था<select name="status"><option>Available</option><option>Cleaning</option><option>Maintenance</option><option>Inactive</option></select></label>
      <button class="btn full" type="submit">अवस्था अपडेट</button>
    </form>`;
    $('modal').classList.remove('hidden');
    $('statusForm').onsubmit = event => {
      event.preventDefault();
      busy(event.submitter, async () => {
        const result = await api('changeRoomStatus', { roomNumber: status.dataset.status, ...formData(event.target) });
        if (!result.success) throw new Error(result.message);
        $('modal').classList.add('hidden');
        notify(result.message);
        await hotelLoad();
      });
    };
  }
};

$('bookingArea').onclick = event => {
  const button = event.target.closest('[data-decision]');
  if (!button) return;
  busy(button, async () => {
    const result = await api('decideBooking', { bookingId: button.dataset.id, decision: button.dataset.decision });
    if (!result.success) throw new Error(result.message);
    notify(result.message);
    await hotelLoad();
  });
};

$('hotelForm').onsubmit = event => {
  event.preventDefault();
  busy(event.submitter, async () => {
    const result = await api('saveSettings', formData(event.target));
    if (!result.success) throw new Error(result.message);
    notify(result.message);
    await hotelLoad();
  });
};

$('gps').onclick = event => busy(event.currentTarget, async () => {
  const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000 }));
  $('hotelForm').elements.latitude.value = position.coords.latitude;
  $('hotelForm').elements.longitude.value = position.coords.longitude;
  notify('GPS राखियो । अब होटल विवरण अपडेट गर्नुहोस् ।');
});

$('uploadHotel').onclick = event => busy(event.currentTarget, async () => {
  const photo = await compressPhoto($('hotelPhoto').files[0]);
  const result = await api('uploadPhoto', { ...photo, type: 'hotel' });
  if (!result.success) throw new Error(result.message);
  notify(result.message);
  await hotelLoad();
});

$('mobileForm').onsubmit = event => {
  event.preventDefault();
  busy(event.submitter, async () => {
    const result = await api('saveMobile', formData(event.target));
    notify(result.message, !result.success);
    if (result.success) await hotelLoad();
  });
};

$('emailForm').onsubmit = event => {
  event.preventDefault();
  busy(event.submitter, async () => {
    const result = await api('sendEmailOtp', formData(event.target));
    notify(result.message, !result.success);
  });
};

$('verifyForm').onsubmit = event => {
  event.preventDefault();
  busy(event.submitter, async () => {
    const result = await api('verifyEmailOtp', formData(event.target));
    notify(result.message, !result.success);
    if (result.success) await hotelLoad();
  });
};

$('passwordForm').onsubmit = event => {
  event.preventDefault();
  busy(event.submitter, async () => {
    const result = await api('changePassword', formData(event.target));
    notify(result.message, !result.success);
    if (result.success) await hotelLoad();
  });
};

$('closeModal').onclick = () => $('modal').classList.add('hidden');
$('logout').onclick = event => busy(event.currentTarget, logout);
hotelLoad().catch(error => notify(error.message, true));

function initHotelNavigation(defaultView) {
  const show = name => {
    const view = ['overview','profile','rooms','bookings','onboarding'].includes(name) ? name : defaultView;
    document.querySelectorAll('[data-hotel-panel]').forEach(panel => {
      const hiddenBySetup = panel.hasAttribute('data-requires-profile') &&
        (!hotelUser?.mobile || !hotelUser?.emailVerified || hotelUser?.mustChangePassword);
      panel.classList.toggle('hidden', panel.dataset.hotelPanel !== view || hiddenBySetup);
    });
    document.querySelectorAll('[data-hotel-view]').forEach(link => link.classList.toggle('side-active', link.dataset.hotelView === view));
    $('dashboardSidebar')?.classList.remove('sidebar-open');
  };
  document.querySelectorAll('[data-hotel-view]').forEach(link => link.onclick = () => show(link.dataset.hotelView));
  $('menuToggle').onclick = () => $('dashboardSidebar').classList.toggle('sidebar-open');
  show(defaultView);
}
