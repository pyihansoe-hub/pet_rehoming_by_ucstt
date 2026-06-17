const { validationResult, body, param } = require('express-validator');

const validate = (rules) => async (req, res, next) => {
  await Promise.all(rules.map(rule => rule.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ message: 'Validation failed.', errors: errors.array() });
  next();
};

// ── Rule sets ────────────────────────────────────────────────

const rules = {
  register: [
    body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 100 }),
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number.'),
  ],

  login: [
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],

  updateProfile: [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number.'),
  ],

  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters.'),
  ],

  createPet: [
    body('pet_type_id').isInt({ min: 1 }).withMessage('Valid pet_type_id is required.'),
    body('name').trim().notEmpty().withMessage('Pet name is required.').isLength({ max: 100 }),
    body('gender').optional().isIn(['male', 'female', 'unknown']).withMessage('Gender must be male, female, or unknown.'),
    body('fee_type').optional().isIn(['free', 'paid']).withMessage('fee_type must be free or paid.'),
    body('adoption_fee').optional().isFloat({ min: 0 }).withMessage('Adoption fee must be a positive number.'),
    body('age_years').optional().isInt({ min: 0 }).withMessage('Age years must be a non-negative integer.'),
    body('age_months').optional().isInt({ min: 0, max: 11 }).withMessage('Age months must be 0-11.'),
    body('weight_kg').optional().isFloat({ min: 0 }).withMessage('Weight must be a positive number.'),
  ],

  requestAdoption: [
    body('message').optional().isLength({ max: 1000 }).withMessage('Message too long.'),
  ],

  createBlog: [
    body('title').trim().notEmpty().withMessage('Title is required.').isLength({ max: 255 }),
    body('content').notEmpty().withMessage('Content is required.'),
    body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Invalid status.'),
    body('tags').optional().isArray().withMessage('Tags must be an array.'),
  ],

  initiatePayment: [
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number.'),
    body('currency').optional().isLength({ max: 10 }),
    body('adoption_request_id').optional().isInt({ min: 1 }),
  ],

  addComment: [
    body('content').trim().notEmpty().withMessage('Comment cannot be empty.').isLength({ max: 2000 }),
  ],

  chatMessage: [
    body('message').trim().notEmpty().withMessage('Message is required.').isLength({ max: 2000 }),
  ],
};

module.exports = { validate, rules };