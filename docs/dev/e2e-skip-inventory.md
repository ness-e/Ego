# Inventario Exhaustivo de Tests Ignorados (Skips) y Auditoría E2E / A11Y

> **Fecha:** 2026-10-20 (actualizado tras la Ola 1 de remediación)  
> **Ámbito:** `tests/**`, `apps/**/test/**`, `packages/**/test/**`  
> **Propósito:** Trazabilidad de cobertura real vs aparente ("verde no equivale a verificado"), clasificación de deuda técnica y verificación determinista de contraste WCAG 2.2 AA.

---

## 1. Resumen Ejecutivo de Métricas

* **Total de skips catalogados:** **18** puntos de skip / condicionales / reglas desactivadas.
* **Clasificación:**
  * **Clase A (Reactivable ya con renderer en modo mock/Vite o cálculo determinista):** 1 caso
    (`a11y.test.tsx` · regla `color-contrast` de axe), **reactivado** con 10 unit tests puros
    WCAG 2.2 AA **y** con el harness OKLCH de 6 tests (`ThemeTokensOklch.test.tsx`).
  * **Clase B (Requiere Electron real o infraestructura nativa de backend):** **11 bloques
    `describe.skip`** en `tests/gui/specs/02..13` + **3 `test.skip`** en
    `tests/gui/electron/floating-minimize.electron.ts` = **14 puntos**.
  * **Clase C (Obsoleto o metatest de checklist documental):** 1 test
    (`tests/gui/specs/13-tray-build.spec.ts:36`, dentro del bloque Clase B).
  * **Clase D (Bloqueado por entorno, precondición de bundle, SO o credenciales):** 3 casos
    (guards de compilación/binario en los specs `.electron.ts`, symlink en Windows,
    flag `EGO_SOAK`, flag `EGO_REAL_DB`).
* **Estado de la suite GUI Playwright (`tests/gui/specs/`):**
  * **3 specs activos** (`14-visual`, `floating-full`, `floating-island`) y **11 bloques
    `describe.skip`** de Clase B.
  * Los 11 skips **llevan la clase en el título** (`"requiere backend Electron vivo — Clase B
    (taxonomía docs/dev/e2e-skip-inventory.md)"`): la taxonomía vive **en el código**, no
    sólo en este documento.
  * Static Gate `tests/gui/scripts/check-gui-coverage.cjs` en **VERDE** (16 specs, 0 fallos).
  * `tests/gui` es **miembro del workspace pnpm** (`pnpm-workspace.yaml`) → su `test` script
    (gate estático) ya corre dentro de `pnpm -r test` (`EGO-FIND-62` cerrado).
* **CI:** el job `gui` **ejecuta** la suite GUI en CI, pero **no reactiva** los 11 skips: no
  basta con quitar el `skip`, hay que dejar de correr la suite contra el dev-server Vite
  (donde `window.ego` no existe porque no hay preload) y pasarla a la app Electron real vía
  `electron.playwright.config.ts` (`_electron.launch()`), que es otro runner con otro
  `webServer`.

### 1.1 Cambio de contrato del E2E Electron (2026-10-19, `d50a050`)

> **Contrato vigente:** al **minimizar** la ventana principal, la isla flotante
> **APARECE** siempre que no esté `muted`/`disabled` y `presenceMode !== "never"`, y se
> **auto-oculta** al restaurar.
> **Contrato derogado:** el gate `shouldAutoShow` ("sin trabajo no aparece") ya no aplica.

Las referencias a `shouldAutoShow(floatingSnapshot())` en la documentación de este
inventario eran **obsoletas** y se han corregido. La spec negativa
"minimize sin trabajo → NO aparece flotante" pasó a "minimize sin trabajo → **aparece** la
isla y se auto-oculta al restaurar".

---

## 2. Tabla Maestra de Inventario de Skips

