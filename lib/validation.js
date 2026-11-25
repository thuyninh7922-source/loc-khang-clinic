const allowedSpecialties = new Set([
  'Nội tổng quát',
  'Tim mạch',
  'Nhi khoa',
  'Sản phụ khoa',
  'Cơ xương khớp',
  'Da liễu',
]);
const allowedDoctors = new Set([
  'BS. Nguyễn Minh An',
  'BS. Trần Hoài Thương',
  'PGS.TS. Lê Quang Vũ',
  'BS. Phạm Hà Phương',
  'BS. Lê Minh Khoa',
  'BS. Nguyễn Bảo Ngọc',
]);
const allowedTimes = new Set([
  '07:30 — 09:00',
  '09:00 — 11:00',
  '13:30 — 15:30',
  '15:30 — 20:00',
]);

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function normalizePhone(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}
function isValidPhone(value) {
  return typeof value === 'string' && /^[0-9+ ()-]{9,30}$/.test(value) && /\d{8,}/.test(value.replace(/\D/g, ''));
}
function vietnamToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= vietnamToday();
}
function validateAppointment(data) {
  if (!data.fullName || data.fullName.length < 2) return 'Vui lòng nhập họ và tên hợp lệ.';
  if (!isValidPhone(data.phone)) return 'Vui lòng nhập số điện thoại hợp lệ.';
  if (!allowedSpecialties.has(data.specialty)) return 'Vui lòng chọn chuyên khoa trong danh sách.';
  if (!allowedDoctors.has(data.doctor)) return 'Vui lòng chọn bác sĩ trong danh sách.';
  if (!isValidDate(data.date)) return 'Ngày khám không hợp lệ hoặc đã ở trong quá khứ.';
  if (!allowedTimes.has(data.time)) return 'Vui lòng chọn khung giờ trong danh sách.';
  if (data.note && data.note.length > 2000) return 'Ghi chú không được vượt quá 2.000 ký tự.';
  return null;
}
function validateContactRequest(data) {
  if (!data.fullName || data.fullName.length < 2) return 'Vui lòng nhập họ và tên hợp lệ.';
  if (!isValidPhone(data.phone)) return 'Vui lòng nhập số điện thoại hợp lệ.';
  if (!data.message || data.message.length < 3) return 'Vui lòng nhập nội dung cần tư vấn.';
  return null;
}

module.exports = {
  allowedSpecialties,
  allowedDoctors,
  allowedTimes,
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  isValidPhone,
  isValidDate,
  validateAppointment,
  validateContactRequest,
};
