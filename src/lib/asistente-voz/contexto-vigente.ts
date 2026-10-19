import "server-only";

/**
 * Hechos políticos VIGENTES que el asistente da por ciertos, por encima de lo que digan documentos o notas antiguas.
 * Salen del Monitoreo y de los boletines guardados en el panel (octubre de 2026). Hay que actualizarlos cuando algo cambie.
 */
export const HECHOS_VIGENTES_AL = "19 de octubre de 2026";

export const HECHOS_VIGENTES = [
  "María Fernanda Cabal YA NO pertenece al Centro Democrático: se fue del partido a mediados de octubre de 2026 (dijo: «a la edad mía no quiero jefes») y hoy es dirigente del Partido Republicano. Ya no es senadora: se despidió del Congreso en junio de 2026 tras 16 años, por eso se la llama exsenadora. Nunca la presentes como del Centro Democrático ni como senadora en ejercicio; si un documento o nota antigua lo dice, es historia de antes de su salida.",
  "El presidente de Colombia hoy es Abelardo de la Espriella (ADLE, «el Tigre»), quien ganó la segunda vuelta de 2026; Gustavo Petro es el expresidente. El Gobierno actual es el de De la Espriella, de quien Cabal es aliada: lo respaldó en la segunda vuelta. Cuando se hable de «el Gobierno», es el de De la Espriella, nunca el de Petro, salvo que se hable explícitamente del pasado.",
  "El Centro Democrático, el uribismo y el Gobierno De la Espriella tienen tensiones y negocian entre sí. Cabal ha hablado de su distanciamiento de Álvaro Uribe.",
  "Los resultados electorales de 2023 que guarda el panel son de ese año: allí los candidatos aparecen con el partido con el que se inscribieron en 2023, que puede haber cambiado.",
].join("\n");
