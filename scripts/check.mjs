// Import every game module so a syntax error or a bad import shows up here
// instead of as a blank screen on Bill's phone. main.js is skipped: it is the
// only module that touches the DOM at import time.
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

const dir = resolve(process.cwd(), 'public/js');
const skip = new Set(['main.js']);
let bad = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
  if (skip.has(f)) continue;
  try {
    const m = await import(pathToFileURL(join(dir, f)).href);
    console.log(`  ok  ${f.padEnd(14)} ${Object.keys(m).length} exports`);
  } catch (e) {
    bad++;
    console.log(`FAIL  ${f}\n      ${e.message}`);
  }
}
// main.js only gets a parse check — running it would need a browser.
const { execFileSync } = await import('node:child_process');
try {
  execFileSync(process.execPath, ['--input-type=module', '-e',
    `import(${JSON.stringify(pathToFileURL(join(dir, 'main.js')).href)}).catch(e=>{
       if (!/document|window|navigator|not defined/i.test(String(e))) { console.error(e); process.exit(1); }
     })`], { stdio: 'pipe' });
  console.log('  ok  main.js       (parsed)');
} catch (e) {
  bad++;
  console.log('FAIL  main.js\n     ', String(e.stderr || e.message).slice(0, 600));
}
process.exit(bad ? 1 : 0);
