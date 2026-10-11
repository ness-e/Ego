# Háptica del Sistema Operativo: Drag-and-Drop, Ingestión de Archivos y Seguridad

Este módulo define la interacción háptica entre el personaje de escritorio y los eventos del sistema operativo (OS), abordando el arrastre de archivos, la anticipación visual, la secuencia funcional de absorción y los guardrails estrictos de seguridad.

---

## 1. Tipología y Separación Estricta de Eventos de Arrastre

En el sistema operativo existen múltiples categorías de arrastre que no deben confundirse bajo un único manejador genérico:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TAXONOMÍA DE EVENTOS DE ARRASTRE                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ A. File Drag-and-Drop: Archivos del explorador del SO sobre la ventana.     │
│ B. Text / URL Drag: Fragmentos de texto o enlaces seleccionados.            │
│ C. Window Reposition Drag: El usuario hace clic y arrastra la mascota.      │
│ D. Inter-App Drag: Transferencia OLE/Cocoa entre ventanas concurrentes.     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pipeline de Anticipación e Ingestión Visual

El personaje comunica activamente la intención de recibir el archivo en tres fases:

```
[Usuario inicia arrastre sobre el área]
                 │
                 ▼
     ┌───────────────────────┐
     │ 1. ANTICIPACIÓN       │ ──> Mira hacia el cursor de entrada.
     │    (Drag Enter/Over)  │ ──> Apertura de boca o elipse receptora.
     │                       │ ──> Elongación vertical (Sy = 1.15, Sx = 0.90).
     │                       │ ──> Halo pulsante con gradiente cónico.
     └───────────┬───────────┘
                 │
        ┌────────┴────────┐
        │                 │
   [Suelta válida]   [Cancelación / Salida]
        │                 │
        ▼                 ▼
 ┌─────────────┐   ┌─────────────┐
 │ 2. ABSORCIÓN│   │ CANCELACIÓN │ ──> Retorno suave a pose base
 └──────┬──────┘   └─────────────┘     sin sobresalto.
        │
        ▼
 ┌─────────────┐
 │ 3. FEEDBACK │ ──> Validación de payload y seguridad.
 │    FUNCIONAL│ ──> Éxito: Partículas + Squash (Sy = 0.75) + Trino armónico.
 └─────────────┘ ──> Error: Rebote negativo + zumbido.
```

---

## 3. Integración con Eventos de Tauri 2

En aplicaciones de escritorio construidas con Tauri 2, el backend de Rust intercepta los eventos nativos del sistema y los transmite al frontend:

```typescript
import { listen } from "@tauri-apps/api/event";

export interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

export function registerTauriDropListeners(
  onDragEnter: (pos: { x: number; y: number }) => void,
  onDrop: (paths: string[]) => void,
  onDragLeave: () => void
) {
  // 1. Archivo ingresa a la ventana
  const unlistenEnter = listen<DragDropPayload>("tauri://drag-enter", (e) => {
    onDragEnter(e.payload.position);
  });

  // 2. Archivo es soltado
  const unlistenDrop = listen<DragDropPayload>("tauri://drag-drop", (e) => {
    if (e.payload.paths && e.payload.paths.length > 0) {
      onDrop(e.payload.paths);
    } else {
      onDragLeave();
    }
  });

  // 3. Arrastre cancelado o cursor abandona el área
  const unlistenLeave = listen("tauri://drag-leave", () => {
    onDragLeave();
  });

  return async () => {
    (await unlistenEnter)();
    (await unlistenDrop)();
    (await unlistenLeave)();
  };
}
```

---

## 4. Guardrails Innegociables de Seguridad en Ingestión

> [!CAUTION]
> **Prohibición de Ejecución Automática**: El acto de recibir o soltar un archivo en la mascota **NUNCA** debe provocar su ejecución automática (ej. ejecutar `.exe`, `.bat`, `.sh` o evaluar código sin confirmación explícita).

1. **Validación de Rutas y Sanitización**:
   - Comprobar que los archivos existen y están dentro de rutas de lectura permitidas.
   - Rechazar rutas relativas malformadas o intentos de escape (`../`).
2. **Límites de Carga y Tamaño**:
   - Establecer un límite máximo por archivo (ej. $100\text{ MB}$ para documentos estándar).
3. **Privacidad de Registros (No-Leak Logging)**:
   - Registrar únicamente el nombre base del archivo y su extensión en los logs de depuración. Queda prohibido imprimir rutas completas con nombres de usuario o datos sensibles del sistema de archivos.
