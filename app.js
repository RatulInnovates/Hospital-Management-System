// ─── 1. CONSTANTS & CONFIG ───────────────────────────
const KEYS = {
  USERS: "azure_users",
  DOCTORS: "azure_doctors",
  APPOINTMENTS: "azure_appointments",
  QUEUE: "azure_queue",
  TOKENS: "azure_tokens",
  RULES: "azure_token_rules",
  CURRENT_USER: "azure_current_user",
};

// ─── 2. STATE ────────────────────────────────────────

let state = {
  currentUser: null,
  users: [],
  doctors: [],
  appointments: [],
  queue: [],
  tokens: [],
  rules: {},
  currentRoute: "login",
  bookingStep: 1,
  selectedDoctor: null,
  selectedDate: null,
  selectedTime: null,
  isEmergencyBooking: false,
};

// ─── 3. LOCALSTORAGE HELPERS ─────────────────────────
function loadData() {
  state.users = JSON.parse(localStorage.getItem(KEYS.USERS) || "[]");
  state.doctors = JSON.parse(localStorage.getItem(KEYS.DOCTORS) || "[]");
  state.appointments = JSON.parse(
    localStorage.getItem(KEYS.APPOINTMENTS) || "[]",
  );
  state.queue = JSON.parse(localStorage.getItem(KEYS.QUEUE) || "[]");
  state.tokens = JSON.parse(localStorage.getItem(KEYS.TOKENS) || "[]");
  state.rules = JSON.parse(localStorage.getItem(KEYS.RULES) || "{}");
  state.currentUser = JSON.parse(
    localStorage.getItem(KEYS.CURRENT_USER) || "null",
  );
}

function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  loadData();
}

// ─── 4. SEED DATA INITIALIZATION ─────────────────────
function initSeedData() {
  if (!localStorage.getItem(KEYS.USERS)) {
    const admin = {
      id: "admin-001",
      role: "admin",
      name: "Admin",
      email: "admin@azuresanctuary.com",
      password: "Admin@123",
    };
    saveData(KEYS.USERS, [admin]);
  }

  if (!localStorage.getItem(KEYS.DOCTORS)) {
    saveData(KEYS.DOCTORS, []);
  }

  if (!localStorage.getItem(KEYS.RULES)) {
    saveData(KEYS.RULES, {
      waitTimeBufferMin: 15,
      penaltyDurationHours: 1,
      smartReQueue: true,
      tokenExpiryHours: 4,
      maxDailyTokensPerDoctor: 30,
    });
  }
}

// ─── 5. ROUTER ───────────────────────────────────────
function navigate(route) {
  state.currentRoute = route;

  // Hide all views
  document
    .querySelectorAll("section")
    .forEach((el) => el.classList.remove("view--active"));

  // Show target
  const targetId = `view-${route.replace("/", "-")}`;
  const targetEl = document.getElementById(targetId);
  if (targetEl) targetEl.classList.add("view--active");
  else console.error("Route not found:", route);

  updateLayoutShell();

  // View specific logic
  if (route === "patient/dashboard") renderPatientDashboard();
  if (route === "patient/book") renderPatientBook();
  if (route === "patient/queue") renderPatientQueue();
  if (route === "patient/records") renderPatientRecords();
  if (route === "doctor/dashboard") renderDoctorDashboard();
  if (route === "doctor/queue") renderDoctorQueue();
  if (route === "doctor/settings") renderDoctorSettings();
  if (route === "admin/dashboard") renderAdminDashboard();
  if (route === "admin/doctors") renderAdminDoctors();
  if (route === "admin/patients") renderAdminPatients();
  if (route === "admin/tokens") renderAdminTokens();
  if (route === "public/queue") renderPublicQueue();
}

