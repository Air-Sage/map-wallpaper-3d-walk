// Line each oblique view (the original picture and the three generated sides) up with the world built from
// the plan, so the page can paint the world's walls with them.
// A view is modelled as an oblique parallel projection of the plan world (ground y = 0, x east, z south):
//   across = x*cos(a) - z*sin(a)          a = how far round the camera stands (0 = the original, south side)
//   toward = x*sin(a) + z*cos(a)
//   X = sx*across + ox                    picture coordinates: X right, Y up, half height 1
//   Y = -sw*toward + sh*height + oy
// sx, sw, sh, ox, oy are searched so that the plan's colours agree with what the view shows at the tops.
// usage: node register_plan.mjs <siteDir> [ids...]     -> tools/plan_views.json and PLANS in index.html
import fs from 'fs'; import path from 'path'; import sharp from 'sharp';
const [,, site, ...only] = process.argv;
const GW = 168, RAD = Math.PI / 180, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const outFile = path.join(site, 'tools', 'plan_views.json'), out = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
const rgb = async (file, w, h) => (await sharp(file).removeAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true }));

for (const f of fs.readdirSync(path.join(site, 'plan')).filter(f => /^\d{3}\.webp$/.test(f)).sort()) {
  const id = f.slice(0, 3); if (only.length ? !only.includes(id) : out[id]) continue;
  if (!fs.existsSync(path.join(site, 'hmap', f))) continue;
  const pm = await sharp(path.join(site, 'plan', f)).metadata(), GH = Math.round(GW * pm.height / pm.width), n = GW * GH;
  const plan = (await rgb(path.join(site, 'plan', f), GW, GH)).data;
  const hraw = await sharp(path.join(site, 'hmap', f)).greyscale().resize(GW, GH, { fit: 'fill' }).raw().toBuffer();
  const om = await sharp(path.join(site, 'tex', id + '.webp')).metadata(), bx = om.width / om.height * 0.97, bz = bx * pm.height / pm.width;
  // samples: flat spots of the plan (tops and ground), with world position and colour
  const S = [];
  for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
    const i = y * GW + x, h = hraw[i]; let flat = true;
    for (const j of [i - 1, i + 1, i - GW, i + GW]) if (Math.abs(hraw[j] - h) > 6) { flat = false; break; }
    if (!flat) continue;
    S.push(-bx + (x + 0.5) / GW * 2 * bx, h < 10 ? 0 : Math.pow(h / 255, 1.15) * 0.27, -bz + (y + 0.5) / GH * 2 * bz, plan[i * 3], plan[i * 3 + 1], plan[i * 3 + 2]);
  }
  const ns = S.length / 6; out[id] = {};
  for (const deg of [0, 90, 180, 270]) {
    const file = path.join(site, 'tex', deg ? `${id}_${String(deg).padStart(3, '0')}.webp` : `${id}.webp`); if (!fs.existsSync(file)) continue;
    const vm = await sharp(file).metadata(), asp = vm.width / vm.height, IW = asp >= 1 ? 320 : Math.round(320 * asp), IH = asp >= 1 ? Math.round(320 / asp) : 320, img = (await rgb(file, IW, IH)).data;
    const ca = Math.cos(deg * RAD), sa = Math.sin(deg * RAD), A = new Float32Array(ns), Tw = new Float32Array(ns);
    for (let k = 0; k < ns; k++) { A[k] = S[k * 6] * ca - S[k * 6 + 2] * sa; Tw[k] = S[k * 6] * sa + S[k * 6 + 2] * ca; }
    // agreement of plan colours and view colours: mean correlation of the three channels over the samples that fall in the picture
    const score = (sx, sw, sh, ox, oy, step) => {
      let m = 0; const a = [0, 0, 0], b = [0, 0, 0], ab = [0, 0, 0], aa = [0, 0, 0], bb = [0, 0, 0];
      for (let k = 0; k < ns; k += step) {
        const X = sx * A[k] + ox, Y = -sw * Tw[k] + sh * S[k * 6 + 1] + oy, px = Math.floor((X / asp * 0.5 + 0.5) * IW), py = Math.floor((0.5 - Y * 0.5) * IH);
        if (px < 0 || py < 0 || px >= IW || py >= IH) continue;
        const j = (py * IW + px) * 3; m++;
        for (let c = 0; c < 3; c++) { const p = S[k * 6 + 3 + c], q = img[j + c]; a[c] += p; b[c] += q; ab[c] += p * q; aa[c] += p * p; bb[c] += q * q; }
      }
      const total = Math.ceil(ns / step); if (m < total * 0.55) return -1;        // most of the plan must land inside the picture
      let r = 0; for (let c = 0; c < 3; c++) { const va = m * aa[c] - a[c] * a[c], vb = m * bb[c] - b[c] * b[c]; if (va > 1e-6 && vb > 1e-6) r += (m * ab[c] - a[c] * b[c]) / Math.sqrt(va * vb) / 3; }
      return r * Math.sqrt(m / total);
    };
    // first guess: the plan fills the picture's width, and its depth fills most of the picture's height
    const side = deg % 180 !== 0, sx0 = asp / (side ? bz : bx), sw0 = 0.85 / (side ? bx : bz);
    const shOf = (sx, sw) => sx * Math.sqrt(Math.max(0.04, 1 - Math.min(0.96, (sw / sx) ** 2)));      // a true parallel view: sw = sx sin(angle), sh = sx cos(angle)
    let best = { sc: -2 };
    for (let fx = 0.7; fx <= 1.45; fx *= 1.07) for (let fw = 0.55; fw <= 1.5; fw *= 1.08) for (let ox = -0.3; ox <= 0.301; ox += 0.075) for (let oy = -0.4; oy <= 0.401; oy += 0.08) {
      const sx = sx0 * fx, sw = sw0 * fw, sc = score(sx, sw, shOf(sx, sw), ox * asp, oy, 3); if (sc > best.sc) best = { sc, sx, sw, sh: shOf(sx, sw), ox: ox * asp, oy };
    }
    for (let round = 0, d = 0.035, dt = 0.04; round < 5; round++, d /= 1.7, dt /= 1.7) {          // refine each number in turn, heights too
      for (const key of ['sx', 'sw', 'ox', 'oy', 'sh']) for (const dir of [-1, 1]) for (let rep = 0; rep < 4; rep++) {
        const t = { ...best }; if (key === 'ox' || key === 'oy') t[key] += dir * dt; else t[key] *= 1 + dir * d;
        if (key !== 'sh') t.sh = best.sh * (key === 'sx' ? 1 + dir * d : 1);
        t.sc = score(t.sx, t.sw, t.sh, t.ox, t.oy, 1); if (t.sc > best.sc) best = t; else break;
      }
    }
    best.sc = score(best.sx, best.sw, best.sh, best.ox, best.oy, 1);
    out[id][deg] = [+best.sx.toFixed(4), +best.sw.toFixed(4), +best.sh.toFixed(4), +best.ox.toFixed(4), +best.oy.toFixed(4), +best.sc.toFixed(3)];
    console.log(id, String(deg).padStart(3), 'agreement', best.sc.toFixed(3), 'angle', (Math.asin(clamp(best.sw / best.sx, 0, 1)) / RAD).toFixed(0) + '°', JSON.stringify(out[id][deg].slice(0, 5)));
  }
  fs.writeFileSync(outFile, JSON.stringify(out));
}
// the page's list: per map, the views that agree well enough with the plan to paint walls with ([sx, sw, sh, ox, oy] each)
const plans = {};
for (const f of fs.readdirSync(path.join(site, 'plan')).sort()) {
  const id = f.slice(0, 3); if (!/^\d{3}\.webp$/.test(f) || !fs.existsSync(path.join(site, 'hmap', f))) continue;
  plans[id] = {}; for (const [deg, v] of Object.entries(out[id] || {})) if (v[5] >= 0.3) plans[id][deg] = v.slice(0, 5);
}
const html = path.join(site, 'index.html'), s = fs.readFileSync(html, 'utf8');
fs.writeFileSync(html, s.replace(/\/\*PLANS-BEGIN\*\/[\s\S]*?\/\*PLANS-END\*\//, () => '/*PLANS-BEGIN*/' + JSON.stringify(plans) + '/*PLANS-END*/'));
console.log('maps with a plan:', Object.keys(plans).length);
