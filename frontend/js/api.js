const API = 'http://localhost:3000';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function request(method, path, body, isFormData) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(API + path, opts);
  const data = await res.json();

  if (res.status === 401) { clearAuth(); window.location.href = '/pages/login.html'; return; }
  if (res.status === 403 && data.message && data.message.includes('suspended')) {
    clearAuth();
    alert('Your account has been suspended. Reason: ' + (data.reason || 'Contact support.'));
    window.location.href = '/pages/login.html';
    return;
  }

  return { ok: res.ok, status: res.status, data };
}

// shorthand helpers
const get  = (path)         => request('GET',    path);
const post = (path, body)   => request('POST',   path, body);
const patch= (path, body)   => request('PATCH',  path, body);
const del  = (path)         => request('DELETE', path);
const postForm = (path, fd) => request('POST',   path, fd, true);
const patchForm= (path, fd) => request('PATCH',  path, fd, true);

// ── Auth ──────────────────────────────────────────────────────
const Auth = {
  register: (b)  => post('/api/auth/register', b),
  login:    (b)  => post('/api/auth/login', b),
  forgotPassword:(b) => post('/api/auth/forgot-password', b),
  verifyResetToken:(token) => get('/api/auth/verify-reset-token?token=' + token),
  resetPassword: (b) => post('/api/auth/reset-password', b),
};

// ── User ──────────────────────────────────────────────────────
const User = {
  getProfile:    ()  => get('/api/user/profile'),
  updateProfile: (fd)=> patchForm('/api/user/profile', fd),
  changePassword:(b) => patch('/api/user/change-password', b),
};

// ── Pet Types ─────────────────────────────────────────────────
const PetTypes = {
  list:   () => get('/api/pet-types'),
  create: (b)=> post('/api/pet-types', b),
  delete: (id)=>del('/api/pet-types/' + id),
};

// ── Pets ──────────────────────────────────────────────────────
const Pets = {
  list:     (q)   => get('/api/pets?' + new URLSearchParams(q)),
  my:       ()    => get('/api/pets/my'),
  trending: (l)   => get('/api/pets/trending?limit=' + (l||8)),
  cities:   ()    => get('/api/pets/cities'),
  get:      (id)  => get('/api/pets/' + id),
  create:   (b)   => post('/api/pets', b),
  update:   (id,b)=> patch('/api/pets/' + id, b),
  delete:   (id)  => del('/api/pets/' + id),
  addImage: (id,fd)   => postForm('/api/pets/' + id + '/images', fd),
  deleteImage:(id,imgId) => del('/api/pets/' + id + '/images/' + imgId),
  statusHistory:(id) => get('/api/pets/' + id + '/status-history'),
};

// ── Adoption ──────────────────────────────────────────────────
const Adoption = {
  request:   (petId, b) => post('/api/pets/' + petId + '/adopt', b),
  mine:      ()         => get('/api/adoption-requests/mine'),
  received:  ()         => get('/api/adoption-requests/received'),
  review:    (id, b)    => patch('/api/adoption-requests/' + id, b),
  cancel:    (id)       => patch('/api/adoption-requests/' + id + '/cancel'),
  getAgreement: (id)    => get('/api/adoption-requests/' + id + '/agreement'),
  agree:     (id)       => patch('/api/adoption-requests/' + id + '/agreement/agree'),
};

// ── Payments ──────────────────────────────────────────────────
const Payments = {
  list:     () => get('/api/payments'),
  get:      (id) => get('/api/payments/' + id),
  initiate: (b)  => post('/api/payments/initiate', b),
  verify:   (id) => post('/api/payments/' + id + '/verify'),
};

// ── Favorites ─────────────────────────────────────────────────
const Favorites = {
  list:   ()    => get('/api/favorites'),
  add:    (id)  => post('/api/favorites/' + id),
  remove: (id)  => del('/api/favorites/' + id),
};

// ── Monitoring ────────────────────────────────────────────────
const Monitoring = {
  submitFollowup: (arId, fd) => postForm('/api/monitoring/followups/' + arId, fd),
  getFollowups:   (arId)     => get('/api/monitoring/followups/' + arId),
  addHealthLog:   (petId, b) => post('/api/monitoring/pets/' + petId + '/health-logs', b),
  getHealthLogs:  (petId)    => get('/api/monitoring/pets/' + petId + '/health-logs'),
  deleteHealthLog:(petId, logId) => del('/api/monitoring/pets/' + petId + '/health-logs/' + logId),
};

