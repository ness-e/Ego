# Lecciones Ego (2026-10-05+)

Registro vivo de lecciones del producto desktop. Historia del motor archivada en `archive/`.


### Lección 2026-10-10: Fricción en nombres de métodos de persistencia y c
- **Incidente:** Fricción en nombres de métodos de persistencia y catálogo base de Sub-Egos en DOM-01..09
- **Causa Raíz:** Los contratos iniciales usaban set() en vez de put() y el test de SubEgoFactory esperaba exactamente 5 plantillas base originales.
- **Mitigación Preventiva:** Estandarizar métodos de almacenamiento en EgoMemoryAdapter (put({ namespace, key, payload })) y usar SubEgoFactory.registerTemplate() dinámicamente sin mutar las 5 plantillas core de Fase 03.
