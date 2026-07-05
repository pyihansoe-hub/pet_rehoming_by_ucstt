-- ============================================================
-- PET REHOMING & MONITORING SYSTEM — FULL SCHEMA
-- ============================================================

-- ── ENUMS ──────────────────────────────────────────────────────
CREATE TYPE payment_status     AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE adoption_status    AS ENUM ('available', 'pending', 'adopted', 'withdrawn');
CREATE TYPE adoption_fee_type  AS ENUM ('free', 'paid');
CREATE TYPE blog_status        AS ENUM ('draft', 'published', 'archived');
CREATE TYPE request_status     AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE report_status      AS ENUM ('pending', 'reviewed', 'dismissed');

-- ── TRIGGER FUNCTION ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── USERS ──────────────────────────────────────────────────────
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100)  NOT NULL,
  email           VARCHAR(150)  NOT NULL UNIQUE,
  password        TEXT          NOT NULL,
  phone           VARCHAR(30),
  address         TEXT,
  avatar_url      TEXT,
  role            VARCHAR(20)   NOT NULL DEFAULT 'user',
  is_suspended    BOOLEAN       NOT NULL DEFAULT FALSE,
  suspended_at    TIMESTAMPTZ,
  suspend_reason  TEXT,
  is_trusted      BOOLEAN       NOT NULL DEFAULT FALSE,
  trusted_at      TIMESTAMPTZ,
  trusted_note    TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── SYSTEM CONFIG (admin seed tracking) ───────────────────────
