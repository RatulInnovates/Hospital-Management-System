<?php
require_once '../config.php';
header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$db = getDB();

// ── LOGIN ──
if ($action === 'login') {
    $email = trim($_POST['email'] ?? '');
    $pass  = $_POST['password'] ?? '';
    $role  = $_POST['role'] ?? 'patient';

    if ($role === 'admin' || $role === 'patient') {
        $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND role = ?");
        $stmt->execute([$email, $role]);
        $user = $stmt->fetch();
        if ($user && password_verify($pass, $user['password'])) {
            unset($user['password']);
            $user['conditions'] = json_decode($user['conditions'] ?? '{}', true);
            $_SESSION['user'] = $user;
            jsonResponse(['success' => true, 'user' => $user]);
        }
    } elseif ($role === 'doctor') {
        $stmt = $db->prepare("SELECT * FROM doctors WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if ($user && password_verify($pass, $user['password'])) {
            unset($user['password']);
            $user['role'] = 'doctor';
            $user['workingHours'] = ['start' => substr($user['working_hours_start'],0,5), 'end' => substr($user['working_hours_end'],0,5)];
            $user['workingDays']  = json_decode($user['working_days'] ?? '[]', true);
            $_SESSION['user'] = $user;
            jsonResponse(['success' => true, 'user' => $user]);
        }
    }
    jsonResponse(['success' => false, 'error' => 'Invalid credentials']);
}

// ── GUEST LOGIN ──
if ($action === 'guest') {
    $name  = trim($_POST['name'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    if (!$name || !$phone) jsonResponse(['error' => 'Name and phone required'], 400);
    $guest = ['id' => 'guest-' . time(), 'role' => 'guest', 'name' => $name, 'phone' => $phone];
    $_SESSION['user'] = $guest;
    jsonResponse(['success' => true, 'user' => $guest]);
}

// ── SIGNUP ──
if ($action === 'signup') {
    $name   = trim($_POST['name'] ?? '');
    $email  = trim($_POST['email'] ?? '');
    $pass   = $_POST['password'] ?? '';
    $phone  = trim($_POST['phone'] ?? '');
    $age    = intval($_POST['age'] ?? 0);
    $blood  = $_POST['blood_group'] ?? '';

    if (!$name || !$email || !$pass) jsonResponse(['error' => 'Missing fields'], 400);

    $check = $db->prepare("SELECT id FROM users WHERE email = ?");
    $check->execute([$email]);
    if ($check->fetch()) jsonResponse(['error' => 'Email already registered'], 409);

    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $conds = json_encode(['diabetes'=>false,'hypertension'=>false,'heartDisease'=>false,'asthma'=>false]);
    $stmt = $db->prepare("INSERT INTO users (role,name,email,password,phone,age,blood_group,conditions) VALUES ('patient',?,?,?,?,?,?,?)");
    $stmt->execute([$name, $email, $hash, $phone, $age, $blood, $conds]);
    $uid = $db->lastInsertId();

    $user = ['id' => $uid, 'role' => 'patient', 'name' => $name, 'email' => $email, 'phone' => $phone, 'age' => $age, 'blood_group' => $blood, 'conditions' => json_decode($conds, true)];
    $_SESSION['user'] = $user;
    jsonResponse(['success' => true, 'user' => $user]);
}

// ── LOGOUT ──
if ($action === 'logout') {
    session_destroy();
    jsonResponse(['success' => true]);
}

// ── SESSION CHECK ──
if ($action === 'session') {
    if (!empty($_SESSION['user'])) {
        jsonResponse(['logged_in' => true, 'user' => $_SESSION['user']]);
    }
    jsonResponse(['logged_in' => false]);
}

jsonResponse(['error' => 'Unknown action'], 400);
