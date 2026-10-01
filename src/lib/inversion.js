// ============================================================================
// inversion.js — Lógica pura de evaluación financiera de proyectos (Vue/Vite).
// ----------------------------------------------------------------------------
// IMPORTANTE: módulo 100% agnóstico de Vue (funciones puras) para poder testearlo
// en Node (`npm test`). El componente InversionesApp.vue solo orchestra y muestra.
//
// Teoría implementada (criterios de evaluación de inversiones):
//   - VAN / VPN ....... valor actual neto: -I0 + Σ FCt/(1+i)^t. Criterio principal:
//                       el proyecto se acepta si VAN > 0 (crea valor a la tasa i).
//   - TIR / TIRR ...... tasa que anula el VAN. Solo es concluyente si el flujo es
//                       "convencional" (un solo cambio de signo, regla de los signos
//                       de Descartes); con más de un cambio de signo puede haber
//                       varias TIR y el criterio se vuelve ambiguo.
//   - TIRM ............ tasa interna de retorno modificada (flujos negativos
//                       financiados a i_f y positivos reinvertidos a i_r). Es la
//                       recomendación académica cuando el flujo no es convencional.
//   - PRI ............. periodo de recuperación (simple y descontado), con
//                       interpolación lineal dentro del periodo y aviso si la
//                       recuperación no se sostiene en el resto del horizonte.
//   - ROI ............. (Σ FC - I0)/I0. Ignora el valor del dinero en el tiempo,
//                       por eso solo se usa como indicador complementario.
//   - IPR / RPI ....... índice de rentabilidad = VAF/IA (>1 equivale a VAN > 0).
//   - Flujo nivelado .. renta perpetua equivalente = VAN / factor de anualidad.
//   - CMPC ............ costo promedio ponderado de capital (CAPM para el costo
//                       del patrimonio + costo de deuda después de impuestos).
//   - Punto de equilibrio y sensibilidad del VAN ante tasa, flujos e inversión.
// ============================================================================

// --- Unidades de periodo -----------------------------------------------------
// ppy = periodos por año. Permite convertir una tasa ANUAL a la tasa equivalente
// del periodo (requisito: los flujos del ejemplo en meses deben descontarse con
// la tasa mensual, no con la anual).
export const UNIDADES = [
  { valor: 'año', etiqueta: 'Años', corto: 'año', ppy: 1 },
  { valor: 'semestre', etiqueta: 'Semestres', corto: 'semestre', ppy: 2 },
  { valor: 'trimestre', etiqueta: 'Trimestres', corto: 'trimestre', ppy: 4 },
  { valor: 'mes', etiqueta: 'Meses', corto: 'mes', ppy: 12 },
]

// Devuelve los periodos por año de una unidad de periodo.
export function periodosPorAnio(unidad) {
  const u = UNIDADES.find((x) => x.valor === unidad)
  if (!u) throw new Error(`Unidad de periodo desconocida: '${unidad}'.`)
  return u.ppy
}

// Tasa anual -> tasa equivalente del periodo:  i_p = (1 + i_a)^(1/ppy) - 1.
// Es la única conversión válida si los flujos están expresados en el periodo.
export function tasaAPeriodica(tasaAnual, ppy) {
  if (ppy < 1) throw new Error('Los periodos por año deben ser al menos 1.')
  if (tasaAnual <= -1) throw new Error('La tasa no puede ser menor o igual a -100%.')
  return Math.pow(1 + tasaAnual, 1 / ppy) - 1
}

// Tasa del periodo -> tasa anual equivalente:  i_a = (1 + i_p)^ppy - 1.
export function tasaAAnual(tasaPeriodica, ppy) {
  return Math.pow(1 + tasaPeriodica, ppy) - 1
}

// Factor de anualidad (suma de los factores de descuento de n periodos).
// Con tasa 0 el factor es simplemente n.
export function factorAnualidad(tasa, n) {
  if (n <= 0) return 0
  if (Math.abs(tasa) < 1e-12) return n
  return (1 - Math.pow(1 + tasa, -n)) / tasa
}

