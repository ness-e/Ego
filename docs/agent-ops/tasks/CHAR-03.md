---
id: CHAR-03
title: "Prototipos de siluetas originales no humanoides y elección de la identidad de Ego"
status: completed
phase: "Fase 03: Sub-Egos"
priority: P0
component: "docs/research"
assignee: "Ego Product & Character Art Direction"
dependencies: ["CHAR-01", "CHAR-02"]
origin: "Character Audit & Coucou Inventory (CHAR-01, CHAR-02)"
tags: [character, visual-identity, prototypes, canvas-2d, silhouettes, phase-03]
---

# Task: CHAR-03 — Prototipos de siluetas originales no humanoides y elección de la identidad de Ego
- **Estado:** ✅ COMPLETED
- **Plan:** docs/agent-ops/plans/2026-10-09-plan-20-tareas-mvp.md
- **Archivos clave:** docs/research/character-prototypes/character-prototypes.html, docs/product/character-art-direction.md

## 1. Contexto y Justificación
Conforme a la auditoría técnica de personajes (`CHAR-01` y `CHAR-02`):
1. **Ruptura con Clichés:** Descartar el squircle heredado de Mochi, la vestimenta humana (chaquetas, sombreros) y los clichés de mascotas antropomórficas infantiles.
2. **Entidad No Humanoide:** Diseñar 3 prototipos de siluetas abstractas bio-digitales/energéticas/geométricas:
   - Candidato A: *Monolito Cuántico Pulsante* (geometría polimórfica biselada con núcleo de energía).
   - Candidato B: *Orbe Bio-Luminiscente Fractal* (cuerpo fluido con anillos de resonancia armónica).
   - Candidato C: *Glifo Cristalino Modular* (estructuras flotantes interconectadas por líneas de fuerza).
3. **Matrices de Resolución:** Probar y evaluar legibilidad, silueta y peso visual en resoluciones canónicas: 16x16 px (favicon/taskbar), 24x24 px (badges/chat), 48x48 px (selector), 128x128 px (tarjeta grande).
4. **Decisión Formal:** Evaluar coste de renderizado en Canvas 2D, originalidad, expresividad y formalizar la elección de la silueta canónica en `character-art-direction.md`.

## 2. Blast Radius e Impacto
- **Archivos a crear/modificar:**
  - `docs/research/character-prototypes/character-prototypes.html` (Prototipo HTML interactivo autocontenido en Canvas 2D/SVG)
  - `docs/product/character-art-direction.md` (Documento de dirección de arte con criterios, puntuaciones y veredicto)
  - NOTA: No toca código de producción (`apps/desktop` ni `packages/*`).
- **Callers futuros:**
  - `CharacterProfile` (`CHAR-04`)
  - `ProceduralCharacterCanvas` (`CHAR-05`)

## Contrato
- Verificación: Archivo HTML ejecutable en navegador con visualización interactiva a 16, 24, 48 y 128 px; acta de decisión formal en Markdown.
- Evidencia: `docs/research/character-prototypes/character-prototypes.html` y `docs/product/character-art-direction.md`.
- Invariantes: Siluetas estrictamente no humanoides; sin ropa ni complementos humanos; renderizable analíticamente en Canvas 2D.

## Steps de ejecución
- [x] Step 1: Diseñar los 3 conceptos no humanoides con fórmulas matemáticas vectoriales para Canvas 2D/SVG.
- [x] Step 2: Construir el visualizador interactivo HTML autocontenido con selector de candidatos, zoom y prueba a 16, 24, 48 y 128 px.
- [x] Step 3: Evaluar los 3 candidatos con matriz de puntuación (Legibilidad, Coste computacional Canvas 2D, Expresividad de estados, Originalidad).
- [x] Step 4: Redactar acta técnica de selección y especificación matemática de la silueta elegida en `docs/product/character-art-direction.md`.
- [x] Step 5: Validar que el HTML no dependa de librerías externas o conexión de red (offline-first).

## Definition of Done
- [x] Prototipo HTML funcional y offline listo para inspección visual.
- [x] Matriz de puntuación y silueta ganadora formalmente aprobada y documentada.
- [x] Parámetros geométricos listos para alimentar `CHAR-04` y `CHAR-05`.
