// Cache-busting for the Pages deploy: stamps ?v=<version> onto the stylesheet, the entry script and every
// relative module import, so a browser that cached an earlier deploy can never pair an old script with the
// new page. GitHub Pages lets browsers keep files for 10 minutes, which is long enough to hit this on a phone.
// Vendored libraries and data files are left alone (they only change when their names do).
//
// Usage: node tools/version_assets.mjs <public folder> <version>
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {join, relative, sep} from 'node:path';

const [root, version] = process.argv.slice(2);
if (!root || !/^[\w.-]{4,40}$/.test(version || '')) {
  console.error('usage: node tools/version_assets.mjs <public folder> <version>');
  process.exit(2);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const stamp = path => `${path}?v=${version}`;
let files = 0, specifiers = 0;

// static `from './x.js'` and `import './x.js'`, and dynamic `import('./x.js')`
const STATIC = /(\bfrom\s*|\bimport\s*)(['"])(\.{1,2}\/[^'"?]+?\.js)\2/g;
const DYNAMIC = /(\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"?]+?\.js)\2(\s*\))/g;

for await (const file of walk(join(root, 'src'))) {
  if (!file.endsWith('.js')) continue;
  const rel = relative(root, file).split(sep).join('/');
  let source = await readFile(file, 'utf8');
  const before = source;
  const keep = spec => spec.includes('/vendor/');
  source = source.replace(STATIC, (m, pre, q, spec) => keep(spec) ? m : (specifiers++, `${pre}${q}${stamp(spec)}${q}`));
  source = source.replace(DYNAMIC, (m, pre, q, spec, post) => keep(spec) ? m : (specifiers++, `${pre}${q}${stamp(spec)}${q}${post}`));
  if (source !== before) { await writeFile(file, source); files++; }
  // every relative import that is not vendored must now carry the version
  for (const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+\.js)(\?[^'"]*)?\1/g)) {
    if (!m[2].includes('/vendor/') && m[3] !== `?v=${version}`) {
      console.error(`${rel}: import ${m[2]} is not versioned`);
      process.exit(1);
    }
  }
}

const htmlPath = join(root, 'index.html');
let html = await readFile(htmlPath, 'utf8');
const pages = [[/(<link rel="stylesheet" href=")(\.\/styles\.css)(")/, 'stylesheet'], [/(<script type="module" src=")(\.\/src\/main\.js)(")/, 'entry script']];
for (const [pattern, what] of pages) {
  if (!pattern.test(html)) { console.error(`index.html: ${what} link not found`); process.exit(1); }
  html = html.replace(pattern, (m, a, path, c) => `${a}${stamp(path)}${c}`);
}
await writeFile(htmlPath, html);
console.log(`versioned ${specifiers} imports in ${files} modules, plus the stylesheet and entry script (v=${version})`);
