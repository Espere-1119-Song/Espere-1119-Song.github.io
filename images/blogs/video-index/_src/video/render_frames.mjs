// Render scenes.html frame by frame in headless Chrome: node render_frames.mjs <page url> <out dir> [fps] [t0 t1 ...]
// With times after the fps it saves only those frames (for checking); otherwise every frame from 0 to DURATION.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const [url, outDir, fpsArg, ...times] = process.argv.slice(2);
const FPS = +(fpsArg || 60);
mkdirSync(outDir, { recursive: true });
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9800 + Math.floor(Math.random() * 150);
const prof = outDir + '/.chrome-' + port;
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb',
  `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) { throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); }
  return r.result.value;
}
try {
  let wsUrl = null;
  for (let k = 0; k < 60 && !wsUrl; k++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find(t => t.type === 'page'); if (p) { wsUrl = p.webSocketDebuggerUrl; } } catch (e) { /* not up */ }
    if (!wsUrl) { await sleep(250); }
  }
  ws = new WebSocket(wsUrl);
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  for (let k = 0; k < 120; k++) { if (await evaluate('window.READY === true').catch(() => false)) { break; } await sleep(250); }
  if (!(await evaluate('window.READY === true'))) { throw new Error('page not ready (fonts or image)'); }
  const dur = await evaluate('window.DURATION');
  const list = times.length ? times.map(Number) : Array.from({ length: Math.round(dur * FPS) + 1 }, (_, i) => i / FPS);
  let n = 0;
  for (const t of list) {
    await evaluate(`window.render(${t}); true`);
    await evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
    const name = times.length ? `t_${t.toFixed(2)}.jpg` : `f_${String(n).padStart(5, '0')}.jpg`;
    writeFileSync(`${outDir}/${name}`, Buffer.from(shot.data, 'base64'));
    n++;
    if (!times.length && n % 120 === 0) { console.log('frame', n, '/', list.length); }
  }
  console.log('rendered', n, 'frames; duration', dur);
} catch (e) {
  console.error(e.message); process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch (e) { /* ignore */ }
  chrome.kill('SIGKILL');
}
