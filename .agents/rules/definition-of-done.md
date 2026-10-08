# Definition of Done (DoD) — Quality Gate Rule

Ninguna tarea se considera terminada ni apta para merge sin cumplir los 6 criterios obligatorios:

1. **Implementación Completa:** El código satisface todos los requisitos funcionales de la tarea sin placeholders ni comentarios `// TODO: implement later`.
2. **Sin Errores de Tipado ni Compilación:** Los checkers estáticos del lenguaje pasan con 0 errores (ej. `tsc --noEmit`, `cargo check`, `mypy`).
3. **Pruebas de Verificación:** Existen pruebas unitarias o de integración que validan el cambio tanto en caminos exitosos como en casos de error.
4. **Cero Regresiones:** Los tests existentes continúan pasando exitosamente.
5. **Documentación Sincronizada:** Si se modificó una interfaz pública, contrato o configuración, la documentación fue actualizada en el mismo turno.
6. **Revisión de Seguridad:** Sin secretos, credenciales ni claves de API en el código fuente.
