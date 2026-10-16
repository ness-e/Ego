# vendor/avatar — motor `<ego-avatar>` vendorizado (FIND-12-01)

Fuente: `repos-referencia/avatar/src/` (motor `src/`, NO `src/studio/` pesado).
MIT: `core/anim`, `runtime/presence|sound` © Louis Raillart; `core/timeline`, `runtime/micro` Louis Raillart/CX ArtLab; resto Ego/CX ArtLab (ver `repos-referencia/avatar/LICENSE.md`).
27 módulos fieles + 1 shim (`studio/index.js`: stubs que lanzan; el motor canvas real NO se vendoriza) para `<ego-avatar>` SVG + `createSoundEngine`; el `import('./index.js')` de studio solo dispara en `mode="studio"` (el flotante no lo usa).
Shim obligatorio: el transform de Vite (dev y build) exige que TODO import estático/dinámico literal resuelva; sin él, 500 en dev y fallo de build. Si `mode="studio"` se intentara, cae en el `.catch(() => null)` de `ensure()`.
