import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './style.css';
import { setupUpload } from './upload';
import { createCanvasRenderer, type CanvasRenderer } from './canvas';
import { setupRectTool, type Rect, type RectTool } from './rect-tool';
import { createHistory, type History } from './history';
import { buildFilename, downloadBlob, formatToMime, type Format } from './download';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header>
  <span class="form-id">FORM 0.1</span>
  <h1>ID Sanitizer</h1>
  <span class="offline-badge">✓ Works offline — disconnect to verify</span>
</header>
<main>
  <h2>Sanitize ID images locally.</h2>
  <p>
    Drop a photo of an ID, redact what you don't want shared, save it back.
    Nothing leaves your device — the app makes no network requests at runtime.
  </p>
  <div id="toolbar" class="toolbar" hidden>
    <button
      type="button"
      data-action="undo"
      aria-keyshortcuts="Control+Z Meta+Z"
      title="Undo (Ctrl/Cmd-Z)"
      disabled
    >
      Undo
    </button>
    <button
      type="button"
      data-action="redo"
      aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
      title="Redo (Ctrl/Cmd-Shift-Z, Ctrl-Y)"
      disabled
    >
      Redo
    </button>
    <button
      type="button"
      data-action="grayscale"
      aria-pressed="false"
      title="Toggle grayscale"
      disabled
    >
      Grayscale
    </button>
    <div class="toolbar-export">
      <fieldset class="format-toggle">
        <legend class="visually-hidden">Format</legend>
        <label>
          <input type="radio" name="format" value="png" checked />
          <span>PNG</span>
        </label>
        <label>
          <input type="radio" name="format" value="jpeg" />
          <span>JPEG</span>
        </label>
      </fieldset>
      <button type="button" data-action="download">Download</button>
    </div>
    <div class="toolbar-watermark">
      <label for="watermark-text">Watermark</label>
      <input
        type="text"
        id="watermark-text"
        data-action="watermark-text"
        placeholder="For [purpose] · YYYY-MM-DD"
        maxlength="80"
        disabled
      />
      <label for="watermark-opacity">Opacity</label>
      <input
        type="range"
        id="watermark-opacity"
        data-action="watermark-opacity"
        min="0"
        max="100"
        step="1"
        value="30"
        disabled
      />
      <output for="watermark-opacity" data-action="watermark-opacity-value">30%</output>
    </div>
  </div>
  <div id="upload"></div>
</main>
<footer>
  <a href="https://github.com/ceballosiker/id-sanitizer">Source</a>
  <span aria-hidden="true">·</span>
  <a href="https://github.com/ceballosiker/id-sanitizer/blob/main/LICENSE">License</a>
  <span aria-hidden="true">·</span>
  <button type="button" data-action="about">About</button>
</footer>
<dialog id="about-dialog" class="about-dialog" aria-labelledby="about-title">
  <button type="button" class="about-close" aria-label="Close">×</button>
  <h2 id="about-title">ID Sanitizer</h2>
  <p class="about-version">v<span data-version></span></p>
  <p>
    Redact personal info from photos of IDs — locally, in your browser,
    with no upload. Nothing leaves your device.
  </p>
  <p>
    <a href="https://github.com/ceballosiker/id-sanitizer">Source on GitHub</a>
  </p>
  <p class="about-license">
    Licensed under the
    <a href="https://github.com/ceballosiker/id-sanitizer/blob/main/LICENSE">MIT License</a>.
    © 2026 Iker.
  </p>
