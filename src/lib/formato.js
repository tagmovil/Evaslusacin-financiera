// ============================================================================
// formato.js — Formato de cifras de la calculadora (todo en en-US).
// ----------------------------------------------------------------------------
// Reglas de la casa:
//   - Dinero: `$000,000,000.00` (coma de millar, punto decimal, 2 decimales).
//   - Porcentajes y factores: punto decimal.
//   - Solo los ejes de las gráficas usan forma compacta (`$250 k`, `$1.3 M`).
//   - Captura de datos: las cajas muestran comas cada 3 dígitos; el valor del
//     modelo siempre es un string numérico con punto decimal.
// ============================================================================

/** Dinero: $000,000,000.00 (los negativos con el signo delante: -$1,000.00). */
export function fmtDinero(v, dec = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const n = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
  return `${v < 0 ? '-$' : '$'}${n}`
}

/** Porcentaje con punto decimal: 0.1803 → '18.03%'. */
export function fmtPct(v, dec = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return 'N/D'
  return `${(v * 100).toFixed(dec)}%`
}

/** Factor: 1.0000, 0.9278… */
export function fmtFactor(v, dec = 4) {
  return Number.isFinite(v) ? v.toFixed(dec) : '—'
}

/** Eje de gráfica: 1_250_000 → '$1.3 M', 250_000 → '$250 k'. */
export function fmtEje(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  const signo = v < 0 ? '-' : ''
  if (a >= 1e6) return `${signo}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)} M`
  if (a >= 1e3) return `${signo}$${(a / 1e3).toFixed(0)} k`
  return `${signo}$${a.toFixed(0)}`
}

/**
 * Limpia lo que escribe el usuario y devuelve un string numérico con punto.
 * La coma es separador de millar (es lo que ve en la propia caja): '1,250.5' →
 * '1250.5'. Si no hay punto y el último grupo tras la coma es de 1 o 2
 * dígitos, se toma como decimal ('1,25' → '1.25'), que es lo que escribe quien
 * usa coma decimal. El signo solo vale al principio: '-4000' → '-4000'.
 */
export function normalizarNumero(s, opciones = {}) {
  const { negativo = true } = opciones
  const bruto = String(s ?? '').replace(/[^\d.,-]/g, '')
  const signo = negativo && bruto.startsWith('-') ? '-' : ''
  let cuerpo = bruto.replace(/-/g, '')

  const punto = cuerpo.indexOf('.')
  if (punto === -1 && cuerpo.includes(',')) {
    const grupos = cuerpo.split(',')
    const ultimo = grupos[grupos.length - 1]
    if (grupos.length > 1 && ultimo.length !== 3) {
      // coma decimal: se deja el último grupo como parte decimal.
      cuerpo = `${grupos.slice(0, -1).join('') ?? ''}.${ultimo}`
    } else {
      cuerpo = cuerpo.replace(/,/g, '')
    }
  } else {
    cuerpo = cuerpo.replace(/,/g, '')
  }

  // Un solo punto decimal: los sobrantes se concatenan (1.2.3 → 1.23).
  const [ent, ...resto] = cuerpo.split('.')
  cuerpo = resto.length ? `${ent}.${resto.join('')}` : ent
  if (cuerpo === '' || cuerpo === '.') return signo
  return signo + (ent === '' ? `0${cuerpo}` : cuerpo)
}

/** Agrupa con comas y fija los decimales pedidos: 250000 → '250,000.00'. */
export function formatearNumero(n, opciones = {}) {
  const { decimales = 2, miles = true } = opciones
  if (!Number.isFinite(n)) return ''
  return miles
    ? n.toLocaleString('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
    : n.toFixed(decimales)
}

/**
 * Texto inicial de una caja a partir del valor del modelo, con el prefijo
 * delante si lo hay: 250000 → '$250,000.00'.
 */
export function textoCampo(valor, opciones = {}) {
  const { prefijo = '' } = opciones
  if (valor === null || valor === undefined || valor === '') return ''
  const n = Number(valor)
  if (!Number.isFinite(n)) return String(valor)
  return conPrefijo(prefijo, formatearNumero(n, opciones))
}

/** Quita el prefijo del texto tecleado para poder normalizarlo como número. */
function sinPrefijo(valor, prefijo) {
  const s = String(valor ?? '')
  return prefijo && s.startsWith(prefijo) ? s.slice(prefijo.length) : s
}

/** Pega el prefijo delante del número, con el signo antes del prefijo: -$4,000.00 */
function conPrefijo(prefijo, cuerpo) {
  if (cuerpo === '') return ''
  const signo = cuerpo.startsWith('-') ? '-' : ''
  return `${signo}${prefijo}${signo ? cuerpo.slice(1) : cuerpo}`
}

/**
 * Estado de la caja en cada pulsación: se limpian los caracteres sobrantes y ya
 * está. Aquí NO se agrupa, porque si se reescribiera con comas el dígito nuevo se
 * redondearía al instante y la caja parecería no aceptar cifras.
 * El prefijo ($) se mantiene delante para que nunca desaparezca al teclear.
 * Devuelve `{ texto, modelo }` con el texto a pintar y el valor a emitir.
 */
export function campoAlEscribir(valor, opciones = {}) {
  const { prefijo = '' } = opciones
  const limpio = normalizarNumero(sinPrefijo(valor, prefijo), opciones)
  return { texto: conPrefijo(prefijo, limpio), modelo: limpio }
}

/**
 * Estado de la caja al confirmar (salir del campo o pulsar Enter): agrupa las
 * cifras y fija los decimales. `modelo` vuelve a punto decimal para la app.
 * Si lo tecleado no es un número devuelve `{ texto: '', modelo: '' }`.
 */
export function campoAlConfirmar(valor, opciones = {}) {
  const { prefijo = '' } = opciones
  const limpio = normalizarNumero(sinPrefijo(valor, prefijo), opciones)
  if (limpio === '' || limpio === '-') return { texto: '', modelo: '' }
  const n = Number(limpio)
  if (!Number.isFinite(n)) return { texto: '', modelo: '' }
  const texto = conPrefijo(prefijo, formatearNumero(n, opciones))
  return { texto, modelo: normalizarNumero(texto, opciones) }
}
