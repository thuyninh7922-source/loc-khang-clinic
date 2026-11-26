const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { pool, runMigrations, bootstrapAdmin } = require('./db');
const locations = require('./data/locations.json');
const doctorCatalog = require('./data/doctors.json');
const billing = require('./lib/billing');
const {
  findDoctor,
  normalizeEmail,
  isValidEmail,
  normalizePhone,
  canonicalPhone,
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
