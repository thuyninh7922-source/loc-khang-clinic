const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  isValidPhone,
  isValidDate,
  validateAppointment,
  validateContactRequest,
} = require('../lib/validation');

test('email is normalized and validated', () => {
  assert.equal(normalizeEmail('  PATIENT@Example.com  '), 'patient@example.com');
  assert.equal(isValidEmail('patient@example.com'), true);
  assert.equal(isValidEmail('missing-at.example.com'), false);
});

test('phone input is normalized and rejects malformed values', () => {
  assert.equal(normalizePhone('090  123 4567'), '090 123 4567');
  assert.equal(isValidPhone('+84 90 123 4567'), true);
  assert.equal(isValidPhone('not-a-phone'), false);
});

test('appointment validation requires known choices and a non-past date', () => {
  const valid = {
    fullName: 'Nguyễn Văn An',
    phone: '090 123 4567',
    specialty: 'Nội tổng quát',
    doctor: 'BS. Nguyễn Minh An',
    date: '2099-01-01',
    time: '07:30 — 09:00',
    note: '',
  };
  assert.equal(validateAppointment(valid), null);
  assert.match(validateAppointment({ ...valid, specialty: 'Tự nhập' }), /chuyên khoa/);
  assert.match(validateAppointment({ ...valid, date: '2000-01-01' }), /quá khứ/);
  assert.equal(isValidDate('2099-02-30'), false);
});

test('contact requests require a real name, phone, and message', () => {
  assert.equal(validateContactRequest({ fullName: 'Nguyễn An', phone: '0901234567', message: 'Tư vấn giúp tôi' }), null);
  assert.match(validateContactRequest({ fullName: '', phone: '0901234567', message: 'Cần tư vấn' }), /họ và tên/);
});
