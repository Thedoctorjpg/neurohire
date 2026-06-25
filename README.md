# NeuroHire

Safe, anonymous reporting for neurodiverse and disabled jobseekers in New Zealand.

Full-stack Node.js app: Express API, SQLite database, multi-step reporting UI, public aggregate stats, and password-protected admin dashboard.

## Stack

| Layer | Tech |
|-------|------|
| **Frontend** | HTML, Tailwind CSS, vanilla JS |
| **Backend** | Node.js, Express |
| **Database** | SQLite (Node built-in `node:sqlite`, Node ≥22.5) |
| **Auth** | Bearer token for admin API (`ADMIN_TOKEN`) |

## Quick start

```bash
git clone https://github.com/Thedoctorjpg/neurohire.git
cd neurohire
npm install
cp .env.example .env
# Edit .env — set ADMIN_TOKEN to a long random string
npm start
```

Open **http://localhost:3853**

| Page | URL |
|------|-----|
| Report form | `/` |
| Public stats | `/stats.html` |
| Admin dashboard | `/admin.html` |

Dev mode with auto-restart (Node 18+):

```bash
npm run dev
```

## API

### `GET /api/health`

Health check.

### `GET /api/stats`

Public aggregate stats (no PII): totals, counts by stage, issue type, and impact.

### `POST /api/reports`

Submit a report. Rate-limited to 10 requests per 15 minutes per IP.

```json
{
  "company": "Optional Co",
  "jobTitle": "Software Engineer",
  "stage": "Interview",
  "incidentDate": "2026-05-01",
  "issueTypes": ["Accommodation request ignored or refused"],
  "description": "What happened…",
  "accommodations": "Requested extra time…",
  "impacts": ["Increased anxiety or distress"],
  "impactNotes": "Optional",
  "supportRequested": "No",
  "contactEmail": null,
  "consent": true
}
```

Valid `stage` values: `Application form`, `Online assessment`, `Interview`, `Reference check`, `Job offer stage`, `Other`.

### `GET /api/admin/reports`

List all reports. Requires header:

```
Authorization: Bearer <ADMIN_TOKEN>
```

Query params: `limit` (max 500), `offset`.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3853` | HTTP port |
| `ADMIN_TOKEN` | *(empty)* | Enables admin API; required for `/admin.html` |

## Project structure

```
neurohire/
├── server.js          # Express app & API routes
├── db.js              # SQLite schema & queries
├── public/
│   ├── index.html     # 4-step report form
│   ├── app.js         # Form logic
│   ├── stats.html     # Public aggregate dashboard
│   └── admin.html     # Admin report viewer
├── data/              # SQLite DB (created at runtime, gitignored)
├── package.json
├── .env.example
├── LICENSE
└── README.md
```

## Privacy

- Reports are anonymous unless the user provides a contact email.
- Public stats expose only aggregated counts — no descriptions or identifying details.
- Admin access requires `ADMIN_TOKEN`; keep it secret and use HTTPS in production.
- Operators are responsible for storage, retention, and disclosure under applicable law (e.g. NZ Privacy Act 2020).

## Deployment

Run on any Node host (Railway, Render, Fly.io, VPS):

1. Set `PORT` and `ADMIN_TOKEN` in the host environment.
2. `npm install && npm start`
3. Put HTTPS in front (reverse proxy or platform TLS).

GitHub Pages **cannot** run this stack — it only serves static files. Use a Node host for the full app.

## Author

**David Logan** — [GitHub](https://github.com/Thedoctorjpg) · [LinkedIn](https://www.linkedin.com/in/david-logan-b33777309)

## License

MIT — see [LICENSE](LICENSE).