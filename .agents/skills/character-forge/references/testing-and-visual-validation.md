# Testing, Visual Validation & Quality Benchmarks

Este documento establece los procedimientos verificables, bancos de pruebas y rúbricas cuantitativas para evaluar objetivamente la calidad técnica y visual de los personajes implementados.

---

## 1. El Ciclo de Renderizado, Inspección y Corrección (Render-Critique-Fix)

Ningún personaje se considera completado sin someterse a este ciclo iterativo:

```
[ Generar Código ] ──> [ Ejecutar en Runtime ] ──> [ Captura / Perfilado ]
                                                            │
[ Ajuste de Parámetros ] <── [ Detección de Defectos ] <────┘
```

### 1.1. Lista de Comprobación de Defectos Visuales Frecuentes:
1. **Ojos Muertos (*Dead Eyes*)**: Ojos sin brillos asimétricos o que miran rígidamente al infinito. Se corrige añadiendo micro-sacadas oculares aleatorias y dos puntos de brillo especular.
2. **Postura de Maniquí (*Mannequin Pose*)**: Simetría absoluta en reposo. Se corrige introduciendo un *tilt* de 3° a 5° en la cabeza y un desfase de 0.1s entre las extremidades.
3. **Plástico Barato (*Cheap CG Plastic*)**: Especularidad Lambert/Phong plana sin capas. Se corrige implementando PBR con *Clearcoat*, rugosidad calibrada y luz de silueta (*Rim Light*).
4. **Dislocación Anatómica (*Gimbal Pop*)**: Cabeza que gira 360° al cruzar el eje horizontal. Se corrige aplicando *clamping* angular estricto sobre cuaterniones.

---

## 2. Banco de Pruebas Unitarias para Cinemática y FSM

Las funciones matemáticas del personaje deben validarse con pruebas automatizadas que garanticen estabilidad numérica:

```typescript
import { SymplecticSpring } from './physics-and-numerical-simulation';
import { solveAnalyticalIK } from './animation-principles-and-rigging';

export function runKinematicTestSuite(): { passed: boolean; logs: string[] } {
  const logs: string[] = [];

  // Test 1: Estabilidad numérica del resorte ante picos de delta time
  const spring = new SymplecticSpring(0, 180, 12, 1);
  spring.target = 10;
  for (let i = 0; i < 300; i++) {
    spring.step(0.016);
  }
  const springStable = Math.abs(spring.position - 10) < 0.05 && Math.abs(spring.velocity) < 0.1;
  logs.push(`Test Resorte Simpléctico: ${springStable ? 'PASS' : 'FAIL'} (Pos: ${spring.position.toFixed(2)})`);

  // Test 2: Cinemática Inversa en rango alcanzable
  const ikReach = solveAnalyticalIK([0, 0], [1.2, 0.5], 1.0, 0.8, 1);
  logs.push(`Test IK 2-Bone: ${ikReach.isReachable ? 'PASS' : 'FAIL'}`);

  return { passed: springStable && ikReach.isReachable, logs };
}
```

---

## 3. Rúbrica Cuantitativa de Evaluación de Calidad (0 a 10)

| Eje de Evaluación | Criterio de Puntuación Máxima (10/10) | Puntos de Penalización |
|---|---|---|
| **Silueta y Legibilidad** | Reconocible en 24x24 px, espacio negativo claro entre torso y miembros. | -3 si las extremidades colapsan en masa informe. |
| **Materiales y Acabado** | PBR con reflectancia física, Fresnel rim de marca, micro-rugosidad. | -4 si parece un plástico Blinn-Phong básico sin reflejos. |
| **Naturalidad de Movimiento** | Conservación de volumen en squash & stretch, inercia secundaria en antenas. | -3 si el bucle de respiración es puramente mecánico senoidal. |
| **Estabilidad de Simulación** | Cuaterniones con clamps angulares, cero singularidades en IK. | -5 si la cabeza gira sobre sí misma o el resorte diverge. |
| **Rendimiento y GC** | $\le 10$ draw calls, 60 FPS estables, cero `new` en el bucle rAF. | -5 si hay micro-stutters por recolección de basura. |
| **Accesibilidad** | Respeto innegociable a `prefers-reduced-motion` y controles de sonido. | -4 si las animaciones forzadas no pueden pausarse. |
