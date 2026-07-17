const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../db/pool');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
const register = async (req, res) => {
  console.log('🔵 REGISTER ENDPOINT HIT! Email:', req.body.email);
  const { name, email, password, phone, address, payment_method } = req.body;
  
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password are required.' });
  if (!payment_method || !payment_method.method_type) return res.status(400).json({ message: 'Payment method is required.' });

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    console.log('🟡 Database found:', exists.rows);

    if (exists.rows.length) {
      console.log('🔴 RETURNING 409! User exists!');
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const hashed = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, phone, address)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, email, phone, address, role, created_at`,
      [name, email.toLowerCase().trim(), hashed, phone || null, address || null]
    );
    const newUser = rows[0];

    const pm = payment_method;
    if (pm.method_type === 'credit_card') {
      await pool.query(
        `INSERT INTO user_payment_methods 
          (user_id, method_type, card_holder_name, card_last_four, card_brand, card_expiry_month, card_expiry_year, metadata, is_default)
         VALUES ($1,'credit_card',$2,$3,$4,$5,$6,$7,TRUE)`,
        [newUser.id, pm.card_holder_name, pm.card_last_four, pm.card_brand, pm.card_expiry_month, pm.card_expiry_year, JSON.stringify({ billing_address: pm.billing_address || null })]
      );
    } else if (['ayapay', 'wavepay', 'kpay'].includes(pm.method_type)) {
      await pool.query(
        `INSERT INTO user_payment_methods 
          (user_id, method_type, wallet_phone, wallet_account_name, is_default)
         VALUES ($1,$2,$3,$4,TRUE)`,
        [newUser.id, pm.method_type, pm.wallet_phone, pm.wallet_account_name]
      );
    }

    console.log('🟢 RETURNING 201! User created successfully!');
    res.status(201).json({ 
      message: 'Registration successful.', 
      token: signToken(newUser.id), 
      user: newUser 
    });

  } catch (err) {
    console.error('❌ REGISTRATION ERROR:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, password, phone, address, role FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid email or password.' });

    const { password: _, ...safeUser } = user;
    res.json({ message: 'Login successful.', token: signToken(user.id), user: safeUser });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { register, login };