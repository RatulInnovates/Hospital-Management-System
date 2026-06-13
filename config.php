<?php
// Database configuration - edit these values
// define('DB_HOST', 'localhost');
define('DB_HOST', '127.0.0.1');
define('DB_USER', 'root');
define('DB_PASS', '1234');
define('DB_NAME', 'azure_sanctuary');

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
                DB_USER, DB_PASS,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                 PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['error' => 'DB connection failed: ' . $e->getMessage()]));
        }
    }
    return $pdo;
}

// Start session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function requireLogin() {
    if (empty($_SESSION['user'])) {
        jsonResponse(['error' => 'Not authenticated'], 401);
    }
    return $_SESSION['user'];
}

function requireRole($roles) {
    $user = requireLogin();
    if (!in_array($user['role'], (array)$roles)) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }
    return $user;
}
