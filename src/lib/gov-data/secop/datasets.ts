/**
 * Conjuntos de datos abiertos de contratación pública (datos.gov.co, publicados por
 * Colombia Compra Eficiente). Todo lo de abajo se verificó en vivo el 2026-10-09; lo que
 * no es obvio queda anotado porque cambia cómo hay que consultarlos.
 *
 * Se usan los conjuntos de DETALLE y no «SECOP Integrado» (rpmr-utcd, 22,8 M de filas):
 * el integrado no trae representante legal, supervisor ni ordenador del gasto, y sus
 * cifras no cuadran con los conjuntos de origen (para una misma cédula: 22 contratos
 * de SECOP II en el integrado contra 15 en «Contratos Electrónicos»), así que mezclarlos
 * mostraría números contradictorios.
 *
 * Rarezas de los datos (las cargan las propias entidades, a mano):
 * - El documento viene sucio: «51.740.316», «1085106550.», «901421573-3», «1152716854 -1».
 *   Una igualdad simple pierde contratos: ver `clausulaDocumento` (./documento.ts).
 * - Hay valores absurdos por errores de digitación (la suma de una sola alcaldía da
 *   ~10^18 pesos): se descartan los mayores a `VALOR_MAXIMO` y se marcan.
 * - SECOP I repite el contrato una vez por rubro presupuestal: se deduplica por `uid`.
 * - El representante legal de una persona natural viene como «Sin Descripcion».
 * - En «Proveedores Registrados», el documento del representante a veces es el NIT de la
 *   propia empresa y no la cédula de la persona: solo sirve como pista, no como prueba.
 * - Supervisor y ordenador del gasto vienen en «No definido» en ~1 de cada 3 contratos
 *   de SECOP II: la ausencia de un funcionario no prueba que no lo hubiera.
 * - Las agregaciones sobre toda la tabla son lentas (17 s con GROUP BY); las consultas
 *   con filtro por documento o por NIT responden en ~0,5–1 s.
 */
export const SECOP_DATASETS = {
  contratosII: {
    id: "jbjy-vk9h",
    title: "SECOP II - Contratos Electrónicos",
    filas: "≈ 6,0 millones",
    url: "https://www.datos.gov.co/d/jbjy-vk9h",
  },
  procesosI: {
    id: "f789-7hwg",
    title: "SECOP I - Procesos de Compra Pública",
    filas: "≈ 6,5 millones",
    url: "https://www.datos.gov.co/d/f789-7hwg",
  },
  procesosIHistorico: {
    id: "qddk-cgux",
    title: "SECOP I - Procesos de Compra Pública (histórico)",
    filas: "≈ 6,1 millones",
    url: "https://www.datos.gov.co/d/qddk-cgux",
  },
  proveedoresII: {
    id: "qmzu-gj57",
    title: "SECOP II - Proveedores Registrados",
    filas: "≈ 1,6 millones",
    url: "https://www.datos.gov.co/d/qmzu-gj57",
  },
} as const;

/** Un contrato por encima de esto (10 billones de pesos) es, en la práctica, un error de digitación. */
export const VALOR_MAXIMO = 10_000_000_000_000;
