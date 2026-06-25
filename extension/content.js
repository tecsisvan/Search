// ─────────────────────────────────────────────────────────────────
//  SISVAN 2026 — content.js v9 DEFINITIVO
//  IDs verificados directamente desde la consola del portal
//  pag=2 (menores) y pag=3 (mayores)
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

function waitForEl(id, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const el = document.getElementById(id);
      if (el) { clearInterval(iv); resolve(el); return; }
      if (Date.now() - start > timeout) {
        clearInterval(iv);
        reject(new Error('Timeout esperando: ' + id));
      }
    }, 400);
  });
}

// Esperar que un campo tenga valor real (no vacío)
function waitForValue(id, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const el = document.getElementById(id);
      const v  = el ? (el.value || '').trim() : '';
      if (el && v !== '' && v !== 'Seleccione...') {
        clearInterval(iv); resolve(el); return;
      }
      if (Date.now() - start > timeout) {
        clearInterval(iv);
        reject(new Error('Sin valor en: ' + id));
      }
    }, 400);
  });
}

// Leer input text/hidden
function val(id) {
  const el = document.getElementById(id);
  if (!el) return NE;
  return (el.value || '').trim() || NE;
}

// Leer select
function selVal(id) {
  const el = document.getElementById(id);
  if (!el || el.selectedIndex < 0) return NE;
  const txt = (el.options[el.selectedIndex]?.text || '').trim();
  return (txt && txt !== 'Seleccione...') ? txt : NE;
}

