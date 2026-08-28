// Import every game module so a syntax error or a bad import shows up here
// instead of as a blank screen on a phone. main.js is parse-checked only: it is
// the one module that touches the DOM at import time.
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(process.cwd(), 'public/js');
const skip = new Set(['main.js']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

let bad = 0;
for (const file of walk(root)) {
  const label = relative(root, file).replace(/\\/g, '/');
  if (skip.has(label)) continue;
  try {
    const mod = await import(pathToFileURL(file).href);
    console.log(`  ok  ${label.padEnd(38)} ${Object.keys(mod).length} exports`);
  } catch (e) {
    bad++;
    console.log(`FAIL  ${label}\n      ${e.message}`);
  }
}

try {
  const url = JSON.stringify(pathToFileURL(join(root, 'main.js')).href);
  execFileSync(process.execPath, ['--input-type=module', '-e',
    `import(${url}).catch((e) => {
       if (!/document|window|navigator|matchMedia|is not defined/i.test(String(e))) {
         console.error(e); process.exit(1);
       }
     })`], { stdio: 'pipe' });
  console.log('  ok  main.js                                (parsed)');
} catch (e) {
  bad++;
  console.log('FAIL  main.js\n', String(e.stderr || e.message).slice(0, 800));
}

process.exit(bad ? 1 : 0);
