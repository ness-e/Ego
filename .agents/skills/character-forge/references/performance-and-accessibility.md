# Performance Budgets, Optimization & Sensory Accessibility

Este documento define los límites cuantitativos de rendimiento, estrategias de renderizado adaptativo y estándares de accesibilidad para personajes digitales.

---

## 1. Tabla Canónica de Presupuestos de Rendimiento

Antes de desplegar cualquier personaje en un entorno de producción, debe satisfacer estos umbrales medidos en herramientas de profiling:

| Métrica de Rendimiento | Límite Máximo Permitido | Método de Medición |
|---|---|---|
| **Draw Calls por Personaje** | $\le 10$ draw calls | Spector.js / Three.js `renderer.info.render.calls` |
| **Recuento Total de Vértices** | $\le 4,500$ triángulos | Three.js `renderer.info.render.triangles` |
| **Tiempo de Frame en CPU** | $< 2.0\text{ ms}$ por tick | Chrome DevTools Performance Profiler |
| **Tiempo de Frame en GPU** | $< 5.5\text{ ms}$ en hardware móvil | GPU Timer Queries / Profiler |
| **Asignaciones de Memoria (GC)** | $0\text{ KB/frame}$ en rAF | Chrome DevTools Allocation Instrumentation |
| **Tamaño de Bundle (Gzip)** | $< 35\text{ KB}$ (Componente + Geometría) | Rollup Visualizer / Bundlephobia |

---

## 2. Suspensión Automática del Renderizado (Ahorro Energético)

Un personaje inactivo no debe consumir batería del dispositivo. Se debe suspender el renderizado en dos escenarios críticos:

```typescript
export function attachLifecycleOptimizations(
  renderer: THREE.WebGLRenderer,
  containerElement: HTMLElement,
  renderLoopCallback: () => void
): () => void {
  let isVisibleInViewport = true;
  let isTabActive = true;

  // 1. IntersectionObserver: Pausar si el usuario scrollea más allá del componente
  const observer = new IntersectionObserver(([entry]) => {
    isVisibleInViewport = entry.isIntersecting;
  }, { threshold: 0.05 });
  observer.observe(containerElement);

  // 2. Page Visibility API: Pausar si el usuario cambia de pestaña en el navegador
  const handleVisibility = () => {
    isTabActive = !document.hidden;
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    observer.disconnect();
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
```

---

## 3. Accesibilidad Sensorial Estricta (WCAG 2.2 AA)

### 3.1. Soporte Mandatorio para `prefers-reduced-motion`
Las oscilaciones continuas pueden provocar náuseas o mareos en usuarios con trastornos vestibulares. Cuando el sistema operativo tiene activada la reducción de movimiento:

```typescript
export function applyReducedMotionFallbacks(
  isReducedMotion: boolean,
  characterRoot: THREE.Object3D,
  headPivot: THREE.Object3D
): void {
  if (isReducedMotion) {
    // Congelar bucles de respiración, rebotes y seguimiento continuo
    characterRoot.position.set(0, 0, 0);
    characterRoot.scale.set(1, 1, 1);
    headPivot.quaternion.identity();
  }
}
```

### 3.2. Semántica ARIA y Navegación
- **Rol Decorativo**: Si el personaje no comunica estado crítico del sistema, debe marcarse con `aria-hidden="true"`.
- **Rol Informativo**: Si refleja un estado (ej. "Descargando actualización 45%"), debe envolverse en un contenedor con `role="status"` y descripción legible en texto para lectores de pantalla.
