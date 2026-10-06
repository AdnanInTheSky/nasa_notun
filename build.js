const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Copy all .html files and favicon
fs.readdirSync(__dirname).forEach(file => {
  if (file.endsWith('.html') || file === 'favicon.svg') {
    fs.copyFileSync(path.join(__dirname, file), path.join(distDir, file));
  }
});

// 2. Copy asset folders
['styles', 'js', 'js-api', 'data'].forEach(folder => {
  copyDir(path.join(__dirname, folder), path.join(distDir, folder));
});

console.log('✅ Build completed successfully! Output in dist/');
