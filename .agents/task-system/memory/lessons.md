# Lecciones Ego (2026-10-05+)

Registro vivo de lecciones del producto desktop. Historia del motor archivada en `archive/`.


### Lección 2026-10-10: Fricción en nombres de métodos de persistencia y c
- **Incidente:** Fricción en nombres de métodos de persistencia y catálogo base de Sub-Egos en DOM-01..09
- **Causa Raíz:** Los contratos iniciales usaban set() en vez de put() y el test de SubEgoFactory esperaba exactamente 5 plantillas base originales.
- **Mitigación Preventiva:** Estandarizar métodos de almacenamiento en EgoMemoryAdapter (put({ namespace, key, payload })) y usar SubEgoFactory.registerTemplate() dinámicamente sin mutar las 5 plantillas core de Fase 03.

### Lección 2026-10-16: Orquestación waves con subagentes y rate limits
- **Incidente:** Waves paralelas x3 sin modelo explícito → `Go usage limit` + `Rate limit exceeded`.
- **Causa Raíz:** Subagentes default usan variante go con cupo propio; prompts cortos SIN-FORMATO obligan re-DISCOVERY.
- **Mitigación Preventiva:** Modelo explícito `opencode/muse-spark-1.3-contributor-free` + sessionID resume + prompts 10 bloques pipeline-run §6.f + waves MAX 3 por archivos disjuntos + `git add` selectivo + NUNCA push. ref: docs/agent-ops/plans/archive/2026-10-16-plan-estabilizacion-ego.md

### Lección 2026-10-16: Reviews P2-01 con re-run propio
- **Incidente:** Claims de suites verdes heredados del worker sin verificar.
- **Causa Raíz:** Aceptar STEPS_OK sin re-ejecución selectiva del blast radius.
- **Mitigación Preventiva:** Revisor re-corre suites del blast (o grep+stat si docs-only) y clasifica rojos ajenos por disjunción de archivos antes del approve. ref: docs/agent-ops/plans/archive/2026-10-16-plan-estabilizacion-ego.md


### Lección 2026-10-20: 25 ficheros de test del repo usaban expect(mainSrc
- **Incidente:** 25 ficheros de test del repo usaban expect(mainSrc).toContain('win.on("minimize"') en vez de observar comportamiento. Fue la causa raiz de EGO-FIND-19 (pnpm test en rojo por un assert obsoleto tras el commit d50a050) y de 3 tests mas senalados en la ola de remediacion.
- **Causa Raíz:** Los asserts de comportamiento se sustituyeron por asserts de texto de fuente cuando era comodo verificar la 'presencia' de un cableado. Un refactor rompe el test sin cambio de comportamiento, y el test nunca comprueba que el software haga lo que dice: en el caso de ipc.settings.saveModelConfig, el contrato 'un 401 no persiste nada' se cumplia pero nunca se comprobaba.
- **Mitigación Preventiva:** Escribe asserts de comportamiento (DOM, eventos, estado capturado) o, si el test es realmente de contrato, separalo en una suite etiquetada como lint-test. Cuando un test falle por codigo obsoleto, comprueba PRIMERO si el comportamiento se perdio de verdad y no rebajes el assert a pelo. La ola 1c convirtio los 3 tautologicos en checks reales (handlers capturados e invocados).


### Lección 2026-10-20: A3 y A4 investigaron dos supuestos 'flaky' bajo ca
- **Incidente:** A3 y A4 investigaron dos supuestos 'flaky' bajo carga en la ola de remediacion. A3: el worker de caos reescribia el lock de forma no atomica y la lectura caia a mitad (JSON truncado), y el motor reportaba wasDirty:false ante un lock corrupto, perdiendo en silencio la senal caracteristica del hard kill. A4: el import del modulo main estaba DENTRO de un it, asi que la carga de 17 paquetes mas el binding nativo se cobraba del presupuesto de 5 s del test (1543 ms aislado, 2561 ms en paralelo).
- **Causa Raíz:** Se confunde una carrera con un defecto de diseno. Si el tiempo crece con la carga, el setup esta en el scope equivocado; si el estado compartido se corrompe, el test estaba enmascarando un bug real. En el caso de A3, el motor de recovery tenia un hueco: un lock existente pero ilegible caia al catch, previousRecord quedaba null y se informaba 'arranque limpio' sin purgar el lock huerfano.
- **Mitigación Preventiva:** Antes de marcar un test como flaky, mide la causa raiz: reproduce la fallo en paralelo, separa setup de asercion, y comprueba si el estado compartido puede corromperse. Arregla la causa en produccion si es de produccion; reescribe la espera para que sea determinista (handshake/evento) si es del test. Verificacion: 0/15 secuencial y 0/6 en paralelo tras el fix (antes 2-3 de 12).


### Lección 2026-10-20: AGENTS.md §4 prohibe los workarounds silenciosos y
- **Incidente:** AGENTS.md §4 prohibe los workarounds silenciosos y exige registrar cada friccion con VantaDB en docs/VANTADB-FEEDBACK-Y-MEJORAS.md. La ola de remediacion encontro 16 referencias en codigo que apuntaban a VDB-REQ-08 ('cifrado en reposo') significando en realidad 'embeddings/canal denso', a VDB-REQ-09 ('publicar el binding') significando 'el binding no expone IQL', y a VDB-REQ-10, que no existia en el registro.
- **Causa Raíz:** El guardrail era solo de palabra: nada verificaba que los IDs citados en el codigo existieran en el registro ni que significaran lo mismo. Los IDs se reutilizaron por就近 (nearest) en vez de buscarse, y al no haber un gate, la deriva no se detecto hasta una auditoria manual.
- **Mitigación Preventiva:** Un identificador compartido entre codigo y registro documental es un contrato: verifica el significado con grep ANTES de usarlo, y sobre todo convierte el guardrail en un gate mecanico. La ola creo scripts/verify-vantadb-ids.mjs (detecta ID no registrado, Workaround silencioso, registro inconsistente indice-detalle, y el mismo ID con descripciones incompatibles) y lo dejo BLOQUEANTE en CI cuando el registro quedo limpio.


### Lección 2026-10-20: Un comando con un > malinterpretado dejo en la rai
- **Incidente:** Un comando con un > malinterpretado dejo en la raiz del repo un fichero de 0 bytes llamado literalmente {if(x.includes(p))console.log((i+1)+'. No estaba en .gitignore, asi que habria entrado en el commit de la ola.
- **Causa Raíz:** Un fragmento de JavaScript se interpreto como ruta de salida de shell en lugar de como contenido. Sin ningun gate de integridad de rutas, el artefacto era invisible hasta que se reviso el arbol de ficheros.
- **Mitigación Preventiva:** Se creo scripts/verify-paths.mjs: falla si una ruta tiene un caracter que Windows no admite en un nombre, si empieza por { o } (el patron del artefacto de redireccionamiento) o si es un fichero de 0 bytes. Se cableo en el hook pre-commit (--staged) y como paso bloqueante en CI, y se probó en rojo y verde reintroduciendo el bug.
