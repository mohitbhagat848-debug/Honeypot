# Honeypot Analyzer Deployment Guide

This guide covers a production-ready deployment for the full-stack honeypot analyzer.

## 1) Prerequisites

- Node.js 18+ (recommended: Node.js 20 LTS)
- npm 9+
- MongoDB with persistent storage and backups
- A domain name (recommended)
- HTTPS certificate (required for reliable browser geolocation)

## 2) Required Environment Variables

Create a `.env` file in the project root for production values:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-strong-random-secret-min-32-chars
CLIENT_ORIGIN=https://your-frontend-domain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=choose-a-strong-password
```

Notes:
- `JWT_SECRET` should be long and random (32+ chars).
- `CLIENT_ORIGIN` must match your frontend URL exactly.
- Do not commit real secrets.

## 3) Install and Build

From repository root:

```bash
npm install
npm run build
```

This installs root, server, and client dependencies via the existing scripts.

## 4) Start in Production

```bash
npm run start
```

This launches the server, which serves API + honeypot routes.  
If your deployment expects a process manager, use PM2/systemd/docker restart policy.

## 5) Reverse Proxy (Nginx/Caddy/Cloud) Requirements

For accurate client IP tracing in production, forward real client IP headers:

- `X-Forwarded-For`
- `X-Real-IP` (optional but useful)

Also forward:
- `Host`
- `X-Forwarded-Proto`

Without these, server may only see internal proxy IPs.

## 6) HTTPS + Geolocation Accuracy

Browser geolocation (`navigator.geolocation`) is far more reliable on HTTPS.

- Use HTTPS for both frontend and API routes.
- Keep same-origin or properly configured CORS.
- Users must grant location permission.

Geo quality meaning in UI:
- `Verified exact`: browser geolocation with good accuracy.
- `Approximate`: browser geolocation with lower precision or IP-based lookup.
- `Unknown`: no valid coordinates available.

## 7) Data Persistence (Permanent Storage)

- MongoDB stores all captured attack logs and metadata permanently.
- Configure MongoDB backups (daily snapshots recommended).
- Keep volumes persistent if self-hosting DB in containers/VM.

## 8) Initial Admin Setup

Option A (recommended): seed once

```bash
npm run seed
```

Option B: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in env and seed.

## 9) Production Verification Checklist

After deploy, verify:

1. `GET /api/health` returns `ok: true`
2. Login works at frontend `/login`
3. Honeypot routes load:
   - `/trap`
   - `/trap/db`
   - `/trap/upload`
4. New interactions appear in dashboard tables
5. Map markers appear and details modal opens
6. Geo filter persists after refresh/navigation
7. If behind proxy, table shows real client IP (not only localhost/private IP)

## 10) Security + Operations Recommendations

- Restrict database network access (allowlist)
- Rotate `JWT_SECRET` and admin credentials regularly
- Enable rate-limiting/WAF at edge for public deployments
- Monitor logs and set alerting for service restarts or DB failures
- Keep dependencies updated and patch regularly

## 11) Known Accuracy Constraints

No internet system can guarantee exact attacker location in all cases:

- VPN, Tor, CGNAT, residential proxies can mask origin
- IP geolocation is often city-level approximation
- Exact coordinates require client/browser geolocation permission

The project now records both:
- network-observed IP intelligence
- browser-reported telemetry (when available)

This gives the best practical attribution quality for defensive telemetry.
