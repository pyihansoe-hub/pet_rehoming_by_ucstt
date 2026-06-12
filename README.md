***project is still in development and it's just for education purpose and some or all codes of a file was modified by AI***

# Pet Rehoming API v2

Node.js + PostgreSQL (raw SQL) + Chatbot

---

## Setup

```bash
npm install
cp .env.example .env     # fill in all values
npm run db:migrate        # creates all tables + seeds pet types & blog categories
npm run dev
```

---

## Project Structure

```
src/
├── server.js
├── db/pool.js
├── middleware/auth.js          # protect, optionalAuth, adminOnly
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── petTypeController.js
│   ├── petController.js
│   ├── adoptionController.js
│   ├── paymentController.js
│   ├── blogController.js
│   └── chatController.js
├── routes/
│   ├── auth.js
│   ├── user.js
│   ├── petType.js
│   ├── pet.js
│   ├── adoption.js
│   ├── payment.js
│   ├── blog.js
│   └── chat.js
└── services/
    └── ayapay.js
sql/
├── schema.sql
└── migrate.js
```

---

## API Reference

> requires `Authorization: Bearer <token>`
> admin only

---

### Auth

| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/api/auth/register` | `name, email, password, phone?, address?` |
| POST | `/api/auth/login` | `email, password` |

---

### User 

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/user/profile` | — |
| PATCH | `/api/user/profile` | `name?, phone?, address?, avatar_url?` |
| PATCH | `/api/user/change-password` | `currentPassword, newPassword` |

---

### Pet Types

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/pet-types` | public |
| POST | `/api/pet-types` |  admin |
| DELETE | `/api/pet-types/:id` |  admin |

Seeded by default: Dog, Cat, Rabbit, Bird, Fish, Reptile, Hamster, Guinea Pig, Other

---

### Pets

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| GET | `/api/pets` | public | filters: `type, status, fee_type, gender, search, page, limit` |
| GET | `/api/pets/my` | 🔒 | owner's own listings |
| GET | `/api/pets/:id` | public | increments view count |
| POST | `/api/pets` | 🔒 | create listing |
| PATCH | `/api/pets/:id` | 🔒 | owner/admin only |
| DELETE | `/api/pets/:id` | 🔒 | owner/admin only |
| POST | `/api/pets/:id/images` | 🔒 | add image `{ url, is_primary }` |
| DELETE | `/api/pets/:id/images/:imageId` | 🔒 | remove image |
| POST | `/api/pets/:id/adopt` | 🔒 | submit adoption request |

**Create pet body:**
```json
{
  "pet_type_id": 1,
  "name": "Buddy",
  "breed": "Golden Retriever",
  "age_years": 2,
  "age_months": 3,
  "gender": "male",
  "color": "golden",
  "weight_kg": 28.5,
  "description": "Friendly and playful",
  "health_notes": "Vaccinated, neutered",
  "is_vaccinated": true,
  "is_neutered": true,
  "fee_type": "paid",
  "adoption_fee": 50000,
  "location": "Yangon",
  "images": [
    { "url": "https://...", "is_primary": true }
  ]
}
```

---

### Adoption Requests 🔒

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/adoption-requests/mine` | your outgoing requests |
| GET | `/api/adoption-requests/received` | requests on your pets |
| PATCH | `/api/adoption-requests/:id` | owner reviews: `{ status: "approved" \| "rejected" }` |
| PATCH | `/api/adoption-requests/:id/cancel` | requester cancels |

**Free adoption flow:**
1. Requester sends `POST /api/pets/:id/adopt`
2. Owner approves via `PATCH /api/adoption-requests/:id`
3. Pet status → `adopted` automatically

**Paid adoption flow:**
1. Requester sends `POST /api/pets/:id/adopt`
2. Owner approves → response includes `requiresPayment: true`
3. Requester calls `POST /api/payments/initiate` with `adoption_request_id`
4. Redirect user to `paymentUrl`
5. Call `POST /api/payments/:id/verify` → pet status → `adopted` automatically

---

### Payments 🔒

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/payments` | — |
| GET | `/api/payments/:id` | — |
| POST | `/api/payments/initiate` | `amount, currency?, description?, adoption_request_id?` |
| POST | `/api/payments/:id/verify` | — |

---

### Blogs

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| GET | `/api/blogs/categories` | public | — |
| POST | `/api/blogs/categories` | 👑 | `name, description?, pet_type_id?` |
| GET | `/api/blogs` | public | filters: `category, pet_type, status, search, tag, page, limit` |
| GET | `/api/blogs/:slug` | public | increments views |
| POST | `/api/blogs` | 🔒 | create blog |
| PATCH | `/api/blogs/:id` | 🔒 | author/admin |
| DELETE | `/api/blogs/:id` | 🔒 | author/admin |
| GET | `/api/blogs/:id/comments` | public | — |
| POST | `/api/blogs/:id/comments` | 🔒 | `{ content }` |
| DELETE | `/api/blogs/:id/comments/:commentId` | 🔒 | author/admin |

**Create blog body:**
```json
{
  "title": "How to Care for Your New Rabbit",
  "content": "Full markdown content here...",
  "summary": "A beginner's guide to rabbit care",
  "category_id": 3,
  "cover_image_url": "https://...",
  "status": "published",
  "tags": ["rabbit", "beginner", "care"]
}
```

Seeded categories: Dog Care, Cat Care, Rabbit Care, Bird Care, Fish Care, Reptile Care, General, Health & Vet, Training, Nutrition

---

### AI Chatbot (PawBot)

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| POST | `/api/chat` | public | one-shot, no history saved |
| POST | `/api/chat/sessions` | optional | create session |
| GET | `/api/chat/sessions` | 🔒 | list your sessions |
| GET | `/api/chat/sessions/:id/messages` | 🔒 | full history |
| POST | `/api/chat/sessions/:id/messages` | optional | send + receive, history persisted |
| DELETE | `/api/chat/sessions/:id` | 🔒 | delete session |

**One-shot example:**
```json
POST /api/chat
{ "message": "What should I feed a 3-month-old kitten?" }
```

**Session example:**
```json
POST /api/chat/sessions/5/messages
{ "message": "Is my rabbit eating too much?" }
```

PawBot is powered by Claude and knows about pet care, adoption advice, training, nutrition, and platform guidance. Conversation history is saved per session so it remembers context.

---

## Aya Pay Integration


## Notes

- `fee_type: "free"` → `adoption_fee` is forced to 0
- Approving a free adoption auto-rejects all other pending requests for the same pet
- Completed payment for paid adoption auto-marks the pet as adopted and rejects other requests
- Blog slugs are auto-generated from title + timestamp for uniqueness
- Chat sessions can be created without login (anonymous), but listing/deleting requires auth
- Set `role = 'admin'` directly in DB for admin users
