-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE adoption_status AS ENUM ('available', 'pending', 'adopted', 'withdrawn');
CREATE TYPE adoption_fee_type AS ENUM ('free', 'paid');
CREATE TYPE blog_status AS ENUM ('draft', 'published', 'archived');

-- ============================================================
-- TRIGGER FUNCTION: auto update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL UNIQUE,
  password    TEXT          NOT NULL,
  phone       VARCHAR(30),
  address     TEXT,
  avatar_url  TEXT,
  role        VARCHAR(20)   NOT NULL DEFAULT 'user', -- user | admin
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- PET TYPES  (e.g. Dog, Cat, Rabbit, Bird, Reptile …)
-- ============================================================

CREATE TABLE IF NOT EXISTS pet_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL UNIQUE,  -- e.g. "Dog"
  description TEXT,
  icon_url    TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Seed common pet types
INSERT INTO pet_types (name, description) VALUES
  ('Dog',     'Domestic dogs of all breeds'),
  ('Cat',     'Domestic cats of all breeds'),
  ('Rabbit',  'Pet rabbits'),
  ('Bird',    'Pet birds including parrots, finches, etc.'),
  ('Fish',    'Freshwater and saltwater fish'),
  ('Reptile', 'Lizards, snakes, turtles, etc.'),
  ('Hamster', 'Hamsters and other small rodents'),
  ('Guinea Pig', 'Guinea pigs'),
  ('Other',   'Other types of pets')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PETS
-- ============================================================

