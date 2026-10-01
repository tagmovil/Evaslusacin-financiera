<script setup>
// ============================================================================
// GloboInfo.vue — Globo informativo (tooltip) que explica un valor.
// ----------------------------------------------------------------------------
// Se muestra al pasar el puntero por encima, al enfocarlo con el teclado o al
// tocarlo en pantallas sin hover (en ese caso se comporta como un botón
// desplegable y se cierra al tocar fuera o con Escape). El texto vive en
// `src/lib/explicaciones.js`; aquí solo se pinta el globo.
// ============================================================================
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  ayuda: { type: Object, required: true }, // { titulo, texto }
  etiqueta: { type: String, default: '?' }, // glifo del disparador
  lado: { type: String, default: 'derecha' }, // 'derecha' | 'izquierda' | 'centro'
})

const abierto = ref(false)
// En equipos con ratón basta con pasar el puntero; en táctil, el toque despliega.
const conHover = ref(true)
const raiz = ref(null)

const claseGlobo = computed(() => `globo-${props.lado}`)

function abrir() {
  abierto.value = true
}
function cerrar() {
  abierto.value = false
}
function alternar() {
  abierto.value = !abierto.value
}
function alPulsar() {
  if (!conHover.value) alternar()
}
function fueraDelGlobo(e) {
  if (raiz.value && !raiz.value.contains(e.target)) cerrar()
}

onMounted(() => {
  conHover.value = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  document.addEventListener('click', fueraDelGlobo)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', fueraDelGlobo)
})
</script>

<template>
  <span
    ref="raiz"
    class="globo"
    :class="claseGlobo"
    tabindex="0"
    role="button"
    :aria-label="`Ayuda: ${ayuda.titulo}`"
    :aria-expanded="abierto"
    @mouseenter="abrir"
    @mouseleave="cerrar"
    @focusin="abrir"
    @focusout="cerrar"
    @click.stop="alPulsar"
    @keydown.esc.stop="cerrar"
  >
    <span class="globo-disparador" aria-hidden="true">{{ etiqueta }}</span>
    <span v-if="abierto" class="globo-cuerpo" role="tooltip">
      <b class="globo-titulo">{{ ayuda.titulo }}</b>
      <span class="globo-texto">{{ ayuda.texto }}</span>
    </span>
  </span>
</template>

<style scoped>
/* Disparador: el icono `?` que se coloca junto a una etiqueta o a un título. */
.globo {
  position: relative;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  outline: none;
}

.globo-disparador {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--bg);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  cursor: help;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}

.globo:hover .globo-disparador,
.globo:focus-visible .globo-disparador,
.globo-disparador:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--panel);
}

/* Globo: caja con sombra, anclada para no salirse de la tarjeta. */
.globo-cuerpo {
  position: absolute;
  top: calc(100% + 8px);
  z-index: 40;
  width: max-content;
  max-width: 264px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  color: var(--text);
  font-size: 0.8rem;
  line-height: 1.45;
  text-align: left;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
  cursor: auto;
}

.globo-derecha .globo-cuerpo {
  left: 0;
}

.globo-izquierda .globo-cuerpo {
  right: 0;
}

.globo-centro .globo-cuerpo {
  left: 50%;
  transform: translateX(-50%);
}

/* Pico del globo. */
.globo-cuerpo::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 12px;
  width: 8px;
  height: 8px;
  border-top: 1px solid var(--border);
  border-left: 1px solid var(--border);
  background: var(--panel);
  transform: rotate(45deg);
}

.globo-izquierda .globo-cuerpo::before {
  left: auto;
  right: 12px;
}

.globo-centro .globo-cuerpo::before {
  left: 50%;
  margin-left: -4px;
}

.globo-titulo {
  display: block;
  margin-bottom: 3px;
  color: var(--accent);
  font-weight: 700;
}

.globo-texto {
  display: block;
  color: var(--text);
}

/* El globo es información, no contenido de impresión. */
@media print {
  .globo {
    display: none;
  }
}
</style>