function updateLayoutShell() {
  const isAuth = ["login", "signup", "public/queue"].includes(state.currentRoute);
  const sidebar = document.getElementById("app-sidebar");
  const header = document.getElementById("app-header");
  const main = document.getElementById("app-main");

  if (isAuth) {
    sidebar.classList.add("d-none");
    header.classList.add("d-none");
    main.style.marginLeft = "0";
  } else {
    sidebar.classList.remove("d-none");
    header.classList.remove("d-none");
    main.style.marginLeft = "240px";

    // Update nav menu
    renderNavMenu();

    // Update header/avatar
    if (state.currentUser) {
      const parts = state.currentUser.name.split(" ");
      const initials = parts
        .map((p) => p[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
      document.getElementById("header-avatar").innerText = initials;

      const titleMap = {
        "patient/dashboard": "Dashboard",
        "patient/book": "Book Appointment",
        "patient/queue": "Live Queue",
        "patient/records": "Medical Records",
        "doctor/dashboard": "Doctor Dashboard",
        "doctor/queue": "Queue Management",
        "doctor/settings": "Settings",
        "admin/dashboard": "Admin Dashboard",
        "admin/doctors": "Manage Doctors",
        "admin/patients": "Patient History",
        "admin/tokens": "Token Rules",
      };
      document.getElementById("page-title").innerText =
        titleMap[state.currentRoute] || "Azure Sanctuary";

      document.getElementById("user-info").innerHTML = `
        <div class="avatar">${initials}</div>
        <div style="font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          <div>${state.currentUser.name}</div>
          <div class="text-muted" style="font-size:12px; text-transform:capitalize">${state.currentUser.role}</div>
        </div>
      `;

      const emBtn = document.getElementById("btn-emergency-nav");
      if (state.currentUser.role === "patient") {
        emBtn.classList.remove("d-none");
        emBtn.onclick = markAsEmergency;
      } else {
        emBtn.classList.add("d-none");
      }
    }
  }
}

function renderNavMenu() {
  const menu = document.getElementById("nav-menu");
  let items = [];
  const role = state.currentUser ? state.currentUser.role : "";

  if (role === "patient" || role === "guest") {
    items = [
      { label: "Dashboard", route: "patient/dashboard", icon: "🏠" },
      { label: "Book Appointment", route: "patient/book", icon: "📅" },
      { label: "Live Queue", route: "patient/queue", icon: "👥" },
      { label: "My Records", route: "patient/records", icon: "📂" },
    ];
  } else if (role === "doctor") {
    items = [
      { label: "Dashboard", route: "doctor/dashboard", icon: "🏠" },
      { label: "Queue Management", route: "doctor/queue", icon: "👥" },
      { label: "Settings", route: "doctor/settings", icon: "⚙️" },
    ];
  } else if (role === "admin") {
    items = [
      { label: "Dashboard", route: "admin/dashboard", icon: "🏠" },
      { label: "Manage Doctors", route: "admin/doctors", icon: "👨‍⚕️" },
      { label: "Patient History", route: "admin/patients", icon: "📂" },
      { label: "Token Rules", route: "admin/tokens", icon: "⚙️" },
    ];
  }

  menu.innerHTML = items
    .map(
      (it) => `
    <div class="nav-item ${state.currentRoute === it.route ? "active" : ""}" onclick="navigate('${it.route}')">
      <span>${it.icon}</span> <span>${it.label}</span>
    </div>
  `,
    )
    .join("");
}

// ─── 6. AUTH ─────────────────────────────────────────
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-password").value;
  const role = document.querySelector(".role-tab.active").dataset.role;

  const allUsers = [...state.users, ...state.doctors];
  const user = allUsers.find(
    (u) =>
      u.email === email &&
      u.password === pass &&
      (u.role === role || (role === "patient" && u.role === "patient")),
  );

  if (user) {
    document.getElementById("login-error").classList.add("d-none");
    saveData(KEYS.CURRENT_USER, user);
    showToast("Login successful", "success");
    navigate(`${user.role}/dashboard`);
  } else {
    document.getElementById("login-error").classList.remove("d-none");
  }
}

function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value;
  const email = document.getElementById("reg-email").value;
  const pass = document.getElementById("reg-password").value;
  const phone = document.getElementById("reg-phone").value;
  const age = document.getElementById("reg-age").value;
  const blood = document.getElementById("reg-blood").value;

  const newUser = {
    id: "pat-" + Date.now(),
    role: "patient",
    name,
    email,
    password: pass,
    phone,
    age,
    bloodGroup: blood,
    conditions: {
      diabetes: false,
      hypertension: false,
      heartDisease: false,
      asthma: false,
    },
  };

  const users = state.users;
  users.push(newUser);
  saveData(KEYS.USERS, users);
  saveData(KEYS.CURRENT_USER, newUser);
  showToast("Account created successfully", "success");
  navigate("patient/dashboard");
}

function handleGuestLogin() {
  const name = prompt("Enter your full name:");
  const phone = prompt("Enter your phone number:");
  if (name && phone) {
    const guestUser = { id: "guest-" + Date.now(), role: "guest", name, phone };
    saveData(KEYS.CURRENT_USER, guestUser);
    showToast("Logged in as Guest", "info");
    navigate("patient/dashboard");
  }
}

// ─── 7. QUEUE ENGINE ─────────────────────────────────
function sortQueue() {
  let queue = [...state.queue];
  // Sort logic: emergency first, then timestamp
  queue.sort((a, b) => {
    if (a.isEmergency && !b.isEmergency) return -1;
    if (!a.isEmergency && b.isEmergency) return 1;
    return a.timestamp - b.timestamp;
  });

  // Update positions for waiting
  let doctorPos = {};
  queue.forEach((q) => {
    if (q.status === "waiting") {
      if (!doctorPos[q.doctorId]) doctorPos[q.doctorId] = 1;
      q.queuePosition = doctorPos[q.doctorId]++;
    } else {
      q.queuePosition = 0;
    }
  });

  saveData(KEYS.QUEUE, queue);
}

