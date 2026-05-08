import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './style.css';
import { setupUpload } from './upload';

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

setupUpload(uploadEl, (_file, url) => {
  uploadEl.innerHTML = `<img class="upload-preview" alt="Uploaded image preview" src="${url}" />`;
});
