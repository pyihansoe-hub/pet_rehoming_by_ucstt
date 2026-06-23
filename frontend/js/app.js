// ===== TOAST =====
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

// ===== IMAGE URL =====
function imgUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return 'http://localhost:3000' + path;
}

// ===== INITIALS AVATAR =====
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
}

// ===== FORMAT DATE =====
function fmtDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

function timeAgo(str) {
  if (!str) return '';
  var diff = Date.now() - new Date(str).getTime();
  var m = Math.floor(diff/60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  var h = Math.floor(m/60);
  if (h < 24) return h + 'h ago';
  var d = Math.floor(h/24);
  if (d < 30) return d + 'd ago';
  return fmtDate(str);
}

// ===== AGE CALCULATOR =====
// birth_date from API comes as ISO string or DD-MM-YYYY
// is_sure: true = exact birthday, false = estimated
function calcAge(birthDate, isSure) {
  if (!birthDate) return 'Age unknown';

  var bd;
  // handle DD-MM-YYYY format from API
  if (typeof birthDate === 'string' && birthDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
    var parts = birthDate.split('-');
    bd = new Date(parts[2], parts[1] - 1, parts[0]);
  } else {
    bd = new Date(birthDate);
  }

  if (isNaN(bd.getTime())) return 'Age unknown';

  var now   = new Date();
  var years = now.getFullYear() - bd.getFullYear();
  var months= now.getMonth()    - bd.getMonth();
  var days  = now.getDate()     - bd.getDate();

  // adjust if day hasn't come yet this month
  if (days < 0) { months--; }
  // adjust if month hasn't come yet this year
  if (months < 0) { years--; months += 12; }

  var label = '';

  if (years >= 1) {
    label = years + ' year' + (years !== 1 ? 's' : '');
    if (months > 0) label += ' ' + months + ' month' + (months !== 1 ? 's' : '');
  } else if (months >= 1) {
    label = months + ' month' + (months !== 1 ? 's' : '');
  } else {
    // under 1 month — show weeks
    var diffMs   = now - bd;
    var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    var weeks    = Math.floor(diffDays / 7);
    if (weeks >= 1) {
      label = weeks + ' week' + (weeks !== 1 ? 's' : '');
    } else {
      label = diffDays + ' day' + (diffDays !== 1 ? 's' : '');
    }
  }

  if (isSure === false || isSure === 'false' || isSure === 0) {
    label += ' (est.)';
  }

  return label;
}

// ===== PILL HTML =====
function pill(value) {
  if (!value) return '';
  return '<span class="pill pill-' + value + '">' + value.charAt(0).toUpperCase() + value.slice(1) + '</span>';
}

// ===== FORMAT CURRENCY =====
function fmtMoney(n) {
  if (!n) return '0 MMK';
  return Number(n).toLocaleString() + ' MMK';
}

// ===== PAGINATION =====
function renderPagination(containerId, total, limit, currentPage, onPageChange) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  var html = '';
  html += '<button class="page-btn" ' + (currentPage <= 1 ? 'disabled' : '') + ' data-p="' + (currentPage-1) + '">&laquo;</button>';
  for (var i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== totalPages) {
      if (i === currentPage - 3 || i === currentPage + 3) html += '<span style="padding:0 4px;color:#9baab8">...</span>';
      continue;
    }
    html += '<button class="page-btn ' + (i === currentPage ? 'active' : '') + '" data-p="' + i + '">' + i + '</button>';
  }
  html += '<button class="page-btn" ' + (currentPage >= totalPages ? 'disabled' : '') + ' data-p="' + (currentPage+1) + '">&raquo;</button>';
  container.innerHTML = html;

  container.querySelectorAll('.page-btn:not([disabled])').forEach(function(btn) {
    btn.addEventListener('click', function() { onPageChange(parseInt(this.getAttribute('data-p'))); });
  });
}

// ===== TABS =====
function initTabs(wrapId) {
  var wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = this.getAttribute('data-tab');
      wrap.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
      wrap.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.remove('active'); });
      this.classList.add('active');
      var panel = document.getElementById(target);
      if (panel) panel.classList.add('active');
    });
  });
}

// ===== MODAL =====
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

