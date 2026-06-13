# Azure Sanctuary — Hospital Management System (PHP/MySQL)

## Setup Instructions

### 1. Requirements
- PHP 7.4+
- MySQL 5.7+ or MariaDB 10.3+
- A web server (Apache/Nginx) or use PHP built-in server

### 2. Database Setup
```bash
mysql -u root -p < database.sql
```
This creates the `azure_sanctuary` database and all tables.

### 3. Configure Database
Edit `config.php` and set your DB credentials:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', 'your_password');
define('DB_NAME', 'azure_sanctuary');
```

### 4. Run
**Option A — PHP built-in server (for local dev):**
```bash
php -S localhost:8000
# then visit http://localhost:8000
```

**Option B — XAMPP/WAMP/LAMP:**
Copy the project folder to `htdocs/` (XAMPP) or `www/` (WAMP), then visit:
`http://localhost/azure-sanctuary/`

---

## Default Credentials
| Role  | Email                        | Password  |
|-------|------------------------------|-----------|
| Admin | admin@azuresanctuary.com     | Admin@123 |

> Doctors are added by Admin. Patients self-register.

---

## Project Structure
```
azure-sanctuary/
├── index.php          ← Main HTML shell (single page app)
├── config.php         ← DB connection + helpers
├── database.sql       ← Run once to set up DB
├── assets/
│   ├── styles.css     ← Unchanged frontend styles
│   └── app.js         ← Frontend JS (API calls replace localStorage)
└── api/
    ├── auth.php       ← login, signup, logout, session
    ├── doctors.php    ← list, add, delete, update settings
    ├── queue.php      ← book, list, next, promote, emergency, my
    ├── appointments.php ← my appointments, all (admin)
    ├── patients.php   ← list patients, update conditions
    └── rules.php      ← get/update token rules, token log
```

---

## Flow
1. **Admin** logs in → adds doctors
2. **Doctor** logs in with credentials set by admin
3. **Patient** registers → books appointment → gets token → joins queue
4. **Doctor** calls next patient → queue updates live
5. **Public Queue** screen shows live "Now Serving" display
