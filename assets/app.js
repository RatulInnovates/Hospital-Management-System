// ─── STATE ───────────────────────────────────────────
let state = {
  currentUser: null,
  doctors: [],
  rules: {},
  currentRoute: 'login',
  bookingStep: 1,
  selectedDoctor: null,
  selectedDate: null,
  selectedTime: null,
  isEmergencyBooking: false,
};

// ─── API HELPER ──────────────────────────────────────
async function api(endpoint, params, method) {
  method = method || 'POST';
  params = params || {};
  var opts = { method: method };
  // ensure cookies (PHP session) are sent/accepted for same-origin requests
  opts.credentials = 'same-origin';
  if (method === 'POST') {
    var fd = new FormData();
    Object.keys(params).forEach(function(k) { fd.append(k, params[k]); });
    opts.body = fd;
  }
  try {
    var res = await fetch(endpoint, opts);
  } catch (err) {
    return { success: false, error: 'Network error' };
  }
  if (!res.ok) {
    try { var errBody = await res.json(); return errBody; } catch (e) { return { success: false, error: 'Server error' }; }
  }
  try { return await res.json(); } catch (e) { return { success: false, error: 'Invalid JSON response' }; }
}

// ─── ROUTER ──────────────────────────────────────────
function navigate(route) {
  state.currentRoute = route;
  document.querySelectorAll('section').forEach(function(el) { el.classList.remove('view--active'); });
  var id = 'view-' + route.replace('/', '-');
  var el = document.getElementById(id);
  if (el) el.classList.add('view--active');
  updateLayoutShell();
  if (route === 'patient/dashboard') renderPatientDashboard();
  if (route === 'patient/book')      renderPatientBook();
  if (route === 'patient/queue')     renderPatientQueue();
  if (route === 'patient/records')   renderPatientRecords();
  if (route === 'doctor/dashboard')  renderDoctorDashboard();
  if (route === 'doctor/queue')      renderDoctorQueue();
  if (route === 'doctor/settings')   renderDoctorSettings();
  if (route === 'admin/dashboard')   renderAdminDashboard();
  if (route === 'admin/doctors')     renderAdminDoctors();
  if (route === 'admin/patients')    renderAdminPatients();
  if (route === 'admin/tokens')      renderAdminTokens();
  if (route === 'public/queue')      renderPublicQueue();
}

function updateLayoutShell() {
  var isAuth = ['login','signup','public/queue'].indexOf(state.currentRoute) !== -1;
  var sidebar = document.getElementById('app-sidebar');
  var header  = document.getElementById('app-header');
  var main    = document.getElementById('app-main');
  if (isAuth) {
    sidebar.classList.add('d-none');
    header.classList.add('d-none');
    main.style.marginLeft = '0';
  } else {
    sidebar.classList.remove('d-none');
    header.classList.remove('d-none');
    main.style.marginLeft = '240px';
    renderNavMenu();
    if (state.currentUser) {
      var initials = state.currentUser.name.split(' ').map(function(p){ return p[0]; }).join('').substring(0,2).toUpperCase();
      document.getElementById('header-avatar').innerText = initials;
      var titleMap = {
        'patient/dashboard':'Dashboard','patient/book':'Book Appointment',
        'patient/queue':'Live Queue','patient/records':'Medical Records',
        'doctor/dashboard':'Doctor Dashboard','doctor/queue':'Queue Management',
        'doctor/settings':'Settings','admin/dashboard':'Admin Dashboard',
        'admin/doctors':'Manage Doctors','admin/patients':'Patient History',
        'admin/tokens':'Token Rules'
      };
      document.getElementById('page-title').innerText = titleMap[state.currentRoute] || 'Azure Sanctuary';
      document.getElementById('user-info').innerHTML =
        '<div class="avatar">' + initials + '</div>' +
        '<div style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
          '<div>' + state.currentUser.name + '</div>' +
          '<div class="text-muted" style="font-size:12px;text-transform:capitalize">' + state.currentUser.role + '</div>' +
        '</div>';
      var emBtn = document.getElementById('btn-emergency-nav');
      if (state.currentUser.role === 'patient') {
        emBtn.classList.remove('d-none');
        emBtn.onclick = markAsEmergency;
      } else {
        emBtn.classList.add('d-none');
      }
    }
  }
}

