require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
const seedAdmin  = require('./services/seedAdmin');
const app = express();

// Tell Express to trust proxy headers (required for localtunnel / Koyeb / Render)
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allows inline scripts in HTML
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],     // Allows base64/placeholder images
      styleSrc: ["'self'", "'unsafe-inline'"]   // Allows inline styles
    }
  }
}));
const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];
if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean).forEach((url) => {
    if (!allowedOrigins.includes(url)) allowedOrigins.push(url);
  });
}

const isLocalDevOrigin = (origin) =>
  origin === 'null'
  || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/.test(origin)
  || /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);

app.use(cors({
  origin(origin, callback) {
    if (!isProd) {
      callback(null, origin || true);
      return;
    }
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

const { handleWebhook } = require('./controllers/webhookController');
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Increase payload limit to 50mb
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files with caching
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '30d',
  setHeaders: (res, filepath) => {
    if (filepath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 100, message: { message: 'Too many attempts, try again in 15 minutes.' } });
const chatLimiter = rateLimit({ windowMs: 60*1000,    max: 20, message: { message: 'Chat limit: 20 messages per minute.' } });
app.use(rateLimit({ windowMs: 15*60*1000, max: 1000,   message: { message: 'Too many requests.' } }));

// app.get('/', (_req, res) => res.json({ message: ' Pet Rehoming & Monitoring System' }));

app.use('/api/auth',              authLimiter, require('./routes/auth'));
app.use('/api/user',              require('./routes/user'));
app.use('/api/pet-types',         require('./routes/petType'));
app.use('/api/pets',              require('./routes/pet'));
app.use('/api/adoption-requests', require('./routes/adoption'));
app.use('/api/payments',          require('./routes/payment'));
app.use('/api/monitoring',        require('./routes/monitoring'));
app.use('/api/blogs',             require('./routes/blog'));
app.use('/api/reports',           require('./routes/report'));
app.use('/api/notifications',     require('./routes/notification'));
app.use('/api/favorites',         require('./routes/favorite'));
app.use('/api/chat', chatLimiter, require('./routes/chat'));
app.use('/api/messages',          require('./routes/messages'));
app.use('/api/admin',             require('./routes/admin'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- SERVE FRONTEND ---
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Serve specific frontend pages (HTML files)
app.get(/^\/(index\.html|pages\/.*)$/, (req, res) => {
  res.sendFile(path.join(frontendPath, req.path));
});

// Catch-all to serve index.html for any other non-API route
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});
// ----------------------

// Error handler (Must be after all routes)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Unexpected error.' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server on port ${PORT}`);

  const { processDueReminders, processHealthLogReminders } = require('./services/reminderScheduler');

  setInterval(processDueReminders, 60 * 60 * 1000);
  processDueReminders();

  setInterval(processHealthLogReminders, 24 * 60 * 60 * 1000);
  processHealthLogReminders();

  await seedAdmin();
});