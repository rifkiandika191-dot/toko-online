// ============================================================
//  KARYABARU - Backend API (Express + PostgreSQL)
// ============================================================
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const { pool, init, slugify } = require('./db');

const app = express();
app.set('trust proxy', true); // di belakang proxy Railway: protocol/host benar
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'ganti-secret-ini';

// Folder penyimpanan gambar permanen.
// Di Railway: pasang Volume lalu set UPLOAD_DIR=/data/uploads.
// Lokal: default ke folder ./uploads (dibuat otomatis).
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT_BY_MIME = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = EXT_BY_MIME[file.mimetype] || '.bin';
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 }, // maks 8MB per file, 6 file
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE.has(file.mimetype)) return cb(null, true);
    cb(new Error('Hanya gambar JPG/PNG/WEBP/GIF yang diperbolehkan'));
  },
});

app.use(express.json({ limit: '1mb' }));

// --- Sajikan file statis (index.html, products.js, img/) dari public/ ---
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'ignore' }));

// --- Sajikan gambar yang di-upload (dari volume permanen) ---
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  setHeaders: (res) => res.set('Cache-Control', 'public, max-age=604800'),
}));

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
    badge: r.badge || '',
    certified: r.certified === true,
    draft: r.draft === true,
    order_clicks: r.order_clicks || 0,
    slug: r.slug || '',
  };
}

// --- Password admin: simpan hash (scrypt) di tabel settings ---
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(plain, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const test = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function getSetting(key) {
  const { rows } = await pool.query('SELECT value FROM settings WHERE key=$1', [key]);
  return rows.length ? rows[0].value : null;
}
// Cek password admin: pakai hash dari DB kalau ada, kalau belum pakai ADMIN_PASSWORD env.
async function checkAdminPassword(plain) {
  const stored = await getSetting('admin_password_hash').catch(() => null);
  if (stored) return verifyPassword(plain, stored);
  return !!plain && plain === ADMIN_PASSWORD;
}

const ALLOWED_BADGES = ['', 'Baru', 'Terlaris', 'Stok Terbatas', 'Habis'];

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
    badge: ALLOWED_BADGES.includes(b.badge) ? b.badge : '',
    certified: b.certified === true || b.certified === 'true',
    draft: b.draft === true || b.draft === 'true',
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
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body || {};
  const ok = await checkAdminPassword(password).catch(() => false);
  if (!ok) {
    return res.status(401).json({ error: 'Password salah' });
  }
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// Admin: ganti password dari dashboard
app.put('/api/admin/password', requireAuth, async (req, res) => {
  const { current, newPassword } = req.body || {};
  const ok = await checkAdminPassword(current).catch(() => false);
  if (!ok) return res.status(401).json({ error: 'Password saat ini salah' });
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  }
  try {
    const hash = hashPassword(newPassword);
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('admin_password_hash', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [hash],
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[PUT /api/admin/password]', e.message);
    res.status(500).json({ error: 'Gagal menyimpan password' });
  }
});

// Publik: produk aktif & bukan draft untuk etalase
app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE active = true AND draft = false ORDER BY id ASC',
    );
    res.json(rows.map(rowToProduct));
  } catch (e) {
    console.error('[GET /api/products]', e.message);
    res.status(500).json({ error: 'Gagal mengambil produk' });
  }
});

