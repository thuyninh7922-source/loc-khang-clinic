const doctorCatalog = require('../data/doctors.json');

const allowedTiers = new Set(['standard', 'premium']);
const doctorByName = new Map(doctorCatalog.doctors.map((item) => [item.name, item]));
const allowedSpecialties = new Set(doctorCatalog.doctors.map((item) => item.specialty));
const allowedDoctors = new Set(doctorByName.keys());
const allowedTimes = new Set([
  '07:30 — 09:00',
  '09:00 — 11:00',
  '13:30 — 15:30',
  '15:30 — 20:00',
]);

function findDoctor(name) {
  return typeof name === 'string' ? doctorByName.get(name) || null : null;
}
function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function normalizePhone(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}
function canonicalPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 10 && digits.length <= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
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
  const tier = data.serviceTier || 'standard';
  if (!allowedTiers.has(tier)) return 'Loại dịch vụ không hợp lệ (chọn Thường hoặc Cao cấp).';
  if (!allowedSpecialties.has(data.specialty)) return 'Vui lòng chọn chuyên khoa trong danh sách.';
  const doctor = findDoctor(data.doctor);
  if (!doctor) return 'Vui lòng chọn bác sĩ trong danh sách.';
  if (doctor.specialty !== data.specialty) return 'Bác sĩ không thuộc chuyên khoa bạn đã chọn.';
  if (doctor.tier !== tier) {
    return tier === 'premium'
      ? 'Dịch vụ cao cấp chỉ áp dụng khi chọn Giáo sư, Phó Giáo sư hoặc Tiến sĩ.'
      : 'Bác sĩ bạn chọn thuộc Dịch vụ cao cấp (GS/PGS.TS/TS.BS). Vui lòng chuyển sang gói Cao cấp.';
  }
  if (!isValidDate(data.date)) return 'Ngày khám không hợp lệ hoặc đã ở trong quá khứ.';
  if (!allowedTimes.has(data.time)) return 'Vui lòng chọn khung giờ trong danh sách.';
  if (data.note && data.note.length > 2000) return 'Ghi chú không được vượt quá 2.000 ký tự.';
  return null;
}
function validateContactRequest(data) {
  if (!data.fullName || data.fullName.length < 2) return 'Vui lòng nhập họ và tên hợp lệ.';
  if (!isValidPhone(data.phone)) return 'Vui lòng nhập số điện thoại hợp lệ.';
  if (!data.message || data.message.length < 3) return 'Vui lòng nhập nội dung cần tư vấn.';
  if (data.message.length > 1000) return 'Nội dung tư vấn không được vượt quá 1.000 ký tự.';
  return null;
}

module.exports = {
  allowedTiers,
  allowedSpecialties,
  allowedDoctors,
  allowedTimes,
  findDoctor,
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  canonicalPhone,
  isValidPhone,
  isValidDate,
  validateAppointment,
  validateContactRequest,
};