CREATE TABLE IF NOT EXISTS pets (
  id              SERIAL PRIMARY KEY,
  owner_id        INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_type_id     INT           NOT NULL REFERENCES pet_types(id),
  name            VARCHAR(100)  NOT NULL,
  breed           VARCHAR(100),
  age_years       INT,
  age_months      INT,
  gender          VARCHAR(10),           -- male | female | unknown
  color           VARCHAR(100),
  weight_kg       NUMERIC(5,2),
  description     TEXT,
  health_notes    TEXT,                  -- vaccinations, spayed/neutered, etc.
  is_vaccinated   BOOLEAN       NOT NULL DEFAULT FALSE,
  is_neutered     BOOLEAN       NOT NULL DEFAULT FALSE,
  fee_type        adoption_fee_type NOT NULL DEFAULT 'free',
  adoption_fee    NUMERIC(12,2) NOT NULL DEFAULT 0,  -- 0 if free
  status          adoption_status NOT NULL DEFAULT 'available',
  location        VARCHAR(255),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER pets_updated_at
  BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pets_owner      ON pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_pets_type       ON pets(pet_type_id);
CREATE INDEX IF NOT EXISTS idx_pets_status     ON pets(status);
CREATE INDEX IF NOT EXISTS idx_pets_fee_type   ON pets(fee_type);

-- ============================================================
-- PET IMAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS pet_images (
  id          SERIAL PRIMARY KEY,
  pet_id      INT   NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  url         TEXT  NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_images_pet ON pet_images(pet_id);

-- ============================================================
-- ADOPTION REQUESTS
-- ============================================================

CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE IF NOT EXISTS adoption_requests (
  id              SERIAL PRIMARY KEY,
  pet_id          INT     NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  requester_id    INT     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message         TEXT,
  status          request_status NOT NULL DEFAULT 'pending',
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pet_id, requester_id)   -- one request per user per pet
);

CREATE TRIGGER adoption_requests_updated_at
  BEFORE UPDATE ON adoption_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_adoption_requests_pet       ON adoption_requests(pet_id);
CREATE INDEX IF NOT EXISTS idx_adoption_requests_requester ON adoption_requests(requester_id);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id                  SERIAL PRIMARY KEY,
  user_id             INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  adoption_request_id INT             REFERENCES adoption_requests(id) ON DELETE SET NULL,
  amount              NUMERIC(12,2)   NOT NULL,
  currency            VARCHAR(10)     NOT NULL DEFAULT 'MMK',
  status              payment_status  NOT NULL DEFAULT 'pending',
  ayapay_reference    VARCHAR(255),
  description         TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payments_user            ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_adoption_req    ON payments(adoption_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_status          ON payments(status);

-- ============================================================
-- BLOG CATEGORIES  (e.g. Dog Care, Cat Health, Training …)
-- ============================================================

CREATE TABLE IF NOT EXISTS blog_categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  pet_type_id INT REFERENCES pet_types(id) ON DELETE SET NULL,  -- optional link to a pet type
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO blog_categories (name, slug, description, pet_type_id) VALUES
  ('Dog Care',      'dog-care',      'Tips and advice for dog owners',       1),
  ('Cat Care',      'cat-care',      'Tips and advice for cat owners',       2),
  ('Rabbit Care',   'rabbit-care',   'Tips and advice for rabbit owners',    3),
  ('Bird Care',     'bird-care',     'Tips and advice for bird owners',      4),
  ('Fish Care',     'fish-care',     'Tips and advice for fish owners',      5),
  ('Reptile Care',  'reptile-care',  'Tips and advice for reptile owners',   6),
  ('General',       'general',       'General pet care and rehoming advice', NULL),
  ('Health & Vet',  'health-vet',    'Health tips and vet advice',           NULL),
  ('Training',      'training',      'Pet training guides',                  NULL),
  ('Nutrition',     'nutrition',     'Diet and nutrition for all pets',      NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- BLOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS blogs (
  id              SERIAL PRIMARY KEY,
  author_id       INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id     INT           REFERENCES blog_categories(id) ON DELETE SET NULL,
  title           VARCHAR(255)  NOT NULL,
  slug            VARCHAR(300)  NOT NULL UNIQUE,
  summary         TEXT,
  content         TEXT          NOT NULL,
  cover_image_url TEXT,
  status          blog_status   NOT NULL DEFAULT 'draft',
  views           INT           NOT NULL DEFAULT 0,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER blogs_updated_at
  BEFORE UPDATE ON blogs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_blogs_author    ON blogs(author_id);
CREATE INDEX IF NOT EXISTS idx_blogs_category  ON blogs(category_id);
CREATE INDEX IF NOT EXISTS idx_blogs_status    ON blogs(status);

-- ============================================================
-- BLOG TAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS blog_tags (
  blog_id INT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  tag_id  INT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (blog_id, tag_id)
);

-- ============================================================
-- BLOG COMMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS blog_comments (
  id          SERIAL PRIMARY KEY,
  blog_id     INT   NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  user_id     INT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT  NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER blog_comments_updated_at
  BEFORE UPDATE ON blog_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_blog_comments_blog ON blog_comments(blog_id);

-- ============================================================
-- CHAT SESSIONS (AI chatbot conversation history)
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INT   REFERENCES users(id) ON DELETE SET NULL,  -- NULL = anonymous
  title       VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS chat_messages (
  id          SERIAL PRIMARY KEY,
  session_id  INT   NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL,  -- user | assistant
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id   INT NOT NULL REFERENCES pets(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, pet_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

CREATE TABLE IF NOT EXISTS adoption_followups (
  id                  SERIAL PRIMARY KEY,
  adoption_request_id INT   NOT NULL REFERENCES adoption_requests(id) ON DELETE CASCADE,
  submitted_by        INT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  health_status       VARCHAR(50) NOT NULL DEFAULT 'good', -- good | fair | poor
  weight_kg           NUMERIC(5,2),
  notes               TEXT,
  image_url           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_health_logs (
  id          SERIAL PRIMARY KEY,
  pet_id      INT   NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  logged_by   INT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(80) NOT NULL, -- vaccination | vet_visit | deworming | weight | other
  description TEXT,
  vet_name    VARCHAR(150),
  weight_kg   NUMERIC(5,2),
  next_due    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followups_adoption ON adoption_followups(adoption_request_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_pet    ON pet_health_logs(pet_id);


-- ── User suspension ───────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended  BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspend_reason TEXT;

-- ── Admin seed tracking (prevents re-seeding) ─────────────────
CREATE TABLE IF NOT EXISTS system_config (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Admin activity / audit log ────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          SERIAL PRIMARY KEY,
  admin_id    INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),           -- user | pet | blog | adoption | report | payment
  target_id   INT,
  detail      TEXT,
  ip_address  VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin  ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_time   ON admin_audit_log(created_at);

-- ── Add visibility flag to follow-ups ─────────────────────────
-- (already private by default, this just makes it explicit)
ALTER TABLE adoption_followups ADD COLUMN IF NOT EXISTS is_visible_to_public BOOLEAN NOT NULL DEFAULT FALSE;

--try debug--
sudo -u postgres psql -d pet_rehoming << 'EOF'
-- Create reports table with all columns the controller expects
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
    blog_id INTEGER REFERENCES blogs(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL,
    details TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    action VARCHAR(50),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_report_target CHECK (
        (pet_id IS NOT NULL AND blog_id IS NULL) OR 
        (pet_id IS NULL AND blog_id IS NOT NULL)
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_pet_id ON reports(pet_id);
CREATE INDEX IF NOT EXISTS idx_reports_blog_id ON reports(blog_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

-- Verify
SELECT 'reports table created successfully!' as status;
EOF