function renderNavMenu() {
  var menu = document.getElementById('nav-menu');
  var role = state.currentUser ? state.currentUser.role : '';
  var items = [];
  if (role === 'patient' || role === 'guest') {
    items = [
      {label:'Dashboard',route:'patient/dashboard',icon:'🏠'},
      {label:'Book Appointment',route:'patient/book',icon:'📅'},
      {label:'Live Queue',route:'patient/queue',icon:'👥'},
      {label:'My Records',route:'patient/records',icon:'📂'}
    ];
  } else if (role === 'doctor') {
    items = [
      {label:'Dashboard',route:'doctor/dashboard',icon:'🏠'},
      {label:'Queue Management',route:'doctor/queue',icon:'👥'},
      {label:'Settings',route:'doctor/settings',icon:'⚙️'}
    ];
  } else if (role === 'admin') {
    items = [
      {label:'Dashboard',route:'admin/dashboard',icon:'🏠'},
      {label:'Manage Doctors',route:'admin/doctors',icon:'👨‍⚕️'},
      {label:'Patient History',route:'admin/patients',icon:'📂'},
      {label:'Token Rules',route:'admin/tokens',icon:'⚙️'}
    ];
  }
  menu.innerHTML = items.map(function(it) {
    return '<div class="nav-item ' + (state.currentRoute === it.route ? 'active' : '') + '" onclick="navigate(\'' + it.route + '\')">' +
      '<span>' + it.icon + '</span><span>' + it.label + '</span></div>';
  }).join('');
}

// ─── AUTH ─────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var email = document.getElementById('login-email').value;
  var pass  = document.getElementById('login-password').value;
  var role  = document.querySelector('.role-tab.active').dataset.role;
  var data  = await api('api/auth.php', {action:'login', email:email, password:pass, role:role});
  if (data.success) {
    state.currentUser = data.user;
    document.getElementById('login-error').classList.add('d-none');
    showToast('Login successful', 'success');
    var r = data.user.role;
    navigate(r === 'admin' ? 'admin/dashboard' : r === 'doctor' ? 'doctor/dashboard' : 'patient/dashboard');
  } else {
    document.getElementById('login-error').classList.remove('d-none');
  }
});

document.getElementById('signup-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var data = await api('api/auth.php', {
    action:'signup',
    name:        document.getElementById('reg-name').value,
    email:       document.getElementById('reg-email').value,
    password:    document.getElementById('reg-password').value,
    phone:       document.getElementById('reg-phone').value,
    age:         document.getElementById('reg-age').value,
    blood_group: document.getElementById('reg-blood').value
  });
  var errEl = document.getElementById('signup-error');
  if (data.success) {
    errEl.classList.add('d-none');
    state.currentUser = data.user;
    showToast('Account created!', 'success');
    navigate('patient/dashboard');
  } else {
    errEl.innerText = data.error || 'Registration failed';
    errEl.classList.remove('d-none');
  }
});

async function handleGuestLogin() {
  var name  = prompt('Enter your full name:');
  var phone = prompt('Enter your phone number:');
  if (name && phone) {
    var data = await api('api/auth.php', {action:'guest', name:name, phone:phone});
    if (data.success) {
      state.currentUser = data.user;
      showToast('Logged in as Guest', 'info');
      navigate('patient/dashboard');
    }
  }
}

document.getElementById('btn-logout').addEventListener('click', async function() {
  await api('api/auth.php', {action:'logout'});
  state.currentUser = null;
  navigate('login');
});

document.querySelectorAll('.role-tab').forEach(function(tab) {
  tab.addEventListener('click', function(e) {
    document.querySelectorAll('.role-tab').forEach(function(t){ t.classList.remove('active'); });
    e.target.classList.add('active');
    var role = e.target.dataset.role;
    document.querySelectorAll('.patient-only').forEach(function(el) {
      role === 'patient' ? el.classList.remove('d-none') : el.classList.add('d-none');
    });
  });
});

document.getElementById('link-signup').addEventListener('click', function(e){ e.preventDefault(); navigate('signup'); });
document.getElementById('link-guest').addEventListener('click',  function(e){ e.preventDefault(); handleGuestLogin(); });

