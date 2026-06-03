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
const Anthropic = require('@anthropic-ai/sdk');
const { pool, init } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'ganti-secret-ini';

// Klien Claude untuk fitur "deskripsi otomatis dari gambar".
// Aktif hanya jika ANTHROPIC_API_KEY di-set.
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

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

// Admin: upload gambar -> kembalikan URL permanen
app.post('/api/upload', requireAuth, (req, res) => {
  upload.array('images', 6)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran file maksimal 8MB'
        : err.message || 'Gagal upload';
      return res.status(400).json({ error: msg });
    }
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Tidak ada file' });
    const urls = files.map((f) => `/uploads/${f.filename}`);
    res.json({ urls });
  });
});

// Petakan path gambar (dari admin) ke file lokal + tentukan media type.
function resolveLocalImage(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return null;
  const clean = imagePath.split('?')[0].split('#')[0];
  let filePath = null;
  if (clean.startsWith('/uploads/')) {
    filePath = path.join(UPLOAD_DIR, path.basename(clean));
  } else if (clean.startsWith('img/') || clean.startsWith('/img/')) {
    filePath = path.join(__dirname, 'public', clean.replace(/^\//, ''));
  } else {
    return null; // URL eksternal tidak didukung di sini
  }
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png'
    : ext === '.webp' ? 'image/webp'
      : ext === '.gif' ? 'image/gif'
        : 'image/jpeg';
  return { data: fs.readFileSync(filePath).toString('base64'), mediaType };
}

const DESC_SYSTEM_PROMPT = `Anda adalah penulis deskripsi produk untuk toko perhiasan & logam mulia "KARYABARU" di Indonesia.
Tugas: lihat foto perhiasan yang diberikan, lalu tulis SATU paragraf deskripsi produk yang menarik dan profesional dalam Bahasa Indonesia.

Aturan:
- 2-4 kalimat, ramah dan meyakinkan, cocok untuk katalog online.
- Sebutkan jenis perhiasan (cincin/gelang/kalung/anting), kesan desain, dan untuk acara/kesempatan apa cocok dipakai.
- Jika tampak motif/ukiran khusus, sebutkan secara natural.
- JANGAN mengarang berat, kadar emas, harga, atau ukuran (data itu diisi terpisah).
- Jangan pakai tanda kutip, jangan pakai poin/markdown, jangan sebut bahwa ini dihasilkan AI.
- Keluarkan HANYA teks deskripsinya saja.`;

// Admin: buat deskripsi otomatis dari gambar produk (Claude vision)
app.post('/api/generate-description', requireAuth, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({
      error: 'Fitur AI belum aktif. Set ANTHROPIC_API_KEY di environment.',
    });
  }
  const img = resolveLocalImage((req.body || {}).image);
  if (!img) {
    return res.status(400).json({ error: 'Gambar tidak ditemukan. Upload foto dulu.' });
  }
  const hint = (req.body || {}).name ? `Nama/kategori produk: ${req.body.name}.` : '';
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: [
        { type: 'text', text: DESC_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } },
            { type: 'text', text: `Tuliskan deskripsi produk untuk perhiasan pada foto ini. ${hint}`.trim() },
          ],
        },
      ],
    });
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim();
    if (!text) return res.status(502).json({ error: 'AI tidak menghasilkan teks.' });
    res.json({ description: text });
  } catch (e) {
    console.error('[generate-description]', e.status || '', e.message);
    if (e instanceof Anthropic.AuthenticationError) {
      return res.status(502).json({ error: 'ANTHROPIC_API_KEY tidak valid.' });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi sebentar.' });
    }
    res.status(502).json({ error: 'Gagal membuat deskripsi: ' + e.message });
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
