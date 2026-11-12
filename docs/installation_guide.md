# Installation and Deployment Guide
## Digital LEAP Internship Management System
**Course:** COMP 217 — System Analysis and Design  
**Group:** Group E | **Semester:** 05 (September 2026 – February 2027)

---

## Part A — Local Development Setup (Windows + XAMPP)

### Prerequisites

| Software | Version | Download |
|---|---|---|
| XAMPP | 8.1+ | https://www.apachefriends.org |
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Included with Node.js |
| Expo Go (mobile) | Latest | App Store / Google Play |

---

### Step 1 — Start XAMPP

1. Open XAMPP Control Panel.
2. Start **Apache** and **MySQL**.
3. Confirm both show green status indicators.

---

### Step 2 — Set Up the Database

1. Open a browser and go to `http://localhost/phpmyadmin`.
2. Click **New** in the left panel to create a new database.
3. Name it `digital_leap`, select `utf8mb4_unicode_ci`, then click **Create**.
4. Click the `digital_leap` database in the left panel.
5. Click the **Import** tab at the top.
6. Click **Choose File** and select:
   ```
   database\schema.sql
   ```
7. Click **Go**. Wait for the success message (21 tables created).
8. Repeat steps 5–7 for:
   ```
   database\seed_data.sql
   ```
9. Confirm tables appear in the left panel.

---

### Step 3 — Deploy the Backend to XAMPP

1. Open Windows Explorer and navigate to your XAMPP installation:
   ```
   C:\xampp\htdocs\
   ```
2. Create a new folder named `digital-leap-api`.
3. Copy everything inside the project `backend\` folder into:
   ```
   C:\xampp\htdocs\digital-leap-api\
   ```
   The folder should contain: `index.php`, `.htaccess`, `config\`, `controllers\`, `middleware\`, `routes\`, `utils\`

4. Create the environment file:
   - Copy `backend\.env.example` to `backend\.env`
   - Open `.env` with a text editor and set:
     ```
     DB_HOST=localhost
     DB_NAME=digital_leap
     DB_USER=root
     DB_PASS=
     ```
   - Leave `DB_PASS` empty if your XAMPP MySQL has no root password (default).

5. Enable `mod_rewrite` in XAMPP:
   - Open `C:\xampp\apache\conf\httpd.conf`
   - Find `AllowOverride None` (in the `<Directory "C:/xampp/htdocs">` block)
   - Change it to `AllowOverride All`
   - Save the file and restart Apache in XAMPP Control Panel.

6. Test the API:
   - Open a browser or Postman
   - Go to: `http://localhost/digital-leap-api/auth/login`
   - You should see a JSON error (method not allowed or validation failed) — not a 404 or PHP error. That confirms the API is running.

---

### Step 4 — Find Your Local IP Address

The Expo mobile app needs your computer's IP address to reach the API.

1. Open Command Prompt (`Win + R`, type `cmd`, press Enter).
2. Run:
   ```
   ipconfig
   ```
3. Find the **IPv4 Address** under your Wi-Fi or Ethernet adapter.
   Example: `192.168.1.105`

---

### Step 5 — Configure the Frontend API URL

1. Open `frontend\services\api.js` in your code editor.
2. Find this line near the top:
   ```javascript
   const BASE_URL = 'http://192.168.1.100/digital-leap-api';
   ```
3. Replace `192.168.1.100` with your actual IP address from Step 4.
4. Save the file.

---

### Step 6 — Run the Frontend

Open a new Command Prompt window and run:

```cmd
cd "C:\Users\myste\Desktop\SEM5\System Analysis &Design\Digital LEAP Internship Management System Group E Final project\frontend"
npm start
```

This opens the Expo developer menu in your browser.

**To test on mobile (Expo Go):**
1. Install **Expo Go** on your phone from the App Store or Google Play.
2. Ensure your phone and computer are on the same Wi-Fi network.
3. Scan the QR code shown in the Expo developer menu.

**To test in a browser (web):**
1. In the Expo developer menu, press `W` or click **Open in browser**.
2. The app opens at `http://localhost:8081`.

---

### Step 7 — Test the System

Use these seed credentials (password: `Password123!`):

| Role | Email |
|---|---|
| LEAP Coordinator | coordinator@leap.sl |
| Student | student@leap.sl |
| Academic Supervisor | supervisor@leap.sl |
| Host Supervisor | hostsup@leap.sl |
| Management | management@leap.sl |

Run the database validation tests:
1. Open phpMyAdmin.
2. Select `digital_leap` database.
3. Click **SQL** tab.
4. Paste contents of `database\validation_tests.sql`.
5. Click **Go**.
6. Confirm all tests show **PASS**.

Run the API test cases from `database\test_cases.md` using Postman.

---

## Part B — Production Deployment

> **Note:** Production deployment requires a PHP hosting account and optionally a Vercel account for the web frontend. These are external services. The instructions below describe the process — do not deploy to production without confirming with your lecturer.

