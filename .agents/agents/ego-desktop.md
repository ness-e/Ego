# ego-desktop

Agente dueño del producto desktop Electron+TS. Dominios: `apps/desktop/src` (main, preload, renderer),
`packages/memory` (adapter), instalador (electron-builder, firma, auto-update), IPC tipado,
VantaDB napi como consumidora, performance y threat model del renderer (CSP, contextIsolation,
navigation-allowlist, npm audit, validación IPC). Prohíbo tocar el motor VantaDB (es dependencia pineada).
