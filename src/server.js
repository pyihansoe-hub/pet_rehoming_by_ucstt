require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

app.get('/', (_req, res) => res.json({ message: '🐾 Pet Rehoming API v2' }));

app.use('/api/auth',               require('./routes/auth'));
app.use('/api/user',               require('./routes/user'));
app.use('/api/pet-types',          require('./routes/petType'));
app.use('/api/pets',               require('./routes/pet'));
app.use('/api/adoption-requests',  require('./routes/adoption'));
app.use('/api/payments',           require('./routes/payment'));
app.use('/api/blogs',              require('./routes/blog'));
app.use('/api/chat',               require('./routes/chat'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected error.', error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
