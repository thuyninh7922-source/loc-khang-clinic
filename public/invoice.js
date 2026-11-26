(function () {
  const root = document.querySelector('#invoice');
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';
  const token = params.get('t') || '';

  document.querySelector('#invoice-print')?.addEventListener('click', () => window.print());

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function money(value) {
    return value === null || value === undefined ? '—' : `${new Intl.NumberFormat('vi-VN').format(Number(value))} đ`;
  }
  function dateText(value) {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('vi-VN').format(date);
  }
  function dateTimeText(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }
  function showMessage(message) {
    root.replaceChildren(el('div', 'empty-state', message));
  }
  function block(title, lines) {
    const wrap = el('div');
    wrap.appendChild(el('h3', '', title));
    lines.forEach(([text, muted]) => wrap.appendChild(el('p', muted ? 'muted' : '', text || '—')));
    return wrap;
  }
  function totalRow(label, value, className) {
    const row = el('div', className);
    row.append(el('span', '', label), el('span', '', value));
    return row;
  }

  function paymentBlock(invoice) {
    const paid = invoice.payment_status === 'paid';
    const free = Number(invoice.total_vnd) === 0;
    const wrap = el('section', 'invoice-pay');
    const info = el('div');
    const statusText = free ? 'Không phát sinh chi phí' : paid ? 'Đã thanh toán' : 'Chưa thanh toán';
    info.appendChild(el('h3', '', `Thanh toán: ${statusText}`));
    const methodText = invoice.payment_method === 'transfer' ? 'Chuyển khoản' : invoice.payment_method === 'cash' ? 'Thanh toán tại quầy' : '—';
    info.appendChild(el('p', '', `Hình thức: ${methodText}`));
    if (paid && invoice.paid_at) info.appendChild(el('p', '', `Đã ghi nhận lúc ${dateTimeText(invoice.paid_at)}`));

    const payment = invoice.payment;
    if (invoice.payment_method === 'cash' && !paid && !free) {
      info.appendChild(el('p', '', 'Vui lòng thanh toán tại quầy khi đến khám và đưa mã lịch hẹn cho nhân viên.'));
    }
    if (payment) {
      const hasQr = typeof payment.qrUrl === 'string' && payment.qrUrl.startsWith('https://img.vietqr.io/');
      if (hasQr) {
        const img = document.createElement('img');
        img.alt = 'Mã QR chuyển khoản';
        img.width = 168;
        img.src = payment.qrUrl;
        wrap.appendChild(img);
        info.appendChild(el('p', '', 'Quét mã QR bằng ứng dụng ngân hàng, hoặc chuyển khoản theo thông tin dưới đây.'));
      } else {
        info.appendChild(el('p', '', 'Phòng khám sẽ liên hệ để hướng dẫn chuyển khoản.'));
      }
      if (payment.bank && payment.account) {
        info.appendChild(el('p', '', `Ngân hàng: ${payment.bank} · Số tài khoản: ${payment.account}`));
        if (payment.holder) info.appendChild(el('p', '', `Chủ tài khoản: ${payment.holder}`));
      }
      const note = el('p');
      note.append('Nội dung chuyển khoản: ', el('strong', '', payment.transferNote));
      info.appendChild(note);
      info.appendChild(el('p', '', 'Phòng khám sẽ xác nhận thanh toán sau khi đối chiếu giao dịch.'));
    }
    if (!wrap.querySelector('img')) wrap.classList.add('no-qr');
    wrap.appendChild(info);
    return wrap;
  }

  function prescriptionBlock(invoice) {
    const rx = invoice.prescription;
    if (!rx || !Array.isArray(rx.items) || !rx.items.length) return null;
    const section = el('section', 'invoice-pay no-qr');
    section.style.marginTop = '22px';
    const wrap = el('div');
    wrap.append(
      el('h3', '', 'ĐƠN THUỐC BÁC SĨ KÊ'),
      el('p', '', `Chẩn đoán: ${rx.diagnosis || '—'}`),
    );
    const table = el('table', 'invoice-table');
    table.style.marginTop = '10px';
    const headRow = document.createElement('tr');
    ['STT', 'Tên thuốc & Liều dùng', 'SL', 'Thành tiền'].forEach((t) => headRow.appendChild(el('th', '', t)));
    const thead = document.createElement('thead');
    thead.appendChild(headRow);
    const tbody = document.createElement('tbody');
    rx.items.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const desc = el('td');
      desc.append(el('strong', '', item.name), document.createElement('br'), el('small', '', item.dosage));
      tr.append(
        el('td', '', String(idx + 1)),
        desc,
        el('td', '', `${item.quantity} ${item.unit || ''}`.trim()),
        el('td', '', money(item.lineTotal)),
      );
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    wrap.appendChild(table);
    const rxTotal = Number(invoice.prescription_total_vnd ?? rx.total) || 0;
    const rxTotals = el('div', 'invoice-totals');
    rxTotals.appendChild(totalRow('Tổng tiền thuốc', money(rxTotal), 'grand'));
    rxTotals.appendChild(totalRow('Tổng cộng (Khám + Thuốc)', money((Number(invoice.total_vnd) || 0) + rxTotal)));
    wrap.appendChild(rxTotals);
    if (rx.advice) wrap.appendChild(el('p', '', `Lời dặn bác sĩ: ${rx.advice}`));
    section.appendChild(wrap);
    return section;
  }

  function render(invoice) {
    document.title = `Hóa đơn ${invoice.public_code} — Lộc Khang Clinic`;
    const head = el('div', 'invoice-head');
    const brand = el('div', 'invoice-brand');
    brand.append(el('strong', '', 'Lộc Khang Clinic'), el('small', '', 'Hotline 1900 6868 · hello@lockhang.clinic'));
    const title = el('div', 'invoice-title');
    title.append(
      el('h1', '', 'HÓA ĐƠN ĐẶT LỊCH KHÁM'),
      el('p', 'invoice-code', invoice.public_code),
      el('p', '', `Lập lúc ${dateTimeText(invoice.created_at)}`),
    );
    head.append(brand, title);

    const tierText = invoice.service_tier === 'premium'
      ? 'Hạng: Dịch vụ cao cấp (GS / PGS.TS / TS.BS)'
      : 'Hạng: Dịch vụ thường (Bình dân)';

    const grid = el('div', 'invoice-grid');
    grid.append(
      block('Người bệnh', [[invoice.full_name], [invoice.phone, true]]),
      block('Lịch khám', [
        [`${dateText(invoice.appointment_date)} · ${invoice.appointment_time || '—'}`],
        [invoice.specialty, true],
        [invoice.doctor, true],
        [tierText, true],
      ]),
      block('Cơ sở khám', [
        [invoice.location_name],
        [[invoice.location_city, invoice.location_address].filter(Boolean).join(' · '), true],
      ]),
    );

    const parts = [head, grid];
    const detail = invoice.billing;
    if (!detail || !Array.isArray(detail.items) || !detail.items.length) {
      parts.push(el('div', 'empty-state', 'Lịch hẹn này được tạo trước khi có tính năng thanh toán nên chưa có chi tiết dịch vụ.'));
    } else {
      const table = el('table', 'invoice-table');
      const headRow = document.createElement('tr');
      ['STT', 'Dịch vụ', 'Đơn giá'].forEach((text) => headRow.appendChild(el('th', '', text)));
      const thead = document.createElement('thead');
      thead.appendChild(headRow);
      const tbody = document.createElement('tbody');
      detail.items.forEach((item, index) => {
        const row = document.createElement('tr');
        const name = el('td', '', item.name);
        if (item.gift) name.appendChild(el('span', 'gift-tag', 'Quà tặng lần đầu'));
        row.append(el('td', '', String(index + 1)), name, el('td', '', money(item.price)));
        tbody.appendChild(row);
      });
      table.append(thead, tbody);
      const totals = el('div', 'invoice-totals');
      totals.appendChild(totalRow('Tạm tính', money(invoice.subtotal_vnd)));
      (detail.discounts || []).forEach((discount) => totals.appendChild(totalRow(discount.label, `− ${money(discount.amount)}`, 'discount')));
      totals.appendChild(totalRow('Tổng thanh toán', money(invoice.total_vnd), 'grand'));
      parts.push(table, totals, paymentBlock(invoice));
    }
    const rxNode = prescriptionBlock(invoice);
    if (rxNode) parts.push(rxNode);
    parts.push(el('p', 'invoice-note', 'Chứng từ này xác nhận yêu cầu đặt lịch và số tiền dự kiến, không thay thế hóa đơn giá trị gia tăng. Ưu đãi khám lần đầu được đối chiếu khi bạn đến khám. Giá dịch vụ và địa điểm hiển thị là dữ liệu minh họa, vui lòng xác nhận với phòng khám.'));
    root.replaceChildren(...parts);
  }

  if (!code) {
    showMessage('Thiếu mã lịch hẹn. Hãy mở hóa đơn từ liên kết sau khi đặt lịch hoặc từ hồ sơ của bạn.');
    return;
  }
  const query = token ? `?t=${encodeURIComponent(token)}` : '';
  fetch(`/api/invoices/${encodeURIComponent(code)}${query}`, { credentials: 'same-origin' })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Không tải được hóa đơn.');
      return data.invoice;
    })
    .then(render)
    .catch((error) => showMessage(`${error.message} Nếu là lịch của bạn, hãy đăng nhập vào hồ sơ bệnh nhân rồi mở lại hóa đơn.`));
})();
