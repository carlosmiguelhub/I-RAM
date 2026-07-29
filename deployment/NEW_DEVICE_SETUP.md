# IRAM New Device Setup

This guide installs IRAM on a different Windows laptop or workstation. It
covers the application, MySQL/MariaDB, email, background processing, LAN
access, and transferring the current IRAM data.

## 1. Choose the installation type

Use one of these paths:

| Installation | Database command | Existing users and records |
| --- | --- | --- |
| Fresh IRAM installation | `php artisan migrate --seed` | No |
| Exact copy of the current IRAM system | Import a SQL backup, then run `php artisan migrate --force` | Yes |

For an exact copy, the SQL database is not enough. You must also transfer
`backend/storage/app/private/records` because uploaded documents are stored
privately on disk.

## 2. Software requirements

Install these on the new computer:

1. Git
2. PHP 8.2 or newer
3. Composer 2
4. Node.js 20.9 or newer and npm
5. MySQL 8 or MariaDB, such as the database included with XAMPP
6. Caddy only if IRAM will be installed as a PWA or accessed through HTTPS

The current development computer uses PHP 8.2, Composer 2, and Node.js 24.
Node.js 20 LTS or newer is sufficient for the checked-in Next.js version.

If using XAMPP, enable these PHP extensions in `php.ini`:

```ini
extension=fileinfo
extension=mbstring
extension=openssl
extension=pdo_mysql
```

Restart the terminal and Apache services after changing `php.ini`.

Verify the command-line tools:

```powershell
php --version
composer --version
node --version
npm.cmd --version
git --version
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` in every command.

## 3. Get the project

Clone the repository:

```powershell
cd C:\projects
git clone https://github.com/carlosmiguelhub/I-RAM.git iram-system
cd iram-system
```

Alternatively, securely transfer the project directory without these
generated or secret paths:

```text
backend/vendor
frontend/node_modules
frontend/.next
backend/.env
frontend/.env.local
```

Install backend and frontend dependencies:

```powershell
cd C:\projects\iram-system\backend
composer install

cd C:\projects\iram-system\frontend
npm.cmd ci
```

## 4. Create the database

Start MySQL or MariaDB. In phpMyAdmin, MySQL Workbench, or the MySQL console,
create a database:

```sql
CREATE DATABASE iram_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Create a dedicated database user for a long-running installation:

```sql
CREATE USER 'iram_user'@'localhost'
  IDENTIFIED BY 'replace-with-a-strong-password';

GRANT ALL PRIVILEGES ON iram_system.*
  TO 'iram_user'@'localhost';

FLUSH PRIVILEGES;
```

Using the MySQL `root` account is acceptable for isolated development, but
not recommended for a permanent shared installation.

## 5. Configure Laravel

Create the backend environment file:

```powershell
cd C:\projects\iram-system\backend
Copy-Item .env.example .env
```

For a fresh installation, generate a new key:

```powershell
php artisan key:generate
```

For an exact copy, place the current installation's existing `APP_KEY` in the
new `.env` instead. Do not generate a replacement key for copied data.

Set the important values in `backend/.env`:

```dotenv
APP_NAME=IRAM
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=iram_system
DB_USERNAME=iram_user
DB_PASSWORD=replace-with-a-strong-password

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

MAIL_MAILER=log
MAIL_FROM_ADDRESS="no-reply@example.test"
MAIL_FROM_NAME="${APP_NAME}"

IRAM_ADMIN_EMAIL=admin@example.test
IRAM_ADMIN_PASSWORD=replace-with-a-strong-admin-password
```

Rules for these values:

- `APP_URL` is the Laravel/API address.
- `FRONTEND_URL` must be the address users open in their browser. Email
  verification and workflow buttons use this value.
- `IRAM_ADMIN_PASSWORD` is only needed when creating or updating the seeded
  initial Admin account.
- Never commit `.env` or send it through ordinary chat or email.
- Use a password without unescaped `#` characters, or wrap it in double
  quotes in `.env`.

Clear any cached configuration after editing `.env`:

```powershell
php artisan optimize:clear
```

## 6A. Fresh database installation

Use this only when the new device should start with no existing users,
records, requests, or audit history:

```powershell
cd C:\projects\iram-system\backend
php artisan migrate --seed
```

This creates:

- Admin, Records Officer, and Staff roles
- Records Office and the four college departments
- Initial record categories
- System settings
- The initial active and verified Admin account

