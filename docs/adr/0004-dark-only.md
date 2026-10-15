# ADR 0004: Dark-only (sin tema claro) #

| Campo | Valor |
| --- | --- |
| Fecha | 2026-10-15 |
| Estado | Aceptado |
| Nivel jerárquico | 5.Design (`docs/jerarquia-canonica.md`) |

## Contexto ##

El Design System canónico define Ego como interfaz oscura con 4 presets,
kit Radix y estados catalogados (ver índice de `docs/index.md` §Product).
Soportar tema claro duplicaría tokens, contraste y QA visual.

## Decisión ##

Ego es **dark-only**: un único modo oscuro con 4 presets seleccionables.
No se implementa tema claro ni conmutación claro/oscuro en esta etapa.

## Consecuencias ##

- Positivas: la mitad de tokens y casos de contraste que auditar;
  consistencia visual garantizada; QA de accesibilidad acotado.
- Negativas: usuarios que prefieren tema claro no tienen alternativa;
  se documenta como decisión consciente, no como bug.
- Riesgos: un futuro tema claro exigiría revisar tokens, presets y los
  9 estados del kit; requiere ADR de reversión, no parche parcial.

## Referencias ##

- `AGENTS.md` §2 (jerarquía: Design = CÓMO se experimenta).
- `docs/roadmap/Backlog.md` — Fase 04 (Canvas + component registry).
- Design System canónico (enlace en `docs/index.md` §Product).
