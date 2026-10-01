<script setup>
// ============================================================================
// Fraccion.vue — Escribe un cociente como fracción: numerador arriba, raya y
// denominador. Se usa en las notas de fórmulas para que se lean como en un
// libro de finanzas y no como 'a/b' en una línea de texto.
// ----------------------------------------------------------------------------
//   <Fraccion><template #num>FC<sub>t</sub></template><template #den>(1+i)<sup>t</sup></template></Fraccion>
//
// `angosto` la reduce para poder meterla dentro de un <sup> (exponentes).
// ============================================================================
defineProps({
  angosto: { type: Boolean, default: false },
  // Envuelve el cociente entre paréntesis para que se vea dónde empieza y
  // termina la fórmula cuando va en línea dentro de un texto.
  parentesis: { type: Boolean, default: false },
})
</script>

<template>
  <span class="frac-wrap">
    <span v-if="parentesis" class="frac-par">(</span>
    <span class="frac" :class="{ 'frac-angosta': angosto }" role="math">
      <span class="frac-num"><slot name="num" /></span>
      <span class="frac-den"><slot name="den" /></span>
    </span>
    <span v-if="parentesis" class="frac-par">)</span>
  </span>
</template>

<style scoped>
.frac-wrap {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.frac-par {
  font-size: 1.15em;
}
.frac {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  vertical-align: middle;
  margin: 0 0.18em;
  text-align: center;
  line-height: 1.2;
  white-space: nowrap;
}

.frac-num {
  padding: 0 0.35em 0.12em;
  border-bottom: 1px solid currentColor;
}

.frac-den {
  padding: 0.12em 0.35em 0;
}

.frac-angosta {
  font-size: 0.8em;
}
</style>
