#!/bin/bash
# Auto-commit + push semua perubahan ke GitHub.
# Dipakai oleh watcher dan hook Claude Code. Bisa juga dijalankan manual.
set -e
cd "$(dirname "$0")"

# Tidak ada perubahan? berhenti diam-diam.
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

git add -A
MSG="auto: update $(date '+%Y-%m-%d %H:%M:%S')"
git commit -q -m "$MSG"

# Push; kalau remote lebih baru, rebase dulu lalu coba lagi.
if ! git push -q origin main 2>/dev/null; then
  git pull --rebase -q origin main || true
  git push -q origin main
fi

echo "[auto-push] $MSG"
