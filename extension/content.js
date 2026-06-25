// ─────────────────────────────────────────────────────────────────
//  SISVAN 2026 — content.js v7
//  Estrategia: navegar a la URL por cada código (igual que Python),
//  luego escribir el código y disparar el form submit del campo,
//  y usar __doPostBack exacto para Seleccionar.
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

// Esperar elemento por ID
function waitForEl(id, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const el = document.getElementById(id);
      if (el) { clearInterval(iv); resolve(el); return; }
      if (Date.now() - start > timeout) {
        clearInterval(iv);
        reject(new Error('Timeout: ' + id));
      }
    }, 400);
  });
}

// Esperar que la página cambie de URL o que aparezca un elemento
function waitForNavigation(timeout = 12000) {
  return new Promise(resolve => setTimeout(resolve, timeout));
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

// __doPostBack directo — target y argument exactos del Python
function doPostBack(target, argument) {
  if (typeof __doPostBack === 'function') {
    __doPostBack(target, argument);
    return;
  }
  // Fallback: manipular form
  const form = document.forms[0];
  if (!form) return;
  const set = (name, val) => {
    let el = form.querySelector(`input[name="${name}"]`);
    if (!el) { el = document.createElement('input'); el.type='hidden'; el.name=name; form.appendChild(el); }
    el.value = val;
  };
  set('__EVENTTARGET',   target);
  set('__EVENTARGUMENT', argument);
  form.submit();
}

// Escribir en el campo carácter por carácter (simula typing real)
function escribir(el, texto) {
  el.focus();
  el.value = '';
  el.dispatchEvent(new Event('focus', { bubbles: true }));

  for (const char of String(texto)) {
    el.value += char;
    el.dispatchEvent(new InputEvent('input',  { bubbles: true, data: char }));
    el.dispatchEvent(new InputEvent('change', { bubbles: true }));
  }
}

// Disparar búsqueda: intenta el onkeypress del campo, luego el form
function dispararBusqueda(campo) {
  // 1. Verificar si el campo tiene un manejador onkeypress con un postback
  const okp = campo.getAttribute('onkeypress') || '';
  const matchKP = okp.match(/__doPostBack\('([^']+)'\s*,\s*'([^']*)'\)/);
  if (matchKP) {
    doPostBack(matchKP[1], matchKP[2]);
    return;
  }

  // 2. Buscar botón de búsqueda visible cerca del campo
  const ids = [
    'ContentPlaceHolder1_btn_BuscarMenores',
    'ContentPlaceHolder1_btn_BuscarMayores',
    'ContentPlaceHolder1_btn_Buscar',
    'ContentPlaceHolder1_btnBuscar',
    'ContentPlaceHolder1_ImageButton1',
  ];
  for (const id of ids) {
    const btn = document.getElementById(id);
    if (btn) { btn.click(); return; }
  }

  // 3. Buscar cualquier input image o submit en el form (el botón lupa del portal)
  const imgBtn = document.querySelector(
    "input[type='image'], input[type='submit'], button[type='submit']"
  );
  if (imgBtn) { imgBtn.click(); return; }

  // 4. Último recurso: postback del campo directamente
  // El portal PAI usa UpdatePanel — el campo puede tener AutoPostBack
  doPostBack('ctl00$ContentPlaceHolder1$txb_NumeroIdentificacionBusqueda', '');
}

// ─────────────────────────────────────────────────────────────────
//  SCRAPING PAI
// ─────────────────────────────────────────────────────────────────
async function scrapingPAI(modulo, opcion, consecutivo, codigo) {
  let fila = { consecutivo, codigo };

  try {
    // PASO 1 — Esperar campo de búsqueda
    // (background.js ya navegó a la URL correcta y esperó carga completa)
    const campo = await waitForEl(
      'ContentPlaceHolder1_txb_NumeroIdentificacionBusqueda', 15000
    );

    // PASO 2 — Escribir el código
    escribir(campo, codigo);
    await sleep(400);

    // PASO 3 — Disparar la búsqueda
    dispararBusqueda(campo);

    // PASO 4 — Esperar tabla de resultados (gdvResultadoBusqueda)
    await waitForEl('ContentPlaceHolder1_gdvResultadoBusqueda', 10000);
    await sleep(600);

    // PASO 5 — Seleccionar primer resultado
    // Python: //a[@href="javascript:__doPostBack('ctl00$ContentPlaceHolder1$gdvResultadoBusqueda','Select$0')"]
    // Equivalente directo:
    doPostBack(
      'ctl00$ContentPlaceHolder1$gdvResultadoBusqueda',
      'Select$0'
    );

    // PASO 6 — Esperar que cargue el detalle
    await waitForEl('ContentPlaceHolder1_txb_Identificacion', 10000);
    await sleep(400);

    // PASO 7 — Leer campos base
    fila.ID        = val('ContentPlaceHolder1_txb_Identificacion');
    fila.nombre1   = val('ContentPlaceHolder1_txb_Nombre1');
    fila.apellido1 = val('ContentPlaceHolder1_txb_Apellido1');
    if (modulo === 'mayores') {
      fila.apellido2 = val('ContentPlaceHolder1_txb_Apellido2');
    }

    // PASO 8 — Leer campos por opción
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

      // Esperar campo
      const campo = await waitForEl('MainContent_txtNoId', 12000);
      escribir(campo, codigo);
      await sleep(400);

      // Disparar búsqueda — el comprobador usa Enter en el campo
      const okp = campo.getAttribute('onkeypress') || '';
      const matchKP = okp.match(/__doPostBack\('([^']+)'\s*,\s*'([^']*)'\)/);
      if (matchKP) {
        doPostBack(matchKP[1], matchKP[2]);
      } else {
        const btnC = document.getElementById('MainContent_btnConsultar')
                  || document.getElementById('MainContent_btnBuscar')
                  || document.querySelector("input[type='submit'], button[type='submit']");
        if (btnC) btnC.click();
        else doPostBack('MainContent_btnConsultar', '');
      }

      await sleep(3000);

      // Detectar tabla
      let tabla = null, origen = null;
      const tC = document.getElementById('MainContent_grdContributivo');
      const tB = document.getElementById('MainContent_grdBUDA');
      if (tC && tC.rows.length > 1)      { tabla = tC; origen = 'Contributivo'; }
      else if (tB && tB.rows.length > 1) { tabla = tB; origen = 'BUDA'; }

      if (!tabla) { fila.estado = NE; break; }

      // Extraer datos tabla
      const ths = [...tabla.querySelectorAll('th')].map(th => th.textContent.trim());
      const tds = [...tabla.querySelectorAll('tr:nth-child(2) td')].map(td => td.textContent.trim());
      ths.forEach((h, i) => { if (h) fila[h] = tds[i] ?? ''; });
      fila.tabla_origen = origen;

      // Seleccionar detalle — Python usa href contains grdContributivo/'Select$0'
      if (origen === 'Contributivo') {
        doPostBack('ctl00$MainContent$grdContributivo', 'Select$0');
      } else {
        doPostBack('ctl00$MainContent$grdSubsidiado', 'Select$0');
      }
      await sleep(3500);

      if (window.location.href.includes('NoAutorizado')) {
        const btnI = document.getElementById('MainContent_cmdInicio');
        if (btnI) { btnI.click(); await sleep(2000); }
        continue;
      }

      const lblSexo = document.getElementById('MainContent_lblSexo');
      if (lblSexo) {
        fila.SEXO    = lblSexo.textContent.trim();
        sexoExtraido = fila.SEXO;
      } else {
        fila.SEXO = 'NO DISPONIBLE'; break;
      }

      const btnNueva = document.getElementById('MainContent_cmdNuevaConsulta')
                    || document.getElementById('MainContent_cmdNueConsulta');
      if (btnNueva) { btnNueva.click(); await sleep(2000); }
    }

    if (!sexoExtraido && !fila.SEXO) fila.SEXO = 'NO AUTORIZADO';

  } catch (e) {
    fila.estado = 'ERROR';
    fila.error  = e.message;
  }

  chrome.runtime.sendMessage({ type: 'SCRAPING_RESULT', codigo, fila });
}
