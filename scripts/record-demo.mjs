/**
 * AgentTreasury CORE — Demo Video Recorder
 * 
 * Playwright drives the presentation step by step (avoids browser timer throttling).
 * No backend needed — HTML contains all demo data.
 * 
 * Usage: node scripts/record-demo.mjs
 * Output: demo-video.webm
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import http from 'http';
import net from 'net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(__dirname, 'demo-video.html');
const OUTPUT_DIR = path.join(ROOT, 'demo-output');

function findPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => { const p = srv.address().port; srv.close(() => resolve(p)); });
    srv.on('error', reject);
  });
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\n  AgentTreasury CORE — Demo Video Recorder\n');

  // Clean
  if (fs.existsSync(OUTPUT_DIR)) fs.rmSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Serve HTML
  const port = await findPort();
  const html = fs.readFileSync(HTML_PATH, 'utf-8');
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  await new Promise(r => server.listen(port, r));
  console.log(`  [1/4] Demo served on localhost:${port}`);

  // Browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUTPUT_DIR, size: { width: 1280, height: 720 } }
  });
  const page = await context.newPage();
  page.on('pageerror', err => console.log(`  [page error] ${err.message}`));
  console.log('  [2/4] Browser launched (recording)');

  await page.goto(`http://localhost:${port}`, { waitUntil: 'load' });
  console.log('  [3/4] Driving demo step by step...');

  // ── Drive demo from Playwright (no in-browser timers!) ──
  
  // Title slide
  await page.evaluate(() => show(0));
  console.log('         Title slide');
  await wait(5000);

  // Steps 1-10
  const TOTAL_STEPS = 10;
  for (let i = 0; i < TOTAL_STEPS; i++) {
    // Show step slide
    await page.evaluate((idx) => show(idx + 1), i);
    await wait(1000);
    
    // Fill in the JSON data
    await page.evaluate((idx) => {
      const step = STEPS[idx];
      const el = document.getElementById(`r-${step.num}`);
      el.innerHTML = `<pre>${hj(step.data, step.hl)}</pre>`;
    }, i);
    
    console.log(`         Step ${i + 1}/${TOTAL_STEPS}: ${await page.evaluate((idx) => STEPS[idx].title, i)}`);
    await wait(5000);
  }

  // End slide
  await page.evaluate((n) => show(n + 1), TOTAL_STEPS);
  console.log('         End slide');
  await wait(6000);

  // Close & save video
  console.log('  [4/4] Saving video...');
  try { await page.close(); } catch(e) { /* ok */ }
  try { await context.close(); } catch(e) { /* ok */ }

  // Copy video from temp dir (written after context.close)
  await wait(500);
  const dest = path.join(ROOT, 'demo-video.webm');
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    fs.copyFileSync(path.join(OUTPUT_DIR, files[0]), dest);
    const mb = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    console.log(`\n  ✅ demo-video.webm (${mb} MB)`);
    console.log('  Next: upload to YouTube (Unlisted), add link to submission.\n');
    // Force exit — browser.close() hangs in headless mode
    process.exit(0);
  } else {
    console.error('\n  ✗ No video generated\n');
    process.exit(1);
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
