// ===== THEME =====
function initTheme() {
  var t = localStorage.getItem('theme');
  if (t === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (t !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}
initTheme();

function toggleTheme() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
}

function p(pageName) {
  var inPages = window.location.pathname.indexOf('/pages/') !== -1;
  if (!pageName) return inPages ? '../index.html' : 'index.html';
  return inPages ? pageName : 'pages/' + pageName;
}

// Use this for loading images/assets from the pages/images folder
function imgAsset(filename) {
  var inPages = window.location.pathname.indexOf('/pages/') !== -1;
  return (inPages ? '' : 'pages/') + 'images/' + filename;
}

function getToken() { return localStorage.getItem('token'); }
function getUser()  {
  try { return JSON.parse(localStorage.getItem('user')); } catch(e) { return null; }
}
function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function refreshUser() {
  try {
    var res = await Auth.profile();
    if (res && res.ok && res.data.user) {
      setUser(res.data.user);
      return res.data.user;
    }
  } catch(e) {}
  return getUser();
}

function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

function showToast(msg, type) {
  type = type || 'info';
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  var t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
}

function imgUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return window.location.protocol + '//' + window.location.hostname + ':3000' + path;
}

function handleImgError(img) {
  img.onerror = null;
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var bg = isDark ? '%23334155' : '%23eef1f4';
  var fg = isDark ? '%2394a3b8' : '%239baab8';
  img.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%25' height='100%25' fill='" + bg + "'/><text x='50%25' y='50%25' font-size='16' text-anchor='middle' dominant-baseline='middle' fill='" + fg + "' font-family='sans-serif'>Image Unavailable</text></svg>";
}

function escapeHtml(text) {
  if (!text) return '';
  var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

function petIdOf(pet) {
  return pet && (pet.id || pet._id || pet.pet_id);
}

function petDetailHref(pet) {
  var id = typeof pet === 'object' ? petIdOf(pet) : pet;
  return '/pages/pet-detail?id=' + encodeURIComponent(id);
}

function blogIdOf(blog) {
  return blog && (blog.id || blog._id || blog.blog_id);
}

function blogDetailHref(blog) {
  var id = typeof blog === 'object' ? blogIdOf(blog) : blog;
  return '/pages/blog-detail?id=' + encodeURIComponent(id);
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0, 2);
}

function fmtDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(str) {
  if (!str) return '';
  var diff = Date.now() - new Date(str).getTime();
  var m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  var d = Math.floor(h / 24);
  if (d < 30) return d + 'd ago';
  return fmtDate(str);
}

function calcAge(birthDateStr, isSure) {
  if (!birthDateStr) return '';
  var bd = new Date(birthDateStr);
  if (isNaN(bd.getTime())) return '';
  var now = new Date();
  var totalMonths = (now.getFullYear() - bd.getFullYear()) * 12
                  + (now.getMonth() - bd.getMonth());
  if (now.getDate() < bd.getDate()) totalMonths--;
  if (totalMonths < 0) totalMonths = 0;
  var yrs = Math.floor(totalMonths / 12);
  var mos = totalMonths % 12;
  var str = '';
  if (yrs > 0) str += yrs + (yrs === 1 ? ' yr'  : ' yrs');
  if (mos > 0) str += (str ? ' ' : '') + mos + (mos === 1 ? ' mo' : ' mos');
  if (!str) str = '< 1 mo';
  return str + (isSure ? '' : ' (est.)');
}

function pill(value) {
  if (!value) return '';
  return '<span class="pill pill-' + value + '">' + value.charAt(0).toUpperCase() + value.slice(1) + '</span>';
}

function fmtMoney(n) {
  if (!n) return '0 MMK';
  return Number(n).toLocaleString() + ' MMK';
}

function renderPagination(containerId, total, limit, currentPage, onPageChange) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  var html = '';
  html += '<button class="page-btn"' + (currentPage <= 1 ? ' disabled' : '') + ' data-p="' + (currentPage - 1) + '">&laquo;</button>';
  for (var i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== totalPages) {
      if (i === currentPage - 3 || i === currentPage + 3) html += '<span style="padding:0 4px;color:var(--text-muted)">...</span>';
      continue;
    }
    html += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" data-p="' + i + '">' + i + '</button>';
  }
  html += '<button class="page-btn"' + (currentPage >= totalPages ? ' disabled' : '') + ' data-p="' + (currentPage + 1) + '">&raquo;</button>';
  container.innerHTML = html;
  container.querySelectorAll('.page-btn:not([disabled])').forEach(function(btn) {
    btn.addEventListener('click', function() { onPageChange(parseInt(this.getAttribute('data-p'))); });
  });
}

function initTabs(wrapId) {
  var wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = this.getAttribute('data-tab');
      wrap.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
      wrap.querySelectorAll('.tab-panel').forEach(function(pp) { pp.classList.remove('active'); });
      this.classList.add('active');
      var panel = document.getElementById(target);
      if (panel) panel.classList.add('active');
    });
  });
}

