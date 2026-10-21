/**
 * T-X1 — `globalSetup` de la suite del desktop.
 *
 * Corre UNA VEZ por corrida (en el proceso principal de vitest) y barre los
 * run-dir huérfanos de la raíz compartida de scratch.
 *
 * ## Por qué aquí
 * El teardown de cada test borra su directorio en `afterEach`/`afterAll`. Si
 * el proceso **muere** (timeout del test, `kill`, reinicio del servidor), ese
 * teardown no se ejecuta y el directorio se queda para siempre — 320 MB por
 * store (el binding nativo pre-reserva 5 × 64 MB al conectar).
 *
 * El barrido del inicio de la corrida es la red que hace la limpieza
 * **resistant a la muerte del proceso**: la corrida siguiente recoge lo que
 * la anterior dejó. Se ejecuta al PRINCIPIO (antes de que los tests reserven
 * disco) para que el espacio se recupere cuanto antes.
 */
import { sweepOrphanScratch } from "./test-scratch.js";

export default function setup(): void {
  const { removed } = sweepOrphanScratch();
  if (removed.length > 0) {
    console.log(
      `[test-scratch] barridos ${removed.length} run(s) huérfanos: ${removed.join(", ")}`
    );
  }
}
