const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { insertReport, listReports, getPublicStats } = require('./db');

const PORT = Number(process.env.PORT) || 3853;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ROOT = __dirname;

const STAGES = new Set([
  'Application form',
  'Online assessment',
  'Interview',
  'Reference check',
  'Job offer stage',
  'Other',
]);

const app = express();
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
  if (!STAGES.has(stage)) errors.push('stage is invalid');
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'neurohire', time: new Date().toISOString() });
});

app.get('/api/stats', (_req, res) => {
  res.json(getPublicStats());
});

app.post('/api/reports', submitLimiter, (req, res) => {
  const { errors, report } = validateReportBody(req.body || {});
  if (errors) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  insertReport(report);
  res.status(201).json({
    ok: true,
    id: report.id,
    message: 'Report submitted. Thank you for helping build evidence for fairer hiring.',
  });
});

app.get('/api/admin/reports', requireAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.json(listReports({ limit, offset }));
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

app.listen(PORT, () => {
  console.log(`NeuroHire running at http://localhost:${PORT}`);
  if (!ADMIN_TOKEN) {
    console.log('Admin API disabled until ADMIN_TOKEN is set.');
  }
});