# IRAM Fresh Windows Setup (No PWA)

Use this guide to install a fresh copy of IRAM on a new Windows computer by
cloning the Git repository. It intentionally excludes Caddy, HTTPS
certificates, service-worker setup, and PWA installation.

The resulting system runs as a normal web application:

```text
IRAM server computer: http://localhost:3000
Other computers on the same trusted LAN: http://SERVER_LAN_IP:3000
```

This guide assumes the new database should contain no existing records,
requests, logs, uploaded documents, or user accounts except the initial
seeded Administrator.

## 0. Push the latest project first

A new device only receives commits that exist in the remote Git repository.
On the current development computer, confirm that all intended changes are
committed and pushed:

```powershell
cd C:\Users\Carlos\iram-system
git status
git add .
git commit -m "Prepare IRAM for new device installation"
git push origin main
```

Review `git status` before committing. Never add either environment file:

```text
backend/.env
frontend/.env.local
```

They contain device-specific settings and secrets and are intentionally
excluded from Git.

## 1. Install the required software

Install:

1. Git
2. PHP 8.2 or newer
3. Composer 2
4. Node.js 20.9 or newer with npm
5. MySQL 8 or MariaDB

XAMPP may be used for PHP and MySQL. Caddy is not required.

If using XAMPP, enable these PHP extensions in its `php.ini`:

```ini
extension=curl
extension=fileinfo
extension=mbstring
extension=openssl
extension=pdo_mysql
extension=zip
```

Make sure the `php` command uses the same PHP installation whose `php.ini`
you edited:

```powershell
php --ini
php --version
composer --version
node --version
npm.cmd --version
git --version
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` as shown throughout this guide.

## 2. Clone IRAM

Open PowerShell:

```powershell
New-Item -ItemType Directory -Force C:\projects | Out-Null
cd C:\projects
git clone https://github.com/carlosmiguelhub/I-RAM.git iram-system
cd C:\projects\iram-system
git branch --show-current
git log -1 --oneline
```

The expected branch is `main`. Confirm the latest commit is the one pushed
from the current development computer.

Install the dependencies:

```powershell
cd C:\projects\iram-system\backend
composer install --no-interaction

cd C:\projects\iram-system\frontend
npm.cmd ci
```

Do not copy `vendor`, `node_modules`, or `.next` from the old device.

## 3. Create a fresh database

Start MySQL or MariaDB. Open phpMyAdmin, MySQL Workbench, or the MySQL
console and run:

```sql
CREATE DATABASE iram_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'iram_user'@'localhost'
  IDENTIFIED BY 'REPLACE_WITH_A_STRONG_DATABASE_PASSWORD';

GRANT ALL PRIVILEGES ON iram_system.*
  TO 'iram_user'@'localhost';

FLUSH PRIVILEGES;
```

You now have two valid ways to initialize this database:

- **Import the clean database from the old device.** This preserves its
  current users, settings, categories, departments, and other reference
  data.
- **Run Laravel migrations and seeders.** This recreates the standard
  project defaults and the initial Admin account.

Choose only one method in Step 6. Do not import a dump and then run
`migrate --seed`.

## 4. Configure Laravel

Create the environment file and application key:

```powershell
cd C:\projects\iram-system\backend
Copy-Item .env.example .env
php artisan key:generate
```

Open `backend/.env` and configure it. For a server used only on itself:

```dotenv
APP_NAME=IRAM
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000
FRONTEND_URL=http://localhost:3000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=iram_system
DB_USERNAME=iram_user
DB_PASSWORD="REPLACE_WITH_A_STRONG_DATABASE_PASSWORD"

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database
FILESYSTEM_DISK=local

IRAM_ADMIN_EMAIL=admin@your-organization.edu
IRAM_ADMIN_PASSWORD="REPLACE_WITH_A_STRONG_ADMIN_PASSWORD"
```

If other computers will use IRAM over the local network, give the server a
static IP or DHCP reservation and set the browser-facing address. Example:

```dotenv
APP_URL=http://127.0.0.1:8000
FRONTEND_URL=http://192.168.1.50:3000
```

`FRONTEND_URL` is especially important. Verification and workflow emails use
it for their action buttons.

Rules:

- Never commit `backend/.env`.
- Do not reuse the database password as the Admin password.
- Wrap passwords containing `#` or spaces in double quotes.
- Keep `APP_DEBUG=true` only on a trusted development LAN. Use
  `APP_DEBUG=false` for routine shared use.

Clear cached configuration:

```powershell
php artisan optimize:clear
```

## 5. Configure real email

IRAM sends email-verification messages and record, request, retention, and
disposal workflow notifications.

### Option A: test without sending real email

