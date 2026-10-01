// ============================================================================
// main.js — Punto de entrada de la aplicación Vue 3 (monta <App />).
// ----------------------------------------------------------------------------
// Bootstrap se importa ANTES que style.css: así el tema oscuro/claro de la
// aplicación (variables CSS propias) gana por orden de cascada sobre el CSS de
// Bootstrap, y el layout responsive (rejilla, flex, tablas, formularios) lo
// aporta Bootstrap 5.
// ============================================================================
import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js' // JS de Bootstrap (data-bs-*)
import './style.css' // tema (variables, cabecera, tarjetas, gráficas)
import App from './App.vue'

createApp(App).mount('#app')