After the seeder succeeds, remove `IRAM_ADMIN_PASSWORD` from `.env` or rotate
the Admin password from the application.

## 6B. Copy the current IRAM database and files

Use this path when the new laptop must contain the same users, passwords,
records, requests, settings, and audit history as the current device.

### On the current device

Stop record submissions while making the backup. Export the database:

```powershell
C:\xampp\mysql\bin\mysqldump.exe `
  --host=127.0.0.1 `
  --user=root `
  --password `
  --single-transaction `
  --routines `
  --triggers `
  --result-file=C:\iram-backup\iram_system.sql `
  iram_system
```

Adjust the executable path, database name, and username to match the current
installation. The command prompts for the database password.

Also back up:

```text
backend/storage/app/private/records
backend/.env
```

Treat both as confidential. The SQL file contains account and institutional
data, the records directory contains uploaded documents, and `.env` contains
secrets.

### On the new device

1. Create the empty `iram_system` database.
2. Open the MySQL client:

```powershell
C:\xampp\mysql\bin\mysql.exe `
  --host=127.0.0.1 `
  --user=root `
  --password `
  iram_system
```

At the MySQL prompt, import the backup:

```sql
source C:/iram-backup/iram_system.sql;
exit;
```

For a large database, use phpMyAdmin or MySQL Workbench if the PowerShell
pipeline is too slow.

3. Copy the backed-up `records` directory to:

```text
C:\projects\iram-system\backend\storage\app\private\records
```

4. Preserve the old `APP_KEY` in the new `backend/.env`. Reconfigure machine
   specific values such as database credentials, URLs, and SMTP credentials.
5. Apply any migrations added since the backup:

```powershell
cd C:\projects\iram-system\backend
php artisan optimize:clear
php artisan migrate --force
```

Do not run `migrate:fresh` on a copied database. It deletes every table.

Existing browser API tokens are not copied to another browser. Users should
sign in again on the new device.

## 7. Configure the frontend

Create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=/api
```

The relative `/api` address is important. During development, Next.js proxies
it to Laravel at `127.0.0.1:8000`. Under Caddy, `/api` is sent directly to
Laravel.

If the new server has a different LAN IP, update `allowedDevOrigins` in
`frontend/next.config.ts` or use the Caddy production-style setup described
later in this guide.

## 8. Email setup

IRAM sends:

- Email verification links for new accounts
- Record workflow notifications
- Document-request workflow notifications
- Retention and disposal notifications

### Local email testing

Keep this in `backend/.env`:

```dotenv
MAIL_MAILER=log
MAIL_FROM_ADDRESS="no-reply@example.test"
MAIL_FROM_NAME="${APP_NAME}"
```

Messages are written to:

```text
backend/storage/logs/laravel.log
```

This is useful for local testing, but recipients will not receive real email.

### Real SMTP delivery

Use the credentials supplied by the institution's mail provider:

```dotenv
MAIL_MAILER=smtp
MAIL_SCHEME=null
MAIL_HOST=smtp.example.edu
MAIL_PORT=587
MAIL_USERNAME=records@example.edu
MAIL_PASSWORD="provider-smtp-password"
MAIL_FROM_ADDRESS=records@example.edu
MAIL_FROM_NAME="${APP_NAME}"
```

For Gmail or Google Workspace, use `smtp.gmail.com`, port `587`, the full
email address as the username, and an App Password rather than the normal
account password. App Password availability depends on the account's
security policy.

After changing mail settings:

```powershell
cd C:\projects\iram-system\backend
php artisan optimize:clear
```

Send a test from Laravel Tinker:

```powershell
php artisan tinker
```

Then enter:

```php
Mail::raw('IRAM SMTP test', function ($message) {
    $message->to('recipient@example.edu')
        ->subject('IRAM SMTP test');
});
```

Type `exit` to leave Tinker. If delivery fails, inspect
`backend/storage/logs/laravel.log` and check the provider's SMTP host, port,
username, password, sender restrictions, and firewall rules.

## 9. Run IRAM for development

Open separate PowerShell terminals.

Terminal 1, Laravel:

```powershell
cd C:\projects\iram-system\backend
php artisan serve --host=127.0.0.1 --port=8000
```

Terminal 2, Next.js:

```powershell
cd C:\projects\iram-system\frontend
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Terminal 3, scheduled retention and disposal:

```powershell
cd C:\projects\iram-system\backend
php artisan schedule:work
```

