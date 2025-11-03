
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

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.VITE_FRONTEND_ORIGIN || null;
const FRONTEND_ORIGINS = FRONTEND_ORIGIN
  ? FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null;

const app = express();
app.use(
  cors({
    origin: FRONTEND_ORIGINS && FRONTEND_ORIGINS.length > 0 ? FRONTEND_ORIGINS : '*',
  })
);
app.use(express.json());
app.use(morgan('dev'));
app.use('/public', express.static(path.join(__dirname, 'public')));

function sanitizeArtisan(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    category: row.category || null,
    lat: row.lat,
    lng: row.lng,
    photo_url: row.photo_url || null,
  };
}

function sanitizePublicPlace(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    type: row.type || null,
    lat: row.lat,
    lng: row.lng,
    photo_url: row.photo_url || null,
  };
}

function extractBearerToken(req) {
  const header = req.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

function authenticateSuperAdmin(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  jwt.verify(token, SUPER_ADMIN_JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.superAdmin = payload;
    next();
  });
}

function authenticateSuperAdminIfPresent(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    req.superAdmin = null;
    return next();
  }

  jwt.verify(token, SUPER_ADMIN_JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.superAdmin = payload;
    return next();
  });
}

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
  db.all(
    'SELECT id, name, description, category, lat, lng, photo_url FROM artisans ORDER BY name',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(sanitizeArtisan));
    }
  );
});

app.get('/artisans/:id', (req, res) => {
  db.get(
    'SELECT id, name, description, category, lat, lng, photo_url FROM artisans WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(sanitizeArtisan(row));
    }
  );
});

app.get('/places', authenticateSuperAdminIfPresent, (req, res) => {
  const isSuperAdmin = Boolean(req.superAdmin);
  const query = isSuperAdmin
    ? 'SELECT * FROM places ORDER BY name'
    : 'SELECT id, name, description, type, lat, lng, photo_url FROM places ORDER BY name';

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!isSuperAdmin) {
      return res.json(rows.map(sanitizePublicPlace));
    }

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
        res.json({ token });
      });
    });
  });
});

function validatePlacePayload(body) {
  const errors = [];
  const payload = {};

  if (typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Name is required');
  } else {
    payload.name = body.name.trim();
  }

  payload.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;
  payload.type = typeof body.type === 'string' && body.type.trim() ? body.type.trim() : null;

  const lat = Number(body.lat);
  if (Number.isNaN(lat)) {
    errors.push('Latitude must be a number');
  } else {
    payload.lat = lat;
  }

  const lng = Number(body.lng);
  if (Number.isNaN(lng)) {
    errors.push('Longitude must be a number');
  } else {
    payload.lng = lng;
  }

  payload.photo_url = typeof body.photo_url === 'string' && body.photo_url.trim() ? body.photo_url.trim() : null;

  return { errors, payload };
}

app.post('/places', authenticateSuperAdmin, (req, res) => {
  const { errors, payload } = validatePlacePayload(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  db.run(
    `INSERT INTO places (name, description, type, lat, lng, photo_url) VALUES (?, ?, ?, ?, ?, ?)`,
    [payload.name, payload.description, payload.type, payload.lat, payload.lng, payload.photo_url],
    function insertCallback(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const createdPlace = {
        id: this.lastID,
        ...payload,
      };

      res.status(201).json(createdPlace);
    }
  );
});

app.put('/places/:id', authenticateSuperAdmin, (req, res) => {
  const { errors, payload } = validatePlacePayload(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  const params = [payload.name, payload.description, payload.type, payload.lat, payload.lng, payload.photo_url, req.params.id];

  db.run(
    `UPDATE places
     SET name = ?, description = ?, type = ?, lat = ?, lng = ?, photo_url = ?, updated_at = datetime('now')
     WHERE id = ?`,
    params,
    function updateCallback(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Not found' });
      }

      db.get(
        'SELECT id, name, description, type, lat, lng, photo_url FROM places WHERE id = ?',
        [req.params.id],
        (getErr, row) => {
          if (getErr) return res.status(500).json({ error: getErr.message });
          if (!row) return res.status(404).json({ error: 'Not found' });
          res.json(row);
        }
      );
    }
  );
});

app.delete('/places/:id', authenticateSuperAdmin, (req, res) => {
  db.run('DELETE FROM places WHERE id = ?', [req.params.id], function deleteCallback(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ success: true });
  });
});

const PORT = process.env.PORT || 4000;
init();
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
