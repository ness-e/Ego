---
diataxis: how-to
---

# Configuración de modelos (BYOK)

Ego usa tu propio modelo: o aportas tu API key (**BYOK**, *bring your
own key*) o usas un runtime local (Ollama). Ego no incluye credenciales
propias ni te factura inferencia.

## Dónde se configura

1. Pulsa el engranaje (⚙️) de la barra lateral para abrir
   **Configuración**.
2. Abre la pestaña **Modelos**.
3. Elige el **proveedor activo**, pega la key correspondiente y guarda.

La configuración se carga cada vez que se abre el panel y se guarda en
la memoria local (`gov/settings` en VantaDB).

## Proveedores disponibles

| Proveedor | Qué necesitas | Notas |
|---|---|---|
| `openai` | API key de OpenAI | Admite `base URL` personalizada para endpoints compatibles con la API de OpenAI |
| `anthropic` | API key de Anthropic | — |
| `google` | API key de Google | — |
| `deepseek` | API key de DeepSeek | Admite `base URL` personalizada |
| `ollama` | Ollama en tu máquina | Por defecto `http://localhost:11434`; no requiere key |
| `mock` | Nada | Respuestas deterministas para pruebas; es el valor inicial por defecto |

Puedes guardar keys de varios proveedores a la vez; la que se usa es la
del **proveedor activo**. También puedes fijar un nombre de modelo
específico (`modelName`) si el proveedor lo requiere.

## Esfuerzo de razonamiento y temperatura (STAB-06)

Dos ajustes opcionales controlan cómo "piensa" el modelo en cada turno:

| Campo | Valores | Efecto |
|---|---|---|
| `reasoningEffort` | `low` \| `medium` \| `high` | Profundidad de razonamiento (parámetro portable `reasoning` de AI SDK; los proveedores sin soporte lo ignoran). Si también hay `effortLevel` configurado, este gana. |
| `temperature` | `0` – `2` | Aleatoriedad del muestreo (`0` = determinista). Las llamadas con temperatura explícita ganan sobre este valor global. |

Precedencia efectiva por turno: **explícito per-call > `PreferredModel` >
`effortLevel`/`reasoningEffort` global > default del proveedor (`0.7`)**.
Ambos campos se guardan en claro junto al resto no-secreto de
`gov/settings/model_config` (nunca cifrados: no son secretos) y se
muestran sin máscara en el panel.

## Cómo se protegen tus keys

- Las keys se cifran en el proceso principal con el mecanismo seguro
  del sistema operativo (Keychain en macOS, DPAPI en Windows,
  Secret Service en Linux) antes de persistirse. Nunca se guardan en
  claro de forma permanente: si existía un valor antiguo en claro, se
  migra automáticamente a formato cifrado al leerlo.
- El panel de Configuración **nunca muestra un secreto en claro**: lo
  que ves es una máscara (por ejemplo `sk-t...7890`). Al guardar, los
  campos que siguen enmascarados conservan el secreto guardado; solo
  un valor nuevo real lo reemplaza. Un campo vacío no borra nada salvo
  el campo legado explícito con cadena vacía.
- Las keys descifradas viven solo en la memoria del proceso principal
  y jamás salen de él: no se registran en logs ni se envían al
  renderer. Si la configuración enviada no pasa la validación, se
  rechaza con un error en lugar de aplicarse a medias.
- Variables de entorno (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, además de `OPENAI_BASE_URL` y
  `OLLAMA_BASE_URL`) sirven como arranque inicial; lo que guardes en
  la interfaz tiene precedencia sobre ellas.

## Conectar un cliente MCP externo (el token del servidor MCP)

Ego puede actuar **como servidor MCP** para que otros programas (un IDE, un
agente, una herramienta) lo consulten. Ese servidor escucha **solo en
`127.0.0.1`** y **exige un token**.

### Cómo se obtiene el token

El token se guarda en el **almacén seguro del sistema** (Keychain en macOS,
DPAPI en Windows, Secret Service en Linux), nunca en un fichero en claro, y
**no** se muestra en la interfaz. Para obtenerlo hay un **comando local**:

```bash
ego mcp token                  # imprime el token por stdout
ego mcp token --out <fichero>  # lo escribe en un fichero 0600 (recomendado)
ego mcp token --json           # { "token": "...", "url": "..." }
```

**Usa `--out <fichero>`** si el token lo consume otro proceso. Un token
impreso por stdout puede acabar en el **scrollback** del terminal, en una
grabadora de terminal o en el log del proceso que lo invoca; el fichero con
modo `0600` solo lo lee tu usuario y puedes borrarlo en el acto. El comando
sin `--out` es para uso manual.

El token **nunca pasa por la ventana de la aplicación**: el comando corre en
el proceso principal, sin interfaz. Por eso un cliente MCP externo puede
autenticarse sin exponer la clave a la UI.

### Configurar el cliente

Con el token a mano, apunta tu cliente MCP al servidor local de Ego y
envíale el token en la cabecera `Authorization: Bearer <token>`. Un token
incorrecto se rechaza con **401**. La URL exacta y el modo de arranque del
servidor están en el log de arranque de la app.

### Si algo falla

| Síntoma | Causa probable |
|---|---|
| El comando no imprime nada | La app no está arrancada: el token se pide al proceso principal en ejecución |
| El cliente recibe **401** | Token caducado o de otra instancia: vuelve a ejecutar `ego mcp token` |
| El cliente no conecta | El servidor MCP no está habilitado o el puerto cambió al reiniciar |

## Variables de entorno (arranque inicial)

| Variable | Efecto |
|---|---|
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` | Key inicial de OpenAI / DeepSeek |
| `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` | Key inicial de Anthropic / Google |
| `OPENAI_BASE_URL` | Base URL inicial (OpenAI o compatible) |
| `OLLAMA_BASE_URL` | Base URL inicial de Ollama |
| `EGO_UPDATE_FEED_URL` | Feed JSON de actualizaciones (ver abajo) |

## Actualizaciones de la aplicación

Ego comprueba si hay una versión nueva contra el feed configurado en
`EGO_UPDATE_FEED_URL` (objeto JSON con al menos `version`, más `url` y
`notes` opcionales). El primer chequeo ocurre unos 30 segundos después
del arranque y luego cada 6 horas, solo en la aplicación empaquetada
(en desarrollo jamás toca red). Si hay versión más nueva, recibes un
aviso discreto. Sin feed configurado, el comprobador queda inactivo en
silencio.

La descarga e instalación automáticas aún no están habilitadas: cuando
recibas el aviso, descarga el instalador correspondiente a tu sistema
(NSIS en Windows, DMG en macOS, AppImage en Linux) y reinstala.
