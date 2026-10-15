#!/usr/bin/env node
// scripts/release/sign.mjs — SPEC DIST-04 (docs-only, STAB-16).
//
// ESTADO: owner-gated. Este archivo es una ESPECIFICACIÓN EJECUTABLE-FALLIDA,
// no una implementación de firma. Sin certificados del owner (Apple Developer
// ID + Authenticode EV) no hay firma posible; fingirla está prohibido
// (BLOQUEO owner 2026-10-13, Gate P 2026-10-16).
//
// Qué hará el script real cuando el owner aporte certs (DIST-04 desbloqueado):
//   1. Leer secretos SOLO de entorno/CI (nombres en docs/deployment/distribution.md §2;
//      ningún valor en repo, jamás).
//   2. macOS: `electron-builder --mac` con `CSC_*`/keychain + `notarytool`
//      (Apple ID + app-specific password + Team ID), `hardenedRuntime: true`
//      (ya activado en electron-builder.config.cjs) + staple.
//   3. Windows: firma Authenticode (EV recomendado) del instalador NSIS
//      para evitar SmartScreen; timestamp RFC3161.
//   4. Verificar artefactos firmados + generar SHASUMS.txt
//      (`node scripts/generate-checksums.cjs <release-dir>`).
//   5. Solo ENTONCES el owner decide canal y autoriza descomentar `publish`
//      (electron-builder.config.cjs:36-52, opciones A github / B generic).
//
// PROHIBIDO hasta DIST-04: implementar lo anterior, descomentar `publish`,
// añadir `electron-updater`, o subir cualquier secreto al repo.
//
// Este stub existe para cerrar la referencia de
// docs/deployment/distribution.md §2 ("Crearlo es parte de DIST-04")
// sin activar nada: falla cerrado con el mensaje de bloqueo.

'use strict';

const BLOQUEO = [
  'BLOQUEO owner DIST-04: firma de código no disponible.',
  'Sin certificados (Apple Developer ID / Authenticode EV) no hay ejecución posible.',
  'El pipeline genera instaladores unsigned por diseño.',
  'Ver: docs/deployment/distribution.md §2 y docs/roadmap/Backlog.md DIST-04.',
].join('\n');

console.error(BLOQUEO);
process.exit(2);
