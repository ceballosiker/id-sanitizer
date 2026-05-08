const ACCEPTED_TYPES = new Set<string>(['image/jpeg', 'image/png', 'image/webp']);

export function pickFirstValidImage(files: ArrayLike<File>): File | null {
  for (let i = 0; i < files.length; i++) {
    if (ACCEPTED_TYPES.has(files[i].type)) return files[i];
  }
  return null;
}

const DROPZONE_HTML = `
<div class="dropzone">
  <p>Drop an image here, or</p>
  <button type="button" class="upload-button">Choose file</button>
  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    hidden
  />
  <p class="upload-error" role="alert" hidden></p>
</div>
`;

export function setupUpload(
  container: HTMLElement,
  onImageLoaded: (file: File, objectUrl: string) => void,
): void {
  container.innerHTML = DROPZONE_HTML;

  const dropzone = container.querySelector<HTMLDivElement>('.dropzone')!;
  const button = container.querySelector<HTMLButtonElement>('.upload-button')!;
  const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
  const errorEl = container.querySelector<HTMLParagraphElement>('.upload-error')!;

  const showError = (msg: string) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };
  const clearError = () => {
    errorEl.textContent = '';
    errorEl.hidden = true;
  };

  const handleFiles = (files: ArrayLike<File> | null) => {
    clearError();
    if (!files || files.length === 0) return;
    const file = pickFirstValidImage(files);
    if (!file) {
      showError('Unsupported file type. Use JPG, PNG, or WebP.');
      return;
    }
    onImageLoaded(file, URL.createObjectURL(file));
  };

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    handleFiles(e.dataTransfer?.files ?? null);
  });

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    handleFiles(input.files);
    input.value = '';
  });
}
