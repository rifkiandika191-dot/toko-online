#!/bin/bash
# Klik dua kali file ini untuk MENJALANKAN watcher.
# Selama jendela ini terbuka, setiap perubahan file (tambah img / edit barang)
# otomatis di-commit & push ke GitHub. Tutup jendela untuk berhenti.
cd "$(dirname "$0")"

echo "================================================"
echo "  AUTO-PUSH watcher AKTIF — toko-online"
echo "  Biarkan jendela ini terbuka."
echo "  Tutup / Ctrl+C untuk berhenti."
echo "================================================"

INTERVAL=10   # cek tiap 10 detik
while true; do
  ./auto-push.sh
  sleep "$INTERVAL"
done
