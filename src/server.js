require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json());

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { message: 'Too many attempts, please try again in 15 minutes.' },
});
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  message: { message: 'Slow down — chat limit is 20 messages per minute.' },
});
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: { message: 'Too many requests, please try again later.' },
}));
app.get('/', (_req, res) => res.json({ message: '🐾 Pet Rehoming API v2' }));

app.use('/api/auth',               require('./routes/auth'));
app.use('/api/user',               require('./routes/user'));
app.use('/api/pet-types',          require('./routes/petType'));
app.use('/api/pets',               require('./routes/pet'));
app.use('/api/adoption-requests',  require('./routes/adoption'));
app.use('/api/payments',           require('./routes/payment'));
app.use('/api/blogs',              require('./routes/blog'));
app.use('/api/chat',               require('./routes/chat'));
app.use('/api/favorites',          require('./routes/favorite'));
app.use('/api/monitoring',     require('./routes/monitoring'));
app.use('/api/reports',        require('./routes/report'));
app.use('/api/notifications',  require('./routes/notification'));
app.use('/api/admin',          require('./routes/admin'));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected error.', error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Server on port ${PORT}`));