// ===== NAVBAR =====
function renderNavbar() {
  var user = getUser();
  var token = getToken();
  var isLoggedIn = !!token && !!user;
  var isAdmin = user && user.role === 'admin';

  var nav = document.getElementById('navbar');
  if (!nav) return;

  nav.innerHTML = '<div class="container">' +
    '<a href="/index.html" class="nav-logo"><span>🐾</span> Pet Rehoming</a>' +
    '<nav class="nav-links">' +
      '<a href="/index.html" id="nav-home">Home</a>' +
      '<a href="/pages/pets.html" id="nav-pets">Browse Pets</a>' +
      '<a href="/pages/blogs.html" id="nav-blogs">Blogs</a>' +
      '<a href="/pages/chat.html" id="nav-chat">PawBot</a>' +
      (isAdmin ? '<a href="/pages/admin.html" id="nav-admin">Admin</a>' : '') +
    '</nav>' +
    '<div class="nav-actions">' +
      (isLoggedIn ?
        '<button class="nav-notif-btn" onclick="window.location.href=\'/pages/notifications.html\'" id="nav-notif-btn">🔔<span class="notif-badge hidden" id="notif-badge">0</span></button>' +
        '<button class="nav-avatar" onclick="window.location.href=\'/pages/profile.html\'" title="' + (user.name||'') + '">' + initials(user.name) + '</button>' +
        '<button class="btn btn-secondary btn-sm" onclick="logout()">Logout</button>'
      :
        '<a href="/pages/login.html" class="btn btn-outline btn-sm">Login</a>' +
        '<a href="/pages/register.html" class="btn btn-primary btn-sm">Register</a>'
      ) +
    '</div>' +
    '<button class="nav-menu-btn" onclick="toggleMobileMenu()">☰</button>' +
  '</div>';

  // mobile menu
  var mm = document.getElementById('mobile-menu');
  if (!mm) {
    mm = document.createElement('div');
    mm.id = 'mobile-menu';
    mm.className = 'mobile-menu';
    document.body.insertBefore(mm, document.body.firstChild);
  }
  mm.innerHTML =
    '<a href="/index.html">Home</a>' +
    '<a href="/pages/pets.html">Browse Pets</a>' +
    '<a href="/pages/blogs.html">Blogs</a>' +
    '<a href="/pages/chat.html">PawBot</a>' +
    (isLoggedIn ? '<a href="/pages/profile.html">Profile</a>' : '') +
    (isLoggedIn ? '<a href="/pages/adoption-requests.html">Adoptions</a>' : '') +
    (isLoggedIn ? '<a href="/pages/messages.html">Messages</a>' : '') +
    (isAdmin    ? '<a href="/pages/admin.html">Admin</a>' : '') +
    (isLoggedIn ? '<a href="#" onclick="logout()">Logout</a>' : '<a href="/pages/login.html">Login</a>');

  // highlight active link
  var path = window.location.pathname;
  nav.querySelectorAll('.nav-links a').forEach(function(a) {
    if (path === a.getAttribute('href') || (path.includes(a.getAttribute('href')) && a.getAttribute('href') !== '/index.html')) {
      a.classList.add('active');
    }
  });

  // poll notification count
  if (isLoggedIn) pollNotifications();
}

function toggleMobileMenu() {
  var mm = document.getElementById('mobile-menu');
  if (mm) mm.classList.toggle('open');
}

