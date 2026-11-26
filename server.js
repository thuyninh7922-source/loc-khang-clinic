const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { pool, runMigrations, bootstrapAdmin } = require('./db');
const locations = require('./data/locations.json');
const billing = require('./lib/billing');
const {
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  isValidPhone,
  validateAppointment,
  validateContactRequest,
} = require('./lib/validation');

const app = express();
const root = __dirname;
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || (!production ? crypto.randomBytes(32).toString('hex') : '');

if (!sessionSecret || (production && sessionSecret.length < 32)) {
  throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters.');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Create/connect a PostgreSQL database before starting the application.');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: production ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '32kb', type: 'application/json' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

const PgSession = connectPgSimple(session);
app.use(session({
  name: 'lk.sid',
  store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: false, pruneSessionInterval: 15 * 60 }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  },
}));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api', apiLimiter);

const pages = {
  '/': 'index.html',
  '/booking': 'booking.html',
  '/locations': 'locations.html',
  '/diseases': 'diseases.html',
  '/doctors': 'doctors.html',
  '/admin': 'admin.html',
  '/admin-login': 'admin-login.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/patient': 'patient.html',
  '/invoice': 'invoice.html',
};
for (const [route, file] of Object.entries(pages)) {
  app.get(route, (req, res) => res.sendFile(path.join(publicDir, file)));
}
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const fail = (res, status, error) => res.status(status).json({ error });
const currentUser = (req) => req.session?.user || null;
const requireUser = (req, res, next) => currentUser(req) ? next() : fail(res, 401, 'Vui lòng đăng nhập để tiếp tục.');
const requirePatient = (req, res, next) => currentUser(req)?.role === 'patient'
  ? next()
  : fail(res, currentUser(req) ? 403 : 401, 'Khu vực này dành cho tài khoản bệnh nhân.');
const requireAdmin = (req, res, next) => currentUser(req)?.role === 'admin'
  ? next()
  : fail(res, currentUser(req) ? 403 : 401, 'Bạn không có quyền truy cập khu vực quản trị.');

function csrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}
function verifySameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== req.get('host') || parsed.protocol !== `${req.protocol}:`) {
        return fail(res, 403, 'Yêu cầu không cùng nguồn. Hãy tải lại trang rồi thử lại.');
      }
    } catch {
      return fail(res, 403, 'Nguồn yêu cầu không hợp lệ.');
    }
  }
  const supplied = req.get('x-csrf-token');
  if (!supplied || !req.session.csrfToken || supplied !== req.session.csrfToken) {
    return fail(res, 403, 'Phiên bảo mật đã hết hạn. Hãy tải lại trang rồi thử lại.');
  }
  next();
}
function regenerateSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.user = user;
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      resolve(req.session.csrfToken);
    });
  });
}
function safeUser(row) {
  return { id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, role: row.role };
}
function inputString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function requireFields(fields) {
  return fields.every((field) => typeof field === 'string' && field.trim().length > 0);
}

app.get('/healthz', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.status(200).json({ status: 'ok' });
}));
app.get('/api/auth/csrf', (req, res) => res.json({ csrfToken: csrfToken(req) }));
app.get('/api/auth/me', (req, res) => res.json({ user: currentUser(req) }));

app.post('/api/auth/register', authLimiter, verifySameOrigin, asyncRoute(async (req, res) => {
  const fullName = inputString(req.body.fullName, 120);
  const phone = normalizePhone(req.body.phone);
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!fullName || fullName.length < 2 || !isValidPhone(phone) || !isValidEmail(email)) {
    return fail(res, 400, 'Vui lòng kiểm tra họ tên, email và số điện thoại.');
  }
  if (password.length < 10 || password.length > 128) {
    return fail(res, 400, 'Mật khẩu cần có từ 10 đến 128 ký tự.');
  }
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();
  try {
    await pool.query(
      'INSERT INTO clinic_accounts (id, email, full_name, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, email, fullName, phone, passwordHash, 'patient'],
    );
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'Email này đã được đăng ký. Hãy dùng email khác.');
    throw error;
  }
  const user = { id, fullName, email, phone, role: 'patient' };
  const token = await regenerateSession(req, user);
  res.status(201).json({ user, csrfToken: token });
}));

