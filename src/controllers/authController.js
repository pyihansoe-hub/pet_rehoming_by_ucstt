const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../db/pool');
const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');

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
    if (exists.rows.length) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const hashed = await bcrypt.hash(password, 12);

    // Generate TOTP Secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `PetAdoption (${email})`, // Shows up in Google Authenticator
    });

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, phone, address, two_factor_secret)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, email, phone, address, role, created_at`,
      [name, email.toLowerCase().trim(), hashed, phone || null, address || null, secret.base32]
    );
    const newUser = rows[0];

    // ... (Keep your existing payment method insertion logic here exactly as it is) ...
    const pm = payment_method;
    if (pm.method_type === 'credit_card') {
      if (!pm.card_holder_name || !pm.card_last_four || !pm.card_expiry_month || !pm.card_expiry_year) {
        return res.status(400).json({ message: 'Incomplete credit card details.' });
      }
      await pool.query(
        `INSERT INTO user_payment_methods 
          (user_id, method_type, card_holder_name, card_last_four, card_brand, card_expiry_month, card_expiry_year, metadata, is_default)
         VALUES ($1,'credit_card',$2,$3,$4,$5,$6,$7,TRUE)`,
        [newUser.id, pm.card_holder_name, pm.card_last_four, pm.card_brand, pm.card_expiry_month, pm.card_expiry_year, JSON.stringify({ billing_address: pm.billing_address || null })]
      );
    } else if (['ayapay', 'wavepay', 'kpay'].includes(pm.method_type)) {
      const walletPhone = pm.wallet_phone || phone;
      if (!walletPhone || !pm.wallet_account_name) {
        return res.status(400).json({ message: 'Wallet phone number and account name are required.' });
      }
      await pool.query(
        `INSERT INTO user_payment_methods 
          (user_id, method_type, wallet_phone, wallet_account_name, is_default)
         VALUES ($1,$2,$3,$4,TRUE)`,
        [newUser.id, pm.method_type, walletPhone, pm.wallet_account_name]
      );
    }

    // Generate QR Code for Authenticator
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Return QR code instead of login token
    res.status(201).json({ 
      message: 'Registration successful. Please verify your authenticator.', 
      requireTwoFactor: true,
      email: newUser.email,
      qrCode: qrCodeUrl
    });

  } catch (err) {
    console.error('❌ REGISTRATION ERROR:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/auth/verify-totp
const verifyTOTP = async (req, res) => {
  const { email, token } = req.body;
  
  try {
    // Find user by email
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = rows[0];

    if (!user || !user.two_factor_secret) {
      return res.status(400).json({ message: 'User not found or 2FA not set up.' });
    }

    // Verify the token provided by the user's Google Authenticator
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 4 // Allows 1 step before/after current time (30 seconds variance)
    });

    if (!verified) {
      return res.status(401).json({ message: 'Invalid authenticator code.' });
    }

    // Enable 2FA for future logins
    await pool.query('UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [user.id]);

    const { password: _, two_factor_secret: __, ...safeUser } = user;

    // Now issue the login token
    res.json({ 
      message: '2FA verification successful.', 
      token: signToken(user.id), 
      user: safeUser 
    });

  } catch (err) {
    console.error('❌ TOTP VERIFY ERROR:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, password, phone, address, role, two_factor_enabled FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid email or password.' });

    // If user has 2FA enabled, ask for TOTP code instead of logging in immediately
    if (user.two_factor_enabled) {
      return res.status(200).json({ 
        message: '2FA required.', 
        requireTwoFactor: true,
        email: user.email 
      });
    }

    const { password: _, ...safeUser } = user;
    res.json({ message: 'Login successful.', token: signToken(user.id), user: safeUser });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET /api/auth/2fa/setup
const setup2FA = async (req, res) => {
  try {
    // req.user is injected by your JWT auth middleware
    const { rows } = await pool.query('SELECT email, two_factor_enabled FROM users WHERE id=$1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    const user = rows[0];

    // If already enabled, stop them from generating a new code
    if (user.two_factor_enabled) {
      return res.status(400).json({ message: '2FA is already enabled on this account.' });
    }

    // Generate a new secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `PetAdoption (${user.email})`,
    });

    // Save the secret to DB (but keep two_factor_enabled = FALSE until they verify it)
    await pool.query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [secret.base32, req.user.id]);

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({ 
      message: 'Scan the QR code with Google Authenticator',
      qrCode: qrCodeUrl 
    });
  } catch (err) {
    console.error('❌ SETUP 2FA ERROR:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/auth/2fa/verify
const verify2FASetup = async (req, res) => {
  const { token } = req.body;

  if (!token) return res.status(400).json({ message: 'Token is required.' });

  try {
    const { rows } = await pool.query('SELECT two_factor_secret, two_factor_enabled FROM users WHERE id=$1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    const user = rows[0];

    if (user.two_factor_enabled) {
      return res.status(400).json({ message: '2FA is already enabled.' });
    }

    if (!user.two_factor_secret) {
      return res.status(400).json({ message: 'Please generate a QR code first.' });
    }

    // Verify the token provided by the user's Google Authenticator
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ message: 'Invalid authenticator code.' });
    }

    // Enable 2FA for future logins
    await pool.query('UPDATE users SET two_factor_enabled = TRUE WHERE id = $1', [req.user.id]);

    res.json({ message: '2FA enabled successfully!' });
  } catch (err) {
    console.error('❌ VERIFY 2FA SETUP ERROR:', err);
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

module.exports = { 
  register, 
  verifyTOTP, 
  login, 
  setup2FA,       
  verify2FASetup   
};