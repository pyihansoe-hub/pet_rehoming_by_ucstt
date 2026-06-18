#  Pet Rehoming API — Quick Reference

**Base URL:** `http://localhost:3000`
**Auth Header:** `Authorization: Bearer <token>`
**File Uploads:** Use `multipart/form-data`. Do **not** set `Content-Type` manually.
**Image URLs:** Combine Base URL + Path (e.g., `http://localhost:3000/uploads/pets/file.jpg`)


---

## 1. Auth & Users

| Method | Endpoint | Body / Notes |
| :--- | :--- | :--- |
| **POST** | `/api/auth/register` | `name, email, password, phone?, address?` |
| **POST** | `/api/auth/login` | `email, password` → Returns `{ token, user }` |
| **POST** | `/api/auth/forgot-password` | `{ email }` (Always returns success for security) |
| **POST** | `/api/auth/reset-password` | `{ token, newPassword }` |
| **GET** | `/api/user/profile` | Get current user info |
| **PATCH** | `/api/user/profile` |  Update `name, phone, address` + file `avatar` |
| **PATCH** | `/api/user/change-password` |  `currentPassword, newPassword` |

---

## 2. Pets

**Seeded Pet Type IDs:** `1=Dog`, `2=Cat`, `3=Rabbit`, `4=Bird`, `5=Fish`, `6=Reptile`, `7=Hamster`, `8=Guinea Pig`, `9=Other`

| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| **GET** | `/api/pets` | Public. Filters: `type, status, fee_type, gender, search, page, limit` |
| **GET** | `/api/pets/trending` | Public. Top viewed pets in last 30 days. |
| **GET** | `/api/pets/cities` | Public. List of cities for filters. |
| **GET** | `/api/pets/my` |  Your listings. |
| **GET** | `/api/pets/:id` | Public. Includes `age_display` and `status_history`. |
| **POST** | `/api/pets` |  See JSON body below. |
| **PATCH** | `/api/pets/:id` |  Update pet details. |
| **DELETE** | `/api/pets/:id` |  Delete listing. |
| **POST** | `/api/pets/:id/images` |  Multipart. Fields: `image` (file), `is_primary` (boolean). |

**Create Pet Body:**
```json
{
  "pet_type_id": 1,
  "name": "Buddy",
  "birth_date": "2022-01-01",
  "is_sure": true, 
  "gender": "male",
  "fee_type": "paid", 
  "adoption_fee": 50000,
  "location": "Yangon",
  "description": "Friendly dog..."
}
```
*Note: `is_sure: false` means age is estimated.*

---

## 3. Adoption Flow

| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| **POST** | `/api/pets/:id/adopt` |  Submit request with optional `message`. Returns `paymentRequired`. |
| **GET** | `/api/adoption-requests/mine` |  Requests you sent. |
| **GET** | `/api/adoption-requests/received` | Requests on your pets. |
| **PATCH** | `/api/adoption-requests/:id` | Owner sets `status`: `approved` or `rejected`. |
| **PATCH** | `/api/adoption-requests/:id/agreement/agree` | Both parties must sign to finalize. |
| **GET** | `/api/adoption-requests/:id/agreement` |  View the adoption contract. |

**Logic:**
*   **Free:** Approve → Pet status becomes `adopted`.
*   **Paid:** Approve → Initiate Payment → Verify → Pet status becomes `adopted`.

---

## 4. Payments

| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| **POST** | `/api/payments/initiate` |  `amount, adoption_request_id`. Returns `paymentUrl`. |
| **POST** | `/api/payments/webhook` | Called by Aya Pay automatically. No auth needed. |
| **GET** | `/api/payments` | Your payment history. |

*Note: In production, the webhook handles verification. For demo, use `/verify` if webhook isn't configured.*

---

## 5. Monitoring & Health

| Method | Endpoint | Body / Notes |
| :--- | :--- | :--- |
| **POST** | `/api/monitoring/followups/:reqId` |  `health_status` (good/fair/poor), `notes`, file `image`. |
| **GET** | `/api/monitoring/followups/:reqId` |  View welfare updates for an adoption. |
| **POST** | `/api/monitoring/pets/:id/health-logs` |  `type` (vaccination/vet_visit), `weight_kg`, `next_due`. |
| **GET** | `/api/monitoring/pets/:id/health-logs` | Public. View medical history. |

---

## 6. Community (Blogs & Chat)

| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| **GET** | `/api/blogs` | Public. Filters: `category, search, tag`. |
| **POST** | `/api/blogs` |  Multipart. `title, content, tags` (JSON string), file `cover`. |
| **POST** | `/api/blogs/:id/like` |  Toggle like. |
| **POST** | `/api/blogs/:id/comments` |  `{ content }`. |
| **POST** | `/api/chat` | Public. One-shot AI question. |
| **POST** | `/api/chat/sessions` |  Start a saved chat session with PawBot. |
| **POST** | `/api/chat/sessions/:id/messages` | Send message in context. |

---

## 7. Messages (Direct Chat)

*Only available after adoption is approved.*

| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| **GET** | `/api/messages/conversations` |  List all your chats. |
| **POST** | `/api/messages/conversations` |  `{ adoption_request_id }` to start/open a chat. |
| **GET** | `/api/messages/conversations/:id` |  Get messages (auto-marks as read). |
| **POST** | `/api/messages/conversations/:id` |  `{ content }` to send a message. |
| **GET** | `/api/messages/unread-count` |  For notification badge. |

---

## 8. Admin Panel 

| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| **GET** | `/api/admin/stats` | Dashboard numbers (Users, Pets, Revenue). |
| **GET** | `/api/admin/users` | List users. Search by email/name. |
| **PATCH** | `/api/admin/users/:id/role` | Change to `admin` or `user`. |
| **PATCH** | `/api/admin/users/:id/suspend` | Suspend a user account. |
| **GET** | `/api/admin/reports` | View pending reports. |
| **PATCH** | `/api/admin/reports/:id/resolve` | `action`: `remove_pet`, `remove_blog`, or `suspend_reporter`. |
| **GET** | `/api/admin/audit-log` | Track admin actions. |

---

## 9. Utilities

| Feature | Endpoint | Notes |
| :--- | :--- | :--- |
| **Favorites** | `GET/POST/DELETE /api/favorites/:petId` |  Save pets for later. |
| **Reports** | `POST /api/reports` |  Report bad content. `reason`: `spam`, `abuse`, etc. |
| **Notifications** | `GET /api/notifications` |  Returns `{ notifications[], unread }`. |
| **Mark Read** | `PATCH /api/notifications/read-all` |  Clear unread badge. |

---

1.  **Images:** Always prepend `http://localhost:3000` to image paths from the API.
2.  **Pagination:** List endpoints return `{ data: [], total: 100, page: 1, limit: 10 }`.
3.  **Errors:** `401` means token expired (redirect to login). `403` means suspended or wrong role.
4.  **Demo Mode:** If Aya Pay isn't configured, use the "Simulate Payment" button in your UI to call the backend verify logic manually.