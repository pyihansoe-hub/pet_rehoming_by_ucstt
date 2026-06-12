const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const makeStorage = (folder) => {
  const dir = path.join(__dirname, '../../uploads', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename:    (_req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
      cb(null, unique + path.extname(file.originalname).toLowerCase());
    },
  });
};

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  allowed.includes(ext) ? cb(null, true) : cb(new Error('Only jpg, jpeg, png, webp allowed.'));
};

const opts = { limits: { fileSize: 5 * 1024 * 1024 }, fileFilter };

const petImageUploader  = multer({ storage: makeStorage('pets'),    ...opts });
const avatarUploader    = multer({ storage: makeStorage('avatars'), ...opts });
const blogCoverUploader = multer({ storage: makeStorage('blogs'),   ...opts });

module.exports = { petImageUploader, avatarUploader, blogCoverUploader };