// ─────────────────────────────────────────────────────────────────
//  SISVAN 2026 — content.js v5
//  Busca el link Select$0 con múltiples estrategias
// ─────────────────────────────────────────────────────────────────

const NE = 'NO ENCONTRADO';

chrome.runtime.sendMessage({ type: 'PORTAL_READY' });

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PING') { chrome.runtime.sendMessage({ type: 'PORTAL_READY' }); return; }
  if (msg.type === 'SISVAN_CONSULTA') {
    const { modulo, opcion, consecutivo, codigo } = msg;
    if (modulo === 'adres') scrapingADRES(consecutivo, codigo);
    else scrapingPAI(modulo, opcion, consecutivo, codigo);
  }
});

// ─────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForEl(id, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const el = document.getElementById(id);
      if (el) { clearInterval(iv); resolve(el); return; }
      if (Date.now() - start > timeout) {
        clearInterval(iv);
        reject(new Error('No encontrado: ' + id));
      }
    }, 400);
  });
}

// Esperar hasta que aparezca cualquier link que contenga Select$0
function waitForSelectLink(timeout = 10000) {
  return new Promise(resolve => {
    const start = Date.now();
    const iv = setInterval(() => {
      const link = encontrarSelectLink();
      if (link) { clearInterval(iv); resolve(link); return; }
      if (Date.now() - start > timeout) { clearInterval(iv); resolve(null); }
    }, 400);
  });
}

// Buscar el link "Seleccionar" con todas las estrategias posibles
function encontrarSelectLink() {
  // Estrategia 1: buscar por texto visible "Seleccionar"
  const porTexto = [...document.querySelectorAll('a')].find(a =>
    a.textContent.trim().toLowerCase().includes('seleccionar')
  );
  if (porTexto) return porTexto;

  // Estrategia 2: buscar por href que contenga Select$0
  const porHref = [...document.querySelectorAll('a')].find(a => {
    const h = a.getAttribute('href') || '';
    return h.includes('Select$0');
  });
  if (porHref) return porHref;

  // Estrategia 3: buscar en la tabla de resultados, primer link de la primera fila
  const tabla = document.getElementById('ContentPlaceHolder1_gdvResultadoBusqueda');
  if (tabla) {
    const primerLink = tabla.querySelector('tr:nth-child(2) a, tr:nth-child(2) input[type=button]');
    if (primerLink) return primerLink;
  }

  // Estrategia 4: cualquier link cuyo href contenga doPostBack y Select
  const porPostBack = [...document.querySelectorAll('a')].find(a => {
    const h = a.getAttribute('href') || '';
    return h.includes('doPostBack') && h.includes('Select');
  });
  if (porPostBack) return porPostBack;

  return null;
}

function val(id) {
  const el = document.getElementById(id);
  if (!el) return NE;
  return (el.value || el.textContent || '').trim() || NE;
}

function selVal(id) {
  const el = document.getElementById(id);
  if (!el || el.selectedIndex < 0) return NE;
  return el.options[el.selectedIndex]?.text?.trim() || NE;
}

// Ejecutar __doPostBack extrayendo parámetros del href
function postBackFromLink(linkEl) {
  if (!linkEl) return false;
  const href = linkEl.getAttribute('href') || '';

  // Extraer parámetros de javascript:__doPostBack('TARGET','ARGUMENT')
  const match = href.match(/__doPostBack\('([^']+)'\s*,\s*'([^']*)'\)/);
  if (match) {
    try {
      // Llamar directamente como función (evita el bloqueo CSP del href)
      window.__doPostBack(match[1], match[2]);
      return true;
    } catch(e) {
      // Si __doPostBack no está disponible globalmente, usar el form
      submitPostBack(match[1], match[2]);
      return true;
    }
  }

  // Si no tiene doPostBack en el href, click normal
  linkEl.click();
  return true;
}

