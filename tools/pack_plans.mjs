// Pack Codex's top-down views into web assets and list them in index.html.
//   plan/NNN.webp   the scene from straight above, 1536 px wide (colour)
//   hmap/NNN.webp   its height map, 768 px wide, lossless grey (brightness = height above the ground)
// usage: node pack_plans.mjs <codexWorkDir> <siteDir>
import fs from 'fs'; import path from 'path'; import sharp from 'sharp';
const [,, work, site] = process.argv;
for (const sub of ['plan', 'hmap']) fs.mkdirSync(path.join(site, sub), { recursive: true });
for (const f of fs.readdirSync(path.join(work, 'plan')).filter(f => /^\d{3}\.png$/.test(f)).sort()) {
  const id = f.slice(0, 3), src = path.join(work, 'plan', f), hsrc = path.join(work, 'height', f), dst = path.join(site, 'plan', id + '.webp'), hdst = path.join(site, 'hmap', id + '.webp');
  if (!fs.existsSync(hsrc)) continue;
  if (fs.existsSync(dst) && fs.existsSync(hdst) && fs.statSync(dst).mtimeMs > fs.statSync(src).mtimeMs && fs.statSync(hdst).mtimeMs > fs.statSync(hsrc).mtimeMs) continue;
  const m = await sharp(src).metadata(), w = 1536, h = Math.round(w * m.height / m.width);
  await sharp(src).removeAlpha().resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: 84, effort: 5 }).toFile(dst);
  await sharp(hsrc).removeAlpha().greyscale().resize(768, Math.round(768 * m.height / m.width), { fit: 'fill', kernel: 'cubic' }).webp({ lossless: true, effort: 6 }).toFile(hdst);
  console.log('plan', id);
}
const plans = {};
for (const f of fs.readdirSync(path.join(site, 'plan')).sort()) { const id = f.slice(0, 3); if (/^\d{3}\.webp$/.test(f) && fs.existsSync(path.join(site, 'hmap', f))) plans[id] = 1; }
const html = path.join(site, 'index.html'), s = fs.readFileSync(html, 'utf8');
if (!/\/\*PLANS-BEGIN\*\//.test(s)) throw new Error('PLANS marker not found in index.html');
fs.writeFileSync(html, s.replace(/\/\*PLANS-BEGIN\*\/[\s\S]*?\/\*PLANS-END\*\//, () => '/*PLANS-BEGIN*/' + JSON.stringify(plans) + '/*PLANS-END*/'));
console.log('maps with a plan:', Object.keys(plans).length);
