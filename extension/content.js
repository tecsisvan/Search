// ─────────────────────────────────────────────────────────────────
//  SISVAN 2026 — content.js v10
//  Botón búsqueda real: ContentPlaceHolder1_imbBuscarMadre (pag=2)
//  Para pag=3 puede ser diferente — se intenta lista completa
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
        reject(new Error('Timeout: ' + id));
      }
    }, 400);
  });
}

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
        reject(new Error('Sin valor: ' + id));
      }
    }, 400);
  });
}

function val(id) {
  const el = document.getElementById(id);
  if (!el) return NE;
  return (el.value || '').trim() || NE;
}

function selVal(id) {
  const el = document.getElementById(id);
  if (!el || el.selectedIndex < 0) return NE;
  const txt = (el.options[el.selectedIndex]?.text || '').trim();
  return (txt && txt !== 'Seleccione...') ? txt : NE;
}

function escribir(el, texto) {
  el.focus();
  el.value = String(texto);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

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

// ── Disparar búsqueda PAI ────────────────────────────────────────
// Orden de prioridad basado en los IDs reales encontrados en consola:
// pag=2 menores → imbBuscarMadre
// pag=3 mayores → probablemente imbBuscarMayores o similar
// Se intenta lista exhaustiva + onkeypress del campo
function dispararBusqueda(campo) {
  // 1. onkeypress del campo (si tiene AutoPostBack)
  const okp = campo.getAttribute('onkeypress') || '';
  const m   = okp.match(/__doPostBack\('([^']+)'\s*,\s*'([^']*)'\)/);
  if (m) { doPostBack(m[1], m[2]); return; }

  // 2. Lista exhaustiva de IDs de botones de búsqueda del portal PAI
  const ids = [
    'ContentPlaceHolder1_imbBuscarMadre',    // pag=2 menores ✅ confirmado
    'ContentPlaceHolder1_imbBuscarMayores',   // pag=3 mayores (probable)
    'ContentPlaceHolder1_imbBuscar',
    'ContentPlaceHolder1_btn_Buscar',
    'ContentPlaceHolder1_btnBuscar',
    'ContentPlaceHolder1_ImageButton1',
    'ContentPlaceHolder1_imbBuscarPaciente',
  ];
  for (const id of ids) {
    const btn = document.getElementById(id);
    if (btn) { btn.click(); return; }
  }

  // 3. Cualquier input[type=image] visible en el form
  const imgBtn = document.querySelector("input[type='image']");
  if (imgBtn) { imgBtn.click(); return; }

  // 4. Submit genérico
  const submit = document.querySelector("input[type='submit'], button[type='submit']");
  if (submit) { submit.click(); return; }

  // 5. Postback del campo directamente
  doPostBack('ctl00$ContentPlaceHolder1$txb_NumeroIdentificacionBusqueda', '');
}

// ─────────────────────────────────────────────────────────────────
//  IDs VERIFICADOS DEL PORTAL PAI
// ─────────────────────────────────────────────────────────────────
const C = {
  tipoID:          'ContentPlaceHolder1_ddl_TipoID',
  identificacion:  'ContentPlaceHolder1_txb_Identificacion',
  estadoPersona:   'ContentPlaceHolder1_ddlEstadoPersona',
  apellido1:       'ContentPlaceHolder1_txb_Apellido1',
  apellido2:       'ContentPlaceHolder1_txb_Apellido2',
  nombre1:         'ContentPlaceHolder1_txb_Nombre1',
  nombre2:         'ContentPlaceHolder1_txb_Nombre2',
  fechaNac:        'ContentPlaceHolder1_txb_FechaNacimiento',
  genero:          'ContentPlaceHolder1_ddl_Genero',
  generoLGBTI:     'ContentPlaceHolder1_ddl_GeneroLGBTI',
  orientacion:     'ContentPlaceHolder1_ddl_Orientacion',
  grupoSanguineo:  'ContentPlaceHolder1_ddl_GrupoSanguineo',
  factorRH:        'ContentPlaceHolder1_ddlFactorRH',
  etnia:           'ContentPlaceHolder1_ddl_Etnia',
  grupoPoblac:     'ContentPlaceHolder1_ddl_GrupoPoblacional',
  telefono1:       'ContentPlaceHolder1_txb_Telefono1',
  correo:          'ContentPlaceHolder1_txb_correo',
  direccion:       'ContentPlaceHolder1_txb_Direccion',
  localidad:       'ContentPlaceHolder1_ddl_Localidad',
  barrio:          'ContentPlaceHolder1_ddl_Barrio',
  upz:             'ContentPlaceHolder1_ddlUPZ',
  municipio:       'ContentPlaceHolder1_ddlMunicipios',
  departamento:    'ContentPlaceHolder1_ddlDepartamento',
  pais:            'ContentPlaceHolder1_ddlPais',
  regimen:         'ContentPlaceHolder1_ddl_Regimen',
  aseguradora:     'ContentPlaceHolder1_ddl_Aseguradora',
};

const CM = {
  tipoIDMadre:     'ContentPlaceHolder1_ddl_TipoIDMadre',
  identificaMadre: 'ContentPlaceHolder1_txb_IdentificacionMadre',
  apellido1Madre:  'ContentPlaceHolder1_txb_Apellido1Madre',
  apellido2Madre:  'ContentPlaceHolder1_txb_Apellido2Madre',
  nombre1Madre:    'ContentPlaceHolder1_txb_Nombre1Madre',
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

    // PASO 2 — Escribir código y buscar
    escribir(campo, codigo);
    await sleep(400);
    dispararBusqueda(campo);

    // PASO 3 — Esperar tabla de resultados
    await waitForEl('ContentPlaceHolder1_gdvResultadoBusqueda', 12000);
    await sleep(500);

    // PASO 4 — Seleccionar primer resultado
    doPostBack(
      'ctl00$ContentPlaceHolder1$gdvResultadoBusqueda',
      'Select$0'
    );

    // PASO 5 — Esperar detalle cargado (apellido1 con valor real)
    await waitForValue(C.apellido1, 12000);
    await sleep(300);

    // PASO 6 — Campos base
    fila.ID        = val(C.identificacion);
    fila.apellido1 = val(C.apellido1);
    fila.apellido2 = val(C.apellido2);
    fila.nombre1   = val(C.nombre1);
    fila.nombre2   = val(C.nombre2);

    // PASO 7 — Campos por opción
    switch (opcion) {
      case '1':
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

      case '2':
        fila.telefono1 = val(C.telefono1);
        fila.correo    = val(C.correo);
        break;

      case '3':
        fila.direccion    = val(C.direccion);
        fila.localidad    = selVal(C.localidad);
        fila.barrio       = selVal(C.barrio);
        fila.upz          = selVal(C.upz);
        fila.municipio    = selVal(C.municipio);
        fila.departamento = selVal(C.departamento);
        fila.pais         = selVal(C.pais);
        break;

      case '4':
        fila.eapb    = selVal(C.aseguradora);
        fila.regimen = selVal(C.regimen);
        break;

      case '5':
        fila.tipoID_madre    = selVal(CM.tipoIDMadre);
        fila.doc_madre       = val(CM.identificaMadre);
        fila.nombre1_madre   = val(CM.nombre1Madre);
        fila.nombre2_madre   = val(CM.nombre2Madre);
        fila.apellido1_madre = val(CM.apellido1Madre);
        fila.apellido2_madre = val(CM.apellido2Madre);
        fila.numero_hijo     = val(CM.numeroHijo);
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
      escribir(campo, codigo);
      await sleep(400);

      const btnC = document.getElementById('MainContent_btnConsultar')
                || document.getElementById('MainContent_btnBuscar')
                || document.querySelector("input[type='submit'], button[type='submit']");
      if (btnC) btnC.click();
      else doPostBack('MainContent_btnConsultar', '');

      await sleep(3000);

      let tabla = null, origen = null;
      const tC = document.getElementById('MainContent_grdContributivo');
      const tB = document.getElementById('MainContent_grdBUDA');
      if (tC && tC.rows.length > 1)      { tabla = tC; origen = 'Contributivo'; }
      else if (tB && tB.rows.length > 1) { tabla = tB; origen = 'BUDA'; }

      if (!tabla) { fila.estado = NE; break; }

      const ths = [...tabla.querySelectorAll('th')].map(th => th.textContent.trim());
      const tds = [...tabla.querySelectorAll('tr:nth-child(2) td')].map(td => td.textContent.trim());
      ths.forEach((h, i) => { if (h) fila[h] = tds[i] ?? ''; });
      fila.tabla_origen = origen;

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