Use:

```dotenv
MAIL_MAILER=log
MAIL_FROM_ADDRESS="no-reply@your-organization.edu"
MAIL_FROM_NAME="${APP_NAME}"
```

Messages will appear in:

```text
backend/storage/logs/laravel.log
```

### Option B: institutional SMTP

Ask the institution's email administrator for:

- SMTP hostname
- Port
- Username
- SMTP password or application password
- Required sender address
- Whether authenticated SMTP is enabled

For the common STARTTLS configuration on port 587:

```dotenv
MAIL_MAILER=smtp
MAIL_SCHEME=null
MAIL_HOST=smtp.your-organization.edu
MAIL_PORT=587
MAIL_USERNAME=records@your-organization.edu
MAIL_PASSWORD="REPLACE_WITH_THE_SMTP_PASSWORD"
MAIL_FROM_ADDRESS=records@your-organization.edu
MAIL_FROM_NAME="${APP_NAME}"
```

For a provider that specifically requires implicit TLS on port 465, use the
provider's required port and:

```dotenv
MAIL_SCHEME=smtps
```

For Gmail or Google Workspace, use the full mailbox address as the username
and an App Password when allowed by the organization's security policy.
Do not use the mailbox's normal password. For Microsoft 365 or another
managed provider, the administrator may need to enable authenticated SMTP
for the sending mailbox.

After editing mail settings:

```powershell
cd C:\projects\iram-system\backend
php artisan optimize:clear
```

Test SMTP:

```powershell
php artisan tinker
```

At the Tinker prompt:

```php
Mail::raw('IRAM SMTP test from the new server.', function ($message) {
    $message->to('YOUR_TEST_RECIPIENT@example.com')
        ->subject('IRAM SMTP test');
});
```

Then type:

```php
exit
```

Check the recipient's inbox and spam folder. If sending fails, inspect:

```text
backend/storage/logs/laravel.log
```

Do not continue to user-registration testing until SMTP works or the
`log` mailer is intentionally selected.

## 6. Initialize the database

Choose **A or B**, not both.

### Option A: import the clean database (recommended for this move)

Because the current database has already been reset and contains no
documents, it can be transferred directly. A database import includes
everything still present in that database, including users, settings, audit
entries, and reference data. Check the current system once more before
exporting it.

On the old device, export it with phpMyAdmin's **Export > Quick > SQL**
feature, or use:

```powershell
New-Item -ItemType Directory -Force C:\IRAM-transfer | Out-Null
mysqldump -u root -p --single-transaction --routines --triggers `
  --result-file=C:\IRAM-transfer\iram_clean.sql iram_system
```

Copy `iram_clean.sql` to the new device. Import it through phpMyAdmin's
**Import** feature after selecting the empty `iram_system` database, or use
the MySQL console:

```powershell
mysql -u iram_user -p iram_system
```

At the MySQL prompt:

```sql
SOURCE C:/IRAM-transfer/iram_clean.sql;
EXIT;
```

Then let Laravel apply only any newer migrations that were added after the
dump was made:

```powershell
cd C:\projects\iram-system\backend
php artisan migrate
php artisan migrate:status
```

Do not run `php artisan migrate:fresh` or `php artisan db:seed` after this
import. Existing login passwords remain the same. The `IRAM_ADMIN_EMAIL`
and `IRAM_ADMIN_PASSWORD` variables are not used to replace an imported
Admin.

Since the database contains no document records, do not copy
`backend/storage/app/private/records` from the old device.

### Option B: create the schema using Laravel

Run:

```powershell
cd C:\projects\iram-system\backend
php artisan migrate --seed
```

This creates the schema and seeds:

- Admin, Records Officer, and Staff roles
- Records Office and college departments
- Initial record categories
- System settings
- One active, verified Admin using `IRAM_ADMIN_EMAIL` and
  `IRAM_ADMIN_PASSWORD`

Verify:

```powershell
php artisan migrate:status
```

After confirming the Admin can sign in, remove `IRAM_ADMIN_PASSWORD` from
`backend/.env`. The hashed password remains in the database.

Do not run `migrate:fresh` after users begin using the system; it deletes all
application data.

## 7. Configure the frontend

Create `frontend/.env.local`:

```powershell
cd C:\projects\iram-system\frontend
Set-Content -Path .env.local -Value 'NEXT_PUBLIC_API_URL=/api'
```

The relative `/api` value lets Next.js forward browser API requests to
Laravel on `127.0.0.1:8000`. Other LAN devices therefore only need access to
the frontend's port 3000.

Build the frontend:

```powershell
npm.cmd run build
```

## 8. Start IRAM without PWA or HTTPS

Open separate PowerShell windows.

### Terminal 1: Laravel API

```powershell
cd C:\projects\iram-system\backend
php artisan serve --host=127.0.0.1 --port=8000
```

### Terminal 2: retention and disposal scheduler

```powershell
cd C:\projects\iram-system\backend
php artisan schedule:work
```

### Terminal 3: Next.js web server

For local access only:

```powershell
cd C:\projects\iram-system\frontend
npm.cmd run start -- --hostname 127.0.0.1 --port 3000
```

For access from other computers on the same LAN:

```powershell
cd C:\projects\iram-system\frontend
npm.cmd run start -- --hostname 0.0.0.0 --port 3000
```

### Optional Terminal 4: queue worker

Current IRAM notifications send directly, but keeping a queue worker
available supports queued or future background work:

```powershell
cd C:\projects\iram-system\backend
php artisan queue:work --tries=3
```

Open IRAM on the server:

```text
http://localhost:3000
```

From another LAN device:

```text
http://192.168.1.50:3000
```

Replace the example IP with the server's actual fixed LAN IP.

## 9. Allow LAN access through Windows Firewall

Skip this section for localhost-only use.

Keep Laravel and MySQL private. Only allow inbound TCP port 3000 on the
Windows **Private** network profile.

Run PowerShell as Administrator:

```powershell
New-NetFirewallRule `
  -DisplayName "IRAM Web 3000" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 3000 `
  -Action Allow `
  -Profile Private
```