| Archivo:Línea | Qué cubre | Motivo declarado | Clase | Acción recomendada |
|---|---|---|:---:|---|
| `tests/gui/specs/02-streaming.spec.ts:18` | `streaming: un turno hace stream y el badge 🧠 muestra usage` | Exige backend Electron real: turno vía `llmStream` del main + telemetría de usage a `MetricsConsole`. | **B** | Mantener skip documentado en E2E GUI web. En browser sin backend real, el guard BYOK bloquea generación simulada intencionalmente. |
| `tests/gui/specs/03-hitl.spec.ts:8` | `HITL: acción sensible muestra ApprovalCard y bloquea hasta resolver` | Exige pipeline de aprobaciones del main (`daily.listApprovals` + HITL con ACK). | **B** | Mantener skip en suite Playwright web. El componente `ApprovalCard` se valida de forma exhaustiva en RTL (`ApprovalCard.rtl.test.tsx`). |
| `tests/gui/specs/03-hitl.spec.ts:14` | `HITL: rechazar revierte sin efectos colaterales` | Exige ejecución transaccional con reversión de efectos colaterales en el main. | **B** | Mantener skip en suite Playwright web. La lógica de rollback pertenece al runtime del backend. |
| `tests/gui/specs/04-proyectos.spec.ts:15` | `proyectos: selectFolder abre diálogo nativo y persiste tras reinicio` | `selectFolder` es diálogo nativo del shell (no DOM) y persistencia en VantaDB. | **B** | Mantener skip en suite Playwright web. Se cubre en smoke `shell.electron.ts` con mock de `dialog.showOpenDialog`. |
| `tests/gui/specs/05-subegos.spec.ts:19` | `sub-egos: delegación real ejecuta y comparte memoria` | Exige Sub-Ego runtime y memoria compartida del main con VantaDB. | **B** | Mantener skip en suite Playwright web. Cubierto por tests de integración `tests/e2e/subegos-delegation.test.ts`. |
| `tests/gui/specs/06-canvas.spec.ts:22` | `canvas: JSON→editar→reinicio rehidrata intacto` | Persistencia del canvas en VantaDB vía main + relanzamiento de la ventana. | **B** | Mantener skip en suite Playwright web. La hidratación y persistencia requieren ciclo de vida Electron real. |
| `tests/gui/specs/07-mcp.spec.ts:16` | `MCP: catálogo de skills lista servidores y respeta firma` | Exige subproceso `McpClient` del main y verificación criptográfica de firmas (T20 fail-closed). | **B** | Mantener skip en suite Playwright web. El modal `McpManagerModal` está verificado en `a11y.test.tsx`. |
| `tests/gui/specs/08-daily.spec.ts:24` | `daily: primer inicio del día abre en Daily State` | Exige `daily.isFirstLaunch()` del main. Sin bridge el fallback es el workspace. | **B** | Mantener skip en suite Playwright web. |
| `tests/gui/specs/09-dominios.spec.ts:14` | `dominios: cada dominio muestra contenido real, nunca vacío silencioso` | El contenido por dominio lo sirve el main (`domains.switch`). | **B** | Mantener skip en suite Playwright web. `DomainSelector` accesible se valida en `a11y.test.tsx`. |
| `tests/gui/specs/11-byok-block.spec.ts:9` | `BYOK: sin keys el modelo remoto se bloquea con mensaje honesto` | Exige Credential Manager del main + integración con keychain del SO (T21). | **B** | Mantener skip en suite Playwright web. |
| `tests/gui/specs/12-omnibar.spec.ts:26` | `omnibar: buscar devuelve hits VantaDB y @/ menciona entidades` | Exige `memory.searchMulti` del main contra base de datos VantaDB viva. | **B** | Mantener skip en suite Playwright web. La apertura y foco del combobox se validan en el test activo del spec. |
| `tests/gui/specs/13-tray-build.spec.ts:30` | `tray: icono refleja estado (colores) y menú responde` | El tray es shell nativo fuera del DOM, sin ventana accesible por Playwright web. | **B** | Mantener skip en suite Playwright web. Pertenece al shell nativo de Electron. |
| `tests/gui/specs/13-tray-build.spec.ts:36` | `build+test verdes tras Task 11 (contexto del checklist, no GUI)` | Metatest documental de trazabilidad para los 13 ítems del checklist manual T10. | **C** | Documentar como metatest histórico. No intentar automatizar dentro de Playwright. |
| `tests/gui/electron/floating-minimize.electron.ts:105` | Guard de entrada compilada (`out/main/main.js`) | Falta bundle compilado en `apps/desktop/out/main/main.js`. | **D** | Requiere ejecutar previamente `pnpm build`. |
| `tests/gui/electron/floating-minimize.electron.ts:110` | Guard de binario Electron (`node_modules/electron/dist`) | Falta ejecutable de Electron en el entorno de pruebas. | **D** | Requiere instalación de toolchain de Electron. |
| `tests/gui/electron/floating-minimize.electron.ts:224` | Leg de aprobación HITL (minimize **con** HITL pendiente) | Sin hook de siembra en producto (`preload tasks` = list/cancel; restore = tray-click OS-level) no hay forma honesta de sembrar HITL desde fuera → skip documentado, **NO fail**. | **B** | Exponer un hook de siembra (p. ej. `EGO_E2E_SEED_TASK`) y quitar el skip. La aparición de la isla al minimizar ya **no** depende de trabajo (contrato `d50a050`) y la cubre el test anterior. Cadena cubierta por vitest `tests/e2e/floating-minimize.test.ts`. |
| `tests/gui/electron/shell.electron.ts:54` | Guard de entrada compilada (`out/main/main.js`) | Falta bundle compilado en `apps/desktop/out/main/main.js`. | **D** | Requiere ejecutar previamente `pnpm build`. |
| `tests/gui/electron/shell.electron.ts:59` | Guard de binario Electron | Falta ejecutable de Electron en el entorno de pruebas. | **D** | Requiere instalación de toolchain de Electron. |
| `tests/chaos/soak-nightly.test.ts:26` | `STAB-11 soak-nightly: memoria estable bajo carga sostenida` | `describe.skipIf(!SOAK)`: test de soak/estrés de 30 min reservado para nightly. | **D** | Ejecutar exclusivamente en pipeline CI nocturno fijando `EGO_SOAK=1`. |
| `tests/security/injection-boundaries.test.ts:217` | `symlink/junction que apunta fuera → lanza` | `ctx.skip()` honesto: la creación de symlinks en Windows sin modo desarrollador/admin falla con `EPERM`. | **D** | Preservar skip defensivo honesto en entornos Windows sin permisos de symlink. |
| `apps/desktop/test/ipc.integration.test.ts:53` | `IPC integración con DB real (tmpdir Fjall, sin mocks)` | `describe.skipIf(!process.env.EGO_REAL_DB)`: requiere binding nativo de VantaDB disponible. | **D** | Activar fijando `EGO_REAL_DB=1` cuando se verifique persistencia con motor Fjall compilado. |
| `apps/desktop/renderer/test/a11y.test.tsx:41` | Regla `color-contrast` de axe desactivada | Happy-DOM carece de motor de layout y CSS renderizado para medir contraste real. | **A** | **REACTIVADO**: verificado mediante cálculo determinista con función pura WCAG 2.2 AA sobre las 4 paletas y 4 presets, y con el harness OKLCH (`ThemeTokensOklch.test.tsx`). |

