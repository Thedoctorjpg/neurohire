const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'neurohire-test-'));
const PORT = 3877 + Math.floor(Math.random() * 100);
const ADMIN_TOKEN = 'test-admin-token-' + Date.now();

let serverProc;

function request(method, urlPath, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          // not json
        }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForHealth(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await request('GET', '/api/health');
      if (res.status === 200 && res.json?.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not become healthy in time');
}

async function run() {
  serverProc = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      ADMIN_TOKEN,
      DATA_DIR: TEST_DIR,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForHealth();

  const health = await request('GET', '/api/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.json.db, 'ok');

  const payload = JSON.stringify({
    jobTitle: 'QA Tester',
    stage: 'Interview',
    description: 'Automated test report',
    issueTypes: ['Accommodation request ignored or refused'],
    impacts: ['Increased anxiety or distress'],
    consent: true,
  });

  const created = await request('POST', '/api/reports', {
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  assert.strictEqual(created.status, 201);
  assert.ok(created.json.id);

  const status = await request('GET', `/api/reports/${created.json.id}/status`);
  assert.strictEqual(status.status, 200);
  assert.strictEqual(status.json.status, 'received');

  const stats = await request('GET', '/api/stats');
  assert.strictEqual(stats.status, 200);
  assert.ok(stats.json.totalReports >= 1);

  const admin = await request('GET', '/api/admin/reports', {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  assert.strictEqual(admin.status, 200);
  assert.ok(admin.json.total >= 1);

  const filtered = await request('GET', '/api/admin/reports?q=QA&stage=Interview', {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  assert.strictEqual(filtered.status, 200);
  assert.ok(filtered.json.reports.length >= 1);

  const csv = await request('GET', '/api/admin/reports/export.csv', {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  assert.strictEqual(csv.status, 200);
  assert.ok(csv.text.includes('jobTitle'));
  assert.ok(csv.text.includes('QA Tester'));

  console.log('All API tests passed.');
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (serverProc) {
      serverProc.kill();
      await new Promise((r) => setTimeout(r, 500));
    }
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Windows may keep SQLite WAL files locked briefly after process exit
    }
  });