// Valor presente de una serie de flujos que empiezan en el periodo "desde".
export function valorPresente(tasa, flujos, desde = 1) {
  if (tasa <= -1) throw new Error('La tasa de descuento debe ser mayor que -100%.')
  let v = 0
  for (let i = 0; i < flujos.length; i++) {
    const t = i + desde
    v += flujos[i] / Math.pow(1 + tasa, t)
  }
  return v
}

// --- VAN (valor actual neto) -------------------------------------------------
// Es el criterio decisive: con la tasa de descuento i, el proyecto vale VAN.
export function van(tasa, inversion, flujos) {
  return -inversion + valorPresente(tasa, flujos)
}

// Serie completa para la tabla de detalle por periodo.
// Devuelve una fila por periodo (t = 1..n) con:
//   periodo, flujo, factor (de descuento), vp (valor presente del flujo),
//   vanAcum (VAN acumulado hasta ese periodo), acum y acumDisc (acumulados desde
//   el periodo 0, que es donde se ve el momento de recuperación).
export function serieVan(tasa, inversion, flujos) {
  const filas = []
  let vanAcum = -inversion
  let acum = -inversion
  let acumDisc = -inversion
  flujos.forEach((flujo, i) => {
    const t = i + 1
    const factor = 1 / Math.pow(1 + tasa, t)
    const vp = flujo * factor
    vanAcum += vp
    acum += flujo
    acumDisc += vp
    filas.push({ periodo: t, flujo, factor, vp, vanAcum, acum, acumDisc })
  })
  return filas
}

// --- Regla de los signos de Descartes ---------------------------------------
// Número de cambios de signo en la serie [-I0, FC1..FCn]: es el máximo número de
// raíces reales (TIR) que puede tener el polinomio del VAN.
export function cambiosDeSigno(cifras) {
  let cambios = 0
  let anterior = 0
  for (const v of cifras) {
    if (!Number.isFinite(v) || v === 0) continue
    const signo = v > 0 ? 1 : -1
    if (anterior !== 0 && signo !== anterior) cambios++
    anterior = signo
  }
  return cambios
}

