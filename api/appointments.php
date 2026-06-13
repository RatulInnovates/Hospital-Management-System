<?php
require_once '../config.php';
header('Content-Type: application/json');

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$db = getDB();

// ── MY APPOINTMENTS (patient) ──
if ($action === 'my') {
    $user = requireLogin();
    $pid  = is_numeric($user['id']) ? intval($user['id']) : 0;
    if (!$pid) jsonResponse([]);
    $stmt = $db->prepare("SELECT a.*, d.name as doctor_name, d.specialty, d.fee FROM appointments a JOIN doctors d ON a.doctor_id=d.id WHERE a.patient_id=? ORDER BY a.created_at DESC");
    $stmt->execute([$pid]);
    jsonResponse($stmt->fetchAll());
}

// ── ALL APPOINTMENTS (admin) ──
if ($action === 'all') {
    requireRole('admin');
    $rows = $db->query("SELECT a.*, d.name as doctor_name FROM appointments a JOIN doctors d ON a.doctor_id=d.id ORDER BY a.created_at DESC")->fetchAll();
    jsonResponse($rows);
}

jsonResponse(['error' => 'Unknown action'], 400);
