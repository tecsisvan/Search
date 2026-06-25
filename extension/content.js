// ─────────────────────────────────────────────────────────────────
//  SISVAN 2026 — content.js  (v2 — lógica fiel al script Python)
//  Inyectado en appb.saludcapital.gov.co
// ─────────────────────────────────────────────────────────────────

const NE = 'NO ENCONTRADO';

// Avisar que el portal está listo
chrome.runtime.sendMessage({ type: 'PORTAL_READY' });

// Escuchar órdenes del background
chrome.runtime.onMessage.addListener((msg) => {
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
//  HELPERS
// ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Esperar a que un elemento exista en el DOM
function waitForEl(id, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const el = document.getElementById(id);
      if (el) { clearInterval(interval); resolve(el); }
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error('Timeout esperando: ' + id));
      }
    }, 300);
  });
}

// Leer value de input
function val(id) {
  const el = document.getElementById(id);
  if (!el) return NE;
  return (el.value || el.textContent || '').trim() || NE;
}

// Leer opción seleccionada de un <select>
function selVal(id) {
  const el = document.getElementById(id);
  if (!el || el.selectedIndex < 0) return NE;
  return el.options[el.selectedIndex]?.text?.trim() || NE;
}

// Disparar __doPostBack igual que el portal ASP.NET
function doPostBack(target, argument) {
  if (typeof __doPostBack === 'function') {
    __doPostBack(target, argument);
  } else {
    // fallback: crear y enviar el form manualmente
    const form = document.forms[0];
    if (!form) return;
    let et = form['__EVENTTARGET'];
    let ea = form['__EVENTARGUMENT'];
    if (!et) { et = document.createElement('input'); et.type='hidden'; et.name='__EVENTTARGET'; form.appendChild(et); }
    if (!ea) { ea = document.createElement('input'); ea.type='hidden'; ea.name='__EVENTARGUMENT'; form.appendChild(ea); }
    et.value = target;
    ea.value = argument;
    form.submit();
  }
}

// ─────────────────────────────────────────────────────────────────
//  SCRAPING PAI
// ─────────────────────────────────────────────────────────────────
async function scrapingPAI(modulo, opcion, consecutivo, codigo) {
  const pag = modulo === 'menores' ? '2' : '3';
  const urlBase = `https://appb.saludcapital.gov.co/pai/vacunacion/datosBasicos.aspx?pag=${pag}`;
  let fila = { consecutivo, codigo };

  try {
    // Navegar si no estamos en la página correcta
    if (!window.location.href.includes(`pag=${pag}`)) {
      window.location.href = urlBase;
      await sleep(3500);
    }

    // ── BÚSQUEDA ──
    const campoBusqueda = await waitForEl('ContentPlaceHolder1_txb_NumeroIdentificacionBusqueda');
    campoBusqueda.value = String(codigo);

    // Buscar botón de búsqueda o usar __doPostBack directamente
    // El portal usa un ImageButton o LinkButton — intentamos ambos
    const btnBuscar = document.querySelector(
      "input[id*='btnBuscar'], input[id*='Buscar'], a[id*='Buscar'], input[type='image']"
    );

    if (btnBuscar) {
      btnBuscar.click();
    } else {
      // Forzar postback del campo de búsqueda
      campoBusqueda.dispatchEvent(new Event('change', { bubbles: true }));
      doPostBack('ctl00$ContentPlaceHolder1$txb_NumeroIdentificacionBusqueda', '');
    }

    await sleep(3000);

    // ── CLICK EN "Seleccionar" PRIMER RESULTADO ──
    // Exactamente igual al Python: href con Select$0
    const selectLink = document.querySelector(
      "a[href*=\"'ctl00$ContentPlaceHolder1$gdvResultadoBusqueda','Select$0'\"]," +
      "a[href*='Select$0']"
    );

    if (!selectLink) {
      fila.estado = NE;
      chrome.runtime.sendMessage({ type: 'SCRAPING_RESULT', codigo, fila });
      return;
    }

    selectLink.click();
    await sleep(3000);

    // ── LEER CAMPOS BASE ──
    fila.ID        = val('ContentPlaceHolder1_txb_Identificacion');
    fila.nombre1   = val('ContentPlaceHolder1_txb_Nombre1');
    fila.apellido1 = val('ContentPlaceHolder1_txb_Apellido1');

    if (modulo === 'mayores') {
      fila.apellido2 = val('ContentPlaceHolder1_txb_Apellido2');
    }

    // ── LEER CAMPOS POR OPCIÓN ──
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
  const URL_COMPROBADOR = 'https://appb.saludcapital.gov.co/comprobadordederechos/Consulta.aspx';
  let fila = { consecutivo, codigo };

  try {
    if (!window.location.href.includes('comprobadordederechos')) {
      window.location.href = URL_COMPROBADOR;
      await sleep(3500);
    }

    let sexoExtraido = null;

    for (let intento = 1; intento <= 3 && !sexoExtraido; intento++) {

      // Ingresar código
      const campo = await waitForEl('MainContent_txtNoId', 10000);
      campo.value = String(codigo);

      // Buscar botón consultar
      const btnConsultar = document.getElementById('MainContent_btnConsultar')
                        || document.getElementById('MainContent_btnBuscar')
                        || document.querySelector("input[type='submit']");

      if (btnConsultar) {
        btnConsultar.click();
      } else {
        doPostBack('MainContent_btnConsultar', '');
      }

      await sleep(3000);

      // Detectar tabla Contributivo o BUDA
      let tabla = null;
      let origen = null;
      const tContrib = document.getElementById('MainContent_grdContributivo');
      const tBuda    = document.getElementById('MainContent_grdBUDA');

      if (tContrib && tContrib.rows.length > 1) { tabla = tContrib; origen = 'Contributivo'; }
      else if (tBuda && tBuda.rows.length > 1)  { tabla = tBuda;    origen = 'BUDA'; }

      if (!tabla) {
        fila.estado = NE;
        break;
      }

      // Extraer encabezados y primera fila de datos
      const ths = [...tabla.querySelectorAll('th')].map(th => th.textContent.trim());
      const tds = [...tabla.querySelectorAll('tr:nth-child(2) td')].map(td => td.textContent.trim());
      ths.forEach((h, i) => { if (h) fila[h] = tds[i] ?? ''; });
      fila.tabla_origen = origen;

      // Click en Select$0 según tabla — igual que el Python
      let linkDetalle = null;
      if (origen === 'Contributivo') {
        linkDetalle = document.querySelector(
          "a[href*=\"grdContributivo','Select$0\"]"
        );
      } else {
        linkDetalle = document.querySelector(
          "a[href*=\"grdSubsidiado','Select$0\"]"
        );
      }

      if (!linkDetalle) {
        fila.SEXO = 'NO DISPONIBLE';
        break;
      }

      linkDetalle.click();
      await sleep(3500);

      // Verificar redirección a NoAutorizado
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
