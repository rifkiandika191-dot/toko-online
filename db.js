// ============================================================
//  Koneksi & inisialisasi PostgreSQL
// ============================================================
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL belum di-set. Tambahkan PostgreSQL di Railway, '
    + 'atau set DATABASE_URL di file .env untuk lokal.');
}

// Railway private network tidak perlu SSL. Kalau pakai URL publik, set DATABASE_SSL=true.
const useSsl = process.env.DATABASE_SSL === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

// Buat tabel kalau belum ada.
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      category    TEXT NOT NULL,
      name        TEXT NOT NULL,
      price       INTEGER NOT NULL DEFAULT 0,
      images      JSONB NOT NULL DEFAULT '[]',
      emas        TEXT,
      karat       TEXT,
      berat       TEXT,
      size        TEXT,
      description TEXT,
      stock       INTEGER NOT NULL DEFAULT 0,
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Kolom label/badge produk (Baru/Terlaris/Stok Terbatas/Habis).
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT ''`);
  // Kolom bersertifikat (jaminan keaslian).
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS certified BOOLEAN NOT NULL DEFAULT false`);

  // Pengaturan toko (key-value): nomor WA, nama toko, jam buka, dll.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  await pool.query(
    `INSERT INTO settings (key, value) VALUES
      ('whatsapp', '6285157075592'),
      ('store_name', 'KARYABARU'),
      ('hours', ''),
      ('promo_text', 'Harga emas real-time kini tampil lebih menarik di banner promo.'),
      ('address', ''),
      ('warranty_text', 'Setiap produk dijamin keaslian emas dan kadarnya. Tersedia layanan tukar tambah dan buyback.')
     ON CONFLICT (key) DO NOTHING`,
  );

  // Live chat: percakapan pengunjung & pesan.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id           SERIAL PRIMARY KEY,
      visitor_id   TEXT UNIQUE NOT NULL,
      name         TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      admin_unread INTEGER NOT NULL DEFAULT 0
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id         SERIAL PRIMARY KEY,
      chat_id    INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      sender     TEXT NOT NULL,
      text       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id, id)`);
}

// Ambil data awal dari public/products.js (window.PRODUCTS).
function loadSeedProducts() {
  try {
    global.window = global.window || {};
    const file = path.join(__dirname, 'public', 'products.js');
    delete require.cache[require.resolve(file)];
    require(file);
    return Array.isArray(global.window.PRODUCTS) ? global.window.PRODUCTS : [];
  } catch (e) {
    console.warn('[db] Gagal membaca seed products.js:', e.message);
    return [];
  }
}

// Isi tabel dari products.js HANYA kalau masih kosong (sekali saja).
async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products');
  if (rows[0].n > 0) {
    console.log(`[db] Tabel products sudah berisi ${rows[0].n} baris, seed dilewati.`);
    return;
  }
  const seed = loadSeedProducts();
  if (!seed.length) {
    console.log('[db] Tidak ada data seed.');
    return;
  }
  for (const p of seed) {
    await pool.query(
      `INSERT INTO products (category, name, price, images, emas, karat, berat, size, description, stock, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        p.category || 'Lainnya',
        p.name || 'Tanpa nama',
        Number(p.price) || 0,
        JSON.stringify(Array.isArray(p.images) ? p.images : []),
        p.emas || null,
        p.karat || null,
        p.berat || null,
        p.size || null,
        p.description || null,
        Number(p.stock) || 0,
        p.active === false ? false : true,
      ],
    );
  }
  console.log(`[db] Seed selesai: ${seed.length} produk dimasukkan.`);
}

async function init() {
  await initSchema();
  await seedIfEmpty();
}

module.exports = { pool, init };
