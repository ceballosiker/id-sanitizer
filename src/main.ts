import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './style.css';
import { setupUpload } from './upload';
import { createCanvasRenderer, type CanvasRenderer } from './canvas';
import { setupRectTool } from './rect-tool';

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
  <div id="upload"></div>
</main>
<footer>
  <a href="https://github.com/ceballosiker/id-sanitizer">Source</a>
  <span aria-hidden="true">·</span>
  <a href="https://github.com/ceballosiker/id-sanitizer/blob/main/LICENSE">License</a>
</footer>
`;

const uploadEl = document.querySelector<HTMLDivElement>('#upload')!;

// Hoisted so future tools (#12 undo/redo, #13 download) can reach the renderer.
let renderer: CanvasRenderer | null = null;

setupUpload(uploadEl, (file) => {
  renderer = createCanvasRenderer(uploadEl);
  void renderer
    .load(file)
    .then(() => {
      const canvas = renderer?.getCanvas();
      if (!canvas) return;
      setupRectTool(canvas, (overlays) => {
        renderer?.setOverlays(overlays);
      });
    })
    .catch((err: unknown) => {
      console.error('Canvas load failed:', err);
    });
});
