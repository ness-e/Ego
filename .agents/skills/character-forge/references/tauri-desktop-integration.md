# Integración de Mascotas de Escritorio con Tauri 2: Ventanas Transparentes, Eventos y Multiplataforma

Este módulo detalla los patrones de integración nativa para ejecutar compañeros de escritorio 2.5D sobre **Tauri 2** (Rust + WebView), gestionando ventanas transparentes, click-through dinámico y particularidades de sistemas operativos.

---

## 1. Configuración de Ventana Flotante Transparente (`tauri.conf.json`)

Para que el compañero flote sobre el escritorio sin marco, fondo blanco ni barra de título:

```json
{
  "app": {
    "windows": [
      {
        "title": "Mochi Companion",
        "width": 180,
        "height": 180,
        "transparent": true,
        "decorations": false,
        "alwaysOnTop": true,
        "shadow": false,
        "resizable": false,
        "skipTaskbar": true
      }
    ]
  }
}
```

---

## 2. Click-Through Dinámico y Passthrough de Cursor

Para que el usuario pueda hacer clic en los iconos o ventanas situados detrás de la mascota cuando el cursor no toca su cuerpo:

1. **Rust Backend (`src-tauri`)**:
   - Monitorea el cursor o recibe las coordenadas de colisión circular del cuerpo (`DesktopMochiLogic.isOverBody`).
   - Activa/desactiva `window.set_ignore_cursor_events(true/false)` de forma instantánea.

```rust
#[tauri::command]
fn set_click_through(window: tauri::WebviewWindow, ignore: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())
}
```

---

## 3. Matriz de Diferencias por Sistema Operativo

| Capacidad | macOS (AppKit) | Windows 10/11 (Win32 / DWM) | Linux (X11 vs Wayland) |
|---|---|---|---|
| **Transparencia** | Nativa (`NSWindow.isOpaque = false`). | Soportada con canal alfa directo. | X11 nativo (con compositor); Wayland requiere soporte de capa. |
| **Cursor Global** | `NSEvent.mouseLocation` continuo. | `GetCursorPos` en Windows API. | **Limitación Wayland**: Los protocolos de seguridad prohíben consultar el cursor fuera de la ventana. Requiere fallback a cursor interno. |
| **Click-Through** | `ignoresMouseEvents = true`. | `WS_EX_TRANSPARENT` vía SetWindowLongPtr. | Soportado en X11 mediante shape extension. |
| **Escalado DPI** | Puntos lógicos = 2x en Retina. | Escalado porcentual (125%, 150%, 200%). | Escalado fraccionario variable. |
