// ============================================================================
// formato.test.js — Verifica el formato de cifras: $000,000,000.00, porcentajes
// con punto decimal, ejes compactos y el saneo de lo que escribe el usuario.
// ============================================================================
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fmtDinero,
  fmtPct,
  fmtFactor,
  fmtEje,
  normalizarNumero,
  formatearNumero,
  textoCampo,
  campoAlEscribir,
  campoAlConfirmar,
} from './formato.js'

test('fmtDinero: coma de millar, punto decimal y dos decimales', () => {
  assert.equal(fmtDinero(0), '$0.00')
  assert.equal(fmtDinero(38382.0962), '$38,382.10')
  assert.equal(fmtDinero(1234567.5), '$1,234,567.50')
  assert.equal(fmtDinero(999), '$999.00')
  assert.equal(fmtDinero(1000), '$1,000.00')
  assert.equal(fmtDinero(1234567890.129), '$1,234,567,890.13')
})

test('fmtDinero: los negativos van con el signo delante', () => {
  assert.equal(fmtDinero(-380), '-$380.00')
  assert.equal(fmtDinero(-1234.5), '-$1,234.50')
})

test('fmtDinero: sin número devuelve el guion largo', () => {
  assert.equal(fmtDinero(null), '—')
  assert.equal(fmtDinero(undefined), '—')
  assert.equal(fmtDinero(Number.NaN), '—')
  assert.equal(fmtDinero(Number.POSITIVE_INFINITY), '—')
})

test('fmtDinero: sin coma decimal en ningún importe', () => {
  for (const v of [0, 1, 999.999, 1234, -76543.21, 1e9]) {
    assert.doesNotMatch(fmtDinero(v), /\d,\d\d?$/)
    assert.match(fmtDinero(v), /^-?\$\d{1,3}(,\d{3})*\.\d{2}$/)
  }
})

test('fmtPct: porcentaje con punto decimal', () => {
  assert.equal(fmtPct(0.1803), '18.03%')
  assert.equal(fmtPct(0.12, 4), '12.0000%')
  assert.equal(fmtPct(-0.045), '-4.50%')
  assert.equal(fmtPct(0), '0.00%')
  assert.equal(fmtPct(null), 'N/D')
})

test('fmtFactor: cuatro decimales por defecto', () => {
  assert.equal(fmtFactor(1), '1.0000')
  assert.equal(fmtFactor(0.92783), '0.9278')
  assert.equal(fmtFactor(Number.NaN), '—')
})

test('fmtEje: forma compacta solo para los ejes', () => {
  assert.equal(fmtEje(250000), '$250 k')
  assert.equal(fmtEje(1300000), '$1.3 M')
  assert.equal(fmtEje(25000000), '$25 M')
  assert.equal(fmtEje(-250000), '-$250 k')
  assert.equal(fmtEje(450), '$450')
})

test('normalizarNumero: quita letras, símbolos y comas de millar', () => {
  assert.equal(normalizarNumero('1,250.5'), '1250.5')
  assert.equal(normalizarNumero('12,5'), '12.5')
  assert.equal(normalizarNumero('$ 250 000'), '250000')
  assert.equal(normalizarNumero('1.2.3'), '1.23')
  assert.equal(normalizarNumero('abc'), '')
  assert.equal(normalizarNumero(''), '')
})

test('normalizarNumero: un solo punto y el signo solo al principio', () => {
  assert.equal(normalizarNumero('-1,234.5'), '-1234.5')
  assert.equal(normalizarNumero('12-34'), '1234')
  assert.equal(normalizarNumero('-'), '-')
  assert.equal(normalizarNumero('.5'), '0.5')
})

test('normalizarNumero: sin negativos si el campo no los admite', () => {
  assert.equal(normalizarNumero('-250', { negativo: false }), '250')
})

