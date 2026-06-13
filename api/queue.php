<?php
require_once '../config.php';
header('Content-Type: application/json');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$db = getDB();

function sortQueue($db, $doctorId = null) {
    // Re-number queue positions per doctor
    $where = $doctorId ? "AND doctor_id = " . intval($doctorId) : "";
    $rows = $db->query("SELECT id, doctor_id FROM queue WHERE status='waiting' $where ORDER BY is_emergency DESC, created_at ASC")->fetchAll();
    $pos = [];
    foreach ($rows as $r) {
        $did = $r['doctor_id'];
        if (!isset($pos[$did])) $pos[$did] = 1;
        $db->prepare("UPDATE queue SET queue_position=? WHERE id=?")->execute([$pos[$did]++, $r['id']]);
    }
}

function fmtQueue($q) {
    $q['isEmergency'] = (bool)$q['is_emergency'];
    unset($q['is_emergency']);
    return $q;
}

// ── GET QUEUE (all or by doctor) ──
if ($action === 'list') {
    $doctorId = intval($_GET['doctor_id'] ?? 0);
    if ($doctorId) {
        $stmt = $db->prepare("SELECT * FROM queue WHERE doctor_id=? ORDER BY is_emergency DESC, queue_position ASC, created_at ASC");
        $stmt->execute([$doctorId]);
    } else {
        $stmt = $db->query("SELECT * FROM queue ORDER BY is_emergency DESC, queue_position ASC, created_at ASC");
    }
    jsonResponse(array_map('fmtQueue', $stmt->fetchAll()));
}

// ── BOOK / JOIN QUEUE ──
if ($action === 'book') {
    $user     = requireLogin();
    $doctorId = intval($_POST['doctor_id'] ?? 0);
    $date     = $_POST['date'] ?? date('Y-m-d');
    $time     = $_POST['time'] ?? '09:00';
    $emergency = intval($_POST['is_emergency'] ?? 0);

    if (!$doctorId) jsonResponse(['error' => 'Doctor required'], 400);

    // Generate token: AS-SPE-NNNN
    $doc = $db->prepare("SELECT specialty FROM doctors WHERE id=?");
    $doc->execute([$doctorId]);
    $docRow = $doc->fetch();
    $spec   = strtoupper(substr($docRow['specialty'] ?? 'GEN', 0, 3));
    $count  = $db->query("SELECT COUNT(*)+1 FROM appointments")->fetchColumn();
    $tokenId = "AS-$spec-" . str_pad($count, 4, '0', STR_PAD_LEFT);

    $patientId   = is_numeric($user['id']) ? intval($user['id']) : null;
    $patientName = $user['name'];

    // Insert appointment
    $stmt = $db->prepare("INSERT INTO appointments (token_id,patient_id,patient_name,doctor_id,appt_date,appt_time) VALUES (?,?,?,?,?,?)");
    $stmt->execute([$tokenId, $patientId, $patientName, $doctorId, $date, $time]);

    // Insert into queue
    $stmt2 = $db->prepare("INSERT INTO queue (token_id,patient_id,patient_name,doctor_id,is_emergency,status) VALUES (?,?,?,?,'waiting','waiting')");
    // Fix: use is_emergency value
    $stmt2 = $db->prepare("INSERT INTO queue (token_id,patient_id,patient_name,doctor_id,is_emergency,status) VALUES (?,?,?,?,?,?)");
    $stmt2->execute([$tokenId, $patientId, $patientName, $doctorId, $emergency, 'waiting']);

    sortQueue($db, $doctorId);
    jsonResponse(['success' => true, 'token' => $tokenId]);
}

// ── MARK EMERGENCY ──
if ($action === 'emergency') {
    $user = requireLogin();
    $pid  = is_numeric($user['id']) ? intval($user['id']) : 0;
    if (!$pid) jsonResponse(['error' => 'Guest cannot mark emergency'], 400);
    $stmt = $db->prepare("UPDATE queue SET is_emergency=1 WHERE patient_id=? AND status='waiting'");
    $stmt->execute([$pid]);
    if ($stmt->rowCount() === 0) jsonResponse(['error' => 'No active token'], 400);
    sortQueue($db);
    jsonResponse(['success' => true]);
}

// ── CALL NEXT (doctor only) ──
if ($action === 'next') {
    $user = requireRole('doctor');
    $did  = intval($user['id']);

    // Complete current serving
    $db->prepare("UPDATE queue SET status='completed' WHERE doctor_id=? AND status='serving'")->execute([$did]);

    // Promote next waiting (emergency first, then position)
    sortQueue($db, $did);
    $next = $db->prepare("SELECT id FROM queue WHERE doctor_id=? AND status='waiting' ORDER BY is_emergency DESC, queue_position ASC LIMIT 1");
    $next->execute([$did]);
    $row = $next->fetch();
    if ($row) {
        $db->prepare("UPDATE queue SET status='serving' WHERE id=?")->execute([$row['id']]);
        $served = $db->prepare("SELECT token_id, patient_name FROM queue WHERE id=?");
        $served->execute([$row['id']]);
        $info = $served->fetch();
        jsonResponse(['success' => true, 'token' => $info['token_id'], 'name' => $info['patient_name']]);
    }
    jsonResponse(['success' => false, 'message' => 'No more patients']);
}

// ── PROMOTE PATIENT (doctor) ──
if ($action === 'promote') {
    $user = requireRole('doctor');
    $did  = intval($user['id']);
    $qid  = intval($_POST['queue_id'] ?? 0);
    $db->prepare("UPDATE queue SET status='completed' WHERE doctor_id=? AND status='serving'")->execute([$did]);
    $db->prepare("UPDATE queue SET status='serving' WHERE id=? AND doctor_id=?")->execute([$qid, $did]);
    jsonResponse(['success' => true]);
}

// ── GET MY ACTIVE QUEUE ENTRY (patient) ──
if ($action === 'my') {
    $user = requireLogin();
    $pid  = is_numeric($user['id']) ? intval($user['id']) : 0;
    if (!$pid) jsonResponse(null);
    $stmt = $db->prepare("SELECT q.*, d.name as doctor_name FROM queue q JOIN doctors d ON q.doctor_id=d.id WHERE q.patient_id=? AND q.status IN ('waiting','serving') LIMIT 1");
    $stmt->execute([$pid]);
    $row = $stmt->fetch();
    jsonResponse($row ? fmtQueue($row) : null);
}

jsonResponse(['error' => 'Unknown action'], 400);
