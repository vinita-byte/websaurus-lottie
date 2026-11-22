// Exports every Lottie in lottie/ to:
//   exports/dotlottie/  one .lottie per animation + websaurus-all.lottie bundle
//   exports/mp4/        1080x1080 H.264 on brand cream, looped to at least 6s (social ready)
//   exports/gif/        480x480, 30fps, one loop, loops forever
//   exports/mov/        1080x1080 ProRes 4444 with transparency, one loop (for video editors)
// Run: node export.mjs   (needs Google Chrome + ffmpeg)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'lottie');
const OUT = path.join(ROOT, 'exports');
const SIZE = 1080;
const BG = '#EFE5DC';
const MIN_SECONDS = 6;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const names = fs.readdirSync(SRC).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
for (const d of ['dotlottie', 'mp4', 'gif', 'mov']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

// ---------- .lottie (dotLottie v1: zip with manifest.json + animations/<id>.json) ----------
function dotLottie(file, ids) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dotlottie-'));
  fs.mkdirSync(path.join(tmp, 'animations'));
  for (const id of ids) fs.copyFileSync(path.join(SRC, `${id}.json`), path.join(tmp, 'animations', `${id}.json`));
  fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify({
    version: '1.0', generator: 'websaurus-lottie export.mjs', author: 'W2',
    activeAnimationId: ids[0],
    animations: ids.map((id) => ({ id, speed: 1, loop: true, autoplay: true })),
  }));
  fs.rmSync(file, { force: true });
  execFileSync('zip', ['-q', '-X', '-r', file, 'manifest.json', 'animations'], { cwd: tmp });
  fs.rmSync(tmp, { recursive: true, force: true });
}
for (const n of names) dotLottie(path.join(OUT, 'dotlottie', `${n}.lottie`), [n]);
dotLottie(path.join(OUT, 'dotlottie', 'websaurus-all.lottie'), ['websaurus-idle', ...names.filter((n) => n !== 'websaurus-idle')]);
console.log('dotlottie done');

// ---------- frames ----------
const lottieJs = fs.readFileSync(path.join(ROOT, 'node_modules/lottie-web/build/player/lottie.min.js'), 'utf8');
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}#s{width:${SIZE}px;height:${SIZE}px}</style></head><body><div id="s"></div></body></html>`);
await page.addScriptTag({ content: lottieJs });

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

for (const n of names) {
  const data = JSON.parse(fs.readFileSync(path.join(SRC, `${n}.json`), 'utf8'));
  const frames = data.op - data.ip;
  const fps = data.fr;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${n}-`));
  await page.evaluate((d) => {
    window.anim?.destroy();
    window.anim = lottie.loadAnimation({ container: document.getElementById('s'), renderer: 'svg', loop: false, autoplay: false, animationData: d });
  }, data);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((f) => window.anim.goToAndStop(f, true), f);
    await page.screenshot({ path: path.join(dir, `f${String(f).padStart(4, '0')}.png`), omitBackground: true });
  }
  const seq = ['-framerate', String(fps), '-i', path.join(dir, 'f%04d.png')];
  const loops = Math.max(1, Math.ceil(MIN_SECONDS / (frames / fps)));

  // MP4 on cream, repeated to MIN_SECONDS
  ff([...seq, '-f', 'lavfi', '-i', `color=c=${BG}:s=${SIZE}x${SIZE}:r=${fps}`,
    '-filter_complex', `[1][0]overlay=shortest=1,loop=loop=${loops - 1}:size=${frames}:start=0,format=yuv420p[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', path.join(OUT, 'mp4', `${n}.mp4`)]);

  // GIF on cream, 480px, 30fps
  ff([...seq, '-f', 'lavfi', '-i', `color=c=${BG}:s=${SIZE}x${SIZE}:r=${fps}`,
    '-filter_complex', `[1][0]overlay=shortest=1,fps=30,scale=480:480:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    '-loop', '0', path.join(OUT, 'gif', `${n}.gif`)]);

  // ProRes 4444 with alpha
  ff([...seq, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0', path.join(OUT, 'mov', `${n}.mov`)]);

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${n}: ${frames} frames, mp4 ${loops}x loop`);
}
await browser.close();
