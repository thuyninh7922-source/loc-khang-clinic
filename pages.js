const api = (() => {
  let csrfToken = '';
  const mutating = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

  async function getCsrf() {
    if (csrfToken) return csrfToken;
    const response = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Không thể khởi tạo phiên bảo mật.');
    csrfToken = data.csrfToken;
    return csrfToken;
  }

  async function request(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    if (mutating.has(method)) headers.set('X-CSRF-Token', await getCsrf());
    const response = await fetch(url, { ...options, method, headers, credentials: 'same-origin' });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 403 && /Phiên bảo mật/.test(data.error || '')) csrfToken = '';
      throw new Error(data.error || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.');
    }
    if (data.csrfToken) csrfToken = data.csrfToken;
    return data;
  }

  return {
    get: (url) => request(url),
    post: (url, body) => request(url, { method: 'POST', body: JSON.stringify(body) }),
    patch: (url, body) => request(url, { method: 'PATCH', body: JSON.stringify(body) }),
  };
})();

document.querySelectorAll('.site-header .nav-wrap').forEach((wrap, index) => {
  const nav = wrap.querySelector('.main-nav');
  if (!nav) return;
  let toggle = wrap.querySelector('.menu-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'menu-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    if (!nav.id) nav.id = `page-nav-${index + 1}`;
    toggle.setAttribute('aria-controls', nav.id);
    toggle.setAttribute('aria-label', 'Mở menu');
    toggle.innerHTML = '<span></span><span></span><span></span>';
    wrap.querySelector('.brand')?.after(toggle);
  }
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Mở menu');
  }));
});

function showToast(title, detail = '') {
  let toast = document.querySelector('#page-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'page-toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = '✓';
    const content = document.createElement('div');
    content.innerHTML = '<strong></strong><span></span>';
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Đóng thông báo');
    close.textContent = '×';
    close.addEventListener('click', () => toast.classList.remove('show'));
    toast.append(icon, content, close);
    document.body.appendChild(toast);
  }
  toast.querySelector('strong').textContent = title;
  toast.querySelector('div span').textContent = detail;
  toast.classList.add('show');
  clearTimeout(window.__pageToastTimer);
  window.__pageToastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
}

function showError(id, message) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = message;
}
function clearError(id) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = '';
}
function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}
function localDateString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
function setDateMinimum() {
  document.querySelectorAll('input[type="date"][name="date"]').forEach((input) => { input.min = localDateString(); });
}
function appendCell(row, text, className) {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = text || '—';
  row.appendChild(cell);
  return cell;
}
function appendStackCell(row, first, second) {
  const cell = document.createElement('td');
  const strong = document.createElement('strong');
  strong.textContent = first || '—';
  const small = document.createElement('small');
  small.textContent = second || '';
  cell.append(strong, document.createElement('br'), small);
  row.appendChild(cell);
  return cell;
}
function statusLabel(status) {
  return ({ pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy', open: 'Chưa xử lý', resolved: 'Đã xử lý' })[status] || status || '—';
}
function addStatusCell(row, status) {
  const cell = document.createElement('td');
  const pill = document.createElement('span');
  pill.className = `status-pill${status === 'pending' || status === 'open' ? ' pending' : ''}`;
  pill.textContent = statusLabel(status);
  cell.appendChild(pill);
  row.appendChild(cell);
}
function renderEmpty(body, columnCount, message) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = columnCount;
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = message;
  cell.appendChild(empty);
  row.appendChild(cell);
  body.replaceChildren(row);
}
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('vi-VN').format(date);
}
function makeActionButton(label, className, dataset, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  Object.assign(button.dataset, dataset);
  button.addEventListener('click', handler);
  return button;
}

const bookingForm = document.querySelector('#portal-booking-form');
if (bookingForm) {
  setDateMinimum();
  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = bookingForm.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const { appointment } = await api.post('/api/appointments', formData(bookingForm));
      bookingForm.reset();
      setDateMinimum();
      showToast(`Đã nhận yêu cầu ${appointment.public_code}`, 'Điều phối viên sẽ gọi lại để xác nhận lịch hẹn.');
    } catch (error) {
      showToast('Chưa gửi được yêu cầu', error.message);
    } finally {
      submit.disabled = false;
    }
  });
}

