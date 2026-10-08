---
description: "Investigación profunda por módulo con registro de configuración y decisiones HITL por hallazgo. Uso: /research <módulo> | /research synthesis | /research (listar)"
---

> **ENTRY POINT — Research Command**
> El agente DEBE leer este archivo cuando el usuario envía un mensaje que empieza con `/research`.
> Path resolution: `prompts/X.md` → `.agents/task-system/prompts/X.md`
>
> **Registro de módulos (fuente única de datos):** `.agents/references/research-modules.md`

Cargá las skills `progreso`, `source-driven-development`, `coordinated-web-search` (modo ponytail full activo vía plugin — ver `.agents/skills/ponytail/SKILL.md`).

Entrada: $ARGUMENTS

## Router

| Invocación | Acción |
|------------|--------|
| `/research <módulo>` | Flujo por-módulo: Fases V→R→D (abajo) |
| `/research synthesis` | Sala de decisión GLOBAL: cargá y ejecutá `.agents/task-system/prompts/research-decide.md` |
| `/research` (sin argumento) | Listar módulos del registro + estado de reportes existentes en `docs/agent-ops/research/` (o `docs/agent-ops/reviews/`) |

---

## Flujo por-módulo (`/research <módulo>`)

### Fase V — Validar módulo (Gate de registro)

Leé el registro `.agents/references/research-modules.md`. El argumento
`<módulo>` puede venir con o sin backticks; normalizá a minúsculas.

1. **¿Está en la tabla del registro Y existe el directorio?**
   → ✅ Continuar a Fase R con los datos de su fila.
2. **Está en la tabla pero el directorio NO existe en el repo:**
   → Informarlo y preguntar vía `question`: "El módulo `<X>` está registrado pero
   no existe en disco. ¿Investigar igual (puede haberse movido), archivar la fila,
   o abortar?" — Registrar lo decidido.
3. **NO está en la tabla pero el directorio SÍ existe:**
   → Gate de registro (obligatorio antes de investigar). Preguntá vía `question`
   los campos faltantes, UNA ronda:
   - **Tipo** (binding/SDK/server/adapters/otro — con ejemplos de la tabla)
   - **Ecosistema** (npm/PyPI/crates.io/repo)
   - **Usuarios objetivo** (opción "descripción libre" permitida acá — es dato nuevo)
   - **Competidores mínimos** (sugerí 3-5 detectados por el dominio si podés)
   - **Nota específica** (deudas/checkpoints conocidos)
   Con las respuestas: agregá la fila al registro y continuá a Fase R.
4. **Ni en la tabla ni existe el directorio:**
   → Comunicar que el módulo no existe: "❌ `<X>` no está registrado ni existe en
   el repo. Módulos disponibles: <lista>". Ofrecer vía `question`: registrar como
   módulo externo/nuevo o abortar.

### Fase R — Investigación (plantilla según módulo)

1. **Plantilla:** módulos de UI/superficie de producto →
   cargá `.agents/task-system/prompts/research-module-product.md`. Todos los demás →
   `.agents/task-system/prompts/research-module.md`.
2. Cargá el archivo de plantilla correspondiente.
3. Sustituí los placeholders con los datos del módulo.
4. Ejecutá el proceso completo de investigación (fuentes internet + interno).
5. El informe DEBE incluir el **Apéndice de hallazgos H-NN**: todo hallazgo con ID,
   categoría sugerida, severidad, esfuerzo, file:line.

### Fase D — Decisiones por hallazgo (HITL, cero pérdida de datos)

> Principios canónicos: `.agents/task-system/prompts/question-gates.md`. Cada hallazgo del apéndice
> H-NN recibe UNA decisión explícita o entra por default-explícito registrado.

1. Extraé del informe la lista completa de hallazgos H-01..H-NN.
2. Agrupá por categoría sugerida en rondas de **máx 5 hallazgos por pregunta**, usando `question` con `multiple: true`.
3. Hallazgos ESTRATEGIA → pregunta individual dedicada.
4. **Ningún H-NN puede quedar sin destino.**
5. Materialización:
   - APLICAR/MEJORAR/AGREGAR/OPTIMIZAR → fila **FIND-\*** en Backlog (fuente canónica `.agents/task-system/prompts/findings.md`).
   - DESCARTAR → `docs/wontfix.md` con motivo.
   - Quick wins aprobados → plan file con waves, listo para `/pipeline run`.
   - Estrategia → memoria (`memory_record_decision`) + sugerir ADR.

## Output final

```markdown
## Investigación: <módulo>
Informe: docs/agent-ops/research/research-<módulo>-<fecha>.md (score global X.X/10)
Hallazgos: NN (aplicar N · mejorar N · agregar N · optimizar N · estrategia N · descartar N)

## Decisiones registradas
| H-NN | Decisión | Destino (Backlog ID / wontfix / plan) |
...

## Próximo paso recomendado
/pipeline run docs/agent-ops/plans/<plan>.md        (si hubo quick wins)
/research <siguiente-módulo>              (continuar investigación)
/research synthesis                       (cuando estén todos los módulos)
```
