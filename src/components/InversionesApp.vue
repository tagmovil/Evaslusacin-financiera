<script setup>
// ============================================================================
// InversionesApp.vue — Evaluación de proyectos de inversión (VAN, TIR, TIRM, PRI,
// ROI, IPR, punto de equilibrio, sensibilidad y CMPC/CAPM).
// ----------------------------------------------------------------------------
// Estructura equivalente a la calculadora de referencia (smartpyme_calculadora_
// inversion.html): barra de herramientas, panel de entradas a la izquierda y
// resultados a la derecha (tarjetas de indicadores, veredicto, gráficas SVG y
// tablas de detalle), con la verificación de los cálculos dentro de
// lib/inversion.js (funciones puras testeadas con `npm test`).
//
// Toda la teoría se respeta aquí:
//   - La tasa siempre es ANUAL; los flujos se descuentan con su equivalente por
//     periodo (i_p = (1+i_a)^(1/ppy)-1) y la TIR por periodo se anualiza.
//   - El VAN es el criterio que decide; la TIR solo confirma si es única.
//   - El ROI se muestra como indicador complementario, nunca como decisor.
// ============================================================================
import { ref, computed, watch, onMounted } from 'vue'
import { UNIDADES, evaluarProyecto, cmmpc } from '../lib/inversion'
import { fmtDinero, fmtPct, fmtFactor, fmtEje } from '../lib/formato'
import AYUDA from '../lib/explicaciones'
import GloboInfo from './GloboInfo.vue'
import CampoNumero from './CampoNumero.vue'
import Fraccion from './Fraccion.vue'
// --- Estado -----------------------------------------------------------------
const PERIODO_MIN = 1
const PERIODO_MAX = 60

const EJEMPLO = { inversion: '1000000', tasa: '12', rescate: '150000', crecimiento: '10', flujoU: '260000' }

const inversion = ref(EJEMPLO.inversion)
const tasa = ref(EJEMPLO.tasa) // tasa de descuento ANUAL en %
const rescate = ref(EJEMPLO.rescate)
const crecimiento = ref(EJEMPLO.crecimiento) // crecimiento perpetuo anual en %
const unidad = ref('año')
const periodos = ref(5)
const uniforme = ref(true) // mismo flujo en todos los periodos
const flujoU = ref(EJEMPLO.flujoU)
const flujos = ref([260000, 260000, 260000, 260000, 260000])
const tema = ref('oscuro')

// Panel opcional del costo de capital (CAPM) para justificar la tasa de descuento.
const usarCmmpc = ref(false)
const capm = ref({ rf: '8', beta: '1.2', prima: '14', kd: '10', impuesto: '30', patrimonio: '600000', deuda: '400000' })

const unidadActual = computed(() => UNIDADES.find((u) => u.valor === unidad.value))

// --- Formato ----------------------------------------------------------------
// Las reglas de cifras viven en lib/formato.js (dinero $000,000,000.00,
// porcentajes con punto decimal y ejes compactos); aquí solo se usan.
// Redondea coordenadas del SVG para no pintar 86.00000000000001 en el DOM.
const rd = (v) => Math.round(v * 10) / 10
const nombrePeriodo = (p) => {
  const u = unidadActual.value
  if (p === null || p === undefined || !Number.isFinite(p)) return 'No se recupera'
  const txt = p.toFixed(1)
  return `${txt} ${Math.abs(p - Math.round(p)) < 0.05 ? u.corto : `${u.corto}s`}`
}

// --- Validación (mensajes en español, se muestran en `error`) ---------------
const esNumero = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))
const error = computed(() => {
  if (!esNumero(inversion.value) || Number(inversion.value) < 0) {
    return 'La inversión inicial debe ser un número no negativo.'
  }
  if (!esNumero(tasa.value) || Number(tasa.value) <= -100) {
    return 'La tasa de descuento debe ser un número mayor que -100%.'
  }
  if (!esNumero(crecimiento.value) || Number(crecimiento.value) < 0) {
    return 'El crecimiento perpetuo debe ser un número no negativo.'
  }
  if (!esNumero(rescate.value) || Number(rescate.value) < 0) {
    return 'El valor de rescate debe ser un número no negativo.'
  }
  if (periodos.value < PERIODO_MIN || periodos.value > PERIODO_MAX) {
    return `El número de periodos debe estar entre ${PERIODO_MIN} y ${PERIODO_MAX}.`
  }
  if (uniforme.value) {
    if (!esNumero(flujoU.value)) return 'El flujo por periodo debe ser un número.'
  } else {
    for (let k = 0; k < periodos.value; k++) {
      if (!esNumero(flujos.value[k])) return `El flujo del periodo ${k + 1} debe ser un número.`
    }
  }
  if (usarCmmpc.value) {
    const p = capm.value
    for (const clave of ['rf', 'beta', 'prima', 'kd', 'impuesto', 'patrimonio', 'deuda']) {
      if (!esNumero(p[clave])) return 'Completa los datos del CMPC (CAPM) con números.'
    }
    if (Number(p.patrimonio) + Number(p.deuda) <= 0) {
      return 'El valor del patrimonio y de la deuda debe ser positivo.'
    }
    if (Number(p.impuesto) < 0 || Number(p.impuesto) > 100) {
      return 'La tasa de impuestos debe estar entre 0 y 100.'
    }
  }
  return ''
})

// Clase de color según el signo (verde positivo / rojo negativo) en las tablas.
const clase = (v) => (v >= 0 ? 'pos' : 'neg')

// --- Flujos de la vista -----------------------------------------------------
// Solo los flujos operativos: el valor de rescate lo suma la lib en el último
// periodo (y así el valor terminal de Gordon no crece también el rescate).
const flujosBase = computed(() => {
  const n = periodos.value
  return uniforme.value
    ? new Array(n).fill(Number(flujoU.value) || 0)
    : flujos.value.slice(0, n).map((v) => Number(v) || 0)
})

// --- Cálculo (lógica pura en lib/inversion.js) ------------------------------
const r = computed(() => {
  if (error.value) return null
  try {
    return evaluarProyecto({
      inversion: Number(inversion.value),
      flujos: flujosBase.value,
      tasaAnual: Number(tasa.value) / 100,
      unidad: unidad.value,
      crecimientoAnual: Number(crecimiento.value) / 100,
      rescate: Number(rescate.value) || 0,
    })
  } catch (e) {
    return null
  }
})

const cm = computed(() => {
  if (!usarCmmpc.value) return null
  const p = capm.value
  try {
    return cmmpc({
      tasaLibreRiesgo: Number(p.rf) / 100,
      beta: Number(p.beta),
      primaMercado: Number(p.prima) / 100,
      costoDeuda: Number(p.kd) / 100,
      tasaImpuestos: Number(p.impuesto) / 100,
      valorPatrimonio: Number(p.patrimonio),
      valorDeuda: Number(p.deuda),
    })
  } catch (e) {
    return null
  }
})

// Desglose del CMPC: cada término de la fórmula con los números capturados,
// para que se vea cómo se llega al resultado.
const cmDesglose = computed(() => {
  if (!cm.value) return null
  const p = capm.value
  const rf = Number(p.rf) / 100
  const beta = Number(p.beta)
  const prima = Number(p.prima) / 100
  const kd = Number(p.kd) / 100
  const t = Number(p.impuesto) / 100
  const E = Number(p.patrimonio)
  const D = Number(p.deuda)
  const V = E + D
  const c = cm.value
  return {
    ke: c.ke,
    keFormula: `${fmtPct(rf)} + ${beta} × (${fmtPct(prima)})`,
    kdNeto: c.kdNeto,
    kdNetoFormula: `${fmtPct(kd)} × (1 − ${fmtPct(t)})`,
    E,
    D,
    V,
    wE: c.wE,
    wD: c.wD,
    wEcuenta: `${fmtDinero(E)} / ${fmtDinero(V)}`,
    wDcuenta: `${fmtDinero(D)} / ${fmtDinero(V)}`,
    cmmpc: c.cmmpc,
    cmmpcPasos: `${fmtFactor(c.wE, 2)} × ${fmtPct(c.ke)} + ${fmtFactor(c.wD, 2)} × ${fmtPct(c.kdNeto)}`,
  }
})

// Aviso: la tasa capturada no coincide con el CMPC calculado => la decisión puede cambiar.
const avisoCmmpc = computed(() => {
  if (!cm.value || !r.value) return ''
  const dif = Math.abs(cm.value.cmmpc - Number(tasa.value) / 100)
  if (dif < 0.001) return ''
  return `La tasa de descuento capturada (${fmtPct(Number(tasa.value) / 100)}) no coincide con el CMPC calculado (${fmtPct(
    cm.value.cmmpc
  )}). El veredicto depende de esa tasa: revisa cuál corresponde.`
})

