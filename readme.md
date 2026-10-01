# AGENTS.md

## Construcción y ejecución

Aplicación web **Vue 3 + Vite + Bootstrap 5** (JavaScript) con un único modelo: **Inversiones** (VAN, TIR, TIRM, PRI, ROI, IPR, flujo nivelado, punto de equilibrio, sensibilidad y CMPC/CAPM). Los modelos de Mochila 0-1 y de ruta más corta fueron retirados de la app Vue; su implementación histórica queda en `app-flask` (solo referencia).

- Node v26.8.1 y npm 11.19.0 disponibles; usar siempre `npm`, nunca `python` (no aplica).
- Instalar dependencias: `npm install` (dentro de `app\`).
- Servidor de desarrollo: `npm run dev` → http://localhost:5173
- Compilación de producción: `npm run build` → `app\dist\`; previsualizar con `npm run preview`.
- Bootstrap `5.3.8` es dependencia normal: su CSS se importa en `src\main.js` **antes** de `src\style.css` para que el tema propio pueda sobrescribirlo.

## Pruebas

Suite con `node:test` (sin dependencias extra). Ejecutar desde `app\`:

```
npm test
```

`inversion.test.js` (42 pruebas) verifica la teoría financiera contra valores calculados a mano: conversión de tasa anual↔periodo, VAN, serie por periodo, TIR (caso único, TIR múltiple con la regla de los signos de Descartes, sin cambio de signo, TIR negativa), TIRM, PRI simple/descontado/no sostenido, ROI, IPR, flujo nivelado, factor de anualidad, valor terminal de Gordon (y que el rescate no se hace crecer), CMPC (CAPM), punto de equilibrio, sensibilidad, perfil del VAN y `evaluarProyecto` completo. `formato.test.js` (17 pruebas) verifica el formato `en-US` de dinero/porcentajes/ejes y el comportamiento de escritura de las cajas. Suite completa: 59 pruebas. Verificación manual: `npm run dev` y probar en el navegador.

## Errores frecuentes de las cajas numéricas

- `CampoNumero.vue` es `type="text"` (no `number`) porque el texto lleva `$`, comas de millar y decimales. El modelo (`v-model`) es una **cadena (string) con punto decimal** (`250000.00`); el prefijo `$` y las comas son solo de presentación.
- El `$` es el **prop `prefijo`** del componente y forma parte del texto de la caja (`$250,000.00`), no un `<span>` aparte: si el prop no existiera, Vue lo dejaría caer como atributo HTML y la caja saldría sin `$`. La lógica está en `lib\formato.js`: `textoCampo` (valor inicial), `campoAlEscribir` (cada pulsación) y `campoAlConfirmar` (blur/Enter). Ninguna función debe recibir un `prefijo` que no aplique: si el campo no lo declara, se cuela en el DOM.
- **No reagrupar en cada pulsación**: al confirmar se fija el formato, pero mientras se escribe solo se limpian caracteres (`campoAlEscribir` en `lib\formato.js`). Si se reescribiera el texto agrupado en vivo, teclear un dígito más sobre `$250,000.00` se redondearía y la caja parecería no aceptar cifras (fue el bug reportado). Hay una prueba de regresión que teclea `250000` dígito a dígito.
- El cursor se repone con `setSelectionRange` tras sanear, para que quitar el `$` o un carácter no lo mande al final.
- El `<style scoped>` de `CampoNumero` solo reserva hueco a la derecha (`con-suf`, 84px) para el `% anual` que pinta el padre en `.inv-input .suf`; el prefijo no necesita hueco porque ya está en el texto.

## Arquitectura

- `app\src\lib\inversion.js` — lógica pura de evaluación financiera: `UNIDADES`/`periodosPorAnio`, `tasaAPeriodica`/`tasaAAnual` (equivalencia compuesta), `factorAnualidad`, `valorPresente`, `van`, `serieVan`, `cambiosDeSigno` (regla de Descartes), `tir` (bisección para TIR única; barrido logarítmico para TIR múltiple), `tirModificada` (MIR con tasas de financiamiento y reinversión), `periodoRecuperacion` (simple y descontado, con aviso de recuperación no sostenida), `roi`, `indiceRentabilidad`, `flujoNivelado`, `valorTerminal` (Gordon), `cmmpc` (CAPM), `perfilVan`, `puntoEquilibrio`, `sensibilidad` y `evaluarProyecto` (agrega todo + veredicto y advertencias). El **veredicto lo decide el VAN**; la TIR solo confirma si es única. Formato interno: dinero `en-US` con dos decimales (`$000,000,000.00`) y porcentajes con punto decimal.
- `app\src\components\InversionesApp.vue` — pantalla completa de Inversiones: barra de herramientas (imprimir + tema claro/oscuro persistido en `localStorage` bajo `sp-inv-tema`), panel de entradas (inversión, tasa anual, unidad del periodo, nº de periodos, valor de rescate, crecimiento perpetuo, flujo uniforme o manual, panel opcional del CMPC con CAPM) y resultados: tarjetas KPI (VAN, TIR, PRI, ROI, TIRM, IPR, flujo nivelado, margen) con `row row-cols-2 row-cols-md-4`, veredicto, gráficas SVG (flujo acumulado con la marca del PRI y perfil del VAN con la TIR marcada), tabla por periodo, otras métricas, sensibilidad y notas de fórmulas. Toda la maquetación es de Bootstrap (`.row` + `.col-12 .col-lg-5 .col-xl-4` para entradas y `.col-12 .col-lg-7 .col-xl-8` para resultados, `.d-grid`, `.table-responsive`, `.form-control`, `.form-switch`, `.btn`); el `<style scoped>` solo aporta la piel (veredicto, gráficas SVG) y las reglas global de tema viven en `style.css`.
- `app\src\lib\formato.js` + `app\src\components\CampoNumero.vue` — formato `en-US` compartido: `fmtDinero`/`fmtPct`/`fmtFactor`/`fmtEje` para mostrar, y `normalizarNumero`/`formatearNumero`/`textoCampo`/`campoAlEscribir`/`campoAlConfirmar` para las cajas (limpieza por pulsación, agrupado al confirmar, prefijo `$` dentro del texto). `InversionesApp` importa los `fmt*` de ahí; los helpers de caja solo los usa `CampoNumero`.
- `app\src\lib\explicaciones.js` + `app\src\components\GloboInfo.vue` — textos en español de qué significa cada entrada/KPI/sección y el globo `?` que los muestra (al pasar el puntero, al enfocar con teclado o al tocar; se cierra con Escape o pulsando fuera); `AYUDA` es la tabla de claves.
- `app\src\style.css` — paleta y piezas globales, importada **después** de Bootstrap: variables `--bg/--panel/--border/--text/--muted/--accent/--error/--ok/--amber/--barra` en `:root` y sus valores claros en `:root.tema-claro`; `.cabecera`, `.contenido`, `.pie`, `.formulario`, `.resultado`, `.tarjeta*`, `.tabla-nota`, `.error`, `.aviso`, `.pos/.neg` y ajustes de `table` (vars `--bs-table-*`).
- `app\src\App.vue` — raíz sin navegación: cabecera (`container-xxl`), `InversionesApp` y pie. `main.js` importa Vue, el CSS/JS de Bootstrap y `style.css`, y monta la app.
- Tema: el botón de la barra alterna `tema` y llama a `aplicarTema()`, que pone la clase `tema-claro` y el atributo `data-bs-theme` (`light`/`dark`) en `<html>`; al montar se lee `localStorage`. Así Bootstrap y la paleta propia cambian a la vez.

## Convenciones

- Interfaz completamente en español: etiquetas, mensajes de error y textos.
- **Cifras**: dinero con `toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` → `$000,000,000.00`; porcentajes y factores con punto decimal (`fmtPct`, `fmtFactor`). Solo los ejes de las gráficas usan forma compacta (`fmtEje`: `$250 k`, `$1.3 M`). No dejar `es-MX`/`es-ES` ni `replace('.', ',')` en el código.
- Errores de validación se muestran en el `error` del componente (mensajes en español); la lógica de finanzas vive en `lib\inversion.js` y las pruebas junto a la lib.
- El componente solo orquesta y muestra; nada de cálculos financieros en el `.vue`.

## Documentación de referencia

- `smartpyme_calculadora_inversion.html` (raíz del repo) — calculadora de inversión de un solo archivo (SmartPyme). Referencia de estructura de `InversionesApp.vue` (entrada izquierda / resultados derecha, tarjetas, veredicto, gráfica de flujo acumulado, tabla por periodo, tema e impresión). Sus cálculos **no** se copiaron tal cual: la app Vue corrige la conversión de la tasa anual a la del periodo, anualiza la TIR, detecta TIR múltiple por la regla de los signos y decide con el VAN.
- `app-flask\` — implementaciones anteriores de Mochila 0-1 y ruta más corta/CPM (`algorithms\knapsack.py`, `algorithms\shortest_path.py`, `static\graph.js`, plantillas Jinja) y `app-flask\static\style.css` con las clases semánticas originales. **Solo referencia**: no se ejecuta y no se modifica salvo que se pida. Ojo: `app-flask\app.py` conserva un doble `app.run` al final (inalcanzable), intencionalmente sin tocar.

## Errores y trampas

- `python` (Microsoft Store) está roto e irrelevante aquí; usar siempre `npm`/`node`.
- Finanzas: la tasa que se captura es ANUAL; los flujos se descuentan con la tasa equivalente del periodo (`(1+i_a)^(1/ppy)-1`) y la TIR del periodo se anualiza con `(1+r)^ppy-1`. El HTML de referencia aplicaba el 12% anual a cada mes, lo que puede invertir la decisión (ej.: VAN +129 frente a −380 en un año de pagos mensuales).
- El valor de rescate entra por separado en `evaluarProyecto({ rescate })` y se suma al último flujo; el valor terminal de Gordon se calcula sobre el flujo **operativo** (nunca sobre el rescate, que ya es el final del proyecto) y si vienen los dos se avisa del doble conteo.
- La TIR solo decide si es única (un cambio de signo en `[-I0, FC1..FCn]`); con varias raíces el criterio es inválido y se reporta la TIRM. Cuando los criterios TIR y VAN chocan, **prevalece el VAN** y se muestra una advertencia.
- Bootstrap se importa antes que `style.css`: cualquier sobrescritura de la paleta debe ir en `style.css` (o en el `<style scoped>` del componente), nunca en el CSS de Bootstrap.
- El `style.css` global define `table { ... }` y `label { ... }` de forma amplia: al añadir marcado nuevo, revisar que no choque con `.table` de Bootstrap (el texto de las tablas se alinea a la derecha con `.inv :deep(td)` salvo la primera columna).
- Para validar el template sin navegador: `node` + `@vue/compiler-dom` sobre el SFC (la compilación de Vite también detecta el desbalance, pero sin indicar la línea).
