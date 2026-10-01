// ============================================================================
// explicaciones.js — Textos de los globos informativos de la calculadora.
// ----------------------------------------------------------------------------
// Cada entrada es un objeto { titulo, texto } que se pinta en un globo que
// aparece al pasar el puntero (o al tocar / enfocar) sobre el icono `?`.
// Se mantienen aquí, y no dentro del componente, para que la redacción viva
// junta y sea revisable: la app financial es la única fuente de las cifras y
// estos textos solo explican el significado, nunca lo sustituyen.
// ============================================================================

// --- Entradas del panel -----------------------------------------------------
const entradas = {
  eInversion: {
    titulo: 'Inversión inicial',
    texto:
      'Dinero que se desembolsa en el periodo 0. Es el punto de partida del VAN: todos los flujos futuros se comparan con esta cifra. Admite 0 para proyectos sin desembolso.',
  },
  eTasa: {
    titulo: 'Tasa de descuento anual',
    texto:
      'Rentabilidad mínima que le exiges al programa (costo de capital). Es ANUAL: para descontar un flujo mensual se convierte a la tasa equivalente del periodo con i = (1 + i_anual)^(1/ppy) − 1. Si no la conoces, puedes calcular el CMPC con CAPM.',
  },
  eUnidad: {
    titulo: 'Unidad del periodo',
    texto:
      'En qué unidad se miden los flujos: por año, por semestre, por trimestre o por mes. La tasa anual capturada se convierte a la tasa equivalente de la unidad elegida y TIR y demás resultados se muestran en esa misma unidad. Un año de pagos mensuales NO es lo mismo que un año de pagos anuales.',
  },
  ePeriodos: {
    titulo: 'Número de periodos',
    texto:
      'Cuántos flujos habrá, contados en la unidad elegida. El periodo 0 es la inversión; los periodos 1..n son los flujos de operación.',
  },
  eRescate: {
    titulo: 'Valor de rescate',
    texto:
      'Lo que recuperas al final del proyecto (venta del activo, valor liquidativo). Se suma al último flujo y NO se hace crecer: si además pides un valor terminal de Gordon se avisará del doble conteo.',
  },
  eCrecimiento: {
    titulo: 'Crecimiento perpetuo',
    texto:
      'Tasa g con la que Gordon capitaliza el último flujo operativo como una perpetuidad. Exige tasa de descuento > g; si no, el valor terminal no es interpretable.',
  },
  eFlujo: {
    titulo: 'Flujo neto por periodo',
    texto:
      'Ingresos menos costos del programa en CADA periodo. Admite valores negativos (etapas de inversión o pérdidas operativas): en ese caso la TIR puede dejar de ser concluyente.',
  },
  eFlujos: {
    titulo: 'Flujos por periodo',
    texto:
      'Un flujo por periodo para cuando los flujos cambien. Se usa, por ejemplo, con mantenimientos, incrementos o estacionalidad.',
  },
  eCmmpc: {
    titulo: 'CMPC con CAPM',
    texto:
      'Costo promedio ponderado de capital: ke = Rf + β(Rm − Rf) y CMPC = (E/V)·ke + (D/V)·kd·(1 − impuesto). Sirve para justificar la tasa de descuento con datos del mercado en vez de con un supuesto.',
  },
  cmmpcRf: {
    titulo: 'Tasa libre de riesgo (Rf)',
    texto:
      'Rendimiento de una inversión sin riesgo. Es la base de la prima: cualquier tasa exigida debe ser mayor que este valor.',
  },
  cmmpcBeta: {
    titulo: 'Beta (β)',
    texto:
      'Cuánto riesgo de mercado tiene el proyecto respecto al mercado. Con β > 1 el proyecto es más volátil; con β < 1, menos.',
  },
  cmmpcPrima: {
    titulo: 'Prima de mercado (Rm − Rf)',
    texto: 'Rentabilidad extra que se exige por asumir riesgo de mercado. Es el segundo componente del CAPM.',
  },
  cmmpcKd: {
    titulo: 'Costo de deuda (kd)',
    texto: 'Tasa que se paga por el dinero prestado. Como los intereses se deducen, su costo real baja con impuestos.',
  },
  cmmpcImpuesto: {
    titulo: 'Impuestos (%)',
    texto: 'Tasa sobre las utilidades. Reduce el costo de la deuda (escudo fiscal) y la utilidad del proyecto.',
  },
  cmmpcPatrimonio: {
    titulo: 'Patrimonio (E)',
    texto: 'Recursos propios con los que se financia el proyecto. Su peso es E/V en el CMPC.',
  },
  cmmpcDeuda: {
    titulo: 'Deuda (D)',
    texto:
      'Dinero prestado. Más deuda abarata el CMPC mientras el riesgo financiero lo permita: pasado cierto punto, el costo sube.',
  },
  cmmpcKe: {
    titulo: 'Costo del patrimonio (ke)',
    texto: 'Lo que exige el accionista: tasa libre de riesgo + prima por riesgo de mercado × beta del proyecto.',
  },
  cmmpcEV: {
    titulo: 'Peso E / V',
    texto: 'Participación del patrimonio en el financiamiento. A más deuda, menor CMPC… hasta que el riesgo financiero compensa esa ventaja.',
  },
  cmmpcKdNeto: {
    titulo: 'Deuda neta de impuestos',
    texto: 'Costo de la deuda después de impuestos: kd × (1 − impuesto). Los intereses son deducibles, por eso la deuda tiene escudo fiscal.',
  },
  cmmpcTotal: {
    titulo: 'CMPC (WACC)',
    texto: 'Costo promedio ponderado de capital. Se puede usar como tasa de descuento: sustituye al supuesto manual de tasa anual.',
  },
}