Do not create public inbound rules for ports 8000 or 3306. Do not configure
router port forwarding. This non-HTTPS setup is intended only for a trusted
local network.

## 10. Verify the fresh installation

Run:

```powershell
cd C:\projects\iram-system\backend
php artisan test

cd C:\projects\iram-system\frontend
npm.cmd run lint
npm.cmd run build
```

Then test in the browser:

1. Sign in with the seeded Admin account.
2. Confirm Admin > System Settings loads.
3. Register a Staff account using a real test email.
4. Open the verification link from the email.
5. Activate the verified Staff account as Admin.
6. Sign in as Staff and submit a record with an attachment.
7. Start review as a Records Officer or permitted Admin.
8. Add review remarks and a storage location, then archive it.
9. Submit and process a printed document request.
10. Confirm the scheduler is running.

For a fresh installation, these should initially be empty:

```text
Records
Document requests
Audit trail
Archive folders
backend/storage/app/private/records
```

## 11. Daily operation

IRAM is available only while these processes are running:

- Laravel API
- Next.js server
- Laravel scheduler
- Queue worker, if queued work is enabled

For unattended use, configure them as Windows services or scheduled startup
tasks. Ensure the server does not sleep during operating hours.

## 12. Backups after the system goes live

Once users begin adding records, back up these together:

```text
MySQL database dump
backend/storage/app/private/records
backend/.env, or at least APP_KEY and required credentials
```

The database contains file metadata but not the uploaded document contents.
A usable restoration requires both the database and the matching private
records directory.

Never share or commit:

```text
backend/.env
frontend/.env.local
database backups
SMTP passwords
APP_KEY
backend/storage/app/private/records
```

## Troubleshooting

### Composer reports missing PHP extensions

Run `php --ini`, edit the loaded `php.ini`, enable the required extension,
and reopen PowerShell.

### Laravel cannot connect to MySQL

Confirm MySQL is running and verify the five `DB_` values in
`backend/.env`, then run:

```powershell
php artisan optimize:clear
php artisan migrate:status
```

### The browser reports an API/network error

Confirm Laravel is running on `127.0.0.1:8000`, confirm
`NEXT_PUBLIC_API_URL=/api`, and restart Next.js after changing
`.env.local`.

### Verification email opens the wrong computer

Set `FRONTEND_URL` to the exact address users open, run
`php artisan optimize:clear`, and request a new verification message.
Previously generated messages retain their old link.

### Mail works in logs but not in recipients' inboxes

`MAIL_MAILER=log` never sends real email. Change it to `smtp`, enter the
provider credentials, clear configuration, and run the SMTP test.

### Another computer cannot open IRAM

Confirm:

- The Next.js start command uses `--hostname 0.0.0.0`.
- Both devices are on the same LAN.
- The server network is classified as Private in Windows.
- The firewall rule allows private inbound TCP 3000.
- The server IP in `FRONTEND_URL` is correct.

### Scheduler actions do not run

Keep `php artisan schedule:work` running and inspect:

```text
backend/storage/logs/laravel.log
```

## PWA exclusion

For this installation:

- Do not install Caddy.
- Do not install a local certificate authority.
- Use IRAM as a normal browser application at `http://...:3000`.
