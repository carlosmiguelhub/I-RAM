# IRAM local-network PWA setup

This setup keeps IRAM private to the local network while serving it over
HTTPS so supported phones and computers can install it as a PWA.

## Network layout

```text
Phone or workstation
    |
    | https://192.168.94.188:8443
    v
Caddy (HTTPS)
    |-- /api/*  -> Laravel on 127.0.0.1:8000
    `-- all else -> Next.js on 127.0.0.1:3000
```

Use a DHCP reservation or static address for the IRAM server. If its LAN
address is not `192.168.94.188`, update `deployment/Caddyfile.local` and the
URLs below.

## 1. Install Caddy

Install Caddy on the IRAM server from the official Caddy distribution.
The `caddy` command must be available in PowerShell before continuing.

## 2. Configure production URLs

Before building the frontend, set:

```dotenv
# frontend/.env.local
NEXT_PUBLIC_API_URL=/api
```

This relative API address is already configured in the project. During local
development, Next.js proxies it to Laravel on `127.0.0.1:8000`. Under Caddy,
the same `/api` path is routed directly to Laravel, so phones never try to
connect to their own `127.0.0.1`.

Set these Laravel values:

```dotenv
# backend/.env
APP_URL=https://192.168.94.188:8443
FRONTEND_URL=https://192.168.94.188:8443
```

Then clear Laravel's cached configuration:

```powershell
cd backend
php artisan optimize:clear
```

## 3. Build and run IRAM

Run Laravel locally:

```powershell
cd backend
php artisan serve --host=127.0.0.1 --port=8000
```

Build and run Next.js:

```powershell
cd frontend
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Keep the retention scheduler running in its own terminal when the practice
one-minute retention option is being tested:

```powershell
cd backend
php artisan schedule:work
```

Start the local HTTPS proxy from the repository root:

```powershell
$env:IRAM_CADDY_STORAGE = "$PWD\tools\caddy\data"
.\tools\caddy\caddy.exe run --config deployment/Caddyfile.local
```

## 4. Trust the local certificate

`tls internal` uses Caddy's local certificate authority. With
`IRAM_CADDY_STORAGE` set as shown above, run the following from the repository
root to trust it on the server computer:

```powershell
$env:IRAM_CADDY_STORAGE = "$PWD\tools\caddy\data"
.\tools\caddy\caddy.exe trust
```

Other computers and phones must also trust Caddy's local root certificate
before opening the HTTPS address. This project keeps that certificate under:

```text
tools/caddy/data/pki/authorities/local/root.crt
```

Transfer only `root.crt` to each authorized device:

- Windows: import it into **Trusted Root Certification Authorities**.
- Android: install it as a **CA certificate** through security settings.
- iPhone/iPad: install the profile, then enable full trust under
  **Settings > General > About > Certificate Trust Settings**.

Never distribute Caddy's private CA key.

## 5. Install IRAM

After the certificate is trusted, open `https://192.168.94.188:8443` while
connected to the same LAN:

- Chrome/Edge on Android or desktop: use **Install IRAM** or the install
  button in the address bar.
- iPhone/iPad: use **Share > Add to Home Screen**.

The installed app still requires the IRAM local network for all records,
approvals, downloads, and disposal operations. The service worker does not
cache API responses, authenticated documents, downloads, or archived files.

## Verification

In Chromium developer tools, check:

1. **Application > Manifest** shows IRAM and both icons.
2. **Application > Service Workers** shows `/sw.js` as activated.
3. **Cache Storage > iram-shell-v1** contains only the offline screen,
   icons, and static Next.js assets.
4. Going offline displays the IRAM offline screen instead of exposing
   previously viewed records.
