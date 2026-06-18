# Backend Features Implementation Summary

## Completed Features

### 1. Password Reset via Email
**Files Modified/Created:**
- `src/controllers/authController.js` - Already had `forgotPassword` and `resetPassword` functions
- `src/routes/auth.js` - Routes already configured
- `sql/schema.sql` - `password_reset_tokens` table already exists

**Endpoints:**
- `POST /api/auth/forgot-password` - Send reset link email
- `POST /api/auth/reset-password` - Reset password with token

---

### 2. Search Pets by Location (City)
**Files Modified:**
- `sql/schema.sql` - `city` field already exists as `pet_city` ENUM
- `src/controllers/petController.js` - `listPets` already supports city filtering
- `src/routes/pet.js` - GET `/api/pets?city=Yangon`

**Usage:**
```javascript
GET /api/pets?city=Yangon
GET /api/pets?city=Mandalay&status=available
```

---

### 3. Adoption Contract/Agreement
**Files Modified:**
- `src/controllers/adoptionController.js` - Already has `agreeContract` and `getContract`
- `sql/schema.sql` - Tables already have `contract_agreed`, `contract_text`, `contract_signed_at`

**Endpoints:**
- `POST /api/adoption-requests/:id/agree-contract` - Adopter agrees to contract
- `GET /api/adoption-requests/:id/contract` - Retrieve agreed contract

---

### 4. Pet Views Tracking & Trending Pets
**Files Modified:**
- `src/controllers/petController.js` - Added `trendingPets` function
- `src/routes/pet.js` - Added route

**Endpoints:**
- `GET /api/pets/trending?limit=10` - Returns pets sorted by views in last 7 days

---

### 5. Direct Messaging Between Owner and Adopter
**Files Created:**
- `src/controllers/messageController.js` - Complete messaging system
- `src/routes/messages.js` - Message routes
- `sql/schema.sql` - Added `messages` table

