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
  const extra = status === 'pending' || status === 'open'
    ? ' pending'
    : status === 'cancelled' ? ' cancelled' : '';
  pill.className = `status-pill${extra}`;
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
function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? `${new Intl.NumberFormat('vi-VN').format(number)} đ` : '—';
}
function paymentMethodLabel(method) {
  return ({ cash: 'Tại quầy', transfer: 'Chuyển khoản' })[method] || '—';
}
function serviceTierLabel(tier) {
  return tier === 'premium' ? 'Cao cấp (GS/PGS/TS)' : 'Thường (Bình dân)';
}
function paymentStateLabel(item) {
  if (item.total_vnd === null || item.total_vnd === undefined) return '—';
  if (Number(item.total_vnd) === 0) return 'Miễn phí';
  return item.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán';
}
function paymentCell(item, withActions) {
  const cell = document.createElement('td');
  if (item.total_vnd === null || item.total_vnd === undefined) {
    cell.textContent = '—';
    return cell;
  }
  const total = document.createElement('strong');
  total.textContent = formatMoney(item.total_vnd);
  const meta = document.createElement('small');
  const rxNote = Number(item.prescription_total_vnd) > 0 ? ` · Thuốc: ${formatMoney(item.prescription_total_vnd)}` : '';
  meta.textContent = `${serviceTierLabel(item.service_tier)} · ${paymentMethodLabel(item.payment_method)}${item.is_first_visit ? ' · Khám lần đầu' : ''}${rxNote}`;
  const settled = Number(item.total_vnd) === 0 || item.payment_status === 'paid';
  const pill = document.createElement('span');
  pill.className = `status-pill${settled ? '' : ' pending'}`;
  pill.textContent = paymentStateLabel(item);
  cell.append(total, document.createElement('br'), meta, document.createElement('br'), pill);
  const actions = document.createElement('div');
  actions.className = 'cell-actions';
  if (withActions && !settled) {
    actions.appendChild(makeActionButton('Đã nhận tiền', 'ghost-button', { id: item.id }, async () => {
      try {
        await api.patch(`/api/admin/appointments/${encodeURIComponent(item.id)}/payment`, { paymentStatus: 'paid' });
        showToast('Đã ghi nhận thanh toán', item.public_code);
        loadAdminPage();
      } catch (error) { showToast('Chưa cập nhật được thanh toán', error.message); }
    }));
  }
  const link = document.createElement('a');
  link.className = 'ghost-button';
  link.href = `/invoice?code=${encodeURIComponent(item.public_code)}`;
  link.textContent = item.prescription ? 'Hóa đơn & Đơn thuốc' : 'Hóa đơn';
  actions.appendChild(link);
  cell.appendChild(actions);
  return cell;
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

async function initServicePicker(form) {
  const box = form.querySelector('#service-options');
  if (!box) return;
  const offerBox = form.querySelector('#first-visit-offer');
  const estimate = form.querySelector('#service-estimate');
  const tierHeading = form.querySelector('#service-tier-heading');
  let catalog;
  try {
    catalog = await api.get('/api/services');
  } catch (error) {
    box.textContent = 'Không tải được danh sách dịch vụ. Vui lòng tải lại trang.';
    if (offerBox) offerBox.textContent = '';
    return;
  }

  const currentTier = () => form.querySelector('input[name="serviceTier"]:checked')?.value || 'standard';
  const servicePrice = (service, tier) => (tier === 'premium' ? (service.pricePremium ?? service.price) : (service.priceStandard ?? service.price));

  const refresh = () => {
    const tier = currentTier();
    if (tierHeading) {
      tierHeading.textContent = tier === 'premium'
        ? 'Cao cấp · GS / PGS.TS / TS.BS'
        : 'Bình dân · Bác sĩ chuyên khoa';
    }
    let sum = 0;
    form.querySelectorAll('.service-option').forEach((label) => {
      const input = label.querySelector('input[name="serviceIds"]');
      const priceEl = label.querySelector('em');
      const nameEl = label.querySelector('strong');
      const onlyTier = input.dataset.onlyTier || '';
      const visible = !onlyTier || onlyTier === tier;
      label.hidden = !visible;
      if (!visible) {
        input.checked = false;
        return;
      }
      const price = tier === 'premium' ? Number(input.dataset.pricePremium) : Number(input.dataset.priceStandard);
      if (priceEl) priceEl.textContent = formatMoney(price);
      if (nameEl) {
        const baseName = input.dataset.baseName || '';
        nameEl.textContent = tier === 'premium' && !onlyTier ? `${baseName} (Cao cấp)` : baseName;
      }
      if (input.checked) sum += price;
    });
    if (estimate) estimate.textContent = formatMoney(sum);
    if (offerBox) {
      const offer = catalog.firstVisit || {};
      const parts = [];
      if (offer.percent) parts.push(`giảm ${offer.percent}%${offer.maxDiscount ? ` (tối đa ${formatMoney(offer.maxDiscount)})` : ''} dịch vụ khám`);
      if (offer.gift) {
        const giftPrice = tier === 'premium' ? (offer.gift.pricePremium ?? offer.gift.price) : (offer.gift.priceStandard ?? offer.gift.price);
        parts.push(`tặng ${offer.gift.name} (trị giá ${formatMoney(giftPrice)})`);
      }
      offerBox.textContent = parts.length
        ? `Ưu đãi khám lần đầu: ${parts.join(' và ')}. Ưu đãi tự động áp dụng nếu số điện thoại của bạn chưa từng đặt lịch tại phòng khám.`
        : '';
      offerBox.hidden = !parts.length;
    }
  };

  const options = catalog.services.map((service) => {
    const label = document.createElement('label');
    label.className = 'service-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'serviceIds';
    input.value = service.id;
    input.dataset.baseName = service.name;
    input.dataset.onlyTier = service.onlyTier || '';
    input.dataset.priceStandard = String(service.priceStandard ?? service.price);
    input.dataset.pricePremium = String(service.pricePremium ?? service.price);
    input.addEventListener('change', refresh);
    const text = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = service.name;
    const note = document.createElement('small');
    note.textContent = service.description;
    text.append(name, note);
    const price = document.createElement('em');
    price.textContent = formatMoney(servicePrice(service, currentTier()));
    label.append(input, text, price);
    return label;
  });
  box.replaceChildren(...options);

  let autoPicked = null;
  const pickSpecialtyService = (specialtyValue) => {
    const checked = [...form.querySelectorAll('input[name="serviceIds"]:checked')];
    if (autoPicked && checked.length === 1 && checked[0] === autoPicked) {
      autoPicked.checked = false;
    } else if (checked.length) {
      return;
    }
    autoPicked = null;
    const match = catalog.services.find((service) => service.specialty && service.specialty === specialtyValue);
    const input = match && form.querySelector(`input[name="serviceIds"][value="${CSS.escape(match.id)}"]`);
    if (input) { input.checked = true; autoPicked = input; }
    refresh();
  };

  const specialtySelect = form.querySelector('[name="specialty"]');
  specialtySelect?.addEventListener('change', (event) => pickSpecialtyService(event.target.value));
  form.addEventListener('change', (event) => {
    if (event.target === autoPicked) autoPicked = null;
    if (event.target?.name === 'serviceTier') refresh();
  });
  form.addEventListener('tierchange', refresh);

  if (specialtySelect?.value) pickSpecialtyService(specialtySelect.value);
  refresh();
}

const bookingForm = document.querySelector('#portal-booking-form');
if (bookingForm) {
  setDateMinimum();
  initServicePicker(bookingForm);
  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = bookingForm.querySelector('[type="submit"]');
    submit.disabled = true;
    let redirecting = false;
    try {
      const payload = formData(bookingForm);
      delete payload.disease;
      payload.serviceIds = [...bookingForm.querySelectorAll('input[name="serviceIds"]:checked')].map((input) => input.value);
      if (!payload.serviceIds.length) throw new Error('Vui lòng chọn ít nhất một dịch vụ khám.');
      const { appointment, invoiceUrl } = await api.post('/api/appointments', payload);
      showToast(`Đã nhận yêu cầu ${appointment.public_code}`, 'Đang mở hóa đơn đặt lịch của bạn.');
      if (invoiceUrl) {
        redirecting = true;
        setTimeout(() => { window.location.assign(invoiceUrl); }, 900);
      } else {
        bookingForm.reset();
        setDateMinimum();
      }
    } catch (error) {
      showToast('Chưa gửi được yêu cầu', error.message);
    } finally {
      if (!redirecting) submit.disabled = false;
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
    if (!appointments.length) return renderEmpty(body, 6, 'Bạn chưa có lịch hẹn. Hãy đặt lịch khám đầu tiên của mình.');
    const fragment = document.createDocumentFragment();
    appointments.forEach((item) => {
      const row = document.createElement('tr');
      appendCell(row, item.public_code);
      appendStackCell(row, item.specialty, item.doctor);
      appendStackCell(row, formatDate(item.appointment_date), item.appointment_time);
      appendStackCell(row, item.location_name, [item.location_city, item.location_address].filter(Boolean).join(' · '));
      addStatusCell(row, item.status);
      row.appendChild(paymentCell(item, false));
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
  if (!appointments.length) return renderEmpty(body, 8, 'Chưa có lịch hẹn mới. Các yêu cầu đặt lịch sẽ hiển thị tại đây.');
  const fragment = document.createDocumentFragment();
  appointments.forEach((item) => {
    const row = document.createElement('tr');
    appendStackCell(row, item.public_code, item.full_name);
    appendStackCell(row, item.specialty, item.doctor);
    appendStackCell(row, formatDate(item.appointment_date), item.appointment_time);
    appendStackCell(row, item.location_name, [item.location_city, item.location_address].filter(Boolean).join(' · '));
    appendCell(row, item.phone);
    row.appendChild(paymentCell(item, true));
    addStatusCell(row, item.status);
    const action = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'cell-actions';
    if (item.status === 'pending') {
      actions.append(
        makeActionButton('Xác nhận', 'ghost-button admin-confirm', { id: item.id }, async () => {
          try {
            await api.patch(`/api/admin/appointments/${encodeURIComponent(item.id)}`, { status: 'confirmed' });
            showToast('Đã xác nhận lịch hẹn', item.public_code);
            loadAdminPage();
          } catch (error) { showToast('Chưa cập nhật được lịch hẹn', error.message); }
        }),
        makeActionButton('Hủy', 'ghost-button', { id: item.id }, async () => {
          try {
            await api.patch(`/api/admin/appointments/${encodeURIComponent(item.id)}`, { status: 'cancelled' });
            showToast('Đã hủy lịch hẹn', item.public_code);
            loadAdminPage();
          } catch (error) { showToast('Chưa hủy được lịch hẹn', error.message); }
        }),
      );
    }
    if (item.status !== 'cancelled') {
      actions.appendChild(makeActionButton(
        item.prescription ? 'Sửa đơn thuốc' : 'Kê đơn thuốc',
        'ghost-button',
        { id: item.id },
        () => openPrescriptionModal(item),
      ));
    }
    action.appendChild(actions.childNodes.length ? actions : document.createTextNode('—'));
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

let rxTemplates = [];
const rxModal = document.querySelector('#prescription-modal');
const rxForm = document.querySelector('#prescription-form');
const rxContainer = document.querySelector('#rx-items-container');
const rxTotalEl = document.querySelector('#rx-total-preview');
const rxTemplateSelect = document.querySelector('#rx-template-select');

function closeRxModal() {
  rxModal?.classList.remove('is-open');
  rxModal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}
document.querySelectorAll('[data-close-rx]').forEach((el) => el.addEventListener('click', closeRxModal));

function updateRxTotal() {
  if (!rxContainer || !rxTotalEl) return;
  let total = 0;
  rxContainer.querySelectorAll('.rx-row').forEach((row) => {
    const qty = Number(row.querySelector('[name="rx_qty"]').value) || 0;
    const price = Number(row.querySelector('[name="rx_price"]').value) || 0;
    total += qty * price;
  });
  rxTotalEl.textContent = formatMoney(total);
}

function addRxRow(item = {}) {
  if (!rxContainer) return;
  const row = document.createElement('div');
  row.className = 'rx-row';
  row.style.cssText = 'display:grid;grid-template-columns:1.6fr 1.6fr .6fr .7fr .9fr auto;gap:6px;align-items:center;';
  row.innerHTML = `
    <input name="rx_name" placeholder="Tên thuốc" required>
    <input name="rx_dosage" placeholder="Liều dùng" required>
    <input name="rx_qty" type="number" min="1" max="500" placeholder="SL" required>
    <input name="rx_unit" placeholder="Đơn vị" required>
    <input name="rx_price" type="number" min="0" step="500" placeholder="Đơn giá" required>
    <button type="button" class="ghost-button" aria-label="Xóa thuốc">×</button>
  `;
  row.querySelector('[name="rx_name"]').value = item.name || '';
  row.querySelector('[name="rx_dosage"]').value = item.dosage || '';
  row.querySelector('[name="rx_qty"]').value = item.quantity ?? 10;
  row.querySelector('[name="rx_unit"]').value = item.unit || 'Viên';
  row.querySelector('[name="rx_price"]').value = item.unitPrice ?? 0;
  row.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', updateRxTotal));
  row.querySelector('button').addEventListener('click', () => { row.remove(); updateRxTotal(); });
  rxContainer.appendChild(row);
  updateRxTotal();
}

document.querySelector('#rx-add-row')?.addEventListener('click', () => addRxRow());

rxTemplateSelect?.addEventListener('change', () => {
  const tpl = rxTemplates.find((t) => t.disease === rxTemplateSelect.value);
  if (!tpl || !rxForm) return;
  rxForm.querySelector('[name="diagnosis"]').value = tpl.diagnosis || tpl.disease;
  rxForm.querySelector('[name="advice"]').value = tpl.advice || '';
  rxContainer.replaceChildren();
  (tpl.items || []).forEach((item) => addRxRow(item));
  updateRxTotal();
});

async function openPrescriptionModal(appointment) {
  if (!rxModal || !rxForm) return;
  if (!rxTemplates.length) {
    try {
      const data = await api.get('/api/admin/prescription-templates');
      rxTemplates = data.templates || [];
      rxTemplateSelect.replaceChildren(new Option('— Tự nhập thủ công hoặc chọn mẫu bệnh lý —', ''));
      rxTemplates.forEach((t) => {
        const sum = (t.items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0);
        rxTemplateSelect.add(new Option(`${t.disease} (${t.specialty}) · ~${formatMoney(sum)}`, t.disease));
      });
    } catch { /* bỏ qua nếu chưa tải được mẫu */ }
  }
  rxForm.querySelector('[name="appointmentId"]').value = appointment.id;
  document.querySelector('#rx-modal-title').textContent = `Kê đơn: ${appointment.full_name} (${appointment.public_code})`;
  rxTemplateSelect.value = '';
  const existing = appointment.prescription;
  rxForm.querySelector('[name="diagnosis"]').value = existing?.diagnosis || '';
  rxForm.querySelector('[name="advice"]').value = existing?.advice || '';
  rxContainer.replaceChildren();
  if (existing?.items?.length) {
    existing.items.forEach((item) => addRxRow(item));
  } else {
    addRxRow();
  }
  updateRxTotal();
  rxModal.classList.add('is-open');
  rxModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

rxForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = rxForm.querySelector('[name="appointmentId"]').value;
  const items = [...rxContainer.querySelectorAll('.rx-row')].map((row) => ({
    name: row.querySelector('[name="rx_name"]').value.trim(),
    dosage: row.querySelector('[name="rx_dosage"]').value.trim(),
    quantity: Number(row.querySelector('[name="rx_qty"]').value),
    unit: row.querySelector('[name="rx_unit"]').value.trim(),
    unitPrice: Number(row.querySelector('[name="rx_price"]').value),
  }));
  const submit = rxForm.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await api.patch(`/api/admin/appointments/${encodeURIComponent(id)}/prescription`, {
      diagnosis: rxForm.querySelector('[name="diagnosis"]').value.trim(),
      advice: rxForm.querySelector('[name="advice"]').value.trim(),
      items,
    });
    closeRxModal();
    showToast('Đã lưu đơn thuốc', 'Bệnh nhân có thể xem và in ngay trên hóa đơn.');
    loadAdminPage();
  } catch (error) {
    showToast('Chưa lưu được đơn thuốc', error.message);
  } finally {
    submit.disabled = false;
  }
});

if (document.querySelector('#patient-appointment-table')) loadPatientPage();
if (document.querySelector('#appointment-table')) loadAdminPage();

document.querySelector('#patient-logout')?.addEventListener('click', async () => {
  try { await api.post('/api/auth/logout', {}); } catch (error) { showToast('Không đăng xuất được', error.message); return; }
  window.location.assign('/login');
});
document.querySelector('#admin-logout')?.addEventListener('click', async () => {
  try { await api.post('/api/auth/logout', {}); } catch (error) { showToast('Không đăng xuất được', error.message); return; }
  window.location.assign('/admin-login');
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

document.querySelectorAll('.disease-card[data-category]').forEach((card) => {
  const link = card.querySelector('a[href="/booking"]');
  const title = card.querySelector('h3')?.textContent?.trim();
  if (!link || !title) return;
  const query = new URLSearchParams({ specialty: card.dataset.category, disease: title });
  link.href = `/booking?${query.toString()}`;
});

const hasPortalLoader = Boolean(document.querySelector('#patient-appointment-table, #appointment-table'));
if (!hasPortalLoader && document.querySelector('[data-user-name]')) {
  api.get('/api/auth/me').then(({ user }) => {
    if (user) document.querySelectorAll('[data-user-name]').forEach((node) => { node.textContent = user.fullName; });
  }).catch(() => {});
}