// --- Acciones ---------------------------------------------------------------
// El tema se aplica en <html>: así Bootstrap (data-bs-theme) y la paleta propia
// de style.css cambian a la vez en toda la página.
function aplicarTema() {
  if (typeof document === 'undefined') return
  const raiz = document.documentElement
  raiz.classList.toggle('tema-claro', tema.value === 'claro')
  raiz.setAttribute('data-bs-theme', tema.value === 'claro' ? 'light' : 'dark')
}
function alternarTema() {
  tema.value = tema.value === 'oscuro' ? 'claro' : 'oscuro'
  aplicarTema()
  try {
    localStorage.setItem('sp-inv-tema', tema.value)
  } catch (e) {
    /* sin persistencia: el tema solo vive en memoria */
  }
}
function imprimir() {
  window.print()
}
function cargarEjemplo() {
  inversion.value = EJEMPLO.inversion
  tasa.value = EJEMPLO.tasa
  rescate.value = EJEMPLO.rescate
  crecimiento.value = EJEMPLO.crecimiento
  flujoU.value = EJEMPLO.flujoU
  periodos.value = 5
  unidad.value = 'año'
  uniforme.value = true
  const A = Number(EJEMPLO.flujoU) || 0
  flujos.value = [A, A, A, A, A]
}
function usarCmmpcComoTasa() {
  if (cm.value) tasa.value = (cm.value.cmmpc * 100).toFixed(2)
}
function ajustarPeriodos(delta) {
  const n = periodos.value + delta
  if (n < PERIODO_MIN || n > PERIODO_MAX) return
  periodos.value = n // el watch ajusta el arreglo de flujos manuales
}
// Al cambiar el número de periodos se ajustan también las filas manuales.
watch(periodos, (n) => {
  if (flujos.value.length < n) {
    while (flujos.value.length < n) flujos.value.push(Number(flujoU.value) || 0)
  } else if (flujos.value.length > n) {
    flujos.value = flujos.value.slice(0, n)
  }
})
onMounted(() => {
  try {
    const t = localStorage.getItem('sp-inv-tema')
    if (t === 'claro' || t === 'oscuro') tema.value = t
  } catch (e) {
    /* sin persistencia */
  }
  aplicarTema()
})

// --- Escalas de los ejes Y --------------------------------------------------
// Acota el rango a múltiplos de un paso legible (1, 2, 5 x 10^k) para que las
// etiquetas del eje salgan como "200 k" y no como "182 k".
const pasoLegible = (rango) => {
  const bruto = Math.max(rango, Number.MIN_VALUE) / 2
  const base = Math.pow(10, Math.floor(Math.log10(bruto)))
  const n = bruto / base
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * base
}
const limitesEscala = (min, max) => {
  if (min === max) {
    min -= 1
    max += 1
  }
  const paso = pasoLegible(max - min)
  return { min: Math.floor(min / paso) * paso, max: Math.ceil(max / paso) * paso }
}

// --- Gráfica 1: flujo de caja acumulado -------------------------------------
// Eje X = periodos (0 = inversión), eje Y = dinero acumulado. Se dibujan las dos
// series: sin descontar y descontada, con la línea del cero y la marca del PRI.
const grafAcum = computed(() => {
  if (!r.value) return null
  const W = 660
  const H = 270
  const padL = 72
  const padR = 18
  const padT = 14
  const padB = 40
  const filas = r.value.filas
  const n = filas.length
  const inv = r.value.inversion
  const serieN = [-inv, ...filas.map((f) => f.acum)]
  const serieD = [-inv, ...filas.map((f) => f.acumDisc)]
  const todos = [...serieN, ...serieD, 0]
  const { min, max } = limitesEscala(Math.min(...todos), Math.max(...todos))
  const ancho = W - padL - padR
  const alto = H - padT - padB
  const X = (i) => padL + (ancho * i) / n
  const Y = (v) => padT + alto * (1 - (v - min) / (max - min))
  const linea = (serie) => serie.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const paso = n > 18 ? 2 : 1
  const etiquetasX = []
  for (let i = 0; i <= n; i++) {
    if (i % paso === 0 || i === n) etiquetasX.push({ i, x: X(i), txt: String(i) })
  }
  const pri = r.value.pri
  return {
    W,
    H,
    padL,
    ancho,
    puntosN: linea(serieN),
    puntosD: linea(serieD),
    nodosN: serieN.map((v, i) => ({ x: rd(X(i)), y: rd(Y(v)) })),
    nodosD: serieD.map((v, i) => ({ x: rd(X(i)), y: rd(Y(v)) })),
    ceroY: rd(Y(0)),
    ticksY: [max, 0, min].map((v) => ({ y: rd(Y(v)), txt: fmtEje(v) })),
    etiquetasX: etiquetasX.map((e) => ({ x: rd(e.x), txt: e.txt })),
    n,
    // Marca del periodo de recuperación (interpolado): puede caer entre periodos.
    pri: pri.recupera ? { x: rd(X(pri.periodos)), y: rd(Y(0)), txt: nombrePeriodo(pri.periodos) } : null,
  }
})

// --- Gráfica 2: perfil del VAN ---------------------------------------------
// Eje X = tasa de descuento anual, eje Y = VAN. La curva cruza el cero en la TIR:
// por eso el VAN (y no la TIR) es el criterio válido para comparar proyectos.
const grafPerfil = computed(() => {
  if (!r.value) return null
  const W = 660
  const H = 250
  const padL = 72
  const padR = 18
  const padT = 14
  const padB = 36
  const puntos = r.value.perfil
  const maxTasa = puntos[puntos.length - 1].tasa
  const valores = puntos.map((p) => p.van)
  const { min, max } = limitesEscala(Math.min(...valores, 0), Math.max(...valores, 0))
  const ancho = W - padL - padR
  const alto = H - padT - padB
  const X = (t) => padL + (ancho * t) / maxTasa
  const Y = (v) => padT + alto * (1 - (v - min) / (max - min))
  const path = puntos.map((p) => `${X(p.tasa).toFixed(1)},${Y(p.van).toFixed(1)}`).join(' ')
  const ticksX = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    x: X(maxTasa * f),
    txt: fmtPct(maxTasa * f, 0),
  }))
  const tir = r.value.tirAnual
  const enRango = tir !== null && tir >= 0 && tir <= maxTasa
  return {
    W,
    H,
    padL,
    ancho,
    path,
    ceroY: rd(Y(0)),
    ticksY: [max, 0, min].map((v) => ({ y: rd(Y(v)), txt: fmtEje(v) })),
    ticksX: ticksX.map((t) => ({ x: rd(t.x), txt: t.txt })),
    actual: {
      x: rd(X(r.value.tasaAnual)),
      y: rd(Y(r.value.van)),
      txt: `Tasa ${fmtPct(r.value.tasaAnual)}`,
    },
    tir: enRango ? { x: rd(X(tir)), y: rd(Y(0)), txt: `TIR ${fmtPct(tir)}` } : null,
  }
})

// --- Indicadores secundarios (tarjetas) ------------------------------------
// `globo` apunta a la clave del diccionario de explicaciones: cada tarjeta
// lleva su propio globo informativo con el significado del indicador.
const kpis = computed(() => {
  if (!r.value) return []
  const v = r.value
  const corto = unidadActual.value.corto
  return [
    {
      etiqueta: 'VAN',
      valor: fmtDinero(v.van),
      clase: v.van >= 0 ? 'ok' : 'mal',
      nota: 'valor actual neto',
      globo: AYUDA.van,
    },
    {
      etiqueta: 'TIR',
      valor: v.tir.multiple ? 'Múltiple' : fmtPct(v.tirAnual),
      clase: v.aceptaPorTir === false ? 'mal' : v.aceptaPorTir ? 'ok' : 'alerta',
      nota: v.tir.multiple ? 'flujo no convencional' : 'tasa interna de retorno',
      globo: AYUDA.tir,
    },
    {
      etiqueta: 'Recuperación',
      valor: nombrePeriodo(v.pri.periodos),
      clase: v.pri.recupera ? 'ok' : 'mal',
      nota: `descuentado: ${nombrePeriodo(v.priDesc.periodos)}`,
      globo: AYUDA.pri,
    },
    {
      etiqueta: 'ROI',
      valor: fmtPct(v.roi),
      clase: (v.roi ?? 0) >= 0 ? 'ok' : 'mal',
      nota: 'retorno sobre inversión',
      globo: AYUDA.roi,
    },
    {
      etiqueta: 'TIRM',
      valor: fmtPct(v.tirm),
      clase: 'neutro',
      nota: 'TIR modificada (si el flujo no es convencional)',
      globo: AYUDA.tirm,
    },
    {
      etiqueta: 'IPR',
      valor: v.ipr === null ? 'N/D' : v.ipr.toFixed(3),
      clase: 'neutro',
      nota: 'índice de rentabilidad (VAF/inversión)',
      globo: AYUDA.ipr,
    },
    {
      etiqueta: 'Flujo nivelado',
      valor: fmtDinero(v.nivelado),
      clase: 'neutro',
      nota: `renta equivalente por ${corto}`,
      globo: AYUDA.nivelado,
    },
    {
      etiqueta: 'Margen',
      valor: fmtPct(v.equilibrio.margenSeguridad),
      clase: (v.equilibrio.margenSeguridad ?? 0) >= 0 ? 'ok' : 'mal',
      nota: 'holgura del VAN sobre la inversión',
      globo: AYUDA.margen,
    },
  ]
})

