/* StayEase Nepal | Shared frontend client */
'use strict';

const STAY_API = 'https://script.google.com/macros/s/AKfycby4FMkDTZNNMnYlKkxy6Hk-r0HMgRX70LoEzsWJwNozMnareKC59N1R1Ds8BAZekN95/exec';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function notify(message, isError = false) {
  let layer = document.getElementById('feedbackLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'feedbackLayer';
    layer.className = 'feedback-layer';
    layer.setAttribute('role', 'alertdialog');
    layer.setAttribute('aria-live', 'assertive');
    document.body.appendChild(layer);
  }
  layer.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'feedback-card ' + (isError ? 'feedback-error' : 'feedback-success');
  const icon = document.createElement('strong');
  icon.textContent = isError ? '⚠' : '✓';
  const content = document.createElement('span');
  content.textContent = String(message || 'जानकारी उपलब्ध छैन ।');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'बन्द गर्नुहोस्';
  close.className = 'btn small secondary';
  close.onclick = () => layer.remove();
  card.append(icon, content, close);
  layer.appendChild(card);
  close.focus();
}

async function api(action, data = {}, useToken = true) {
  const payload = {
    action,
    ...data,
    ...(useToken ? { token: sessionStorage.getItem('se_token') || '' } : {})
  };
  const response = await fetch(STAY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('सर्भरसँग सम्पर्क हुन सकेन ।');
  const result = await response.json();
  if (result.sessionExpired) {
    sessionStorage.removeItem('se_token');
    notify('Session समाप्त भयो । पुनः Login गर्नुहोस् ।', true);
  }
  return result;
}

async function busy(button, task) {
  if (!button || button.disabled) return;
  button.disabled = true;
  button.classList.add('loading');
  const original = button.textContent;
  button.textContent = 'प्रक्रिया चलिरहेको छ...';
  try {
    await task();
  } catch (error) {
    notify(error.message || 'समस्या भयो ।', true);
  } finally {
    button.textContent = original;
    button.classList.remove('loading');
    button.disabled = false;
  }
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function rolePage(role) {
  return ({
    Super_Admin: 'super-admin.html',
    Admin: 'admin.html',
    Hotel_Admin: 'hotel-admin.html'
  })[role] || 'index.html';
}

function loginPage(role) {
  return ({
    Super_Admin: 'login.html',
    Admin: 'login.html',
    Hotel_Admin: 'login.html'
  })[role] || 'login.html';
}

async function requireRole(role) {
  if (!sessionStorage.getItem('se_token')) {
    location.replace(loginPage(role));
    return null;
  }
  const result = await api('me');
  if (!result.success || result.user.role !== role) {
    location.replace(loginPage(role));
    return null;
  }
  return result.user;
}

async function logout() {
  try { await api('logout'); } catch (error) { console.warn(error); }
  const role = sessionStorage.getItem('se_role');
  sessionStorage.clear();
  location.replace(loginPage(role));
}

function badge(value) {
  const status = String(value || 'Unknown');
  const color = ['Active', 'Available', 'Approved', 'Verified', 'Confirmed'].includes(status)
    ? '' : ['Hold', 'Pending_Admin', 'Pending_Super_Admin'].includes(status) ? 'warn' : 'off';
  return `<span class="pill ${color}">${esc(status)}</span>`;
}

async function compressPhoto(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('कृपया फोटो छान्नुहोस् ।');
  const image = await createImageBitmap(file);
  const ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  let quality = .83;
  let blob;
  do {
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    quality -= .12;
  } while (blob && blob.size > 5 * 1024 * 1024 && quality >= .2);
  if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('फोटो Compress गर्न सकिएन ।');
  return {
    mime: 'image/jpeg',
    base64: await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    })
  };
}
