# Regla: gobernanza desktop (Ego)

- Cuarentena: `quarantine/pending` + TTL 7-14d + estados; solo crece memoria respaldada.
- `supersede` atómico para versiones; `gov/audit` append-only con veredicto completo.
- Acciones sensibles (facturar, merge, publicar, pagar) exigen aprobación explícita + kill switch 1 clic.
- CRM mínimo: contactos/deals/minutas con aristas (`RESOLVED_BY`, `SUPERSEDED_BY`); sintaxis editor `@cliente/#decisión/~ADR`.
- Export/import `.vdbdump` + snapshots en user-data; restauración verificada en temporal.
- Toda decisión del owner queda en `docs/ego-review-tracker.html`; nada se aplica sin veredicto.
