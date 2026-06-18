cat > README.md << 'EOF'
# Pet Rehoming & Monitoring System - Backend API

## Overview
This document serves as the comprehensive API reference for the Pet Rehoming & Monitoring System backend. It details all available endpoints, request/response formats, and frontend integration guides.

## Base URL
- **Development:** `http://localhost:3000/api`
- **Production:** `https://your-domain.com/api`

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
`Authorization: Bearer <access_token>`

---

# Frontend API Endpoints Reference

## Authentication

| Endpoint | Method | Frontend Use |
|----------|--------|--------------|
| `/api/auth/register` | POST | Registration form → submit name, email, password |
| `/api/auth/login` | POST | Login form → submit email, password → store token |
| `/api/auth/forgot-password` | POST | Forgot password form → submit email → shows "Check your email" |
| `/api/auth/reset-password` | POST | Reset password page → submit new password with token from URL |
| `/api/auth/refresh-token` | POST | Auto-called when API returns 401 → silent re-login |

---

## User

| Endpoint | Method | Frontend Use |
|----------|--------|--------------|
| `/api/user/profile` | GET | Profile page → display user info |
| `/api/user/profile` | PATCH | Edit profile form → update name, phone, address, avatar |
| `/api/user/change-password` | PATCH | Change password form → submit current + new password |

---

## Pets

| Endpoint | Method | Frontend Use |
|----------|--------|--------------|
| `/api/pets` | GET | Homepage/List page → show pets with filters (type, city, status, fee_type, gender, search) |
| `/api/pets/trending` | GET | Homepage → show "Trending" section sorted by views in last 7 days |
| `/api/pets/:id` | GET | Pet detail page → show all pet info, images, owner details |
| `/api/pets/status-history/:id` | GET | Admin panel → timeline of status changes |
| `/api/pets/my` | GET | Dashboard → show user's own pet listings |
| `/api/pets` | POST | Create pet form → submit pet details |
| `/api/pets/:id` | PATCH | Edit pet form → update pet details |
| `/api/pets/:id` | DELETE | Delete button → remove pet listing |
| `/api/pets/:id/images` | POST | Upload images → file input with preview |
| `/api/pets/:id/images/:imageId` | DELETE | Remove image button → delete specific image |

---

## Adoption

| Endpoint | Method | Frontend Use |
|----------|--------|--------------|
| `/api/pets/:id/adopt` | POST | "Adopt" button → submit adoption request with optional message |
| `/api/adoption-requests/mine` | GET | "My Requests" page → show requests user sent |
| `/api/adoption-requests/received` | GET | "Received Requests" page → show requests on user's pets with Approve/Reject buttons |
| `/api/adoption-requests/:id` | PATCH | Approve/Reject button → update status |
| `/api/adoption-requests/:id/cancel` | PATCH | Cancel button → withdraw request |
| `/api/adoption-requests/:id/agree-contract` | POST | "Agree to Contract" button → sign digital agreement |
| `/api/adoption-requests/:id/contract` | GET | Contract preview modal → show terms before signing |

---

## Messages

| Endpoint | Method | Frontend Use |
|----------|--------|--------------|
| `/api/messages/send` | POST | Chat input → send message (only after adoption approved) |
| `/api/messages/conversations` | GET | Messages list → show all conversations with latest message preview |
| `/api/messages/:userId` | GET | Chat view → show full conversation with specific user |
| `/api/messages/:id/read` | PATCH | Auto-called when user opens chat → mark messages as read |
| `/api/messages/unread/count` | GET | Header badge → show unread message count |

---

## Payments

| Endpoint | Method | Frontend Use |
|----------|--------|--------------|
| `/api/payments/initiate` | POST | Redirect to payment page → returns paymentUrl |
| `/api/payments/:id/verify` | POST | After payment → call to confirm status |
| `/api/payments` | GET | Payment history → list all user payments |
| `/api/payments/:id` | GET | Payment detail → show specific payment info |

---

## Monitoring

| Endpoint | Method | Frontend Use |
|----------|--------|--------------|
| `/api/monitoring/followups/:adoptionRequestId` | POST | Follow-up form → submit health status, weight, notes, image |
| `/api/monitoring/followups/:adoptionRequestId` | GET | Follow-up timeline → show all submitted follow-ups |
| `/api/monitoring/pets/:petId/health-logs` | POST | Health log form → add vaccination, vet visit, deworming, weight |
| `/api/monitoring/pets/:petId/health-logs` | GET | Health timeline → show all logs with dates |
| `/api/monitoring/pets/:petId/health-logs/:logId` | DELETE | Delete log button → remove entry |

