# Verificación Visual, Pruebas de Comportamiento y Regresión

Este módulo define el protocolo de pruebas automatizadas y validación visual para certificar que un personaje digital o compañero desktop cumple los estándares de calidad antes de su entrega.

---

## 1. La Batería de Pruebas de 4 Niveles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PRUEBAS MATEMÁTICAS & GEOMÉTRICAS (Unit Tests en CPU)                    │
│    - Verificación de valores finitos (sin NaN, sin divisiones por cero).    │
│    - Continuidad en polos superelipsoidales (|y| -> 1.0).                   │
│    - Normales unitarias (||N|| = 1.0 +- 1e-6) y ortogonalidad en rotación.  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. PRUEBAS DE MÁQUINA DE ESTADOS Y ÁRBITRO DE PRIORIDADES (State Tests)     │
│    - Prioridad de alertas HITL sobre estados de sueño o animaciones idle.   │
│    - Transiciones espaciales válidas (hidden -> docked -> onDesktop).       │
│    - Recuperación asintótica tras interrupción brusca de acción.            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. PRUEBAS DE INTEGRACIÓN DE EVENTOS DEL SO (Integration Tests)             │
│    - Drag-enter -> Drag-drop válido con payload de archivos.                │
│    - Drag-leave / cancelación sin efectos colaterales en la pose.          │
│    - Clamping geométrico dentro del marco visible del monitor.              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. BANCO DE PRUEBAS VISUALES & CAPTURAS (Visual Regression Bank)            │
│    - Giros estándar de cabeza: Frontal (0,0), Izquierda (-0.5, 0),         │
│      Derecha (0.5, 0), Arriba (0, 0.4), Abajo (0, -0.4), Tilt (0.3, -0.2). │
│    - Verificación de oclusión de accesorios por delante y detrás.           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Escenarios Críticos de Comportamiento (Edge Cases Obligatorios)

Toda implementación debe demostrar resolución exitosa en los siguientes 6 escenarios:

1. **Alerta en Sueño**: El personaje duerme (`sleeping`) y entra un evento `approval_required`. Debe despertar instantáneamente, reproducir sonido de atención y presentar el badge `bang` sin esperar a que transcurra el tiempo de animación de respiración.
2. **Arrastre Cancelado**: El usuario inicia drag de un archivo sobre el cuerpo (boca abierta) y cancela la acción sacando el cursor de la ventana. El personaje debe cerrar la boca y volver a reposo sin tragar aire ni emitir partículas de éxito.
3. **Pérdida de Foco / Desconexión**: El backend deja de responder durante el estado `thinking`. Tras $30\text{ s}$, el árbitro transiciona automáticamente a estado de advertencia y reposo.
4. **Oscilación de Cursor en Umbral de Distancia**: El ratón oscila entre $148\text{ px}$ y $152\text{ px}$. La histéresis evita transiciones repetitivas entre despierto y dormido.
5. **Redimensión / Cambio de Monitor**: La ventana se mueve a un monitor con menor resolución; la mascota se reajusta dentro del marco visible sin quedar fuera de pantalla.
6. **Movimiento Reducido Activado**: Todo desplazamiento balístico se transforma en un fundido de opacidad estático.

---

## 3. Estructura Canónica del Informe de Verificación

Al certificar un nuevo personaje o motor, se debe emitir un informe con la siguiente taxonomía epistemológica:

```markdown
### INFORME DE VERIFICACIÓN TÉCNICA
- **Qué se ejecutó**: [Suite de pruebas y entorno probado]
- **Pruebas Superadas**: [Lista de aserciones válidas]
- **Pruebas Fallidas / No Disponibles**: [Aserciones pendientes o no soportadas]
- **Hechos Verificados**: [Comportamientos constatados en código y ejecución real]
- **Inferencias Arquitectónicas**: [Decisiones de diseño deducidas de la referencia]
- **Limitaciones Persistentes**: [Restricciones de plataforma conocidas]
```
