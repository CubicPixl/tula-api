
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'tula.db');
if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);

const artisans = [
  { name: 'Obsidiana Tula', description: 'Tallado artesanal de obsidiana.', category: 'Piedra/Obsidiana', phone: '', whatsapp: '', instagram: '', address: 'Barrio Centro, Tula', lat: 20.0576, lng: -99.3416, photo_url: '' },
  { name: 'Textiles Doña Mari', description: 'Telar de cintura y bordado tradicional.', category: 'Textil', phone: '', whatsapp: '', instagram: '', address: 'San Marcos', lat: 20.0562, lng: -99.3435, photo_url: '' },
  { name: 'Madera Tolteca', description: 'Máscaras y figuras en madera.', category: 'Madera', phone: '', whatsapp: '', instagram: '', address: 'El Carmen', lat: 20.0608, lng: -99.3379, photo_url: '' },
  { name: 'Cerámica Rivera', description: 'Cerámica utilitaria y decorativa.', category: 'Cerámica', phone: '', whatsapp: '', instagram: '', address: 'La Malinche', lat: 20.0549, lng: -99.3463, photo_url: '' },
  { name: 'Gastronomía Xajay', description: 'Salsas y moles tradicionales.', category: 'Gastronomía', phone: '', whatsapp: '', instagram: '', address: 'Zaragoza', lat: 20.053, lng: -99.339, photo_url: '' },
];

const places = [
  { name: 'Zona Arqueológica de Tula', description: 'Hogar de los Atlantes.', type: 'Arqueología', address: 'Tula, Hgo', lat: 20.0617, lng: -99.3389, hours: 'Mar-Dom 9:00-17:30', price: '$95 MXN', photo_url: '' },
  { name: 'Catedral de San José', description: 'Arquitectura colonial.', type: 'Iglesia', address: 'Centro', lat: 20.0537, lng: -99.3418, hours: 'Abierto', price: 'Gratis', photo_url: '' },
  { name: 'Río Tula Malecón', description: 'Caminata y miradores.', type: 'Parque', address: 'Ribera del río', lat: 20.0546, lng: -99.3332, hours: 'Abierto', price: 'Gratis', photo_url: '' },
  { name: 'Museo Jorge R. Acosta', description: 'Historia tolteca.', type: 'Museo', address: 'Zona arqueológica', lat: 20.0629, lng: -99.3399, hours: 'Mar-Dom 9:00-17:30', price: '$80 MXN', photo_url: '' },
  { name: 'Mercado Municipal', description: 'Gastronomía local.', type: 'Mercado', address: 'Centro', lat: 20.0531, lng: -99.3435, hours: 'Diario', price: 'Gratis', photo_url: '' },
];

db.serialize(() => {
  db.run('DROP TABLE IF EXISTS artisans');
  db.run('DROP TABLE IF EXISTS places');
  db.run('DROP TABLE IF EXISTS super_admins');

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

  const insA = db.prepare(`INSERT INTO artisans
    (name, description, category, phone, whatsapp, instagram, address, lat, lng, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  artisans.forEach(a => insA.run(a.name, a.description, a.category, a.phone, a.whatsapp, a.instagram, a.address, a.lat, a.lng, a.photo_url));
  insA.finalize();

  const insP = db.prepare(`INSERT INTO places
    (name, description, type, address, lat, lng, hours, price, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  places.forEach(p => insP.run(p.name, p.description, p.type, p.address, p.lat, p.lng, p.hours, p.price, p.photo_url));
  insP.finalize();

  const defaultEmail = (process.env.SUPER_ADMIN_EMAIL || 'admin@tula.local').trim().toLowerCase();
  const defaultPassword = process.env.SUPER_ADMIN_PASSWORD || 'changeme';
  const defaultHash = bcrypt.hashSync(defaultPassword, 10);
  db.run('INSERT INTO super_admins (email, password_hash) VALUES (?, ?)', [defaultEmail, defaultHash]);

  console.log('Database seeded at', DB_PATH);
  db.close();
});