CREATE TABLE system_config (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ADMIN AUDIT LOG ────────────────────────────────────────────
CREATE TABLE admin_audit_log (
  id          SERIAL PRIMARY KEY,
  admin_id    INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   INT,
  detail      TEXT,
  ip_address  VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_admin  ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_target ON admin_audit_log(target_type, target_id);

-- ── PASSWORD RESET TOKENS ──────────────────────────────────────
CREATE TABLE password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reset_token ON password_reset_tokens(token);

-- ── PET TYPES ──────────────────────────────────────────────────
CREATE TABLE pet_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL UNIQUE,
  description TEXT,
  icon_url    TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO pet_types (name, description) VALUES
  ('Dog', 'Domestic dogs of all breeds'),
  ('Cat', 'Domestic cats of all breeds'),
  ('Other', 'Other types of pets');

-- ── PETS ───────────────────────────────────────────────────────
CREATE TABLE pets (
  id              SERIAL PRIMARY KEY,
  owner_id        INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_type_id     INT           NOT NULL REFERENCES pet_types(id),
  name            VARCHAR(100)  NOT NULL,
  breed           VARCHAR(100),
  birth_date      DATE,
  is_sure         BOOLEAN       NOT NULL DEFAULT FALSE,
  gender          VARCHAR(10),
  color           VARCHAR(100),
  weight_kg       NUMERIC(5,2),
  description     TEXT,
  health_notes    TEXT,
  is_vaccinated   BOOLEAN       NOT NULL DEFAULT FALSE,
  is_neutered     BOOLEAN       NOT NULL DEFAULT FALSE,
  fee_type        adoption_fee_type NOT NULL DEFAULT 'free',
  adoption_fee    NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          adoption_status NOT NULL DEFAULT 'available',
  location        VARCHAR(255),
  city            VARCHAR(100),
  views           INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE TRIGGER pets_updated_at BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_pets_owner    ON pets(owner_id);
CREATE INDEX idx_pets_type     ON pets(pet_type_id);
CREATE INDEX idx_pets_status   ON pets(status);
CREATE INDEX idx_pets_fee_type ON pets(fee_type);

-- ── PET IMAGES ─────────────────────────────────────────────────
CREATE TABLE pet_images (
  id          SERIAL PRIMARY KEY,
  pet_id      INT   NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  url         TEXT  NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pet_images_pet ON pet_images(pet_id);

-- ── PET STATUS HISTORY ─────────────────────────────────────────
CREATE TABLE pet_status_history (
  id          SERIAL PRIMARY KEY,
  pet_id      INT         NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  old_status  VARCHAR(30),
  new_status  VARCHAR(30) NOT NULL,
  changed_by  INT         REFERENCES users(id) ON DELETE SET NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pet_status_history ON pet_status_history(pet_id);

-- ── FAVORITES ──────────────────────────────────────────────────
CREATE TABLE favorites (
  user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id   INT NOT NULL REFERENCES pets(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, pet_id)
);
CREATE INDEX idx_favorites_user ON favorites(user_id);

-- ── ADOPTION REQUESTS ──────────────────────────────────────────
CREATE TABLE adoption_requests (
  id                      SERIAL PRIMARY KEY,
  pet_id                  INT     NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  requester_id            INT     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message                 TEXT,
  status                  request_status NOT NULL DEFAULT 'pending',
  reviewed_at             TIMESTAMPTZ,
  monitoring_status       VARCHAR(20) NOT NULL DEFAULT 'not_started',
  monitoring_started_at   TIMESTAMPTZ,
  monitoring_completed_at TIMESTAMPTZ,
  welfare_score           VARCHAR(20),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pet_id, requester_id)
);
CREATE TRIGGER adoption_requests_updated_at BEFORE UPDATE ON adoption_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_adoption_requests_pet       ON adoption_requests(pet_id);
CREATE INDEX idx_adoption_requests_requester ON adoption_requests(requester_id);

-- ── ADOPTION AGREEMENTS ────────────────────────────────────────
CREATE TABLE adoption_agreements (
  id                  SERIAL PRIMARY KEY,
  adoption_request_id INT     NOT NULL UNIQUE REFERENCES adoption_requests(id) ON DELETE CASCADE,
  owner_agreed        BOOLEAN NOT NULL DEFAULT FALSE,
  adopter_agreed       BOOLEAN NOT NULL DEFAULT FALSE,
  owner_agreed_at      TIMESTAMPTZ,
  adopter_agreed_at    TIMESTAMPTZ,
  terms                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PAYMENTS ───────────────────────────────────────────────────
CREATE TABLE payments (
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
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_payments_user         ON payments(user_id);
CREATE INDEX idx_payments_adoption_req ON payments(adoption_request_id);
CREATE INDEX idx_payments_status       ON payments(status);

-- ── MONITORING: CHECK-IN SCHEDULE ──────────────────────────────
CREATE TABLE monitoring_checkins (
  id                  SERIAL PRIMARY KEY,
  adoption_request_id INT         NOT NULL REFERENCES adoption_requests(id) ON DELETE CASCADE,
  checkin_type        VARCHAR(20) NOT NULL,
  due_at              TIMESTAMPTZ NOT NULL,
  submitted_at        TIMESTAMPTZ,
  followup_id         INT,
  is_overdue          BOOLEAN     NOT NULL DEFAULT FALSE,
  reminder_sent_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(adoption_request_id, checkin_type)
);
CREATE INDEX idx_checkins_adoption ON monitoring_checkins(adoption_request_id);
CREATE INDEX idx_checkins_due      ON monitoring_checkins(due_at) WHERE submitted_at IS NULL;

-- ── ADOPTION FOLLOW-UPS ─────────────────────────────────────────
CREATE TABLE adoption_followups (
  id                  SERIAL PRIMARY KEY,
  adoption_request_id INT   NOT NULL REFERENCES adoption_requests(id) ON DELETE CASCADE,
  submitted_by        INT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  health_status       VARCHAR(50) NOT NULL DEFAULT 'good',
  weight_kg           NUMERIC(5,2),
  notes               TEXT,
  image_url           TEXT,
  is_visible_to_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_followups_adoption ON adoption_followups(adoption_request_id);

-- link monitoring_checkins.followup_id now that table exists
ALTER TABLE monitoring_checkins
  ADD CONSTRAINT fk_checkins_followup
  FOREIGN KEY (followup_id) REFERENCES adoption_followups(id) ON DELETE SET NULL;

-- ── WELFARE FLAGS ──────────────────────────────────────────────
CREATE TABLE welfare_flags (
  id                  SERIAL PRIMARY KEY,
  adoption_request_id INT         NOT NULL REFERENCES adoption_requests(id) ON DELETE CASCADE,
  pet_id              INT         NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  flag_type           VARCHAR(30) NOT NULL,
  detail              TEXT,
  resolved            BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_by         INT         REFERENCES users(id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_welfare_flags_adoption ON welfare_flags(adoption_request_id);
CREATE INDEX idx_welfare_flags_resolved ON welfare_flags(resolved) WHERE resolved = FALSE;

-- ── PET HEALTH LOGS ────────────────────────────────────────────
CREATE TABLE pet_health_logs (
  id          SERIAL PRIMARY KEY,
  pet_id      INT   NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  logged_by   INT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(80) NOT NULL,
  description TEXT,
  vet_name    VARCHAR(150),
  weight_kg   NUMERIC(5,2),
  next_due    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_health_logs_pet ON pet_health_logs(pet_id);

-- ── FOLLOW-UP REMINDERS ────────────────────────────────────────
CREATE TABLE followup_reminders (
  id                  SERIAL PRIMARY KEY,
  adoption_request_id INT         NOT NULL REFERENCES adoption_requests(id) ON DELETE CASCADE,
  remind_at           TIMESTAMPTZ NOT NULL,
  sent                BOOLEAN     NOT NULL DEFAULT FALSE,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reminders_due ON followup_reminders(remind_at) WHERE sent = FALSE;

-- ── BLOG CATEGORIES ────────────────────────────────────────────
CREATE TABLE blog_categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  pet_type_id INT REFERENCES pet_types(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
INSERT INTO blog_categories (name, slug, description, pet_type_id) VALUES
  ('Dog Care',     'dog-care',     'Tips and advice for dog owners',     1),
  ('Cat Care',     'cat-care',     'Tips and advice for cat owners',     2),
  ('Health & Vet', 'health-vet',   'Health tips and vet advice for cats and dogs', NULL),
  ('Training',     'training',     'Training guides for cats and dogs',  NULL),
  ('Nutrition',    'nutrition',    'Diet and nutrition for cats and dogs', NULL),
  ('Other',        'other',        'Other pets and general pet topics',  NULL);

-- ── BLOGS ──────────────────────────────────────────────────────
CREATE TABLE blogs (
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
CREATE TRIGGER blogs_updated_at BEFORE UPDATE ON blogs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_blogs_author   ON blogs(author_id);
CREATE INDEX idx_blogs_category ON blogs(category_id);
CREATE INDEX idx_blogs_status   ON blogs(status);

-- ── BLOG TAGS ──────────────────────────────────────────────────
CREATE TABLE tags (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE blog_tags (
  blog_id INT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  tag_id  INT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (blog_id, tag_id)
);

-- ── BLOG LIKES ─────────────────────────────────────────────────
CREATE TABLE blog_likes (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blog_id INT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, blog_id)
);

-- ── BLOG COMMENTS ──────────────────────────────────────────────
CREATE TABLE blog_comments (
  id          SERIAL PRIMARY KEY,
  blog_id     INT   NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  user_id     INT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT  NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER blog_comments_updated_at BEFORE UPDATE ON blog_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_blog_comments_blog ON blog_comments(blog_id);

-- ── REPORTS ────────────────────────────────────────────────────
CREATE TABLE reports (
  id          SERIAL PRIMARY KEY,
  reporter_id INT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id      INT   REFERENCES pets(id)  ON DELETE CASCADE,
  blog_id     INT   REFERENCES blogs(id) ON DELETE CASCADE,
  reason      VARCHAR(100) NOT NULL,
  details     TEXT,
  status      report_status NOT NULL DEFAULT 'pending',
  reviewed_by INT   REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT report_target CHECK (
    (pet_id IS NOT NULL AND blog_id IS NULL) OR
    (blog_id IS NOT NULL AND pet_id IS NULL)
  )
);
CREATE INDEX idx_reports_status ON reports(status);

-- ── NOTIFICATIONS ──────────────────────────────────────────────
CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(80) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  link        VARCHAR(255),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user   ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- ── CHAT SESSIONS ──────────────────────────────────────────────
CREATE TABLE chat_sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INT   REFERENCES users(id) ON DELETE SET NULL,
  title       VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE chat_messages (
  id          SERIAL PRIMARY KEY,
  session_id  INT   NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);

-- ── CONVERSATIONS (direct messaging) ───────────────────────────
CREATE TABLE conversations (
  id                  SERIAL PRIMARY KEY,
  adoption_request_id INT  NOT NULL UNIQUE REFERENCES adoption_requests(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INT   NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT  NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender       ON messages(sender_id);

--blog's comment and likes
-- Pet Likes
CREATE TABLE pet_likes (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id  INT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, pet_id)
);

-- Pet Comments
CREATE TABLE pet_comments (
  id       SERIAL PRIMARY KEY,
  pet_id   INT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER pet_comments_updated_at BEFORE UPDATE ON pet_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_pet_comments_pet ON pet_comments(pet_id);

ALTER TABLE adoption_requests ADD COLUMN payment_id INT REFERENCES payments(id) ON DELETE SET NULL;
-- ============================================================
-- END OF SCHEMA
-- ============================================================