function callNextPatient() {
  let queue = state.queue;
  const docId = state.currentUser.id;

  // Mark current serving as completed
  const current = queue.find(
    (q) => q.doctorId === docId && q.status === "serving",
  );
  if (current) current.status = "completed";

  // Find next waiting
  sortQueue();
  queue = JSON.parse(localStorage.getItem(KEYS.QUEUE));

  const next = queue.find(
    (q) => q.doctorId === docId && q.status === "waiting",
  );
  if (next) {
    next.status = "serving";
    showToast(`Called Token ${next.tokenId}`, "info");
  } else {
    showToast("No more patients in queue", "warning");
  }

  saveData(KEYS.QUEUE, queue);
  sortQueue();
  renderDoctorQueue();
}

function markAsEmergency() {
  if (!state.currentUser) return;
  let queue = state.queue;
  const active = queue.find(
    (q) => q.patientId === state.currentUser.id && q.status === "waiting",
  );
  if (active) {
    active.isEmergency = true;
    saveData(KEYS.QUEUE, queue);
    sortQueue();
    showToast("Your case has been marked as priority", "warning");
    renderPatientDashboard();
    const btn = document.getElementById("btn-emergency-nav");
    if (btn) btn.classList.add("emergency-pulse");
  } else {
    showToast("You have no active token to mark as emergency", "error");
  }
}

// ─── 8. TOKEN GENERATOR ──────────────────────────────
function generateToken(docId) {
  const doc = state.doctors.find((d) => d.id === docId);
  const spec = doc.specialty.substring(0, 3).toUpperCase();
  const num = String(state.appointments.length + 1).padStart(4, "0");
  return `AS-${spec}-${num}`;
}

