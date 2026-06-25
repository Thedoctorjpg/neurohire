const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const {
  insertReport,
  listReports,
  listAllReports,
  getReportById,
  getPublicStats,
  pingDb,
  reportsToCsv,
  STAGES,
} = require('./db');

const PORT = Number(process.env.PORT) || 3853;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const NOTIFY_WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL || '';
const ROOT = __dirname;

const STAGE_SET = new Set(STAGES);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(ROOT, 'public')));

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});

function cleanText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function cleanEmail(value) {
  const email = cleanText(value, 254);
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function cleanStringArray(value, maxItems = 12, maxItemLen = 200) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxItemLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function validateReportBody(body) {
  const errors = [];
  const jobTitle = cleanText(body.jobTitle, 200);
  const stage = cleanText(body.stage, 80);
  const description = cleanText(body.description, 8000);

  if (!jobTitle) errors.push('jobTitle is required');
  if (!STAGE_SET.has(stage)) errors.push('stage is invalid');
  if (!description) errors.push('description is required');
  if (body.consent !== true) errors.push('consent is required');

  if (errors.length) return { errors };

  return {
    report: {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      company: cleanText(body.company, 200) || null,
      jobTitle,
      stage,
      incidentDate: cleanText(body.incidentDate, 32) || null,
      issueTypes: cleanStringArray(body.issueTypes),
      description,
      accommodations: cleanText(body.accommodations, 4000) || null,
      impacts: cleanStringArray(body.impacts),
      impactNotes: cleanText(body.impactNotes, 4000) || null,
      supportRequested: cleanText(body.supportRequested, 120) || 'No',
      contactEmail: cleanEmail(body.contactEmail),
      consent: true,
    },
  };
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({
      error: 'Admin access is not configured. Set ADMIN_TOKEN in the environment.',
    });
  }
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function parseListFilters(query) {
  const stage = cleanText(query.stage, 80);
  const q = cleanText(query.q, 120);
  return {
    stage: stage && STAGE_SET.has(stage) ? stage : null,
    q: q || null,
  };
}

async function notifyWebhook(report) {
  if (!NOTIFY_WEBHOOK_URL) return;
  try {
    await fetch(NOTIFY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'report.submitted',
        id: report.id,
        createdAt: report.createdAt,
        stage: report.stage,
        jobTitle: report.jobTitle,
        company: report.company,
        hasContactEmail: Boolean(report.contactEmail),
      }),
    });
  } catch (err) {
    console.error('Webhook notification failed:', err.message);
  }
}

app.get('/api/health', (_req, res) => {
  try {
    pingDb();
    res.json({
      ok: true,
      service: 'neurohire',
      time: new Date().toISOString(),
      db: 'ok',
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      service: 'neurohire',
      time: new Date().toISOString(),
      db: 'error',
      error: err.message,
    });
  }
});

app.get('/api/stats', (_req, res) => {
  res.json(getPublicStats());
});

app.get('/api/reports/:id/status', (req, res) => {
  const id = cleanText(req.params.id, 64);
  if (!id) return res.status(400).json({ error: 'Invalid reference id' });
  const report = getReportById(id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json({
    id: report.id,
    createdAt: report.createdAt,
    stage: report.stage,
    status: 'received',
    message: 'Your report has been received and included in anonymised statistics.',
  });
});

app.post('/api/reports', submitLimiter, async (req, res) => {
  const { errors, report } = validateReportBody(req.body || {});
  if (errors) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  insertReport(report);
  notifyWebhook(report);
  res.status(201).json({
    ok: true,
    id: report.id,
    message: 'Report submitted. Thank you for helping build evidence for fairer hiring.',
  });
});

app.get('/api/admin/reports', requireAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const filters = parseListFilters(req.query);
  res.json(listReports({ limit, offset, ...filters }));
});

app.get('/api/admin/reports/export.csv', requireAdmin, (req, res) => {
  const filters = parseListFilters(req.query);
  const { reports } = listAllReports(filters);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="neurohire-reports-${stamp}.csv"`);
  res.send('\uFEFF' + reportsToCsv(reports));
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`NeuroHire running at http://${HOST}:${PORT}`);
  if (!ADMIN_TOKEN) {
    console.log('Admin API disabled until ADMIN_TOKEN is set.');
  }
});