// ── Blogs ─────────────────────────────────────────────────────
const Blogs = {
  categories: ()    => get('/api/blogs/categories'),
  list:       (q)   => get('/api/blogs?' + new URLSearchParams(q)),
  get:        (slug)=> get('/api/blogs/' + slug),
  create:     (fd)  => postForm('/api/blogs', fd),
  update:     (id,fd)=> patchForm('/api/blogs/' + id, fd),
  delete:     (id)  => del('/api/blogs/' + id),
  like:       (id)  => post('/api/blogs/' + id + '/like'),
  getComments:(id)  => get('/api/blogs/' + id + '/comments'),
  addComment: (id,b)=> post('/api/blogs/' + id + '/comments', b),
  deleteComment:(id,cid)=> del('/api/blogs/' + id + '/comments/' + cid),
};

// ── Reports ───────────────────────────────────────────────────
const Reports = {
  submit: (b) => post('/api/reports', b),
};

// ── Notifications ─────────────────────────────────────────────
const Notifications = {
  list:       ()    => get('/api/notifications'),
  readAll:    ()    => patch('/api/notifications/read-all'),
  read:       (id)  => patch('/api/notifications/' + id + '/read'),
  delete:     (id)  => del('/api/notifications/' + id),
};

// ── Chat ──────────────────────────────────────────────────────
const Chat = {
  oneShot:       (b)    => post('/api/chat', b),
  createSession: ()     => post('/api/chat/sessions'),
  listSessions:  ()     => get('/api/chat/sessions'),
  getMessages:   (sid)  => get('/api/chat/sessions/' + sid + '/messages'),
  send:          (sid,b)=> post('/api/chat/sessions/' + sid + '/messages', b),
  deleteSession: (sid)  => del('/api/chat/sessions/' + sid),
};

// ── Messages ──────────────────────────────────────────────────
const Messages = {
  unreadCount:     ()      => get('/api/messages/unread-count'),
  conversations:   ()      => get('/api/messages/conversations'),
  getOrCreate:     (b)     => post('/api/messages/conversations', b),
  getMessages:     (cid)   => get('/api/messages/conversations/' + cid),
  send:            (cid,b) => post('/api/messages/conversations/' + cid, b),
};

// ── Admin ─────────────────────────────────────────────────────
const Admin = {
  stats:          ()       => get('/api/admin/stats'),
  users:          (q)      => get('/api/admin/users?' + new URLSearchParams(q)),
  getUser:        (id)     => get('/api/admin/users/' + id),
  changeRole:     (id,b)   => patch('/api/admin/users/' + id + '/role', b),
  suspend:        (id,b)   => patch('/api/admin/users/' + id + '/suspend', b),
  unsuspend:      (id)     => patch('/api/admin/users/' + id + '/unsuspend'),
  deleteUser:     (id)     => del('/api/admin/users/' + id),
  pets:           (q)      => get('/api/admin/pets?' + new URLSearchParams(q)),
  updatePetStatus:(id,b)   => patch('/api/admin/pets/' + id + '/status', b),
  deletePet:      (id)     => del('/api/admin/pets/' + id),
  blogs:          (q)      => get('/api/admin/blogs?' + new URLSearchParams(q)),
  updateBlogStatus:(id,b)  => patch('/api/admin/blogs/' + id + '/status', b),
  deleteBlog:     (id)     => del('/api/admin/blogs/' + id),
  adoptions:      (q)      => get('/api/admin/adoptions?' + new URLSearchParams(q)),
  closeAdoption:  (id,b)   => patch('/api/admin/adoptions/' + id + '/close', b),
  followups:      (q)      => get('/api/admin/followups?' + new URLSearchParams(q)),
  healthLogs:     (q)      => get('/api/admin/health-logs?' + new URLSearchParams(q)),
  reports:        (q)      => get('/api/admin/reports?' + new URLSearchParams(q)),
  resolveReport:  (id,b)   => patch('/api/admin/reports/' + id + '/resolve', b),
  auditLog:       (q)      => get('/api/admin/audit-log?' + new URLSearchParams(q)),
};