// ─── 9. PATIENT VIEWS ────────────────────────────────
function renderPatientDashboard() {
  const u = state.currentUser;
  let name = u.name;
  if (u.role === "guest") name += " (Guest)";

  const hr = new Date().getHours();
  const greeting =
    hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  document.getElementById("pd-welcome").innerText = `${greeting}, ${name}`;
  document.getElementById("pd-date").innerText = new Date().toLocaleDateString(
    "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" },
  );

  // Active token
  const activeQueue = state.queue.find(
    (q) => q.patientId === u.id && ["waiting", "serving"].includes(q.status),
  );
  const tc = document.getElementById("pd-active-token");
  if (activeQueue) {
    tc.classList.remove("d-none");
    const doc = state.doctors.find((d) => d.id === activeQueue.doctorId);
    const estWait =
      activeQueue.status === "serving"
        ? 0
        : activeQueue.queuePosition * state.rules.waitTimeBufferMin;

    tc.innerHTML = `
      <div class="flex justify-between items-center p-4">
        <div>
          <div class="text-muted text-sm">Active Token</div>
          <h2 class="queue-token-large" style="font-size:32px; color:var(--primary-navy);">${activeQueue.tokenId}</h2>
          <div class="mt-2"><b>Doctor:</b> ${doc.name}</div>
          <div><b>Status:</b> <span class="badge ${activeQueue.status === "serving" ? "badge-green" : "badge-cyan"}">${activeQueue.status.toUpperCase()}</span></div>
        </div>
        <div style="text-align:right;">
          <div class="text-muted">Queue Position</div>
          <h2 style="font-size:48px; color:var(--accent-teal);">${activeQueue.queuePosition}</h2>
          <div class="text-muted">Est. Wait: ${estWait} min</div>
        </div>
      </div>
      ${!activeQueue.isEmergency && activeQueue.status !== "serving" ? `<button class="btn btn-danger mt-4 w-full" style="font-weight: bold; font-size: 18px;" onclick="markAsEmergency()">🚨 Mark as Emergency 🚨</button>` : ""}
    `;
  } else {
    tc.classList.add("d-none");
  }

  // Appointments table
  const tbody = document.querySelector("#table-patient-appointments tbody");
  const myApps = state.appointments
    .filter((a) => a.patientId === u.id)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (myApps.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No appointments found.</td></tr>`;
  } else {
    tbody.innerHTML = myApps
      .map((a) => {
        const doc = state.doctors.find((d) => d.id === a.doctorId);
        return `<tr>
        <td><b>${a.tokenId}</b></td>
        <td>${doc.name}</td>
        <td>${doc.specialty}</td>
        <td>${a.date} ${a.time}</td>
        <td><span class="badge badge-grey">${a.status}</span></td>
        <td>BDT ${doc.fee}</td>
      </tr>`;
      })
      .join("");
  }
}

function renderPatientBook() {
  setBookingStep(1);

  // Render filters
  const specs = [...new Set(state.doctors.map((d) => d.specialty))];
  document.getElementById("specialty-filters").innerHTML =
    `<div class="pill active" onclick="filterDoctors('All')">All</div>` +
    specs
      .map(
        (s) => `<div class="pill" onclick="filterDoctors('${s}')">${s}</div>`,
      )
      .join("");

  renderDoctorsGrid(state.doctors);
}

function filterDoctors(spec) {
  document
    .querySelectorAll("#specialty-filters .pill")
    .forEach((p) => p.classList.remove("active"));
  event.target.classList.add("active");

  if (spec === "All") renderDoctorsGrid(state.doctors);
  else renderDoctorsGrid(state.doctors.filter((d) => d.specialty === spec));
}

function renderDoctorsGrid(docs) {
  const grid = document.getElementById("doctor-selection-grid");
  grid.innerHTML = docs
    .map((d) => {
      let badge = "badge-available";
      if (d.status === "In Session") badge = "badge-insession";
      if (d.status === "Off Duty") badge = "badge-offduty";

      return `
    <div class="doctor-card ${state.selectedDoctor === d.id ? "selected" : ""}" onclick="selectDoctor('${d.id}')">
      <div class="flex justify-between items-center mb-2">
        <h4 style="color:var(--primary-navy);">${d.name}</h4>
        <span class="badge ${badge}">${d.status}</span>
      </div>
      <div class="text-muted text-sm mb-2">${d.specialty}</div>
      <div class="text-sm"><b>Fee:</b> BDT ${d.fee}</div>
      <div class="text-sm text-muted mt-2">Hours: ${d.workingHours.start} - ${d.workingHours.end}</div>
      <div class="text-sm text-muted mt-1">Days: ${d.workingDays.join(', ')}</div>
    </div>
  `;
    })
    .join("");
}

function selectDoctor(id) {
  state.selectedDoctor = id;
  renderDoctorsGrid(state.doctors); // re-render to show selection
  document.getElementById("btn-next-2").disabled = false;
  document.getElementById("btn-next-2").onclick = () => {
    const doc = state.doctors.find((d) => d.id === id);
    if (doc.status === "Off Duty") {
      showToast(
        "Doctor is Off Duty. You can book for a future date.",
        "warning",
      );
    }
    setBookingStep(2);
  };
}

function setBookingStep(step) {
  state.bookingStep = step;
  [1, 2, 3].forEach((s) => {
    document.getElementById(`book-step-${s}`).classList.add("d-none");
    document.getElementById(`step${s}-ind`).classList.remove("active");
  });
  document.getElementById(`book-step-${step}`).classList.remove("d-none");
  for (let i = 1; i <= step; i++)
    document.getElementById(`step${i}-ind`).classList.add("active");

  if (step === 2) {
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("book-date").min = today;
    if (!document.getElementById("book-date").value)
      document.getElementById("book-date").value = today;

    // Generate times
    const doc = state.doctors.find((d) => d.id === state.selectedDoctor);
    const start = parseInt(doc.workingHours.start.split(":")[0]);
    const end = parseInt(doc.workingHours.end.split(":")[0]);
    let opts = "";
    for (let h = start; h < end; h++) {
      opts += `<option value="${h}:00">${h}:00</option><option value="${h}:30">${h}:30</option>`;
    }
    document.getElementById("book-time").innerHTML = opts;

    document.getElementById("btn-next-3").disabled = false;
    document.getElementById("btn-next-3").onclick = () => {
      state.selectedDate = document.getElementById("book-date").value;
      state.selectedTime = document.getElementById("book-time").value;
      state.isEmergencyBooking =
        document.getElementById("book-emergency").checked;
      setBookingStep(3);
    };
  }

  if (step === 3) {
    const doc = state.doctors.find((d) => d.id === state.selectedDoctor);
    document.getElementById("book-summary").innerHTML = `
      <div class="mb-2"><b>Doctor:</b> ${doc.name} (${doc.specialty})</div>
      <div class="mb-2"><b>Date:</b> ${state.selectedDate}</div>
      <div class="mb-2"><b>Time:</b> ${state.selectedTime}</div>
      <div class="mb-2"><b>Fee:</b> BDT ${doc.fee}</div>
      ${state.isEmergencyBooking ? `<div class="text-danger mt-2"><b>🚨 Emergency Priority Case</b></div>` : ""}
    `;
  }
}

function confirmBooking() {
  const token = generateToken(state.selectedDoctor);
  const u = state.currentUser;

  const appt = {
    id: "apt-" + Date.now(),
    tokenId: token,
    patientId: u.id,
    patientName: u.name,
    doctorId: state.selectedDoctor,
    date: state.selectedDate,
    time: state.selectedTime,
    status: "booked",
    timestamp: Date.now(),
  };

  const qEntry = {
    id: "queue-" + Date.now(),
    tokenId: token,
    patientId: u.id,
    patientName: u.name,
    doctorId: state.selectedDoctor,
    isEmergency: state.isEmergencyBooking,
    status: "waiting",
    queuePosition: 0,
    timestamp: Date.now(),
  };

  state.appointments.push(appt);
  state.queue.push(qEntry);
  saveData(KEYS.APPOINTMENTS, state.appointments);
  saveData(KEYS.QUEUE, state.queue);
  sortQueue();

  showToast("Booking Confirmed!", "success");
  navigate("patient/dashboard");
}

function renderPatientQueue() {
  const u = state.currentUser;

  const myQueue = state.queue.find(
    (q) => q.patientId === u.id && ["waiting", "serving"].includes(q.status),
  );
  let docId = myQueue ? myQueue.doctorId : state.doctors[0]?.id;

  const docQueue = state.queue
    .filter(
      (q) => q.doctorId === docId && ["waiting", "serving"].includes(q.status),
    )
    .sort((a, b) => a.queuePosition - b.queuePosition);

  const srv = docQueue.find((q) => q.status === "serving");
  if (srv) {
    document.getElementById("pq-serving").classList.remove("d-none");
    document.getElementById("pq-serving-token").innerText = srv.tokenId;
    document.getElementById("pq-serving-name").innerText = maskName(
      srv.patientName,
    );
  } else {
    document.getElementById("pq-serving").classList.add("d-none");
  }

  const tbody = document.querySelector("#table-patient-queue tbody");
  if (docQueue.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Queue is empty.</td></tr>`;
  } else {
    tbody.innerHTML = docQueue
      .map((q) => {
        const wait =
          q.status === "serving"
            ? 0
            : q.queuePosition * state.rules.waitTimeBufferMin;
        const highlight = q.patientId === u.id ? "background: #E6FFFA;" : "";
        return `<tr style="${highlight}">
        <td><h3 style="margin:0">${q.status === "serving" ? "-" : q.queuePosition}</h3></td>
        <td><b>${q.tokenId}</b></td>
        <td>${q.patientId === u.id ? q.patientName : maskName(q.patientName)}</td>
        <td>${q.isEmergency ? '<span class="badge badge-red emergency-pulse">EMERGENCY</span>' : '<span class="badge badge-grey">Regular</span>'}</td>
        <td>${q.status === "serving" ? "Now" : wait + " min"}</td>
      </tr>`;
      })
      .join("");
  }
}

