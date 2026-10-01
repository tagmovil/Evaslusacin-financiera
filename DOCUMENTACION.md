# Documentación de la calculadora de inversiones

Aplicación web (**Vue 3 + Vite + Bootstrap 5**, JavaScript) para evaluar un
proyecto de inversión. Toda la interfaz está en español y la lógica financiera
vive en funciones puras, testeadas con `node:test`.

## 1. Qué información maneja la app

La app trabaja con **un solo modelo: Inversiones**. Todo lo que captura y todo lo
que calcula se describe abajo.

### 1.1 Datos de entrada (lo que el usuario captura)

| Campo | Qué es |
| --- | --- |
| **Inversión inicial (I₀)** | Cuánto cuesta arrancar el proyecto. Número no negativo. |
| **Tasa anual de descuento** | La tasa de interés anual que se usa para descontar flujos (el costo de oportunidad del capital). Se convierte a la tasa equivalente de cada periodo. |
| **Unidad del periodo** | Año, semestre, trimestre o mes (cuántos periodos hay por año). |
| **Número de periodos** | Cuántos flujos hay en el horizonte (1 a 60). |
| **Valor de rescate** | Lo que se recupera al liquidar el proyecto en el último periodo. |
| **Crecimiento perpetuo** | Crecimiento anual del último flujo operativo, con el que se calcula el valor terminal de Gordon. |
| **Flujo por periodo** | Uniforme (un solo valor para todos) o manual (un valor por periodo, admite negativos). |
| **Panel CMPC (CAPM)** *(opcional, con interruptor)* | Tasa libre de riesgo, beta (β), prima de mercado, costo de la deuda, tasa de impuestos, valor del patrimonio y valor de la deuda. Sirve para justificar la tasa de descuento: calcular el CMPC y usarlo como tasa. |

### 1.2 Información que produce (resultados)

**Tarjetas de indicadores (KPIs):**

- **VAN** — Valor actual neto: flujos descontados menos la inversión. Es el criterio que decide.
- **TIR** — Tasa interna de retorno anualizada (o "Múltiple" si el flujo no es convencional).
- **Recuperación (PRI)** — Periodo de recuperación, con su versión descontada.
- **ROI** — Retorno sobre la inversión sin considerar el tiempo (indicador complementario).
- **TIRM** — TIR modificada, válida cuando la TIR no es única.
- **IPR** — Índice de rentabilidad (beneficio/costo).
- **Flujo nivelado** — Renta constante equivalente al VAN por periodo.
- **Margen** — Holgura del VAN sobre la inversión (punto de equilibrio).

**Además:**
- **Veredicto** — Acepta o rechaza el proyecto (decide el VAN) con advertencias si hay conflictos entre criterios (TIR vs. VAN, doble conteo de rescate + Gordon, crecimiento perpetuo inválido, TIR negativa…).
- **Gráficas SVG** — Flujo acumulado (simple y descontado, con la marca del PRI) y perfil del VAN en función de la tasa (cruza el cero en la TIR).
- **Tabla por periodo** — Flujo, VAN acumulado y acumulado simple de cada periodo.
- **Otras métricas** — Tasa aplicada al periodo, VAF, suma/ganancia neta de flujos, TIR por periodo y anual, tasas de la TIRM, valor terminal de Gordon, inversión máxima tolerable, flujo crítico de equilibrio y tasa de rotura del proyecto.
- **Sensibilidad del VAN** — Variación del VAN al mover cada entrada (tasa, inversión, flujos) un ±p.p., para ver qué supuesto es el crítico.
- **Supuestos y fórmulas** — Acordeones con cada fórmula como fracción (VAN, TIR, TIRM, PRI, ROI, flujo nivelado, IPR, CMPC…) y la explicación de dónde sale cada dato.
- **Glosario** — Siglas (VAN, TIR, TIRM, PRI, ROI, VAF, IPR, CMPC, ppy, p.p.)

### 1.3 Otra información de la interfaz

