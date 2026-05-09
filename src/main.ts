import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './style.css';
import { setupUpload } from './upload';
import { createCanvasRenderer, type CanvasRenderer } from './canvas';
import { setupRectTool, type Rect, type RectTool } from './rect-tool';
import { createHistory, type History } from './history';

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
  </div>
  <div id="upload"></div>
</main>
<footer>
  <a href="https://github.com/ceballosiker/id-sanitizer">Source</a>
  <span aria-hidden="true">·</span>
  <a href="https://github.com/ceballosiker/id-sanitizer/blob/main/LICENSE">License</a>
</footer>
`;

const uploadEl = document.querySelector<HTMLDivElement>('#upload')!;
const toolbar = document.querySelector<HTMLDivElement>('#toolbar')!;
const undoBtn = toolbar.querySelector<HTMLButtonElement>('[data-action=undo]')!;
const redoBtn = toolbar.querySelector<HTMLButtonElement>('[data-action=redo]')!;

let renderer: CanvasRenderer | null = null;
let rectTool: RectTool | null = null;
let history: History<readonly Rect[]> | null = null;

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
  renderer = createCanvasRenderer(uploadEl);
  void renderer
    .load(file)
    .then(() => {
      const canvas = renderer?.getCanvas();
      if (!canvas) return;

      // Fresh history per upload — satisfies "loading a new image clears the stack".
      history = createHistory<readonly Rect[]>(100);
      history.push([]); // initial floor

      rectTool = setupRectTool(
        canvas,
        (overlays) => renderer?.setOverlays(overlays),
        (rects) => {
          history?.push(rects);
          updateToolbar();
        },
      );

      toolbar.hidden = false;
      updateToolbar();
    })
    .catch((err: unknown) => {
      console.error('Canvas load failed:', err);
    });
});