// ─── PATIENT DASHBOARD ────────────────────────────────
async function renderPatientDashboard() {
  var u  = state.currentUser;
  var hr = new Date().getHours();
  var greeting = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('pd-welcome').innerText = greeting + ', ' + u.name + (u.role==='guest' ? ' (Guest)' : '');
  document.getElementById('pd-date').innerText = new Date().toLocaleDateString('en-US', {weekday:'long',year:'numeric',month:'long',day:'numeric'});

  var tc = document.getElementById('pd-active-token');
  if (u.role !== 'guest' && u.id && !String(u.id).startsWith('guest')) {
    var rules  = await loadRules();
    var active = await api('api/queue.php?action=my', {}, 'GET');
    if (active && active.token_id) {
      tc.classList.remove('d-none');
      var estWait = active.status === 'serving' ? 0 : active.queue_position * (rules.wait_time_buffer || 15);
      tc.innerHTML =
        '<div class="flex justify-between items-center p-4">' +
          '<div>' +
            '<div class="text-muted text-sm">Active Token</div>' +
            '<h2 class="queue-token-large" style="font-size:32px;color:var(--primary-navy);">' + active.token_id + '</h2>' +
            '<div class="mt-2"><b>Doctor:</b> ' + active.doctor_name + '</div>' +
            '<div><b>Status:</b> <span class="badge ' + (active.status==='serving'?'badge-green':'badge-cyan') + '">' + active.status.toUpperCase() + '</span></div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div class="text-muted">Queue Position</div>' +
            '<h2 style="font-size:48px;color:var(--accent-teal);">' + active.queue_position + '</h2>' +
            '<div class="text-muted">Est. Wait: ' + estWait + ' min</div>' +
          '</div>' +
        '</div>' +
        (!active.is_emergency && active.status !== 'serving' ?
          '<button class="btn btn-danger mt-4 w-full" style="font-weight:bold;font-size:18px;" onclick="markAsEmergency()">🚨 Mark as Emergency 🚨</button>' : '');
    } else {
      tc.classList.add('d-none');
    }
  } else {
    tc.classList.add('d-none');
  }

  var tbody = document.querySelector('#table-patient-appointments tbody');
  if (u.role === 'guest') {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Guest users cannot view appointment history.</td></tr>';
    return;
  }
  var appts = await api('api/appointments.php?action=my', {}, 'GET');
  if (!appts.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No appointments found.</td></tr>';
  } else {
    tbody.innerHTML = appts.map(function(a) {
      return '<tr><td><b>' + a.token_id + '</b></td><td>' + a.doctor_name + '</td><td>' + a.specialty + '</td>' +
        '<td>' + a.appt_date + ' ' + a.appt_time + '</td>' +
        '<td><span class="badge badge-grey">' + a.status + '</span></td>' +
        '<td>BDT ' + a.fee + '</td></tr>';
    }).join('');
  }
}

// ─── BOOKING ──────────────────────────────────────────
async function renderPatientBook() {
  setBookingStep(1);
  var docs = await loadDoctors();
  var specs = [];
  docs.forEach(function(d){ if (specs.indexOf(d.specialty) === -1) specs.push(d.specialty); });
  document.getElementById('specialty-filters').innerHTML =
    '<div class="pill active" onclick="filterDoctors(\'All\',this)">All</div>' +
    specs.map(function(s){ return '<div class="pill" onclick="filterDoctors(\'' + s + '\',this)">' + s + '</div>'; }).join('');
  renderDoctorsGrid(docs);
}

function filterDoctors(spec, el) {
  document.querySelectorAll('#specialty-filters .pill').forEach(function(p){ p.classList.remove('active'); });
  el.classList.add('active');
  var docs = spec === 'All' ? state.doctors : state.doctors.filter(function(d){ return d.specialty === spec; });
  renderDoctorsGrid(docs);
}

function renderDoctorsGrid(docs) {
  var grid = document.getElementById('doctor-selection-grid');
  if (!docs.length) { grid.innerHTML = '<div class="empty-state">No doctors available.</div>'; return; }
  grid.innerHTML = docs.map(function(d) {
    var badge = 'badge-available';
    if (d.status === 'In Session') badge = 'badge-insession';
    if (d.status === 'Off Duty')   badge = 'badge-offduty';
    return '<div class="doctor-card ' + (state.selectedDoctor == d.id ? 'selected' : '') + '" onclick="selectDoctor(' + d.id + ')">' +
      '<div class="flex justify-between items-center mb-2"><h4 style="color:var(--primary-navy);">' + d.name + '</h4><span class="badge ' + badge + '">' + d.status + '</span></div>' +
      '<div class="text-muted text-sm mb-2">' + d.specialty + '</div>' +
      '<div class="text-sm"><b>Fee:</b> BDT ' + d.fee + '</div>' +
      '<div class="text-sm text-muted mt-2">Hours: ' + d.workingHours.start + ' - ' + d.workingHours.end + '</div>' +
      '<div class="text-sm text-muted mt-1">Days: ' + (d.workingDays||[]).join(', ') + '</div>' +
    '</div>';
  }).join('');
}

function selectDoctor(id) {
  state.selectedDoctor = id;
  renderDoctorsGrid(state.doctors);
  var btn = document.getElementById('btn-next-2');
  btn.disabled = false;
  btn.onclick = function() {
    var doc = state.doctors.filter(function(d){ return d.id == id; })[0];
    if (doc.status === 'Off Duty') showToast('Doctor is Off Duty. You can book for a future date.', 'warning');
    setBookingStep(2);
  };
}

