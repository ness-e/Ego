# Solución de problemas

> Si un síntoma no está aquí o la solución no funciona, anota qué
> esperabas, qué hiciste y el mensaje exacto del error antes de pedir
> ayuda: con eso el diagnóstico es mucho más rápido.

## Ego responde sin usar mi modelo (respuestas genéricas o de prueba)

**Causa probable:** ningún proveedor real configurado; Ego opera en
modo `mock`.
**Qué hacer:** abre Configuración (⚙️) → pestaña Modelos, pega la key
del proveedor, selecciónalo como **proveedor activo** y guarda. Si
prefieres local, activa `ollama` con Ollama corriendo en tu máquina.
Ver [Configuración](./configuration.md).

## Guardé la key pero sigue sin funcionar

**Causas probables:** key inválida del proveedor, proveedor activo
distinto del que tiene key, u Ollama apagado / en otra URL.
**Qué hacer:**

1. Reabre Configuración y confirma que el proveedor activo es el que
   tiene la key (los campos muestran máscaras, nunca el secreto: eso
   es normal).
2. Verifica la key en el panel del proveedor (OpenAI / Anthropic /
   Google / DeepSeek).
3. Con Ollama, confirma que responde en la URL configurada
   (`http://localhost:11434` por defecto).
4. Si usas `base URL` personalizada, revisa que no tenga errores de
   escritura ni barra final duplicada.

## No recibo avisos de actualización

**Causa probable:** sin `EGO_UPDATE_FEED_URL` configurada, el
comprobador queda inactivo por diseño (no genera error).
**Qué hacer:** define esa variable de entorno con la URL del feed JSON
de releases. Recuerda que, por ahora, el aviso no instala nada: al
recibirlo, descarga el instalador de tu sistema y reinstala. Detalle
en [Configuración](./configuration.md).

## Una acción quedó retenida y no avanza

**Causa probable:** es una aprobación pendiente: Ego la congeló hasta
tu decisión.
**Qué hacer:** busca la tarjeta de aprobación en el chat (o el
indicador de actividad expandido) y pulsa **Aprobar** / **Rechazar**.
Si la tarjeta no aparece, revisa el indicador de actividad del marco
superior: las aprobaciones también se resuelven desde ahí con
`Enter` / `Esc`.

## El Canvas no muestra lo que espero

**Causas probables:** la tarea no genera artefactos visuales (el chat
basta), o estás mirando otro proyecto.
**Qué hacer:**

1. Confirma el proyecto activo en la barra lateral (insignia
   "Activo"): los artefactos pertenecen a su proyecto.
2. Pide en el chat lo que quieres ver ("muestra el informe en el
   Canvas").
3. Si el Canvas quedó en un estado extraño tras un cierre, reabre el
   proyecto; los artefactos se restauran desde la memoria local.

## Tras cerrar y reabrir, falta contexto

**Causas probables:** sesión o proyecto distinto del que usabas.
**Qué hacer:**

1. Verifica el proyecto activo y el historial de sesiones en la barra
   lateral.
2. Usa la búsqueda (`Ctrl+K`) para localizar la conversación o el
   dato: la memoria es por proyecto.
3. Si el cierre fue forzado (corte de luz, `SIGKILL`), Ego recupera la
   sesión y los hechos al reabrir; si algo se corrompió, restaura tu
   respaldo `.vdbdump` más reciente.

## La barra lateral desapareció o algo no responde visualmente

**Qué hacer:** pulsa `Ctrl+B` para mostrar la barra lateral. Si un
panel quedó en un estado inconsistente, cambia de proyecto y vuelve:
la vista se reconstruye desde la memoria. Como último recurso, cierra
y reabre la aplicación: el estado persistente se conserva.

## Problemas al instalar o arrancar (desarrolladores)

Si trabajas desde el código fuente:

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

- `pnpm build` compila el proceso principal y el renderer y verifica
  el paquete; si falla, el mensaje indica el paquete afectado.
- `pnpm test` ejecuta las suites; un fallo tras tu cambio indica
  regresión en ese área.
- No edites manualmente nada dentro de `dist/`: se reconstruye con
  cada compilación.
