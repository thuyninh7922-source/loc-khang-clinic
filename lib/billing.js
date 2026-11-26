'use strict';
const crypto = require('crypto');
const catalog = require('../data/services.json');

const services = catalog.services.map((item) => ({
  id: item.id,
  name: item.name,
  price: item.price,
  specialty: item.specialty || '',
  description: item.description || '',
}));
const byId = new Map(services.map((item) => [item.id, item]));
const offer = catalog.firstVisit || {};
const gift = offer.giftServiceId ? byId.get(offer.giftServiceId) : null;

function defaultServiceFor(specialty) {
  const match = services.find((item) => item.specialty && item.specialty === specialty);
  return match ? match.id : null;
}

function publicCatalog() {
  return {
    services,
    firstVisit: {
      percent: Number(offer.percent) || 0,
      maxDiscount: Number(offer.maxDiscount) || 0,
      gift: gift ? { id: gift.id, name: gift.name, price: gift.price } : null,
    },
  };
}

// Tính tiền hoàn toàn ở server, không tin giá do trình duyệt gửi lên.
function computeQuote(serviceIds, isFirstVisit) {
  const ids = [...new Set(Array.isArray(serviceIds) ? serviceIds : [])];
  if (!ids.length) return { error: 'Vui lòng chọn ít nhất một dịch vụ khám.' };
  if (ids.length > 12) return { error: 'Bạn chọn quá nhiều dịch vụ trong một lịch hẹn.' };
  const items = [];
  for (const id of ids) {
    const service = typeof id === 'string' ? byId.get(id) : null;
    if (!service) return { error: 'Có dịch vụ không hợp lệ. Hãy tải lại trang rồi chọn lại.' };
    items.push({ id: service.id, name: service.name, price: service.price, gift: false });
  }
  const discounts = [];
  let giftValue = 0;
  if (isFirstVisit && gift) {
    const selected = items.find((item) => item.id === gift.id);
    if (selected) selected.gift = true;
    else items.push({ id: gift.id, name: gift.name, price: gift.price, gift: true });
    giftValue = gift.price;
    discounts.push({ label: `Tặng ${gift.name} (khám lần đầu)`, amount: giftValue });
  }
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  if (isFirstVisit && offer.percent > 0) {
    const base = subtotal - giftValue;
    const raw = Math.round((base * offer.percent) / 100 / 1000) * 1000;
    const amount = Math.max(0, Math.min(raw, offer.maxDiscount || raw));
    if (amount > 0) discounts.push({ label: `Giảm ${offer.percent}% dịch vụ khám lần đầu`, amount });
  }
  const discount = discounts.reduce((sum, item) => sum + item.amount, 0);
  const total = Math.max(0, subtotal - discount);
  return { items, discounts, subtotal, discount, total };
}

function qrUrl(code, total) {
  const bank = (process.env.BANK_ID || '').trim();
  const account = (process.env.BANK_ACCOUNT || '').trim();
  const holder = (process.env.BANK_ACCOUNT_NAME || '').trim();
  if (!/^[A-Za-z0-9]{2,20}$/.test(bank) || !/^[0-9]{5,20}$/.test(account)) return null;
  const params = new URLSearchParams({ amount: String(total), addInfo: code });
  if (holder) params.set('accountName', holder);
  return `https://img.vietqr.io/image/${bank}-${account}-compact2.png?${params.toString()}`;
}

function paymentInfo(code, total) {
  return {
    bank: (process.env.BANK_ID || '').trim() || null,
    account: (process.env.BANK_ACCOUNT || '').trim() || null,
    holder: (process.env.BANK_ACCOUNT_NAME || '').trim() || null,
    transferNote: code,
    qrUrl: qrUrl(code, total),
  };
}

function newInvoiceToken() {
  return crypto.randomBytes(18).toString('hex');
}
function tokensMatch(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string' || !expected || expected.length !== supplied.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

module.exports = { defaultServiceFor, publicCatalog, computeQuote, paymentInfo, newInvoiceToken, tokensMatch };