**Database Schema:**
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id INT REFERENCES users(id),
  receiver_id INT REFERENCES users(id),
  adoption_request_id INT REFERENCES adoption_requests(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:**
- `POST /api/messages/send` - Send message (requires approved adoption)
- `GET /api/messages/conversations` - Get all conversations
- `GET /api/messages/:userId` - Get messages with specific user
- `PATCH /api/messages/:id/read` - Mark message as read
- `GET /api/messages/unread/count` - Get unread count

**Security:** Messages only unlocked after adoption approval

---

### 6. Aya Pay Webhook
**Files Modified:**
- `src/controllers/paymentController.js` - Added `ayaWebhook` function
- `src/routes/payment.js` - Added webhook route

**Endpoint:**
- `POST /api/payments/webhook/aya` - Called by Aya Pay directly (no auth required)

**Features:**
- Automatic payment status update
- Auto-marks pet as adopted on successful payment
- Creates follow-up reminders automatically
- Sends notification to adopter

---

### 7. Refresh Tokens (Silent Re-login)
**Files Created:**
- `src/controllers/tokenController.js` - Refresh token logic
- `sql/schema.sql` - Added `refresh_tokens` table

**Database Schema:**
```sql
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  token VARCHAR(255) UNIQUE,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:**
- `POST /api/auth/refresh-token` - Exchange refresh token for new access token
- `POST /api/auth/logout` - Revoke refresh token

**Flow:**
1. Login returns both accessToken and refreshToken
2. When accessToken expires, call `/api/auth/refresh-token` with refreshToken
3. Receive new accessToken and new refreshToken (old one revoked)
4. Store tokens securely on frontend

---

### 8. Follow-up Reminders (Automated Emails)
**Files Created:**
- `src/services/scheduler.js` - Cron job scheduler
- `src/services/email.js` - Added `followUpReminder` template

**Database:**
- `adoption_reminders` table already exists in schema

**Schedule:** Runs daily at 9 AM
- Sends emails at 1 week, 1 month, and 3 months post-adoption
- Automatically tracks sent reminders

---

### 9. Health Log Reminders
**Files Modified:**
- `src/services/scheduler.js` - Added health reminder processing
- `src/services/email.js` - Added `healthReminder` template

**Features:**
- Scans `pet_health_logs` for upcoming `next_due` dates
- Sends email 3 days before due date
- Covers vaccinations, vet visits, deworming, etc.

---

### 10. Pet Status History
**Files Modified:**
- `src/controllers/petController.js` - Updated `updatePet` to log status changes
- `sql/schema.sql` - `pet_status_history` table already exists

**Database Schema:**
```sql
CREATE TABLE pet_status_history (
  id SERIAL PRIMARY KEY,
  pet_id INT REFERENCES pets(id),
  old_status adoption_status,
  new_status adoption_status,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Endpoints:**
- `GET /api/pets/status-history/:id` - Get status change history

**Automatic Logging:** Every time pet status changes (available → pending → adopted)

---

## API Route Summary

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/refresh-token
POST /api/auth/logout
```

### Pets
```
GET  /api/pets                  - List with filters (city, status, type, etc.)
GET  /api/pets/trending         - Trending pets by views (last 7 days)
GET  /api/pets/:id              - Get pet details
GET  /api/pets/status-history/:id - Get status change history
POST /api/pets                  - Create pet listing
PATCH /api/pets/:id             - Update pet
DELETE /api/pets/:id            - Delete pet
```

### Adoption
```
POST   /api/pets/:id/adopt                - Request adoption
GET    /api/adoption-requests/mine        - My requests (as requester)
GET    /api/adoption-requests/received    - Requests on my pets (as owner)
PATCH  /api/adoption-requests/:id         - Approve/reject request
PATCH  /api/adoption-requests/:id/cancel  - Cancel request
POST   /api/adoption-requests/:id/agree-contract - Agree to contract
GET    /api/adoption-requests/:id/contract - Get contract
```

### Messages
```
POST /api/messages/send           - Send message
GET  /api/messages/conversations  - Get all conversations
GET  /api/messages/:userId        - Get messages with user
PATCH /api/messages/:id/read      - Mark as read
GET  /api/messages/unread/count   - Unread count
```

### Payments
```
GET  /api/payments                 - List payments
GET  /api/payments/:id             - Get payment
POST /api/payments/initiate        - Initiate payment
POST /api/payments/:id/verify      - Verify payment (manual)
POST /api/payments/webhook/aya     - Aya Pay webhook (auto)
```

---

##  Database Migration Required

Run the updated schema to add new tables:

```bash
# The schema includes these NEW tables:
# - messages (direct messaging)
# - refresh_tokens (silent re-login)

# Existing tables used by new features:
# - password_reset_tokens (password reset)
# - pet_status_history (status tracking)
# - adoption_reminders (follow-up reminders)
```

---

##  Configuration Required

Add to `.env`:

```env
# Email (for password reset & reminders)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourapp.com

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pet_rehoming
DB_USER=postgres
DB_PASSWORD=your-password

# Aya Pay
AYAPAY_API_KEY=your-api-key
AYAPAY_MERCHANT_ID=your-merchant-id
```

---

##  Usage Examples

### Password Reset Flow
```javascript
// 1. Request reset link
fetch('/api/auth/forgot-password', {
  method: 'POST',
  body: JSON.stringify({ email: 'user@example.com' })
});

// 2. User clicks email link → /reset-password?token=abc123
// 3. Submit new password
fetch('/api/auth/reset-password', {
  method: 'POST',
  body: JSON.stringify({ token: 'abc123', newPassword: 'newpass123' })
});
```

### Refresh Token Flow
```javascript
// Login
const { accessToken, refreshToken } = await login();

// Store both tokens
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// When API call returns 401 (expired):
const newTokens = await fetch('/api/auth/refresh-token', {
  method: 'POST',
  body: JSON.stringify({ refreshToken })
});
// Use new accessToken for subsequent requests
```

### Send Message
```javascript
// Only works after adoption is approved
fetch('/api/messages/send', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    receiverId: 5,
    adoptionRequestId: 12,
    content: 'Hi! When can we arrange pickup?'
  })
});
```

### Get Trending Pets
```javascript
fetch('/api/pets/trending?limit=10')
  .then(res => res.json())
  .then(({ pets }) => console.log(pets));
```

---

## Notes

1. **Scheduler**: Runs automatically when server starts (`scheduleReminders()` in `server.js`)
2. **Message Security**: Users can only message after adoption approval
3. **Webhook Security**: Consider adding signature verification for Aya Pay webhook in production
4. **Refresh Tokens**: 30-day expiry, single-use (rotated on each refresh)
5. **Status History**: Automatically logged on every pet status change