---

## Favorites

| Endpoint | Method | Frontend Use |
|----------|--------|--------------|
| `/api/favorites` | GET | Favorites page → show saved pets |
| `/api/favorites/:petId` | POST | Heart button → add to favorites |
| `/api/favorites/:petId` | DELETE | Heart button → remove from favorites |

---

## Notifications

| Endpoint | Method | Frontend Use |
|----------|--------|--------------|
| `/api/notifications` | GET | Notification dropdown → list all notifications with unread count |
| `/api/notifications/read-all` | PATCH | "Mark all read" button |
| `/api/notifications/:id/read` | PATCH | Auto-called when viewing notification |
| `/api/notifications/:id` | DELETE | Dismiss notification button |

---

## Admin

| Endpoint | Method | Frontend Use |
|----------|--------|--------------|
| `/api/admin/stats` | GET | Dashboard → show total users, pets, adoptions, reports |
| `/api/admin/users` | GET | User management → list with search, role, suspension filters |
| `/api/admin/users/:id` | GET | User detail → show full user info |
| `/api/admin/users/:id/role` | PATCH | Role dropdown → change user to admin/user |
| `/api/admin/users/:id/suspend` | PATCH | Suspend button → block user login with reason |
| `/api/admin/users/:id/unsuspend` | PATCH | Unsuspend button → restore access |
| `/api/admin/users/:id` | DELETE | Delete user button → permanent removal |
| `/api/admin/pets` | GET | Pet management → list all pets |
| `/api/admin/pets/:id/status` | PATCH | Status dropdown → change available/pending/adopted/withdrawn |
| `/api/admin/pets/:id` | DELETE | Delete pet button → remove listing |
| `/api/admin/adoptions` | GET | Adoption management → list all requests |
| `/api/admin/adoptions/:id/close` | PATCH | Close adoption button → mark completed with reason |
| `/api/admin/followups` | GET | Follow-up monitoring → list with health_status filter |
| `/api/admin/health-logs` | GET | Health logs monitoring → list with type filter |
| `/api/admin/reports` | GET | Report management → list all reports |
| `/api/admin/reports/:id/resolve` | PATCH | Resolve report → set reviewed/dismissed with action |
| `/api/admin/audit-log` | GET | Audit log → show admin actions with filters |

---

## Frontend UI Components Mapping

| UI Component | API Endpoint |
|--------------|--------------|
| Pet cards on homepage | GET `/api/pets` with filters |
| Trending section | GET `/api/pets/trending` |
| Pet detail page | GET `/api/pets/:id` |
| Pet status timeline | GET `/api/pets/status-history/:id` |
| Create/Edit pet form | POST/PATCH `/api/pets` |
| Image upload | POST `/api/pets/:id/images` |
| Adoption request button | POST `/api/pets/:id/adopt` |
| My requests list | GET `/api/adoption-requests/mine` |
| Received requests list | GET `/api/adoption-requests/received` |
| Approve/Reject buttons | PATCH `/api/adoption-requests/:id` |
| Contract modal | GET `/api/adoption-requests/:id/contract` + POST `/api/adoption-requests/:id/agree-contract` |
| Chat interface | GET `/api/messages/:userId` + POST `/api/messages/send` |
| Messages list | GET `/api/messages/conversations` |
| Unread badge | GET `/api/messages/unread/count` |
| Payment button | POST `/api/payments/initiate` |
| Payment verification | POST `/api/payments/:id/verify` |
| Follow-up form | POST `/api/monitoring/followups/:adoptionRequestId` |
| Follow-up timeline | GET `/api/monitoring/followups/:adoptionRequestId` |
| Health log form | POST `/api/monitoring/pets/:petId/health-logs` |
| Health timeline | GET `/api/monitoring/pets/:petId/health-logs` |
| Notification bell | GET `/api/notifications` |
| Admin dashboard | GET `/api/admin/stats` |
| Admin user table | GET `/api/admin/users` + PATCH `/api/admin/users/:id/suspend` |
| Admin pet table | GET `/api/admin/pets` + PATCH `/api/admin/pets/:id/status` |
| Admin reports | GET `/api/admin/reports` + PATCH `/api/admin/reports/:id/resolve` |
| Admin audit log | GET `/api/admin/audit-log` |

---

## Error Handling
All endpoints return standard HTTP status codes:
- `200 OK`: Success
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error response format:
```json
{
  "success": false,
  "message": "Error description here"
}