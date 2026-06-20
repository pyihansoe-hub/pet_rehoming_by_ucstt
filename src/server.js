require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
const seedAdmin  = require('./services/seedAdmin');

const app = express();

//app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));

const { handleWebhook } = require('./controllers/webhookController');
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, message: { message: 'Too many attempts, try again in 15 minutes.' } });
const chatLimiter = rateLimit({ windowMs: 60*1000,    max: 20, message: { message: 'Chat limit: 20 messages per minute.' } });
app.use(rateLimit({ windowMs: 15*60*1000, max: 100,   message: { message: 'Too many requests.' } }));

app.get('/', (_req, res) => res.json({ message: '🐾 Pet Rehoming & Monitoring System' }));

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
app.use('/api/chat',     chatLimiter, require('./routes/chat'));
app.use('/api/admin',             require('./routes/admin'));
app.use('/api/messages', require('./routes/messages'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Unexpected error.' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  await seedAdmin();
  const { processDueReminders, processHealthLogReminders } = require('./services/reminderScheduler');
  setInterval(processDueReminders, 60 * 60 * 1000);
  processDueReminders();
  setInterval(processHealthLogReminders, 24 * 60 * 60 * 1000);
  processHealthLogReminders();
});