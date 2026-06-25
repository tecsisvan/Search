// ─────────────────────────────────────────────────────────────────
//  SISVAN 2026 — content-bridge.js
//  Se inyecta en la página web (GitHub Pages / localhost).
//  Traduce:
//    window.postMessage (página) → chrome.runtime.sendMessage (background)
//    chrome.runtime.onMessage   → window.postMessage (página)
// ─────────────────────────────────────────────────────────────────

// Página → Extensión
window.addEventListener('message', event => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'SISVAN_WEB') return;

  // Reenviar al background
  chrome.runtime.sendMessage(event.data);
});

// Extensión → Página
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.source === 'SISVAN_EXT') {
    window.postMessage(msg, '*');
  }
});

// Anunciar que el bridge está activo
window.postMessage({ source: 'SISVAN_EXT', type: 'READY' }, '*');
