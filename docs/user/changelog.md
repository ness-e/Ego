# Novedades (changelog)

Versión amigable del [CHANGELOG.md](../../CHANGELOG.md) canónico
(formato Keep a Changelog + SemVer). Si hay discrepancia, manda el
`CHANGELOG.md` de la raíz.

## Próximo (sin publicar)

Esto es lo que viene en camino, aún sin número de versión:

- **E2E en Electron desde cero:** ya existe el esqueleto para probar la app
  desktop real de punta a punta (abre la ventana, verifica el bundle y corre
  los escenarios base). En CI se omite con aviso si todavía no hay bundle
  construido.
- **Accesibilidad WCAG 2.2:** base para que Ego sea usable con teclado,
  lector de pantalla y contraste suficiente.
- **Resaltado y movimiento mínimos:** base de Shiki (código legible) y Motion
  (transiciones sobrias) sin inflar dependencias.
- **Navegación y CSP más duras:** base de política de seguridad de contenido
  y navegación endurecida en la ventana desktop.

### Migración

Ninguna acción requerida: todo lo anterior es aditivo y no cambia APIs,
configuración ni formato de datos. Si usas un bundle anterior, reconstruye
con `pnpm build` para probar el flujo E2E completo.
