// ============================================================
//  KARYABARU - Backend API (Express + PostgreSQL)
// ============================================================
require('dotenv').config();
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool, init } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'ganti-secret-ini';

app.use(express.json({ limit: '1mb' }));

// --- Sajikan file statis (index.html, products.js, img/) dari public/ ---
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'ignore' }));

// ---------- Helper ----------
function rowToProduct(r) {
  return {
    id: r.id,
    category: r.category,
    name: r.name,
    price: r.price,
    images: Array.isArray(r.images) ? r.images : [],
    emas: r.emas,
    karat: r.karat,
    berat: r.berat,
    size: r.size,
    description: r.description,
    stock: r.stock,
    active: r.active,
  };
}

// Validasi & normalisasi body produk dari admin.
function parseProductBody(b) {
  let images = b.images;
  if (typeof images === 'string') {
    images = images.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(images)) images = [];
  return {
    category: String(b.category || '').trim(),
    name: String(b.name || '').trim(),
    price: Math.max(0, parseInt(b.price, 10) || 0),
    images,
    emas: b.emas ? String(b.emas).trim() : null,
    karat: b.karat ? String(b.karat).trim() : null,
    berat: b.berat ? String(b.berat).trim() : null,
    size: b.size ? String(b.size).trim() : null,
    description: b.description ? String(b.description).trim() : null,
    stock: Math.max(0, parseInt(b.stock, 10) || 0),
    active: b.active === false || b.active === 'false' ? false : true,
  };
}

// Middleware proteksi admin (Bearer token).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token tidak ada' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token tidak valid / kedaluwarsa' });
  }
}

// ---------- Routes ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Login admin -> token
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Password salah' });
  }
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// Publik: produk aktif untuk etalase
app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE active = true ORDER BY id ASC',
    );
    res.json(rows.map(rowToProduct));
  } catch (e) {
    console.error('[GET /api/products]', e.message);
    res.status(500).json({ error: 'Gagal mengambil produk' });
  }
});

// Admin: semua produk (termasuk nonaktif)
app.get('/api/admin/products', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY id ASC');
    res.json(rows.map(rowToProduct));
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengambil produk' });
  }
});

// Admin: tambah produk
app.post('/api/products', requireAuth, async (req, res) => {
  const p = parseProductBody(req.body || {});
  if (!p.name || !p.category) {
    return res.status(400).json({ error: 'Nama dan kategori wajib diisi' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO products (category,name,price,images,emas,karat,berat,size,description,stock,active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [p.category, p.name, p.price, JSON.stringify(p.images), p.emas, p.karat,
        p.berat, p.size, p.description, p.stock, p.active],
    );
    res.status(201).json(rowToProduct(rows[0]));
  } catch (e) {
    console.error('[POST /api/products]', e.message);
    res.status(500).json({ error: 'Gagal menambah produk' });
  }
});

// Admin: ubah produk
app.put('/api/products/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID tidak valid' });
  const p = parseProductBody(req.body || {});
  if (!p.name || !p.category) {
    return res.status(400).json({ error: 'Nama dan kategori wajib diisi' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE products SET category=$1,name=$2,price=$3,images=$4,emas=$5,karat=$6,
        berat=$7,size=$8,description=$9,stock=$10,active=$11 WHERE id=$12 RETURNING *`,
      [p.category, p.name, p.price, JSON.stringify(p.images), p.emas, p.karat,
        p.berat, p.size, p.description, p.stock, p.active, id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Produk tidak ditemukan' });
    res.json(rowToProduct(rows[0]));
  } catch (e) {
    console.error('[PUT /api/products]', e.message);
    res.status(500).json({ error: 'Gagal mengubah produk' });
  }
});

// Admin: hapus produk
app.delete('/api/products/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID tidak valid' });
  try {
    const { rowCount } = await pool.query('DELETE FROM products WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Produk tidak ditemukan' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal menghapus produk' });
  }
});

// ---------- Start ----------
init()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] jalan di port ${PORT}`));
  })
  .catch((e) => {
    console.error('[server] gagal inisialisasi database:', e.message);
    // Tetap jalan agar etalase statis bisa tampil walau DB belum siap.
    app.listen(PORT, () => console.log(`[server] jalan di port ${PORT} (DB belum siap)`));
  });