---

## 3. Auditoría de Contraste WCAG 2.2 AA (Tokens de Tema)

### 3.1. Metodología de Verificación Pura

Debido a que `happy-dom` no ejecuta el motor de layout ni computa sombras/bounding boxes para que `axe-core` evalúe contraste en el DOM, se implementó en `apps/desktop/renderer/test/a11y.test.tsx` una función pura basada en las fórmulas oficiales del W3C (WCAG 2.1 / 2.2):
* **Luminancia Relativa ($L$):**
  $$L = 0.2126 \cdot R_{lin} + 0.7152 \cdot G_{lin} + 0.0722 \cdot B_{lin}$$
* **Ratio de Contraste ($CR$):**
  $$CR = \frac{L_1 + 0.05}{L_2 + 0.05} \quad (\text{con } L_1 \ge L_2)$$
* **Criterios de Éxito:**
  * Texto normal y muted: $\ge 4.5:1$ (WCAG AA).
  * Bordes interactivos y componentes UI (`borderStrong`): $\ge 3.0:1$ (WCAG AA).

> **Adición 2026-10-19 (T14, `EGO-FIND-72`):** las 4 paletas pasaron a **OKLCH**
> (`apps/desktop/renderer/src/styles/theme-tokens.css`). El harness
> `apps/desktop/renderer/test/ThemeTokensOklch.test.tsx` (6 tests) convierte el
> OKLCH de vuelta a sRGB y aplica **esta misma fórmula de luminancia relativa** sobre las
> paletas reales → el contrato de contraste pasa a ser **verificable sobre la fuente**, no
> sobre una copia. Ver [`docs/design/DESIGN.md`](../design/DESIGN.md) §3.

