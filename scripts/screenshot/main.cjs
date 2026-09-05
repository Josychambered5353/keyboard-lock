/**
 * Electron entry point used only by `npm run screenshots`.
 *
 * It loads the built renderer, seeds it through a stub preload and captures
 * each screen with `capturePage()`, so the images in the README are the real
 * UI rather than mock-ups that drift away from the stylesheet.
 *
 * CommonJS on purpose: Electron only exposes its named exports to `require`,
 * and this harness is the one place that talks to Electron directly.
 */
const { BrowserWindow, app } = require('electron');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { SCENARIOS } = require('./scenarios.cjs');

const root = join(__dirname, '../..');
const outputDir = join(root, 'docs/screenshots');

// Window sizes below are CSS pixels; the capture comes out at the display's
// scale factor, so run this on a HiDPI screen to refresh the 2x README images.
app.commandLine.appendSwitch('force-color-profile', 'srgb');

// Without this, destroying the last window ends the run after a single capture.
app.on('window-all-closed', () => undefined);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture(scenario) {
  const payload = Buffer.from(
    JSON.stringify({
      settings: scenario.settings,
      environment: scenario.environment,
      status: scenario.status,
    }),
  ).toString('base64');

  const window = new BrowserWindow({
    width: scenario.width,
    height: scenario.height,
    show: false,
    frame: false,
    enableLargerThanScreen: true,
    backgroundColor: scenario.page === 'lock' ? '#05050a' : '#0b0c10',
    webPreferences: {
      preload: join(root, 'scripts/screenshot/preload.cjs'),
      // An in-memory partition: Chromium remembers a zoom level per origin, and
      // every capture must start from an untouched 100%.
      partition: 'keyboard-lock-screenshots',
      zoomFactor: 1,
      sandbox: false,
      contextIsolation: true,
      backgroundThrottling: false,
      additionalArguments: [`--kl-scenario=${payload}`],
    },
  });

  const options = scenario.page === 'lock' ? { query: { primary: '1' } } : undefined;
  await window.loadFile(join(root, `out/renderer/${scenario.page}.html`), options);

  // capturePage() needs a composited surface, which a never-shown window does
  // not reliably get; showing it inactive keeps the run unattended but correct.
  window.showInactive();
  window.webContents.setZoomFactor(1);
  await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  // The overlay fades and rises on entry; give it room to land before capturing.
  await wait(900);

  if (scenario.script) {
    await window.webContents.executeJavaScript(`(async () => { ${scenario.script} })()`);
    await wait(250);
  }

  const image = await window.webContents.capturePage();
  const size = image.getSize();
  writeFileSync(join(outputDir, `${scenario.name}.png`), image.toPNG());
  window.destroy();

  console.log(`captured ${scenario.name}.png (${size.width}x${size.height})`);
  // Chromium needs a beat to tear the previous view down before the next load.
  await wait(250);
}

async function run() {
  await app.whenReady();
  mkdirSync(outputDir, { recursive: true });
  for (const scenario of SCENARIOS) {
    await capture(scenario);
  }
  app.quit();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
