// ─────────────────────────────────────────────────────────────────
//  SISVAN 2026 — content.js
//  Se ejecuta dentro de la pestaña del portal saludcapital.gov.co
//  Recibe instrucciones desde background.js y hace el scraping DOM.
// ─────────────────────────────────────────────────────────────────

const NE = 'NO ENCONTRADO';

// Avisar al background que el portal está listo
chrome.runtime.sendMessage({ type: 'PORTAL_READY' });

// ── Escuchar órdenes del background ────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'PING') {
    chrome.runtime.sendMessage({ type: 'PORTAL_READY' });
    return;
  }

  if (msg.type === 'SISVAN_CONSULTA') {
    const { modulo, opcion, consecutivo, codigo } = msg;

    if (modulo === 'adres') {
      scrapingADRES(consecutivo, codigo);
    } else {
      scrapingPAI(modulo, opcion, consecutivo, codigo);
    }
  }
});

// ─────────────────────────────────────────────────────────────────
//  HELPERS DOM
// ─────────────────────────────────────────────────────────────────
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value || el.textContent.trim() : NE;
}

function selVal(id) {
  const el = document.getElementById(id);
  if (!el) return NE;
  return el.options[el.selectedIndex]?.text?.trim() || NE;
}

function waitFor(id, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const el = document.getElementById(id);
      if (el) return resolve(el);
      if (Date.now() - start > timeout) return reject(new Error('Timeout: ' + id));
      setTimeout(check, 300);
    };
    check();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────
//  SCRAPING PAI (Menores pag=2 / Mayores pag=3)
// ─────────────────────────────────────────────────────────────────
async function scrapingPAI(modulo, opcion, consecutivo, codigo) {
  const pag = modulo === 'menores' ? '2' : '3';
  let fila = { consecutivo, codigo };

  try {
    // Navegar a la página correcta
    const url = `https://appb.saludcapital.gov.co/pai/vacunacion/datosBasicos.aspx?pag=${pag}`;
    if (!window.location.href.includes(`pag=${pag}`)) {
      window.location.href = url;
      await sleep(3000);
    }

    // Ingresar código de búsqueda
    const campo = await waitFor('ContentPlaceHolder1_txb_NumeroIdentificacionBusqueda');
    campo.value = '';
    campo.focus();
    campo.value = String(codigo);

    // Disparar búsqueda simulando Enter
    campo.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', keyCode:13, bubbles:true }));
    campo.dispatchEvent(new KeyboardEvent('keypress',{ key:'Enter', keyCode:13, bubbles:true }));
    campo.dispatchEvent(new KeyboardEvent('keyup',   { key:'Enter', keyCode:13, bubbles:true }));

    // Alternativa: click en botón de búsqueda si existe
    const btnBuscar = document.querySelector(
      'input[type=submit][id*=Buscar], input[type=button][id*=Buscar], a[id*=Buscar]'
    );
    if (btnBuscar) btnBuscar.click();

    await sleep(2500);

    // Click en "Seleccionar" primer resultado
    const selectLink = document.querySelector(
      "a[href*=\"__doPostBack('ctl00$ContentPlaceHolder1$gdvResultadoBusqueda','Select$0')\"]"
    );
    if (!selectLink) throw new Error('Sin resultados para: ' + codigo);
    selectLink.click();
    await sleep(2500);

    // Campos base
    fila.ID        = val('ContentPlaceHolder1_txb_Identificacion');
    fila.nombre1   = val('ContentPlaceHolder1_txb_Nombre1');
    fila.apellido1 = val('ContentPlaceHolder1_txb_Apellido1');

    if (modulo === 'mayores') {
      fila.apellido2 = val('ContentPlaceHolder1_txb_Apellido2');
    }

    // Campos por opción
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
      case '5': // solo menores
        fila.tdmadre        = selVal('ContentPlaceHolder1_ddl_TipoIDMadre');
        fila.docmadre       = val('ContentPlaceHolder1_txb_IdentificacionMadre');
        fila.nombremadre1   = val('ContentPlaceHolder1_txb_Nombre1Madre');
        fila.nombremadre2   = val('ContentPlaceHolder1_txb_Nombre2Madre');
        fila.apellidomadre1 = val('ContentPlaceHolder1_txb_Apellido1Madre');
        fila.apellidomadre2 = val('ContentPlaceHolder1_txb_Apellido2Madre');
        break;
    }

  } catch (e) {
    fila.estado = 'NO ENCONTRADO';
    fila.error  = e.message;
  }

  chrome.runtime.sendMessage({ type: 'SCRAPING_RESULT', codigo, fila });
}