// Enviar postback via el formulario ASP.NET directamente
function submitPostBack(target, argument) {
  const form = document.forms[0];
  if (!form) return;

  let et = form.querySelector('[name="__EVENTTARGET"]');
  let ea = form.querySelector('[name="__EVENTARGUMENT"]');

  if (!et) {
    et = document.createElement('input');
    et.type = 'hidden';
    et.name = '__EVENTTARGET';
    form.appendChild(et);
  }
  if (!ea) {
    ea = document.createElement('input');
    ea.type = 'hidden';
    ea.name = '__EVENTARGUMENT';
    form.appendChild(ea);
  }

  et.value = target;
  ea.value = argument;
  form.submit();
}

// ─────────────────────────────────────────────────────────────────
//  SCRAPING PAI
// ─────────────────────────────────────────────────────────────────
async function scrapingPAI(modulo, opcion, consecutivo, codigo) {
  let fila = { consecutivo, codigo };

  try {
    // Esperar campo de búsqueda
    const campo = await waitForEl('ContentPlaceHolder1_txb_NumeroIdentificacionBusqueda', 12000);
    campo.focus();
    campo.value = '';
    campo.value = String(codigo);
    campo.dispatchEvent(new Event('input',  { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(300);

    // Disparar búsqueda
    const btnBuscar = document.querySelector(
      "#ContentPlaceHolder1_btn_Buscar, #ContentPlaceHolder1_btnBuscar, " +
      "input[type='image'][id*='Buscar'], input[type='submit'][id*='Buscar'], " +
      "a[id*='Buscar']"
    );

    if (btnBuscar) {
      postBackFromLink(btnBuscar);
    } else {
      // Postback directo del campo
      submitPostBack('ctl00$ContentPlaceHolder1$txb_NumeroIdentificacionBusqueda', '');
    }

    await sleep(3500);

    // ── Buscar link "Seleccionar" ──
    const selectLink = await waitForSelectLink(10000);

    if (!selectLink) {
      fila.estado = NE;
      chrome.runtime.sendMessage({ type: 'SCRAPING_RESULT', codigo, fila });
      return;
    }

    // Ejecutar el postback del link Seleccionar
    postBackFromLink(selectLink);
    await sleep(3500);

    // Leer campos base
    fila.ID        = val('ContentPlaceHolder1_txb_Identificacion');
    fila.nombre1   = val('ContentPlaceHolder1_txb_Nombre1');
    fila.apellido1 = val('ContentPlaceHolder1_txb_Apellido1');
    if (modulo === 'mayores') fila.apellido2 = val('ContentPlaceHolder1_txb_Apellido2');

    // Leer campos por opción
    switch (opcion) {
      case '1':
        fila.td               = selVal('ContentPlaceHolder1_ddl_TipoID');
        fila.nombre2          = val('ContentPlaceHolder1_txb_Nombre2');
        fila.apellido2        = val('ContentPlaceHolder1_txb_Apellido2');
        fila.fecha_nacimiento = val('ContentPlaceHolder1_txb_FechaNacimiento');
        fila.sexo             = selVal('ContentPlaceHolder1_ddl_Genero');
        fila.genero           = selVal('ContentPlaceHolder1_ddl_GeneroLGBTI');
        break;
      case '2':
        fila.telefono1 = val('ContentPlaceHolder1_txb_Telefono1');
        fila.telefono2 = val('ContentPlaceHolder1_txb_Telefono2');
        break;
      case '3':
        fila.direccion           = val('ContentPlaceHolder1_txb_Direccion');
        fila.direccion_adicional = val('ContentPlaceHolder1_txbDatoAdicionalDireccion');
        fila.municipio           = selVal('ContentPlaceHolder1_ddlMunicipios');
        fila.departamento        = selVal('ContentPlaceHolder1_ddlDepartamento');
        fila.localidad           = selVal('ContentPlaceHolder1_ddl_Localidad');
        fila.barrio              = selVal('ContentPlaceHolder1_ddl_Barrio');
        fila.upz                 = selVal('ContentPlaceHolder1_ddlUPZ');
        break;
      case '4':
        fila.eapb    = selVal('ContentPlaceHolder1_ddl_Aseguradora');
        fila.regimen = selVal('ContentPlaceHolder1_ddl_Regimen');
        break;
      case '5':
        fila.tdmadre        = selVal('ContentPlaceHolder1_ddl_TipoIDMadre');
        fila.docmadre       = val('ContentPlaceHolder1_txb_IdentificacionMadre');
        fila.nombremadre1   = val('ContentPlaceHolder1_txb_Nombre1Madre');
        fila.nombremadre2   = val('ContentPlaceHolder1_txb_Nombre2Madre');
        fila.apellidomadre1 = val('ContentPlaceHolder1_txb_Apellido1Madre');
        fila.apellidomadre2 = val('ContentPlaceHolder1_txb_Apellido2Madre');
        break;
    }

  } catch (e) {
    fila.estado = NE;
    fila.error  = e.message;
  }

  chrome.runtime.sendMessage({ type: 'SCRAPING_RESULT', codigo, fila });
}

// ─────────────────────────────────────────────────────────────────
//  SCRAPING ADRES
// ─────────────────────────────────────────────────────────────────
async function scrapingADRES(consecutivo, codigo) {
  let fila = { consecutivo, codigo };

  try {
    let sexoExtraido = null;

    for (let intento = 1; intento <= 3 && !sexoExtraido; intento++) {
      const campo = await waitForEl('MainContent_txtNoId', 12000);
      campo.focus();
      campo.value = '';
      campo.value = String(codigo);
      campo.dispatchEvent(new Event('input',  { bubbles: true }));
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);

      const btnConsultar = document.getElementById('MainContent_btnConsultar')
                        || document.getElementById('MainContent_btnBuscar')
                        || document.querySelector("input[type='submit']");
      if (btnConsultar) btnConsultar.click();
      else submitPostBack('MainContent_btnConsultar', '');

      await sleep(3000);

      let tabla = null, origen = null;
      const tC = document.getElementById('MainContent_grdContributivo');
      const tB = document.getElementById('MainContent_grdBUDA');
      if (tC && tC.rows.length > 1) { tabla = tC; origen = 'Contributivo'; }
      else if (tB && tB.rows.length > 1) { tabla = tB; origen = 'BUDA'; }

      if (!tabla) { fila.estado = NE; break; }

      const ths = [...tabla.querySelectorAll('th')].map(th => th.textContent.trim());
      const tds = [...tabla.querySelectorAll('tr:nth-child(2) td')].map(td => td.textContent.trim());
      ths.forEach((h, i) => { if (h) fila[h] = tds[i] ?? ''; });
      fila.tabla_origen = origen;

      // Buscar link de detalle
      const selectQ = origen === 'Contributivo'
        ? [...document.querySelectorAll('a')].find(a => (a.getAttribute('href')||'').includes("grdContributivo") && (a.getAttribute('href')||'').includes('Select$0'))
        : [...document.querySelectorAll('a')].find(a => (a.getAttribute('href')||'').includes("grdSubsidiado") && (a.getAttribute('href')||'').includes('Select$0'));

      if (!selectQ) { fila.SEXO = 'NO DISPONIBLE'; break; }

      postBackFromLink(selectQ);
      await sleep(3500);

      if (window.location.href.includes('NoAutorizado')) {
        const btnInicio = document.getElementById('MainContent_cmdInicio');
        if (btnInicio) { postBackFromLink(btnInicio); await sleep(2000); }
        continue;
      }

      const lblSexo = document.getElementById('MainContent_lblSexo');
      if (lblSexo) {
        fila.SEXO = lblSexo.textContent.trim();
        sexoExtraido = fila.SEXO;
      } else {
        fila.SEXO = 'NO DISPONIBLE'; break;
      }

      const btnNueva = document.getElementById('MainContent_cmdNuevaConsulta')
                    || document.getElementById('MainContent_cmdNueConsulta');
      if (btnNueva) { postBackFromLink(btnNueva); await sleep(2000); }
    }

    if (!sexoExtraido && !fila.SEXO) fila.SEXO = 'NO AUTORIZADO';

  } catch (e) {
    fila.estado = 'ERROR';
    fila.error  = e.message;
  }

  chrome.runtime.sendMessage({ type: 'SCRAPING_RESULT', codigo, fila });
}