// Publik: catat klik tombol "Pesan" (statistik). Tidak butuh auth.
app.post('/api/products/:id/click', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID tidak valid' });
  try {
    await pool.query('UPDATE products SET order_clicks = order_clicks + 1 WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: false }); // jangan ganggu UX kalau gagal
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
      `INSERT INTO products (category,name,price,images,emas,karat,berat,size,description,stock,active,badge,certified,draft)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [p.category, p.name, p.price, JSON.stringify(p.images), p.emas, p.karat,
        p.berat, p.size, p.description, p.stock, p.active, p.badge, p.certified, p.draft],
    );
    const slug = `${slugify(p.name)}-${rows[0].id}`;
    const { rows: r2 } = await pool.query('UPDATE products SET slug=$1 WHERE id=$2 RETURNING *', [slug, rows[0].id]);
    res.status(201).json(rowToProduct(r2[0]));
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
    const slug = `${slugify(p.name)}-${id}`;
    const { rows } = await pool.query(
      `UPDATE products SET category=$1,name=$2,price=$3,images=$4,emas=$5,karat=$6,
        berat=$7,size=$8,description=$9,stock=$10,active=$11,badge=$12,certified=$13,draft=$14,slug=$15 WHERE id=$16 RETURNING *`,
      [p.category, p.name, p.price, JSON.stringify(p.images), p.emas, p.karat,
        p.berat, p.size, p.description, p.stock, p.active, p.badge, p.certified, p.draft, slug, id],
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

// Kompres & perkecil 1 gambar di tempat (overwrite). Format DIPERTAHANKAN agar
// cocok dengan ekstensi/Content-Type. GIF dibiarkan (bisa animasi).
async function compressImage(file) {
  if (file.mimetype === 'image/gif') return;
  try {
    let img = sharp(file.path)
      .rotate() // perbaiki orientasi dari EXIF HP
      .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true });
    if (file.mimetype === 'image/png') img = img.png({ quality: 80, compressionLevel: 9 });
    else if (file.mimetype === 'image/webp') img = img.webp({ quality: 80 });
    else img = img.jpeg({ quality: 80, mozjpeg: true });
    const buf = await img.toBuffer();
    await fs.promises.writeFile(file.path, buf);
  } catch (e) {
    console.warn('[compressImage]', file.filename, e.message); // pakai file asli kalau gagal
  }
}

// Admin: upload gambar -> kompres -> kembalikan URL permanen
app.post('/api/upload', requireAuth, (req, res) => {
  upload.array('images', 6)(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran file maksimal 8MB'
        : err.message || 'Gagal upload';
      return res.status(400).json({ error: msg });
    }
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Tidak ada file' });
    await Promise.all(files.map(compressImage));
    const urls = files.map((f) => `/uploads/${f.filename}`);
    res.json({ urls });
  });
});

// ---------- Pengaturan toko ----------
const ALLOWED_SETTINGS = ['whatsapp', 'store_name', 'hours', 'promo_text', 'address', 'usd_rate'];

// Publik: ambil pengaturan toko (dipakai etalase untuk nomor WA dll)
app.get('/api/settings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings');
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengambil pengaturan' });
  }
});

// Admin: simpan pengaturan toko
app.put('/api/admin/settings', requireAuth, async (req, res) => {
  const b = req.body || {};
  try {
    for (const key of ALLOWED_SETTINGS) {
      if (b[key] === undefined) continue;
      const value = String(b[key]).trim();
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value],
      );
    }
    const { rows } = await pool.query('SELECT key, value FROM settings');
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    res.json(out);
  } catch (e) {
    console.error('[PUT /api/admin/settings]', e.message);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan' });
  }
});

// ---------- Halaman per-produk (SEO + share) ----------
const INDEX_HTML_PATH = path.join(__dirname, 'public', 'index.html');

function htmlEscape(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Sajikan index.html dengan meta OG + JSON-LD khusus produk, lalu auto-buka detailnya.
app.get('/produk/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE slug=$1 AND active = true AND draft = false LIMIT 1',
      [req.params.slug],
    );
    let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    if (rows.length) {
      const p = rowToProduct(rows[0]);
      const origin = `${req.protocol}://${req.get('host')}`;
      const img = (p.images[0] || '').startsWith('http')
        ? p.images[0] : origin + '/' + String(p.images[0] || '').replace(/^\//, '');
      const title = `${p.name} - KARYABARU`;
      const desc = (p.description || `${p.name}, emas ${p.emas || p.karat || ''} ${p.berat || ''}`).slice(0, 160);
      const jsonLd = {
        '@context': 'https://schema.org', '@type': 'Product',
        name: p.name, image: img ? [img] : undefined,
        description: p.description || desc, category: p.category,
        brand: { '@type': 'Brand', name: 'KARYABARU' },
        offers: {
          '@type': 'Offer', priceCurrency: 'IDR', price: p.price,
          availability: p.badge === 'Habis' || p.stock <= 0
            ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
          url: `${origin}/produk/${p.slug}`,
        },
      };
      const inject = `
    <meta property="og:title" content="${htmlEscape(title)}">
    <meta property="og:description" content="${htmlEscape(desc)}">
    <meta property="og:image" content="${htmlEscape(img)}">
    <meta property="og:url" content="${origin}/produk/${htmlEscape(p.slug)}">
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
    <script>window.__PRODUCT_SLUG__ = ${JSON.stringify(p.slug)};</script>
  `;
      html = html
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${htmlEscape(title)}</title>`)
        .replace('</head>', inject + '</head>');
    }
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  } catch (e) {
    console.error('[GET /produk/:slug]', e.message);
    res.sendFile(INDEX_HTML_PATH);
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
