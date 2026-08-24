/**
 * Cola de comandos pendientes de navegación.
 *
 * Cuando una página quiere enviar a Tickets con un filtro ya aplicado
 * (una tienda del «Top tiendas», una categoría de un gráfico, un ticket
 * concreto…), no puede disparar un CustomEvent y confiar en que Tickets lo
 * escuche: con las transiciones de página, la ruta nueva solo se monta
 * cuando termina la animación de salida, así que el evento se perdería.
 *
 * En su lugar, el origen guarda aquí el comando y navega; Tickets lo consume
 * en su propio montaje, de forma determinista y sin carreras de tiempos.
 */
export interface PendingCommand {
  query?: string; // texto para la búsqueda (p. ej. el nombre de una tienda)
  cat?: string; // id de categoría para el selector de filtros
  ticket?: string; // id de ticket para abrir su ficha directamente
  store?: string; // nombre exacto de tienda para filtrar solo sus tickets
}

let pending: PendingCommand | null = null;

export function setPending(cmd: PendingCommand) {
  pending = cmd;
}

export function takePending(): PendingCommand | null {
  const cmd = pending;
  pending = null;
  return cmd;
}
