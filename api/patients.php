<?php
require_once '../config.php';
header('Content-Type: application/json');

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$db = getDB();

// ── ALL PATIENTS (admin) ──
if ($action === 'list') {
    requireRole('admin');
    $rows = $db->query("SELECT u.id,u.name,u.email,u.phone,u.age,u.blood_group,u.conditions,
        (SELECT COUNT(*) FROM appointments WHERE patient_id=u.id) as appointment_count
        FROM users u WHERE u.role='patient' ORDER BY u.name")->fetchAll();
    foreach ($rows as &$r) {
        $r['conditions'] = json_decode($r['conditions'] ?? '{}', true);
    }
    jsonResponse($rows);
}

// ── UPDATE CONDITIONS (patient) ──
if ($action === 'conditions') {
    $user = requireRole('patient');
    $id   = intval($user['id']);
    $conds = json_decode($_POST['conditions'] ?? '{}', true);
    $stmt = $db->prepare("UPDATE users SET conditions=? WHERE id=?");
    $stmt->execute([json_encode($conds), $id]);
    $_SESSION['user']['conditions'] = $conds;
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Unknown action'], 400);