function openModal(id) {
  var m = document.getElementById(id);
  if (m) m.classList.add('open');
}
function closeModal(id) {
  var m = document.getElementById(id);
  if (m) m.classList.remove('open');
}
function initModals() {
  document.querySelectorAll('.modal-close').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var overlay = this.closest('.modal-overlay');
      if (overlay) overlay.classList.remove('open');
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });
}
function renderNavbar() {
  var user = getUser();
  var token = getToken();
  var isLoggedIn = !!token && !!user;
  var isAdmin = user && user.role === 'admin';
  var nav = document.getElementById('navbar');
  if (!nav) return;

  // Determine correct relative path for images
  var imgBase = window.location.pathname.indexOf('/pages/') !== -1 ? '../' : '';

  var bellSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  var sunSvg = '<svg class="theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var moonSvg = '<svg class="theme-icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  var avatarHtml = '';
  if (user.avatar_url) {
    avatarHtml = '<img src="' + imgUrl(user.avatar_url) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.outerHTML=\'' + escapeHtml(initials(user.name)) + '\'">';
  } else {
    avatarHtml = initials(user.name);
  }

    nav.innerHTML =
    '<div class="container">' +
      '<div class="nav-left">' +
        '<a href="' + p() + '" class="nav-logo">' +
          '<img src="' + imgAsset('logo1.jpg') + '" class="nav-logo-img" alt="Site Logo">' +
          '' +
        '</a>' +
        '<nav class="nav-links">' +
          '<a href="' + p() + '">ပင်မစာမျက်နှာ</a>' +
          '<a href="' + p('pets.html') + '">အိမ်မွေးတိရစ္ဆာန်များ</a>' +
          '<a href="' + p('blogs.html') + '">ဆောင်းပါးများ</a>' +
          '<a href="' + p('chat.html') + '">PawBot</a>' +
          '<a href="' + p('messages.html') + '">မက်ဆေ့ခ်ျများ</a>' +
          '<a href="' + p('my-pets.html') + '">ကျွန်ုပ်၏ အိမ်မွေးတိရစ္ဆာန်များ</a>' +
          (isAdmin ? '<a href="' + p('admin.html') + '">အက်ဒမင်</a>' : '') +
        '</nav>' +
      '</div>' +
      '<div class="nav-right">' +
        '<div class="nav-actions">' +
          '<button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">' + sunSvg + moonSvg + '</button>' +
          (isLoggedIn
            ? '<button class="nav-notif-btn" onclick="window.location.href=\'' + p('notifications.html') + '\'" id="nav-notif-btn" aria-label="Notifications">' + bellSvg + '<span class="notif-badge hidden" id="notif-badge">0</span></button>' +
              '<button class="nav-avatar" onclick="window.location.href=\'' + p('profile.html') + '\'" title="' + escapeHtml(user.name) + '">' + avatarHtml + '</button>' +
              '<button class="btn btn-secondary btn-sm btn-text" onclick="logout()">အကောင့်ထွက်ရန်</button>'
            : '<a href="' + p('login.html') + '" class="btn btn-outline btn-sm btn-text">အကောင့်ဝင်ရန်</a>' +
              '<a href="' + p('register.html') + '" class="btn btn-primary btn-sm btn-text">အကောင့်ဖွင့်ရန်</a>'
          ) +
          '<img src="' + imgAsset('logo2.jpeg') + '" class="nav-corner-logo" alt="Brand Logo">' +
        '</div>' +
        '<button class="nav-menu-btn" onclick="toggleMobileMenu()" aria-label="Menu">&#9776;</button>' +
      '</div>' +
    '</div>';
  var mm = document.getElementById('mobile-menu');
  if (!mm) {
    mm = document.createElement('div');
    mm.id = 'mobile-menu';
    mm.className = 'mobile-menu';
    document.body.insertBefore(mm, document.body.firstChild);
  }
  var nav = document.getElementById('navbar');
if (nav && nav.parentNode) {
  nav.parentNode.insertBefore(mm, nav.nextSibling);
} else {
  document.body.appendChild(mm);
}
  mm.innerHTML =
    '<a href="' + p() + '">Home</a>' +
    '<a href="' + p('pets.html') + '">Browse Pets</a>' +
    '<a href="' + p('blogs.html') + '">Blogs</a>' +
    '<a href="' + p('chat.html') + '">PawBot</a>' +
    '<a href="' + p('messages.html') + '">Messages</a>' +
    '<a href="' + p('my-pets.html') + '">My Pets</a>' +
    (isLoggedIn ? '<a href="' + p('profile.html') + '">Profile</a>' : '') +
    (isLoggedIn ? '<a href="' + p('adoption-requests.html') + '">Adoptions</a>' : '') +
    (isLoggedIn ? '<a href="' + p('messages.html') + '">Messages</a>' : '') +
    (isAdmin    ? '<a href="' + p('admin.html') + '">Admin</a>' : '') +
    (isLoggedIn ? '<a href="#" onclick="logout()">Logout</a>' : '<a href="' + p('login.html') + '">Login</a>');

  var path = window.location.pathname;
  nav.querySelectorAll('.nav-links a').forEach(function(a) {
    var href = a.getAttribute('href') || '';
    if (href && path.endsWith(href.replace('../', ''))) a.classList.add('active');
  });

  if (isLoggedIn) pollNotifications();
}

