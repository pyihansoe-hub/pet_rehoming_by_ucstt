
# Pet Rehoming & Monitoring System — API Reference

**Base URL:** `http://localhost:3000`  
**Auth:** `Authorization: Bearer <token>`  
**Uploads:** `multipart/form-data` — never set Content-Type manually  
**Images:** prefix URL → `http://localhost:3000/uploads/pets/file.jpg`  


---

## Auth

| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/api/auth/register` | `name, email, password, phone?, address?` |
| POST | `/api/auth/login` | `email, password` |

Both return `{ token, user }`.

---

## User 

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/user/profile` | — |
| PATCH | `/api/user/profile` | `name?, phone?, address?` + file `avatar` (multipart) |
| PATCH | `/api/user/change-password` | `currentPassword, newPassword` |

---

## Pet Types

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/pet-types` | Public |

Seeded: `1=Dog, 2=Cat, 3=Rabbit, 4=Bird, 5=Fish, 6=Reptile, 7=Hamster, 8=Guinea Pig, 9=Other`

---

## Pets

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/pets` | Public · query: `type, status, fee_type, gender, search, page, limit` |
| GET | `/api/pets/my` | 🔒 Your own listings |
| GET | `/api/pets/:id` | Public |
| POST | `/api/pets` | 🔒 JSON |
| PATCH | `/api/pets/:id` | 🔒 Any pet fields |
| DELETE | `/api/pets/:id` | 🔒 |
| POST | `/api/pets/:id/images` | 🔒 multipart · file `image`, field `is_primary` |
| DELETE | `/api/pets/:id/images/:imageId` | 🔒 |

**Create/update body:**
```json
{
  "pet_type_id": 1,
  "name": "Buddy",
  "breed": "Labrador",
  "birth_date": "01-01-2022",
  "is_sure": true,
  "gender": "male",
  "color": "black",
  "weight_kg": 25,
  "description": "...",
  "health_notes": "...",
  "is_vaccinated": true,
  "is_neutered": false,
  "fee_type": "paid",
  "adoption_fee": 50000,
  "location": "Yangon"
}
```
`fee_type`: `free` or `paid`. If `free`, `adoption_fee` is ignored.  
`birth_date`: format `DD-MM-YYYY`.  
`is_sure`: `true` if exact birthday is known, `false` if estimated.

---

## Adoption

| Method | Endpoint | Body | Notes |
|--------|----------|------|-------|
| POST | `/api/pets/:id/adopt` | `message?` | 🔒 Returns `paymentRequired` flag |
| GET | `/api/adoption-requests/mine` | — | 🔒 Requests you sent |
| GET | `/api/adoption-requests/received` | — | 🔒 Requests on your pets |
| PATCH | `/api/adoption-requests/:id` | `{ status: "approved" or "rejected" }` | 🔒 Owner reviews |
| PATCH | `/api/adoption-requests/:id/cancel` | — | 🔒 Requester cancels |

Free adoption → approve → pet marked adopted automatically.  
Paid adoption → approve → requester pays → verify → pet marked adopted automatically.

---

## Payments 🔒

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/payments` | — |
| GET | `/api/payments/:id` | — |
| POST | `/api/payments/initiate` | `amount, currency?, description?, adoption_request_id?` |
| POST | `/api/payments/:id/verify` | — |

`initiate` returns `paymentUrl` — redirect user there. Call `verify` after user returns.

---

## Favorites 🔒

| Method | Endpoint |
|--------|----------|
| GET | `/api/favorites` |
| POST | `/api/favorites/:petId` |
| DELETE | `/api/favorites/:petId` |

---

## Monitoring 🔒

Private — only owner, adopter, or admin can access.

| Method | Endpoint | Body | Notes |
|--------|----------|------|-------|
| POST | `/api/monitoring/followups/:adoptionRequestId` | `health_status, weight_kg?, notes?` + file `image?` | multipart |
| GET | `/api/monitoring/followups/:adoptionRequestId` | — | — |
| POST | `/api/monitoring/pets/:petId/health-logs` | `type, description?, vet_name?, weight_kg?, next_due?` | Owner only |
| GET | `/api/monitoring/pets/:petId/health-logs` | — | Owner only |
| DELETE | `/api/monitoring/pets/:petId/health-logs/:logId` | — | Owner only |

`health_status`: `good / fair / poor`  
`type`: `vaccination / vet_visit / deworming / weight / other`  
`next_due`: date `YYYY-MM-DD`

---

## Blogs

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/blogs/categories` | Public |
| GET | `/api/blogs` | Public · query: `category, pet_type, search, tag, status, page, limit` |
| GET | `/api/blogs/:slug` | Public |
| POST | `/api/blogs` | 🔒 multipart · `title, content, summary?, category_id?, status?, tags?` + file `cover?` |
| PATCH | `/api/blogs/:id` | 🔒 Same fields |
| DELETE | `/api/blogs/:id` | 🔒 |
| POST | `/api/blogs/:id/like` | 🔒 Toggle · returns `{ liked: true/false }` |
| GET | `/api/blogs/:id/comments` | Public |
| POST | `/api/blogs/:id/comments` | 🔒 `{ content }` |
| DELETE | `/api/blogs/:id/comments/:commentId` | 🔒 |

