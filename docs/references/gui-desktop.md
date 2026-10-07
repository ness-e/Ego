# GUI desktop — reglas y patrones

| Campo | Valor |
| --- | --- |
| Estado | Revisable — patrones verificados con URLs |
| Owner | ness-e |
| Fecha | 2026-10-05 |

## Patrón universal

Navegación izquierda estrecha + contenido central + inspector derecho colapsable
(VS Code: ActivityBar + Sidebars + Editor + Panel + StatusBar; Claude/Codex/Notion/Obsidian/Linear igual;
Arc/1Password: rail + lista + detalle).

## 10 reglas

1. Layout 3 zonas + StatusBar; no mezclar navegación y detalle. https://code.visualstudio.com/api/ux-guidelines/overview
2. Sidebar = contenedores arrastrables. https://code.visualstudio.com/api/ux-guidelines/activity-bar
3. Command palette `Cmd+K` obligatoria (fuzzy + preview + atajos). https://code.visualstudio.com/api/ux-guidelines/command-palette
4. Frameless correcto: `titleBarStyle:'hidden'` + `titleBarOverlay`, `app-region:drag`. https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
5. Ventana = `BrowserWindow` + trafficLights/`titleBarOverlay`. https://www.electronjs.org/docs/latest/tutorial/window-customization
6. Menús nativos con `role:` antes que `click` manual. https://www.electronjs.org/docs/latest/api/menu
7. Tray con icono por OS. https://www.electronjs.org/docs/latest/api/tray
8. Diálogos archivo/error nativos (`dialog`); web-modal solo forms propios. https://www.electronjs.org/docs/latest/api/dialog
9. Atajos: `MenuItem.accelerator` local, `globalShortcut` global. https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts
10. Dark-mode y notificaciones siguen al OS (`nativeTheme`, `Notification`). https://www.electronjs.org/docs/latest/tutorial/dark-mode

## Qué copiar por app

VS Code (activity+panel+palette) · Linear (densidad, `Cmd+K`, single-key) · Raycast (launcher) ·
Notion (sidebar + `/` commands) · Obsidian (local-first + inspector) · Arc (rail + spaces) ·
1Password (quick access) · Claude Desktop (chats + MCP/tools + artifacts) · Codex (canvas/logs + companion) ·
Hermes Agents (sin spec pública: clonar Claude/Codex).
