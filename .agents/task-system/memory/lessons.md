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


### Lección 2026-10-21: El test avatar-studio-roundtrip.test.ts fallaba co
- **Incidente:** El test avatar-studio-roundtrip.test.ts fallaba con 2 errores: el round-trip por el puente del studio perdia 4 estados (thinking, approval, question, ratelimit). El codigo ya estaba bien (A6 lo habia pagado anadiendo estado propio en el studio), pero el test carries una constante KNOWN_LOSSY = [approval, question, ratelimit, thinking] y asserta que el conjunto de perdidas sea EXACTAMENTE esa lista. Pagada la deuda, el conjunto es [] y el test falla.
- **Causa Raíz:** El test se escribio para HACER VISIBLE una perdida, y ese fue su acierto: convertia una degradacion silenciosa en un rojo. El problema no era el test sino que su linea base congelaba un estado del mundo que ya habia cambiado. Y era matematicamente imposible que pasara sin tocarlo: ninguna implementacion satisface a la vez 'el round-trip es 1:1' y 'lossy contiene esos 4 estados'.
- **Mitigación Preventiva:** Cuando un test codifica una deuda, verifica primero si la deuda esta pagada antes de 'arreglar' el codigo. Si esta pagada, actualiza la linea base PERO anade los guards que la sustituyen: en vez de una lista de perdidas, enumeraciones completas (estos son exactamente los 15 estados de Ego, estos son exactamente los 11 canvas-native) mas un guard que consulta la puerta del puente. Asi el test deja de ser 'una foto de hoy' y pasa a ser la especificacion ejecutable del contrato: si manana alguien anade un estado sin inverso, la enumeracion se rompe aunque la lista de perdidas siga vacia. Y un punto de metodo: demuestra el RED parcheando la constante y restaurando, no reescribiendo el test a mano.


### Lección 2026-10-21: El puente Ego <-> studio prometia por escrito (ada
- **Incidente:** El puente Ego <-> studio prometia por escrito (adapter.js:19) '1:1 en las dos direcciones... para que el avatar nunca pueda mostrar un estado distinto del que el chat pidio'. Cuatro estados no cumplian esa promesa, y el modo de fallo era silencioso: un mapa que nombra un estado inexistente cae al default y pierde el estado sin error.
- **Causa Raíz:** El contrato estaba escrito en un comentario y verificado a mano. Los tres mapas que nombran estados del studio (estados, emotes, sonidos) podian desincronizarse por vias distintas, y solo uno de los tres estaba cubierto por un test.
- **Mitigación Preventiva:** Convierte cada contrato de ida y vuelta en una puerta ejecutable que recorra TODOS los mapas a la vez (scripts/check-bridge.mjs con bridge:check: 'Ego(15) <-> studio(26): round-trip 1:1 = 15/15 | colisiones = 0 | estados de studio sin dueno Ego = 11'). La distinction clave es entre perdida y re-mapeo intencionado: los estados canvas-native no tienen inverso exacto POR DISENO, y el gate debe reportarlos aparte, no contarlos como perdida. Y anade un test que CONSULTA la puerta en vez de duplicar su logica, para que la logica tenga una sola fuente.


### Lección 2026-10-21: La Ola 2 termino en un unico commit (0ac5918) con 
- **Incidente:** La Ola 2 termino en un unico commit (0ac5918) con 142 ficheros, +15.096 inserciones y 15 areas distintas (avatar, runtime, events, desktop, tests, docs, tooling), etiquetado 'refactor(desktop): split main process into state and window modules'. AGENTS.md §5 exige commits atomicos, un cambio logico por commit.
- **Causa Raíz:** Un proceso paralelo commiteo el arbol completo mientras los agentes terminaban su trabajo, y nadie reviso la granularidad. Con 8 agentes en 4 oleadas, el merge finalurry de sus ficheros termino en un commit sin demarcacion.
- **Mitigación Preventiva:** Verifica el estado de publicacion ANTES de reescribir historia: origin/master estaba en 330abdb (anterior a la Ola 1), asi que el reset --soft no reescribia historia publicada y era seguro. El metodo: reset --soft al commit previo, reset mixed para vaciar el indice, y un commit por grupo con su mensaje; se verifica con 'git diff <commit-original> HEAD' para probar que el CONTENIDO es identico (0 diferencias) y que solo cambia la particion. Si hubiera estado publicado, la redivision habria sido un force-push prohibido por AGENTS.md y la alternativa habria sido un commit explicativo en vez de reescritura.


### Lección 2026-10-21: pnpm test fallaba de forma intermitente (1 de 19 p
- **Incidente:** pnpm test fallaba de forma intermitente (1 de 19 paquetes) con tests que PASABAN AISLADOS (8/8, 6/6, 5/5). El diagnostico inicial fue 'flaky'. La causa real: 17 procesos de test ajenos vivos durante la corrida (otros agentes trabajando en paralelo) mas un disco al 3.9% libre, saturando la CPU. Con el arbol en reposo, la suite completa dio exit 0.
- **Causa Raíz:** Dos fuentes de ruido confundidas con un defecto: contencion de recursos y concurrencia entre agentes. 'Flaky' es un etiqueta, no un diagnostico. Y con el disco casi lleno, cualquier operacion quecrea ficheros grandes (los tests de VantaDB dejan 320 MB por corrida) puede fallar por falta de espacio en vez de por logica.
- **Mitigación Preventiva:** Antes de marcar un test como flaky, mide: (a) ejecuta el fichero AISLADO y en paralelo, (b) cuenta los procesos de test vivos de otros agentes, (c) comprueba el espacio en disco antes y despues de la corrida. Y aplica la leccion de A3: un 'flaky' en un repo de escritorio suele ser un bug de produccion enmascarado (el motor de recovery reportaba wasDirty:false ante un lock corrupto). En la ronda final, con el arbol en reposo, la suite completa dio exit 0 y el fallo desaparecio solo.