function logout() {
  clearAuth();
  window.location.href = '/pages/login.html';
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

// ===== FOOTER =====
function renderFooter() {
  var footer = document.getElementById('footer');
  if (!footer) return;
  footer.innerHTML =
    '<div class="container">' +
      '<div class="footer-inner">' +
        '<div>' +
          '<div class="footer-brand">🐾 Pet Rehoming</div>' +
          '<p class="footer-desc">Connecting pets with loving homes and monitoring their welfare after adoption.</p>' +
        '</div>' +
        '<div class="footer-col"><h4>Explore</h4>' +
          '<a href="/pages/pets.html">Browse Pets</a>' +
          '<a href="/pages/blogs.html">Blogs</a>' +
          '<a href="/pages/chat.html">PawBot</a>' +
        '</div>' +
        '<div class="footer-col"><h4>Account</h4>' +
          '<a href="/pages/register.html">Register</a>' +
          '<a href="/pages/login.html">Login</a>' +
          '<a href="/pages/profile.html">Profile</a>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">&copy; ' + new Date().getFullYear() + ' Pet Rehoming & Monitoring System</div>' +
    '</div>';
}

// ===== REQUIRE AUTH =====
function requireAuth() {
  if (!getToken()) { window.location.href = '/pages/login.html'; return false; }
  return true;
}

function requireAdmin() {
  var user = getUser();
  if (!getToken() || !user || user.role !== 'admin') {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// ===== PET CARD HTML =====
function petCardHtml(pet) {
  var img = pet.images && pet.images[0] ? pet.images[0].url : (pet.primary_image || null);
  var imgHtml = img
    ? '<img class="pet-card-img" src="' + imgUrl(img) + '" alt="' + pet.name + '" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">' +
      '<div class="pet-card-placeholder" style="display:none">🐾</div>'
    : '<div class="pet-card-placeholder">🐾</div>';

  var fee = pet.fee_type === 'free'
    ? '<span class="pill pill-free">Free</span>'
    : '<span class="pill pill-paid">' + fmtMoney(pet.adoption_fee) + '</span>';

  return '<div class="pet-card" onclick="window.location.href=\'/pages/pet-detail.html?id=' + pet.id + '\'" style="cursor:pointer">' +
    imgHtml +
    '<div class="pet-card-body">' +
      '<div class="pet-card-title">' + pet.name + '</div>' +
      '<div class="pet-card-meta">' +
        (pet.pet_type_name||'') +
        (pet.breed ? ' · ' + pet.breed : '') +
        (pet.birth_date ? ' · ' + calcAge(pet.birth_date, pet.is_sure) : '') +
        (pet.city ? ' · ' + pet.city : '') +
      '</div>' +
      '<div class="pet-card-footer">' + fee + pill(pet.status) + '</div>' +
    '</div>' +
  '</div>';
}

// ===== BLOG CARD HTML =====
function blogCardHtml(blog) {
  var imgHtml = blog.cover_image_url
    ? '<img class="blog-card-img" src="' + imgUrl(blog.cover_image_url) + '" alt="' + blog.title + '">'
    : '<div class="blog-card-placeholder">📝</div>';

  return '<div class="blog-card" onclick="window.location.href=\'/pages/blog-detail.html?slug=' + blog.slug + '\'" style="cursor:pointer">' +
    imgHtml +
    '<div class="blog-card-body">' +
      '<div class="blog-card-cat">' + (blog.category_name||'General') + '</div>' +
      '<div class="blog-card-title">' + blog.title + '</div>' +
      '<div class="blog-card-summary">' + (blog.summary||'') + '</div>' +
      '<div class="blog-card-footer"><span>' + (blog.author_name||'') + '</span><span>' + timeAgo(blog.published_at) + '</span></div>' +
    '</div>' +
  '</div>';
}

// init on load
document.addEventListener('DOMContentLoaded', function() {
  renderNavbar();
  renderFooter();
  initModals();
});

// ===== AGE CALCULATION (replaces inline version in pet-detail.html) =====
function calcAge(birthDateStr, isSure) {
  if (!birthDateStr) return null;

  // handle both YYYY-MM-DD and DD-MM-YYYY formats
  var parts;
  var raw = birthDateStr.split('T')[0];
  if (raw.indexOf('-') !== -1) {
    parts = raw.split('-');
    // DD-MM-YYYY → parts[0] is day if length 2 and parts[2] is 4-digit year
    if (parts[0].length === 2 && parts[2].length === 4) {
      // DD-MM-YYYY format
      var bd = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      // YYYY-MM-DD format
      var bd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  } else {
    var bd = new Date(raw);
  }

  if (isNaN(bd.getTime())) return null;

  var now = new Date();

  // future date guard
  if (bd > now) return isSure ? 'Not born yet' : 'Unknown';

  var years  = now.getFullYear() - bd.getFullYear();
  var months = now.getMonth()    - bd.getMonth();
  var days   = now.getDate()     - bd.getDate();

  // adjust for day of month
  if (days < 0) {
    months -= 1;
    // add days in previous month
    var prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }

  // adjust for month rollover
  if (months < 0) {
    years  -= 1;
    months += 12;
  }

  // build label
  var label = '';
  if (years > 0 && months > 0) {
    label = years + ' yr' + (years > 1 ? 's' : '') + ' ' + months + ' mo';
  } else if (years > 0) {
    label = years + ' year' + (years > 1 ? 's' : '');
  } else if (months > 0) {
    label = months + ' month' + (months > 1 ? 's' : '');
  } else if (days > 0) {
    label = days + ' day' + (days > 1 ? 's' : '');
  } else {
    label = 'Today!';
  }

  if (!isSure) label += ' (est.)';
  return label;
}

// short version for cards: "2y 3m" or "5m" or "3d"
function calcAgeShort(birthDateStr, isSure) {
  var full = calcAge(birthDateStr, isSure);
  if (!full) return null;
  // already short for days/today cases
  return full
    .replace(' years', 'y').replace(' year', 'y')
    .replace(' months', 'm').replace(' month', 'm')
    .replace(' days', 'd').replace(' day', 'd')
    .replace(' yrs', 'y').replace(' yr', 'y')
    .replace(' mo', 'm');
}

// ===== AGE CALCULATOR (correct — accounts for partial months) =====
function calcAge(birthDateStr, isSure) {
  if (!birthDateStr) return '';
  var bd  = new Date(birthDateStr);
  var now = new Date();
  if (isNaN(bd.getTime())) return '';
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
