<script setup>
// ============================================================================
// CampoNumero.vue — Casilla de captura numérica con cifras agrupadas.
// ----------------------------------------------------------------------------
/* El valor del modelo (modelValue) es un string numérico con punto decimal
   ('250000' → 250000); lo que se ve lleva el prefijo ($), las comas cada tres
   dígitos y los decimales pedidos ('$250,000.00'). Es `type="text"` porque
   `input[type=number]` no admite ni $ ni comas.
   El agrupado se aplica al inicializar, al cargar el ejemplo, al confirmar con
   Enter y al salir del campo, pero NO en cada pulsación: si se reescribiera en
   vivo, teclear un dígito más en '$250,000.00' se redondearía y parecería que la
   caja no acepta cifras. Mientras se escribe solo se limpian los caracteres
   sobrantes, para que se pueda teclear a pelo.
   Toda la lógica está en `src/lib/formato.js` (pura y testeada). */
import { ref, watch, nextTick } from 'vue'
import { textoCampo, campoAlEscribir, campoAlConfirmar } from '../lib/formato'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  id: { type: String, default: undefined },
  prefijo: { type: String, default: '' }, // '$' en los campos de dinero
  decimales: { type: Number, default: 2 },
  miles: { type: Boolean, default: true },
  sufijo: { type: Boolean, default: false }, // deja hueco a la derecha (% anual)
  pequeno: { type: Boolean, default: false }, // variante form-control-sm
  negativo: { type: Boolean, default: true },
  ariaLabel: { type: String, default: undefined },
})
const emit = defineEmits(['update:modelValue'])

const texto = ref('')
const escribiendo = ref(false) // evita que el modelo pise lo que se está tecleando

const opFmt = () => ({
  decimales: props.decimales,
  miles: props.miles,
  prefijo: props.prefijo,
  negativo: props.negativo,
})

// Los cambios que vienen de fuera (ej.: 'Cargar ejemplo') sí se formatean.
watch(
  () => props.modelValue,
  (v) => {
    if (escribiendo.value) return
    texto.value = textoCampo(v, opFmt())
  },
  { immediate: true },
)

function alEscribir(e) {
  const el = e.target
  const cursor = el.selectionStart ?? el.value.length
  const alFinal = cursor === el.value.length
  const estado = campoAlEscribir(el.value, opFmt())
  // Si el prefijo se repone, el cursor no debe saltar hacia atrás.
  if (estado.texto !== el.value) {
    el.value = estado.texto
    const pos = alFinal ? estado.texto.length : Math.min(cursor, estado.texto.length)
    nextTick(() => el.setSelectionRange(pos, pos))
  }
  texto.value = estado.texto
  escribiendo.value = true
  emit('update:modelValue', estado.modelo)
}

/** Confirma la captura: agrupa las cifras y fija los decimales. */
function alConfirmar() {
  const estado = campoAlConfirmar(texto.value, opFmt())
  if (estado) {
    texto.value = estado.texto
    emit('update:modelValue', estado.modelo)
  } else {
    texto.value = textoCampo(props.modelValue, opFmt())
  }
  escribiendo.value = false
}
</script>

<template>
  <input
    :id="id"
    v-model="texto"
    type="text"
    inputmode="decimal"
    autocomplete="off"
    :class="['form-control', { 'form-control-sm': pequeno, 'con-suf': sufijo }]"
    :aria-label="ariaLabel"
    spellcheck="false"
    @input="alEscribir"
    @blur="alConfirmar"
    @keydown.enter.prevent="alConfirmar"
  />
</template>

<style scoped>
/* El prefijo ($) forma parte del propio texto, así que no hace falta hueco para
   él. El hueco de la derecha sí lo hace falta: el sufijo estático ("% anual")
   lo pinta el padre en un span superpuesto. */
input.con-suf {
  padding-right: 84px;
}
</style>