// --- TIR (tasa interna de retorno) ------------------------------------------
// Resuelve VAN(r) = 0 sobre r > -100%.
// Estrategia:
//   1) Se cuentan los cambios de signo. Con 0 cambios no hay TIR real.
//   2) Con exactamente 1 cambio el VAN es monótono: bisección directa (exacto).
//   3) Con 2 o más cambios puede haber varias raíces: se barren todas las
//      raíces reales (malla logarítmica en x = 1+r + bisección) y se reportan.
// La comparación de la TIR contra la tasa solo es válida si hay una sola raíz.
export function tir(inversion, flujos, opciones = {}) {
  const maxIter = opciones.maxIter ?? 200
  const tol = opciones.tol ?? 1e-10
  const n = flujos.length
  const vacio = {
    existe: false,
    valor: null,
    raices: [],
    multiple: false,
    cambios: 0,
    motivo: '',
  }
  if (n === 0) return { ...vacio, motivo: 'No hay flujos que evaluar.' }
  if (inversion <= 0) {
    return { ...vacio, motivo: 'Sin inversión inicial positiva no hay TIR que calcular.' }
  }
  const cambios = cambiosDeSigno([-inversion, ...flujos])
  if (cambios === 0) {
    return {
      ...vacio,
      cambios,
      motivo:
        'No existe TIR: la serie de flujos no cambia de signo, así que el VAN nunca cruza cero.',
    }
  }

  // VAN expresado en función de x = 1 + r (x > 0). Raíz en x equivale a r = x - 1.
  const vanEnX = (x) => {
    let v = -inversion
    for (let t = 0; t < n; t++) v += (flujos[t] * Math.pow(x, -(t + 1)))
    return v
  }
  // Tolerancia ABSOLUTA sobre el VAN: se escala con la inversión para que el
  // criterio de convergencia sea relativo al tamaño del proyecto y no del euro.
  const epsilon = tol * Math.max(1, inversion)
  // Bisección sobre x: el cambio de signo se mantiene porque la transformación
  // x = 1+r es monótona y el VAN es continuo. El punto medio es GEOMÉTRICO para
  // que la búsqueda sea rápida también cuando las tasas abarcan varias décadas.
  const biseccion = (xa, xb) => {
    let a = Math.min(xa, xb)
    let b = Math.max(xa, xb)
    let fa = vanEnX(a)
    for (let i = 0; i < maxIter; i++) {
      const m = Math.sqrt(a * b)
      const fm = vanEnX(m)
      if (Math.abs(fm) <= epsilon) return m
      if (fa < 0 === fm < 0) {
        a = m
        fa = fm
      } else {
        b = m
      }
    }
    return Math.sqrt(a * b)
  }

  let raices = []
  if (cambios === 1) {
    // Un solo cambio de signo: por la regla de los signos hay exactamente una
    // raíz real admisible. Como el último flujo es positivo, el VAN tiende a
    // +infinito cuando x -> 0 y a -I0 cuando x -> infinito, así que la raíz
    // siempre existe; basta con expandir el intervalo en la dirección correcta
    // (la raíz puede ser positiva, x > 1, o negativa, x < 1).
    if (Math.abs(vanEnX(1)) <= epsilon) {
      raices = [0]
    } else if (vanEnX(1) < 0) {
      // La raíz está a la izquierda de x = 1 (TIR negativa): se sigue bajando
      // hasta que el VAN se vuelva positivo (tiende a +infinito al llegar a 0).
      let a = 1
      while (a > 1e-9 && vanEnX(a) < 0) a /= 2
      raices = [biseccion(a, 1) - 1]
    } else {
      let b = 1
      while (b < 1e9 && vanEnX(b) > 0) b *= 2
      raices = [biseccion(1, b) - 1]
    }
  } else {
    // Malla logarítmica de 1e-6 a 1e8 (x) para localizar todos los cambios de signo.
    const muestras = 2400
    const logMin = -6
    const logMax = 8
    let xPrev = Math.pow(10, logMin)
    let fPrev = vanEnX(xPrev)
    for (let k = 1; k <= muestras; k++) {
      const x = Math.pow(10, logMin + ((logMax - logMin) * k) / muestras)
      const f = vanEnX(x)
      if (Number.isFinite(fPrev) && Number.isFinite(f) && (fPrev < 0) !== (f < 0)) {
        raices.push(biseccion(xPrev, x) - 1)
      }
      xPrev = x
      fPrev = f
    }
    // Se ordenan y se eliminan las raíces repetidas (tolerancia relativa).
    raices.sort((a, b) => a - b)
    raices = raices.filter((r, i) => i === 0 || Math.abs(r - raices[i - 1]) > 1e-6 * (1 + Math.abs(r)))
  }

  if (!raices.length) {
    return {
      ...vacio,
      cambios,
      motivo:
        'No existe TIR real: con esos flujos el VAN no se anula para ninguna tasa mayor que -100%.',
    }
  }
  return {
    existe: true,
    cambios,
    raices,
    multiple: raices.length > 1,
    valor: raices[0],
    motivo:
      raices.length > 1
        ? `El flujo no es convencional: hay ${raices.length} TIR reales (${raices
            .map((r) => `${(r * 100).toFixed(2)}%`)
            .join(', ')}). El criterio de la TIR no es concluyente; use el VAN y la TIRM.`
        : '',
  }
}

// --- TIRM (tasa interna de retorno modificada) -------------------------------
// Los flujos negativos se financian a la tasa de financiamiento i_f y los
// positivos se reinvierten a i_r; la TIRM es la tasa que iguala el valor futuro
// de las entradas con el valor presente de las salidas. Es la alternativa
// recomendada cuando hay más de un cambio de signo.
export function tirModificada(inversion, flujos, tasaFin = 0, tasaReinv = 0) {
  const n = flujos.length
  if (n === 0) return null
  // La inversión inicial es una salida en t = 0 (ya está en valor presente);
  // las salidas operativas de cada periodo seiscountan a la tasa de financiamiento.
  let vpNegativos = -inversion
  let vfPositivos = 0 // valor futuro de las entradas al final del horizonte
  flujos.forEach((f, i) => {
    if (f < 0) vpNegativos += f / Math.pow(1 + tasaFin, i + 1)
    else vfPositivos += f * Math.pow(1 + tasaReinv, n - (i + 1))
  })
  if (vpNegativos >= 0 || vfPositivos <= 0) return null
  return Math.pow(vfPositivos / -vpNegativos, 1 / n) - 1
}

