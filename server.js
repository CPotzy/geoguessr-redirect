const express = require('express');
const Database = require('better-sqlite3');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new Database(path.join(__dirname, 'redirect.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Seed default if empty
const existing = db.prepare('SELECT value FROM config WHERE key = ?').get('redirect_url');
if (!existing) {
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('redirect_url', 'https://www.geoguessr.com');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// The magic redirect — this is what the QR code points to
app.get('/go', (req, res) => {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('redirect_url');
  const url = row ? row.value : 'https://www.geoguessr.com';
  res.redirect(302, url);
});

// Admin page
app.get('/admin', async (req, res) => {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('redirect_url');
  const currentUrl = row ? row.value : '';
  const baseUrl = `${req.protocol}://${req.get('host')}/go`;
  const qrDataUrl = await QRCode.toDataURL(baseUrl, { width: 400, margin: 2, color: { dark: '#1a1a2e', light: '#ffffff' } });

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🌍 GeoGuessr QR Redirect</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 24px;
      padding: 48px;
      max-width: 520px;
      width: 90%;
      text-align: center;
      box-shadow: 0 25px 50px rgba(0,0,0,0.3);
    }
    h1 { font-size: 2rem; margin-bottom: 8px; }
    .subtitle { color: #aaa; margin-bottom: 32px; font-size: 0.95rem; }
    .qr-wrapper {
      background: #fff;
      border-radius: 16px;
      padding: 16px;
      display: inline-block;
      margin-bottom: 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    .qr-wrapper img { display: block; width: 280px; height: 280px; }
    .current-link {
      background: rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 24px;
      word-break: break-all;
      font-size: 0.85rem;
      color: #7dd3fc;
    }
    .current-link span { color: #888; font-size: 0.75rem; display: block; margin-bottom: 4px; }
    form { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
    input[type="url"] {
      flex: 1;
      min-width: 200px;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.08);
      color: #fff;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="url"]:focus { border-color: #7c3aed; }
    input[type="url"]::placeholder { color: #666; }
    button {
      padding: 12px 24px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      color: #fff;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.2s;
    }
    button:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(124,58,237,0.4); }
    button:active { transform: translateY(0); }
    .success { color: #4ade80; margin-top: 16px; font-weight: 500; }
    .globe { font-size: 3rem; margin-bottom: 12px; animation: spin 20s linear infinite; display: inline-block; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .hint { color: #666; font-size: 0.75rem; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="globe">🌍</div>
    <h1>GeoGuessr Redirect</h1>
    <p class="subtitle">One QR code to rule them all. Update the link, keep the code.</p>

    <div class="qr-wrapper">
      <img src="${qrDataUrl}" alt="QR Code" />
    </div>

    <div class="current-link">
      <span>CURRENTLY REDIRECTING TO:</span>
      ${currentUrl}
    </div>

    <form method="POST" action="/admin/update">
      <input type="url" name="url" placeholder="Paste new GeoGuessr party link..." required />
      <button type="submit">🚀 Update</button>
    </form>

    ${req.query.success ? '<p class="success">✅ Link updated! Next scan goes to the new game.</p>' : ''}

    <p class="hint">Right-click the QR code → Save Image → drop it in your slides once. Done forever.</p>
  </div>
</body>
</html>`);
});

// Update the redirect URL
app.post('/admin/update', (req, res) => {
  const { url } = req.body;
  if (url) {
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('redirect_url', url);
  }
  res.redirect('/admin?success=1');
});

// Root redirects to admin
app.get('/', (req, res) => res.redirect('/admin'));

app.listen(PORT, () => {
  console.log(`\n🌍 GeoGuessr Redirect running on http://localhost:${PORT}`);
  console.log(`   Admin:    http://localhost:${PORT}/admin`);
  console.log(`   Redirect: http://localhost:${PORT}/go\n`);
});
