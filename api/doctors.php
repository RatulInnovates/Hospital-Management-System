<?php
require_once '../config.php';
header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$db = getDB();

// Helper: format doctor row
function fmtDoctor($d) {
    $d['role'] = 'doctor';
    $d['workingHours'] = ['start' => substr($d['working_hours_start'],0,5), 'end' => substr($d['working_hours_end'],0,5)];
    $d['workingDays']  = json_decode($d['working_days'] ?? '[]', true);
    unset($d['password'], $d['working_hours_start'], $d['working_hours_end'], $d['working_days']);
    return $d;
}

// ── LIST ALL DOCTORS ──
if ($action === 'list') {
    $rows = $db->query("SELECT * FROM doctors ORDER BY name")->fetchAll();
    jsonResponse(array_map('fmtDoctor', $rows));
}

// ── ADD DOCTOR (admin only) ──
if ($action === 'add') {
    requireRole('admin');
    $name     = trim($_POST['name'] ?? '');
    $email    = trim($_POST['email'] ?? '');
    $pass     = $_POST['password'] ?? '';
    $spec     = trim($_POST['specialty'] ?? '');
    $fee      = intval($_POST['fee'] ?? 1000);
    if (!$name || !$email || !$pass || !$spec) jsonResponse(['error' => 'Missing fields'], 400);

    $check = $db->prepare("SELECT id FROM doctors WHERE email = ?");
    $check->execute([$email]);
    if ($check->fetch()) jsonResponse(['error' => 'Email already in use'], 409);

    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $days = json_encode(['Monday','Tuesday','Wednesday','Thursday','Friday']);
    $stmt = $db->prepare("INSERT INTO doctors (name,email,password,specialty,fee,working_days) VALUES (?,?,?,?,?,?)");
    $stmt->execute(["Dr. $name", $email, $hash, $spec, $fee, $days]);
    $id = $db->lastInsertId();

    $doc = $db->prepare("SELECT * FROM doctors WHERE id = ?");
    $doc->execute([$id]);
    jsonResponse(['success' => true, 'doctor' => fmtDoctor($doc->fetch())]);
}

// ── DELETE DOCTOR (admin only) ──
if ($action === 'delete') {
    requireRole('admin');
    $id = intval($_POST['id'] ?? 0);
    $db->prepare("DELETE FROM doctors WHERE id = ?")->execute([$id]);
    jsonResponse(['success' => true]);
}

// ── UPDATE SETTINGS (doctor only) ──
if ($action === 'settings') {
    $user = requireRole('doctor');
    $id   = intval($user['id']);
    $fee    = intval($_POST['fee'] ?? 1000);
    $status = $_POST['status'] ?? 'Available';
    $start  = $_POST['start'] ?? '09:00';
    $end    = $_POST['end'] ?? '17:00';
    $bio    = trim($_POST['bio'] ?? '');
    $days   = json_encode(json_decode($_POST['working_days'] ?? '[]', true));

    $stmt = $db->prepare("UPDATE doctors SET fee=?,status=?,working_hours_start=?,working_hours_end=?,bio=?,working_days=? WHERE id=?");
    $stmt->execute([$fee, $status, $start, $end, $bio, $days, $id]);

    // Refresh session
    $doc = $db->prepare("SELECT * FROM doctors WHERE id = ?");
    $doc->execute([$id]);
    $updated = fmtDoctor($doc->fetch());
    $updated['role'] = 'doctor';
    $_SESSION['user'] = $updated;
    jsonResponse(['success' => true, 'user' => $updated]);
}

jsonResponse(['error' => 'Unknown action'], 400);