---

### 3.2. Hallazgos Formales de Contraste (Tokens No Conformes)

> [!WARNING]
> Siguiendo la regla estricta de no mutar código de producción, los tokens existentes **NO fueron alterados**. Los pares con fallo se documentan aquí y se asientan en la suite de pruebas mediante tests marcados con `it.fails` para mantener visibilidad continua en CI.
>
> **Estado 2026-10-20:** los **6 `it.fails` siguen vivos**. La migración a OKLCH
> (T14) añadió el harness de **no regresión** sobre las paletas reales, pero **no
> corrigió** los pares no conformes de los *presets* de `DesignSystemProvider`
> (`FIXED_DIM` / `FIXED_BORDER_STRONG`), que son tokens **fijos a piñón** y no
> dependen de la paleta. → `EGO-FIND-71` sigue **parcial** → Ola 2.

#### 1. Hallazgo FIND-A11Y-01 (`theme-tokens.css` · Warm Sepia)
* **Superficie:** `raised` (`#44403c`)
* **Token evaluado:** `--ego-color-border-strong: #78716c`
* **Ratio obtenido:** **2.14:1** (Exigido: $\ge 3.0:1$).
* **Impacto:** Bordes de tarjetas elevadas e inputs interactivos en la paleta Warm Sepia presentan bajo contraste perceptual contra superficies nivel 2.
* **Test asociado:** `a11y.test.tsx` `it.fails("warm-sepia: borderStrong #78716c sobre raised #44403c falla >= 3:1 (Hallazgo FIND-A11Y-01)")`.

#### 2. Hallazgo FIND-A11Y-02 (`DesignSystemProvider.tsx` · Emerald Terminal)
* **Superficies:** `panel` (`#064e3b`) y `raised` (`#065f46`)
* **Token evaluado:** `FIXED_BORDER_STRONG: #71717a`
* **Ratios obtenidos:**
  * Sobre `panel`: **2.01:1** (Exigido: $\ge 3.0:1$).
  * Sobre `raised`: **1.59:1** (Exigido: $\ge 3.0:1$).
* **Impacto:** El token fijo gris `#71717a` colisiona con los verdes intermedios oscuros de Emerald Terminal, quedando prácticamente invisible en divisiones de panel.
* **Test asociado:** `a11y.test.tsx` `it.fails("emerald-terminal: fixed borderStrong #71717a sobre panel/raised falla >= 3:1 (Hallazgo FIND-A11Y-02)")`.

#### 3. Hallazgo FIND-A11Y-03 (`DesignSystemProvider.tsx` · Amber Warm)
* **Superficie:** `raised` (`#44403c`)
* **Token evaluado:** `FIXED_BORDER_STRONG: #71717a`
* **Ratio obtenido:** **2.13:1** (Exigido: $\ge 3.0:1$).
* **Impacto:** Borde interactivo débil sobre tarjeta elevada en preset sepia.
* **Test asociado:** `a11y.test.tsx` `it.fails("amber-warm: fixed borderStrong #71717a sobre raised #44403c rinde 2.13:1 (falla >= 3:1, FIND-A11Y-03)")`.

#### 4. Hallazgo FIND-A11Y-04 (`DesignSystemProvider.tsx` · Midnight Cyan)
* **Superficie:** `raised` (`#1e293b`)
* **Token evaluado:** `FIXED_DIM: #8a8a92`
* **Ratio obtenido:** **4.27:1** (Exigido para texto normal: $\ge 4.5:1$).
* **Impacto:** Texto de metadata secundaria o timestamps sobre tarjetas elevadas en Midnight Cyan queda ligeramente por debajo del umbral AA.
* **Test asociado:** `a11y.test.tsx` `it.fails("midnight-cyan: fixed dim #8a8a92 sobre raised #1e293b rinde 4.27:1 (falla >= 4.5:1, FIND-A11Y-04)")`.

#### 5. Hallazgo FIND-A11Y-05 (`DesignSystemProvider.tsx` · Emerald Terminal)
* **Superficies:** `background` (`#022c22`), `panel` (`#064e3b`), `raised` (`#065f46`)
* **Token evaluado:** `FIXED_DIM: #8a8a92`
* **Ratios obtenidos:**
  * Sobre `background`: **4.42:1** (Exigido: $\ge 4.5:1$).
  * Sobre `panel`: **2.84:1** (Exigido: $\ge 4.5:1$).
  * Sobre `raised`: **2.24:1** (Exigido: $\ge 4.5:1$).