Terminal 4, database queue worker:

```powershell
cd C:\projects\iram-system\backend
php artisan queue:work --tries=3
```

Open:

```text
http://localhost:3000
```

The scheduler is required for automatic retention expiry and approved
disposal processing. The queue worker is recommended for queued work and
future notification jobs.

## 10. Run IRAM on the local network

Give the IRAM server a DHCP reservation or static LAN address.

For temporary non-PWA testing:

```powershell
# Backend
php artisan serve --host=0.0.0.0 --port=8000

# Frontend
npm.cmd run dev -- --hostname 0.0.0.0 --port 3000
```

Set:

```dotenv
# backend/.env
APP_URL=http://SERVER_LAN_IP:8000
FRONTEND_URL=http://SERVER_LAN_IP:3000
```

Allow inbound TCP port `3000` through Windows Firewall only on the Private
network profile. Other devices can then open:

```text
http://SERVER_LAN_IP:3000
```

For installable PWA support and HTTPS, follow
[LOCAL_PWA_SETUP.md](LOCAL_PWA_SETUP.md). Replace every old IP in
`deployment/Caddyfile.local`, `APP_URL`, and `FRONTEND_URL` with the new
server's fixed LAN IP.

Do not expose ports 3000, 8000, MySQL, or Caddy directly to the public
internet without a separate production security review.

## 11. Production-style local start

Build the frontend:

```powershell
cd C:\projects\iram-system\frontend
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 3000
```

Run Laravel and the scheduler in separate terminals:

```powershell
cd C:\projects\iram-system\backend
php artisan serve --host=127.0.0.1 --port=8000
```

```powershell
cd C:\projects\iram-system\backend
php artisan schedule:work
```

Then start Caddy as documented in
[LOCAL_PWA_SETUP.md](LOCAL_PWA_SETUP.md).

For unattended daily use, configure Laravel, Next.js, the scheduler, the
queue worker, and Caddy as Windows services or scheduled startup tasks. Do
not rely on terminals that a user may close.

## 12. Verify the installation

Run these checks:

```powershell
cd C:\projects\iram-system\backend
php artisan migrate:status
php artisan test

cd C:\projects\iram-system\frontend
npm.cmd run lint
npm.cmd run build
```

Then verify in the browser:

1. Sign in as the seeded or transferred Admin.
2. Open Admin > System Settings and confirm settings load.
3. Create a Staff account and confirm the verification email or log entry.
4. Activate the account as Admin.
5. Submit a record with attachments.
6. Review, return, resubmit, and archive a test record.
7. Submit and process a document request.
8. Confirm uploaded files can be downloaded by authorized users.
9. Confirm the scheduler processes a practice retention record.

## 13. Backup checklist

Back up these items together:

```text
MySQL/MariaDB database dump
backend/storage/app/private/records
backend/.env or, at minimum, APP_KEY and required credentials
deployment/Caddyfile.local
tools/caddy/data/pki (only when preserving the same private LAN CA)
```

Never share:

```text
Database dumps
APP_KEY
SMTP passwords
IRAM_ADMIN_PASSWORD
Caddy private CA keys
backend/storage/app/private/records
```

Test database and file restoration periodically. A database-only backup does
not contain uploaded documents.

## Troubleshooting

### `php` or `composer` is not recognized

Add the PHP and Composer directories to the Windows `PATH`, close all
terminals, and open PowerShell again.

### Laravel reports a database connection error

Confirm MySQL is running and verify `DB_HOST`, `DB_PORT`, `DB_DATABASE`,
`DB_USERNAME`, and `DB_PASSWORD`. Then run:

```powershell
php artisan optimize:clear
php artisan migrate:status
```

### The browser cannot connect to `/api`

Confirm Laravel is listening on port 8000 and the frontend contains:

```dotenv
NEXT_PUBLIC_API_URL=/api
```

Restart Next.js after changing `.env.local`.

### Verification links open the wrong device or address

Set `FRONTEND_URL` to the exact browser-facing URL, clear Laravel
configuration, and request a new verification email. Old verification links
retain the URL generated before the change.

### Attachments exist in the database but downloads return 404

Restore the matching files under:

```text
backend/storage/app/private/records
```

The file metadata in MySQL and the private files on disk must come from the
same backup.

### Scheduler actions do not happen

Keep this process running:

```powershell
php artisan schedule:work
```

Review `backend/storage/logs/laravel.log` for retention or disposal errors.
