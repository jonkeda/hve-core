/** Escapes HTML special characters to prevent XSS in webview content. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escapes HTML attribute values including single quotes. */
export function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, '&#39;');
}
