/**
 * Estructura de intervalo temporal en milisegundos.
 */
export interface TimeInterval {
  start: number;
  end: number;
}

/**
 * IntervalSet - Agregación de intervalos no solapados (Patrón Coucou COUC-12 / RecapStore).
 *
 * Implementa el algoritmo O(N log N) para unir y fusionar intervalos de tiempo continuos
 * o solapados. Evita contar doblemente el tiempo de trabajo efectivo cuando coexisten
 * múltiples Sub-Egos, sesiones paralelas o tareas concurrentes.
 */
export class IntervalSet {
  private intervals: TimeInterval[] = [];

  constructor(initialIntervals: TimeInterval[] = []) {
    for (const interval of initialIntervals) {
      this.add(interval.start, interval.end);
    }
  }

  /**
   * Agrega un nuevo intervalo temporal [start, end].
   * Normaliza los bordes si start > end y descarta intervalos vacíos o de duración cero.
   */
  public add(start: number, end: number): this {
    if (start === end) return this;
    const actualStart = Math.min(start, end);
    const actualEnd = Math.max(start, end);

    this.intervals.push({ start: actualStart, end: actualEnd });
    this.intervals = IntervalSet.merge(this.intervals);
    return this;
  }

  /**
   * Fusiona una lista arbitraria de intervalos en un conjunto disjunto no solapado ordenado.
   */
  public static merge(rawIntervals: TimeInterval[]): TimeInterval[] {
    const valid = rawIntervals
      .filter((i) => i.end > i.start)
      .sort((a, b) => a.start - b.start);

    if (valid.length === 0) return [];

    const merged: TimeInterval[] = [];
    let currentStart = valid[0].start;
    let currentEnd = valid[0].end;

    for (let i = 1; i < valid.length; i++) {
      const next = valid[i];
      if (next.start <= currentEnd) {
        // Solapamiento o contigüidad: extendemos el límite derecho
        currentEnd = Math.max(currentEnd, next.end);
      } else {
        // Disjunto: cerramos el intervalo actual y abrimos uno nuevo
        merged.push({ start: currentStart, end: currentEnd });
        currentStart = next.start;
        currentEnd = next.end;
      }
    }

    merged.push({ start: currentStart, end: currentEnd });
    return merged;
  }

  /**
   * Calcula el tiempo total acumulado (en milisegundos) sin solapamientos.
   */
  public totalDurationMs(): number {
    return this.intervals.reduce((acc, interval) => acc + (interval.end - interval.start), 0);
  }

  /**
   * Calcula el tiempo total acumulado en minutos enteros o fraccionarios.
   */
  public totalMinutes(): number {
    return this.totalDurationMs() / (1000 * 60);
  }

  /**
   * Retorna una copia inmutable de los intervalos consolidados actuales.
   */
  public toArray(): TimeInterval[] {
    return [...this.intervals];
  }

  /**
   * Determina si un punto en el tiempo 'timestamp' cae dentro de algún intervalo activo.
   */
  public contains(timestamp: number): boolean {
    return this.intervals.some((i) => timestamp >= i.start && timestamp <= i.end);
  }

  /**
   * Calcula la intersección entre este conjunto y otro rango [start, end].
   */
  public intersect(start: number, end: number): TimeInterval[] {
    const aStart = Math.min(start, end);
    const aEnd = Math.max(start, end);
    const intersections: TimeInterval[] = [];

    for (const i of this.intervals) {
      const interStart = Math.max(i.start, aStart);
      const interEnd = Math.min(i.end, aEnd);
      if (interEnd > interStart) {
        intersections.push({ start: interStart, end: interEnd });
      }
    }

    return intersections;
  }

  /**
   * Cantidad de segmentos consolidados disjuntos.
   */
  public count(): number {
    return this.intervals.length;
  }

  /**
   * Limpia todos los intervalos.
   */
  public clear(): void {
    this.intervals = [];
  }
}