async function handleLogin(form, endpoint, errorId, destination) {
  clearError(errorId);
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    const { user } = await api.post(endpoint, formData(form));
    showToast(`Xin chào ${user.fullName}`, 'Đang chuyển đến khu vực tài khoản của bạn.');
    setTimeout(() => { window.location.assign(destination); }, 500);
  } catch (error) {
    showError(errorId, error.message);
  } finally {
    submit.disabled = false;
  }
}

document.querySelector('#login-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  handleLogin(event.currentTarget, '/api/auth/login', 'login-error', '/patient');
});
document.querySelector('#admin-login-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  handleLogin(event.currentTarget, '/api/auth/admin/login', 'admin-login-error', '/admin');
});

document.querySelector('#patient-register-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  clearError('register-error');
  const data = formData(form);
  if (data.password !== data.confirmPassword) return showError('register-error', 'Mật khẩu nhập lại chưa trùng khớp.');
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  delete data.confirmPassword;
  try {
    await api.post('/api/auth/register', data);
    showToast('Đăng ký thành công', 'Đang chuyển đến hồ sơ bệnh nhân của bạn.');
    setTimeout(() => { window.location.assign('/patient'); }, 500);
  } catch (error) {
    showError('register-error', error.message);
  } finally {
    submit.disabled = false;
  }
});

async function loadPatientPage() {
  try {
    const [{ user }, { appointments }] = await Promise.all([api.get('/api/auth/me'), api.get('/api/appointments')]);
    if (!user || user.role !== 'patient') return window.location.replace('/login');
    document.querySelectorAll('[data-patient-name]').forEach((node) => { node.textContent = user.fullName; });
    document.querySelectorAll('[data-patient-email]').forEach((node) => { node.textContent = user.email; });
    document.querySelectorAll('[data-user-name]').forEach((node) => { node.textContent = user.fullName; });
    const body = document.querySelector('#patient-appointment-table tbody');
    const count = document.querySelector('[data-patient-appointments]');
    if (count) count.textContent = String(appointments.length);
    if (!appointments.length) return renderEmpty(body, 5, 'Bạn chưa có lịch hẹn. Hãy đặt lịch khám đầu tiên của mình.');
    const fragment = document.createDocumentFragment();
    appointments.forEach((item) => {
      const row = document.createElement('tr');
      appendCell(row, item.public_code);
      appendStackCell(row, item.specialty, item.doctor);
      appendStackCell(row, formatDate(item.appointment_date), item.appointment_time);
      appendStackCell(row, item.location_name, [item.location_city, item.location_address].filter(Boolean).join(' · '));
      addStatusCell(row, item.status);
      fragment.appendChild(row);
    });
    body.replaceChildren(fragment);
  } catch (error) {
    if (/đăng nhập|quyền truy cập/i.test(error.message)) return window.location.replace('/login');
    showToast('Không tải được hồ sơ', error.message);
  }
}

async function loadAdminPage() {
  const body = document.querySelector('#appointment-table tbody');
  try {
    const [{ user }, data, contactData] = await Promise.all([
      api.get('/api/auth/me'),
      api.get('/api/appointments'),
      api.get('/api/admin/contact-requests'),
    ]);
    if (!user || user.role !== 'admin') return window.location.replace('/admin-login');
    document.querySelectorAll('[data-user-name]').forEach((node) => { node.textContent = user.fullName; });
    const total = document.querySelector('[data-stat="total"]');
    const pending = document.querySelector('[data-stat="pending"]');
    if (total) total.textContent = String(data.stats.total);
    if (pending) pending.textContent = String(data.stats.pending);
    renderAdminAppointments(body, data.appointments);
    renderContactRequests(contactData.requests);
  } catch (error) {
    if (/đăng nhập|quyền truy cập/i.test(error.message)) return window.location.replace('/admin-login');
    showToast('Không tải được dữ liệu quản trị', error.message);
  }
}

