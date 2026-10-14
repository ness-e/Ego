# Suite GUI — checklist T10-Step-3 como specs Playwright (T22)

13 specs, uno por ítem del checklist manual (`docs/agent-ops/tasks/T10.md:79`):

| Spec | Ítem T10 | Estado sin Electron |
|---|---|---|
| `01-arranque` | arranque sin consola roja | ✅ ejecutable |
| `02-streaming` | chat streaming + badge 🧠 | shell ✅ / stream vivo ⏭ skip (exige `llmStream` del main) |
| `03-hitl` | HITL ApprovalCard | ⏭ skip (exige pipeline de aprobaciones del main) |
| `04-proyectos` | proyectos + selectFolder + persistencia reinicio | shell ✅ / diálogo nativo + reinicio ⏭ skip |
| `05-subegos` | sub-egos reales | shell ✅ / delegación ⏭ skip |
| `06-canvas` | canvas JSON→editar→reinicio | shell ✅ / persistencia + reinicio ⏭ skip |
| `07-mcp` | MCP/skills | shell ✅ / catálogo + firma ⏭ skip |
| `08-daily` | daily first-launch | shell ✅ / ruteo first-launch ⏭ skip (exige `daily.isFirstLaunch`) |
| `09-dominios` | dominios sin vacíos silenciosos | shell ✅ / contenido real ⏭ skip |
| `10-a11y-tab` | a11y Tab/Escape/axe | ✅ ejecutable (diálogo ModelPicker) |
| `11-byok-block` | BYOK sin keys | ⏭ skip (exige Credential Manager + ModelRouter del main) |
| `12-omnibar` | omnibar Ctrl+K + @/ | ✅ ejecutable (hits reales ⏭ skip) |
| `13-tray-build` | tray colores + mermaid lazy + virtua + build+test | navegación ✅ / tray nativo + build/test ⏭ skip |

Regla: **skip honesto > test falso**. Cada `describe.skip` lleva el motivo
("Exige backend Electron real: …"). Sin bridge `window.ego` el renderer
degrada a defaults locales, así que los shells corren contra `pnpm dev` pelado.

## Cómo correr

```powershell
# 1. El owner levanta el dev (la suite NUNCA lo levanta sola):
pnpm dev   # renderer en http://127.0.0.1:5173 (host+strictPort fijos en vite.config)

# 2. Instalar el runner (una vez; prohibido en campaña — lo hace el owner):
cd tests/gui
pnpm install
npx playwright install chromium

# 3. Correr:
pnpm test:gui          # headless
pnpm test:gui:headed   # con ventana
```

Sin instalar nada, el gate estático corre con node pelado:

```powershell
cd tests/gui
pnpm test   # node scripts/check-gui-coverage.cjs (13 specs, trazabilidad T10, skips con motivo)
```

## Notas de calibración

- Los specs marcados `CALIBRATE` usan el nombre accesible más probable
  (tabs `canvas`/`daily`/`dominios`); si el primer run falla por selector,
  se ajusta el nombre — fallan en voz alta, nunca en verde falso.
- La auditoría axe completa es paso owner futuro (`axe-playwright`,
  instalar + un spec `10-axe`); el spec `10-a11y-tab` cubre Tab/Escape/roles.
- Este paquete es **standalone**: no está en `pnpm-workspace.yaml`, no corre
  en `pnpm -r test`, no toca `apps/**` ni `packages/**` (cero código producto).
