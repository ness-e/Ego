# CFG-13 — Workbench extendido + personalización

> campaign_id: plan-2026-10-16-configs-revision
> Alcance (decisión usuario): completo. Voz NO (es CFG-12).
> Solo `apps/desktop/renderer/components/canvas/` + `src/App.tsx` (workspace).
> Prohibido: `main.ts`, schemas IPC, memoria, docs-sitio, `pnpm install`.

## Contrato

- Registry intacto: 11 vistas + 1 nueva (`BrowserView`) con 9 estados.
- `typecheck` renderer + test nuevo, sin regresiones.

## Steps

- [x] Discovery: registry (11 tipos), guards REV-02 (`main.ts:1837-1950`),
      IPC existente (`tasks.list/cancel`, `ipc.event`), `DesignSystemTokensSchema`.
- [x] `components/canvas/workbench-guards.ts` — `classifyBrowserUrl` loopback-only,
      `BrowserUrlSchema`, preview allowlist + tope, `CustomShortcutSchema`.
- [x] `BrowserView.tsx` — 9 estados, iframe `sandbox="allow-scripts"` sin
      `allow-same-origin`, listeners nativos load/error.
- [x] `FilePreviewView.tsx` — read-only (`<pre>` sin edición), deny fuera allowlist.
- [x] `ThemeIO.tsx` — export `.theme.json` / import validado Zod.
- [x] `CronPanel.tsx` — `tasks.list` + `tasks.cancel` (BackgroundEngine), sin polling.
- [x] `ShortcutsPanel.tsx` — custom validados, `localStorage`, evento `ego:shortcut`.
- [x] `NotifyCenter.tsx` — `onEvent` (`system.alert`/tasks) + `Notification` OS opt-in.
- [x] `WorkbenchView.tsx` — 6 tabs; `App.tsx` suma tab "Workbench".
- [x] Verify: `tsc --noEmit` ✅ · `workbench-cfg13.test.tsx` 20/20 ✅ ·
      `App` + `typed-registry` + `CanvasRuntime` 11/11 ✅.

## Fase 1 — Evidencia de debugging (Iron Law)

- Repro: `iframe onError` vía prop React no dispara en happy-dom (test `error` en rojo).
- Hipótesis: React no delega `error` del iframe igual que `load` en este runtime.
- 1 variable: solo el mecanismo de suscripción (props → `addEventListener` nativo
  en `useEffect`); el resto del componente intacto. Test en verde tras el cambio.

## Notas (no implementadas, fuera de scope)

- `main.ts:1848` `DEV_NAV_HOSTS` contiene `"::1"` pero `URL.hostname` devuelve
  `"[::1]"` (con corchetes) → `isAllowedNavigationUrl("http://[::1]:…", true)`
  es `false`. El guard renderer normaliza ambos. Main NO tocado (prohibido
  por alcance); candidato a backlog REV-02.
- Voz queda para CFG-12. Sin `pnpm install` (deps ya presentes).

last-synced: 2026-10-16
