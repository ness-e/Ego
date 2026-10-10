# Architecture, Code Quality & Lifecycle Engineering

Este documento establece los estándares de ingeniería de software, patrones arquitectónicos y directrices de ciclo de vida para entregar componentes de personajes mantenibles y sin fugas de memoria.

---

## 1. Separación de Responsabilidades y Principios SOLID

Un error común es agrupar la física, los eventos de puntero, los materiales PBR y el renderizado en un solo archivo `.tsx` de 1,000 líneas. Se debe estructurar en módulos desacoplados:

```
src/character/
├── domain/
│   ├── CharacterFSM.ts          # Lógica pura de estados (Sin dependencias de DOM ni Three.js)
│   └── KinematicsSolver.ts      # Álgebra lineal, IK y resortes (Funciones puras testables)
├── infrastructure/
│   ├── ProceduralGeometry.ts    # Constructores de mallas y BufferGeometry
│   ├── MaterialFactory.ts       # Configuración PBR y shaders GLSL
│   └── WebAudioSynthesizer.ts   # Síntesis procedural de SFX
└── presentation/
    ├── useCharacterRig.ts       # Hook de ciclo de vida y animación rAF
    └── CharacterView.tsx        # Componente de vista React / R3F
```

---

## 2. Regla de Oro: Cero Asignaciones de Memoria en el Render Loop

**Cualquier llamada a `new Vector3()`, `new Object()` o función flecha dentro de un hook ejecutado a 60-120 FPS genera fragmentación de memoria en el V8 Engine y pausas de Garbage Collector (micro-stutters)**:

```typescript
// ❌ CÓDIGO DEFICIENTE (Provoca GC Stutter cada 3 segundos)
useFrame(() => {
  const target = new THREE.Vector3(mouse.x, mouse.y, 0); // ¡NUNCA DENTRO DEL LOOP!
  meshRef.current.lookAt(target);
});

// ✅ CÓDIGO DE PRODUCCIÓN (Cero allocs en runtime)
const preallocatedTarget = useMemo(() => new THREE.Vector3(), []);

useFrame(() => {
  preallocatedTarget.set(mouse.x, mouse.y, 0); // Mutación in-place reutilizando buffer
  meshRef.current.lookAt(preallocatedTarget);
});
```

---

## 3. Protocolo Estricto de Limpieza (Disposal & Unmount)

Al desmontarse un componente de React, todos los recursos creados en la GPU deben destruirse manualmente para evitar que el contexto WebGL colapse por falta de VRAM:

```typescript
export function useSafeWebGLCleanup(rootGroupRef: React.RefObject<THREE.Group>) {
  useEffect(() => {
    return () => {
      const root = rootGroupRef.current;
      if (!root) return;

      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) {
            mesh.geometry.dispose();
          }
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
    };
  }, [rootGroupRef]);
}
```
Esto garantiza que la aplicación anfitriona pueda montar y desmontar el personaje miles de veces sin degradar el rendimiento del navegador.