function setBookingStep(step) {
  state.bookingStep = step;
  [1,2,3].forEach(function(s) {
    document.getElementById('book-step-' + s).classList.add('d-none');
    document.getElementById('step' + s + '-ind').classList.remove('active');
  });
  document.getElementById('book-step-' + step).classList.remove('d-none');
  for (var i = 1; i <= step; i++) document.getElementById('step' + i + '-ind').classList.add('active');

  if (step === 2) {
    var today = new Date().toISOString().split('T')[0];
    var dateEl = document.getElementById('book-date');
    dateEl.min = today;
    if (!dateEl.value) dateEl.value = today;
    var doc   = state.doctors.filter(function(d){ return d.id == state.selectedDoctor; })[0];
    var start = parseInt(doc.workingHours.start.split(':')[0]);
    var end   = parseInt(doc.workingHours.end.split(':')[0]);
    var opts  = '';
    for (var h = start; h < end; h++) {
      opts += '<option value="' + h + ':00">' + h + ':00</option><option value="' + h + ':30">' + h + ':30</option>';
    }
    document.getElementById('book-time').innerHTML = opts;
    var btn3 = document.getElementById('btn-next-3');
    btn3.disabled = false;
    btn3.onclick = function() {
      state.selectedDate = document.getElementById('book-date').value;
      state.selectedTime = document.getElementById('book-time').value;
      state.isEmergencyBooking = document.getElementById('book-emergency').checked;
      setBookingStep(3);
    };
  }

  if (step === 3) {
    var doc2 = state.doctors.filter(function(d){ return d.id == state.selectedDoctor; })[0];
    document.getElementById('book-summary').innerHTML =
      '<div class="mb-2"><b>Doctor:</b> ' + doc2.name + ' (' + doc2.specialty + ')</div>' +
      '<div class="mb-2"><b>Date:</b> ' + state.selectedDate + '</div>' +
      '<div class="mb-2"><b>Time:</b> ' + state.selectedTime + '</div>' +
      '<div class="mb-2"><b>Fee:</b> BDT ' + doc2.fee + '</div>' +
      (state.isEmergencyBooking ? '<div class="text-danger mt-2"><b>🚨 Emergency Priority Case</b></div>' : '');
  }
}

async function confirmBooking() {
  var data = await api('api/queue.php', {
    action:       'book',
    doctor_id:    state.selectedDoctor,
    date:         state.selectedDate,
    time:         state.selectedTime,
    is_emergency: state.isEmergencyBooking ? 1 : 0
  });
  if (data.success) {
    showToast('Booking Confirmed! Token: ' + data.token, 'success');
    navigate('patient/dashboard');
  } else {
    showToast(data.error || 'Booking failed', 'error');
  }
}

// ─── PATIENT QUEUE ────────────────────────────────────
async function renderPatientQueue() {
  var u     = state.currentUser;
  var rules = await loadRules();
  var queue = await api('api/queue.php?action=list', {}, 'GET');
  var myEntry = null;
  queue.forEach(function(q){ if (String(q.patient_id) === String(u.id) && (q.status==='waiting'||q.status==='serving')) myEntry = q; });
  var docId = myEntry ? myEntry.doctor_id : (state.doctors[0] ? state.doctors[0].id : null);
  var docQueue = queue.filter(function(q){ return q.doctor_id == docId && (q.status==='waiting'||q.status==='serving'); })
                      .sort(function(a,b){ return a.queue_position - b.queue_position; });

  var srv = null;
  docQueue.forEach(function(q){ if (q.status==='serving') srv = q; });
  var servingEl = document.getElementById('pq-serving');
  if (srv) {
    servingEl.classList.remove('d-none');
    document.getElementById('pq-serving-token').innerText = srv.token_id;
    document.getElementById('pq-serving-name').innerText  = maskName(srv.patient_name);
  } else {
    servingEl.classList.add('d-none');
  }

  var tbody = document.querySelector('#table-patient-queue tbody');
  if (!docQueue.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Queue is empty.</td></tr>';
  } else {
    tbody.innerHTML = docQueue.map(function(q) {
      var wait  = q.status === 'serving' ? 0 : q.queue_position * (rules.wait_time_buffer || 15);
      var isMe  = String(q.patient_id) === String(u.id);
      return '<tr style="' + (isMe ? 'background:#E6FFFA;' : '') + '">' +
        '<td><h3 style="margin:0">' + (q.status==='serving' ? '-' : q.queue_position) + '</h3></td>' +
        '<td><b>' + q.token_id + '</b></td>' +
        '<td>' + (isMe ? q.patient_name : maskName(q.patient_name)) + '</td>' +
        '<td>' + (q.is_emergency ? '<span class="badge badge-red emergency-pulse">EMERGENCY</span>' : '<span class="badge badge-grey">Regular</span>') + '</td>' +
        '<td>' + (q.status==='serving' ? 'Now' : wait + ' min') + '</td>' +
      '</tr>';
    }).join('');
  }
}

async function markAsEmergency() {
  var data = await api('api/queue.php', {action:'emergency'});
  if (data.success) {
    showToast('Your case has been marked as priority', 'warning');
    document.getElementById('btn-emergency-nav').classList.add('emergency-pulse');
    renderPatientDashboard();
  } else {
    showToast(data.error || 'No active token', 'error');
  }
}

