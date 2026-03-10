/**
 * AgentTreasury CORE — TTS Voiceover Generator
 * 
 * Generates narrated audio using Windows SAPI TTS (David voice).
 * Then merges audio + video into demo-final.mp4 using ffmpeg.
 * 
 * Usage: node scripts/add-voiceover.mjs
 * Input:  demo-video.webm (from record-demo.mjs)
 * Output: demo-final.mp4
 */

import say from 'say';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const VOICE = 'Microsoft David Desktop'; // Clear male voice
const SPEED = 1.05; // Slightly faster for professional feel

// ── Narration segments (matched to record-demo.mjs slide timing) ──
const SEGMENTS = [
  // Title slide (5s)
  `AgentTreasury CORE. Autonomous CFO for DAOs. Two AI agents manage a DAO treasury. One optimizes yield, the other scores borrowers and lends USDt. All on-chain, all autonomous. Lending Bot Track. Eleven out of eleven requirements.`,
  // Step 1 — System Health (6s)
  `Step one. System Health. Both AI agents are live on Sepolia testnet. Treasury Agent active. Credit Agent active. All contracts deployed.`,
  // Step 2 — Treasury State (6s)
  `Step two. Treasury State. The vault holds 50,000 USDt. Active yield positions in Aave V3 at 4.2% and Compound V3 at 3.8% APY.`,
  // Step 3 — Dashboard (6s)
  `Step three. Live Dashboard. One API call returns the complete system state. Balance, active loans, credit profiles, and agent decisions with LLM reasoning. Real-time via WebSocket.`,
  // Step 4 — Credit Scoring (6s)
  `Step four. AI Credit Scoring. The Credit Agent uses Groq LLM to analyze seven on-chain factors. This borrower scores 750. Good tier. Ten percent APR. Fully autonomous.`,
  // Step 5 — ML Prediction (6s)
  `Step five. ML Default Prediction. A logistic regression model predicts default probability. This borrower: 1.4 percent risk. Low. Above 60 percent, the loan is auto-blocked.`,
  // Step 6 — ZK Proofs (6s)
  `Step six. Zero-Knowledge Credit Proofs. Borrowers prove their tier without revealing the exact score. SHA-256 commitment. Fiat-Shamir heuristic. Privacy-preserving credit.`,
  // Step 7 — Lending (6s)
  `Step seven. Autonomous Lending. Borrower requests 1,000 USDt. Credit Agent evaluates, assigns tier, sets interest rate, and disburses. On-chain. Thirty-day terms.`,
  // Step 8 — Inter-Agent (6s)
  `Step eight. Inter-Agent Lending. Credit Agent borrows from Treasury Agent via EventBus. Treasury caps at twenty percent of vault and allocates. Two agents, one financial system.`,
  // Step 9 — Yield Repayment (6s)
  `Step nine. Yield to Auto Debt Repayment. Treasury harvests yield from DeFi, then auto-repays inter-agent loans. Agents use earned revenue to service debt.`,
  // Step 10 — Yield Optimization (6s)
  `Step ten. Yield Optimization. Treasury Agent scans protocols, evaluates APY versus risk, invests idle capital. Continuously rebalances.`,
  // End slide (6s)
  `Demo complete. Eleven out of eleven Lending Bot requirements. Three must-haves. Four nice-to-haves. Four bonuses. All live on Sepolia. All open-source. Autonomous finance, done right.`,
];

function exportSpeech(text, filePath) {
  return new Promise((resolve, reject) => {
    say.export(text, VOICE, SPEED, filePath, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

async function main() {
  console.log('\n  AgentTreasury CORE — TTS Voiceover Generator\n');

  const videoPath = path.join(ROOT, 'demo-video.webm');
  if (!fs.existsSync(videoPath)) {
    console.error('  ✗ demo-video.webm not found. Run `npm run demo:video` first.\n');
    process.exit(1);
  }

  // Get ffmpeg
  let ffmpegPath;
  try {
    const installer = await import('@ffmpeg-installer/ffmpeg');
    ffmpegPath = installer.default?.path || installer.path;
  } catch { ffmpegPath = 'ffmpeg'; }
  console.log(`  [1/4] ffmpeg: ${path.basename(ffmpegPath)}`);

  // Temp dir
  const tmpDir = path.join(ROOT, 'tts-tmp');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  // Generate WAV for each segment
  console.log(`  [2/4] Generating ${SEGMENTS.length} TTS segments (${VOICE})...`);
  for (let i = 0; i < SEGMENTS.length; i++) {
    const wavFile = path.join(tmpDir, `seg-${String(i).padStart(2,'0')}.wav`);
    await exportSpeech(SEGMENTS[i], wavFile);
    const kb = (fs.statSync(wavFile).size / 1024).toFixed(0);
    const label = i === 0 ? 'Title' : i <= 10 ? `Step ${i}` : 'End';
    console.log(`         ${label}: ${kb} KB`);
  }

  // Generate silence (500ms between segments)
  const silencePath = path.join(tmpDir, 'silence.wav');
  execFileSync(ffmpegPath, [
    '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono',
    '-t', '0.5', '-c:a', 'pcm_s16le', silencePath
  ], { stdio: 'pipe' });

  // Create ffmpeg concat list (use full paths, no quotes - Windows compat)
  const concatFile = path.join(tmpDir, 'concat.txt');
  const lines = [];
  for (let i = 0; i < SEGMENTS.length; i++) {
    const segPath = path.join(tmpDir, `seg-${String(i).padStart(2,'0')}.wav`).replace(/\\/g, '/');
    const silPath = silencePath.replace(/\\/g, '/');
    lines.push(`file '${segPath}'`);
    lines.push(`file '${silPath}'`);
  }
  fs.writeFileSync(concatFile, lines.join('\n'));

  // Concatenate all audio
  console.log('  [3/4] Concatenating audio...');
  const fullAudio = path.join(tmpDir, 'narration.wav');
  execFileSync(ffmpegPath, [
    '-f', 'concat', '-safe', '0', '-i', concatFile,
    '-c:a', 'pcm_s16le', fullAudio
  ], { stdio: 'pipe' });
  const audioMB = (fs.statSync(fullAudio).size / 1024 / 1024).toFixed(1);
  console.log(`         Narration: ${audioMB} MB`);

  // Merge video + audio → MP4
  const finalPath = path.join(ROOT, 'demo-final.mp4');
  console.log('  [4/4] Merging video + audio → demo-final.mp4...');
  execFileSync(ffmpegPath, [
    '-i', videoPath,
    '-i', fullAudio,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    '-y', finalPath
  ], { stdio: 'pipe' });

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const finalMB = (fs.statSync(finalPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n  ✅ demo-final.mp4 (${finalMB} MB) — video with TTS voiceover`);
  console.log('  Upload to YouTube (Unlisted) and add link to submission.\n');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
