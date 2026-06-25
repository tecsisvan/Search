// ─────────────────────────────────────────────────────────────────
//  SISVAN 2026 — content.js v6
//  Fiel al flujo Python:
//    1. Escribe el código en el campo
//    2. Simula Enter con KeyboardEvent (como send_keys + Keys.ENTER)
//    3. Espera que aparezca la tabla de resultados
//    4. Llama __doPostBack directamente con los parámetros exactos
//       (no busca el link — lo construye igual que el XPATH del Python)
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
        reject(new Error('Timeout esperando elemento: ' + id));
      }
    }, 400);
  });
}

// Esperar hasta que un elemento exista Y sea visible
function waitForVisible(id, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) { clearInterval(iv); resolve(el); return; }
      if (Date.now() - start > timeout) {
        clearInterval(iv);
        reject(new Error('Timeout esperando visible: ' + id));
      }
    }, 400);
  });
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

// Simular Enter exactamente como Selenium send_keys(Keys.ENTER)
function presionarEnter(el) {
  ['keydown','keypress','keyup'].forEach(tipo => {
    el.dispatchEvent(new KeyboardEvent(tipo, {
      key: 'Enter', code: 'Enter', keyCode: 13,
      which: 13, bubbles: true, cancelable: true
    }));
  });
}

// Llamar __doPostBack directamente — sin buscar links
// Equivalente exacto al click() de Selenium sobre el link con ese href
function doPostBack(target, argument) {
  if (typeof __doPostBack === 'function') {
    __doPostBack(target, argument);
  } else {
    // Fallback: manipular el form directamente como ASP.NET lo haría
    const form = document.forms[0];
    if (!form) return;
    const setHidden = (name, value) => {
      let el = form.querySelector(`[name="${name}"]`);
      if (!el) {
        el = document.createElement('input');
        el.type = 'hidden';
        el.name = name;
        form.appendChild(el);
      }
      el.value = value;
    };
    setHidden('__EVENTTARGET', target);
    setHidden('__EVENTARGUMENT', argument);
    form.submit();
  }
}

// ─────────────────────────────────────────────────────────────────
//  SCRAPING PAI  — réplica exacta del Python
// ─────────────────────────────────────────────────────────────────
async function scrapingPAI(modulo, opcion, consecutivo, codigo) {
  let fila = { consecutivo, codigo };

  try {
    // PASO 1: Esperar campo de búsqueda (ya estamos en la página correcta
    //         porque background.js navegó primero)
    const campo = await waitForEl('ContentPlaceHolder1_txb_NumeroIdentificacionBusqueda', 12000);

    // PASO 2: Escribir el código y presionar Enter
    //         (= campo.clear() + campo.send_keys(str(codigo) + Keys.ENTER) del Python)
    campo.focus();
    campo.value = '';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.value = String(codigo);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);
    presionarEnter(campo);

    // PASO 3: Esperar que aparezca la tabla de resultados (gdvResultadoBusqueda)
    //         El Python usa time.sleep(2) — nosotros esperamos el elemento real
    await sleep(500);
    await waitForVisible('ContentPlaceHolder1_gdvResultadoBusqueda', 8000);
    await sleep(500);

    // PASO 4: Llamar __doPostBack con los parámetros EXACTOS del Python
    //         Python busca: @href="javascript:__doPostBack('ctl00$ContentPlaceHolder1$gdvResultadoBusqueda','Select$0')"
    //         Nosotros llamamos la función directamente:
    doPostBack('ctl00$ContentPlaceHolder1$gdvResultadoBusqueda', 'Select$0');

    // PASO 5: Esperar que cargue el detalle del paciente
    await sleep(500);
    await waitForEl('ContentPlaceHolder1_txb_Identificacion', 8000);
    await sleep(300);

    // PASO 6: Leer campos base
    fila.ID        = val('ContentPlaceHolder1_txb_Identificacion');
    fila.nombre1   = val('ContentPlaceHolder1_txb_Nombre1');
    fila.apellido1 = val('ContentPlaceHolder1_txb_Apellido1');
    if (modulo === 'mayores') {
      fila.apellido2 = val('ContentPlaceHolder1_txb_Apellido2');
    }

    // PASO 7: Leer campos según opción seleccionada
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
//  SCRAPING ADRES — réplica exacta del Python
// ─────────────────────────────────────────────────────────────────
async function scrapingADRES(consecutivo, codigo) {
  let fila = { consecutivo, codigo };

  try {
    let sexoExtraido = null;

    for (let intento = 1; intento <= 3 && !sexoExtraido; intento++) {

      // Esperar campo de búsqueda
      const campo = await waitForEl('MainContent_txtNoId', 12000);
      campo.focus();
      campo.value = '';
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.value = String(codigo);
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(200);

      // Enter en el campo (= campo.send_keys(Keys.ENTER) del Python)
      presionarEnter(campo);
      await sleep(2500);

      // Detectar tabla Contributivo o BUDA
      let tabla = null, origen = null;
      const tC = document.getElementById('MainContent_grdContributivo');
      const tB = document.getElementById('MainContent_grdBUDA');

      if (tC && tC.rows.length > 1)      { tabla = tC; origen = 'Contributivo'; }
      else if (tB && tB.rows.length > 1) { tabla = tB; origen = 'BUDA'; }

      if (!tabla) {
        fila.estado = NE;
        break;
      }

      // Extraer encabezados y primera fila de datos
      const ths = [...tabla.querySelectorAll('th')].map(th => th.textContent.trim());
      const tds = [...tabla.querySelectorAll('tr:nth-child(2) td')].map(td => td.textContent.trim());
      ths.forEach((h, i) => { if (h) fila[h] = tds[i] ?? ''; });
      fila.tabla_origen = origen;

      // Click en Select$0 con __doPostBack directo
      // Python: //a[contains(@href, "grdContributivo','Select$0")]
      if (origen === 'Contributivo') {
        doPostBack('ctl00$MainContent$grdContributivo', 'Select$0');
      } else {
        doPostBack('ctl00$MainContent$grdSubsidiado', 'Select$0');
      }

      await sleep(3000);

      // Verificar NoAutorizado
      if (window.location.href.includes('NoAutorizado')) {
        const btnInicio = document.getElementById('MainContent_cmdInicio');
        if (btnInicio) { btnInicio.click(); await sleep(2000); }
        continue;
      }

      // Extraer SEXO
      const lblSexo = document.getElementById('MainContent_lblSexo');
      if (lblSexo) {
        fila.SEXO    = lblSexo.textContent.trim();
        sexoExtraido = fila.SEXO;
      } else {
        fila.SEXO = 'NO DISPONIBLE';
        break;
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
