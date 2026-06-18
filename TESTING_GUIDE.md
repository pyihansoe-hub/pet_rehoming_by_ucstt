# Testing Guide for Pet Rehoming API

This guide explains how to test all the newly implemented features.

## Prerequisites

1. **Setup Environment Variables**
   Create a `.env` file in the root directory:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pet_rehoming
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Email (for password reset & reminders)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=noreply@petrehoming.com

# Aya Pay (for payment testing)
AYAPAY_MERCHANT_ID=your_merchant_id
AYAPAY_SECRET_KEY=your_secret_key

# Server
PORT=3000
NODE_ENV=development
```

2. **Install Dependencies**
```bash
npm install
```

3. **Run Database Migrations**
```bash
npm run db:migrate
```

4. **Start the Server**
```bash
npm run dev
```

---

## Testing Features with cURL/Postman

### 1. Password Reset via Email

**Step 1: Register a user**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "adopter"
  }'
```

**Step 2: Request password reset**
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```
✅ Expected: Email sent with reset link containing token

**Step 3: Reset password**
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "TOKEN_FROM_EMAIL",
    "newPassword": "newpassword123"
  }'
```
✅ Expected: Password updated successfully

---

### 2. Search Pets by Location (City)

**Get pets by city:**
```bash
curl "http://localhost:3000/api/pets/search/location?city=Yangon"
```
✅ Expected: Array of pets located in Yangon

**Available cities:** Yangon, Mandalay, Naypyidaw, Mawlamyine, Bago, Pathein, Monywa, Meiktila, Taunggyi, Myitkyina, Sittwe, Pyay, Lashio, Dawei, Hpa-An, Magway

---

### 3. Adoption Contract/Agreement

**Step 1: Create adoption request** (requires authentication)
```bash
curl -X POST http://localhost:3000/api/adoption-requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "petId": 1,
    "message": "I would love to adopt this pet"
  }'
```

**Step 2: Approve request** (owner or admin)
```bash
curl -X PATCH http://localhost:3000/api/adoption-requests/1/approve \
  -H "Authorization: Bearer OWNER_TOKEN"
```

**Step 3: Sign contract** (adopter)
```bash
curl -X POST http://localhost:3000/api/adoption-requests/1/agree-contract \
  -H "Authorization: Bearer ADOPTER_TOKEN" \
  -d '{}'
```
✅ Expected: Contract signed with timestamp and IP address

**Step 4: View contract**
```bash
curl http://localhost:3000/api/adoption-requests/1/contract \
  -H "Authorization: Bearer TOKEN"
```
✅ Expected: Contract text with signatures from both parties

---

### 4. Pet Views Tracking - Trending Pets

**Get trending pets (last 7 days):**
```bash
curl "http://localhost:3000/api/pets/trending?limit=10"
```
✅ Expected: Array of pets sorted by view count (highest first)

**Increment pet views** (automatically called when viewing pet details):
```bash
curl -X POST http://localhost:3000/api/pets/1/view
```

---

### 5. Direct Messaging

**Prerequisites:** Must have an approved adoption request

**Send a message:**
```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "receiverId": 2,
    "content": "Hello! When can we arrange the pickup?",
    "adoptionRequestId": 1
  }'
```
✅ Expected: Message created with timestamp

**Get all conversations:**
```bash
curl http://localhost:3000/api/messages/conversations \
  -H "Authorization: Bearer TOKEN"
```
✅ Expected: List of conversations with last message and unread count

**Get messages with specific user:**
```bash
curl http://localhost:3000/api/messages/2 \
  -H "Authorization: Bearer TOKEN"
```
✅ Expected: Array of messages between users

**Mark message as read:**
```bash
curl -X PATCH http://localhost:3000/api/messages/1/read \
  -H "Authorization: Bearer TOKEN"
```

**Get unread count:**
```bash
curl http://localhost:3000/api/messages/unread/count \
  -H "Authorization: Bearer TOKEN"
```
✅ Expected: `{ "count": 3 }`

---

### 6. Aya Pay Webhook

**Simulate Aya Pay webhook callback:**
```bash
curl -X POST http://localhost:3000/api/payments/webhook/aya \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "TXN123456",
    "status": "SUCCESS",
    "amount": 50000,
    "adoption_request_id": 1
  }'
```
✅ Expected: Payment verified, pet marked as adopted, reminders created

---

### 7. Refresh Tokens (Silent Re-login)

**Login to get tokens:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```
✅ Expected: Response includes `accessToken` and `refreshToken`

**Refresh access token:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```
✅ Expected: New `accessToken` and `refreshToken` (old refresh token invalidated)

**Logout:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer TOKEN"
```

---

### 8. Follow-up Reminders

**View upcoming follow-ups:**
```bash
curl http://localhost:3000/api/monitoring/followups/my-due \
  -H "Authorization: Bearer TOKEN"
