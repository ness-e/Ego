# Distribución — Ego Desktop

| Campo | Valor |
| --- | --- |
| Estado | Draft operativo — distribución **sin firma** (unsigned) |
| Owner firma (BLOQUEO) | owner del producto (ver DIST-04) |
| Fecha | 2026-10-14 |
| Config builder | `apps/desktop/electron-builder.config.cjs` |
| Updater (esqueleto) | `apps/desktop/src/updater.ts` (DIST-05) |
| Checksums | `scripts/generate-checksums.cjs` → `<dir>/SHASUMS.txt` |

> Este documento describe cómo distribuir Ego **hoy**, sin requerir
> certificados del owner. No se firma, no se notariza, no hay auto-update
> con instalación silenciosa. Todo lo que requiera firma es BLOQUEO
> explícito del owner (DIST-04), no deuda técnica del pipeline.

## 1. Canales

### 1.1 Descarga directa (primaria, única activa hoy)

- Canal primario y **único operativo** hasta DIST-04.
- Artefactos por OS (ver `electron-builder.config.cjs`):
  - Windows: NSIS `.exe` (`Ego-Setup-<versión>-x64.exe`) + `zip`.
  - macOS: `dmg` universal (x64/arm64) + `zip`.
  - Linux: `AppImage` + `tar.gz`.
- Flujo: empaquetar → `node scripts/generate-checksums.cjs [dir]` →
  publicar artefactos + `SHASUMS.txt` + release notes (ver
  `release-notes-template.md`) en el canal que defina el owner.
- El usuario instala manualmente. El updater integrado solo **detecta y
  avisa** (ver §4); nunca descarga/instala en silencio.

### 1.2 Stores / distribución futura (no activa)

- Microsoft Store, Mac App Store, Snap/Flatpak, repositorios `.deb`:
  **futuro, fuera de alcance** hasta que el owner lo decida.
- Ninguno de estos canales funciona sin firma/notarización previa
  (DIST-04). No hay scripts, cuentas ni submissions configurados.
- Añadir un canal futuro no debe modificar Runtime, Router, Sub-Egos ni
  Workspace (regla de integraciones, `AGENTS.md` §7): solo packaging +
  docs de este directorio.

## 2. Requisitos de firma como BLOQUEO owner (DIST-04)

> **DIST-04 = BLOQUEO owner.** Sin certificados no hay ejecución posible
> por parte del agente. El pipeline genera instaladores **unsigned** por
> diseño hasta que el owner aporte los certificados.

| Plataforma | Requisito | Estado hoy |
| --- | --- | --- |
| macOS | Apple Developer ID + notarización + `hardenedRuntime` | BLOQUEO: sin certificado no hay DMG notarizado; Gatekeeper bloqueará/avisará al abrir |
| Windows | Certificado Authenticode (EV recomendado) para SmartScreen | BLOQUEO: sin certificado el instalador NSIS muestra aviso SmartScreen |
| Linux | Sin firma obligatoria (GPG opcional a futuro) | Distribuible unsigned + `SHASUMS.txt` |

Notas:

- `mac.hardenedRuntime: true` ya está activado en la config, pero sin
  provisioning/notarización del owner no produce un artefacto confiable.
- `win.artifactName` / `mac.artifactName` / `linux.artifactName` incluyen
  `${version}` para trazabilidad artefacto ↔ release notes ↔ tag.
- No existe `scripts/release/sign.mjs` (ruta Backlog DIST-04 verificada
  inexistente). Crearlo es parte de DIST-04, con certificados del owner.

## 3. Staged rollouts (despliegue por etapas)

Sin auto-update forzoso, el rollout es **manual y por comunicación**:

1. Publicar la release como **pre-release / beta** (grupo piloto).
2. Ventana de observación: arranque, `verify-dist` en packaged,
   smoke nativo (`smoke-native-packaged.cjs`), reportes de SmartScreen /
   Gatekeeper (esperables en unsigned).
3. Si verde: promover a **latest / estable** y anunciar al resto.
4. Si rojo: ver §5 Rollback.

Cuando DIST-04 + `publish` estén activos, el patrón recomendado es el
mismo pero con el feed (`EGO_UPDATE_FEED_URL` o GitHub Releases) marcado
por etapas: primero `prerelease: true` / canal beta, luego `latest`.

## 4. Auto-update: estado real y diferimiento a DIST-04

- `apps/desktop/src/updater.ts` (DIST-05) es un **esqueleto puro**:
  `checkForUpdates()` contra feed JSON (`EGO_UPDATE_FEED_URL`) + aviso
  discreto vía `system.alert` → `ipc.event`. Cero canales IPC nuevos.
- **`downloadUpdate()` retorna `{ status: "deferred" }` hasta DIST-04.**
  No se implementa `electron-updater` real en esta tarea por decisión
  explícita: la descarga diferencial (blockmap NSIS) solo es segura y
  verificable con `publish` activo + artefactos firmados del owner.
  Implementarla a mano reinventaría ese stack con riesgo de seguridad.
- Bloque `publish` en `electron-builder.config.cjs`: **comentado**.
  Incluye plantilla lista con endpoint genérico (`EGO_UPDATE_FEED_URL`)
  para activar cuando el owner aporte firma + decida el canal.
  Descomentar `publish` sin DIST-04 está prohibido (generaría updates
  no verificables).

## 5. Rollback

- Sin instalación silenciosa, el rollback es **reinstalación de la
  versión anterior**: el usuario descarga el instalador previo
  (conserva su `SHASUMS.txt` + release notes) y reinstala.
- Los datos de usuario (VantaDB en carpeta usuario + snapshots fichero)
  no se tocan en el rollback. Ante duda: snapshot manual pre-riesgo
  (`docs/operations/snapshots-respaldo.md`) antes de actualizar.
- Regla: nunca pedir al usuario que borre su carpeta de datos como
  "solución" a un instalador defectuoso.

## 6. Checksums sin firma

- Generar con: `node scripts/generate-checksums.cjs [dir]`
  (`dir` = `dist/` por defecto; acepta `release/`, que es el output real
  de `directories.output` en la config).
- Verificación por el usuario (ejemplo Windows):
  `certutil -hashfile Ego-Setup-0.1.0-x64.exe SHA256` y comparar con
  `SHASUMS.txt`; macOS/Linux: `shasum -a 256 <artefacto>`.
- Límite honesto: el checksum detecta **corrupción**, no **suplantación**.
  La autenticidad real llega con DIST-04 (firma).

## 7. Checklist de release unsigned

1. `pnpm build` verde + `verify-dist` TODOS EN VERDE.
2. `pnpm --filter @ego/desktop dist` (o `pack --dir` para prueba local).
3. `node scripts/generate-checksums.cjs` → `SHASUMS.txt` junto a los
   artefactos.
4. Release notes desde `release-notes-template.md` (Added/Fixed/
   Security/Migration).
5. Publicar artefactos + `SHASUMS.txt` + notes en el canal directo.
6. Anunciar con la advertencia unsigned (SmartScreen/Gatekeeper esperado)
   + instrucciones de verificación de hash.
