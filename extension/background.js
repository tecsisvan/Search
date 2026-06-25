// ─────────────────────────────────────────────────────────────────
//  SISVAN 2026 — background.js v2
//  Navega la pestaña del portal ANTES de enviar al content script
// ─────────────────────────────────────────────────────────────────

const PORTAL = 'https://appb.saludcapital.gov.co';
const URLS = {
  menores: PORTAL + '/pai/vacunacion/datosBasicos.aspx?pag=2',
  mayores: PORTAL + '/pai/vacunacion/datosBasicos.aspx?pag=3',
  adres:   PORTAL + '/comprobadordederechos/Consulta.aspx'
};

// ── Escuchar mensajes desde content-bridge (página web) ──────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'PORTAL_READY') {
    // Notificar a la página web que la extensión está lista
    notificarPaginaWeb('READY', {});
    return;
  }

  if (msg.type === 'SCRAPING_RESULT') {
    notificarPaginaWeb('RESULT', { codigo: msg.codigo, fila: msg.fila });
    return;
  }

  if (msg.type === 'PING') {
    notificarPaginaWeb('READY', {});
    return;
  }

  if (msg.type === 'SISVAN_CONSULTA') {
    manejarConsulta(msg);
    return;
  }
});

// ── Lógica principal ─────────────────────────────────────────────
async function manejarConsulta(msg) {
  const { modulo } = msg;
  const urlDestino = URLS[modulo];

  // 1. Buscar pestaña del portal ya abierta
  const tabs = await chrome.tabs.query({ url: PORTAL + '/*' });

  if (tabs.length === 0) {
    // No hay pestaña del portal — abrir una nueva y esperar
    const tab = await chrome.tabs.create({ url: urlDestino, active: false });
    await esperarCarga(tab.id);
    await sleep(2000); // dar tiempo al content script de inyectarse
    await chrome.tabs.sendMessage(tab.id, msg);
    return;
  }

  const tab = tabs[0];

  // 2. Verificar si ya está en la URL correcta
  const urlActual = tab.url || '';
  const yaEnUrl   = urlActual.includes(urlDestino.split('?')[0]) &&
                    (modulo === 'adres' || urlActual.includes('pag=' + (modulo === 'menores' ? '2' : '3')));

  if (yaEnUrl) {
    // Ya está en la página correcta — enviar directo
    try {
      await chrome.tabs.sendMessage(tab.id, msg);
    } catch (e) {
      // Content script no responde — reinyectar y reintentar
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await sleep(500);
      await chrome.tabs.sendMessage(tab.id, msg);
    }
    return;
  }

  // 3. Navegar a la URL correcta y esperar carga completa
  await chrome.tabs.update(tab.id, { url: urlDestino });
  await esperarCarga(tab.id);
  await sleep(2000); // dar tiempo al content script de inyectarse

  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) {
    // Reinyectar si hace falta
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await sleep(500);
    await chrome.tabs.sendMessage(tab.id, msg);
  }
}

// ── Esperar a que una pestaña termine de cargar ──────────────────
function esperarCarga(tabId) {
  return new Promise(resolve => {
    // Primero verificar si ya está completa
    chrome.tabs.get(tabId, tab => {
      if (tab.status === 'complete') { resolve(); return; }
      // Si no, escuchar el evento
      function listener(id, info) {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
      // Timeout de seguridad: 15 segundos máximo
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 15000);
    });
  });
}

// ── Notificar a la página web (GitHub Pages) ─────────────────────
function notificarPaginaWeb(type, payload) {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (tab.url && (
        tab.url.includes('github.io') ||
        tab.url.includes('localhost') ||
        tab.url.includes('127.0.0.1')
      )) {
        chrome.tabs.sendMessage(tab.id, { source: 'SISVAN_EXT', type, ...payload })
          .catch(() => {});
      }
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
