const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

menuToggle?.addEventListener('click', () => {
  const open = mainNav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
});

document.querySelectorAll('.main-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Mở menu');
  });
});

const specialtyFeature = document.querySelector('.specialty-feature');
const specialtyTitle = specialtyFeature?.querySelector('h3');
const specialtyDescription = specialtyFeature?.querySelector('p');
const featureIndex = specialtyFeature?.querySelector('.feature-index');
const specialtyDescriptions = {
  'Nội tổng quát': 'Thăm khám tổng thể, tầm soát sớm và quản lý sức khỏe chủ động cho người lớn.',
  'Tim mạch': 'Theo dõi sức khỏe trái tim bằng quy trình tầm soát rõ ràng, nhẹ nhàng và chính xác.',
  'Nhi khoa': 'Đồng hành cùng bé trong những năm đầu với sự kiên nhẫn, thấu hiểu và yêu thương.',
  'Sản phụ khoa': 'Chăm sóc sức khỏe phụ nữ toàn diện, riêng tư và an tâm ở mọi giai đoạn.',
  'Cơ xương khớp': 'Giúp bạn vận động nhẹ nhàng hơn với phác đồ phù hợp và tư vấn sát nhu cầu.',
  'Da liễu': 'Lắng nghe làn da, tìm đúng nguyên nhân và xây dựng thói quen chăm sóc bền vững.',
};

const specialtyRows = [...document.querySelectorAll('.specialty-row')];
specialtyRows.forEach((row, index) => {
  row.addEventListener('click', () => {
    specialtyRows.forEach((item) => item.classList.remove('active'));
    row.classList.add('active');
    const name = row.dataset.specialty;
    if (specialtyTitle) specialtyTitle.textContent = name;
    if (specialtyDescription) specialtyDescription.textContent = specialtyDescriptions[name] || specialtyDescriptions['Nội tổng quát'];
    if (featureIndex) featureIndex.textContent = `${String(index + 1).padStart(2, '0')} / ${String(specialtyRows.length).padStart(2, '0')}`;
    const specialtySelect = document.querySelector('#appointment-form select[name="specialty"]');
    if (specialtySelect) {
      specialtySelect.value = name;
      specialtySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
});

const serviceSearch = document.querySelector('#service-search');
const serviceSpecialty = document.querySelector('#service-specialty-filter');
let serviceCategory = 'all';
const applyServiceFilters = () => {
  const query = (serviceSearch?.value || '').trim().toLowerCase();
  const specialty = serviceSpecialty?.value || 'all';
  document.querySelectorAll('.service-card').forEach((card) => {
    const text = card.textContent.toLowerCase();
    const matchesCategory = serviceCategory === 'all' || card.dataset.category === serviceCategory;
    const matchesSpecialty = specialty === 'all' || card.dataset.specialty === specialty;
    const matchesSearch = !query || text.includes(query);
    card.style.display = matchesCategory && matchesSpecialty && matchesSearch ? '' : 'none';
  });
};

document.querySelectorAll('.filter-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter-button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    serviceCategory = button.dataset.filter;
    applyServiceFilters();
  });
});
serviceSearch?.addEventListener('input', applyServiceFilters);
serviceSpecialty?.addEventListener('change', applyServiceFilters);

const modal = document.querySelector('#service-modal');
const modalTitle = document.querySelector('#modal-title');
const modalContent = document.querySelector('#modal-content');
const closeModal = () => {
  modal?.classList.remove('is-open');
  modal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
};

document.querySelectorAll('.service-detail').forEach((button) => {
  button.addEventListener('click', () => {
    if (modalTitle) modalTitle.textContent = button.dataset.title;
    if (modalContent) modalContent.textContent = button.dataset.content;
    modal?.classList.add('is-open');
    modal?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  });
});
document.querySelectorAll('[data-close-modal]').forEach((element) => element.addEventListener('click', closeModal));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

const toast = document.querySelector('#toast');
let toastTimer;
const showToast = (title = 'Đã nhận yêu cầu', detail = 'Điều phối viên sẽ gọi lại cho bạn sớm.') => {
  if (!toast) return;
  const strong = toast.querySelector('strong');
  const text = toast.querySelector('div span');
  if (strong) strong.textContent = title;
  if (text) text.textContent = detail;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 5500);
};
toast?.querySelector('button')?.addEventListener('click', () => toast.classList.remove('show'));

const api = (() => {
  let csrfToken = '';
  return async (url, body) => {
    if (!csrfToken) {
      const csrf = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
      const csrfData = await csrf.json();
      if (!csrf.ok) throw new Error(csrfData.error || 'Không thể khởi tạo phiên bảo mật.');
      csrfToken = csrfData.csrfToken;
    }
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 403 && /Phiên bảo mật/.test(data.error || '')) csrfToken = '';
      throw new Error(data.error || 'Không thể gửi yêu cầu.');
    }
    return data;
  };
})();

function localDateString() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
const dateInput = document.querySelector('#appointment-form input[name="date"]');
if (dateInput) dateInput.min = localDateString();

document.querySelector('#appointment-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const original = submit.innerHTML;
  submit.disabled = true;
  submit.textContent = 'Đang gửi yêu cầu…';
  let redirecting = false;
  try {
    const body = Object.fromEntries(new FormData(form).entries());
    const { appointment, invoiceUrl } = await api('/api/appointments', body);
    if (invoiceUrl) {
      redirecting = true;
      showToast(`Đã nhận yêu cầu ${appointment.public_code}`, 'Đang mở hóa đơn đặt lịch của bạn.');
      setTimeout(() => { window.location.assign(invoiceUrl); }, 900);
    } else {
      form.reset();
      if (dateInput) dateInput.min = localDateString();
      showToast(`Đã nhận yêu cầu ${appointment.public_code}`, 'Điều phối viên sẽ gọi lại để xác nhận lịch hẹn.');
    }
  } catch (error) {
    showToast('Chưa gửi được yêu cầu', error.message);
  } finally {
    if (!redirecting) {
      submit.disabled = false;
      submit.innerHTML = original;
    }
  }
});

document.querySelector('#contact-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    await api('/api/contact-requests', {
      fullName: values.contactName,
      phone: values.contactPhone,
      message: values.contactMessage,
    });
    form.reset();
    showToast('Đã nhận yêu cầu tư vấn', 'Đội ngũ Lộc Khang sẽ liên hệ với bạn sớm.');
  } catch (error) {
    showToast('Chưa gửi được yêu cầu', error.message);
  } finally {
    submit.disabled = false;
  }
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('in-view');
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.service-card, .profile-card, .article-card, .trust-item').forEach((element) => observer.observe(element));
}
