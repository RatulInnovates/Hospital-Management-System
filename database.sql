-- Azure Sanctuary Hospital Management System
-- Run this file to set up the database

CREATE DATABASE IF NOT EXISTS azure_sanctuary CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE azure_sanctuary;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role ENUM('admin','patient','guest') NOT NULL DEFAULT 'patient',
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    password VARCHAR(255),
    phone VARCHAR(20),
    age INT,
    blood_group VARCHAR(5),
    conditions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    specialty VARCHAR(100),
    fee INT DEFAULT 1000,
    status ENUM('Available','In Session','Off Duty') DEFAULT 'Available',
    working_hours_start TIME DEFAULT '09:00:00',
    working_hours_end TIME DEFAULT '17:00:00',
    working_days JSON,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token_id VARCHAR(30) NOT NULL,
    patient_id INT,
    patient_name VARCHAR(100),
    doctor_id INT NOT NULL,
    appt_date DATE NOT NULL,
    appt_time TIME NOT NULL,
    status VARCHAR(30) DEFAULT 'booked',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token_id VARCHAR(30) NOT NULL,
    patient_id INT,
    patient_name VARCHAR(100),
    doctor_id INT NOT NULL,
    is_emergency TINYINT(1) DEFAULT 0,
    status ENUM('waiting','serving','completed') DEFAULT 'waiting',
    queue_position INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_rules (
    id INT PRIMARY KEY DEFAULT 1,
    wait_time_buffer INT DEFAULT 15,
    penalty_duration DECIMAL(3,1) DEFAULT 1.0,
    smart_requeue TINYINT(1) DEFAULT 1,
    token_expiry_hours INT DEFAULT 4,
    max_daily_tokens INT DEFAULT 30
);

INSERT IGNORE INTO token_rules (id) VALUES (1);

-- Default admin: admin@azuresanctuary.com / Admin@123
INSERT IGNORE INTO users (id, role, name, email, password) VALUES
(1, 'admin', 'Admin', 'admin@azuresanctuary.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');