// --- Periodo de recuperación (PRI) -------------------------------------------
// Primer momento en que el acumulado (con o sin descuento) cruza cero, con
// interpolación lineal dentro del periodo. Si el acumulado vuelve a caer por
// debajo de cero, la recuperación no se sostiene (se marca `sostenido: false`),
// porque los flujos no convencionales hacen que el PRI no sea informativo.
export function periodoRecuperacion(inversion, flujos, opciones = {}) {
  const tasa = opciones.tasa ?? 0
  const descontado = opciones.descontado ?? false
  const serie = descontado
    ? flujos.map((f, i) => f / Math.pow(1 + tasa, i + 1))
    : flujos.slice()
  let acum = -inversion
  for (let t = 0; t < serie.length; t++) {
    const previo = acum
    acum += serie[t]
    if (acum >= 0) {
      const fraccion = serie[t] > 0 ? (0 - previo) / serie[t] : 0
      const restante = serie.slice(t + 1).reduce((a, b) => a + b, 0)
      return {
        recupera: true,
        periodos: t + fraccion,
        periodo: t + 1,
        fraccion,
        sostenido: acum + restante >= -1e-9,
        restante,
      }
    }
  }
  return {
    recupera: false,
    periodos: null,
    periodo: null,
    fraccion: null,
    sostenido: false,
    restante: 0,
  }
}

// --- ROI, IPR y flujo nivelado ------------------------------------------------
export function roi(inversion, flujos) {
  if (inversion <= 0) return null
  const suma = flujos.reduce((a, b) => a + b, 0)
  return (suma - inversion) / inversion
}

// Índice de rentabilidad = valor actual de los flujos / inversión (>1 equivale a VAN>0).
export function indiceRentabilidad(tasa, inversion, flujos) {
  if (inversion <= 0) return null
  return valorPresente(tasa, flujos) / inversion
}

// Renta (flujo) nivelada: flujo constante anual/mensual con el mismo VAN.
export function flujoNivelado(van, tasa, n) {
  const fa = factorAnualidad(tasa, n)
  if (fa <= 0) return null
  return van / fa
}

// --- Valor terminal (crecimiento perpetuo de Gordon) -------------------------
// VT = FC(n+1) / (i - g). Exige i > g; si el crecimiento supera a la tasa el
// modelo de Gordon no aplica (VT negativo o inexistente).
export function valorTerminal(flujoUltimo, tasa, crecimiento) {
  if (tasa <= crecimiento) return null
  return (flujoUltimo * (1 + crecimiento)) / (tasa - crecimiento)
}

// --- CMPC (WACC) y costo del patrimonio (CAPM) -------------------------------
// ke = Rf + beta * (Rm - Rf)            (CAPM, modelo devaluation con prima de mercado)
// kd después de impuestos = kd * (1 - t)
// CMPC = (E/V)*ke + (D/V)*kd*(1 - t)
export function cmmpc(datos) {
  const {
    tasaLibreRiesgo,
    beta,
    primaMercado,
    costoDeuda,
    tasaImpuestos,
    valorPatrimonio,
    valorDeuda,
  } = datos
  const v = valorPatrimonio + valorDeuda
  if (v <= 0) throw new Error('El valor total de la estructura de capital debe ser positivo.')
  const ke = tasaLibreRiesgo + beta * (primaMercado - tasaLibreRiesgo)
  const wE = valorPatrimonio / v
  const wD = valorDeuda / v
  const kdNeto = costoDeuda * (1 - tasaImpuestos)
  return { ke, wD, wE, kdNeto, cmmpc: wE * ke + wD * kdNeto }
}