// ─── PATIENT RECORDS ──────────────────────────────────
function renderPatientRecords() {
  var u = state.currentUser;
  if (u.role === 'guest') {
    document.getElementById('pr-profile').innerHTML = '<p class="text-muted">Not available for guest users.</p>';
    document.getElementById('pr-conditions').innerHTML = '';
    return;
  }
  document.getElementById('pr-profile').innerHTML =
    '<div class="mb-2"><b>Name:</b> ' + u.name + '</div>' +
    '<div class="mb-2"><b>Age:</b> ' + (u.age || '-') + '</div>' +
    '<div class="mb-2"><b>Blood Group:</b> ' + (u.blood_group || '-') + '</div>' +
    '<div class="mb-2"><b>Phone:</b> ' + (u.phone || '-') + '</div>';
  var conds = u.conditions || {};
  document.getElementById('pr-conditions').innerHTML = Object.keys(conds).map(function(k) {
    return '<div class="flex justify-between items-center p-2" style="border:1px solid var(--border-light);border-radius:8px;">' +
      '<span style="text-transform:capitalize;">' + k.replace(/([A-Z])/g,' $1').trim() + '</span>' +
      '<label class="toggle-switch"><input type="checkbox" id="cond-' + k + '" ' + (conds[k] ? 'checked' : '') + '><span class="toggle-slider"></span></label>' +
    '</div>';
  }).join('');
}

async function savePatientConditions() {
  var u     = state.currentUser;
  var conds = {};
  Object.keys(u.conditions || {}).forEach(function(k){ conds[k] = document.getElementById('cond-' + k).checked; });
  var data = await api('api/patients.php', {action:'conditions', conditions:JSON.stringify(conds)});
  if (data.success) {
    state.currentUser.conditions = conds;
    showToast('Conditions updated', 'success');
  }
}