function maskName(name) {
  if (!name) return "";
  const p = name.split(" ");
  return p.map((w) => w[0] + "*".repeat(w.length - 1)).join(" ");
}

function renderPatientRecords() {
  const u = state.currentUser;
  if (u.role === "guest") return;

  document.getElementById("pr-profile").innerHTML = `
    <div class="mb-2"><b>Name:</b> ${u.name}</div>
    <div class="mb-2"><b>Age:</b> ${u.age}</div>
    <div class="mb-2"><b>Blood Group:</b> ${u.bloodGroup}</div>
    <div class="mb-2"><b>Phone:</b> ${u.phone}</div>
  `;

  const conds = u.conditions || {};
  document.getElementById("pr-conditions").innerHTML = Object.keys(conds)
    .map(
      (k) => `
    <div class="flex justify-between items-center p-2" style="border:1px solid var(--border-light); border-radius:8px;">
      <span style="text-transform:capitalize;">${k.replace(/([A-Z])/g, " $1").trim()}</span>
      <label class="toggle-switch">
        <input type="checkbox" id="cond-${k}" ${conds[k] ? "checked" : ""}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `,
    )
    .join("");
}

function savePatientConditions() {
  const u = state.currentUser;
  const conds = u.conditions;
  Object.keys(conds).forEach((k) => {
    conds[k] = document.getElementById(`cond-${k}`).checked;
  });
  const users = state.users.map((user) => (user.id === u.id ? u : user));
  saveData(KEYS.USERS, users);
  showToast("Conditions updated", "success");
}