### Lección 2026-10-21: El disco C: bajo a 5.4 GB libres de 475.8 (2.5%). 
- **Incidente:** El disco C: bajo a 5.4 GB libres de 475.8 (2.5%). %TEMP% tenia 304 directorios huerfanos de tests por 6.7 GB, incluidos 15+ directorios de 320 MB cada uno. Se liberaron 9.2 GB, pero cada corrida de la suite vuelve a generar el problema: los tests de apps/desktop (ego-desktop-ipc-test-*, ego-sessions-resume-*) y los de recovery dejan un store de VantaDB de 320 MB que no limpian si el proceso muere.
- **Causa Raíz:** El teardown de esos tests usa rmSync en un afterEach/finally, asi que un proceso MATADO (por el reinicio del servidor o por un timeout) deja el store entero. Con 19 paquetes en paralelo y varias rondas, el acumulado supera el espacio disponible.
- **Mitigación Preventiva:** Los tests deben dejar su store en un directorio que se limpie al salir, y el teardown debe ser idempotente y resistant a la muerte del proceso (por ejemplo, un directorio raiz por corrida con un nombre unico y una limpieza por antiguedad al inicio de la siguiente). Mientras tanto: limpiar %TEMP% de los patrones ego-*/vitest-*/tmp* con antiguedad > 1 h, y tratar 'disco casi lleno' como un sintoma que hay que corregir en el suite, no como una limitacion del entorno.


### Lección 2026-10-21: A5 cerro 33 filas de compuerta y, al verificar una
- **Incidente:** A5 cerro 33 filas de compuerta y, al verificar una por una con la distincion entre import real y cadena en un comentario, encontro que el patron que las hacia parecer 'asimiladas sin cablear' seguian sin cablear de verdad. Mas grave: 3 filas estaban marcadas 'Completada' con un caller que NO era un caller: DSEK-04 (ProjectImport.ts:16 es un 'import type' y la dependencia es opcional, asi que 'if (this.schemaMigrator)' nunca es true), OCLW-16/17 y COUC-07/COUC-10. A1 encontro un cuarto caso equivalente: 7 filas del catalogo apuntaban a rutas del CLON de referencia (apps/desktop/electron/window-state.ts, NotchBuddy/Sources/App/...) que no existen en Ego.
- **Causa Raíz:** Los greps de 'quien usa este simbolo' cuentan una cadena en un comentario, un 'import type' y un import dentro de un fichero de test. Un patron puede estar asimilado en el codigo y aun asi no tener ninguna ruta de ejecucion que lo alcance, y el backlog lo daba por integrado porque la referencia existia en algun sitio.
- **Mitigación Preventiva:** Para distinguir caller de produccion: (a) el import debe ser REAL, no 'import type' ni un import de un modulo que solo se usa bajo una dependencia opcional; (b) debe estar en packages/ o apps/, no en un test; (c) la ruta citada DEBE existir en el repo (la de un clon de referencia no cuenta). Y automatizarlo: el gate audit-extraction-gates.mjs ahora comprueba que cada fila 'Completada' cite un caller real de produccion, con tres casos de test (inexistente -> 1, real -> 0, solo comentario -> 1). En el repo real, 53 de 53 filas con caller verificable. La regla general: un hallazgo de extraccion no se da por cerrado porque la referencia exista, sino porque exista la RUTA DE EJECUCION.


### Lección 2026-10-21: A7 ejecuto un script propio de limpieza de markdow
- **Incidente:** A7 ejecuto un script propio de limpieza de markdown sobre ficheros de OTROS agentes (2 handoffs). El script no estaba dirigido por markdownlint, asi que reescribio acentos a ANSI, destruyo identificadores ('create' -> 'rreate', 'const' -> 'oonst') y dejo 7 ficheros con mojibake. A7 los reconstruyo desde el storage de sesiones (el write original + los edit de los autores) y lo verifico contra el recuento de violaciones original. En la misma ola, A3 lo Ahead le pasaria con un '-replace' de PowerShell sin -Encoding utf8, que le corrompio 7 ficheros de su zona.
- **Causa Raíz:** Dos trampas de la misma familia: (a) un script que 'limpia' markdown sin estar dirigido por el linter no sabe que reglas existen, asi que sus reglas propias son arbitrarias; (b) en Windows, PowerShell 5.1 con Get-Content/Set-Content sin -Encoding utf8 recodifica a ANSI. A3 lo restauro byte-exacto con 'git show > fichero' y reaplico los cambios con las herramientas edit/write (byte-safe).
- **Mitigación Preventiva:** Todo fixer de markdown va DIRIGIDO POR EL LINTER (que regla, que linea) y se prueba sobre COPIA con una puerta de '0 lineas perdidas' antes de tocar el original. Para ediciones masivas en Windows: usar Node con读写 UTF-8 explicito (o las herramientas edit/write), nunca -replace de PowerShell con grupos $1/$3, y verificar con un escaneo de mojibake y CJK accidental sobre los ficheros tocados. A3 dejo ademas el escaneo en su handoff: 0 ficheros con mojibake en 46 revisados.
