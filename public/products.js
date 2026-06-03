/* ============================================================
   DATA PRODUK KARYABARU
   ------------------------------------------------------------
   👉 TAMBAH / UBAH PRODUK CUKUP DI FILE INI.
      Setelah disimpan, perubahan otomatis ke-push ke GitHub
      (auto-commit aktif).

   Cara menambah produk baru:
   1. Taruh fotonya di folder  img/
   2. Salin satu blok { ... } di bawah, tempel sebelum tanda  ];
   3. Ganti isinya. Pastikan koma (,) di akhir tiap blok.

   Contoh satu produk:
   {
     id: 16,                                  // angka UNIK, lanjutkan dari terakhir
     category: "Cincin",                      // Cincin / Gelang / Kalung Sultan / dll
     name: "Cincin Bunga 3 gram",
     price: 4500000,                          // harga Rupiah, tanpa titik/koma
     images: ["img/foto1.png", "img/foto2.png"],  // nama file HARUS sama persis (huruf besar/kecil)
     emas: "700",
     karat: "700",
     berat: "3 gram",
     size: "15",                              // opsional, khusus cincin
     description: "Deskripsi singkat produk."
   },
   ============================================================ */
window.PRODUCTS = [
    {
        id: 1,
        category: "Kalung Sultan",
        name: "Kalung Sultan Kupu-Kupu 25 gram",
        price: 50000000,
        images: ["img/kupukupu.png"],
        emas: "700",
        karat: "700",
        berat: "25 gram",
        description: "Kalung Sultan dengan desain kupu-kupu mewah dan detail ukiran emas yang halus. Cocok untuk acara istimewa."
    },
    {
        id: 2,
        category: "Kalung Sultan",
        name: "Kalung Sultan 23,7 gram",
        price: 28440000,
        images: ["img/kalungsultan1.png", "img/kalungsultan2.png", "img/kalungsultan3.png"],
        emas: "420",
        karat: "420",
        berat: "23.7 gram",
        description: "Kalung Sultan dengan desain mewah dan detail ukiran emas yang halus. Cocok untuk acara istimewa."
    },
    {
        id: 3,
        category: "Gelang",
        name: "Gelang Fusion SS",
        price: 6000000,
        images: ["img/gelangfusionss.png"],
        emas: "420",
        karat: "420",
        berat: "5 gram",
        description: "Gelang dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 4,
        category: "Gelang",
        name: "Gelang Fusion LM",
        price: 6000000,
        images: ["img/Gelang Fusion LM.png"],
        emas: "420",
        karat: "420",
        berat: "5 gram",
        description: "Gelang dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 5,
        category: "Gelang",
        name: "Gelang Fusion Bunga",
        price: 7200000,
        images: ["img/Gelang Fusion Bunga3.png", "img/Gelang Fusion Bunga2.png", "img/Gelang Fusion Bunga1.png"],
        emas: "420",
        karat: "420",
        berat: "6 gram",
        description: "Gelang dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 6,
        category: "Gelang",
        name: "Gelang Fusion Pita",
        price: 22700000,
        images: ["img/Gelang Fusion Pita1.png", "img/Gelang Fusion Pita2.png"],
        emas: "700",
        karat: "700",
        berat: "11,35 gram",
        description: "Gelang dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 7,
        category: "Gelang",
        name: "Gelang Tikar",
        price: 25480000,
        images: ["img/Gelang Tikar1.png", "img/Gelang Tikar2.png", "img/Gelang Tikar3.png"],
        emas: "23",
        karat: "23",
        berat: "10,4 gram",
        description: "Gelang dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 8,
        category: "Gelang",
        name: "Gelang Boba",
        price: 47701500,
        images: ["img/Gelang Boba1.png", "img/Gelang Boba2.png", "img/Gelang Boba3.png"],
        emas: "23",
        karat: "23",
        berat: "19,47 gram",
        description: "Gelang dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 9,
        category: "Gelang Borobudur",
        name: "Gelang Borobudur",
        price: 50000000,
        images: ["img/Gelang Borobudur1.png"],
        emas: "700",
        karat: "700",
        berat: "25 gram",
        description: "Gelang dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 10,
        category: "Gelang Kusion Bunga",
        name: "Gelang Kusion Bunga",
        price: 28440000,
        images: ["img/Gelang Kusion Bunga1.png", "img/Gelang Kusion Bunga2.png", "img/Gelang Kusion Bunga3.png"],
        emas: "700",
        karat: "700",
        berat: "14,22 gram",
        description: "Gelang dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 11,
        category: "Cincin",
        name: "Cincin Roda",
        price: 2064000,
        images: ["img/cincin roda1.png", "img/cincin roda2.png"],
        emas: "420",
        karat: "420",
        berat: "1,72 gram",
        size: "15",
        description: "Cincin dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 12,
        category: "Cincin",
        name: "Cincin SS",
        price: 6096000,
        images: ["img/cincin SS1.png", "img/cincin SS2.png"],
        emas: "420",
        karat: "420",
        berat: "5,08 gram",
        size: "14",
        description: "Cincin dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 13,
        category: "Cincin",
        name: "Cincin Durian",
        price: 4200000,
        images: ["img/Cincin Durian1.png", "img/Cincin Durian2.png"],
        emas: "700",
        karat: "700",
        berat: "2,1 gram",
        size: "15",
        description: "Cincin dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 14,
        category: "Cincin",
        name: "Cincin 700",
        price: 4000000,
        images: ["img/Cincin7001.png", "img/Cincin7002.png"],
        emas: "700",
        karat: "700",
        berat: "2 gram",
        size: "14",
        description: "Cincin dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    },
    {
        id: 15,
        category: "Cincin",
        name: "Cincin AD",
        price: 4000000,
        images: ["img/cincinAD.png"],
        emas: "700",
        karat: "700",
        berat: "2 gram",
        size: "12",
        description: "Cincin dengan desain modern dan elegan, terbuat dari emas berkualitas tinggi. Cocok untuk melengkapi penampilan Anda sehari-hari atau acara khusus."
    }
];