</dialog>
`;

const uploadEl = document.querySelector<HTMLDivElement>('#upload')!;
const toolbar = document.querySelector<HTMLDivElement>('#toolbar')!;
const undoBtn = toolbar.querySelector<HTMLButtonElement>('[data-action=undo]')!;
const redoBtn = toolbar.querySelector<HTMLButtonElement>('[data-action=redo]')!;
const grayscaleBtn = toolbar.querySelector<HTMLButtonElement>('[data-action=grayscale]')!;
const watermarkText = toolbar.querySelector<HTMLInputElement>('[data-action=watermark-text]')!;
const watermarkOpacity = toolbar.querySelector<HTMLInputElement>(
  '[data-action=watermark-opacity]',
)!;
const watermarkOpacityValue = toolbar.querySelector<HTMLOutputElement>(
  '[data-action=watermark-opacity-value]',
)!;
const downloadBtn = toolbar.querySelector<HTMLButtonElement>('[data-action=download]')!;
const formatInputs = toolbar.querySelectorAll<HTMLInputElement>('input[name=format]');
const aboutBtn = document.querySelector<HTMLButtonElement>('[data-action=about]')!;
const aboutDialog = document.querySelector<HTMLDialogElement>('#about-dialog')!;
const aboutClose = aboutDialog.querySelector<HTMLButtonElement>('.about-close')!;
const versionEl = aboutDialog.querySelector<HTMLSpanElement>('[data-version]')!;

let renderer: CanvasRenderer | null = null;
let rectTool: RectTool | null = null;
let history: History<readonly Rect[]> | null = null;
let originalName: string | undefined;
let currentFormat: Format = 'png';

const updateToolbar = (): void => {
  undoBtn.disabled = !history?.canUndo();
  redoBtn.disabled = !history?.canRedo();
};

const undo = (): void => {
  if (!rectTool || !history || rectTool.isDragging()) return;
  const prev = history.undo();
  if (prev !== undefined) {
    rectTool.setRects(prev);
    updateToolbar();
  }
};

const redo = (): void => {
  if (!rectTool || !history || rectTool.isDragging()) return;
  const next = history.redo();
  if (next !== undefined) {
    rectTool.setRects(next);
    updateToolbar();
  }
};

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
grayscaleBtn.addEventListener('click', () => {
  if (!renderer) return;
  const next = grayscaleBtn.getAttribute('aria-pressed') !== 'true';
  grayscaleBtn.setAttribute('aria-pressed', String(next));
  renderer.setGrayscale(next);
});

const updateWatermark = (): void => {
  if (!renderer) return;
  const pct = Number(watermarkOpacity.value);
  watermarkOpacityValue.textContent = `${pct}%`;
  renderer.setWatermark(watermarkText.value, pct / 100);
};
watermarkText.addEventListener('input', updateWatermark);
watermarkOpacity.addEventListener('input', updateWatermark);

versionEl.textContent = __APP_VERSION__;

aboutBtn.addEventListener('click', () => aboutDialog.showModal());
aboutClose.addEventListener('click', () => aboutDialog.close());

// Light-dismiss: click on the backdrop (which surfaces as a click on the
// dialog itself when the click is outside the dialog's content box) closes it.
aboutDialog.addEventListener('click', (e) => {
  if (e.target === aboutDialog) aboutDialog.close();
});

formatInputs.forEach((input) => {
  input.addEventListener('change', () => {
    if (input.checked) currentFormat = input.value as Format;
  });
});

downloadBtn.addEventListener('click', () => {
  if (!renderer) return;
  const { mime, quality } = formatToMime(currentFormat);
  void renderer
    .getBlob(mime, quality)
    .then((blob) => {
      downloadBlob(blob, buildFilename(originalName, currentFormat));
    })
    .catch((err: unknown) => {
      console.error('Download failed:', err);
    });
});

window.addEventListener('keydown', (e) => {
  if (!e.metaKey && !e.ctrlKey) return;
  if (e.code === 'KeyZ' && !e.shiftKey) {
    e.preventDefault();
    undo();
  } else if ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY') {
    e.preventDefault();
    redo();
  }
});

setupUpload(uploadEl, (file) => {
  originalName = file.name;
  renderer = createCanvasRenderer(uploadEl);
  void renderer
    .load(file)
    .then(() => {
      const canvas = renderer?.getCanvas();
      if (!canvas) return;

      history = createHistory<readonly Rect[]>(100);
      history.push([]);

      rectTool = setupRectTool(
        canvas,
        (overlays) => renderer?.setOverlays(overlays),
        (rects) => {
          history?.push(rects);
          updateToolbar();
        },
      );

      toolbar.hidden = false;
      grayscaleBtn.disabled = false;
      watermarkText.disabled = false;
      watermarkOpacity.disabled = false;
      updateToolbar();
    })
    .catch((err: unknown) => {
      console.error('Canvas load failed:', err);
    });
});