// --- Perfil del VAN ----------------------------------------------------------
// Muestra del VAN frente a la tasa ANUAL de descuento (para graficar y ver dónde
// cruza cero). Si `tasaActual` se pasa, se garantiza que esté en la lista.
export function perfilVan(inversion, flujos, opciones = {}) {
  const ppy = opciones.ppy ?? 1
  const tasaActual = opciones.tasaActual ?? 0
  const maxTasa = opciones.maxTasa ?? 2 // 200% anual
  const pasos = opciones.pasos ?? 120
  const puntos = []
  for (let k = 0; k <= pasos; k++) {
    const tasa = (maxTasa * k) / pasos
    const i = tasa === tasaActual ? tasa : tasaAPeriodica(tasa, ppy)
    puntos.push({ tasa, van: van(i, inversion, flujos) })
  }
  if (!puntos.some((p) => p.tasa === tasaActual)) {
    puntos.push({ tasa: tasaActual, van: van(tasaAPeriodica(tasaActual, ppy), inversion, flujos) })
    puntos.sort((a, b) => a.tasa - b.tasa)
  }
  return puntos
}

// --- Punto de equilibrio ------------------------------------------------------
//   - inversionMaxima: inversión que anularía el VAN (VAF de los flujos).
//   - flujoCritico:    flujo uniforme por periodo que anularía el VAN.
//   - tasaRotura:      tasa de descuento a la que el VAN es cero (= TIR única).
//   - margenSeguridad: VAN / inversión (holgura relativa del proyecto).
export function puntoEquilibrio(inversion, flujos, tasa) {
  const vaf = valorPresente(tasa, flujos)
  const fa = factorAnualidad(tasa, flujos.length)
  return {
    inversionMaxima: vaf,
    inversionTolera: vaf - inversion, // cuánto más se podría invertir sin perder valor
    flujoCritico: fa > 0 ? inversion / fa : null,
    margenSeguridad: inversion > 0 ? (vaf - inversion) / inversion : null,
  }
}

// --- Sensibilidad del VAN ----------------------------------------------------
// Variaciones de un factor (tasa de descuento, flujos o inversión) con el resto
// de variables constantes. Cada fila indica si el proyecto se seguiría aceptando.
export function sensibilidad(inversion, flujos, opciones = {}) {
  const ppy = opciones.ppy ?? 1
  const tasa = opciones.tasa ?? 0
  const puntos = opciones.puntos ?? [-8, -4, 0, 4, 8] // puntos porcentuales de tasa
  const filas = []
  for (const p of puntos) {
    const tAnual = Math.max(0, tasa + p / 100)
    const i = tasaAPeriodica(tAnual, ppy)
    const v = van(i, inversion, flujos)
    filas.push({
      variable: 'Tasa de descuento',
      escenario: `${etiquetaTasa(tAnual, ppy)}${p === 0 ? ' (actual)' : ` (${p > 0 ? '+' : ''}${p} p.p.)`}`,
      van: v,
      acepta: v > 0,
    })
  }
  const factores = opciones.factores ?? [-20, -10, 0, 10, 20]
  for (const f of factores) {
    const escala = 1 + f / 100
    const v = van(tasa, inversion, flujos.map((x) => x * escala))
    filas.push({
      variable: 'Flujos netos',
      escenario: `${f > 0 ? '+' : ''}${f}%`,
      van: v,
      acepta: v > 0,
    })
  }
  const escalated = opciones.escalas ?? [-20, -10, 0, 10, 20]
  for (const f of escalated) {
    const v = van(tasa, inversion * (1 + f / 100), flujos)
    filas.push({
      variable: 'Inversión inicial',
      escenario: `${f > 0 ? '+' : ''}${f}%`,
      van: v,
      acepta: v > 0,
    })
  }
  return filas
}

function etiquetaTasa(tasaAnual, ppy) {
  const a = `${(tasaAnual * 100).toFixed(2)}%`
  return ppy > 1 ? `${a} anual` : a
}