- **Globos de ayuda (?)**: explicación en español de cada entrada, KPI y sección, con un glosario al pie.
- **Tema claro/oscuro**: se guarda en `localStorage` del navegador (clave `sp-inv-tema`); es solo presentación.

### 1.4 Privacidad de los datos

- La app **es 100 % local**: todo el cálculo ocurre en el navegador y **nada se
  envía a ningún servidor**.
- Los datos capturados viven solo en memoria mientras la página está abierta.
- Lo único que se persiste es el **tema** (claro/oscuro) en `localStorage`.
- No hay cuentas, ni cookies, ni información personal, ni telemetría.

## 2. Cómo ejecutarla

Requisitos: **Node.js v26.8.1** y **npm 11.19.0** (ya presentes en este entorno; usar siempre `npm`, nunca `python`).

### 2.1 Instalar dependencias

```bash
cd app
npm install
```

### 2.2 Modo desarrollo (con recarga en vivo)

```bash
npm run dev
```

Abre http://localhost:5173 en el navegador. Cualquier cambio en el código se
refleja al instante.

### 2.3 Build de producción y previsualización

```bash
npm run build     # genera app\dist\
npm run preview   # sirve el build en http://localhost:4173
```

El build de producción se previsualiza en http://localhost:4173.

### 2.4 Pruebas automáticas

```bash
npm test
```

Ejecuta la suite completa de **59 pruebas** con `node:test`, sin dependencias
extra:

- `src/lib/inversion.test.js` (42 pruebas) — teoría financiera: conversión de
  tasas anual↔periodo, VAN, TIR (única/múltiple/negativa), TIRM, PRI,
  ROI, IPR, flujo nivelado, Gordon, CMPC (CAPM), punto de equilibrio,
  sensibilidad y `evaluarProyecto`.
- `src/lib/formato.test.js` (17 pruebas) — formato `en-US` de dinero/porcentajes
  y el comportamiento de las cajas numéricas.

## 3. Criterios que aplica la app (resumen)

- La tasa se captura **anual** y se descuenta con la tasa equivalente del periodo
  (`(1+i_a)^(1/ppy)−1`); la TIR del periodo se anualiza con `(1+r)^ppy−1`. Nunca
  se aplica la tasa anual a un flujo mensual.
- **El veredicto lo decide el VAN** (acepta si es positivo). La **TIR solo
  confirma** cuando el flujo es convencional (un solo cambio de signo); con
  varias raíces se reporta la TIRM.
- El **ROI** ignora el valor del dinero en el tiempo: se muestra como
  complemento, nunca decide solo.
- El **valor de rescate** se suma al último flujo y no se hace crecer; el
  **valor terminal de Gordon** se calcula sobre el flujo operativo. Si se usan
  los dos, la app avisa del doble conteo.

## 4. Formato de las cifras

- Dinero con formato `en-US` y dos decimales: `$1,000,000.00`, `-$12,000.00`.
- Porcentajes y factores con punto decimal: `18.03%`, `3.1250`.
- Solo los ejes de las gráficas usan forma compacta (`$250 k`, `$1.3 M`).

## 5. Estructura del código (para desarrolladores)

| Archivo | Contenido |
| --- | --- |
| `src/App.vue` | Raíz sin navegación: cabecera, `InversionesApp` y pie. |
| `src/components/InversionesApp.vue` | La pantalla completa de la calculadora. Solo orquesta y muestra. |
| `src/components/CampoNumero.vue` | Cajas numéricas formateadas (`$250,000.00`, sin reagrupar mientras se escribe). |
| `src/components/Fraccion.vue` | Fórmulas como fracciones apiladas (numerador/denominador). |
| `src/components/GloboInfo.vue` | Globos de ayuda `?` (textos en `src/lib/explicaciones.js`). |
| `src/lib/inversion.js` | Lógica financiera pura (club de las funciones descritas en §1). |
| `src/lib/formato.js` | Formato `en-US` y reglas de escritura de las cajas. |
| `src/style.css` | Paleta y tema claro/oscuro (se importa después de Bootstrap). |