function renderAdminAppointments(body, appointments) {
  if (!appointments.length) return renderEmpty(body, 7, 'Chưa có lịch hẹn mới. Các yêu cầu đặt lịch sẽ hiển thị tại đây.');
  const fragment = document.createDocumentFragment();
  appointments.forEach((item) => {
    const row = document.createElement('tr');
    appendStackCell(row, item.public_code, item.full_name);
    appendStackCell(row, item.specialty, item.doctor);
    appendStackCell(row, formatDate(item.appointment_date), item.appointment_time);
    appendStackCell(row, item.location_name, [item.location_city, item.location_address].filter(Boolean).join(' · '));
    appendCell(row, item.phone);
    addStatusCell(row, item.status);
    const action = document.createElement('td');
    if (item.status === 'pending') {
      action.appendChild(makeActionButton('Xác nhận', 'ghost-button admin-confirm', { id: item.id }, async () => {
        try {
          await api.patch(`/api/admin/appointments/${encodeURIComponent(item.id)}`, { status: 'confirmed' });
          showToast('Đã xác nhận lịch hẹn', item.public_code);
          loadAdminPage();
        } catch (error) { showToast('Chưa cập nhật được lịch hẹn', error.message); }
      }));
    } else {
      action.textContent = '—';
    }
    row.appendChild(action);
    fragment.appendChild(row);
  });
  body.replaceChildren(fragment);
}

function renderContactRequests(requests) {
  const body = document.querySelector('#contact-request-table tbody');
  if (!body) return;
  if (!requests.length) return renderEmpty(body, 5, 'Chưa có yêu cầu tư vấn mới.');
  const fragment = document.createDocumentFragment();
  requests.forEach((item) => {
    const row = document.createElement('tr');
    appendStackCell(row, item.full_name, item.phone);
    appendCell(row, item.message);
    appendCell(row, formatDate(item.created_at));
    addStatusCell(row, item.status);
    const action = document.createElement('td');
    if (item.status === 'open') {
      action.appendChild(makeActionButton('Đã xử lý', 'ghost-button', { id: item.id }, async () => {
        try {
          await api.patch(`/api/admin/contact-requests/${encodeURIComponent(item.id)}`, { status: 'resolved' });
          showToast('Đã cập nhật yêu cầu tư vấn');
          loadAdminPage();
        } catch (error) { showToast('Chưa cập nhật được yêu cầu', error.message); }
      }));
    } else {
      action.textContent = '—';
    }
    row.appendChild(action);
    fragment.appendChild(row);
  });
  body.replaceChildren(fragment);
}

if (document.querySelector('#patient-appointment-table')) loadPatientPage();
if (document.querySelector('#appointment-table')) loadAdminPage();

document.querySelector('#patient-logout, #admin-logout')?.addEventListener('click', async () => {
  try { await api.post('/api/auth/logout', {}); } catch (error) { showToast('Không đăng xuất được', error.message); return; }
  window.location.assign('/login');
});

document.querySelector('#disease-search')?.addEventListener('input', filterDiseases);
document.querySelector('#disease-category')?.addEventListener('change', filterDiseases);
function filterDiseases() {
  const query = (document.querySelector('#disease-search')?.value || '').toLowerCase();
  const category = document.querySelector('#disease-category')?.value || 'all';
  document.querySelectorAll('.disease-card').forEach((card) => {
    card.style.display = card.textContent.toLowerCase().includes(query) && (category === 'all' || card.dataset.category === category) ? '' : 'none';
  });
}

const userName = document.querySelector('[data-user-name]');
if (userName) {
  api.get('/api/auth/me').then(({ user }) => {
    if (user) document.querySelectorAll('[data-user-name]').forEach((node) => { node.textContent = user.fullName; });
  }).catch(() => {});
}