// --- Evaluación completa -----------------------------------------------------
// Punto de entrada de la vista: recibe los datos capturados y devuelve TODOS los
// indicadores, la serie por periodo, la sensibilidad y los avisos de teoría.
// `tasaAnual` es siempre una tasa ANUAL; internamente se convierte a la tasa del
// periodo en el que estén expresados los flujos.
export function evaluarProyecto(datos) {
  const {
    inversion,
    flujos: flujosOperacion,
    tasaAnual,
    unidad = 'año',
    tasaFinanciamiento,
    tasaReinversion,
    crecimientoAnual = 0,
    rescate = 0,
  } = datos
  const ppy = periodosPorAnio(unidad)
  const i = tasaAPeriodica(tasaAnual, ppy)
  const iFin = tasaAPeriodica(tasaFinanciamiento ?? tasaAnual, ppy)
  const iReinv = tasaAPeriodica(tasaReinversion ?? tasaAnual, ppy)
  const advertencias = []

  // El valor de rescate es un cobro de liquidación en el último periodo: se suma
  // al flujo operativo de ese periodo (no se reinvierte ni crece).
  const rescateValor = Number.isFinite(Number(rescate)) ? Number(rescate) : 0
  const flujosBase = flujosOperacion.slice()
  if (flujosBase.length > 0 && rescateValor !== 0) flujosBase[flujosBase.length - 1] += rescateValor

  // Valor terminal de Gordon: si se supone que el último flujo crece de forma
  // perpetua, ese valor se suma al flujo del último periodo. El crecimiento se
  // convierte a la tasa del periodo y exige i > g para que el modelo sea válido.
  // Se calcula sobre el flujo OPERATIVO: hacer crecer también el rescate
  // contaría dos veces el valor final del proyecto.
  const flujos = flujosBase.slice()
  const n = flujos.length
  let vt = null
  if (crecimientoAnual > 0 && n > 0) {
    const g = tasaAPeriodica(crecimientoAnual, ppy)
    vt = valorTerminal(flujosOperacion[n - 1], i, g)
    if (vt === null || !Number.isFinite(vt)) {
      vt = null
      advertencias.push(
        'El crecimiento perpetuo es mayor o igual a la tasa de descuento: el valor terminal de Gordon no se aplica y el último flujo queda sin ese complemento.'
      )
    } else {
      flujos[n - 1] += vt
    }
  }
  if (vt !== null && rescateValor > 0) {
    advertencias.push(
      'Se están sumando el valor de rescate y el valor terminal de Gordon: ambos representan el final del proyecto, así que conviene usar solo uno de los dos para no duplicar ese valor.'
    )
  }

  const vanValor = van(i, inversion, flujos)
  const filas = serieVan(i, inversion, flujos)
  const t = tir(inversion, flujos)
  const tAnual = t.existe ? tasaAAnual(t.valor, ppy) : null
  const tAnuales = t.existe ? t.raices.map((r) => tasaAAnual(r, ppy)) : []
  const tirmP = tirModificada(inversion, flujos, iFin, iReinv)
  const tirm = tirmP === null ? null : tasaAAnual(tirmP, ppy)
  const pri = periodoRecuperacion(inversion, flujos)
  const priDesc = periodoRecuperacion(inversion, flujos, { tasa: i, descontado: true })
  const roiValor = roi(inversion, flujos)
  const ipr = indiceRentabilidad(i, inversion, flujos)
  const nivelado = flujoNivelado(vanValor, i, n)
  const equilibrio = puntoEquilibrio(inversion, flujos, i)
  const sens = sensibilidad(inversion, flujos, { ppy, tasa: tasaAnual })
  const perfil = perfilVan(inversion, flujos, { ppy, tasaActual: tasaAnual })
  const suma = flujos.reduce((a, b) => a + b, 0)

  // La TIR solo decide si es única: con varias raíces o sin raíz real, el
  // criterio de la TIR no aplica y hay que apoyarse en el VAN y la TIRM.
  if (t.multiple) advertencias.push(t.motivo)
  if (!t.existe) advertencias.push(t.motivo)
  if (t.existe && !t.multiple && tAnual <= 0) {
    advertencias.push(
      'La TIR es negativa: el proyecto no recupera la inversión ni siquiera con una tasa de descuento de 0%.'
    )
  }
  // Conflicto clásico TIR vs VAN con flujos no convencionales: prevalece el VAN.
  const aceptaPorVan = vanValor > 0
  const aceptaPorTir = t.existe && !t.multiple ? tAnual > tasaAnual : null
  if (aceptaPorTir !== null && aceptaPorTir !== aceptaPorVan) {
    advertencias.push(
      `Conflicto entre criterios: el VAN ${aceptaPorVan ? 'acepta' : 'rechaza'} el proyecto pero la TIR (${
        (tAnual * 100).toFixed(2)
      }%) ${aceptaPorTir ? 'acepta' : 'rechaza'}. Con flujos no convencionales prevalece el VAN.`
    )
  }
  if (t.multiple && vanValor < 0 && tAnuales.some((x) => x > tasaAnual)) {
    const mayor = Math.max(...tAnuales)
    advertencias.push(
      `Conflicto entre criterios: el VAN rechaza el proyecto, pero una de las TIR (${fmt(
        mayor
      )}) supera la tasa de descuento. Al haber varias TIR el criterio no es válido: prevalece el VAN.`
    )
  }
  if (!pri.recupera) {
    advertencias.push('El PRI no se alcanza dentro del horizonte: la inversión no se recupera con estos flujos.')
  } else if (!pri.sostenido) {
    advertencias.push(
      'El acumulado vuelve a ser negativo después de la recuperación: el PRI no es informativo con este patrón de flujos.'
    )
  }
  if (roiValor !== null && vanValor < 0) {
    advertencias.push('El ROI es positivo pero el VAN es negativo: el ROI ignora el valor del dinero en el tiempo; decide con el VAN.')
  }

  // Criterio de decisión (teoría): manda el VAN; la TIR solo refuerza cuando es única.
  let veredicto
  let veredictoTexto
  if (vanValor > 0) {
    if (aceptaPorTir === false) {
      veredicto = 'warn'
      veredictoTexto = `El VAN es positivo, pero la TIR (${fmt(tAnual)}) no supera la tasa de descuento (${fmt(
        tasaAnual
      )}): los criterios no coinciden. Revisa los supuestos.`
    } else if (t.multiple) {
      veredicto = 'warn'
      veredictoTexto = `El VAN es positivo (${fmtDinero(vanValor)}), pero el flujo no es convencional y la TIR no es concluyente. Apóyate en el VAN y en la TIRM (${fmt(tirm)}).`
    } else {
      veredicto = 'good'
      veredictoTexto = `El VAN es positivo (${fmtDinero(vanValor)}) y la TIR (${fmt(tAnual)}) supera la tasa de descuento (${fmt(tasaAnual)}): el proyecto crea valor.`
    }
  } else if (vanValor < 0) {
    veredicto = 'bad'
    veredictoTexto = `El VAN es negativo (${fmtDinero(vanValor)}): a la tasa de descuento de ${fmt(tasaAnual)} el proyecto no recupera lo invertido.`
  } else {
    veredicto = 'warn'
    veredictoTexto = 'El VAN es cero: el proyecto es indiferente a la tasa de descuento, no genera ni destruye valor.'
  }

  return {
    ppy,
    unidad,
    inversion,
    tasaPeriodo: i,
    tasaAnual,
    tasaFin: iFin,
    tasaReinv: iReinv,
    van: vanValor,
    tir: t,
    tirAnual: tAnual,
    tirAnuales: tAnuales,
    tirm,
    tirmPeriodo: tirmP,
    pri,
    priDesc,
    roi: roiValor,
    ipr,
    nivelado,
    equilibrio,
    valorTerminal: vt,
    rescate: rescateValor,
    flujos,
    sumaFlujos: suma,
    gananciaNeta: suma - inversion,
    filas,
    sensibilidad: sens,
    perfil,
    advertencias,
    veredicto,
    veredictoTexto,
    aceptaPorVan,
    aceptaPorTir,
  }
}

// Formato interno auxiliar (porcentaje con punto decimal, en-US).
function fmt(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/D'
  return `${(v * 100).toFixed(2)}%`
}

// Formato interno auxiliar de dinero: $000,000,000.00 (en-US, dos decimales).
function fmtDinero(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/D'
  const n = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${v < 0 ? '-$' : '$'}${n}`
}
