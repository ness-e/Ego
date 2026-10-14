// apps/desktop/electron-builder.config.cjs
// Configuración canónica de empaquetado para Ego Cognitive OS (Patrón Hermes HERM-16 / DIST-01).
// @ts-check
'use strict';

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.ego.cognitive.os',
  productName: 'Ego',
  executableName: 'Ego',
  directories: {
    output: 'release',
    buildResources: 'assets',
  },
  files: [
    'out/**',
    'package.json',
  ],
  // CRÍTICO: Los módulos nativos .node de VantaDB (Fjall LSM / napi-rs) DEBEN extraerse
  // fuera del archivo ASAR para que el dynamic linker del SO pueda cargarlos directamente.
  asar: true,
  asarUnpack: [
    '**/*.node',
    '**/node_modules/vantadb/**',
    '**/node_modules/vantadb-node/**',
  ],
  // DIST-05: canal de auto-update. Pendiente de activación por el owner
  // (requiere artefactos firmados DIST-04 + decisión del canal de releases;
  // candidato natural: repo verificado `ness-e/Ego` vía GitHub Releases).
  // Al activarlo, electron-updater provee la descarga diferencial (blockmap
  // NSIS) automáticamente. `updater.ts` ya detecta + avisa sin esta sección.
  // publish: [
  //   {
  //     provider: "github",
  //     owner: "ness-e",
  //     repo: "Ego",
  //   },
  // ],
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'zip', arch: ['x64'] },
    ],
    artifactName: '${productName}-Setup-${version}-${arch}.${ext}',
    // DIST-03: iconos dedicados (placeholders reproducibles en assets/;
    // diseño final pendiente del owner — ver assets/README.md).
    icon: 'assets/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  mac: {
    category: 'public.app-category.developer-tools',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    // DIST-03: ver nota de iconos en win.icon.
    icon: 'assets/icon.icns',
  },
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'tar.gz', arch: ['x64'] },
    ],
    category: 'Development',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    // DIST-03: ver nota de iconos en win.icon.
    icon: 'assets/icon.png',
  },
};