// ─── DOCTOR VIEWS ─────────────────────────────────────
async function renderDoctorDashboard() {
  var u     = state.currentUser;
  var queue = await api('api/queue.php?action=list&doctor_id=' + u.id, {}, 'GET');
  var waiting   = queue.filter(function(q){ return q.status==='waiting'; }).length;
  var today     = new Date().toISOString().split('T')[0];
  var completed = queue.filter(function(q){ return q.status==='completed' && q.created_at && q.created_at.startsWith(today); }).length;

  document.getElementById('dd-queue-count').innerText     = waiting;
  document.getElementById('dd-completed-count').innerText = completed;
  document.getElementById('dd-fee').innerText             = u.fee;

  var badge = 'badge-available';
  if (u.status === 'In Session') badge = 'badge-insession';
  if (u.status === 'Off Duty')   badge = 'badge-offduty';
  document.getElementById('dd-status-badge').innerHTML =
    '<span class="badge ' + badge + '" style="font-size:16px;margin-bottom:8px;">' + u.status + '</span>' +
    '<div class="text-sm text-muted"><b>Hours:</b> ' + (u.workingHours ? u.workingHours.start : '') + ' - ' + (u.workingHours ? u.workingHours.end : '') + '</div>' +
    '<div class="text-sm text-muted"><b>Days:</b> ' + (u.workingDays||[]).join(', ') + '</div>';

  var active = queue.filter(function(q){ return q.status==='waiting'||q.status==='serving'; })
                    .sort(function(a,b){ return a.queue_position - b.queue_position; });
  var tbody = document.querySelector('#table-doctor-queue tbody');
  if (!active.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No patients in queue.</td></tr>';
  } else {
    tbody.innerHTML = active.map(function(q) {
      var time = new Date(q.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      return '<tr>' +
        '<td>' + (q.status==='serving' ? '-' : q.queue_position) + '</td>' +
        '<td><b>' + q.token_id + '</b></td>' +
        '<td>' + q.patient_name + '</td>' +
        '<td>' + (q.is_emergency ? '<span class="badge badge-red">EMERGENCY</span>' : '<span class="badge badge-grey">Regular</span>') + '</td>' +
        '<td>' + time + '</td>' +
        '<td>' + (q.status==='serving'
          ? '<button class="btn btn-primary" style="padding:6px 12px;font-size:12px;" onclick="callNextPatient()">Mark Served</button>'
          : '<span class="text-muted">Waiting</span>') + '</td>' +
      '</tr>';
    }).join('');
  }
}

async function renderDoctorQueue() {
  var u     = state.currentUser;
  var queue = await api('api/queue.php?action=list&doctor_id=' + u.id, {}, 'GET');
  var active = queue.filter(function(q){ return q.status==='waiting'||q.status==='serving'; })
                    .sort(function(a,b){ return a.queue_position - b.queue_position; });
  var srv = null;
  active.forEach(function(q){ if (q.status==='serving') srv = q; });

  document.getElementById('dq-serving-token').innerText = srv ? srv.token_id     : '--';
  document.getElementById('dq-serving-name').innerText  = srv ? srv.patient_name : 'No Patient';

  var tbody = document.querySelector('#table-doctor-full-queue tbody');
  if (!active.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No patients in queue.</td></tr>';
  } else {
    tbody.innerHTML = active.map(function(q) {
      var time = new Date(q.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      return '<tr>' +
        '<td>' + (q.status==='serving' ? '-' : q.queue_position) + '</td>' +
        '<td><b>' + q.token_id + '</b></td>' +
        '<td>' + q.patient_name + '</td>' +
        '<td>' + (q.is_emergency ? '<span class="badge badge-red">EMERGENCY</span>' : '<span class="badge badge-grey">Regular</span>') + '</td>' +
        '<td>' + time + '</td>' +
        '<td>' + (q.status==='waiting'
          ? '<button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;" onclick="promotePatient(' + q.id + ')">Promote</button>'
          : '<button class="btn btn-primary" style="padding:6px 12px;font-size:12px;" onclick="callNextPatient()">Served</button>') + '</td>' +
      '</tr>';
    }).join('');
  }
}

async function callNextPatient() {
  var data = await api('api/queue.php', {action:'next'});
  if (data.success) showToast('Called Token ' + data.token, 'info');
  else showToast('No more patients in queue', 'warning');
  if (state.currentRoute === 'doctor/queue')     renderDoctorQueue();
  if (state.currentRoute === 'doctor/dashboard') renderDoctorDashboard();
}

async function promotePatient(qid) {
  await api('api/queue.php', {action:'promote', queue_id:qid});
  renderDoctorQueue();
}

function renderDoctorSettings() {
  var u = state.currentUser;
  document.getElementById('ds-fee').value    = u.fee;
  document.getElementById('ds-status').value = u.status;
  document.getElementById('ds-start').value  = u.workingHours ? u.workingHours.start : '09:00';
  document.getElementById('ds-end').value    = u.workingHours ? u.workingHours.end   : '17:00';
  document.getElementById('ds-bio').value    = u.bio || '';
  var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  document.getElementById('ds-days').innerHTML = days.map(function(d) {
    return '<div class="pill ' + ((u.workingDays||[]).indexOf(d)!==-1 ? 'active' : '') + '" onclick="this.classList.toggle(\'active\')">' + d + '</div>';
  }).join('');

  document.getElementById('form-doc-settings').onsubmit = async function(e) {
    e.preventDefault();
    var workingDays = Array.from(document.querySelectorAll('#ds-days .pill.active')).map(function(el){ return el.innerText; });
    var data = await api('api/doctors.php', {
      action:       'settings',
      fee:          document.getElementById('ds-fee').value,
      status:       document.getElementById('ds-status').value,
      start:        document.getElementById('ds-start').value,
      end:          document.getElementById('ds-end').value,
      bio:          document.getElementById('ds-bio').value,
      working_days: JSON.stringify(workingDays)
    });
    if (data.success) {
      state.currentUser = data.user;
      showToast('Settings saved', 'success');
    }
  };
}

// ─── ADMIN VIEWS ──────────────────────────────────────
async function renderAdminDashboard() {
  var docs     = await loadDoctors();
  var queue    = await api('api/queue.php?action=list', {}, 'GET');
  var patients = await api('api/patients.php?action=list', {}, 'GET');

  var activeQ   = queue.filter(function(q){ return q.status==='waiting'||q.status==='serving'; });
  var completed = queue.filter(function(q){ return q.status==='completed'; }).length;
  var eff       = queue.length === 0 ? 0 : Math.round((completed / queue.length) * 100);

  document.getElementById('ad-doc-count').innerText   = docs.length;
  document.getElementById('ad-pat-count').innerText   = patients.length;
  document.getElementById('ad-queue-count').innerText = activeQ.length;
  document.getElementById('ad-eff').innerText         = eff + '%';

  var pulse = document.getElementById('ad-pulse');
  if (eff > 70)       { pulse.innerText = 'Healthy';  pulse.className = 'badge badge-green w-full text-center'; }
  else if (eff >= 40) { pulse.innerText = 'Moderate'; pulse.className = 'badge badge-amber w-full text-center'; }
  else                { pulse.innerText = 'Critical'; pulse.className = 'badge badge-red w-full text-center'; }

  var alerts = [];
  docs.forEach(function(d) {
    var qCount = activeQ.filter(function(q){ return q.doctor_id == d.id; }).length;
    if (qCount > 8) alerts.push('<div class="card mb-4" style="border-left:4px solid var(--danger-crimson);"><h4 class="text-danger">System Overload</h4><p class="text-sm mt-2">' + d.name + ' has ' + qCount + ' patients waiting.</p></div>');
  });
  document.getElementById('ad-alerts').innerHTML = alerts.length ? alerts.join('') : '<div class="text-muted">No critical alerts.</div>';

  var tbody = document.querySelector('#table-admin-doctors-mini tbody');
  tbody.innerHTML = docs.slice(0,5).map(function(d) {
    var badge = 'badge-available';
    if (d.status === 'In Session') badge = 'badge-insession';
    if (d.status === 'Off Duty')   badge = 'badge-offduty';
    var tkCount = activeQ.filter(function(q){ return q.doctor_id == d.id; }).length;
    return '<tr><td>' + d.name + '</td><td>' + d.specialty + '</td><td><span class="badge ' + badge + '">' + d.status + '</span></td><td>' + tkCount + '</td></tr>';
  }).join('');
}

async function renderAdminDoctors() {
  var docs  = await loadDoctors();
  var tbody = document.querySelector('#table-admin-doctors-full tbody');
  if (!docs.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No doctors found.</td></tr>'; return; }
  tbody.innerHTML = docs.map(function(d) {
    var badge = 'badge-available';
    if (d.status === 'In Session') badge = 'badge-insession';
    if (d.status === 'Off Duty')   badge = 'badge-offduty';
    return '<tr>' +
      '<td><b>' + d.name + '</b><br><small class="text-muted">' + d.email + '</small></td>' +
      '<td>' + d.specialty + '</td>' +
      '<td><span class="badge ' + badge + '">' + d.status + '</span></td>' +
      '<td>BDT ' + d.fee + '</td>' +
      '<td>' + d.workingHours.start + ' - ' + d.workingHours.end + '</td>' +
      '<td><button class="btn btn-danger" style="padding:4px 8px;font-size:12px;" onclick="deleteDoctor(' + d.id + ')">Delete</button></td>' +
    '</tr>';
  }).join('');
}

function openAddDoctorModal() {
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('modal-body').innerHTML =
    '<h3 class="mb-4">Add New Doctor</h3>' +
    '<form id="form-add-doctor">' +
      '<div class="form-group"><label class="form-label">Name</label><input type="text" id="add-doc-name" class="form-control" required></div>' +
      '<div class="form-group"><label class="form-label">Email</label><input type="email" id="add-doc-email" class="form-control" required></div>' +
      '<div class="form-group"><label class="form-label">Password</label><input type="text" id="add-doc-password" class="form-control" required></div>' +
      '<div class="form-group"><label class="form-label">Specialty</label><input type="text" id="add-doc-spec" class="form-control" required></div>' +
      '<div class="form-group"><label class="form-label">Consultation Fee (BDT)</label><input type="number" id="add-doc-fee" class="form-control" required></div>' +
      '<div id="add-doc-error" class="text-danger mb-4 d-none"></div>' +
      '<button type="submit" class="btn btn-primary w-full">Save Doctor</button>' +
    '</form>';
  document.getElementById('form-add-doctor').onsubmit = async function(e) {
    e.preventDefault();
    var data = await api('api/doctors.php', {
      action:'add',
      name:      document.getElementById('add-doc-name').value,
      email:     document.getElementById('add-doc-email').value,
      password:  document.getElementById('add-doc-password').value,
      specialty: document.getElementById('add-doc-spec').value,
      fee:       document.getElementById('add-doc-fee').value
    });
    var errEl = document.getElementById('add-doc-error');
    if (data.success) {
      errEl.classList.add('d-none');
      showToast('Doctor added successfully', 'success');
      document.getElementById('modal-overlay').classList.remove('active');
      await loadDoctors(true);
      renderAdminDoctors();
      renderAdminDashboard();
    } else {
      errEl.innerText = data.error || 'Failed to add doctor';
      errEl.classList.remove('d-none');
    }
  };
}

async function deleteDoctor(id) {
  if (!confirm('Are you sure you want to remove this doctor?')) return;
  await api('api/doctors.php', {action:'delete', id:id});
  showToast('Doctor removed', 'success');
  await loadDoctors(true);
  renderAdminDoctors();
  renderAdminDashboard();
}

async function renderAdminPatients() {
  var patients = await api('api/patients.php?action=list', {}, 'GET');
  var tbody    = document.querySelector('#table-admin-patients tbody');
  if (!patients.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No patients found.</td></tr>'; return; }
  tbody.innerHTML = patients.map(function(p) {
    var conds = Object.keys(p.conditions || {}).filter(function(k){ return p.conditions[k]; }).join(', ') || 'None';
    return '<tr>' +
      '<td><b>' + p.name + '</b><br><small class="text-muted">' + p.email + '</small></td>' +
      '<td>' + (p.phone||'-') + '</td>' +
      '<td><span class="badge badge-grey">' + (p.blood_group||'-') + '</span></td>' +
      '<td style="max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + conds + '">' + conds + '</td>' +
      '<td>' + p.appointment_count + '</td>' +
    '</tr>';
  }).join('');
}

async function renderAdminTokens() {
  var rules = await loadRules();
  document.getElementById('tr-buffer').value    = rules.wait_time_buffer;
  document.getElementById('tr-buffer-val').innerText = rules.wait_time_buffer + ' min';
  document.getElementById('tr-buffer').oninput  = function(e){ document.getElementById('tr-buffer-val').innerText = e.target.value + ' min'; };
  document.getElementById('tr-penalty').value   = rules.penalty_duration;
  document.getElementById('tr-smart').checked   = !!parseInt(rules.smart_requeue);
  document.getElementById('tr-expiry').value    = rules.token_expiry_hours;
  document.getElementById('tr-max').value       = rules.max_daily_tokens;

  document.getElementById('form-token-rules').onsubmit = async function(e) {
    e.preventDefault();
    var data = await api('api/rules.php', {
      action:             'update',
      wait_time_buffer:   document.getElementById('tr-buffer').value,
      penalty_duration:   document.getElementById('tr-penalty').value,
      smart_requeue:      document.getElementById('tr-smart').checked ? 1 : 0,
      token_expiry_hours: document.getElementById('tr-expiry').value,
      max_daily_tokens:   document.getElementById('tr-max').value
    });
    if (data.success) showToast('Token Rules Updated', 'success');
  };

  var logs  = await api('api/rules.php?action=log', {}, 'GET');
  var tbody = document.querySelector('#table-admin-token-log tbody');
  if (!logs.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No token activity yet.</td></tr>'; return; }
  tbody.innerHTML = logs.map(function(q) {
    return '<tr><td><b>' + q.token_id + '</b></td><td>' + q.patient_name + '</td><td>' + q.doctor_name + '</td><td>' + q.created_at + '</td>' +
      '<td><span class="badge badge-grey">' + q.status + '</span></td></tr>';
  }).join('');
}

// ─── PUBLIC QUEUE ─────────────────────────────────────
async function renderPublicQueue() {
  var docs  = await loadDoctors();
  var queue = await api('api/queue.php?action=list', {}, 'GET');
  var grid  = document.getElementById('public-queue-grid');
  if (!docs.length) { grid.innerHTML = '<div class="empty-state w-full">No doctors available.</div>'; return; }
  grid.innerHTML = docs.map(function(d) {
    var serving = null;
    queue.forEach(function(q){ if (q.doctor_id == d.id && q.status==='serving') serving = q; });
    var token = serving ? serving.token_id : '--';
    var name  = serving ? maskName(serving.patient_name) : 'Waiting';
    var badge = 'badge-available';
    if (d.status === 'In Session') badge = 'badge-insession';
    if (d.status === 'Off Duty')   badge = 'badge-offduty';
    return '<div class="card" style="text-align:center;padding:40px 20px;">' +
      '<h2 style="color:var(--primary-navy);margin-bottom:8px;">' + d.name + '</h2>' +
      '<div class="mb-4"><span class="badge ' + badge + '">' + d.status + '</span></div>' +
      '<div class="text-muted mb-4">' + d.specialty + '</div>' +
      '<div style="background:var(--bg-soft-white);padding:24px;border-radius:16px;">' +
        '<div class="text-muted mb-2">NOW SERVING</div>' +
        '<div class="queue-token-large" style="font-size:48px;color:var(--accent-teal);">' + token + '</div>' +
        '<div style="font-size:20px;font-weight:600;margin-top:8px;">' + name + '</div>' +
      '</div></div>';
  }).join('');
}

// ─── HELPERS ──────────────────────────────────────────
async function loadDoctors(force) {
  if (!force && state.doctors.length) return state.doctors;
  state.doctors = await api('api/doctors.php?action=list', {}, 'GET');
  return state.doctors;
}

async function loadRules() {
  if (state.rules.wait_time_buffer) return state.rules;
  state.rules = await api('api/rules.php?action=get', {}, 'GET');
  return state.rules;
}

function maskName(name) {
  if (!name) return '';
  return name.split(' ').map(function(w){ return w[0] + '*'.repeat(Math.max(w.length-1,0)); }).join(' ');
}

function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; setTimeout(function(){ toast.remove(); }, 300); }, 3000);
}

function closeModal(e) {
  if (e.target.id === 'modal-overlay') document.getElementById('modal-overlay').classList.remove('active');
}

// ─── INIT ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
  var session = await api('api/auth.php', {action:'session'});
  if (session.logged_in) {
    state.currentUser = session.user;
    var r = session.user.role;
    navigate(r === 'admin' ? 'admin/dashboard' : r === 'doctor' ? 'doctor/dashboard' : 'patient/dashboard');
  } else {
    navigate('login');
  }
  setInterval(function() {
    if (state.currentRoute === 'patient/queue')     renderPatientQueue();
    if (state.currentRoute === 'doctor/dashboard')  renderDoctorDashboard();
    if (state.currentRoute === 'doctor/queue')      renderDoctorQueue();
    if (state.currentRoute === 'patient/dashboard') renderPatientDashboard();
    if (state.currentRoute === 'public/queue')      renderPublicQueue();
  }, 5000);
});