---

### Production Architecture

```
[Students / Staff on mobile / browser]
           │ HTTPS
           ▼
[Vercel — Expo web export]
           │ HTTPS / JSON
           ▼
[PHP hosting — digital-leap-api/]
           │ PDO / MySQL
           ▼
[MySQL database — digital_leap]
```

---

### Backend Production Deployment

**Option A — InfinityFree or similar free PHP host:**

1. Register at https://infinityfree.net or similar.
2. Create a hosting account and note the MySQL hostname, username, and password from the control panel.
3. Create a MySQL database named `digital_leap` using the control panel.
4. Import `database\schema.sql` and `database\seed_data.sql` using the phpMyAdmin provided by the host.
5. Upload the `backend\` folder to your hosting `htdocs` or `public_html` directory using the File Manager or FTP.
6. In the hosting File Manager, create a `.env` file inside the uploaded `digital-leap-api` folder:
   ```
   DB_HOST=your_host_mysql_hostname
   DB_NAME=digital_leap
   DB_USER=your_host_mysql_username
   DB_PASS=your_host_mysql_password
   APP_ENV=production
   ```
7. Update `cors.php` — add your Vercel production URL to `$allowed_origins`.
8. Test: `https://your-host.infinityfreeapp.com/digital-leap-api/auth/login`

---

### Frontend Production Deployment (Vercel)

1. Install Vercel CLI:
   ```cmd
   npm install -g vercel
   ```

2. Set the API URL environment variable:
   ```cmd
   set API_BASE_URL=https://your-host.com/digital-leap-api
   ```

3. Build the web export:
   ```cmd
   cd frontend
   npx expo export --platform web
   ```
   This creates a `dist/` folder.

4. Deploy to Vercel:
   ```cmd
   vercel --prod
   ```
   Follow the prompts. When asked for the output directory, enter `dist`.

5. Set the environment variable in Vercel dashboard:
   - Go to your project settings → Environment Variables
   - Add `API_BASE_URL` = `https://your-api-host.com/digital-leap-api`

6. Redeploy after setting the variable:
   ```cmd
   vercel --prod
   ```

---

### Production Security Checklist

Before demonstrating or submitting:

- [ ] HTTPS enabled on both frontend and backend hosting
- [ ] `.env` file is NOT inside any publicly accessible folder
- [ ] `.env` file is NOT committed to version control
- [ ] `APP_ENV=production` is set in backend `.env`
- [ ] `cors.php` only allows the specific Vercel production domain
- [ ] Seed account passwords changed from default `Password123!`
- [ ] MySQL root password set (if using shared hosting, use a non-root DB user)
- [ ] Error display disabled in PHP (`display_errors = Off` in production)

---

## Part C — Flash Drive Submission Preparation

For the Assignment 3 Week 11 hard copy submission, include on the flash drive:

```
flash-drive/
├── digital-leap-api/          ← Complete backend folder (ready to drop into htdocs)
├── digital-leap-frontend/     ← Complete frontend folder (run npm install && npm start)
├── database/
│   ├── schema.sql
│   ├── seed_data.sql
│   ├── validation_tests.sql
│   ├── data_dictionary.md
│   └── test_cases.md
├── docs/
│   ├── installation_guide.md  ← This file
│   └── digital_public_goods_principles.md
├── screenshots/               ← Screen shots of each working feature
└── README.md
```

**Screenshots to include (minimum):**
1. Login screen
2. Student dashboard with placement status
3. Logbook submission form
4. Coordinator placement approval screen
5. Grade computation screen showing breakdown
6. Results report screen
7. GPS attendance screen (with consent notice visible)
8. Notifications screen
9. phpMyAdmin showing the 21 database tables
10. Postman showing a successful API call with Bearer token

---

## Part D — Demo Week Preparation

### Starting the system for a demonstration

**Step 1** — Start XAMPP (Apache + MySQL)  
**Step 2** — Open Command Prompt and run:
```cmd
cd "C:\path\to\project\frontend"
npm start
```
**Step 3** — Press `W` to open in browser, or scan QR code with Expo Go  
**Step 4** — Log in as coordinator to demonstrate the full workflow

### Suggested demonstration flow (5 minutes)

1. Register a new student account → show pending status
2. Log in as coordinator → approve the account
3. As student → apply for a placement
4. As coordinator → approve placement and show auto-generated letter
5. As student → submit a logbook entry
6. As supervisor → review and approve the logbook entry
7. As host supervisor → submit intern evaluation
8. As coordinator → compute and verify grade
9. As management → approve grade
10. As coordinator → publish grade
11. As student → view published result
12. Show notifications list
13. Show placement and progress reports
14. Show phpMyAdmin — 21 tables, audit_logs populated

---

*Document version 1.0 — prepared for COMP 217 Assignment 3, Group E, Semester 05*
