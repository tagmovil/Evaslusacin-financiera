// ============================================================================
// inversion.test.js — Verificación de la teoría financiera (node:test, Node 26).
// Ejecutar desde app\: npm test
// Cada test compara contra el valor calculado A MANO con las fórmulas clásicas
// (VAN, TIR, TIRM, PRI, ROI, IPR, CAPM/CMPC, factor de anualidad, conversiones de
// tasa) y contra las propiedades matemáticas que deben cumplirse siempre.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  periodosPorAnio,
  tasaAPeriodica,
  tasaAAnual,
  factorAnualidad,
  valorPresente,
  van,
  serieVan,
  cambiosDeSigno,
  tir,
  tirModificada,
  periodoRecuperacion,
  roi,
  indiceRentabilidad,
  flujoNivelado,
  valorTerminal,
  cmmpc,
  perfilVan,
  puntoEquilibrio,
  sensibilidad,
  evaluarProyecto,
} from './inversion.js'

const cerca = (a, b, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtenido ${a}`)

// Caso base del enunciado: I0 = 250 000, 5 años, flujo uniforme de 80 000,
// tasa de descuento 12% anual.
const INV = 250000
const FLUJOS = [80000, 80000, 80000, 80000, 80000]

// --- Unidades y conversión de tasas -----------------------------------------
test('unidades: periodos por año de cada unidad', () => {
  assert.equal(periodosPorAnio('año'), 1)
  assert.equal(periodosPorAnio('semestre'), 2)
  assert.equal(periodosPorAnio('trimestre'), 4)
  assert.equal(periodosPorAnio('mes'), 12)
  assert.throws(() => periodosPorAnio('decada'), /Unidad de periodo desconocida/)
})

test('tasa: conversión anual ↔ periodo con la equivalencia compuesta', () => {
  // 12% anual = (1.12)^(1/12) - 1 = 0.00948879... mensual
  const m = tasaAPeriodica(0.12, 12)
  cerca(m, 0.0094887929, 1e-9)
  // La vuelta debe recuperar exactamente la tasa anual (ley de potencia).
  cerca(tasaAAnual(m, 12), 0.12, 1e-12)
  cerca(tasaAPeriodica(0.12, 1), 0.12)
  cerca(tasaAAnual(0.06, 2), Math.pow(1.06, 2) - 1, 1e-12)
  assert.throws(() => tasaAPeriodica(-1, 1), /-100/)
})

test('tasa: 12% anual NO es 12% mensual (el error del HTML de referencia)', () => {
  // Un año de 12 pagos mensuales de 100 con I0 = 1000:
  //   - con la tasa mensual correcta (0,9488%) el VAN es +129,15 -> viable;
  //   - aplicando el 12% anual a cada mes el VAN es -380,56 -> se rechaza.
  // Es el mismo programa con decisiones opuestas: por eso la conversión es obligatoria.
  const correcto = van(tasaAPeriodica(0.12, 12), 1000, new Array(12).fill(100))
  const erroneo = van(0.12, 1000, new Array(12).fill(100))
  cerca(correcto, 129.1516, 1e-3)
  cerca(erroneo, -380.5626, 1e-3)
  assert.ok(correcto > 0 && erroneo < 0)
})

// --- VAN ---------------------------------------------------------------------
test('VAN: caso base a mano = 38 382,10', () => {
  // 80 000 x a(12%,5) = 80 000 x 3,6047762 = 288 382,10; menos 250 000 => 38 382,10
  // Desglose: 71 428,57 + 63 775,51 + 56 942,42 + 50 841,45 + 45 393,26
  const v = van(0.12, INV, FLUJOS)
  cerca(v, 38382.0962, 1e-3)
  // Comprobación directa con la suma de factores de descuento.
  const manual = -INV + 80000 * (1 / 1.12 + 1 / 1.12 ** 2 + 1 / 1.12 ** 3 + 1 / 1.12 ** 4 + 1 / 1.12 ** 5)
  cerca(v, manual, 1e-9)
})

test('VAN: tasa 0 => suma de flujos menos inversión', () => {
  cerca(van(0, INV, FLUJOS), 400000 - INV, 1e-9)
})

test('VAN: serie por periodo cuadra con el VAN total', () => {
  const filas = serieVan(0.12, INV, FLUJOS)
  assert.equal(filas.length, 5)
  assert.equal(filas[0].periodo, 1)
  cerca(filas[0].factor, 1 / 1.12, 1e-12)
  cerca(filas[0].vp, 71428.5714, 1e-4)
  // El VAN acumulado del último periodo es el VAN total.
  cerca(filas[4].vanAcum, van(0.12, INV, FLUJOS), 1e-9)
  // El acumulado sin descontar empieza en -I0 y termina en la ganancia neta.
  cerca(filas[0].acum, -INV + 80000, 1e-9)
  cerca(filas[4].acum, 400000 - INV, 1e-9)
  cerca(filas[4].acumDisc, van(0.12, INV, FLUJOS), 1e-9)
})

test('VAN: proyecto con VAN cero es indiferente', () => {
  // -1000 + 1100/1,10 = 0
  cerca(van(0.1, 1000, [1100]), 0, 1e-9)
})

// --- TIR ---------------------------------------------------------------------
test('TIR: caso base a mano = 18,03% anual', () => {
  // -250 000 + 80 000 * a(5, r) = 0  ->  a(5, r) = 3,125
  // Se comprueba que a(5, 18,03%) = 3,125 y que en esa tasa el VAN es cero.
  const t = tir(INV, FLUJOS)
  assert.equal(t.existe, true)
  assert.equal(t.multiple, false)
  assert.equal(t.cambios, 1)
  cerca(t.valor, 0.1803, 1e-4)
  // Propiedad definitoria: en la TIR el VAN es exactamente cero.
  cerca(van(t.valor, INV, FLUJOS), 0, 1e-4)
  // Y la ecuación de renta se satisface: I0 = flujo * a(n, r).
  const a = factorAnualidad(t.valor, 5)
  cerca(INV, 80000 * a, 1e-3)
  cerca(a, 3.125, 1e-4)
  // La TIR (18,03%) supera la tasa de descuento (12%): el proyecto se acepta.
  assert.ok(t.valor > 0.12)
})

test('TIR: la tasa mensual se anualiza por potencia compuesta', () => {
  // 12 flujos de 10 000 e inversión 100 000: TIR mensual 2,92285% (la renta
  // debe cubrir 10 periodos de capital: a(2,92285%,12) = 10).
  const t = tir(100000, new Array(12).fill(10000))
  cerca(t.valor, 0.0292285, 1e-6)
  cerca(100000 / 10000, factorAnualidad(t.valor, 12), 1e-4)
  const anual = tasaAAnual(t.valor, 12)
  cerca(anual, Math.pow(1.0292285407715163, 12) - 1, 1e-12)
  cerca(anual, 0.41299898, 1e-7) // 41,30% anual efectivo
  // La TIR del periodo nunca debe mostrarse como si fuera la anual.
  assert.ok(anual > t.valor)
})

test('TIR: un solo cambio de signo da una única raíz (Descartes)', () => {
  assert.equal(cambiosDeSigno([-1000, 500, 500, 500]), 1)
  assert.equal(cambiosDeSigno([-1000, 500, -200, 800]), 3)
  assert.equal(cambiosDeSigno([100, 200]), 0)
  assert.equal(cambiosDeSigno([-100, 0, 300]), 1) // los ceros no cuentan
  assert.equal(cambiosDeSigno([-100, -200]), 0)
})

test('TIR: flujo no convencional reporta las dos raíces', () => {
  // Caso clásico de Brigham: -100, +230, -132 -> TIR 10% y 20%
  const t = tir(100, [230, -132])
  assert.equal(t.existe, true)
  assert.equal(t.multiple, true)
  assert.equal(t.raices.length, 2)
  cerca(t.raices[0], 0.1, 1e-6)
  cerca(t.raices[1], 0.2, 1e-6)
  cerca(van(0.1, 100, [230, -132]), 0, 1e-6)
  cerca(van(0.2, 100, [230, -132]), 0, 1e-6)
})

test('TIR: sin cambio de signo (solo salidas) no existe TIR', () => {
  const t = tir(1000, [-300, -300]) // nunca hay entradas: el VAN siempre es negativo
  assert.equal(t.existe, false)
  assert.equal(t.valor, null)
  assert.equal(t.cambios, 0)
  assert.match(t.motivo, /No existe TIR/)
})

test('TIR: si no se recupera, la TIR existe pero es negativa', () => {
  // I0 = 1000 y dos flujos de 300: con un solo cambio de signo la TIR es real,
  // pero cae por debajo de 0% (el proyecto no recupera ni a tasa de descuento 0).
  const t = tir(1000, [300, 300])
  assert.equal(t.existe, true)
  assert.equal(t.multiple, false)
  assert.ok(t.valor < 0)
  cerca(van(t.valor, 1000, [300, 300]), 0, 1e-6)
  // A tasa 0 el VAN sigue siendo negativo, de ahí que la TIR sea negativa.
  assert.ok(van(0, 1000, [300, 300]) < 0)
})

test('TIR: sin inversión inicial positiva no hay TIR', () => {
  const t = tir(0, [100, 100])
  assert.equal(t.existe, false)
  assert.match(t.motivo, /inversión inicial positiva/)
})

// --- TIRM --------------------------------------------------------------------
test('TIRM: iguala el VF de las entradas con el VP de las salidas', () => {
  // I0 = 100 (t=0) y un único flujo de 240 (t=2) con tasas 0:
  // VF(+) = 240, VP(-) = 100  ->  TIRM = (240/100)^(1/2) - 1 = 54,92%
  const m = tirModificada(100, [0, 240], 0, 0)
  cerca(m, Math.sqrt(2.4) - 1, 1e-12)
  cerca(m, 0.5491933, 1e-7)
  // Con salidas operativas y tasas distintas (10% financiamiento / 10% reinversión):
  // I0 = 100 (t=0) y flujos -100 (t=1) y +300 (t=2)
  // VP(-) = 100 + 100/1,1 = 190,909;  VF(+) = 300  ->  TIRM = (300/190,909)^(1/2)-1
  const m2 = tirModificada(100, [-100, 300], 0.1, 0.1)
  const vpNeg = 100 + 100 / 1.1
  cerca(m2, Math.pow(300 / vpNeg, 1 / 2) - 1, 1e-12)
  cerca(m2, 0.2535663, 1e-6)
  // Propiedad: al capitalizar la TIRM las entradas igualan a las salidas.
  // VF(+) = 300 ; VP(-)·(1+TIRM)² = (100 + 100/1,1)·(1,2535663)² = 300
  cerca(300, vpNeg * Math.pow(1 + m2, 2), 1e-6)
})

test('TIRM: sin entradas no se puede calcular', () => {
  assert.equal(tirModificada(100, [0, 0], 0.1, 0.1), null)
  assert.equal(tirModificada(100, [-50, -60], 0.1, 0.1), null)
})

test('TIRM: con solo flujos positivos iguala el futuro de la inversión a las entradas', () => {
  // I0 = 100 (t=0) y 110 al final del periodo 2: TIRM = (110/100)^(1/2)-1 = 4,88%
  const m = tirModificada(100, [0, 110], 0.1, 0.1)
  cerca(m, Math.pow(1.1, 0.5) - 1, 1e-12)
})

// --- PRI ---------------------------------------------------------------------
test('PRI: caso base a mano = 3,125 años', () => {
  // 250 000 / 80 000 = 3,125 periodos
  const p = periodoRecuperacion(INV, FLUJOS)
  assert.equal(p.recupera, true)
  cerca(p.periodos, 3.125, 1e-12)
  assert.equal(p.periodo, 4)
  assert.equal(p.sostenido, true)
})

test('PRI: interpolación correcta cuando el cruce cae dentro de un periodo', () => {
  // I0 = 1000, flujos 400, 400, 400 -> tras 2 periodos faltan 200, el 3º aporta 400
  const p = periodoRecuperacion(1000, [400, 400, 400])
  cerca(p.periodos, 2 + 200 / 400, 1e-12)
})

test('PRI: no se recupera dentro del horizonte', () => {
  const p = periodoRecuperacion(1000, [100, 100])
  assert.equal(p.recupera, false)
  assert.equal(p.periodos, null)
})

test('PRI: descontado es posterior al simple (el valor del dinero en el tiempo)', () => {
  const simple = periodoRecuperacion(INV, FLUJOS)
  const desc = periodoRecuperacion(INV, FLUJOS, { tasa: 0.12, descontado: true })
  assert.equal(simple.recupera, true)
  assert.equal(desc.recupera, true)
  cerca(simple.periodos, 3.125, 1e-12)
  // Descontando, al final del año 4 faltan 7 012,08 y el año 5 aporta 45 393,26:
  // 4 + 7 012,08/45 393,26 = 4,1545 años.
  cerca(desc.periodos, 4.1544704, 1e-6)
  assert.ok(desc.periodos > simple.periodos)
})

test('PRI: recuperación no sostenida cuando el acumulado vuelve a caer', () => {
  // I0 = 1000: 1) 600 -> -400, 2) 600 -> 200 (recuperado), 3) -500 -> -300
  const p = periodoRecuperacion(1000, [600, 600, -500])
  assert.equal(p.recupera, true)
  assert.equal(p.sostenido, false)
})

// --- ROI, IPR y flujo nivelado ----------------------------------------------
test('ROI: (Σ flujos - I0)/I0', () => {
  cerca(roi(INV, FLUJOS), (400000 - INV) / INV, 1e-12)
  assert.equal(roi(0, [100]), null) // sin inversión el ROI no está definido
})

test('IPR: VAF/IA > 1 equivale a VAN > 0', () => {
  const ipr = indiceRentabilidad(0.12, INV, FLUJOS)
  // 288 382,10 / 250 000 = 1,153528...
  cerca(ipr, 1.1535284, 1e-7)
  assert.equal(ipr > 1, van(0.12, INV, FLUJOS) > 0)
  // Con un flujo menor el IPR cae por debajo de 1 y el VAN es negativo.
  const malos = [30000, 30000, 30000, 30000, 30000]
  assert.ok(indiceRentabilidad(0.12, INV, malos) < 1)
  assert.ok(van(0.12, INV, malos) < 0)
})

test('flujo nivelado: renta equivalente con el mismo VAN', () => {
  // VAN = 38 382,10; a(12%,5) = 3,6047762 -> 10 647,57
  const n = flujoNivelado(van(0.12, INV, FLUJOS), 0.12, 5)
  cerca(n, 10647.5670, 1e-4)
  // Esa renta, sola, tiene el mismo VAN que el proyecto original.
  cerca(van(0.12, 0, new Array(5).fill(n)), van(0.12, INV, FLUJOS), 1e-6)
})

test('factor de anualidad: valor a tasa 0 es n y coincide con la fórmula', () => {
  assert.equal(factorAnualidad(0, 5), 5)
  cerca(factorAnualidad(0.12, 5), (1 - Math.pow(1.12, -5)) / 0.12, 1e-12)
  cerca(factorAnualidad(0.12, 5), 3.604776, 1e-6)
})

test('valor terminal de Gordon exige tasa > crecimiento', () => {
  // VT = FC*(1+g)/(i-g) = 1000*1,03/(0,12-0,03) = 11 444,44
  cerca(valorTerminal(1000, 0.12, 0.03), 11444.4444, 1e-3)
  assert.equal(valorTerminal(1000, 0.03, 0.05), null)
})

// --- CMPC (CAPM) -------------------------------------------------------------
test('CMPC: ponderación de CAPM y deuda con escudo fiscal', () => {
  const r = cmmpc({
    tasaLibreRiesgo: 0.08,
    beta: 1.2,
    primaMercado: 0.14,
    costoDeuda: 0.1,
    tasaImpuestos: 0.3,
    valorPatrimonio: 600000,
    valorDeuda: 400000,
  })
  // ke = 0,08 + 1,2*(0,14-0,08) = 0,152
  cerca(r.ke, 0.152, 1e-12)
  cerca(r.wE, 0.6, 1e-12)
  cerca(r.wD, 0.4, 1e-12)
  cerca(r.kdNeto, 0.07, 1e-12)
  // CMPC = 0,6*0,152 + 0,4*0,07 = 0,1192
  cerca(r.cmmpc, 0.1192, 1e-12)
  assert.throws(() => cmmpc({
    tasaLibreRiesgo: 0.08, beta: 1, primaMercado: 0.1, costoDeuda: 0.1,
    tasaImpuestos: 0.3, valorPatrimonio: 0, valorDeuda: 0,
  }), /estructura de capital/)
})

// --- Punto de equilibrio y sensibilidad --------------------------------------
test('punto de equilibrio: inversión máxima = VAF y flujo crítico = I0/a(n,i)', () => {
  const eq = puntoEquilibrio(INV, FLUJOS, 0.12)
  // VAF = 288 382,10
  cerca(eq.inversionMaxima, 288382.0962, 1e-3)
  // Se podría invertir 38 382,10 más sin que el VAN deje de ser positivo.
  cerca(eq.inversionTolera, 38382.0962, 1e-3)
  // 250 000 / 3,6047762 = 69 352,43
  cerca(eq.flujoCritico, 69352.4330, 1e-3)
  cerca(eq.margenSeguridad, 0.1535284, 1e-6)
  // Con el flujo crítico el VAN es cero (punto de equilibrio por definición).
  cerca(van(0.12, INV, new Array(5).fill(eq.flujoCritico)), 0, 1e-6)
})

test('sensibilidad: el signo del VAN cambia respecto al equilibrio', () => {
  const filas = sensibilidad(INV, FLUJOS, { ppy: 1, tasa: 0.12 })
  const tasa = filas.filter((f) => f.variable === 'Tasa de descuento')
  assert.equal(tasa.length, 5)
  assert.equal(tasa[2].acepta, true) // 12% (actual)
  assert.equal(tasa[0].acepta, true) // 4%
  // A 20% (TIR + 4 p.p. = 22,03%) el proyecto ya no se acepta: VAN negativo.
  assert.equal(tasa[4].acepta, false)
  assert.ok(tasa[4].van < 0)
  // Menos flujos => VAN negativo; más flujos => positivo.
  const flujos = filas.filter((f) => f.variable === 'Flujos netos')
  assert.equal(flujos[0].acepta, false) // -20%
  assert.equal(flujos[4].acepta, true) // +20%
  // Más inversión (+20%) => VAN negativo; menos inversión => positivo.
  const inv = filas.filter((f) => f.variable === 'Inversión inicial')
  assert.equal(inv[0].acepta, true) // -20%
  assert.equal(inv[4].acepta, false) // +20%
  // El VAN baja al subir la tasa: el perfil es decreciente.
  for (let k = 1; k < tasa.length; k++) assert.ok(tasa[k].van < tasa[k - 1].van)
})

test('perfil del VAN: cruza cero en la TIR', () => {
  const puntos = perfilVan(INV, FLUJOS, { ppy: 1, tasaActual: 0.12, pasos: 400, maxTasa: 1 })
  const t = tir(INV, FLUJOS)
  // VAN(0%) = 150 000 > 0 y VAN(100%) = -172 500 < 0: el perfil es decreciente.
  const v0 = van(0, INV, FLUJOS)
  const v1 = van(tasaAPeriodica(1, 1), INV, FLUJOS)
  cerca(v0, 150000, 1e-6)
  cerca(v1, -172500, 1e-6)
  for (let k = 1; k < puntos.length; k++) assert.ok(puntos[k].van < puntos[k - 1].van)
  // La tasa actual está en la lista y su VAN coincide con el cálculo directo.
  const actual = puntos.find((p) => p.tasa === 0.12)
  assert.equal(actual !== undefined, true)
  cerca(actual.van, van(0.12, INV, FLUJOS), 1e-6)
  // El punto de la malla más cercano a la TIR está prácticamente en cero.
  const cercaTir = puntos.reduce((a, b) => (Math.abs(b.tasa - t.valor) < Math.abs(a.tasa - t.valor) ? b : a))
  assert.ok(Math.abs(cercaTir.tasa - t.valor) < 0.005)
  assert.ok(Math.abs(cercaTir.van) < 5000)
  // Con la tasa mensual equivalente el perfil anual conserva los mismos valores.
  const mensual = perfilVan(INV, new Array(60).fill(13333.33), { ppy: 12, tasaActual: 0.12 })
  const p12 = mensual.find((p) => p.tasa === 0.12)
  cerca(p12.van, van(tasaAPeriodica(0.12, 12), INV, new Array(60).fill(13333.33)), 1e-6)
})

// --- Evaluación completa -----------------------------------------------------
test('evaluarProyecto: caso base acepta el proyecto', () => {
  const r = evaluarProyecto({ inversion: INV, flujos: FLUJOS, tasaAnual: 0.12, unidad: 'año' })
  assert.equal(r.veredicto, 'good')
  assert.equal(r.aceptaPorVan, true)
  assert.equal(r.aceptaPorTir, true)
  cerca(r.van, 38382.0962, 1e-3)
  cerca(r.tirAnual, 0.1803, 1e-4)
  cerca(r.pri.periodos, 3.125, 1e-12)
  cerca(r.priDesc.periodos, 4.1544704, 1e-6)
  cerca(r.roi, 0.6, 1e-12)
  cerca(r.sumaFlujos, 400000, 1e-9)
  cerca(r.gananciaNeta, 150000, 1e-9)
  cerca(r.tasaPeriodo, 0.12, 1e-12) // en años la tasa del periodo es la anual
  assert.equal(r.advertencias.length, 0)
  assert.ok(r.perfil.length > 100)
  assert.equal(r.sensibilidad.length, 15)
  assert.equal(r.filas.length, 5)
  // Coherencia entre métricas: IPR = 1 + VAN/I0 y flujo nivelado = VAN/a(n,i).
  cerca(r.ipr, 1 + r.van / INV, 1e-12)
  cerca(r.nivelado, r.van / factorAnualidad(0.12, 5), 1e-9)
})

test('evaluarProyecto: en meses usa la tasa mensual y anualiza la TIR', () => {
  const r = evaluarProyecto({
    inversion: 250000,
    flujos: new Array(60).fill(13333.33),
    tasaAnual: 0.12,
    unidad: 'mes',
  })
  // Tasa del periodo = (1,12)^(1/12)-1 = 0,9488% mensual
  cerca(r.tasaPeriodo, 0.0094887929, 1e-9)
  // Con la tasa mensual correcta el programa es viable; con la anual aplicada
  // mes a mes el VAN sería mucho mayor (error del HTML de referencia).
  assert.equal(r.aceptaPorVan, true)
  // TIR expresada en la unidad de los flujos y su equivalente anual.
  assert.ok(r.tirAnual > r.tir.valor)
  cerca(r.tirAnual, tasaAAnual(r.tir.valor, 12), 1e-12)
})

test('evaluarProyecto: rechaza cuando el VAN es negativo aunque el ROI sea positivo', () => {
  // I0 = 1000 y un solo flujo de 1 100 al final: ROI = +10% pero VAN = -17,86 a 12%.
  const r = evaluarProyecto({ inversion: 1000, flujos: [1100], tasaAnual: 0.12, unidad: 'año' })
  cerca(r.roi, 0.1, 1e-12)
  cerca(r.van, -17.8571, 1e-3)
  assert.equal(r.veredicto, 'bad')
  assert.ok(r.advertencias.some((a) => /ROI es positivo pero el VAN es negativo/.test(a)))
})

test('evaluarProyecto: TIR múltiple con VAN negativo => rechaza y avisa del conflicto', () => {
  const r = evaluarProyecto({ inversion: 100, flujos: [230, -132], tasaAnual: 0.05, unidad: 'año' })
  assert.equal(r.tir.multiple, true)
  assert.equal(r.aceptaPorVan, false)
  assert.equal(r.aceptaPorTir, null) // con varias TIR el criterio no aplica
  assert.ok(r.van < 0)
  assert.equal(r.veredicto, 'bad') // manda el VAN
  assert.ok(r.tirm !== null && r.tirm > 0)
  assert.ok(r.advertencias.some((a) => /no es convencional/.test(a)))
  // Una de las TIR (20%) supera el 5%: se documenta el conflicto y se mantiene el VAN.
  assert.ok(r.advertencias.some((a) => /Conflicto entre criterios/.test(a)))
})

test('evaluarProyecto: TIR múltiple con VAN positivo => veredicto de advertencia', () => {
  // A 15% el VAN es +0,19 pero hay dos TIR (10% y 20%): la TIR no decide.
  const r = evaluarProyecto({ inversion: 100, flujos: [230, -132], tasaAnual: 0.15, unidad: 'año' })
  assert.ok(r.van > 0)
  assert.equal(r.tir.multiple, true)
  assert.equal(r.veredicto, 'warn')
  assert.match(r.veredictoTexto, /no es concluyente/)
})

test('evaluarProyecto: PRI no alcanzado genera aviso', () => {
  const r = evaluarProyecto({
    inversion: 1000,
    flujos: [100, 100, 100],
    tasaAnual: 0.1,
    unidad: 'año',
  })
  assert.equal(r.veredicto, 'bad')
  assert.equal(r.pri.recupera, false)
  assert.ok(r.advertencias.some((a) => /PRI no se alcanza/.test(a)))
})

test('evaluarProyecto: a tasa 0 el VAN es la ganancia neta y la TIR sigue siendo 18,03%', () => {
  const r = evaluarProyecto({ inversion: INV, flujos: FLUJOS, tasaAnual: 0, unidad: 'año' })
  cerca(r.van, 150000, 1e-9) // Σ flujos - I0
  cerca(r.roi, 0.6, 1e-12) // (400 000 - 250 000)/250 000
  cerca(r.tasaPeriodo, 0, 1e-15)
  // El ROI (60% total) NO es la TIR: la TIR es la tasa que anula el VAN.
  cerca(r.tirAnual, 0.1803, 1e-4)
  cerca(van(r.tirAnual, INV, FLUJOS), 0, 1e-4)
  // A tasa 0 el factor de anualidad es n, luego el flujo nivelado es la ganancia media.
  cerca(r.nivelado, 150000 / 5, 1e-9)
})

test('valor terminal: se suma al último flujo y exige tasa > crecimiento', () => {
  // 80 000 perpetuos creciendo 3% anual, descontados al 12%: VT = 80 000*1,03/0,09
  const r = evaluarProyecto({
    inversion: INV,
    flujos: FLUJOS,
    tasaAnual: 0.12,
    unidad: 'año',
    crecimientoAnual: 0.03,
  })
  cerca(r.valorTerminal, 915555.5556, 1e-3)
  // El último flujo pasa de 80 000 a 995 555,56 y el VAN sube en su valor presente.
  cerca(r.filas[4].flujo, 80000 + r.valorTerminal, 1e-6)
  const vtDescontado = (r.valorTerminal) / Math.pow(1.12, 5)
  cerca(r.van, van(0.12, INV, FLUJOS) + vtDescontado, 1e-6)
  // Con crecimiento mayor que la tasa el modelo de Gordon no aplica.
  const r2 = evaluarProyecto({
    inversion: INV,
    flujos: FLUJOS,
    tasaAnual: 0.05,
    unidad: 'año',
    crecimientoAnual: 0.08,
  })
  assert.equal(r2.valorTerminal, null)
  cerca(r2.van, van(0.05, INV, FLUJOS), 1e-9)
  assert.ok(r2.advertencias.some((a) => /Gordon no se aplica/.test(a)))
  // Sin crecimiento no hay valor terminal.
  const r3 = evaluarProyecto({ inversion: INV, flujos: FLUJOS, tasaAnual: 0.12 })
  assert.equal(r3.valorTerminal, null)
})

test('el valor de rescate se suma al último flujo sin crecerlo', () => {
  // El rescate es un cobro de liquidación: entra solo en el último periodo.
  const r = evaluarProyecto({ inversion: INV, flujos: FLUJOS, tasaAnual: 0.12, rescate: 50000 })
  cerca(r.filas[4].flujo, 130000, 1e-9)
  cerca(r.filas[0].flujo, 80000, 1e-9)
  cerca(r.van, van(0.12, INV, [...FLUJOS.slice(0, 4), 130000]), 1e-9)
  cerca(r.rescate, 50000, 1e-9)
})

test('el valor terminal se calcula sobre el flujo operativo, no sobre el rescate', () => {
  // VT = 80 000*1,03/(0,12-0,03) = 915 555,56 (el rescate NO crece perpetuamente).
  const r = evaluarProyecto({
    inversion: INV,
    flujos: FLUJOS,
    tasaAnual: 0.12,
    rescate: 50000,
    crecimientoAnual: 0.03,
  })
  cerca(r.valorTerminal, 915555.5556, 1e-3)
  cerca(r.filas[4].flujo, 130000 + r.valorTerminal, 1e-6)
  cerca(
    r.van,
    van(0.12, INV, [...FLUJOS.slice(0, 4), 130000]) + r.valorTerminal / Math.pow(1.12, 5),
    1e-6
  )
  // Usar rescate y valor terminal a la vez duplica el final del proyecto: se avisa.
  assert.ok(r.advertencias.some((a) => /rescate y el valor terminal/.test(a)))
  // Sin rescate no se avisa.
  const r2 = evaluarProyecto({ inversion: INV, flujos: FLUJOS, tasaAnual: 0.12, crecimientoAnual: 0.03 })
  assert.ok(!r2.advertencias.some((a) => /rescate y el valor terminal/.test(a)))
})

test('valorPresente: la serie suma coincide con el VAN restando la inversión', () => {
  const vpf = valorPresente(0.12, FLUJOS)
  cerca(vpf - INV, van(0.12, INV, FLUJOS), 1e-9)
})