test('formatearNumero: agrupa cada tres dígitos y fija los decimales', () => {
  assert.equal(formatearNumero(250000), '250,000.00')
  assert.equal(formatearNumero(250000, { decimales: 0 }), '250,000')
  assert.equal(formatearNumero(250000, { miles: false, decimales: 2 }), '250000.00')
  assert.equal(formatearNumero(-1234.567, { decimales: 2 }), '-1,234.57')
  assert.equal(formatearNumero(Number.NaN), '')
})

test('textoCampo: el valor del modelo se ve formateado en la caja', () => {
  assert.equal(textoCampo('250000'), '250,000.00')
  assert.equal(textoCampo(1234.5, { decimales: 2 }), '1,234.50')
  assert.equal(textoCampo(''), '')
  assert.equal(textoCampo(null), '')
  assert.equal(textoCampo('abc'), 'abc')
})

test('textoCampo: con prefijo de dinero muestra $250,000.00', () => {
  const op = { prefijo: '$' }
  assert.equal(textoCampo('250000', op), '$250,000.00')
  assert.equal(textoCampo(1234567.5, op), '$1,234,567.50')
  assert.equal(textoCampo(0, op), '$0.00')
  assert.equal(textoCampo('', op), '')
})

test('campoAlEscribir: limpia lo tecleado y conserva el prefijo $', () => {
  const op = { prefijo: '$' }
  assert.deepEqual(campoAlEscribir('$250000', op), { texto: '$250000', modelo: '250000' })
  assert.deepEqual(campoAlEscribir('250,000', op), { texto: '$250000', modelo: '250000' })
  assert.deepEqual(campoAlEscribir('$ 1 234,5', op), { texto: '$1234.5', modelo: '1234.5' })
  assert.deepEqual(campoAlEscribir('', op), { texto: '', modelo: '' })
  assert.deepEqual(campoAlEscribir('$', op), { texto: '', modelo: '' })
})

test('campoAlConfirmar: al salir agrupa y deja el modelo con punto decimal', () => {
  const op = { prefijo: '$', decimales: 2 }
  assert.deepEqual(campoAlConfirmar('$250000', op), { texto: '$250,000.00', modelo: '250000.00' })
  assert.deepEqual(campoAlConfirmar('250,000', op), { texto: '$250,000.00', modelo: '250000.00' })
  assert.deepEqual(campoAlConfirmar('$1234,5', op), { texto: '$1,234.50', modelo: '1234.50' })
  assert.deepEqual(campoAlConfirmar('-4000', { prefijo: '$' }), { texto: '-$4,000.00', modelo: '-4000.00' })
  assert.deepEqual(campoAlConfirmar('$  ', op), { texto: '', modelo: '' })
  assert.deepEqual(campoAlConfirmar('abc', op), { texto: '', modelo: '' })
  assert.deepEqual(campoAlConfirmar('', op), { texto: '', modelo: '' })
})

test('campoAlConfirmar: sin prefijo no añade nada', () => {
  assert.deepEqual(campoAlConfirmar('12', { decimales: 2 }), { texto: '12.00', modelo: '12.00' })
  assert.deepEqual(campoAlConfirmar('8,5', { decimales: 2 }), { texto: '8.50', modelo: '8.50' })
})

test('campoAlEscribir: teclear cifras seguidas no pierde ningún dígito', () => {
  // Regresión del aviso del usuario: si la caja se reescribiera agrupando en cada
  // pulsación, al añadir un dígito a '250,000.00' se redondearía y la caja
  // parecería no aceptar cifras. Tecleando no se agrupa; solo se limpia.
  const op = { prefijo: '$' }
  let texto = ''
  for (const d of ['2', '5', '0', '0', '0', '0']) {
    const r = campoAlEscribir(texto + d, op)
    texto = r.texto
  }
  assert.equal(texto, '$250000')
  // Y al confirmar se agrupa una sola vez, sin perder nada. El modelo vuelve a
  // punto decimal con los decimales ya fijados ('250000.00' es el mismo número).
  assert.deepEqual(campoAlConfirmar(texto, op), { texto: '$250,000.00', modelo: '250000.00' })
})
