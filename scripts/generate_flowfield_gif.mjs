import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

const DEFAULT_URL = 'http://127.0.0.1:8000/source/unsteady_airfoil_simulator.html';
const DEFAULT_OUTPUT = path.resolve('unsaero_flowfield_canvas.gif');
const DEFAULT_FRAME_SKIP = 4;
const DEFAULT_DURATION_MS = 40;

const outputPath = path.resolve(process.argv[2] || DEFAULT_OUTPUT);
const pageUrl = process.argv[3] || DEFAULT_URL;
const frameSkip = Math.max(1, Number.parseInt(process.argv[4] || `${DEFAULT_FRAME_SKIP}`, 10));
const durationMs = Math.max(20, Number.parseInt(process.argv[5] || `${DEFAULT_DURATION_MS}`, 10));
const cleanPlot = (process.argv[6] || 'clean').toLowerCase() !== 'full';
const circulationScaleOverride = process.argv[7] === undefined ? null : Number.parseFloat(process.argv[7]);

const CLEAN_CANVAS_SCRIPT = `(() => {
  if (window.__unsaeroCleanFlowCanvas) return;
  window.__unsaeroCleanFlowCanvas = true;

  const state = new WeakMap();
  const original = {
    beginPath: CanvasRenderingContext2D.prototype.beginPath,
    moveTo: CanvasRenderingContext2D.prototype.moveTo,
    lineTo: CanvasRenderingContext2D.prototype.lineTo,
    stroke: CanvasRenderingContext2D.prototype.stroke,
    strokeRect: CanvasRenderingContext2D.prototype.strokeRect,
    fillText: CanvasRenderingContext2D.prototype.fillText
  };
  const near = (a, b, tolerance = 1.5) => Math.abs(Number(a) - Number(b)) <= tolerance;
  const isFlowContext = (ctx) => ctx?.canvas?.id === 'flowCanvas';
  const pathState = (ctx) => {
    let value = state.get(ctx);
    if (!value) {
      value = { commands: [] };
      state.set(ctx, value);
    }
    return value;
  };

  function shouldSuppressStroke(ctx) {
    if (!isFlowContext(ctx)) return false;
    const commands = pathState(ctx).commands;
    if (commands.length !== 2 || commands[0].type !== 'M' || commands[1].type !== 'L') return false;
    const [a, b] = commands;
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dy <= 1.5 && dx >= 700) return true;
    if (dx <= 1.5 && dy >= 180) return true;
    if (dy <= 1.5 && dx <= 14 && Math.min(a.x, b.x) >= 700) return true;
    return false;
  }

  CanvasRenderingContext2D.prototype.beginPath = function(...args) {
    if (isFlowContext(this)) pathState(this).commands = [];
    return original.beginPath.apply(this, args);
  };
  CanvasRenderingContext2D.prototype.moveTo = function(x, y, ...args) {
    if (isFlowContext(this)) pathState(this).commands.push({ type:'M', x:Number(x), y:Number(y) });
    return original.moveTo.call(this, x, y, ...args);
  };
  CanvasRenderingContext2D.prototype.lineTo = function(x, y, ...args) {
    if (isFlowContext(this)) pathState(this).commands.push({ type:'L', x:Number(x), y:Number(y) });
    return original.lineTo.call(this, x, y, ...args);
  };
  CanvasRenderingContext2D.prototype.stroke = function(...args) {
    if (shouldSuppressStroke(this)) return;
    return original.stroke.apply(this, args);
  };
  CanvasRenderingContext2D.prototype.strokeRect = function(x, y, w, h, ...args) {
    if (isFlowContext(this) && near(x, 50) && near(y, 25) && near(w, 830) && near(h, 240)) return;
    return original.strokeRect.call(this, x, y, w, h, ...args);
  };
  CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...args) {
    if (isFlowContext(this)) {
      const value = String(text ?? '').trim();
      if (/^frame\\s+\\d+\\/\\d+$/i.test(value)) return;
      if (value === 'x/c' || value === 'z/c') return;
      if (Number(x) > 700 && /^[-−]?\\d/.test(value)) return;
    }
    return original.fillText.call(this, text, x, y, ...args);
  };
})();`;

function addRuntimeNodeModules(){
  const additions = [
    process.env.UNSAERO_NODE_MODULES,
    path.resolve('node_modules'),
    path.resolve('..', 'node_modules')
  ].filter((entry)=>entry && fs.existsSync(entry));
  if (!additions.length) return;
  process.env.NODE_PATH = [process.env.NODE_PATH, ...additions].filter(Boolean).join(path.delimiter);
  require('node:module').Module._initPaths();
}

function loadPlaywright(){
  try {
    return require('playwright');
  } catch {
    addRuntimeNodeModules();
    return require('playwright');
  }
}

