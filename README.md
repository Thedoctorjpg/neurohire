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

### `GET /api/reports/:id/status`

Public confirmation that a report was received (no PII). Use the reference id shown after submission.

### `GET /api/admin/reports`

List reports. Requires header:

```
Authorization: Bearer <ADMIN_TOKEN>
```

Query params: `limit` (max 500), `offset`, `stage`, `q` (search job title, company, description, email).

### `GET /api/admin/reports/export.csv`

Download filtered reports as CSV. Same auth and query params as admin list.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3853` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `./data` | SQLite directory (mount a persistent volume here in production) |
| `ADMIN_TOKEN` | *(empty)* | Enables admin API; required for `/admin.html` |
| `NOTIFY_WEBHOOK_URL` | *(empty)* | Optional POST webhook on new report (Slack, Discord, etc.) |

## Project structure

```
neurohire/
├── server.js          # Express app & API routes
├── db.js              # SQLite schema & queries
├── Dockerfile         # Container image (Railway / Fly / VPS)
├── render.yaml        # Render blueprint
├── fly.toml           # Fly.io config + volume mount
├── railway.toml       # Railway deploy config
├── public/
│   ├── index.html     # 4-step report form
│   ├── app.js         # Form logic
│   ├── stats.html     # Public aggregate dashboard
│   └── admin.html     # Admin search + CSV export
├── test/api.test.js   # API smoke tests
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

Configs are included for **Render** (`render.yaml`), **Railway** (`railway.toml` + `Dockerfile`), and **Fly.io** (`fly.toml`). All use a persistent `DATA_DIR` mount so SQLite survives restarts.

### Render (recommended — free tier + disk)

1. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/Thedoctorjpg/neurohire) or connect the GitHub repo and apply the `render.yaml` blueprint.
2. Render auto-generates `ADMIN_TOKEN`; copy it from the dashboard for `/admin.html`.
3. Health check: `/api/health`

### Railway

```bash
npx @railway/cli login
npx @railway/cli link
npx @railway/cli up
npx @railway/cli variables set ADMIN_TOKEN=<long-random-secret>
```

Mount a volume at `/data` and set `DATA_DIR=/data`.

### Fly.io

```bash
fly auth login
fly launch --copy-config
fly volumes create neurohire_data --region syd --size 1
fly secrets set ADMIN_TOKEN=$(openssl rand -hex 32)
fly deploy
```

### Local / VPS

```bash
npm install
cp .env.example .env   # set ADMIN_TOKEN
npm start
npm test               # API smoke tests
```

GitHub Pages **cannot** run this stack — it only serves static files. Use a Node host for the full app.

## Author

**David Logan** — [GitHub](https://github.com/Thedoctorjpg) · [LinkedIn](https://www.linkedin.com/in/david-logan-b33777309)

## License

MIT — see [LICENSE](LICENSE).