// ─── 10. DOCTOR VIEWS ────────────────────────────────
function renderDoctorDashboard() {
  const u = state.currentUser;
  const today = new Date().toISOString().split("T")[0];

  const myQueue = state.queue.filter((q) => q.doctorId === u.id);
  const waiting = myQueue.filter((q) => q.status === "waiting").length;
  const completed = myQueue.filter(
    (q) =>
      q.status === "completed" &&
      new Date(q.timestamp).toISOString().split("T")[0] === today,
  ).length;

  document.getElementById("dd-queue-count").innerText = waiting;
  document.getElementById("dd-completed-count").innerText = completed;
  document.getElementById("dd-fee").innerText = u.fee;

  let badge = "badge-available";
  if (u.status === "In Session") badge = "badge-insession";
  if (u.status === "Off Duty") badge = "badge-offduty";
  document.getElementById("dd-status-badge").innerHTML =
    `<span class="badge ${badge}" style="font-size:16px; margin-bottom: 8px;">${u.status}</span>
     <div class="text-sm text-muted"><b>Hours:</b> ${u.workingHours.start} - ${u.workingHours.end}</div>
     <div class="text-sm text-muted"><b>Days:</b> ${u.workingDays.join(', ')}</div>`;

  const tbody = document.querySelector("#table-doctor-queue tbody");
  const active = myQueue
    .filter((q) => ["waiting", "serving"].includes(q.status))
    .sort((a, b) => a.queuePosition - b.queuePosition);

  if (active.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No patients in queue.</td></tr>`;
  } else {
    tbody.innerHTML = active
      .map((q) => {
        const time = new Date(q.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `<tr>
        <td>${q.status === "serving" ? "-" : q.queuePosition}</td>
        <td><b>${q.tokenId}</b></td>
        <td>${q.patientName}</td>
        <td>${q.isEmergency ? '<span class="badge badge-red">EMERGENCY</span>' : '<span class="badge badge-grey">Regular</span>'}</td>
        <td>${time}</td>
        <td>
          ${
            q.status === "serving"
              ? `<button class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="callNextPatient()">Mark Served</button>`
              : `<span class="text-muted">Waiting</span>`
          }
        </td>
      </tr>`;
      })
      .join("");
  }
}

function renderDoctorQueue() {
  const u = state.currentUser;
  const active = state.queue
    .filter(
      (q) => q.doctorId === u.id && ["waiting", "serving"].includes(q.status),
    )
    .sort((a, b) => a.queuePosition - b.queuePosition);

  const srv = active.find((q) => q.status === "serving");
  if (srv) {
    document.getElementById("dq-serving-token").innerText = srv.tokenId;
    document.getElementById("dq-serving-name").innerText = srv.patientName;
  } else {
    document.getElementById("dq-serving-token").innerText = "--";
    document.getElementById("dq-serving-name").innerText = "No Patient";
  }

  const tbody = document.querySelector("#table-doctor-full-queue tbody");
  if (active.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No patients in queue.</td></tr>`;
  } else {
    tbody.innerHTML = active
      .map((q) => {
        const time = new Date(q.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `<tr>
        <td>${q.status === "serving" ? "-" : q.queuePosition}</td>
        <td><b>${q.tokenId}</b></td>
        <td>${q.patientName}</td>
        <td>${q.isEmergency ? '<span class="badge badge-red">EMERGENCY</span>' : '<span class="badge badge-grey">Regular</span>'}</td>
        <td>${time}</td>
        <td>
          ${
            q.status === "waiting"
              ? `<button class="btn btn-secondary" style="padding:6px 12px; font-size:12px;" onclick="promotePatient('${q.id}')">Promote</button>`
              : `<button class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="callNextPatient()">Served</button>`
          }
        </td>
      </tr>`;
      })
      .join("");
  }
}

function promotePatient(qId) {
  let queue = state.queue;
  const docId = state.currentUser.id;
  const current = queue.find(
    (q) => q.doctorId === docId && q.status === "serving",
  );
  if (current) current.status = "completed";

  const target = queue.find((q) => q.id === qId);
  if (target) target.status = "serving";

  saveData(KEYS.QUEUE, queue);
  sortQueue();
  renderDoctorQueue();
}

function renderDoctorSettings() {
  const u = state.currentUser;
  document.getElementById("ds-fee").value = u.fee;
  document.getElementById("ds-status").value = u.status;
  document.getElementById("ds-start").value = u.workingHours.start;
  document.getElementById("ds-end").value = u.workingHours.end;
  document.getElementById("ds-bio").value = u.bio;

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  document.getElementById("ds-days").innerHTML = days
    .map(
      (d) => `
    <div class="pill ${u.workingDays.includes(d) ? "active" : ""}" onclick="this.classList.toggle('active')">${d}</div>
  `,
    )
    .join("");

  document.getElementById("form-doc-settings").onsubmit = (e) => {
    e.preventDefault();
    u.fee = document.getElementById("ds-fee").value;
    u.status = document.getElementById("ds-status").value;
    u.workingHours.start = document.getElementById("ds-start").value;
    u.workingHours.end = document.getElementById("ds-end").value;
    u.bio = document.getElementById("ds-bio").value;

    const activeDays = Array.from(
      document.querySelectorAll("#ds-days .pill.active"),
    ).map((el) => el.innerText);
    u.workingDays = activeDays;

    const docs = state.doctors.map((d) => (d.id === u.id ? u : d));
    saveData(KEYS.DOCTORS, docs);
    saveData(KEYS.CURRENT_USER, u);
    showToast("Settings saved", "success");
  };
}

// ─── 11. ADMIN VIEWS ─────────────────────────────────
function renderAdminDashboard() {
  document.getElementById("ad-doc-count").innerText = state.doctors.length;
  document.getElementById("ad-pat-count").innerText = state.users.filter(
    (u) => u.role === "patient",
  ).length;

  const activeQ = state.queue.filter((q) =>
    ["waiting", "serving"].includes(q.status),
  );
  document.getElementById("ad-queue-count").innerText = activeQ.length;

  const completed = state.queue.filter((q) => q.status === "completed").length;
  const total = state.queue.length;
  const eff = total === 0 ? 0 : Math.round((completed / total) * 100);
  document.getElementById("ad-eff").innerText = eff + "%";

  const pulse = document.getElementById("ad-pulse");
  if (eff > 70) {
    pulse.innerText = "Healthy";
    pulse.className = "badge badge-green w-full text-center";
  } else if (eff >= 40) {
    pulse.innerText = "Moderate";
    pulse.className = "badge badge-amber w-full text-center";
  } else {
    pulse.innerText = "Critical";
    pulse.className = "badge badge-red w-full text-center";
  }

  const alerts = [];
  state.doctors.forEach((d) => {
    const qCount = activeQ.filter((q) => q.doctorId === d.id).length;
    if (qCount > 8) {
      alerts.push(`<div class="card mb-4" style="border-left:4px solid var(--danger-crimson);">
        <h4 class="text-danger">System Overload</h4>
        <p class="text-sm mt-2">Dr. ${d.name} has ${qCount} patients waiting.</p>
        <button class="btn btn-secondary mt-2" style="padding:4px 8px; font-size:12px;">Route to General</button>
      </div>`);
    }
  });

  if (alerts.length === 0)
    alerts.push(`<div class="text-muted">No critical alerts.</div>`);
  document.getElementById("ad-alerts").innerHTML = alerts.join("");

  const tbody = document.querySelector("#table-admin-doctors-mini tbody");
  tbody.innerHTML = state.doctors
    .slice(0, 5)
    .map((d) => {
      let badge = "badge-available";
      if (d.status === "In Session") badge = "badge-insession";
      if (d.status === "Off Duty") badge = "badge-offduty";
      const tkCount = activeQ.filter((q) => q.doctorId === d.id).length;
      return `<tr>
      <td>${d.name}</td>
      <td>${d.specialty}</td>
      <td><span class="badge ${badge}">${d.status}</span></td>
      <td>${tkCount}</td>
    </tr>`;
    })
    .join("");
}

function renderAdminDoctors() {
  const tbody = document.querySelector("#table-admin-doctors-full tbody");
  tbody.innerHTML = state.doctors
    .map((d) => {
      let badge = "badge-available";
      if (d.status === "In Session") badge = "badge-insession";
      if (d.status === "Off Duty") badge = "badge-offduty";
      return `<tr>
      <td><b>${d.name}</b><br><small class="text-muted">${d.email}</small></td>
      <td>${d.specialty}</td>
      <td><span class="badge ${badge}">${d.status}</span></td>
      <td>BDT ${d.fee}</td>
      <td>${d.workingHours.start} - ${d.workingHours.end}</td>
      <td>
        <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="deleteDoctor('${d.id}')">Delete</button>
      </td>
    </tr>`;
    })
    .join("");
}

function openAddDoctorModal() {
  document.getElementById("modal-overlay").classList.add("active");
  document.getElementById("modal-body").innerHTML = `
    <h3 class="mb-4">Add New Doctor</h3>
    <form id="form-add-doctor">
      <div class="form-group"><label class="form-label">Name</label><input type="text" id="add-doc-name" class="form-control" required></div>
      <div class="form-group"><label class="form-label">Email</label><input type="email" id="add-doc-email" class="form-control" required></div>
      <div class="form-group"><label class="form-label">Password</label><input type="text" id="add-doc-password" class="form-control" required></div>
      <div class="form-group"><label class="form-label">Specialty</label><input type="text" id="add-doc-spec" class="form-control" required></div>
      <div class="form-group"><label class="form-label">Consultation Fee</label><input type="number" id="add-doc-fee" class="form-control" required></div>
      <button type="submit" class="btn btn-primary w-full">Save Doctor</button>
    </form>
  `;
  document.getElementById("form-add-doctor").onsubmit = (e) => {
    e.preventDefault();
    const newDoc = {
      id: "doc-" + Date.now(),
      role: "doctor",
      name: "Dr. " + document.getElementById("add-doc-name").value,
      email: document.getElementById("add-doc-email").value,
      password: document.getElementById("add-doc-password").value,
      specialty: document.getElementById("add-doc-spec").value,
      fee: parseInt(document.getElementById("add-doc-fee").value) || 1000,
      status: "Available",
      workingHours: { start: "09:00", end: "17:00" },
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      bio: "Newly added doctor."
    };
    const docs = state.doctors;
    docs.push(newDoc);
    saveData(KEYS.DOCTORS, docs);
    showToast("Doctor added successfully", "success");
    document.getElementById("modal-overlay").classList.remove("active");
    renderAdminDoctors();
    renderAdminDashboard();
  };
}

function deleteDoctor(id) {
  if (confirm("Are you sure you want to remove this doctor?")) {
    const docs = state.doctors.filter(d => d.id !== id);
    saveData(KEYS.DOCTORS, docs);
    renderAdminDoctors();
    renderAdminDashboard();
  }
}

function renderPublicQueue() {
  const grid = document.getElementById("public-queue-grid");
  if (!state.doctors || state.doctors.length === 0) {
    grid.innerHTML = `<div class="empty-state w-full">No doctors available.</div>`;
    return;
  }
  
  grid.innerHTML = state.doctors.map(d => {
    const serving = state.queue.find(q => q.doctorId === d.id && q.status === "serving");
    const token = serving ? serving.tokenId : "--";
    const patientName = serving ? maskName(serving.patientName) : "Waiting";
    
    let badge = "badge-available";
    if (d.status === "In Session") badge = "badge-insession";
    if (d.status === "Off Duty") badge = "badge-offduty";

    return `
      <div class="card" style="text-align:center; padding: 40px 20px;">
        <h2 style="color:var(--primary-navy); margin-bottom: 8px;">${d.name}</h2>
        <div class="mb-4"><span class="badge ${badge}">${d.status}</span></div>
        <div class="text-muted mb-4">${d.specialty}</div>
        <div style="background:var(--bg-soft-white); padding: 24px; border-radius: 16px;">
          <div class="text-muted mb-2">NOW SERVING</div>
          <div class="queue-token-large" style="font-size:48px; color:var(--accent-teal);">${token}</div>
          <div style="font-size:20px; font-weight:600; margin-top:8px;">${patientName}</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderAdminPatients() {
  const tbody = document.querySelector("#table-admin-patients tbody");
  const pats = state.users.filter((u) => u.role === "patient");
  tbody.innerHTML = pats
    .map((p) => {
      const appts = state.appointments.filter(
        (a) => a.patientId === p.id,
      ).length;
      const conds =
        Object.keys(p.conditions || {})
          .filter((k) => p.conditions[k])
          .join(", ") || "None";
      return `<tr>
      <td><b>${p.name}</b><br><small class="text-muted">${p.email}</small></td>
      <td>${p.phone}</td>
      <td><span class="badge badge-grey">${p.bloodGroup}</span></td>
      <td style="max-width:150px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${conds}">${conds}</td>
      <td>${appts}</td>
    </tr>`;
    })
    .join("");
}

function renderAdminTokens() {
  document.getElementById("tr-buffer").value = state.rules.waitTimeBufferMin;
  document.getElementById("tr-buffer-val").innerText =
    state.rules.waitTimeBufferMin + " min";
  document.getElementById("tr-buffer").oninput = (e) =>
    (document.getElementById("tr-buffer-val").innerText =
      e.target.value + " min");

  document.getElementById("tr-penalty").value =
    state.rules.penaltyDurationHours;
  document.getElementById("tr-smart").checked = state.rules.smartReQueue;
  document.getElementById("tr-expiry").value = state.rules.tokenExpiryHours;
  document.getElementById("tr-max").value = state.rules.maxDailyTokensPerDoctor;

  document.getElementById("form-token-rules").onsubmit = (e) => {
    e.preventDefault();
    state.rules.waitTimeBufferMin = document.getElementById("tr-buffer").value;
    state.rules.penaltyDurationHours =
      document.getElementById("tr-penalty").value;
    state.rules.smartReQueue = document.getElementById("tr-smart").checked;
    state.rules.tokenExpiryHours = document.getElementById("tr-expiry").value;
    state.rules.maxDailyTokensPerDoctor =
      document.getElementById("tr-max").value;
    saveData(KEYS.RULES, state.rules);
    showToast("Token Rules Updated", "success");
  };

  const tbody = document.querySelector("#table-admin-token-log tbody");
  const logs = [...state.queue].sort((a, b) => b.timestamp - a.timestamp);
  tbody.innerHTML = logs
    .map((q) => {
      const doc = state.doctors.find((d) => d.id === q.doctorId);
      const time = new Date(q.timestamp).toLocaleString();
      return `<tr>
      <td><b>${q.tokenId}</b></td>
      <td>${q.patientName}</td>
      <td>${doc ? doc.name : "Unknown"}</td>
      <td>${time}</td>
      <td><span class="badge badge-grey">${q.status}</span></td>
    </tr>`;
    })
    .join("");
}

// ─── 12. SHARED COMPONENTS ───────────────────────────
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function closeModal(e) {
  if (e.target.id === "modal-overlay") {
    document.getElementById("modal-overlay").classList.remove("active");
  }
}

// ─── 13. EVENT LISTENERS & INIT ──────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  initSeedData();

  // Auth listeners
  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document
    .getElementById("signup-form")
    .addEventListener("submit", handleSignup);

  document.querySelectorAll(".role-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      document
        .querySelectorAll(".role-tab")
        .forEach((t) => t.classList.remove("active"));
      e.target.classList.add("active");
      const role = e.target.dataset.role;
      const pts = document.querySelectorAll(".patient-only");
      if (role === "patient")
        pts.forEach((el) => el.classList.remove("d-none"));
      else pts.forEach((el) => el.classList.add("d-none"));
    });
  });

  document.getElementById("link-signup").addEventListener("click", (e) => {
    e.preventDefault();
    navigate("signup");
  });
  document.getElementById("link-guest").addEventListener("click", (e) => {
    e.preventDefault();
    handleGuestLogin();
  });
  document.getElementById("btn-logout").addEventListener("click", () => {
    saveData(KEYS.CURRENT_USER, null);
    navigate("login");
  });

  // Auto login check
  if (state.currentUser) {
    navigate(`${state.currentUser.role}/dashboard`);
  } else {
    navigate("login");
  }

  // Update UI loop
  setInterval(() => {
    if (state.currentRoute === "patient/queue") renderPatientQueue();
    if (state.currentRoute === "doctor/dashboard") renderDoctorDashboard();
    if (state.currentRoute === "doctor/queue") renderDoctorQueue();
    if (state.currentRoute === "patient/dashboard") renderPatientDashboard();
    if (state.currentRoute === "public/queue") renderPublicQueue();
  }, 5000);
});
