// Removed 'http://localhost:3000' so it automatically uses the current HTTPS domain
const API = '';

async function request(method, path, body, isFormData) {
  var headers = {};
  var token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  var opts = { method: method, headers: headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  var res;
  try {
    res = await fetch(API + path, opts);
  } catch(e) {
    console.error('Network error — is backend running?', e.message);
    return { ok: false, status: 0, data: { message: 'Cannot connect to server. Make sure the backend is running.' } };
  }

  var data;
  try { data = await res.json(); }
  catch(e) { data = { message: 'Invalid server response.' }; }

  if (res.status === 401) {
    clearAuth();
    var cur = window.location.pathname;
    if (cur.indexOf('login') === -1 && cur.indexOf('register') === -1) {
      window.location.href = p('login.html');
    }
    return { ok: false, status: 401, data: data };
  }

  if (res.status === 403 && data.message && data.message.toLowerCase().includes('suspended')) {
    clearAuth();
    alert('Your account has been suspended.\nReason: ' + (data.reason || 'Contact support.'));
    window.location.href = p('login.html');
    return { ok: false, status: 403, data: data };
  }

  return { ok: res.ok, status: res.status, data: data };
}

var get       = function(path)       { return request('GET',   path); };
var post      = function(path, body) { return request('POST',  path, body); };
var patch     = function(path, body) { return request('PATCH', path, body); };
var del       = function(path)       { return request('DELETE',path); };
var postForm  = function(path, fd)   { return request('POST',  path, fd, true); };
var patchForm = function(path, fd)   { return request('PATCH', path, fd, true); };

var Auth = {
  register:         function(b) { return post('/api/auth/register', b); },
  login:            function(b) { return post('/api/auth/login', b); },
  verifyTOTP:       function(b) { return post('/api/auth/verify-totp', b); }, 
  
  // Password Reset flow
  checkReset2FA:    function(b) { return post('/api/auth/reset/check', b); },
  verifyReset2FA:   function(b) { return post('/api/auth/reset/verify-2fa', b); },
  completeReset2FA: function(b) { return post('/api/auth/reset/complete', b); },

  // 2FA Setup flow (MUST BE ADDED)
  setup2FA:         function() { return get('/api/auth/2fa/setup'); },
  verify2FASetup:   function(b) { return post('/api/auth/2fa/verify', b); }
};

var User = {
  getProfile:     function()    { return get('/api/user/profile'); },
  updateProfile:  function(fd)  { return patchForm('/api/user/profile', fd); },
  changePassword: function(b)   { return patch('/api/user/change-password', b); },
};

var PetTypes = {
  list:   function()   { return get('/api/pet-types'); },
  create: function(b)  { return post('/api/pet-types', b); },
  delete: function(id) { return del('/api/pet-types/' + id); },
};

var Pets = {
  list:          function(q)        { return get('/api/pets?' + new URLSearchParams(q)); },
  my:            function()         { return get('/api/pets/my'); },
  trending:      function(l)        { return get('/api/pets/trending?limit=' + (l || 8)); },
  cities:        function()         { return get('/api/pets/cities'); },
  get:           function(id)       { return get('/api/pets/' + id); },
  create:        function(b)        { return post('/api/pets', b); },
  update:        function(id, b)    { return patch('/api/pets/' + id, b); },
  delete:        function(id)       { return del('/api/pets/' + id); },
  addImage:      function(id, fd)   { return postForm('/api/pets/' + id + '/images', fd); },
  deleteImage:   function(id, iid)  { return del('/api/pets/' + id + '/images/' + iid); },
  statusHistory: function(id)       { return get('/api/pets/' + id + '/status-history'); },
  like:           function(id)      { return post('/api/pets/' + id + '/like'); },
  getComments:    function(id)      { return get('/api/pets/' + id + '/comments'); },
  addComment:     function(id, b)   { return post('/api/pets/' + id + '/comments', b); },
  deleteComment:  function(id, cid) { return del('/api/pets/' + id + '/comments/' + cid); }
};

var Adoption = {
  request:      function(petId, b) { return post('/api/pets/' + petId + '/adopt', b); },
  mine:         function()         { return get('/api/adoption-requests/mine'); },
  received:     function()         { return get('/api/adoption-requests/received'); },
  review:       function(id, b)    { return patch('/api/adoption-requests/' + id, b); },
  cancel:       function(id)       { return patch('/api/adoption-requests/' + id + '/cancel'); },
  getAgreement: function(id)       { return get('/api/adoption-requests/' + id + '/agreement'); },
  agree:        function(id)       { return patch('/api/adoption-requests/' + id + '/agreement/agree'); },
};

var Payments = {
  list:     function()    { return get('/api/payments'); },
  get:      function(id)  { return get('/api/payments/' + id); },
  initiate: function(b)   { return post('/api/payments/initiate', b); },
  verify:   function(id)  { return post('/api/payments/' + id + '/verify'); },
  simulate:  function(b) { return post('/api/payments/simulate', b); }
};

var Favorites = {
  list:   function()   { return get('/api/favorites'); },
  add:    function(id) { return post('/api/favorites/' + id); },
  remove: function(id) { return del('/api/favorites/' + id); },
};

var Monitoring = {
  myAdoptions:     function()             { return get('/api/monitoring/my-adoptions'); },
  rehomed:         function()             { return get('/api/monitoring/rehomed'); },
  getTimeline:     function(arId)         { return get('/api/monitoring/timeline/' + arId); },
  
  submitFollowup:  function(arId, fd)      { return postForm('/api/monitoring/followups/' + arId, fd); },
  getFollowups:    function(arId)          { return get('/api/monitoring/followups/' + arId); },
  
  addHealthLog:    function(petId, b)      { return post('/api/monitoring/pets/' + petId + '/health-logs', b); },
  getHealthLogs:   function(petId)         { return get('/api/monitoring/pets/' + petId + '/health-logs'); },
  deleteHealthLog: function(petId, logId)  { return del('/api/monitoring/pets/' + petId + '/health-logs/' + logId); },
  
  // Admin flag functions (optional, but good to have if you build an admin dashboard later)
  listFlags:       function(resolved)      { return get('/api/monitoring/flags?resolved=' + resolved); },
  resolveFlag:     function(flagId)        { return patch('/api/monitoring/flags/' + flagId + '/resolve'); }
};

var Blogs = {
  categories:   function()        { return get('/api/blogs/categories'); },
  list:         function(q)       { return get('/api/blogs?' + new URLSearchParams(q)); },
  
  // FIXED: Properly hits the detail endpoint which returns the full blog content
  get:          function(idOrSlug) { return get('/api/blogs/' + idOrSlug); },
  
  // NEW: Gets related posts for the sidebar
  getRelated:   function(id)      { return get('/api/blogs/' + id + '/related'); },

  create:       function(fd)      { return postForm('/api/blogs', fd); },
  update:       function(id, fd)  { return patchForm('/api/blogs/' + id, fd); },
  delete:       function(id)      { return del('/api/blogs/' + id); },
  like:         function(id)      { return post('/api/blogs/' + id + '/like'); },
  getComments:  function(id)      { return get('/api/blogs/' + id + '/comments'); },
  addComment:   function(id, b)   { return post('/api/blogs/' + id + '/comments', b); },
  deleteComment:function(id, cid) { return del('/api/blogs/' + id + '/comments/' + cid); },
};

var Reports = {
  submit: function(b) { return post('/api/reports', b); },
};

var Notifications = {
  list:    function()   { return get('/api/notifications'); },
  readAll: function()   { return patch('/api/notifications/read-all'); },
  read:    function(id) { return patch('/api/notifications/' + id + '/read'); },
  delete:  function(id) { return del('/api/notifications/' + id); },
};

var Chat = {
  oneShot:       function(b)       { return post('/api/chat', b); },
  createSession: function()        { return post('/api/chat/sessions'); },
  listSessions:  function()        { return get('/api/chat/sessions'); },
  getMessages:   function(sid)     { return get('/api/chat/sessions/' + sid + '/messages'); },
  send:          function(sid, b)  { return post('/api/chat/sessions/' + sid + '/messages', b); },
  deleteSession: function(sid)     { return del('/api/chat/sessions/' + sid); },
};

var Messages = {
  unreadCount:   function()       { return get('/api/messages/unread-count'); },
  conversations: function()       { return get('/api/messages/conversations'); },
  getOrCreate:   function(b)      { return post('/api/messages/conversations', b); },
  getMessages:   function(cid)    { return get('/api/messages/conversations/' + cid); },
  send:          function(cid, b) { return post('/api/messages/conversations/' + cid, b); },
  declineAndRefund: function(cid, b) { return post('/api/messages/conversations/' + cid + '/decline-and-refund', b); },
};

var Admin = {
  stats:           function()       { return get('/api/admin/stats'); },
  users:           function(q)      { return get('/api/admin/users?' + new URLSearchParams(q)); },
  getUser:         function(id)     { return get('/api/admin/users/' + id); },
  changeRole:      function(id, b)  { return patch('/api/admin/users/' + id + '/role', b); },
  suspend:         function(id, b)  { return patch('/api/admin/users/' + id + '/suspend', b); },
  unsuspend:       function(id)     { return patch('/api/admin/users/' + id + '/unsuspend'); },
  deleteUser:      function(id)     { return del('/api/admin/users/' + id); },
  pets:            function(q)      { return get('/api/admin/pets?' + new URLSearchParams(q)); },
  updatePetStatus: function(id, b)  { return patch('/api/admin/pets/' + id + '/status', b); },
  deletePet:       function(id)     { return del('/api/admin/pets/' + id); },
  blogs:           function(q)      { return get('/api/admin/blogs?' + new URLSearchParams(q)); },
  updateBlogStatus:function(id, b)  { return patch('/api/admin/blogs/' + id + '/status', b); },
  deleteBlog:      function(id)     { return del('/api/admin/blogs/' + id); },
  adoptions:       function(q)      { return get('/api/admin/adoptions?' + new URLSearchParams(q)); },
  closeAdoption:   function(id, b)  { return patch('/api/admin/adoptions/' + id + '/close', b); },
  followups:       function(q)      { return get('/api/admin/followups?' + new URLSearchParams(q)); },
  healthLogs:      function(q)      { return get('/api/admin/health-logs?' + new URLSearchParams(q)); },
  reports:         function(q)      { return get('/api/admin/reports?' + new URLSearchParams(q)); },
  resolveReport:   function(id, b)  { return patch('/api/admin/reports/' + id + '/resolve', b); },
  auditLog:        function(q)      { return get('/api/admin/audit-log?' + new URLSearchParams(q)); },
};