// ─────────────────────────────────────────────────────────────────
//  SCRAPING ADRES / Comprobador de Derechos
// ─────────────────────────────────────────────────────────────────
async function scrapingADRES(consecutivo, codigo) {
  let fila = { consecutivo, codigo };

  const URL_COMPROBADOR = 'https://appb.saludcapital.gov.co/comprobadordederechos/Consulta.aspx';

  try {
    if (!window.location.href.includes('comprobadordederechos')) {
      window.location.href = URL_COMPROBADOR;
      await sleep(3000);
    }

    let sexoExtraido = null;

    for (let intento = 1; intento <= 3 && !sexoExtraido; intento++) {
      // Ingresar código
      const campo = await waitFor('MainContent_txtNoId', 10000);
      campo.value = '';
      campo.focus();
      campo.value = String(codigo);
      campo.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', keyCode:13, bubbles:true }));
      campo.dispatchEvent(new KeyboardEvent('keypress',{ key:'Enter', keyCode:13, bubbles:true }));
      campo.dispatchEvent(new KeyboardEvent('keyup',   { key:'Enter', keyCode:13, bubbles:true }));

      // También intentar botón buscar
      const btnBuscar = document.querySelector('#MainContent_btnConsultar, #MainContent_btnBuscar');
      if (btnBuscar) btnBuscar.click();

      await sleep(2500);

      // Detectar tabla
      let tabla = null;
      let origen = null;
      const tContrib = document.getElementById('MainContent_grdContributivo');
      const tBuda    = document.getElementById('MainContent_grdBUDA');

      if (tContrib && tContrib.rows.length > 1) { tabla = tContrib; origen = 'Contributivo'; }
      else if (tBuda && tBuda.rows.length > 1)  { tabla = tBuda;    origen = 'BUDA'; }

      if (!tabla) {
        fila.estado = 'NO ENCONTRADO';
        break;
      }

      // Extraer encabezados y fila de datos
      const ths = [...tabla.querySelectorAll('th')].map(th => th.textContent.trim());
      const tds = [...tabla.querySelectorAll('tr:nth-child(2) td')].map(td => td.textContent.trim());
      ths.forEach((h, i) => { fila[h] = tds[i] ?? ''; });
      fila.tabla_origen = origen;

      // Click en Select$0
      let linkDetalle = null;
      if (origen === 'Contributivo') {
        linkDetalle = document.querySelector("a[href*=\"grdContributivo','Select$0\"]");
      } else {
        linkDetalle = document.querySelector("a[href*=\"grdSubsidiado','Select$0\"]");
      }

      if (!linkDetalle) { fila.SEXO = 'NO DISPONIBLE'; break; }

      linkDetalle.click();
      await sleep(3000);

      // Verificar redirección a NoAutorizado
      if (window.location.href.includes('NoAutorizado')) {
        const btnInicio = document.getElementById('MainContent_cmdInicio');
        if (btnInicio) { btnInicio.click(); await sleep(2000); }
        continue; // reintentar
      }

      // Extraer SEXO
      const lblSexo = document.getElementById('MainContent_lblSexo');
      if (lblSexo) {
        fila.SEXO    = lblSexo.textContent.trim();
        sexoExtraido = fila.SEXO;
      } else {
        fila.SEXO = 'NO DISPONIBLE';
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
