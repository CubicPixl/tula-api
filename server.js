
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DB_PATH = path.join(__dirname, 'data', 'tula.db');
const db = new sqlite3.Database(DB_PATH);

const SUPER_ADMIN_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET || 'development-super-admin-secret-change-me';
const DEFAULT_SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || null;
const DEFAULT_SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || null;

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/public', express.static(path.join(__dirname, 'public')));

function init() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS artisans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      phone TEXT,
      whatsapp TEXT,
      instagram TEXT,
      address TEXT,
      lat REAL,
      lng REAL,
      photo_url TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT,
      address TEXT,
      lat REAL,
      lng REAL,
      hours TEXT,
      price TEXT,
      photo_url TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS super_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    )`);

    ensureDefaultSuperAdmin();
  });
}

function ensureDefaultSuperAdmin() {
  if (!DEFAULT_SUPER_ADMIN_EMAIL || !DEFAULT_SUPER_ADMIN_PASSWORD) {
    console.warn('No default super admin credentials provided. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD to create one automatically.');
    return;
  }

  const email = DEFAULT_SUPER_ADMIN_EMAIL.trim().toLowerCase();
  const password = DEFAULT_SUPER_ADMIN_PASSWORD;

  db.get('SELECT id FROM super_admins WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error('Failed to verify default super admin:', err.message);
      return;
    }

    if (!row) {
      const passwordHash = bcrypt.hashSync(password, 10);
      db.run('INSERT INTO super_admins (email, password_hash) VALUES (?, ?)', [email, passwordHash], (insertErr) => {
        if (insertErr) {
          console.error('Failed to create default super admin:', insertErr.message);
        } else {
          console.log(`Default super admin created for ${email}`);
        }
      });
    }
  });
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/artisans', (req, res) => {
  db.all('SELECT * FROM artisans ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/artisans/:id', (req, res) => {
  db.get('SELECT * FROM artisans WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});

app.get('/places', (req, res) => {
  db.all('SELECT * FROM places ORDER BY name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/places/:id', (req, res) => {
  db.get('SELECT * FROM places WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});

app.get('/search', (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  db.all(`
    SELECT 'artisan' as kind, id, name, description, category, lat, lng, photo_url
    FROM artisans WHERE name LIKE ? OR description LIKE ? OR category LIKE ?
    UNION ALL
    SELECT 'place' as kind, id, name, description, type as category, lat, lng, photo_url
    FROM places WHERE name LIKE ? OR description LIKE ? OR type LIKE ?
    ORDER BY name
  `, [q,q,q,q,q,q], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/super-admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  db.get('SELECT id, email, password_hash FROM super_admins WHERE email = ?', [normalizedEmail], (err, admin) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    bcrypt.compare(password, admin.password_hash, (compareErr, ok) => {
      if (compareErr) return res.status(500).json({ error: compareErr.message });
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { sub: admin.id, email: admin.email, role: 'super_admin' },
        SUPER_ADMIN_JWT_SECRET,
        { expiresIn: '1h' }
      );

      db.run('UPDATE super_admins SET last_login_at = datetime("now") WHERE id = ?', [admin.id], (updateErr) => {
        if (updateErr) console.error('Failed to update super admin last login:', updateErr.message);
        res.json({
          token,
          admin: {
            id: admin.id,
            email: admin.email,
          },
        });
      });
    });
  });
});

const PORT = process.env.PORT || 4000;
init();
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