async function login(req, res, role) {
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!isValidEmail(email) || !password || password.length > 128) return fail(res, 401, 'Email hoặc mật khẩu chưa đúng.');
  const result = await pool.query(
    'SELECT id, email, full_name, phone, password_hash, role FROM clinic_accounts WHERE email = $1 LIMIT 1',
    [email],
  );
  const account = result.rows[0];
  const bcrypt = require('bcryptjs');
  const passwordMatches = account ? await bcrypt.compare(password, account.password_hash) : false;
  if (!account || account.role !== role || !passwordMatches) {
    return fail(res, 401, role === 'admin' ? 'Tài khoản quản trị hoặc mật khẩu chưa đúng.' : 'Email hoặc mật khẩu bệnh nhân chưa đúng.');
  }
  const user = safeUser(account);
  const token = await regenerateSession(req, user);
  res.json({ user, csrfToken: token });
}
app.post('/api/auth/login', authLimiter, verifySameOrigin, asyncRoute((req, res) => login(req, res, 'patient')));
app.post('/api/auth/admin/login', authLimiter, verifySameOrigin, asyncRoute((req, res) => login(req, res, 'admin')));
app.post('/api/auth/logout', verifySameOrigin, asyncRoute(async (req, res) => {
  await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
  res.clearCookie('lk.sid', { httpOnly: true, secure: production, sameSite: 'lax', path: '/' });
  res.json({ ok: true });
}));

app.get('/api/locations', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ locations });
});

app.get('/api/services', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(billing.publicCatalog());
});

