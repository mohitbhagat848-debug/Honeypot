# Honeypot Network Analyzer

A full-stack **defensive research honeypot** with a real-time analyst dashboard. It exposes a **simulated vulnerable web surface** (no real exploitation), logs interactions to **MongoDB**, classifies traffic with a modular **detection engine**, and streams events to an **admin console** over **Socket.io**.

## Ethics & scope

- Marked internally as a **research honeypot** (`X-Honeypot` header, HTML comments).
- **No offensive tooling**; trap responses are fake and files from upload are **discarded**.
- Inputs are bounded and sanitized where parsed; passwords are **not stored** in clear text (only `[redacted]` in logs).

## Architecture

| Area | Stack |
|------|--------|
| API & realtime | Node.js, Express, Socket.io, JWT |
| Trap surface | `/trap` routes (`honeypot/`) |
| Detection | `analyzer/` (regex + rate + brute-force heuristics) |
| Admin UI | React (Vite), Tailwind, Recharts, Leaflet |
| Data | MongoDB (Mongoose) |

Optional **Python / Scapy** extension point: see `optional/scapy-service/`.

## Prerequisites

- **Node.js** 18+
- **MongoDB** 6+ (local or Atlas)

## Quick start

1. **Clone / open the project** and copy environment file:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`: set `JWT_SECRET` (16+ random characters) and `MONGO_URI` if needed.

2. **Install dependencies** (installs root + `server` + `client`):

   ```bash
   npm install
   ```

3. **Seed admin user + sample logs** (optional, first run):

   ```bash
   npm run seed
   ```

   Default admin (unless overridden in `.env`):

   - Email: `admin@honeypot.local`
   - Password: `root123`

4. **Start MongoDB** (if local), then run dev:

   ```bash
   npm run dev
   ```

   - **Dashboard:** http://localhost:5173  
   - **API health:** http://localhost:5000/api/health  
   - **Attacker trap (public-facing decoy):** http://localhost:5000/trap  

5. **Log in** to the dashboard with the seeded admin credentials. Open the trap URL in another browser (or incognito) and interact with login / DB / upload — events should appear **live** in the feed.

## Production-style run

```bash
npm run build
npm run start
```

Serve the `client/dist` static files behind your reverse proxy or host separately; set `CLIENT_ORIGIN` and `VITE_*` build-time URLs accordingly.

## Features

- **Trap pages:** login, fake DB console, fake upload, legacy admin — delays and fake success/failure.
- **Detection:** SQLi / XSS / path traversal / command-injection style patterns, rate anomalies, brute-force tracking.
- **Dashboard:** live feed (Socket.io), attacker table, risk scores, charts (volume + types + top IPs), Leaflet map, CSV export, IP blocklist, **replay detection** (re-runs analyzer on stored log without forwarding traffic).

## Project layout

```
├── analyzer/           # Detection modules
├── honeypot/           # Trap router + HTML
├── server/             # Express API + Socket.io
├── client/             # React admin UI
├── optional/scapy-service/  # Optional packet helper
├── .env.example
└── package.json        # npm run dev
```

## Environment variables

See `.env.example` for `MONGO_URI`, `PORT`, `JWT_SECRET`, `CLIENT_ORIGIN`, and optional `VITE_*` overrides.

## License

Provided for **authorized defensive research and education**. Deploy only on systems and networks you own or have explicit permission to instrument.
