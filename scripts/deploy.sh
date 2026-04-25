#!/bin/bash
# Auto-deploy script: builds and pushes to gh-pages
set -e

echo "Building..."
npx vite build
node scripts/generate-icons.cjs

echo "Deploying to gh-pages..."
git checkout gh-pages
git rm -rf index.html manifest.json sw.js 200.html icon-192.png icon-512.png assets/ 2>/dev/null || true
cp dist/index.html .
cp dist/manifest.json .
cp dist/sw.js .
cp dist/icon-192.png .
cp dist/icon-512.png .
cp -r dist/assets .
echo "200     /index.html" > 200.html
git add index.html manifest.json sw.js 200.html icon-192.png icon-512.png assets/
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M')"
git push origin gh-pages

echo "Switching back to master..."
git checkout master

echo "Deployed! https://dev-smc93.github.io/frostpaw-defense/"
