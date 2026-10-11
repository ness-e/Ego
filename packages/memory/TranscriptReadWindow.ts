/**
 * Algoritmo de ventanas deslizantes de lectura y anclaje de transcripción (OCLW-06).
 * Extraído y adaptado de OpenClaw src/sessions/transcript-read-window.ts y transcript-anchor-page.ts.
 *
 * Optimiza la huella de memoria RAM y la latencia al consultar historiales de conversación
 * masivos en VantaDB para alimentar `@assistant-ui/react`.
 */

export interface TranscriptMessageRecord {
  id: string;
  seq: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  sizeBytes?: number;
}

export interface TranscriptReadWindowParams {
  totalMessages: number;
  anchorSeq?: number;
  direction?: "older" | "newer";
  maxMessages: number;
  maxBytes?: number;
}

export interface TranscriptReadWindowResult {
  startIndex: number;
  endIndex: number;
  count: number;
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
}

/**
 * Resuelve los límites de índices (start/end) para una ventana de lectura deslizante.
 */
export function resolveTranscriptWindow(
  params: TranscriptReadWindowParams
): TranscriptReadWindowResult {
  const total = Math.max(0, params.totalMessages);
  const pageSize = Math.max(1, params.maxMessages);

  if (total === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      count: 0,
      hasMoreOlder: false,
      hasMoreNewer: false,
    };
  }

  // Si no hay ancla, por defecto devolvemos los últimos N mensajes (más recientes)
  if (params.anchorSeq === undefined) {
    const startIndex = Math.max(0, total - pageSize);
    const endIndex = total;
    return {
      startIndex,
      endIndex,
      count: endIndex - startIndex,
      hasMoreOlder: startIndex > 0,
      hasMoreNewer: false,
    };
  }

  const anchor = Math.max(0, Math.min(total - 1, params.anchorSeq));

  if (params.direction === "older") {
    // Lectura hacia atrás desde el ancla (excluyendo o incluyendo el ancla)
    const endIndex = anchor + 1;
    const startIndex = Math.max(0, endIndex - pageSize);
    return {
      startIndex,
      endIndex,
      count: endIndex - startIndex,
      hasMoreOlder: startIndex > 0,
      hasMoreNewer: endIndex < total,
    };
  }

  if (params.direction === "newer") {
    // Lectura hacia adelante desde el ancla
    const startIndex = anchor;
    const endIndex = Math.min(total, startIndex + pageSize);
    return {
      startIndex,
      endIndex,
      count: endIndex - startIndex,
      hasMoreOlder: startIndex > 0,
      hasMoreNewer: endIndex < total,
    };
  }

  // Ventana centrada alrededor del ancla
  const half = Math.floor(pageSize / 2);
  let startIndex = Math.max(0, anchor - half);
  let endIndex = Math.min(total, startIndex + pageSize);

  // Si pegó en el borde superior, expandir hacia abajo
  if (endIndex - startIndex < pageSize && startIndex > 0) {
    startIndex = Math.max(0, endIndex - pageSize);
  }

  return {
    startIndex,
    endIndex,
    count: endIndex - startIndex,
    hasMoreOlder: startIndex > 0,
    hasMoreNewer: endIndex < total,
  };
}

/**
 * Filtra y pagina una lista de mensajes en memoria respetando límites de bytes y mensajes.
 */
export function paginateTranscriptMessages(
  messages: readonly TranscriptMessageRecord[],
  params: Omit<TranscriptReadWindowParams, "totalMessages">
): {
  page: TranscriptMessageRecord[];
  window: TranscriptReadWindowResult;
  totalBytes: number;
} {
  const window = resolveTranscriptWindow({
    ...params,
    totalMessages: messages.length,
  });

  let slice = messages.slice(window.startIndex, window.endIndex);
  let totalBytes = 0;

  if (params.maxBytes !== undefined && params.maxBytes > 0) {
    const bounded: TranscriptMessageRecord[] = [];
    // Si la lectura es hacia atrás, priorizamos los mensajes más recientes del slice
    const items = params.direction === "older" ? [...slice].reverse() : slice;

    for (const msg of items) {
      const msgBytes = msg.sizeBytes ?? new TextEncoder().encode(msg.content).length;
      if (totalBytes + msgBytes > params.maxBytes && bounded.length > 0) {
        break;
      }
      totalBytes += msgBytes;
      bounded.push(msg);
    }

    slice = params.direction === "older" ? bounded.reverse() : bounded;
  } else {
    for (const msg of slice) {
      totalBytes += msg.sizeBytes ?? new TextEncoder().encode(msg.content).length;
    }
  }

  return {
    page: slice,
    window,
    totalBytes,
  };
}