* **Impacto:** El token fijo gris no se adapta a la luminosidad de los fondos verdosos, degradando severamente la legibilidad de textos secundarios.
* **Test asociado:** `a11y.test.tsx` `it.fails("emerald-terminal: fixed dim #8a8a92 sobre panel #064e3b rinde 2.84:1 (falla >= 4.5:1, FIND-A11Y-05)")`.

#### 6. Hallazgo FIND-A11Y-06 (`DesignSystemProvider.tsx` · Amber Warm)
* **Superficies:** `panel` (`#292524`) y `raised` (`#44403c`)
* **Token evaluado:** `FIXED_DIM: #8a8a92`
* **Ratios obtenidos:**
  * Sobre `panel`: **4.43:1** (Exigido: $\ge 4.5:1$).
  * Sobre `raised`: **3.00:1** (Exigido: $\ge 4.5:1$).
* **Impacto:** Legibilidad sub-óptima para texto secundario en paneles de configuración.
* **Test asociado:** `a11y.test.tsx` `it.fails("amber-warm: fixed dim #8a8a92 sobre panel #292524 rinde 4.43:1 (falla >= 4.5:1, FIND-A11Y-06)")`.

---

### 3.3. Recomendación de Diseño para Fase Futura

En lugar de tokens monocromáticos globales fijados a piñón fijo (`FIXED_DIM = #8a8a92`, `FIXED_BORDER_STRONG = #71717a`), modularizar `dim` y `border-strong` dentro del mapa de cada preset o calcularlos dinámicamente según la luminancia del fondo activo mediante una función WCAG consciente del tema.

> **Nota de implementación (2026-10-19):** con las paletas ya en **OKLCH**, la
> modularización es más barata que nunca: basta con mover `dim` y `border-strong`
> a **tokens por paleta** (`--ego-color-dim`, `--ego-color-border-strong` ya
> existen por paleta) y dejar de fijar el valor en `DesignSystemProvider`. El
> harness `ThemeTokensOklch.test.tsx` ya mide el contraste sobre esos tokens, así
> que el cambio se puede hacer con **RED primero**.

---

## 4. Cómo reactivar un skip de Clase B (procedimiento) ##

1. **Localizar el bloque**: el título del `describe.skip` lleva ya la clase; si dice
   *"Clase B"*, el caso es de backend Electron real.
2. **Cambiar el runner**: la suite GUI web (`tests/gui/playwright.config.ts`) sirve el
   renderer con Vite; para estos casos hay que usar
   `tests/gui/electron.playwright.config.ts` (`_electron.launch()`), que abre la
   app real con preload → `window.ego` disponible.
3. **Escribir el test rojo**: el spec debe fallar **antes** del fix, con el mensaje de
   fallo real (no un `skip` disfrazado).
4. **No debilitar el assert**: cambiar la expectativa solo con justificación escrita
   (patrón usado en la Ola 1 por A4, ver su handoff §7).
5. **Mover la clase en la tabla de arriba** y actualizar el recuento del §1.

---

## 5. Referencias ##

- `tests/gui/specs/` — 15 specs (3 activos, 11 bloques `describe.skip` + 1 metatest).
- `tests/gui/electron/` — 2 suites Electron con guards de entorno.
- `tests/gui/scripts/check-gui-coverage.cjs` — static gate (16 specs, 0 fallos).
- `apps/desktop/renderer/test/a11y.test.tsx` — auditoría de contraste (6 `it.fails`).
- `apps/desktop/renderer/test/ThemeTokensOklch.test.tsx` — harness de contraste sobre las
  paletas OKLCH reales.
- `docs/design/DESIGN.md` — contrato de contraste y paletas.
- `docs/roadmap/Backlog.md` — `EGO-FIND-62` (workspace), `EGO-FIND-63` (tautológicos),
  `EGO-FIND-71` (AA), `EGO-FIND-72` (OKLCH).
- `docs/agent-ops/plans/2026-10-19-remediation-wave1/handoff/A7.md` — §2.5 (este inventario).
