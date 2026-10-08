# Regla: namespaces, Jev y EgoMemoryAdapter (Ego)

- Todo acceso a VantaDB pasa por `EgoMemoryAdapter` (`packages/memory/`); ningún módulo llama a la SDK directo.
- `apps/desktop/ego.namespaces.json` versionado; desviación = bug. Nombres `area/subespacio`; metadata mínima `org_id/source/ts/agent_id/confidence/state`.
- Jev híbrido reglas→TypeSafe→LLM; emite JSON auditable a `gov/audit`, nunca prosa.
- `docs/prd/` congelado como referencia histórica; la fuente vigente vive en `docs/product|architecture|engineering|operations|testing|roadmap|references`.
- Sin cambios de API del motor sin matriz de revalidación (pin `vantadb==0.8.0`).
