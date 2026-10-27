// Phone testing over HTTPS in one command: a Cloudflare quick tunnel to Vite,
// then the API and Vite started knowing the tunnel's URL. The URL changes on
// every run, so it is passed as PUBLIC_BASE_URL (real environment variables win
// over .env) and QR codes point at it with no .env editing.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import QRCode from 'qrcode';

const WEB_PORT = 5173;
const API_PORT = Number(process.env.API_PORT ?? 3001);
// The quick tunnel's own address; not api.trycloudflare.com, which appears in its error messages.
const URL_PATTERN = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/;
const START_TIMEOUT_MS = 60_000;
const BANNER_DELAY_MS = 5_000;

const children = [];

function stopAll(code = 0) {
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    // npm and concurrently start children of their own: stop the whole tree.
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  process.exit(code);
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

/** Whether nothing is listening on `port` yet. */
const isFree = (port) =>
  new Promise((resolve) => {
    const probe = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(port);
  });

// This runs the same API and site as dev:all, so it can't run alongside it.
const busy = [];
for (const port of [API_PORT, WEB_PORT]) if (!(await isFree(port))) busy.push(port);
if (busy.length) {
  console.error(
    `Port ${busy.join(' and ')} ${busy.length > 1 ? 'are' : 'is'} already in use, most likely by npm run dev:all.\n` +
      'dev:tunnel starts the API and site itself: stop dev:all (Ctrl+C in its terminal) and run this again.',
  );
  process.exit(1);
}

console.log('Starting a Cloudflare tunnel…');
const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${WEB_PORT}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
children.push(tunnel);
tunnel.on('error', (err) => {
  console.error(
    err.code === 'ENOENT'
      ? 'cloudflared was not found. Install it and make sure it is on PATH:\n  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'
      : `cloudflared failed to start: ${err.message}`,
  );
  stopAll(1);
});
tunnel.on('exit', (code) => {
  console.error(`cloudflared stopped (exit code ${code}). Run TUNNEL_VERBOSE=1 npm run dev:tunnel to see its log.`);
  stopAll(code || 1);
});

// cloudflared prints the URL first, but it only answers once a connection has registered.
const publicUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('cloudflared did not open a tunnel within 60 s. Check your internet connection.')), START_TIMEOUT_MS);
  let found = null;
  const onOutput = (chunk) => {
    const text = chunk.toString();
    if (process.env.TUNNEL_VERBOSE) process.stderr.write(text);
    found ??= text.match(URL_PATTERN)?.[0] ?? null;
    if (found && /Registered tunnel connection/i.test(text)) {
      clearTimeout(timer);
      resolve(found);
    }
  };
  tunnel.stdout.on('data', onOutput);
  tunnel.stderr.on('data', onOutput);
}).catch((err) => {
  console.error(err.message);
  stopAll(1);
});

// Vite must be on exactly the port the tunnel forwards to, or the phone gets an error page.
const app = spawn(
  `npx concurrently -k -n api,web -c blue,green "npm run server" "npm run dev -- --port ${WEB_PORT} --strictPort"`,
  { shell: true, stdio: 'inherit', env: { ...process.env, PUBLIC_BASE_URL: publicUrl } },
);
children.push(app);
app.on('exit', (code) => stopAll(code ?? 0));

// After the API and Vite have printed their start-up lines, so it isn't scrolled away.
const qr = await QRCode.toString(publicUrl, { type: 'terminal', small: true });
setTimeout(() => {
  console.log(
    [
      '',
      '  ┌──────────────────────────────────────────────────────────────',
      `  │ Open on your phone (HTTPS, in-page AR):  ${publicUrl}`,
      '  │ Product QR codes in the app point to this address too.',
      '  │ It changes every run. Press Ctrl+C to stop everything.',
      '  └──────────────────────────────────────────────────────────────',
      '',
      qr,
    ].join('\n'),
  );
}, BANNER_DELAY_MS);
