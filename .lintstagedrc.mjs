/**
 * lint-staged — configuración.
 *
 * ## Por qué no la config de `package.json`
 *
 * La forma anterior (`"*.{ts,tsx,js,mjs,cjs}": ["pnpm exec oxlint --ignore-path .gitignore"]`)
 * tenía **dos** fallos que solo se manifiestan cuando el commit es grande:
 *
 * 1. **El hook rechazaba cualquier commit que tocara la copia vendorizada del avatar.**
 *    `.oxlintrc.json` ignora `apps/desktop/renderer/floating/vendor/**` (es una copia
 *    espejo de `packages/avatar/`, con su propio estilo y su propio presupuesto de
 *    lint), pero la lista blanca de `lint-staged` solo excluía
 *    `packages/avatar/vendor/**`. Resultado: oxlint recibía las rutas, las ignoraba
 *    todas y salía con **"No files found to lint"** y código 1 → *el commit se
 *    rechazaba*.
 *
 * 2. **"La línea de comandos es demasiado larga."** Con ~97 ficheros `.js` staged,
 *    `pnpm exec oxlint <97 rutas>` supera el límite de 8191 caracteres de
 *    `cmd.exe` en Windows → el hook moría antes de lintear nada.
 *
 * ## La solución
 *
 * Una **tarea de función** devuelve el comando a ejecutar; lint-staged lo lanza
 * **sin concatenarle los ficheros** (la propia funcion debe resolver la lista).
 * El comando es corto y el trabajo real vive en
 * [`scripts/lint-staged-oxlint.mjs`](../../scripts/lint-staged-oxlint.mjs), que
 * lee la lista de ficheros staged de git y lintea **por lotes**.
 *
 * La alternativa (la lista dentro de `package.json`) se queda sin poder evitar
 * ni el límite de longitud ni el "No files found to lint".
 */

export default {
  "*.{ts,tsx,js,mjs,cjs}": () => "node scripts/lint-staged-oxlint.mjs",
};
