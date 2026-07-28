const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const before = content;

      content = content.replace(/bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500/g, 'bg-rose-500 hover:bg-rose-400');
      content = content.replace(/bg-gradient-to-r from-cyan-500 to-violet-500/g, 'bg-cyan-500');
      content = content.replace(/bg-gradient-to-b from-\[#070b18\] via-\[#040711\] to-\[#070b18\]/g, 'bg-[#0b1020]');
      content = content.replace(/bg-gradient-to-r from-amber-950\/40 via-rose-950\/30 to-amber-950\/40/g, 'bg-[#0b1020]');
      content = content.replace(/bg-gradient-to-b from-rose-950\/20 to-\[#0b1020\]/g, 'bg-[#0b1020]');
      content = content.replace(/bg-gradient-to-r from-violet-950\/80 to-indigo-950\/80/g, 'bg-violet-950');
      content = content.replace(/bg-gradient-to-r from-\[#111827\] via-\[#141d33\] to-\[#111827\]/g, 'bg-[#111827]');
      content = content.replace(/text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500/g, 'text-amber-300');
      content = content.replace(/bg-gradient-to-br from-purple-900\/30 to-\[#0b1020\]/g, 'bg-[#0b1020]');
      content = content.replace(/bg-gradient-to-br from-emerald-900\/30 to-\[#0b1020\]/g, 'bg-[#0b1020]');
      content = content.replace(/bg-gradient-to-br from-cyan-900\/30 to-\[#0b1020\]/g, 'bg-[#0b1020]');
      content = content.replace(/bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600/g, 'bg-rose-500');

      if (before !== content) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

processDir('src');
console.log('Done!');