function toggleMobileMenu() {
  var mm = document.getElementById('mobile-menu');
  if (mm) mm.classList.toggle('open');
}

function logout() {
  clearAuth();
  window.location.href = p('login.html');
}

function requireAuth() {
  if (!getToken()) { window.location.href = p('login.html'); return false; }
  return true;
}

function requireAdmin() {
  var user = getUser();
  if (!getToken() || !user || user.role !== 'admin') {
    window.location.href = p();
    return false;
  }
  return true;
}

async function pollNotifications() {
  try {
    var res = await Notifications.list();
    if (res && res.ok) {
      var unread = res.data.unread || 0;
      var badge = document.getElementById('notif-badge');
      if (badge) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.classList.toggle('hidden', unread === 0);
      }
    }
  } catch(e) {}
  setTimeout(pollNotifications, 30000);
}
function renderFooter() {
  var footer = document.getElementById('footer');
  if (!footer) return;
  footer.innerHTML =
    '<div class="container">' +
      '<div class="footer-inner">' +
        '<div>' +
          '<div class="footer-brand"></div>' +
          '<p class="footer-desc">PetNet By UCSTT</p>' +
        '</div>' +
        '<div class="footer-col"><h4>ရှာဖွေရန်</h4>' +
          '<a href="' + p('pets.html') + '">အိမ်မွေးတိရစ္ဆာန်များ ရှာဖွေရန်</a>' +
          '<a href="' + p('blogs.html') + '">ဆောင်းပါးများ</a>' +
          '<a href="' + p('chat.html') + '">PawBot</a>' +
        '</div>' +
        '<div class="footer-col"><h4>အကောင့်</h4>' +
          '<a href="' + p('register.html') + '">အကောင့်ဖွင့်ရန်</a>' +
          '<a href="' + p('login.html') + '">အကောင့်ဝင်ရန်</a>' +
          '<a href="' + p('profile.html') + '">ပရိုဖိုင်</a>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">&copy; ' + new Date().getFullYear() + ' နှင့် စောင့်ကြည့်ရေး စနစ်</div>' +
    '</div>';
}

function petCardHtml(pet) {
  var img = (pet.images && pet.images[0]) ? pet.images[0].url : (pet.primary_image || null);
  var imgHtml = img
    ? '<img class="pet-card-img" src="' + imgUrl(img) + '" alt="' + escapeHtml(pet.name) + '" loading="lazy" decoding="async" onerror="handleImgError(this)">' 
    : '<div class="pet-card-placeholder"></div>';

  var age = calcAge(pet.birth_date, pet.is_sure);
  var meta = [pet.pet_type_name, pet.breed, age, pet.city || pet.location].filter(Boolean).join(' · ');
  var fee = pet.fee_type === 'free'
    ? '<span class="pill pill-free">Free</span>'
    : '<span class="pill pill-paid">' + fmtMoney(pet.adoption_fee) + '</span>';

  return '<div class="pet-card" onclick="window.location.href=\'' + petDetailHref(pet) + '\'" style="cursor:pointer">' +
    imgHtml +
    '<div class="pet-card-body">' +
      '<div class="pet-card-title">' + escapeHtml(pet.name) + '</div>' +
      '<div class="pet-card-meta">' + escapeHtml(meta) + '</div>' +
      '<div class="pet-card-footer">' + fee + pill(pet.status) + '</div>' +
    '</div>' +
  '</div>';
}

function blogCardHtml(blog) {
  var img = blog.cover_image_url;
  var imgHtml = img
    ? '<img class="blog-card-img" src="' + imgUrl(img) + '" alt="' + escapeHtml(blog.title) + '" loading="lazy" decoding="async" onerror="handleImgError(this)">' 
    : '<div class="blog-card-placeholder"></div>';

  return '<div class="blog-card" onclick="window.location.href=\'' + blogDetailHref(blog) + '\'" style="cursor:pointer">' +
    imgHtml +
    '<div class="blog-card-body">' +
      '<div class="blog-card-cat">' + escapeHtml(blog.category_name || 'General') + '</div>' +
      '<div class="blog-card-title">' + escapeHtml(blog.title) + '</div>' +
      '<div class="blog-card-summary">' + escapeHtml(blog.summary || '') + '</div>' +
      '<div class="blog-card-footer">' +
        '<span>' + escapeHtml(blog.author_name || '') + '</span>' +
        '<span>' + timeAgo(blog.published_at || blog.created_at) + '</span>' +
      '</div>' +
    '</div>' +
  '</div>';
}

document.addEventListener('DOMContentLoaded', function() {
  renderNavbar();
  renderFooter();
  initModals();
});