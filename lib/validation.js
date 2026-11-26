const doctorsBySpecialty = new Map([
  ['Nội tổng quát', new Set(['BS. Nguyễn Minh An', 'BS. Võ Thanh Hà'])],
  ['Tim mạch', new Set(['PGS.TS. Lê Quang Vũ', 'TS.BS. Đặng Quốc Bảo'])],
  ['Nhi khoa', new Set(['BS. Trần Hoài Thương', 'BS. Huỳnh Mai Anh'])],
  ['Sản phụ khoa', new Set(['BS. Nguyễn Bảo Ngọc', 'BS. Ngô Thu Trang'])],
  ['Cơ xương khớp', new Set(['BS. Lê Minh Khoa'])],
  ['Da liễu', new Set(['BS. Phạm Hà Phương'])],
  ['Tai mũi họng', new Set(['BS. Bùi Anh Tuấn'])],
  ['Mắt', new Set(['BS. Lý Ngọc Diệp'])],
  ['Tiêu hóa', new Set(['PGS.TS. Hoàng Gia Khánh'])],
  ['Thần kinh', new Set(['BS. Đoàn Thế Hiển'])],
  ['Nội tiết', new Set(['TS.BS. Mai Thúy Vy'])],
  ['Răng hàm mặt', new Set(['BS. Phan Đức Long'])],
  ['Hô hấp', new Set(['BS. Trịnh Kim Oanh'])],
  ['Thận – tiết niệu', new Set(['BS. Cao Văn Đức'])],
]);

const allowedSpecialties = new Set(doctorsBySpecialty.keys());
const allowedDoctors = new Set([...doctorsBySpecialty.values()].flatMap((set) => [...set]));
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
  if (!allowedSpecialties.has(data.specialty)) return 'Vui lòng chọn chuyên khoa trong danh sách.';
  if (!allowedDoctors.has(data.doctor)) return 'Vui lòng chọn bác sĩ trong danh sách.';
  if (!doctorsBySpecialty.get(data.specialty)?.has(data.doctor)) {
    return 'Bác sĩ không thuộc chuyên khoa bạn đã chọn.';
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
  doctorsBySpecialty,
  allowedSpecialties,
  allowedDoctors,
  allowedTimes,
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  canonicalPhone,
  isValidPhone,
  isValidDate,
  validateAppointment,
  validateContactRequest,
};
