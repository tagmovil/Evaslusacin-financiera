<script setup>
// ============================================================================
// App.vue — Componente raíz: cabecera + la pantalla de Inversiones.
// Ya no hay menú ni pestañas: la aplicación es un único modelo (Inversiones).
// El tema (oscuro/claro) se refleja en <html> para que Bootstrap y el tema
// propio de la app cambien a la vez; lo aplica InversionesApp al montar.
// ============================================================================
import InversionesApp from './components/InversionesApp.vue'
</script>

<template>
  <header class="cabecera">
    <div class="container-xxl">
      <h1 class="cabecera-titulo">Evaluación de proyectos de inversión</h1>
      <p class="cabecera-sub">
        VAN · TIR · TIRM · PRI · ROI · IPR · punto de equilibrio · sensibilidad · CMPC (CAPM)
      </p>
    </div>
  </header>

  <main class="contenido">
    <div class="container-xxl">
      <InversionesApp />
    </div>
  </main>

  <footer class="pie">
    <div class="container-xxl">
      Inversiones — los cálculos están verificados contra la teoría financiera (VAN como criterio de decisión,
      TIR válida solo con flujo convencional).
    </div>
  </footer>
</template>
