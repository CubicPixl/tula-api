
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'data', 'tula.db');
const db = new sqlite3.Database(DB_PATH);

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

const PORT = process.env.PORT || 4000;
init();
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