// Glosario desplegable del pie: de siglas a significado.
const glosario = computed(() => {
  if (!r.value) return []
  const v = r.value
  return [
    ['VAN', 'Valor actual neto: flujos descontados menos la inversión.'],
    ['TIR', 'Tasa interna de retorno: tasa que anula el VAN.'],
    ['TIRM', 'TIR modificada, válida con flujos no convencionales.'],
    ['PRI', 'Periodo de recuperación de la inversión.'],
    ['ROI', 'Retorno sobre la inversión, sin considerar el tiempo.'],
    ['VAF', 'Valor actual de los flujos (sin restar la inversión).'],
    ['IPR', 'Índice de rentabilidad: VAF ÷ inversión.'],
    ['CMPC', 'Costo promedio ponderado de capital (WACC).'],
    ['ppy', 'Periodos por año: cuántos flujos hay en un año.'],
    ['p.p.', 'Puntos porcentuales: variación de una tasa.'],
  ]
})

const otrasMetricas = computed(() => {
  if (!r.value) return []
  const v = r.value
  return [
    ['Tasa aplicada al periodo', `${fmtPct(v.tasaPeriodo, 4)} por ${unidadActual.value.corto}`],
    ['Valor presente de los flujos (VAF)', fmtDinero(v.equilibrio.inversionMaxima)],
    ['Suma de los flujos (sin descontar)', fmtDinero(v.sumaFlujos)],
    ['Ganancia neta nominal', fmtDinero(v.gananciaNeta)],
    ['TIR por periodo', fmtPct(v.tir.valor, 4)],
    ['TIR anual equivalente', v.tir.multiple ? `Múltiples: ${v.tirAnuales.map((x) => fmtPct(x)).join(' / ')}` : fmtPct(v.tirAnual)],
    ['Tasa de financiamiento (TIRM)', fmtPct(v.tasaFin, 4)],
    ['Tasa de reinversión (TIRM)', fmtPct(v.tasaReinv, 4)],
    ['Valor terminal (Gordon)', v.valorTerminal === null ? 'No aplica' : fmtDinero(v.valorTerminal)],
    ['Inversión máxima tolerable', fmtDinero(v.equilibrio.inversionMaxima)],
    ['Flujo crítico de equilibrio', fmtDinero(v.equilibrio.flujoCritico)],
    ['Tasa de rotura del proyecto (TIR)', v.tir.multiple ? 'No única' : fmtPct(v.tirAnual)],
  ]
})
</script>

