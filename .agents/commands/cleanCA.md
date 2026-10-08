---
description: Auditoría Clean Code + Clean Architecture por archivo/carpeta o repo completo — reporta violaciones con severidad, sin modificar código
---

Auditoría de cumplimiento de Clean Code y Clean Architecture contra el scope dado. **Solo informa, nunca modifica.**

## 0. Anti-proliferación (declaración requerida)

- No reemplaza ningún comando. `/audit` corre gates mecánicos (linters/tests/typecheck); `/codeGraph` mapea estructura/impacto en el knowledge graph; `/code-simplify` aplica reducciones. Ninguno verifica reglas de diseño de libro (naming intention-revealing, SLAP, CQS, SOLID, dependency rule, humble objects, FIRST/AAA). `cleanCA` cubre ese espectro y sus hallazgos alimentan `FIND-*` → `/pipeline task`.

## 1. Resolver scope

- **Con parámetro** (`/cleanCA <ruta>`): auditar exactamente esa ruta (archivo, directorio o paquete).
- **Sin parámetro**: barrido automático de los directorios de código fuente del proyecto (`src/`, `packages/`, `apps/`, `lib/`, etc.), excluyendo dependencias (`node_modules`, `target`, `vendor`, `.git`). Reportar por módulo o paquete con subtotal.

## 2. Cargar norma (obligatorio)

Leer `.agents/references/clean-code-clean-architecture.md` **completo** antes de auditar.

## 3. Checklist de auditoría (todo scope)

| # | Regla (libro) | Qué detectar | Severidad default |
|---|---|---|---|
| N1 | Intention-revealing names (CC cap. 2) | Nombres que mienten, desinforman (`data`, `info`, `tmp`, `x` fuera de loop corto) | 🟡 |
| N2 | Don't Add Gratuitous Context (CC cap. 2) | Stuttering padre→hijo (`Store::store_get`, `Entity::entity_id`, `pool.pool_saturated`, `Error::IoError`). | 🟡 |
| N3 | Convenciones idiomáticas (§2.1) | snake_case/camelCase/PascalCase/SCREAMING violados según las convenciones del lenguaje | 🟡 |
| F1 | Small + Do One Thing + SLAP (CC cap. 3) | Función excesivamente larga (>25 líneas), mezcla niveles de abstracción | 🟡 |
| F2 | Args ≤3, sin flags (CC cap. 3) | ≥4 params sin objeto/options; `bool` flag que alterna comportamiento interno | 🟡 |
| F3 | Sin efectos laterales ocultos, CQS | Función que dice `get` y muta; comando que interroga y cambia estado | 🟡 |
| E1 | Errores explícitos (§2.3) | `unwrap()/expect()` no seguros en prod; `any`/catch pasivo no tipado; excepciones tragadas | 🔴 |
| C1 | Comentarios que compensan fallo (CC cap. 4) | Comentario redundante (`i++; // increment`), código comentado sin uso | 🟢/🟡 |
| S1–S5 | SOLID (§4.1) | SRP (>1 razón de cambio), OCP, LSP, ISP (interfaz inflada), DIP (concreto en vez de abstracción) | 🟡 (🔴 si dominio depende de infra) |
| A1 | Dependency Rule (§5.1) | Import outward: entidades o casos de uso de negocio acoplados directamente a DB/UI/framework | 🔴 |
| A2 | Humble Object + DTOs (§5.4) | Controlador con lógica de negocio pesada; modelos de persistencia cruzando a capas externas | 🔴/🟡 |
| A3 | ADP (sin ciclos) | Ciclos de dependencia entre paquetes o módulos | 🔴 |
| G1–G7 | Smells §2.5 | Rigidez, fragilidad, inmovilidad, opacidad, envidia de características, primitivos obsesivos | 🟡 |
| T1 | FIRST + AAA (§7) | Tests lentos/acoplados/no repetibles; test sin estructura Arrange-Act-Assert | 🟡 |

## 4. Impacto por hallazgo (obligatorio)

Para cada hallazgo 🟡/🔴, mapear:

1. **Padres** (quién depende de esto — aguas arriba)
2. **Hijos** (de qué depende — aguas abajo)
3. **Función** (qué hace en una línea)
4. **Qué se rompe si se modifica** (contratos, serialización, API pública)
5. **Mejora propuesta** (código Antes/Después mínimo, sin aplicarlo)

## 5. Formato de salida

```markdown
# cleanCA — <scope> — <fecha>
## Resumen: 🔴 X · 🟡 Y · 🟢 Z (veredicto: PASS / DEUDA / BLOQUEADO)
## 🔴 Bloqueantes
### [E1] `ruta:línea` — título
- Evidencia: `snippet`
- Por qué viola: <regla + §>
- Padres/Hijos/Función/Riesgo/Mejora (Antes/Después)
## 🟡 Deuda (igual, agrupada por regla)
## 🟢 Sugerencias (una línea c/u)
## No tocado (archivos/áreas fuera de scope + por qué)
```

## 6. Cierre

- Registrar cada 🟡/🔴 como fila `FIND-*` vía `.agents/task-system/prompts/findings.md` (fuente única de hallazgos).
- Deuda nueva queda sujeta a saldo neto ≤ 0 por PR/tarea.
- Detenerse (no implementar fixes sin que el usuario lo pida explícitamente).
