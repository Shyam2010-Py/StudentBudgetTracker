import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const requiredFiles = ['index.html', 'offline.html', 'manifest.json', 'service-worker.js'];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing required file: ${file}`);
}

const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith('.html'));
for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/gi)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(?:https?:|data:|mailto:|javascript:)/i.test(ref)) continue;
    const target = path.resolve(root, ref);
    if (!target.startsWith(root + path.sep) && target !== root) continue;
    if (!fs.existsSync(target)) failures.push(`${file}: missing local resource ${ref}`);
  }
}

try {
  JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
} catch (error) {
  failures.push(`manifest.json is invalid JSON: ${error.message}`);
}

const jsDir = path.join(root, 'js');
if (fs.existsSync(jsDir)) {
  for (const file of fs.readdirSync(jsDir).filter((name) => name.endsWith('.js'))) {
    try {
      execFileSync(process.execPath, ['--check', path.join(jsDir, file)], { stdio: 'pipe' });
    } catch (error) {
      failures.push(`JavaScript syntax error in js/${file}: ${error.stderr?.toString().trim() || error.message}`);
    }
  }
}

const dashboard = fs.readFileSync(path.join(root, 'js/dashboard.js'), 'utf8');
for (const marker of [
  'function getCategoryBudgetIssues',
  'if (issue.pct > 200) score -= 30',
  'else if (issue.pct > 150) score -= 25',
  'else if (issue.pct > 125) score -= 15',
  'This is significantly affecting your financial health.'
]) {
  if (!dashboard.includes(marker)) failures.push(`budget regression guard missing: ${marker}`);
}

if (failures.length) {
  console.error(failures.map((f) => `FAIL ${f}`).join('\n'));
  process.exit(1);
}
console.log(`PASS StudentBudgetTracker static QA (${htmlFiles.length} HTML pages, ${fs.readdirSync(jsDir).filter((n) => n.endsWith('.js')).length} JS files)`);