// Escribir en campo
function escribir(el, texto) {
  el.focus();
  el.value = String(texto);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// __doPostBack directo — sin tocar el href del link
function doPostBack(target, argument) {
  if (typeof __doPostBack === 'function') {
    __doPostBack(target, argument);
    return;
  }
  const form = document.forms[0];
  if (!form) return;
  const set = (name, v) => {
    let el = form.querySelector(`input[name="${name}"]`);
    if (!el) {
      el = document.createElement('input');
      el.type = 'hidden'; el.name = name;
      form.appendChild(el);
    }
    el.value = v;
  };
  set('__EVENTTARGET',   target);
  set('__EVENTARGUMENT', argument);
  form.submit();
}

// Disparar búsqueda PAI — busca el botón lupa/imagen/submit del form
function dispararBusqueda(campo) {
  // 1. Revisar onkeypress del campo
  const okp = campo.getAttribute('onkeypress') || '';
  const m   = okp.match(/__doPostBack\('([^']+)'\s*,\s*'([^']*)'\)/);
  if (m) { doPostBack(m[1], m[2]); return; }

  // 2. Botones conocidos del portal PAI
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

  // 3. Cualquier input image o submit visible
  const imgBtn = document.querySelector(
    "input[type='image'], input[type='submit'], button[type='submit']"
  );
  if (imgBtn) { imgBtn.click(); return; }

  // 4. Postback del campo como último recurso
  doPostBack('ctl00$ContentPlaceHolder1$txb_NumeroIdentificacionBusqueda', '');
}

// ─────────────────────────────────────────────────────────────────
//  IDs VERIFICADOS — PORTAL PAI pag=2 (menores) y pag=3 (mayores)
//  Fuente: consola del portal, campo a campo
// ─────────────────────────────────────────────────────────────────

// ── Campos comunes a menores Y mayores ──
const C = {
  // Identificación
  tipoID:          'ContentPlaceHolder1_ddl_TipoID',
  identificacion:  'ContentPlaceHolder1_txb_Identificacion',
  consecutivo:     'ContentPlaceHolder1_hdfConsecutivo',
  estadoPersona:   'ContentPlaceHolder1_ddlEstadoPersona',

  // Nombre y apellidos
  apellido1:       'ContentPlaceHolder1_txb_Apellido1',
  apellido2:       'ContentPlaceHolder1_txb_Apellido2',
  nombre1:         'ContentPlaceHolder1_txb_Nombre1',
  nombre2:         'ContentPlaceHolder1_txb_Nombre2',

  // Datos básicos
  fechaNac:        'ContentPlaceHolder1_txb_FechaNacimiento',
  genero:          'ContentPlaceHolder1_ddl_Genero',
  generoLGBTI:     'ContentPlaceHolder1_ddl_GeneroLGBTI',
  orientacion:     'ContentPlaceHolder1_ddl_Orientacion',
  grupoSanguineo:  'ContentPlaceHolder1_ddl_GrupoSanguineo',
  factorRH:        'ContentPlaceHolder1_ddlFactorRH',
  etnia:           'ContentPlaceHolder1_ddl_Etnia',
  grupoPoblac:     'ContentPlaceHolder1_ddl_GrupoPoblacional',

  // Teléfono y correo
  telefono1:       'ContentPlaceHolder1_txb_Telefono1',
  correo:          'ContentPlaceHolder1_txb_correo',

  // Dirección
  direccion:       'ContentPlaceHolder1_txb_Direccion',
  localidad:       'ContentPlaceHolder1_ddl_Localidad',
  barrio:          'ContentPlaceHolder1_ddl_Barrio',
  upz:             'ContentPlaceHolder1_ddlUPZ',
  municipio:       'ContentPlaceHolder1_ddlMunicipios',
  departamento:    'ContentPlaceHolder1_ddlDepartamento',
  pais:            'ContentPlaceHolder1_ddlPais',

  // EAPB
  regimen:         'ContentPlaceHolder1_ddl_Regimen',
  aseguradora:     'ContentPlaceHolder1_ddl_Aseguradora',
};

// ── Campos exclusivos de menores (pag=2) ──
const CM = {
  tipoIDMadre:     'ContentPlaceHolder1_ddl_TipoIDMadre',
  identificaMadre: 'ContentPlaceHolder1_txb_IdentificacionMadre',
  apellido1Madre:  'ContentPlaceHolder1_txb_Apellido1Madre',
  apellido2Madre:  'ContentPlaceHolder1_txb_Apellido2Madre',
  nombre1Madre:    'ContentPlaceHolder1_txb_Nombre1Madre',
  // nombre2Madre no aparece con valor en la consola — se intenta igual
  nombre2Madre:    'ContentPlaceHolder1_txb_Nombre2Madre',
  numeroHijo:      'ContentPlaceHolder1_txb_numeroHijo',
};

// ─────────────────────────────────────────────────────────────────
//  SCRAPING PAI
// ─────────────────────────────────────────────────────────────────
async function scrapingPAI(modulo, opcion, consecutivo, codigo) {
  let fila = { consecutivo, codigo };

  try {
    // PASO 1 — Esperar campo de búsqueda
    const campo = await waitForEl(
      'ContentPlaceHolder1_txb_NumeroIdentificacionBusqueda', 15000
    );

    // PASO 2 — Escribir código y disparar búsqueda
    escribir(campo, codigo);
    await sleep(400);
    dispararBusqueda(campo);

    // PASO 3 — Esperar tabla de resultados
    await waitForEl('ContentPlaceHolder1_gdvResultadoBusqueda', 10000);
    await sleep(500);

    // PASO 4 — Seleccionar primer resultado (doPostBack exacto del Python)
    doPostBack(
      'ctl00$ContentPlaceHolder1$gdvResultadoBusqueda',
      'Select$0'
    );

    // PASO 5 — Esperar que el detalle cargue
    // Confirmamos con apellido1 que siempre tiene valor
    await waitForValue(C.apellido1, 12000);
    await sleep(300);

    // PASO 6 — Campos base (presentes en TODAS las opciones)
    fila.ID        = val(C.identificacion);
    fila.apellido1 = val(C.apellido1);
    fila.apellido2 = val(C.apellido2);
    fila.nombre1   = val(C.nombre1);
    fila.nombre2   = val(C.nombre2);

    // PASO 7 — Campos específicos por opción
    switch (opcion) {

      case '1': // ── Datos básicos ──
        fila.tipoID         = selVal(C.tipoID);
        fila.fecha_nac      = val(C.fechaNac);
        fila.sexo           = selVal(C.genero);
        fila.genero_lgbti   = selVal(C.generoLGBTI);
        fila.orientacion    = selVal(C.orientacion);
        fila.grupo_sang     = selVal(C.grupoSanguineo);
        fila.factor_rh      = selVal(C.factorRH);
        fila.etnia          = selVal(C.etnia);
        fila.grupo_poblac   = selVal(C.grupoPoblac);
        fila.estado_persona = selVal(C.estadoPersona);
        break;

      case '2': // ── Teléfono ──
        fila.telefono1 = val(C.telefono1);
        fila.correo    = val(C.correo);
        break;

      case '3': // ── Dirección ──
        fila.direccion    = val(C.direccion);
        fila.localidad    = selVal(C.localidad);
        fila.barrio       = selVal(C.barrio);
        fila.upz          = selVal(C.upz);
        fila.municipio    = selVal(C.municipio);
        fila.departamento = selVal(C.departamento);
        fila.pais         = selVal(C.pais);
        break;

      case '4': // ── EAPB ──
        fila.eapb    = selVal(C.aseguradora);
        fila.regimen = selVal(C.regimen);
        break;

      case '5': // ── Datos madre (solo menores pag=2) ──
        fila.tipoID_madre   = selVal(CM.tipoIDMadre);
        fila.doc_madre      = val(CM.identificaMadre);
        fila.nombre1_madre  = val(CM.nombre1Madre);
        fila.nombre2_madre  = val(CM.nombre2Madre);
        fila.apellido1_madre= val(CM.apellido1Madre);
        fila.apellido2_madre= val(CM.apellido2Madre);
        fila.numero_hijo    = val(CM.numeroHijo);
        break;
    }

  } catch (e) {
    fila.estado = NE;
    fila.error  = e.message;
  }

  chrome.runtime.sendMessage({ type: 'SCRAPING_RESULT', codigo, fila });
}

// ─────────────────────────────────────────────────────────────────
//  SCRAPING ADRES / COMPROBADOR DE DERECHOS
// ─────────────────────────────────────────────────────────────────
async function scrapingADRES(consecutivo, codigo) {
  let fila = { consecutivo, codigo };

  try {
    let sexoExtraido = null;

    for (let intento = 1; intento <= 3 && !sexoExtraido; intento++) {

      const campo = await waitForEl('MainContent_txtNoId', 12000);
      escribir(campo, codigo);
      await sleep(400);

      // Disparar consulta ADRES
      const btnC = document.getElementById('MainContent_btnConsultar')
                || document.getElementById('MainContent_btnBuscar')
                || document.querySelector("input[type='submit'], button[type='submit']");
      if (btnC) btnC.click();
      else doPostBack('MainContent_btnConsultar', '');

      await sleep(3000);

      // Detectar tabla Contributivo o BUDA
      let tabla = null, origen = null;
      const tC = document.getElementById('MainContent_grdContributivo');
      const tB = document.getElementById('MainContent_grdBUDA');
      if (tC && tC.rows.length > 1)      { tabla = tC; origen = 'Contributivo'; }
      else if (tB && tB.rows.length > 1) { tabla = tB; origen = 'BUDA'; }

      if (!tabla) { fila.estado = NE; break; }

      // Extraer datos de la tabla
      const ths = [...tabla.querySelectorAll('th')].map(th => th.textContent.trim());
      const tds = [...tabla.querySelectorAll('tr:nth-child(2) td')].map(td => td.textContent.trim());
      ths.forEach((h, i) => { if (h) fila[h] = tds[i] ?? ''; });
      fila.tabla_origen = origen;

      // Seleccionar detalle
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

      // Volver a nueva consulta
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