```
✅ Expected: List of upcoming reminders (1_week, 1_month, 3_months)

**Submit follow-up:**
```bash
curl -X POST http://localhost:3000/api/monitoring/followups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "adoptionRequestId": 1,
    "notes": "Pet is doing great!",
    "weight": 15.5,
    "health_status": "excellent"
  }'
```

**Automated emails:** Run daily at 9 AM via cron job (check server logs)

---

### 9. Health Log Reminders

**Add health log with next_due date:**
```bash
curl -X POST http://localhost:3000/api/monitoring/pets/1/health-logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "log_type": "vaccination",
    "description": "Annual vaccination",
    "next_due": "2025-02-15"
  }'
```

**Get health logs:**
```bash
curl http://localhost:3000/api/monitoring/pets/1/health-logs \
  -H "Authorization: Bearer TOKEN"
```

**Automated reminders:** Sent 3 days before `next_due` date via cron job

---

### 10. Pet Status History

**Get status change history:**
```bash
curl http://localhost:3000/api/pets/status-history/1
```
✅ Expected: Array of status changes with timestamps
```json
[
  {
    "old_status": "available",
    "new_status": "pending",
    "changed_at": "2024-01-10T10:00:00Z",
    "changed_by": "User Name"
  },
  {
    "old_status": "pending",
    "new_status": "adopted",
    "changed_at": "2024-01-15T14:30:00Z",
    "changed_by": "Admin Name"
  }
]
```

---

### 11. Sandboxed Payment Simulation

**Initiate payment:**
```bash
curl -X POST http://localhost:3000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "adoptionRequestId": 1,
    "amount": 50000
  }'
```

**Simulate payment success:**
```bash
curl -X POST http://localhost:3000/api/payments/simulate/1 \
  -H "Authorization: Bearer TOKEN"
```
✅ Expected: Payment marked as completed, pet adopted, reminders created

**Frontend URL:** Navigate to `/payment/simulate/1` for UI-based simulation

---

### 12. Welfare Timeline

**Get pet's complete welfare timeline:**
```bash
curl http://localhost:3000/api/pets/1/timeline
```
✅ Expected: Chronological array of events (health logs, status changes, vet visits)
```json
[
  {
    "type": "status_change",
    "event_date": "2024-01-10",
    "details": "Status changed from available to pending"
  },
  {
    "type": "health_log",
    "event_date": "2024-01-12",
    "details": "Vaccination - Annual shot"
  },
  {
    "type": "adoption",
    "event_date": "2024-01-15",
    "details": "Adopted by John Doe"
  }
]
```

---

### 13. Admin Audit Log Viewer

**Get audit logs (admin only):**
```bash
curl "http://localhost:3000/api/admin/audit-logs?page=1&limit=20&action=USER_SUSPENDED" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```
✅ Expected: Paginated list of admin actions
```json
{
  "logs": [
    {
      "action": "USER_SUSPENDED",
      "actor_name": "Admin User",
      "target_name": "Violator User",
      "timestamp": "2024-01-15T10:00:00Z",
      "details": "Reason: Spamming"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

---

## Automated Testing

### Run Unit Tests
```bash
npm test
```

### Test Specific Endpoint
```bash
npm test -- -t "should return trending pets"
```

---

## Frontend Integration Notes

### Contact Reveal Logic
Phone numbers and addresses are hidden until ALL conditions are met:
1. ✅ Adoption status = 'completed'
2. ✅ Contract signed by both parties
3. ✅ Payment verified

**API Response Example:**
```json
{
  "id": 1,
  "name": "Fluffy",
  "contact_visible": false,  // Hide contact info
  "phone": null,             // Null until revealed
  "address": null            // Null until revealed
}
```

### Digital Adoption Agreement UI
Display terms before signing:
```javascript
// GET /api/adoption-requests/:id/contract
{
  "contract_text": "1. The adopter agrees to provide proper care...\n2. No resale or abandonment...\n...",
  "signed_by_adopter": false,
  "signed_by_owner": false,
  "signed_at": null
}
```

### Notification Badges
Poll for unread count:
```javascript
// GET /api/messages/unread/count
setInterval(() => {
  fetch('/api/messages/unread/count', {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(data => updateBadge(data.count));
}, 30000); // Every 30 seconds
```

---

## Troubleshooting

### Emails Not Sending
- Check SMTP credentials in `.env`
- For Gmail, use App Password (not regular password)
- Check server logs for Nodemailer errors

### Database Connection Errors
- Ensure PostgreSQL is running
- Verify database exists: `createdb pet_rehoming`
- Run migrations: `npm run db:migrate`

### Token Expiration Issues
- Access tokens expire in 15 minutes
- Use refresh token endpoint before expiry
- Check JWT_SECRET matches in `.env`

### Cron Jobs Not Running
- Check server console for scheduler startup message
- Verify node-cron is installed
- Look for daily reminder logs at 9 AM

---

## API Documentation

Full API documentation is available in `README.md` with all endpoints, request/response formats, and authentication requirements.
