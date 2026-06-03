# Toko Online KARYABARU

Katalog perhiasan & logam mulia. Sekarang **full-stack**:

- **Frontend** (etalase) — `public/index.html` + `public/products.js`
- **Halaman admin** — `public/admin.html` (kelola produk)
- **Backend API** — `server.js` (Express)
- **Database** — PostgreSQL (tabel `products`)

```
Browser  →  Express (server.js)  →  PostgreSQL
```

## Struktur

```
public/          # file yang tampil ke pengunjung (statis)
  index.html
  admin.html     # buka /admin.html untuk kelola produk
  products.js    # data produk cadangan (dipakai kalau DB belum siap)
  img/
server.js        # API + penyaji file statis
db.js            # koneksi & inisialisasi PostgreSQL (auto buat tabel + seed)
.env.example     # contoh konfigurasi
```

## Cara kerja data produk

1. Saat server start: tabel `products` dibuat otomatis. Kalau masih kosong,
   diisi dari `public/products.js` (seed awal).
2. Etalase mengambil produk dari `GET /api/products`. Kalau API mati,
   otomatis pakai `products.js` sebagai cadangan.
3. Tambah/edit/hapus produk dilakukan lewat **`/admin.html`** (tersimpan ke DB).

## Deploy di Railway

1. **Tambah database**: di project Railway → **New** → **Database** → **PostgreSQL**.
2. **Set Variables** di service aplikasi (tab *Variables*):
   - `DATABASE_URL` = `${{ Postgres.DATABASE_URL }}`  (referensi otomatis ke service Postgres)
   - `ADMIN_PASSWORD` = password admin pilihanmu (WAJIB ganti)
   - `JWT_SECRET` = teks acak panjang (WAJIB ganti)
   - `DATABASE_SSL` = `false` (koneksi internal Railway)
3. **Tambah Volume (untuk gambar permanen)**: service aplikasi → **Settings** →
   **Volumes** → **New Volume**, mount path `/data`. Lalu tambah variable:
   - `UPLOAD_DIR` = `/data/uploads`
   > Tanpa Volume, gambar yang di-upload akan hilang setiap kali redeploy.
4. Railway otomatis menjalankan `npm install` lalu `npm start` (`node server.js`).
5. Buka domain Railway → etalase tampil. Buka `…/admin.html` → login dengan `ADMIN_PASSWORD`.

## Menjalankan lokal

```bash
cp .env.example .env      # lalu isi DATABASE_URL ke Postgres-mu
npm install
npm start                 # http://localhost:3000
```

> Tanpa `DATABASE_URL`, server tetap jalan dan etalase tampil dari `products.js`,
> tapi fitur admin/DB tidak aktif.

## API singkat

| Method | Endpoint | Akses | Fungsi |
|--------|----------|-------|--------|
| GET | `/api/products` | publik | daftar produk aktif |
| POST | `/api/admin/login` | publik | login admin → token |
| GET | `/api/admin/products` | admin | semua produk |
| POST | `/api/products` | admin | tambah produk |
| PUT | `/api/products/:id` | admin | ubah produk |
| DELETE | `/api/products/:id` | admin | hapus produk |
| POST | `/api/upload` | admin | upload gambar (maks 6 file, 8MB) → URL `/uploads/...` |
| POST | `/api/orders` | publik | buat pesanan saat checkout (tersimpan di DB) |
| GET | `/api/admin/orders` | admin | daftar pesanan |
| PUT | `/api/admin/orders/:id` | admin | ubah status pesanan (baru/diproses/dikirim/selesai/batal) |
