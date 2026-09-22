export interface PreparedDownload {
  url: string;
  fileName: string;
}

export function prepareDownload(blob: Blob, fileName: string): PreparedDownload {
  return { url: URL.createObjectURL(blob), fileName };
}

export function startDownload(file: PreparedDownload) {
  const link = document.createElement('a');
  link.href = file.url;
  link.download = file.fileName;
  link.hidden = true;
  // Los nodos fuera de un diálogo modal son inertes. Mantener la descarga dentro de él.
  const parent = document.querySelector('dialog[open]') ?? document.body;
  parent.append(link);
  try { link.click(); } finally { link.remove(); }
}

export function releaseDownload(file: PreparedDownload) {
  // Algunos navegadores móviles consumen el Blob después de finalizar el clic.
  window.setTimeout(() => URL.revokeObjectURL(file.url), 60_000);
}
