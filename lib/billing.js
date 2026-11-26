'use strict';
const crypto = require('crypto');
const catalog = require('../data/services.json');

const services = catalog.services.map((item) => {
  const priceStandard = Number(item.priceStandard ?? item.price) || 0;
  const pricePremium = Number(item.pricePremium ?? priceStandard) || priceStandard;
  return {
    id: item.id,
    name: item.name,
    price: priceStandard,
    priceStandard,
    pricePremium,
    specialty: item.specialty || '',
    onlyTier: item.onlyTier || '',
    description: item.description || '',
  };
});
const byId = new Map(services.map((item) => [item.id, item]));
const offer = catalog.firstVisit || {};
const gift = offer.giftServiceId ? byId.get(offer.giftServiceId) : null;

function priceForTier(service, tier) {
  return tier === 'premium' ? service.pricePremium : service.priceStandard;
}

function tierLabel(tier) {
  return tier === 'premium'
    ? 'Dịch vụ cao cấp (GS / PGS.TS / TS.BS)'
    : 'Dịch vụ thường (Bình dân)';
}

function defaultServiceFor(specialty) {
  const match = services.find((item) => item.specialty && item.specialty === specialty);
  return match ? match.id : null;
}

function publicCatalog() {
  return {
    services,
    tiers: {
      standard: {
        id: 'standard',
        label: tierLabel('standard'),
        description: 'Khám cùng Bác sĩ chuyên khoa, chi phí bình dân.',
      },
      premium: {
        id: 'premium',
        label: tierLabel('premium'),
        description: 'Trực tiếp Giáo sư, Phó Giáo sư, Tiến sĩ thăm khám chuyên sâu.',
      },
    },
    firstVisit: {
      percent: Number(offer.percent) || 0,
      maxDiscount: Number(offer.maxDiscount) || 0,
      gift: gift
        ? {
            id: gift.id,
            name: gift.name,
            price: gift.priceStandard,
            priceStandard: gift.priceStandard,
            pricePremium: gift.pricePremium,
          }
        : null,
    },
  };
}

// Tính tiền hoàn toàn ở server, không tin giá do trình duyệt gửi lên.
function computeQuote(serviceIds, isFirstVisit, serviceTier = 'standard') {
  const tier = serviceTier === 'premium' ? 'premium' : 'standard';
  const ids = [...new Set(Array.isArray(serviceIds) ? serviceIds : [])];
  if (!ids.length) return { error: 'Vui lòng chọn ít nhất một dịch vụ khám.' };
  if (ids.length > 12) return { error: 'Bạn chọn quá nhiều dịch vụ trong một lịch hẹn.' };
  const items = [];
  for (const id of ids) {
    const service = typeof id === 'string' ? byId.get(id) : null;
    if (!service) return { error: 'Có dịch vụ không hợp lệ. Hãy tải lại trang rồi chọn lại.' };
    if (service.onlyTier && service.onlyTier !== tier) {
      return { error: `Dịch vụ "${service.name}" chỉ áp dụng cho gói Cao cấp.` };
    }
    items.push({
      id: service.id,
      name: tier === 'premium' && !service.onlyTier ? `${service.name} (Cao cấp)` : service.name,
      price: priceForTier(service, tier),
      gift: false,
    });
  }
  const discounts = [];
  let giftValue = 0;
  if (isFirstVisit && gift) {
    const giftPrice = priceForTier(gift, tier);
    const selected = items.find((item) => item.id === gift.id);
    if (selected) selected.gift = true;
    else items.push({ id: gift.id, name: gift.name, price: giftPrice, gift: true });
    giftValue = giftPrice;
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
  return { tier, tierLabel: tierLabel(tier), items, discounts, subtotal, discount, total };
}

function qrUrl(code, total) {
  const bank = (process.env.BANK_ID || '').trim();
  const account = (process.env.BANK_ACCOUNT || '').trim();
  const holder = (process.env.BANK_ACCOUNT_NAME || '').trim();
  if (!/^[A-Za-z0-9]{2,20}$/.test(bank) \vert{}\vert{} !/^[0-9]{5,20}$/.test(account)) return null;
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
  if (typeof expected !== 'string' || typeof supplied !== 'string' || !expected) return false;
  const expectedBuf = Buffer.from(expected, 'utf8');
  const suppliedBuf = Buffer.from(supplied, 'utf8');
  if (expectedBuf.length !== suppliedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, suppliedBuf);
}

module.exports = {
  tierLabel,
  defaultServiceFor,
  publicCatalog,
  computeQuote,
  paymentInfo,
  newInvoiceToken,
  tokensMatch,
};
