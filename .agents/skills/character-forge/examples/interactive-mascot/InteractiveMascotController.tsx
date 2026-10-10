import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { buildProceduralRobot } from '../procedural-3d-character/ProceduralRobotMesh';
import { CharacterAnimationEngine } from '../character-animation/CharacterAnimationEngine';

export type MascotFsmState = 'idle' | 'tracking' | 'thinking' | 'success' | 'error' | 'celebrating';

export interface InteractiveMascotProps {
  state?: MascotFsmState;
  brandColor?: string;
  accentColor?: string;
  width?: number;
  height?: number;
  onStateChange?: (newState: MascotFsmState) => void;
}

/**
 * InteractiveMascotController — Componente React de producción
 * Monta la escena 3D, gestiona el bucle a 60 FPS, maneja puntero y limpia recursos GPU al desmontar.
 */
export const InteractiveMascotController: React.FC<InteractiveMascotProps> = ({
  state = 'tracking',
  brandColor = '#00bcd4',
  accentColor = '#00f0ff',
  width = 300,
  height = 300,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detección de prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Escena, Cámara y Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 0.6, 4.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 2. Luces
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.2);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(new THREE.Color(accentColor), 1.5);
    rimLight.position.set(0, 3, -4);
    scene.add(rimLight);

    // 3. Mascota y Motor de Animación
    const robot = buildProceduralRobot({
      primaryHex: brandColor,
      accentHex: accentColor,
      jointHex: '#334155',
    });
    scene.add(robot.root);

    const animEngine = new CharacterAnimationEngine();
    const pointer = { x: 0, y: 0 };

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    window.addEventListener('mousemove', handlePointerMove, { passive: true });

    // 4. Render Loop
    let animId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) * 0.001, 0.033);
      lastTime = now;
      const time = now * 0.001;

      if (!reducedMotion) {
        // Actualizar Respiración
        if (state === 'idle' || state === 'tracking') {
          animEngine.updateBreathing(time, robot.root.scale);
        } else if (state === 'success') {
          const jump = Math.abs(Math.sin(time * 7)) * 0.4;
          robot.root.position.y = jump;
        }

        // Actualizar Look-At
        if (state === 'tracking') {
          animEngine.updateLookAt(robot.headPivot.quaternion, [pointer.x, pointer.y], dt);
        }

        // Actualizar Antena
        const antennaZ = animEngine.updateAntennaPhysics(robot.headPivot.rotation.y, dt);
        robot.antennaPivot.rotation.z = antennaZ;
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // 5. Cleanup Estricto de Recursos WebGL al desmontar
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handlePointerMove);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      robot.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          if (m.material) {
            if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
            else m.material.dispose();
          }
        }
      });
    };
  }, [brandColor, accentColor, width, height, state, reducedMotion]);

  return (
    <div
      ref={mountRef}
      style={{ width, height, position: 'relative' }}
      role="img"
      aria-label={`Mascota interactiva en estado ${state}`}
    />
  );
};