app.post('/api/appointments', verifySameOrigin, asyncRoute(async (req, res) => {
  const data = {
    fullName: inputString(req.body.fullName, 120),
    phone: normalizePhone(req.body.phone),
    locationId: inputString(req.body.locationId, 64),
    specialty: inputString(req.body.specialty, 80),
    doctor: inputString(req.body.doctor, 120),
    date: inputString(req.body.date, 10),
    time: inputString(req.body.time, 40),
    note: inputString(req.body.note, 2000),
  };
  const validationError = validateAppointment(data);
  if (validationError) return fail(res, 400, validationError);
  const location = locations.find((item) => item.id === data.locationId);
  if (!location) return fail(res, 400, 'Vui lòng chọn một cơ sở trong danh sách.');
  let serviceIds = Array.isArray(req.body.serviceIds)
    ? req.body.serviceIds.filter((value) => typeof value === 'string').map((value) => value.slice(0, 64))
    : [];
  // Form ở trang chủ không có phần chọn dịch vụ: tự chọn dịch vụ khám theo chuyên khoa.
  if (!serviceIds.length) {
    const fallback = billing.defaultServiceFor(data.specialty);
    if (fallback) serviceIds = [fallback];
  }
  const rawMethod = req.body.paymentMethod;
  const paymentMethod = rawMethod === undefined || rawMethod === '' ? 'cash' : rawMethod;
  if (!['cash', 'transfer'].includes(paymentMethod)) return fail(res, 400, 'Hình thức thanh toán không hợp lệ.');
  // Khám lần đầu: số điện thoại chưa từng có lịch hẹn nào chưa bị hủy.
  const previous = await pool.query(
    "SELECT 1 FROM clinic_appointments WHERE phone = $1 AND status <> 'cancelled' LIMIT 1",
    [data.phone],
  );
  const isFirstVisit = previous.rowCount === 0;
  const quote = billing.computeQuote(serviceIds, isFirstVisit);
  if (quote.error) return fail(res, 400, quote.error);
  const invoiceToken = billing.newInvoiceToken();
  const patient = currentUser(req)?.role === 'patient' ? currentUser(req) : null;
  const id = crypto.randomUUID();
  const publicCode = `LK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const result = await pool.query(
    `INSERT INTO clinic_appointments
      (id, public_code, patient_id, full_name, phone, specialty, doctor, appointment_date, appointment_time, note,
       location_id, location_name, location_city, location_address,
       billing, subtotal_vnd, discount_vnd, total_vnd, is_first_visit, payment_method, payment_status, invoice_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       $15::jsonb, $16, $17, $18, $19, $20, 'unpaid', $21)
     RETURNING id, public_code, full_name, phone, specialty, doctor, appointment_date, appointment_time, note,
       location_id, location_name, location_city, location_address, status, created_at,
       subtotal_vnd, discount_vnd, total_vnd, is_first_visit, payment_method, payment_status`,
    [id, publicCode, patient?.id || null, data.fullName, data.phone, data.specialty, data.doctor, data.date, data.time,
      data.note || null, location.id, location.name, location.city, location.address,
      JSON.stringify({ items: quote.items, discounts: quote.discounts }), quote.subtotal, quote.discount, quote.total,
      isFirstVisit, paymentMethod, invoiceToken],
  );
  const appointment = result.rows[0];
  res.status(201).json({
    appointment,
    invoiceUrl: `/invoice?code=${encodeURIComponent(appointment.public_code)}&t=${invoiceToken}`,
  });
}));

app.get('/api/appointments', requireUser, asyncRoute(async (req, res) => {
  const user = currentUser(req);
  if (user.role === 'admin') {
    const [appointments, totals] = await Promise.all([
      pool.query(
        `SELECT id, public_code, patient_id, full_name, phone, specialty, doctor, appointment_date, appointment_time, note,
                location_id, location_name, location_city, location_address, status, created_at,
                total_vnd, is_first_visit, payment_method, payment_status
         FROM clinic_appointments ORDER BY created_at DESC LIMIT 200`,
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
         FROM clinic_appointments`,
      ),
    ]);
    return res.json({ appointments: appointments.rows, stats: totals.rows[0] });
  }
  const result = await pool.query(
    `SELECT id, public_code, full_name, specialty, doctor, appointment_date, appointment_time,
            location_id, location_name, location_city, location_address, status, created_at,
            total_vnd, is_first_visit, payment_method, payment_status
     FROM clinic_appointments WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [user.id],
  );
  res.json({ appointments: result.rows });
}));

app.get('/api/invoices/:code', asyncRoute(async (req, res) => {
  const code = inputString(req.params.code, 64);
  const result = await pool.query(
    `SELECT public_code, patient_id, full_name, phone, specialty, doctor, appointment_date, appointment_time,
            location_name, location_city, location_address, status, created_at,
            billing, subtotal_vnd, discount_vnd, total_vnd, is_first_visit, payment_method, payment_status, paid_at, invoice_token
     FROM clinic_appointments WHERE public_code = $1 LIMIT 1`,
    [code],
  );
  const row = result.rows[0];
  const user = currentUser(req);
  const allowed = row && (
    user?.role === 'admin'
    || (user?.role === 'patient' && row.patient_id && String(row.patient_id) === String(user.id))
    || billing.tokensMatch(row.invoice_token, inputString(req.query.t, 128))
  );
  res.set('Cache-Control', 'no-store');
  if (!allowed) return fail(res, 404, 'Không tìm thấy hóa đơn.');
  const { invoice_token: _token, patient_id: _patientId, ...invoice } = row;
  invoice.payment = row.payment_method === 'transfer' && row.payment_status !== 'paid' && row.total_vnd > 0
    ? billing.paymentInfo(row.public_code, row.total_vnd)
    : null;
  res.json({ invoice });
}));

app.patch('/api/admin/appointments/:id/payment', requireAdmin, verifySameOrigin, asyncRoute(async (req, res) => {
  const paymentStatus = req.body.paymentStatus;
  if (!['paid', 'unpaid'].includes(paymentStatus)) return fail(res, 400, 'Trạng thái thanh toán không hợp lệ.');
  const result = await pool.query(
    `UPDATE clinic_appointments
     SET payment_status = $1::text, paid_at = CASE WHEN $1::text = 'paid' THEN NOW() ELSE NULL END, updated_at = NOW()
     WHERE id = $2 RETURNING id, public_code, payment_status`,
    [paymentStatus, req.params.id],
  );
  if (!result.rowCount) return fail(res, 404, 'Không tìm thấy lịch hẹn.');
  res.json({ appointment: result.rows[0] });
}));

app.patch('/api/admin/appointments/:id', requireAdmin, verifySameOrigin, asyncRoute(async (req, res) => {
  const status = req.body.status;
  const allowed = ['confirmed', 'cancelled'];
  if (!allowed.includes(status)) return fail(res, 400, 'Trạng thái lịch hẹn không hợp lệ.');
  const result = await pool.query(
    `UPDATE clinic_appointments SET status = $1, updated_at = NOW()
     WHERE id = $2 RETURNING id, public_code, status`,
    [status, req.params.id],
  );
  if (!result.rowCount) return fail(res, 404, 'Không tìm thấy lịch hẹn.');
  res.json({ appointment: result.rows[0] });
}));

app.post('/api/contact-requests', verifySameOrigin, asyncRoute(async (req, res) => {
  const data = {
    fullName: inputString(req.body.fullName, 120),
    phone: normalizePhone(req.body.phone),
    message: inputString(req.body.message, 1000),
  };
  const validationError = validateContactRequest(data);
  if (validationError) return fail(res, 400, validationError);
  const result = await pool.query(
    `INSERT INTO clinic_contact_requests (id, full_name, phone, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, full_name, phone, message, status, created_at`,
    [crypto.randomUUID(), data.fullName, data.phone, data.message],
  );
  res.status(201).json({ request: result.rows[0] });
}));

app.get('/api/admin/contact-requests', requireAdmin, asyncRoute(async (_req, res) => {
  const result = await pool.query(
    `SELECT id, full_name, phone, message, status, created_at
     FROM clinic_contact_requests ORDER BY created_at DESC LIMIT 100`,
  );
  res.json({ requests: result.rows });
}));
app.patch('/api/admin/contact-requests/:id', requireAdmin, verifySameOrigin, asyncRoute(async (req, res) => {
  if (req.body.status !== 'resolved') return fail(res, 400, 'Trạng thái yêu cầu không hợp lệ.');
  const result = await pool.query(
    `UPDATE clinic_contact_requests SET status = 'resolved', updated_at = NOW()
     WHERE id = $1 RETURNING id, status`,
    [req.params.id],
  );
  if (!result.rowCount) return fail(res, 404, 'Không tìm thấy yêu cầu tư vấn.');
  res.json({ request: result.rows[0] });
}));

app.use('/api', (_req, res) => fail(res, 404, 'Không tìm thấy API này.'));
app.use(express.static(publicDir, { index: false, dotfiles: 'deny', fallthrough: true, maxAge: production ? '1h' : 0 }));
app.use((req, res) => res.status(404).send('Không tìm thấy trang.'));
app.use((error, _req, res, _next) => {
  console.error('Request failed:', error.message);
  if (res.headersSent) return;
  const status = error.type === 'entity.parse.failed' ? 400 : 500;
  res.status(status).json({ error: status === 400 ? 'Dữ liệu gửi lên không hợp lệ.' : 'Máy chủ gặp lỗi. Vui lòng thử lại sau.' });
});

async function start() {
  await pool.query('SELECT 1');
  await runMigrations();
  await bootstrapAdmin();
  const server = app.listen(port, '0.0.0.0', () => console.log(`Lộc Khang Clinic listening on ${port}`));
  const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Application startup failed:', error.message);
    process.exit(1);
  });
}

module.exports = { app, start };
