// Descarga un texto como archivo. En Android abre la descarga y en iOS la vista
// previa con la opción de compartir o guardar.
export function downloadTextFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Safari necesita la URL viva un momento después del clic.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
