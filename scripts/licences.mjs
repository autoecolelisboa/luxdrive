// Writes public/licences.txt: the licences of every open-source package shipped in the app.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { encoding: 'utf8' }));
const seen = new Map();
(function walk(deps) {
  for (const [name, info] of Object.entries(deps ?? {})) {
    const key = `${name}@${info.version}`;
    if (!seen.has(key)) { seen.set(key, name); walk(info.dependencies); }
  }
})(tree.dependencies);

let out = 'LuxDrive — © 2026 HMA Productions. Composants libres utilisés et leurs licences.\n\n';
for (const [key, name] of [...seen].sort()) {
  const dir = path.join('node_modules', name);
  if (!fs.existsSync(dir)) continue;
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const file = fs.readdirSync(dir).find(f => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  out += '='.repeat(72) + `\n${key} — ${pkg.license ?? 'voir ci-dessous'}\n${pkg.homepage ?? ''}\n\n`;
  out += file ? fs.readFileSync(path.join(dir, file), 'utf8').trim() + '\n\n' : '(texte de licence non fourni par le paquet)\n\n';
}
fs.writeFileSync('public/licences.txt', out);
console.log(`${seen.size} paquets, ${out.length} caractères`);
