# PetLink Frontend

A modern, responsive frontend for the Pet Rehoming & Monitoring System.

## Quick Start

### 1. Setup Backend First
Make sure the backend is running on `http://localhost:3000`:

```bash
cd /workspace
npm install
npm run db:migrate
npm start
```

### 2. Open Frontend
Simply open `frontend/index.html` in your browser, or use a local server:

```bash
# Using Python
cd frontend
python -m http.server 8080

# Then visit http://localhost:8080
```

## File Structure

```
frontend/
├── index.html              # Homepage
├── css/
│   └── style.css          # Main stylesheet
├── js/
│   ├── api.js             # API client (all endpoints)
│   ├── auth.js            # Authentication utilities
│   ├── app.js             # Homepage logic
│   ├── pets.js            # Pets listing page
│   ├── pet-detail.js      # Pet detail page
│   ├── dashboard.js       # User dashboard
│   ├── messages.js        # Messaging system
│   ├── admin.js           # Admin panel
│   └── blog.js            # Blog page
└── pages/
    ├── login.html         # Login page
    ├── register.html      # Registration page
    ├── pets.html          # Browse pets
    ├── pet-detail.html    # Pet details
    ├── dashboard.html     # User dashboard
    ├── messages.html      # Messages/Chat
    ├── admin.html         # Admin panel
    ├── blog.html          # Blog listing
    ├── favorites.html     # (Coming soon)
    └── notifications.html # (Coming soon)
```

## Features

### Public Pages
- **Homepage**: Trending pets, pet types, recent arrivals
- **Browse Pets**: Filter by type, city, status, fee type, gender, search
- **Pet Detail**: Full pet information, images, owner contact, adoption request
- **Blog**: Pet care articles and tips

### User Features (Login Required)
- **Dashboard**: Overview stats, manage pets, adoptions, favorites, profile
- **Messages**: Chat with other users
- **Favorites**: Save favorite pets
- **Adoption Requests**: Send/receive/manage requests

### Admin Features (Admin Only)
- **User Management**: View, suspend, change roles, delete users
- **Pet Management**: View all pets, update status, delete
- **Adoption Management**: Monitor all adoptions
- **Reports**: Review and resolve reported content
- **Audit Log**: Track admin actions

## API Integration

The frontend connects to the backend API at `http://localhost:3000/api`.

To change the API URL, edit `js/api.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000/api'; // Change this
```

## Authentication

Authentication uses JWT tokens stored in localStorage:
- Token: `localStorage.getItem('token')`
- User: `localStorage.getItem('user')`

## Styling

The CSS uses a clean, modern design with:
- Responsive grid layouts
- Mobile-friendly navigation
- Card-based UI components
- Status badges and indicators
- Modal dialogs

Customize colors and styles in `css/style.css`.

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

Modern browsers with ES6+ support required.

## Development Tips

1. **Check Console**: Open browser DevTools to see API calls and errors
2. **Network Tab**: Monitor API requests in the Network tab
3. **LocalStorage**: View stored tokens in Application > Local Storage
4. **Hot Reload**: Use a live server extension for auto-refresh

## Missing Pages

Some pages referenced in navigation can be added similarly:
- `favorites.html` - Similar to pets.html but shows favorited pets
- `notifications.html` - Show user notifications
- `blog-detail.html` - Full blog post view
- `forgot-password.html` - Password reset flow
- `about.html` - About us page

Copy existing page structures and customize as needed.

## Troubleshooting

**"Failed to load" errors:**
- Check if backend is running
- Verify API URL in `api.js`
- Check browser console for CORS errors

**Login not working:**
- Clear localStorage
- Check network tab for API response
- Verify database has users

**Styles not loading:**
- Check file paths (relative from each page)
- Ensure CSS file exists

## License

Part of the Pet Rehoming & Monitoring System project.
