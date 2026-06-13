<?php
require_once '../config.php';
header('Content-Type: application/json');

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$db = getDB();

// ── GET RULES ──
if ($action === 'get') {
    $row = $db->query("SELECT * FROM token_rules WHERE id=1")->fetch();
    jsonResponse($row ?: ['wait_time_buffer'=>15,'penalty_duration'=>1,'smart_requeue'=>1,'token_expiry_hours'=>4,'max_daily_tokens'=>30]);
}

// ── UPDATE RULES (admin) ──
if ($action === 'update') {
    requireRole('admin');
    $buf    = intval($_POST['wait_time_buffer'] ?? 15);
    $pen    = floatval($_POST['penalty_duration'] ?? 1);
    $smart  = intval($_POST['smart_requeue'] ?? 1);
    $expiry = intval($_POST['token_expiry_hours'] ?? 4);
    $max    = intval($_POST['max_daily_tokens'] ?? 30);
    $db->prepare("UPDATE token_rules SET wait_time_buffer=?,penalty_duration=?,smart_requeue=?,token_expiry_hours=?,max_daily_tokens=? WHERE id=1")
       ->execute([$buf, $pen, $smart, $expiry, $max]);
    jsonResponse(['success' => true]);
}

// ── TOKEN LOG (admin) ──
if ($action === 'log') {
    requireRole('admin');
    $rows = $db->query("SELECT q.*, d.name as doctor_name FROM queue q JOIN doctors d ON q.doctor_id=d.id ORDER BY q.created_at DESC")->fetchAll();
    jsonResponse($rows);
}

jsonResponse(['error' => 'Unknown action'], 400);