function findBrowserExecutable(){
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ].filter(Boolean);
  return candidates.find((candidate)=>fs.existsSync(candidate.replace(/\//g, path.sep)));
}

function findPythonExecutable(){
  const candidates = [
    process.env.PYTHON,
    process.env.PYTHON_PATH,
    'python3',
    'python'
  ].filter(Boolean);
  return candidates.find((candidate)=>{
    if (candidate === 'python' || candidate === 'python3') return true;
    return fs.existsSync(candidate);
  });
}

async function captureFrames(){
  const { chromium } = loadPlaywright();
  const browserExecutable = findBrowserExecutable();
  const launchOptions = browserExecutable
    ? { headless:true, executablePath:browserExecutable }
    : { headless:true };
  const browser = await chromium.launch(launchOptions);
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unsaero-flowfield-'));

  try {
    const page = await browser.newPage({ viewport:{ width:1200, height:900 }, deviceScaleFactor:1 });
    page.on('console', (message)=>{
      if (message.type() === 'error') console.error(`browser console error: ${message.text()}`);
    });

    if (cleanPlot) await page.addInitScript(CLEAN_CANVAS_SCRIPT);
    await page.goto(pageUrl, { waitUntil:'networkidle' });
    await page.waitForFunction(
      () => document.getElementById('frameSlider') && Number(document.getElementById('frameSlider').max) > 10,
      null,
      { timeout:60000 }
    );
    if (Number.isFinite(circulationScaleOverride)){
      const circulationScale = Math.max(0, Math.min(1, circulationScaleOverride));
      await page.evaluate((value)=>{
        const input = document.getElementById('circulationScale');
        if (!input) return;
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
      }, circulationScale);
    }
    await page.evaluate(()=>{
      const button = document.getElementById('playPauseBtn');
      if (button && /pause|pausar/i.test(button.textContent || button.getAttribute('aria-label') || '')){
        button.click();
      }
    });

    const frameCount = await page.evaluate(()=>Number(document.getElementById('frameSlider').max) + 1);
    const frameIndices = [];
    for (let frame=0; frame<frameCount; frame += frameSkip) frameIndices.push(frame);
    if (frameIndices[frameIndices.length - 1] !== frameCount - 1) frameIndices.push(frameCount - 1);

    const paths = [];
    for (let index=0; index<frameIndices.length; index++){
      const frame = frameIndices[index];
      await page.evaluate((value)=>{
        const slider = document.getElementById('frameSlider');
        slider.value = String(value);
        slider.dispatchEvent(new Event('input', { bubbles:true }));
      }, frame);
      await page.waitForTimeout(20);
      const framePath = path.join(frameDir, `frame-${String(index).padStart(4, '0')}.png`);
      const dataUrl = await page.evaluate(()=>document.getElementById('flowCanvas').toDataURL('image/png'));
      fs.writeFileSync(framePath, Buffer.from(dataUrl.split(',')[1], 'base64'));
      paths.push(framePath);
      if (index % 25 === 0) console.log(`captured ${index + 1}/${frameIndices.length}`);
    }

    return { frameDir, paths, frameCount, capturedCount:paths.length };
  } finally {
    await browser.close();
  }
}

function encodeGifWithPillow(framePaths){
  const python = findPythonExecutable();
  if (!python) throw new Error('Could not find Python for Pillow GIF encoding.');
  fs.mkdirSync(path.dirname(outputPath), { recursive:true });

  const payload = JSON.stringify({ framePaths, outputPath, durationMs });
  const script = `
import json
import sys
from PIL import Image

data = json.loads(sys.stdin.read())
frames = []
for frame_path in data["framePaths"]:
    frames.append(Image.open(frame_path).convert("RGB"))

frames[0].save(
    data["outputPath"],
    save_all=True,
    append_images=frames[1:],
    duration=int(data["durationMs"]),
    loop=0,
    disposal=2,
    optimize=False,
)
for frame in frames:
    frame.close()
`;

  const result = spawnSync(python, ['-c', script], {
    input:payload,
    encoding:'utf8',
    stdio:['pipe', 'pipe', 'pipe']
  });
  if (result.status !== 0){
    throw new Error(result.stderr || result.stdout || `Python exited with status ${result.status}`);
  }
}

const capture = await captureFrames();
try {
  encodeGifWithPillow(capture.paths);
} finally {
  fs.rmSync(capture.frameDir, { recursive:true, force:true });
}

const stats = fs.statSync(outputPath);
console.log(`Wrote ${outputPath}`);
console.log(`${capture.capturedCount} captured frames from ${capture.frameCount} simulator frames`);
console.log(`${stats.size} bytes`);