Send `tags` as JSON string in multipart: `tags: '["dog","care"]'`  
`status`: `draft / published / archived`

---

## Reports 🔒

| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/api/reports` | `pet_id? or blog_id?, reason, details?` |

`reason`: `spam / abuse / misleading / inappropriate / animal_welfare / other`  
Provide either `pet_id` or `blog_id`, not both.

---

## Notifications 🔒

| Method | Endpoint |
|--------|----------|
| GET | `/api/notifications` |
| PATCH | `/api/notifications/read-all` |
| PATCH | `/api/notifications/:id/read` |
| DELETE | `/api/notifications/:id` |

Response includes `unread` count — use for bell badge.

---

## Chat (PawBot)

| Method | Endpoint | Body | Notes |
|--------|----------|------|-------|
| POST | `/api/chat` | `{ message }` | Public · no history |
| POST | `/api/chat/sessions` | — | Create session |
| GET | `/api/chat/sessions` | — | 🔒 |
| GET | `/api/chat/sessions/:id/messages` | — | 🔒 |
| POST | `/api/chat/sessions/:id/messages` | `{ message }` | History saved |
| DELETE | `/api/chat/sessions/:id` | — | 🔒 |

---

## Admin 

### Dashboard
| Method | Endpoint |
|--------|----------|
| GET | `/api/admin/stats` |

### Users
| Method | Endpoint | Body | Notes |
|--------|----------|------|-------|
| GET | `/api/admin/users` | — | query: `search, role, suspended, page, limit` |
| GET | `/api/admin/users/:id` | — | — |
| PATCH | `/api/admin/users/:id/role` | `{ role }` | `user` or `admin` |
| PATCH | `/api/admin/users/:id/suspend` | `{ reason? }` | Blocks login immediately |
| PATCH | `/api/admin/users/:id/unsuspend` | — | — |
| DELETE | `/api/admin/users/:id` | — | Permanent |

### Pets
| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/admin/pets` | — |
| PATCH | `/api/admin/pets/:id/status` | `{ status }` |
| DELETE | `/api/admin/pets/:id` | — |

`status`: `available / pending / adopted / withdrawn`

### Blogs
| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/admin/blogs` | — |
| PATCH | `/api/admin/blogs/:id/status` | `{ status }` |
| DELETE | `/api/admin/blogs/:id` | — |

### Adoptions
| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/admin/adoptions` | — |
| PATCH | `/api/admin/adoptions/:id/close` | `{ reason? }` |

### Monitoring (platform-wide)
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/admin/followups` | query: `health_status, page, limit` |
| GET | `/api/admin/health-logs` | query: `type, page, limit` |

### Reports
| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/admin/reports` | — |
| PATCH | `/api/admin/reports/:id/resolve` | `{ status, action? }` |

`status`: `reviewed / dismissed`  
`action`: `remove_pet / remove_blog / suspend_reporter`

### Audit Log
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/admin/audit-log` | query: `admin_id, action, target_type, page, limit` |

---

## Notes

**Token storage:** save in `localStorage`, send on every 🔒 request.

**Suspended account:** returns `403 { message: "Your account has been suspended.", reason: "..." }` — clear token and show message.

**Pagination:** all list endpoints return `{ data[], total, page, limit }`.

**Admin setup:** set `ADMIN_EMAIL` + `ADMIN_PASSWORD` in `.env` before first run. Seeds once and locks. Login via `/api/auth/login` normally.

**Image display:**
```js
const API = 'http://localhost:3000';
`${API}${pet.images[0]?.url}`
`${API}${user.avatar_url}`
