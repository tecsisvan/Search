# 🏥 SISVAN Consulta — PAI / ADRES
**Sistema de Consulta Automatizada · Secretaría Distrital de Salud · Subred Sur 2026**

> Interfaz web alojada en GitHub Pages + extensión de Chrome que inyecta el scraping directamente en la pestaña del portal institucional. **No requiere chromedriver ni Python en el equipo del usuario.**

---

## Estructura del repositorio

```
sisvan-consulta/
├── index.html          ← Pantalla de inicio de sesión
├── app.html            ← Aplicación principal (3 módulos)
├── README.md
└── extension/          ← Extensión de Chrome (instalar manualmente)
    ├── manifest.json
    ├── background.js
    ├── content.js          (se inyecta en el portal saludcapital.gov.co)
    ├── content-bridge.js   (se inyecta en la página web GitHub Pages)
    └── popup.html
```

---

## Instalación — Paso a paso

### 1. Publicar en GitHub Pages

1. Crear un repositorio público en GitHub (ej. `sisvan-consulta`).
2. Subir todos los archivos de la raíz (`index.html`, `app.html`, `README.md`).
3. Ir a **Settings → Pages → Source: main branch / root**.
4. La URL quedará: `https://TU-USUARIO.github.io/sisvan-consulta/`

> **Antes de publicar:** en `extension/popup.html`, reemplaza `TU-USUARIO` en la constante `APP_URL` con tu usuario real de GitHub.

---

### 2. Instalar la extensión de Chrome

> La extensión **no está en la Chrome Web Store**; se instala en modo desarrollador directamente desde el repositorio.

1. Descargar o clonar el repositorio.
2. Abrir Chrome → `chrome://extensions/`
3. Activar **"Modo desarrollador"** (esquina superior derecha).
4. Clic en **"Cargar descomprimida"**.
5. Seleccionar la carpeta **`extension/`** del repositorio.
6. La extensión aparecerá en la barra con el ícono 🏥.

---

### 3. Usar la aplicación

1. Abrir Chrome y navegar al portal PAI/ADRES:
   - PAI: `https://appb.saludcapital.gov.co/pai/vacunacion/datosBasicos.aspx`
   - ADRES: `https://appb.saludcapital.gov.co/comprobadordederechos/Consulta.aspx`
   - **Iniciar sesión en el portal** (la extensión usará esa sesión activa).

2. Abrir `https://TU-USUARIO.github.io/sisvan-consulta/` en otra pestaña.

3. Iniciar sesión con las credenciales institucionales.

4. Verificar que el badge **"✅ Extensión conectada"** aparezca en la barra superior.

5. Cargar el CSV de códigos (columnas: `consecutivo`, `codigo`).

6. Seleccionar el módulo y tipo de consulta → **Iniciar consulta**.

7. Al finalizar, descargar los resultados en **CSV** o **XLSX**.

---

## Credenciales por defecto

| Usuario  | Contraseña    |
|----------|--------------|
| `sisvan` | `Subred2026*` |
| `luis`   | `Luis2026*`   |
| `diego`  | `Diego2026*`  |

> **Cambiar contraseñas antes de publicar.** Abrir la consola del navegador y ejecutar:
> ```js
> async function h(s){const b=new TextEncoder().encode(s);const d=await crypto.subtle.digest('SHA-256',b);return[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');}
> h('TuNuevaClave').then(console.log)
> ```
> Copiar el hash resultante en el objeto `USUARIOS` de `index.html`.

---

## Formato del CSV de entrada

```csv
consecutivo,codigo
1,1020481234
2,1013654321
3,52345678
```

- Separador: coma `,` o punto y coma `;` (se detecta automáticamente).
- Codificación: UTF-8.

---

## Módulos disponibles

### 👶 PAI Menores (pág. 2)
| Opción | Datos extraídos |
|--------|----------------|
| 1 | TD, ID, nombres, apellidos, fecha nacimiento, sexo, género |
| 2 | Teléfono 1 y 2 |
| 3 | Dirección, municipio, dpto, localidad, barrio, UPZ |
| 4 | EAPB y régimen |
| 5 | Datos de la madre |

### 🧑 PAI Mayores (pág. 3)
| Opción | Datos extraídos |
|--------|----------------|
| 1 | TD, ID, nombres, apellidos, fecha nacimiento, sexo, género |
| 2 | Teléfono 1 y 2 |
| 3 | Dirección completa |
| 4 | EAPB y régimen |

### 🔐 ADRES / Comprobador de Derechos
Extrae tabla completa Contributivo o BUDA + campo SEXO del detalle.

---

## Notas técnicas

- El scraping ocurre **dentro de la pestaña del portal** ya autenticada — sin abrir ventanas adicionales ni necesitar chromedriver.
- La comunicación es: `app.html` → `content-bridge.js` → `background.js` → `content.js` → portal DOM → de vuelta por el mismo canal.
- Los resultados se guardan en memoria durante la sesión. Al cerrar la pestaña se pierden (descargar antes).
- Si el portal redirige a `NoAutorizado.aspx`, la extensión reintenta hasta 3 veces automáticamente (módulo ADRES).

---

*© 2026 Luis Silva — SISVAN · Subred Integrada de Servicios de Salud Sur E.S.E.*