<template>
  <div class="inv">
    <!-- ============ Barra de herramientas ============ -->
    <div class="inv-barra d-flex flex-wrap justify-content-between align-items-center gap-2">
      <div class="inv-marca">
        <b>Inversiones</b>
        <span>Evaluación de proyectos por VAN, TIR y punto de equilibrio</span>
      </div>
      <div class="inv-acciones d-flex flex-wrap gap-2">
        <button class="btn btn-sm btn-outline-light" type="button" @click="imprimir">Exportar / imprimir</button>
        <button class="btn btn-sm btn-outline-light" type="button" @click="alternarTema">
          {{ tema === 'oscuro' ? 'Tema claro' : 'Tema oscuro' }}
        </button>
      </div>
    </div>

    <div class="inv-hero">
      <h2>Calculadora de beneficios de inversión</h2>
      <p>
        Captura la inversión y los flujos esperados de un programa y obtén el VAN, la TIR, el periodo de
        recuperación y el ROI, verificados con la teoría financiera: la tasa anual se convierte a la tasa
        equivalente de cada periodo, la TIR solo decide si es única y el veredicto lo da el VAN.
      </p>
    </div>

    <!-- Rejilla de Bootstrap: una columna en móvil, dos desde lg. -->
    <div class="row g-4">
      <!-- ================= ENTRADAS ================= -->
      <div class="col-12 col-lg-5 col-xl-4">
        <div class="d-grid gap-3">
        <div class="formulario">
          <h3>Datos del programa</h3>
          <p class="intro">Lo que se invierte y lo que se espera recuperar.</p>

          <div class="inv-campo">
            <label for="inv" class="form-label d-flex align-items-center gap-2">
              Inversión inicial
              <GloboInfo :ayuda="AYUDA.eInversion" />
            </label>
            <div class="inv-input">
              <CampoNumero id="inv" v-model="inversion" prefijo="$" :decimales="2" :negativo="false" />
            </div>
          </div>

          <div class="inv-campo">
            <label for="tasa" class="form-label d-flex align-items-center gap-2">
              Tasa de descuento anual (costo de capital)
              <GloboInfo :ayuda="AYUDA.eTasa" />
            </label>
            <div class="inv-input">
              <CampoNumero id="tasa" v-model="tasa" :decimales="2" sufijo />
              <span class="suf">% anual</span>
            </div>
            <p class="inv-nota">
              Rendimiento mínimo que le exiges al programa. Con la tasa del periodo:
              <b>{{ r ? fmtPct(r.tasaPeriodo, 4) : '—' }}</b> por {{ unidadActual.corto }}.
            </p>
          </div>

          <div class="inv-campo">
            <label class="form-label d-flex align-items-center gap-2">
              Unidad del periodo
              <GloboInfo :ayuda="AYUDA.eUnidad" />
            </label>
            <div class="inv-seg" role="group" aria-label="Unidad del periodo">
              <button
                v-for="u in UNIDADES"
                :key="u.valor"
                type="button"
                :aria-pressed="unidad === u.valor"
                :class="{ activo: unidad === u.valor }"
                @click="unidad = u.valor"
              >
                Por {{ u.corto }}
              </button>
            </div>
          </div>

          <div class="inv-campo">
            <label for="np" class="form-label d-flex align-items-center gap-2">
              Número de periodos
              <GloboInfo :ayuda="AYUDA.ePeriodos" etiqueta="i" />
            </label>
            <div class="inv-stepper">
              <button type="button" aria-label="Restar periodo" @click="ajustarPeriodos(-1)">−</button>
              <span class="n">{{ periodos }}</span>
              <button type="button" aria-label="Agregar periodo" @click="ajustarPeriodos(1)">+</button>
            </div>
            <p class="inv-nota">
              Horizonte de {{ periodos }} {{ periodos === 1 ? unidadActual.corto : `${unidadActual.corto}s` }}.
            </p>
          </div>

          <div class="inv-campo">
            <label for="rescate" class="form-label d-flex align-items-center gap-2">
              Valor de rescate al final (opcional)
              <GloboInfo :ayuda="AYUDA.eRescate" />
            </label>
            <div class="inv-input">
              <CampoNumero id="rescate" v-model="rescate" prefijo="$" :decimales="2" :negativo="false" />
            </div>
            <p class="inv-nota">Se suma al flujo del último periodo y se descuenta como cualquier otro flujo.</p>
          </div>

          <div class="inv-campo">
            <label for="crec" class="form-label d-flex align-items-center gap-2">
              Crecimiento perpetuo del último flujo (opcional)
              <GloboInfo :ayuda="AYUDA.eCrecimiento" />
            </label>
            <div class="inv-input">
              <CampoNumero id="crec" v-model="crecimiento" :decimales="2" :negativo="false" sufijo />
              <span class="suf">% anual</span>
            </div>
            <p class="inv-nota">
              Modelo de Gordon: VT = último flujo operativo × (1+g) ÷ (i−g). Solo aplica si la tasa supera al
              crecimiento, y el rescate no se hace crecer (usa uno u otro, no los dos).
            </p>
          </div>
        </div>

        <div class="formulario">
          <div class="form-check form-switch">
            <input id="uniforme" v-model="uniforme" class="form-check-input" type="checkbox" role="switch">
            <label class="form-check-label" for="uniforme">Mismo flujo cada periodo</label>
          </div>
          <p class="inv-nota">Desactívalo cuando los flujos varien (mantenimientos, incrementos, estacionalidad).</p>

          <div v-if="uniforme" class="inv-campo">
            <label for="flujoU" class="form-label d-flex align-items-center gap-2">
              Flujo neto por periodo
              <GloboInfo :ayuda="AYUDA.eFlujo" />
            </label>
            <div class="inv-input">
              <CampoNumero id="flujoU" v-model="flujoU" prefijo="$" :decimales="2" />
            </div>
            <p class="inv-nota">Ingresos menos costos del programa en cada periodo.</p>
          </div>

          <div v-else class="inv-flujos">
            <p class="inv-nota d-flex align-items-center gap-2">
              Un flujo por periodo, en la unidad elegida
              <GloboInfo :ayuda="AYUDA.eFlujos" />
            </p>
            <div v-for="(f, k) in flujos.slice(0, periodos)" :key="k" class="inv-flujo">
              <span class="idx">{{ k + 1 }}.</span>
              <div class="inv-input">
                <CampoNumero
                  v-model="flujos[k]"
                  prefijo="$"
                  :decimales="2"
                  pequeno
                  :aria-label="`Flujo del periodo ${k + 1}`"
                />
              </div>
            </div>
            <p class="inv-nota">
              Flujos netos por periodo. Admiten valores negativos (etapas de inversión o pérdidas
              operativas): en ese caso la TIR puede no ser concluyente.
            </p>          </div>

          <div class="inv-acciones">
            <button class="btn btn-sm btn-outline-secondary" type="button" @click="cargarEjemplo">Cargar ejemplo</button>
          </div>
        </div>

        <div class="formulario">
          <div class="form-check form-switch">
            <input id="usarCmmpc" v-model="usarCmmpc" class="form-check-input" type="checkbox" role="switch">
            <label class="form-check-label" for="usarCmmpc">Calcular el CMPC (CAPM)</label>
            <GloboInfo :ayuda="AYUDA.eCmmpc" />
          </div>
          <p class="inv-nota">
            ke = Rf + β(Rm − Rf); CMPC = (E/V)·ke + (D/V)·kd·(1 − impuesto). Sirve para justificar la tasa
            de descuento del programa.
          </p>

          <div v-if="usarCmmpc" class="inv-cmmpc">
            <div class="inv-cmmpc-bloque">
              <p class="inv-cmmpc-titulo">CAPM · Costo del patrimonio (ke)</p>
              <div class="row row-cols-1 row-cols-sm-3 g-2">
                <div class="col">
                  <div class="inv-mini">
                    <label for="rf" class="form-label d-flex align-items-center gap-2">
                      Tasa libre de riesgo (%)
                      <GloboInfo :ayuda="AYUDA.cmmpcRf" etiqueta="i" />
                    </label>
                    <CampoNumero id="rf" v-model="capm.rf" :decimales="2" pequeno />
                  </div>
                </div>
                <div class="col">
                  <div class="inv-mini">
                    <label for="beta" class="form-label d-flex align-items-center gap-2">
                      Beta (β)
                      <GloboInfo :ayuda="AYUDA.cmmpcBeta" etiqueta="i" />
                    </label>
                    <CampoNumero id="beta" v-model="capm.beta" :decimales="2" pequeno />
                  </div>
                </div>
                <div class="col">
                  <div class="inv-mini">
                    <label for="prima" class="form-label d-flex align-items-center gap-2">
                      Prima de mercado (%)
                      <GloboInfo :ayuda="AYUDA.cmmpcPrima" etiqueta="i" />
                    </label>
                    <CampoNumero id="prima" v-model="capm.prima" :decimales="2" pequeno />
                  </div>
                </div>
              </div>
            </div>

            <div class="inv-cmmpc-bloque">
              <p class="inv-cmmpc-titulo">Estructura de capital (E / D)</p>
              <div class="row row-cols-2 row-cols-lg-4 g-2">
                <div class="col">
                  <div class="inv-mini">
                    <label for="patrimonio" class="form-label d-flex align-items-center gap-2">
                      Patrimonio (E)
                      <GloboInfo :ayuda="AYUDA.cmmpcPatrimonio" etiqueta="i" />
                    </label>
                    <CampoNumero id="patrimonio" v-model="capm.patrimonio" prefijo="$" :decimales="2" pequeno :negativo="false" />
                  </div>
                </div>
                <div class="col">
                  <div class="inv-mini">
                    <label for="deuda" class="form-label d-flex align-items-center gap-2">
                      Deuda (D)
                      <GloboInfo :ayuda="AYUDA.cmmpcDeuda" etiqueta="i" />
                    </label>
                    <CampoNumero id="deuda" v-model="capm.deuda" prefijo="$" :decimales="2" pequeno :negativo="false" />
                  </div>
                </div>
                <div class="col">
                  <div class="inv-mini">
                    <label for="kd" class="form-label d-flex align-items-center gap-2">
                      Costo de deuda (%)
                      <GloboInfo :ayuda="AYUDA.cmmpcKd" etiqueta="i" />
                    </label>
                    <CampoNumero id="kd" v-model="capm.kd" :decimales="2" pequeno />
                  </div>
                </div>
                <div class="col">
                  <div class="inv-mini">
                    <label for="impuesto" class="form-label d-flex align-items-center gap-2">
                      Impuestos (%)
                      <GloboInfo :ayuda="AYUDA.cmmpcImpuesto" etiqueta="i" />
                    </label>
                    <CampoNumero id="impuesto" v-model="capm.impuesto" :decimales="2" pequeno />
                  </div>
                </div>
              </div>
            </div>

            <div v-if="cmDesglose" class="inv-cmmpc-bloque">
              <p class="inv-cmmpc-titulo">Resultados del CMPC</p>
              <div class="cm-desglose">
                <div class="cm-card">
                  <span class="cm-card-titulo">
                    ke por CAPM
                    <GloboInfo :ayuda="AYUDA.cmmpcKe" />
                  </span>
                  <span class="cm-card-formula">ke = Rf + β(Rm − Rf)</span>
                  <span class="cm-card-cuenta">{{ cmDesglose.keFormula }}</span>
                  <span class="cm-card-valor">{{ fmtPct(cmDesglose.ke) }}</span>
                </div>
                <div class="cm-card">
                  <span class="cm-card-titulo">
                    Deuda neta de impuestos
                    <GloboInfo :ayuda="AYUDA.cmmpcKdNeto" />
                  </span>
                  <span class="cm-card-formula">kd · (1 − impuesto)</span>
                  <span class="cm-card-cuenta">{{ cmDesglose.kdNetoFormula }}</span>
                  <span class="cm-card-valor">{{ fmtPct(cmDesglose.kdNeto) }}</span>
                </div>
                <div class="cm-card">
                  <span class="cm-card-titulo">
                    Peso del patrimonio (E / V)
                    <GloboInfo :ayuda="AYUDA.cmmpcEV" />
                  </span>
                  <span class="cm-card-formula">
                    wE =
                    <Fraccion parentesis><template #num>E</template><template #den>E + D</template></Fraccion>
                  </span>
                  <span class="cm-card-cuenta">{{ cmDesglose.wEcuenta }}</span>
                  <span class="cm-card-valor">{{ fmtPct(cmDesglose.wE, 1) }}</span>
                </div>
                <div class="cm-card">
                  <span class="cm-card-titulo">Peso de la deuda (D / V)</span>
                  <span class="cm-card-formula">
                    wD =
                    <Fraccion parentesis><template #num>D</template><template #den>E + D</template></Fraccion>
                  </span>
                  <span class="cm-card-cuenta">{{ cmDesglose.wDcuenta }}</span>
                  <span class="cm-card-valor">{{ fmtPct(cmDesglose.wD, 1) }}</span>
                </div>
                <div class="cm-card cm-card-total">
                  <span class="cm-card-titulo">
                    CMPC (WACC)
                    <GloboInfo :ayuda="AYUDA.cmmpcTotal" />
                  </span>
                  <span class="cm-card-formula">CMPC = wE·ke + wD·kd(1 − impuesto)</span>
                  <span class="cm-card-cuenta">{{ cmDesglose.cmmpcPasos }}</span>
                  <span class="cm-card-valor">{{ fmtPct(cmDesglose.cmmpc) }}</span>
                </div>
              </div>

              <div class="inv-acciones">
                <button class="btn btn-sm btn-primary" type="button" @click="usarCmmpcComoTasa">
                  Usar el CMPC ({{ fmtPct(cmDesglose.cmmpc) }}) como tasa de descuento
                </button>
              </div>
            </div>
            <p v-if="avisoCmmpc" class="aviso">{{ avisoCmmpc }}</p>
          </div>
          </div>
        </div>
        </div>

      <!-- ================= RESULTADOS ================= -->
      <div class="col-12 col-lg-7 col-xl-8">
        <div class="d-grid gap-3">
        <p v-if="error" class="error">{{ error }}</p>

        <template v-if="r">
          <div class="resultado">
            <h3>Resultado</h3>
            <p class="intro">Con los datos capturados.</p>

            <!-- KPI: 2 columnas en móvil, 4 desde md. Cada tarjeta trae su globo. -->
            <div class="row row-cols-2 row-cols-md-4 g-2 mt-1">
              <div v-for="k in kpis" :key="k.etiqueta" class="col">
                <div class="inv-kpi h-100">
                  <span class="lbl d-flex align-items-center gap-2">
                    {{ k.etiqueta }}
                    <GloboInfo :ayuda="k.globo" />
                  </span>
                  <span class="val" :class="k.clase">{{ k.valor }}</span>
                  <span class="sub">{{ k.nota }}</span>
                </div>
              </div>
            </div>

            <div class="inv-veredicto" :class="r.veredicto">
              <b class="d-flex align-items-center gap-2">
                {{ r.veredicto === 'good' ? 'Conviene invertir' : r.veredicto === 'bad' ? 'No conviene, con estos supuestos' : 'Revisa los supuestos' }}
                <GloboInfo :ayuda="AYUDA.veredicto" />
              </b>
              <p>{{ r.veredictoTexto }}</p>
            </div>

            <p v-for="(a, k) in r.advertencias" :key="k" class="aviso">{{ a }}</p>
          </div>

          <div class="resultado">
            <h3 class="d-flex align-items-center gap-2">
              Flujo de caja acumulado
              <GloboInfo :ayuda="AYUDA.graficaAcum" />
            </h3>
            <p class="intro">Cuándo se recupera la inversión. El cruce del cero es el periodo de recuperación.</p>
            <div v-if="grafAcum" class="inv-graf">
              <svg :viewBox="`0 0 ${grafAcum.W} ${grafAcum.H}`" role="img" aria-label="Gráfica del flujo de caja acumulado">
                <line
                  :x1="grafAcum.padL"
                  :y1="grafAcum.ceroY"
                  :x2="grafAcum.padL + grafAcum.ancho"
                  :y2="grafAcum.ceroY"
                  class="inv-eje-cero"
                />
                <text
                  v-for="(t, k) in grafAcum.ticksY"
                  :key="`ty${k}`"
                  :x="grafAcum.padL - 8"
                  :y="t.y + 4"
                  class="inv-txt-eje"
                  text-anchor="end"
                >
                  {{ t.txt }}
                </text>
                <text
                  v-for="(t, k) in grafAcum.etiquetasX"
                  :key="`tx${k}`"
                  :x="t.x"
                  :y="grafAcum.H - 20"
                  class="inv-txt-eje"
                  text-anchor="middle"
                >
                  {{ t.txt }}
                </text>
                <text :x="grafAcum.padL + grafAcum.ancho / 2" :y="grafAcum.H - 5" class="inv-txt-eje" text-anchor="middle">{{ `Periodo (${unidadActual.corto})` }}</text>
                <template v-if="grafAcum.pri">
                  <line
                    :x1="grafAcum.pri.x"
                    :y1="grafAcum.pri.y - 8"
                    :x2="grafAcum.pri.x"
                    :y2="12"
                    class="inv-marca-pri"
                  />
                  <circle :cx="grafAcum.pri.x" :cy="grafAcum.pri.y" r="5" class="inv-punto-pri" />
                  <text :x="grafAcum.pri.x" :y="grafAcum.pri.y - 12" class="inv-txt-pri" text-anchor="middle">
                    PRI {{ grafAcum.pri.txt }}
                  </text>
                </template>
                <polyline :points="grafAcum.puntosN" class="inv-linea inv-linea-nominal" />
                <polyline :points="grafAcum.puntosD" class="inv-linea inv-linea-desc" />
                <circle v-for="(p, k) in grafAcum.nodosN" :key="`nn${k}`" :cx="p.x" :cy="p.y" r="3" class="inv-nodo inv-nodo-nominal" />
                <circle v-for="(p, k) in grafAcum.nodosD" :key="`nd${k}`" :cx="p.x" :cy="p.y" r="3" class="inv-nodo inv-nodo-desc" />
              </svg>
            </div>
            <div class="inv-leyenda d-flex flex-wrap gap-3">
              <span><i class="nominal" /> Acumulado sin descontar</span>
              <span><i class="desc" /> Acumulado descontado</span>
              <span><i class="pri" /> Recuperación de la inversión (PRI)</span>
            </div>
          </div>

          <div class="resultado">
            <h3 class="d-flex align-items-center gap-2">
              Perfil del VAN
              <GloboInfo :ayuda="AYUDA.graficaPerfil" />
            </h3>
            <p class="intro">
              El VAN frente a la tasa de descuento anual. Cruza el cero exactamente en la TIR: por eso el
              VAN es el criterio válido para comparar proyectos y la TIR solo sirve como confirmación.
            </p>
            <div v-if="grafPerfil" class="inv-graf">
              <svg :viewBox="`0 0 ${grafPerfil.W} ${grafPerfil.H}`" role="img" aria-label="Perfil del valor actual neto">
                <line
                  :x1="grafPerfil.padL"
                  :y1="grafPerfil.ceroY"
                  :x2="grafPerfil.padL + grafPerfil.ancho"
                  :y2="grafPerfil.ceroY"
                  class="inv-eje-cero"
                />
                <text
                  v-for="(t, k) in grafPerfil.ticksY"
                  :key="`py${k}`"
                  :x="grafPerfil.padL - 8"
                  :y="t.y + 4"
                  class="inv-txt-eje"
                  text-anchor="end"
                >
                  {{ t.txt }}
                </text>
                <text
                  v-for="(t, k) in grafPerfil.ticksX"
                  :key="`px${k}`"
                  :x="t.x"
                  :y="grafPerfil.H - 18"
                  class="inv-txt-eje"
                  text-anchor="middle"
                >
                  {{ t.txt }}
                </text>
                <text :x="grafPerfil.padL + grafPerfil.ancho / 2" :y="grafPerfil.H - 4" class="inv-txt-eje" text-anchor="middle">Tasa de descuento anual</text>
                <polyline :points="grafPerfil.path" class="inv-linea inv-linea-perfil" />
                <line
                  :x1="grafPerfil.actual.x"
                  :y1="grafPerfil.actual.y"
                  :x2="grafPerfil.actual.x"
                  :y2="12"
                  class="inv-marca-actual"
                />
                <circle :cx="grafPerfil.actual.x" :cy="grafPerfil.actual.y" r="5" class="inv-punto-actual" />
                <text :x="grafPerfil.actual.x" :y="grafPerfil.actual.y + 16" class="inv-txt-actual" text-anchor="middle">
                  {{ grafPerfil.actual.txt }} · VAN {{ fmtDinero(r.van) }}
                </text>
                <template v-if="grafPerfil.tir">
                  <line :x1="grafPerfil.tir.x" :y1="grafPerfil.tir.y" :x2="grafPerfil.tir.x" :y2="12" class="inv-marca-tir" />
                  <circle :cx="grafPerfil.tir.x" :cy="grafPerfil.tir.y" r="4" class="inv-punto-tir" />
                  <text :x="grafPerfil.tir.x" :y="grafPerfil.tir.y - 9" class="inv-txt-tir" text-anchor="middle">
                    {{ grafPerfil.tir.txt }}
                  </text>
                </template>
              </svg>
            </div>
          </div>

          <div class="resultado">
            <h3 class="d-flex align-items-center gap-2">
              Detalle por periodo
              <GloboInfo :ayuda="AYUDA.tablaPeriodos" />
            </h3>
            <p class="tabla-nota">
              <strong>Factor</strong> =
              <Fraccion parentesis><template #num>1</template><template #den>(1 + i)<sup>t</sup></template></Fraccion>
              con la tasa del periodo ·
              <strong>Valor presente</strong> = flujo × factor ·
              <strong>VAN acumulado</strong> = suma de los valores presentes menos la inversión (termina en el VAN) ·
              <strong>Acumulado</strong> = flujos sin descontar desde el periodo 0 (su cruce en cero es el PRI).
            </p>
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th>Flujo neto</th>
                    <th>Factor</th>
                    <th>Valor presente</th>
                    <th>VAN acumulado</th>
                    <th>Acumulado</th>
                    <th>Acum. descontado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>0</td>
                    <td :class="clase(-r.inversion)">{{ fmtDinero(-r.inversion) }}</td>
                    <td>1.0000</td>
                    <td :class="clase(-r.inversion)">{{ fmtDinero(-r.inversion) }}</td>
                    <td :class="clase(-r.inversion)">{{ fmtDinero(-r.inversion) }}</td>
                    <td :class="clase(-r.inversion)">{{ fmtDinero(-r.inversion) }}</td>
                    <td :class="clase(-r.inversion)">{{ fmtDinero(-r.inversion) }}</td>
                  </tr>
                  <tr
                    v-for="f in r.filas"
                    :key="f.periodo"
                    :class="{ 'inv-fila-vt': f.periodo === r.filas.length && r.valorTerminal !== null }"
                  >
                    <td>{{ f.periodo }}</td>
                    <td :class="clase(f.flujo)">{{ fmtDinero(f.flujo) }}</td>
                    <td>{{ fmtFactor(f.factor) }}</td>
                    <td :class="clase(f.vp)">{{ fmtDinero(f.vp) }}</td>
                    <td :class="clase(f.vanAcum)">{{ fmtDinero(f.vanAcum) }}</td>
                    <td :class="clase(f.acum)">{{ fmtDinero(f.acum) }}</td>
                    <td :class="clase(f.acumDisc)">{{ fmtDinero(f.acumDisc) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="r.valorTerminal !== null" class="tabla-nota d-flex align-items-start gap-2">
              <span>
                La última fila incluye el valor terminal de Gordon ({{ fmtDinero(r.valorTerminal) }}).
              </span>
              <GloboInfo :ayuda="AYUDA.valorTerminal" />
            </p>
          </div>

          <div class="resultado">
            <h3 class="d-flex align-items-center gap-2">
              Otras métricas
              <GloboInfo :ayuda="AYUDA.otrasMetricas" />
            </h3>
            <p class="tabla-nota">
              <strong>VAF</strong> = valor presente de los flujos ·
              <strong>IPR</strong> =
              <Fraccion parentesis><template #num>VAF</template><template #den>inversión</template></Fraccion>
              (&gt;1 equivale a VAN&gt;0) ·
              <strong>flujo nivelado</strong> =
              <Fraccion parentesis><template #num>VAN</template><template #den>a(n, i)</template></Fraccion> ·
              <strong>inversión máxima tolerable</strong> = VAF ·
              <strong>flujo crítico</strong> =
              <Fraccion parentesis><template #num>inversión</template><template #den>a(n, i)</template></Fraccion>.
            </p>
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="[nombre, valor] in otrasMetricas" :key="nombre">
                    <td>{{ nombre }}</td>
                    <td>{{ valor }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="resultado">
            <h3 class="d-flex align-items-center gap-2">
              Glosario
              <GloboInfo :ayuda="AYUDA.glosario" />
            </h3>
            <details class="inv-detalle">
              <summary class="btn btn-sm btn-outline-secondary">Ver siglas y su significado</summary>
              <dl class="inv-glosario">
                <template v-for="[sigla, texto] in glosario" :key="sigla">
                  <dt>{{ sigla }}</dt>
                  <dd>{{ texto }}</dd>
                </template>
              </dl>
            </details>
          </div>

          <div class="resultado">
            <h3 class="d-flex align-items-center gap-2">
              Sensibilidad del VAN
              <GloboInfo :ayuda="AYUDA.sensibilidad" />
            </h3>
            <p class="tabla-nota">
              Se varía un factor a la vez manteniendo los demás: el proyecto sigue siendo aceptable mientras el
              VAN sea positivo. Sirve para medir qué supuesto es el crítico.
            </p>
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Escenario</th>
                    <th>VAN</th>
                    <th>Decisión</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(s, k) in r.sensibilidad" :key="k" :class="{ 'inv-fila-rechazo': !s.acepta }">
                    <td>{{ s.variable }}</td>
                    <td>{{ s.escenario }}</td>
                    <td :class="clase(s.van)">{{ fmtDinero(s.van) }}</td>
                    <td :class="s.acepta ? 'pos' : 'neg'">{{ s.acepta ? 'Acepta' : 'Rechaza' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="resultado">
            <h3 class="d-flex align-items-center gap-2">
              Supuestos y fórmulas
              <GloboInfo :ayuda="AYUDA.supuestos" />
            </h3>
            <p class="tabla-nota">
              i es la tasa del <strong>periodo</strong>, no la anual: los flujos se descuentan con i y la TIR del
              periodo se anualiza al final. <strong>ppy</strong> = periodos por año, <strong>n</strong> = número de
              periodos, <strong>ACUM</strong> = acumulado sin descontar. Toca cualquier fórmula para desplegar de dónde
              salen sus datos.
            </p>
            <div class="inv-formulas">
              <details class="inv-formula">
                <summary>
                  <span class="inv-formula-nombre">Tasa del periodo</span>
                  <span class="inv-formula-cuerpo">
                    i = (1 + i<sub>anual</sub>)<sup><Fraccion angosto><template #num>1</template><template #den>ppy</template></Fraccion></sup> − 1
                  </span>
                </summary>
                <p class="inv-formula-texto">
                  <strong>De dónde sale:</strong> del campo «Tasa anual» y de la unidad elegida en «Periodo por». Con
                  esa i se descuentan todos los flujos de la tabla.
                </p>
                <ul class="inv-partes">
                  <li><b>i</b> = interés (tasa) del <b>periodo</b>: el precio del dinero de cada periodo.</li>
                  <li><b>i<sub>anual</sub></b> = la «Tasa anual» que capturaste.</li>
                  <li><b>ppy</b> = periodos por año según «Periodo por» (mensual 12, bimestral 6, trimestral 4, anual 1).</li>
                  <li>El <sup><Fraccion angosto><template #num>1</template><template #den>ppy</template></Fraccion></sup>
                    es una raíz: la tasa del periodo <b>no</b> es la anual partida entre ppy, es su equivalencia
                    compuesta.</li>
                </ul>
              </details>
              <details class="inv-formula">
                <summary>
                  <span class="inv-formula-nombre">TIR anualizada</span>
                  <span class="inv-formula-cuerpo">
                    TIR<sub>anual</sub> = (1 + r)<sup>ppy</sup> − 1
                  </span>
                </summary>
                <p class="inv-formula-texto">
                  <strong>De dónde sale:</strong> la TIR del periodo se busca con los flujos capturados y después se
                  anualiza. Solo decide si el flujo es convencional (un solo cambio de signo); si no, se reporta la TIRM.
                </p>
                <ul class="inv-partes">
                  <li><b>TIR<sub>anual</sub></b> = la TIR en base anual que ves en la tarjeta TIR.</li>
                  <li><b>r</b> = TIR del <b>periodo</b>: la tasa que hace que el VAN valga cero.</li>
                  <li><b>ppy</b> = periodos por año de la unidad elegida en «Periodo por».</li>
                  <li>Se eleva <b>(1 + r)</b> a <b>ppy</b> (y no r × ppy) porque el interés se capitaliza dentro del año.</li>
                </ul>
              </details>
              <details class="inv-formula">
                <summary>
                  <span class="inv-formula-nombre">VAN</span>
                  <span class="inv-formula-cuerpo">
                    VAN = −I0 +
                    <Fraccion><template #num>FC<sub>t</sub></template><template #den>(1 + i)<sup>t</sup></template></Fraccion>
                  </span>
                </summary>
                <p class="inv-formula-texto">
                  <strong>De dónde sale:</strong> de la inversión inicial y de los flujos de la tabla. Es el criterio
                  que decide: se acepta si es positivo.
                </p>
                <ul class="inv-partes">
                  <li><b>VAN</b> = valor actual de todo el proyecto: lo que deja menos lo que cuesta, medido hoy.</li>
                  <li><b>−I0</b> = la inversión inicial, que sale en el periodo 0 (columna 0 de la tabla).</li>
                  <li><b>FC<sub>t</sub></b> = flujo neto del periodo t: el uniforme o el manual, con rescate (y valor
                    terminal) sumados en el último.</li>
                  <li><b>(1 + i)<sup>t</sup></b> = factor de descuento: baja cada flujo futuro al presente.</li>
                  <li><b>t</b> = periodo, empezando en 1 porque la inversión ya está en t = 0.</li>
                </ul>
              </details>
              <details class="inv-formula">
                <summary>
                  <span class="inv-formula-nombre">TIRM (MIR)</span>
                  <span class="inv-formula-cuerpo">
                    TIRM = ( <Fraccion><template #num>VF de las entradas</template><template #den>VP de las salidas</template></Fraccion> )<sup><Fraccion angosto><template #num>1</template><template #den>n</template></Fraccion></sup> − 1
                  </span>
                </summary>
                <p class="inv-formula-texto">
                  <strong>De dónde sale:</strong> sustituye a la TIR cuando el flujo cambia de signo más de una vez. Los
                  flujos de salida se acumulan a valor futuro y los de entrada se traen a valor presente.
                </p>
                <ul class="inv-partes">
                  <li><b>TIRM</b> (MIR) = tasa que iguala entradas y salidas cuando la TIR no es única.</li>
                  <li><b>VF de las entradas</b> = flujos acumulados hasta el final con la tasa de financiamiento.</li>
                  <li><b>VP de las salidas</b> = flujos descontados con la tasa de reinversión.</li>
                  <li><b>n</b> = número de periodos capturados.</li>
                  <li>La raíz <sup><Fraccion angosto><template #num>1</template><template #den>n</template></Fraccion></sup>
                    es lo que hace que la TIRM caiga siempre entre las dos tasas.</li>
                </ul>
              </details>
              <details class="inv-formula">
                <summary>
                  <span class="inv-formula-nombre">PRI con interpolación</span>
                  <span class="inv-formula-cuerpo">
                    PRI = n −
                    <Fraccion><template #num>|ACUM<sub>n</sub>|</template><template #den>FC<sub>n+1</sub></template></Fraccion>
                  </span>
                </summary>
                <p class="inv-formula-texto">
                  <strong>De dónde sale:</strong> del acumulado sin descontar de la tabla (columna «Acumulado»), que es
                  el mismo que cruza cero en la gráfica de flujo.
                </p>
                <ul class="inv-partes">
                  <li><b>PRI</b> = periodo en que la inversión queda recuperada (y su versión descontada).</li>
                  <li><b>n</b> = el último periodo con acumulado todavía negativo.</li>
                  <li><b>|ACUM<sub>n</sub>|</b> = cuánto falta por recuperar en ese periodo.</li>
                  <li><b>FC<sub>n+1</sub></b> = el flujo del periodo siguiente: reparte la recuperación de forma
                    proporcional (por eso el PRI puede salir con decimales).</li>
                  <li>Con valor absoluto porque importa el saldo que falta, no su signo.</li>
                </ul>
              </details>
              <details class="inv-formula">
                <summary>
                  <span class="inv-formula-nombre">ROI</span>
                  <span class="inv-formula-cuerpo">
                    ROI =
                    <Fraccion><template #num>ΣFC − I0</template><template #den>I0</template></Fraccion>
                  </span>
                </summary>
                <p class="inv-formula-texto">
                  <strong>De dónde sale:</strong> de los flujos sin descontar y de la inversión inicial. No usa la tasa,
                  por eso nunca decide en solitario.
                </p>
                <ul class="inv-partes">
                  <li><b>ROI</b> = rentabilidad total por peso invertido, en tanto por uno.</li>
                  <li><b>ΣFC</b> = suma de los flujos de todos los periodos, sin descontar.</li>
                  <li><b>−I0</b> = la inversión inicial, para quedarte con la ganancia neta.</li>
                  <li>Al dividirlo todo entre <b>I0</b> el resultado es un porcentaje, no un importe.</li>
                </ul>
              </details>
              <details class="inv-formula">
                <summary>
                  <span class="inv-formula-nombre">Factor de anualidad</span>
                  <span class="inv-formula-cuerpo">
                    a(n, i) =
                    <Fraccion><template #num>1 − (1 + i)<sup>−n</sup></template><template #den>i</template></Fraccion>
                  </span>
                </summary>
                <p class="inv-formula-texto">
                  <strong>De dónde sale:</strong> del número de periodos capturado y de la tasa del periodo. Es la base
                  del flujo nivelado, el flujo crítico y la inversión máxima tolerable.
                </p>
                <ul class="inv-partes">
                  <li><b>a(n, i)</b> = suma de los factores de descuento de los n periodos: el «precio» de una
                    renta de n pagos iguales.</li>
                  <li><b>n</b> = número de periodos capturado («Nº de periodos»).</li>
                  <li><b>i</b> = tasa (interés) del periodo.</li>
                  <li><b>(1 + i)<sup>−n</sup></b> = el factor de descuento acumulado, invertido: lo que queda de una
                   Peseta hoy al cabo de n periodos.</li>
                  <li>Si <b>i = 0</b> el factor vale <b>n</b>: la fórmula se resuelve aparte para no dividir entre cero.</li>
                </ul>
              </details>
              <details class="inv-formula">
                <summary>
                  <span class="inv-formula-nombre">Flujo nivelado</span>
                  <span class="inv-formula-cuerpo">
                    FN =
                    <Fraccion><template #num>VAN</template><template #den>a(n, i)</template></Fraccion>
                  </span>
                </summary>
                <p class="inv-formula-texto">
                  <strong>De dónde sale:</strong> del VAN (columna final de la tabla) dividido por el factor de
                  anualidad del proyecto.
                </p>
                <ul class="inv-partes">
                  <li><b>FN</b> = flujo nivelado: la renta constante equivalente al VAN.</li>
                  <li><b>VAN</b> = el valor actual calculado con la tasa del periodo.</li>
                  <li><b>a(n, i)</b> = factor de anualidad del proyecto (n periodos a la tasa i).</li>
                  <li>Sirve para comparar proyectos de distinta duración: ponerlos en la misma renta mensual.</li>
                </ul>
              </details>
              <details class="inv-formula">
                <summary>
                  <span class="inv-formula-nombre">IPR (beneficio/costo)</span>
                  <span class="inv-formula-cuerpo">
                    IPR =
                    <Fraccion><template #num>VAF</template><template #den>inversión</template></Fraccion>
                  </span>
                </summary>
                <p class="inv-formula-texto">
                  <strong>De dónde sale:</strong> de la columna «Valor presente» de la tabla y de la inversión inicial.
                </p>
                <ul class="inv-partes">
                  <li><b>IPR</b> = índice de rentabilidad: valor presente de lo que entra por cada peso invertido.</li>
                  <li><b>VAF</b> = valor actual de los flujos (los descontados, sumados).</li>
                  <li><b>inversión</b> = la inversión inicial, la misma I0 del VAN.</li>
                  <li>Regla rápida: <b>IPR &gt; 1 ⇔ VAN &gt; 0</b> (y IPR = 1 ⇔ VAN = 0).</li>
                </ul>
              </details>
              <details class="inv-formula">
                <summary>
                  <span class="inv-formula-nombre">Valor terminal de Gordon</span>
                  <span class="inv-formula-cuerpo">
                    VT =
                    <Fraccion><template #num>FC<sub>n+1</sub></template><template #den>i − g</template></Fraccion>
                  </span>
                </summary>
                <p class="inv-formula-texto">
                  <strong>De dónde sale:</strong> solo se aplica si capturas «Crecimiento perpetuo»; el valor terminal
                  se suma al último flujo de la tabla.
                </p>
                <ul class="inv-partes">
                  <li><b>VT</b> = valor de los flujos que se seguirían generando después del último periodo.</li>
                  <li><b>FC<sub>n+1</sub></b> = el último flujo, ya crecido un periodo más.</li>
                  <li><b>i</b> = tasa del periodo; <b>g</b> = crecimiento perpetuo capturado.</li>
                  <li>Exige <b>i &gt; g</b>: si la tasa no supera al crecimiento, el denominador se anula.</li>
                  <li>Nunca se aplica al valor de rescate, que ya es el final del proyecto (si se capturan los dos, la
                    app avisa del doble conteo).</li>
                </ul>
              </details>
            </div>
            <p class="tabla-nota">
              El <strong>VAN</strong> es el criterio que decide (se acepta si es positivo). La <strong>TIR</strong> solo
              confirma cuando el flujo es convencional (un cambio de signo); con varias raíces reales se reporta la
              <strong>TIRM</strong>. El <strong>ROI</strong> ignora el valor del dinero en el tiempo, así que nunca
              decide por sí solo.
            </p>
          </div>
        </template>
        </div>
      </div>
    </div>

    <p class="inv-pie">
      Herramienta de apoyo para decisiones de inversión. No sustituye una asesoría financiera formal.
    </p>
  </div>
</template>

<style scoped>
/* La rejilla (dos columnas que se apilan) la aporta Bootstrap con
   .row / .col-12 / .col-lg-*, así que aquí no hay grid propio. */
.inv {
  --inv-linea: var(--border);
}

.inv-barra {
  padding: 12px 16px;
  background: var(--barra);
  border: 1px solid var(--inv-linea);
  border-radius: 10px;
}

.inv-marca b {
  display: block;
  font-size: 1.05rem;
  color: #f1f5f9;
}

/* La barra es oscura en los dos temas, así que el texto va siempre claro. */
.inv-marca span {
  display: block;
  color: #afc0d2;
  font-size: 0.82rem;
}

.inv-acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.inv-hero {
  padding: 18px 2px 6px;
}

.inv-hero h2 {
  font-size: 1.35rem;
  margin: 0;
}

.inv-hero p {
  margin: 6px 0 0;
  color: var(--muted);
  max-width: 78ch;
}

.inv-campo {
  margin-top: 14px;
}

.inv-campo label {
  display: block;
  margin-bottom: 5px;
  color: var(--text);
  font-weight: 600;
}

.inv-input {
  position: relative;
  display: flex;
  align-items: center;
}

/* Solo queda el sufijo estático ("% anual"): el prefijo $ va dentro del input,
   que es un componente hijo (CampoNumero) y ya reserva su propio hueco. */
.inv-input .suf {
  position: absolute;
  right: 12px;
  color: var(--muted);
  font-size: 0.9rem;
  pointer-events: none;
}

.inv-nota {
  margin: 5px 0 0;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.5;
}

.inv-seg {
  display: flex;
  flex-wrap: wrap;
  border: 1px solid var(--inv-linea);
  border-radius: 8px;
  overflow: hidden;
}

.inv-seg button {
  flex: 1 1 auto;
  padding: 8px 6px;
  border: none;
  border-right: 1px solid var(--inv-linea);
  background: var(--bg);
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.inv-seg button:last-child {
  border-right: none;
}

.inv-seg button.activo,
.inv-seg button:hover {
  background: var(--accent-dark);
  color: #fff;
}

.inv-stepper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.inv-stepper button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--inv-linea);
  border-radius: 7px;
  background: var(--bg);
  color: var(--text);
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.inv-stepper button:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.inv-stepper .n {
  min-width: 2.4em;
  text-align: center;
  font-size: 1.05rem;
  font-weight: 700;
}

/* Panel del CMPC: se organiza en bloques (CAPM / estructura de capital /
   resultados), cada uno con su encabezado y las filas de Bootstrap dentro. */
.inv-cmmpc {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.inv-cmmpc-bloque {
  padding: 12px;
  background: var(--bg);
  border: 1px solid var(--inv-linea);
  border-radius: 10px;
}

.inv-cmmpc-titulo {
  margin: 0 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--border);
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* Desglose del CMPC: cada término de la fórmula en su propia tarjeta. */
.cm-desglose {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.cm-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--inv-linea);
  border-radius: 10px;
}

.cm-card-titulo {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cm-card-formula {
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.2;
}

.cm-card-formula .fr {
  color: var(--text);
  font-size: 0.72rem;
}

.cm-card-cuenta {
  color: var(--text);
  font-size: 0.92rem;
}

.cm-card-valor {
  color: var(--accent);
  font-size: 1.1rem;
  font-weight: 800;
}

.cm-card-total {
  grid-column: 1 / -1;
  border-color: var(--accent);
}

.cm-card-total .cm-card-formula {
  font-size: 0.9rem;
}

.cm-card-total .cm-card-valor {
  font-size: 1.5rem;
}

/* --- Flujos manuales --- */
.inv-flujos {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.inv-flujo {
  display: grid;
  grid-template-columns: 2.2em minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.inv-flujo .idx {
  text-align: right;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--muted);
}

/* Los campos ya usan la variante small de Bootstrap: no hay que forzar alto. */
.inv-flujo .inv-input {
  min-width: 0;
}

.inv-mini {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.inv-mini label {
  font-size: 0.78rem;
}

/* Las tarjetas del CMPC se maquetan con .row/.col de Bootstrap; aquí solo el valor. */
.tarjeta-valor {
  font-size: 1.05rem;
  color: var(--accent);
}

/* --- Indicadores --- */
.inv-kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  background: var(--bg);
  border: 1px solid var(--inv-linea);
  border-radius: 10px;
  transition: border-color 0.12s, transform 0.12s, box-shadow 0.12s;
}

/* Realce al pasar el puntero: la tarjeta invita a explorar su globo. */
.inv-kpi:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
}

.inv-kpi .lbl {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--muted);
  text-transform: uppercase;
}

.inv-kpi .val {
  font-size: 1.2rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.inv-kpi .sub {
  font-size: 0.74rem;
  color: var(--muted);
}

.inv-kpi .val.ok {
  color: var(--ok);
}

.inv-kpi .val.mal {
  color: var(--error);
}

.inv-kpi .val.alerta {
  color: var(--amber);
}

.inv-kpi .val.neutro {
  color: var(--text);
}

.inv-veredicto {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--inv-linea);
}

.inv-veredicto p {
  margin: 4px 0 0;
  font-size: 0.9rem;
}

.inv-veredicto.good {
  background: rgba(74, 222, 128, 0.12);
  border-color: var(--ok);
  color: var(--ok);
}

.inv-veredicto.bad {
  background: rgba(248, 113, 113, 0.12);
  border-color: var(--error);
  color: var(--error);
}

.inv-veredicto.warn {
  background: rgba(251, 191, 36, 0.12);
  border-color: var(--amber);
  color: var(--amber);
}

/* --- Gráficas SVG --- */
.inv-graf {
  margin-top: 10px;
  background: var(--bg);
  border: 1px solid var(--inv-linea);
  border-radius: 10px;
  padding: 6px;
}

.inv-graf svg {
  display: block;
  width: 100%;
  height: auto;
}

.inv-eje-cero {
  stroke: var(--inv-linea);
  stroke-width: 1.5;
}

.inv-txt-eje {
  fill: var(--muted);
  font-size: 10px;
}

.inv-linea {
  fill: none;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.inv-linea-nominal {
  stroke: var(--accent);
}

.inv-linea-desc {
  stroke: var(--ok);
}

.inv-linea-perfil {
  stroke: var(--amber);
}

.inv-nodo-nominal {
  fill: var(--accent);
}

.inv-nodo-desc {
  fill: var(--ok);
}

.inv-marca-pri {
  stroke: var(--amber);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}

.inv-punto-pri {
  fill: var(--amber);
}

.inv-txt-pri {
  fill: var(--amber);
  font-size: 10px;
  font-weight: 700;
}

.inv-marca-actual {
  stroke: var(--accent);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}

.inv-punto-actual {
  fill: var(--accent);
}

.inv-txt-actual {
  fill: var(--accent);
  font-size: 10px;
  font-weight: 700;
}

.inv-marca-tir {
  stroke: var(--ok);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}

.inv-punto-tir {
  fill: var(--ok);
}

.inv-txt-tir {
  fill: var(--ok);
  font-size: 10px;
  font-weight: 700;
}

.inv-leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 10px;
  font-size: 0.8rem;
  color: var(--muted);
}

.inv-leyenda span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.inv-leyenda i {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}

.inv-leyenda i.nominal {
  background: var(--accent);
}

.inv-leyenda i.desc {
  background: var(--ok);
}

.inv-leyenda i.pri {
  background: var(--amber);
  border-radius: 50%;
}

/* --- Tablas de resultado --- */
.inv :deep(td),
.inv :deep(th) {
  text-align: right;
}

.inv :deep(td:first-child),
.inv :deep(th:first-child) {
  text-align: left;
}

.inv .pos {
  color: var(--ok);
}

.inv .neg {
  color: var(--error);
}

/* Fila que incluye el valor terminal y escenarios donde el proyecto se rechaza. */
.inv-fila-vt td {
  background: rgba(251, 191, 36, 0.12);
}

.inv-fila-rechazo td {
  background: rgba(248, 113, 113, 0.1);
}

.inv-pie {
  margin: 24px 0 0;
  color: var(--muted);
  font-size: 0.8rem;
  text-align: center;
}

/* Glosario desplegable de siglas. */
.inv-detalle {
  margin-top: 6px;
}

.inv-detalle summary {
  display: inline-block;
  list-style: none;
}

.inv-detalle summary::-webkit-details-marker {
  display: none;
}

.inv-glosario {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 4px 10px;
  margin: 12px 0 0;
  font-size: 0.85rem;
}

.inv-glosario dt {
  color: var(--accent);
  font-weight: 700;
}

.inv-glosario dd {
  margin: 0;
  color: var(--text);
}

/* Fórmulas: una tarjeta por indicador, con el cociente en fracción (Fraccion.vue).
   Cada tarjeta es un acordeón: se ve el nombre y la fórmula, y al tocarla se
   despliega de dónde salen los datos. */
.inv-formulas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin: 12px 0;
}

.inv-formula {
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--inv-linea);
  border-radius: 10px;
}

.inv-formula summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: center;
  cursor: pointer;
  list-style: none;
  position: relative;
  padding-right: 18px;
}

.inv-formula summary::-webkit-details-marker {
  display: none;
}

/* Chevron: indica que la fórmula se abre. */
.inv-formula summary::after {
  content: '';
  position: absolute;
  top: 12px;
  right: 2px;
  width: 7px;
  height: 7px;
  border-right: 2px solid var(--accent);
  border-bottom: 2px solid var(--accent);
  transform: rotate(45deg);
  transition: transform 0.15s ease;
}

.inv-formula[open] summary::after {
  transform: rotate(-135deg);
}

.inv-formula[open] {
  border-color: var(--accent);
}

.inv-formula summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 6px;
}

.inv-formula-nombre {
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.inv-formula-cuerpo {
  color: var(--text);
  font-size: 1rem;
}

.inv-formula-texto {
  margin: 10px 0 2px;
  padding-top: 10px;
  border-top: 1px dashed var(--inv-linea);
  color: var(--muted);
  font-size: 0.85rem;
  text-align: left;
}

.inv-formula-texto strong {
  color: var(--text);
}

/* Desglose de las partes de la fórmula: una viñeta por símbolo. */
.inv-partes {
  margin: 8px 0 2px;
  padding-left: 18px;
  color: var(--muted);
  font-size: 0.85rem;
  text-align: left;
}

.inv-partes li {
  margin-bottom: 4px;
}

.inv-partes li::marker {
  color: var(--accent);
}

.inv-partes b {
  color: var(--text);
  font-weight: 700;
}

/* Las etiquetas con globo se reparten el ancho con el icono. */
.inv-campo label.d-flex {
  justify-content: space-between;
}

/* --- Impresión: se ocultan los controles y se aplana el color --- */
@media print {
  .inv-barra .inv-acciones,
  .inv-seg,
  .inv-stepper,
  .inv-acciones {
    display: none;
  }

  .formulario,
  .resultado,
  .inv-graf,
  .inv-kpi {
    break-inside: avoid;
  }
}
</style>