// --- Resultados -------------------------------------------------------------
export const AYUDA = {
  // Indicadores (tarjetas KPI)
  van: {
    titulo: 'VAN · Valor Actual Neto',
    texto:
      'Suma de los flujos descontados a la tasa exigida menos la inversión inicial. Si es mayor que 0, el proyecto crea valor. Es el criterio de decisión de esta app: la TIR solo confirma.',
  },
  tir: {
    titulo: 'TIR · Tasa Interna de Retorno',
    texto:
      'Tasa de descuento que hace que el VAN valga 0: el rendimiento que genera el proyecto. Solo es un criterio válido si el flujo es convencional (un único cambio de signo). Si hay varias raíces se muestra "Múltiple" y la decisión la da el VAN.',
  },
  pri: {
    titulo: 'Recuperación de la inversión (PRI)',
    texto:
      'Periodo en que los flujos acumulados cubren lo invertido. El valor mostrado es el PRI descontado (a la tasa exigida); la nota da el simple, que es más optimista porque ignora el valor del dinero en el tiempo. Si el acumulado nunca cruza cero, el proyecto no se recupera.',
  },
  roi: {
    titulo: 'ROI · Retorno sobre la inversión',
    texto:
      'La ganancia neta sobre la inversión, expresada en porcentaje. Es la métrica más fácil de leer y la más engañosa: no considera cuándo llega el dinero ni la tasa exigida. Úsala como referencia, nunca como criterio de decisión.',
  },
  tirm: {
    titulo: 'TIRM · TIR Modificada',
    texto:
      'TIR corregida: reinvierte los flujos positivos a la tasa de reinversión y financia los negativos a la tasa de financiamiento. A diferencia de la TIR, sigue siendo válida con flujos no convencionales.',
  },
  ipr: {
    titulo: 'IPR · Índice de rentabilidad',
    texto:
      'Valor presente de los flujos entre la inversión (VAF ÷ inversión). Es 1,000 exactamente cuando el VAN es 0, así que IPR > 1 ⇔ VAN > 0. Expresa "cuánto se recupera por cada unidad invertida".',
  },
  nivelado: {
    titulo: 'Flujo nivelado',
    texto:
      'Renta constante equivalente a los flujos del proyecto, calculada dividiendo el VAN entre el factor de anualidad a la tasa exigida. Responde: ¿qué cuota uniforme daría el mismo resultado?',
  },
  margen: {
    titulo: 'Margen de seguridad',
    texto:
      'Holgura del VAN sobre la inversión (VAN ÷ inversión). Es el margen que tienes antes de que el proyecto deje de crear valor. Si es negativo, el proyecto ya está en pérdidas con los datos capturados.',
  },

  // Secciones
  veredicto: {
    titulo: 'Veredicto automático',
    texto:
      'Conclusión que la app calcula con los datos capturados: acepta si el VAN es positivo. Cuando la TIR y el VAN chocan, prevalece el VAN y se muestra la advertencia correspondiente.',
  },
  graficaAcum: {
    titulo: 'Flujo de caja acumulado',
    texto:
      'Evolución de la inversión recuperada con y sin descuento. El cruce del cero es el periodo de recuperación; la línea punteada vertical marca el PRI sobre el eje. La serie sin descontar sube más rápido porque ignora la tasa exigida.',
  },
  graficaPerfil: {
    titulo: 'Perfil del VAN',
    texto:
      'VAN frente a la tasa de descuento anual. La curva cruza el cero exactamente en la TIR: a la izquierda de ese punto el proyecto vale la pena, a la derecha no. La línea vertical azul marca la tasa que estás usando.',
  },
  tablaPeriodos: {
    titulo: 'Detalle por periodo',
    texto:
      'Factor = 1/(1+i)^t con la tasa del periodo · Valor presente = flujo × factor · VAN acumulado = suma de los valores presentes menos la inversión (termina en el VAN) · Acumulado = flujos sin descontar desde el periodo 0.',
  },
  valorTerminal: {
    titulo: 'Valor terminal (Gordon)',
    texto:
      'VT = último flujo operativo × (1 + g) / (i − g). Capitaliza el flujo final como si se repitiera para siempre con crecimiento g. Exige i > g y se calcula solo sobre el flujo operativo: si también capturas rescate, se avisa del doble conteo.',
  },
  otrasMetricas: {
    titulo: 'Otras métricas',
    texto:
      'VAF = valor presente de los flujos · flujo nivelado = VAN ÷ a(n,i) · inversión máxima tolerable = VAF (con ella el VAN cae a cero) · flujo crítico = inversión ÷ a(n,i) (el flujo uniforme que equilibra el proyecto).',
  },
  sensibilidad: {
    titulo: 'Sensibilidad del VAN',
    texto:
      'Recalcula el VAN variando un factor a la vez —tasa, flujos e inversión— y manteniendo los demás. Sirve para ver qué supuesto es el crítico: si una fila pasa a "Rechaza", el proyecto es frágil ante ese variable.',
  },
  equilibrio: {
    titulo: 'Punto de equilibrio',
    texto:
      'Flujo (en dinero y como porcentaje de la inversión) necesario para que el VAN sea exactamente 0. Sirve para saber cuánto puede caer el negocio antes de perder valor.',
  },
  supuestos: {
    titulo: 'Supuestos y fórmulas',
    texto:
      'Tasa del periodo i = (1 + i_anual)^(1/ppy) − 1 · VAN = −I0 + Σ FC_t/(1+i)^t · TIR = tasa que anula el VAN (válida solo con flujo convencional) · PRI = primer cruce del acumulado con interpolación lineal · ROI = (ΣFC − I0)/I0, que nunca decide solo.',
  },
  glosario: {
    titulo: 'Glosario',
    texto:
      'Diccionario de siglas usadas en la app: VAF, IPR, CMPC, PRI, ROI, TIR, TIRM, VAN, ppy y p.p.',
  },
  ...entradas,
}

export default AYUDA
