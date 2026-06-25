const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'neurohire.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    company TEXT,
    job_title TEXT NOT NULL,
    stage TEXT NOT NULL,
    incident_date TEXT,
    issue_types TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL,
    accommodations TEXT,
    impacts TEXT NOT NULL DEFAULT '[]',
    impact_notes TEXT,
    support_requested TEXT NOT NULL DEFAULT 'No',
    contact_email TEXT,
    consent INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
  CREATE INDEX IF NOT EXISTS idx_reports_stage ON reports(stage);
`);

function parseJsonArray(value, fallback = []) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function rowToReport(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    company: row.company || null,
    jobTitle: row.job_title,
    stage: row.stage,
    incidentDate: row.incident_date || null,
    issueTypes: parseJsonArray(row.issue_types),
    description: row.description,
    accommodations: row.accommodations || null,
    impacts: parseJsonArray(row.impacts),
    impactNotes: row.impact_notes || null,
    supportRequested: row.support_requested,
    contactEmail: row.contact_email || null,
    consent: Boolean(row.consent),
  };
}

const insertStmt = db.prepare(`
  INSERT INTO reports (
    id, created_at, company, job_title, stage, incident_date,
    issue_types, description, accommodations, impacts, impact_notes,
    support_requested, contact_email, consent
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?
  )
`);

function insertReport(report) {
  insertStmt.run(
    report.id,
    report.createdAt,
    report.company || null,
    report.jobTitle,
    report.stage,
    report.incidentDate || null,
    JSON.stringify(report.issueTypes || []),
    report.description,
    report.accommodations || null,
    JSON.stringify(report.impacts || []),
    report.impactNotes || null,
    report.supportRequested || 'No',
    report.contactEmail || null,
    report.consent ? 1 : 0
  );
  return report;
}

function listReports({ limit = 100, offset = 0, stage = null, q = null } = {}) {
  const clauses = [];
  const params = [];

  if (stage) {
    clauses.push('stage = ?');
    params.push(stage);
  }
  if (q) {
    const like = `%${q}%`;
    clauses.push(
      '(job_title LIKE ? OR company LIKE ? OR description LIKE ? OR contact_email LIKE ?)'
    );
    params.push(like, like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT * FROM reports ${where} ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM reports ${where}`)
    .get(...params).count;
  return { reports: rows.map(rowToReport), total };
}

function listAllReports({ stage = null, q = null } = {}) {
  return listReports({ limit: 10000, offset: 0, stage, q });
}

function getReportById(id) {
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  return row ? rowToReport(row) : null;
}

function pingDb() {
  db.prepare('SELECT 1').get();
  return true;
}

function getPublicStats() {
  const total = db.prepare('SELECT COUNT(*) AS count FROM reports').get().count;
  const byStage = db
    .prepare(
      `SELECT stage AS label, COUNT(*) AS count FROM reports GROUP BY stage ORDER BY count DESC`
    )
    .all();
  const recent = db
    .prepare(
      `SELECT id, created_at AS createdAt, stage, job_title AS jobTitle
       FROM reports ORDER BY datetime(created_at) DESC LIMIT 5`
    )
    .all()
    .map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      stage: row.stage,
      jobTitle: row.jobTitle,
    }));

  const issueRows = db.prepare(`SELECT issue_types FROM reports`).all();
  const impactRows = db.prepare(`SELECT impacts FROM reports`).all();
  const issueCounts = {};
  const impactCounts = {};

  for (const row of issueRows) {
    for (const item of parseJsonArray(row.issue_types)) {
      issueCounts[item] = (issueCounts[item] || 0) + 1;
    }
  }
  for (const row of impactRows) {
    for (const item of parseJsonArray(row.impacts)) {
      impactCounts[item] = (impactCounts[item] || 0) + 1;
    }
  }

  const toSortedList = (counts) =>
    Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

  return {
    totalReports: total,
    byStage,
    byIssueType: toSortedList(issueCounts),
    byImpact: toSortedList(impactCounts),
    recentAnonymous: recent,
  };
}

function reportsToCsv(reports) {
  const headers = [
    'id',
    'createdAt',
    'company',
    'jobTitle',
    'stage',
    'incidentDate',
    'issueTypes',
    'description',
    'accommodations',
    'impacts',
    'impactNotes',
    'supportRequested',
    'contactEmail',
  ];
  const escape = (value) => {
    const str = value == null ? '' : String(value);
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const lines = [headers.join(',')];
  for (const report of reports) {
    lines.push(
      [
        report.id,
        report.createdAt,
        report.company,
        report.jobTitle,
        report.stage,
        report.incidentDate,
        (report.issueTypes || []).join('; '),
        report.description,
        report.accommodations,
        (report.impacts || []).join('; '),
        report.impactNotes,
        report.supportRequested,
        report.contactEmail,
      ]
        .map(escape)
        .join(',')
    );
  }
  return lines.join('\r\n');
}

module.exports = {
  insertReport,
  listReports,
  listAllReports,
  getReportById,
  getPublicStats,
  pingDb,
  reportsToCsv,
  STAGES: [
    'Application form',
    'Online assessment',
    'Interview',
    'Reference check',
    'Job offer stage',
    'Other',
  ],
};