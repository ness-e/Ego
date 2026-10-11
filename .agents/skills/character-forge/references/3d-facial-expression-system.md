# 3D Facial Expression System & Parametric Emotion Space

Este módulo define la arquitectura facial tridimensional, desacoplada de la topología del cuerpo, para articular emociones, microexpresiones, dirección de la mirada y parpadeo biológico en mascotas suaves.

---

## 1. Controles Anatómicos del Rostro 3D

El sistema facial opera sobre un conjunto unificado de canales continuos normalizados $[-1.0, 1.0]$:

```typescript
export interface FacialRigChannels {
  // Párpados y Ojos
  eyeBlinkLeft: number;      // [0, 1] Cierre de párpado superior
  eyeBlinkRight: number;     // [0, 1] Permite guiños asimétricos
  eyeSquint: number;         // [0, 1] Párpados inferiores suben por sonrisa
  eyeWide: number;           // [0, 1] Dilatación por asombro o miedo
  gazeYaw: number;           // [-1, 1] Mirada horizontal
  gazePitch: number;         // [-1, 1] Mirada vertical
  pupilDilation: number;     // [-1, 1] Dilatación simpática vs contracción
  
  // Cejas (físicas o implícitas en el relieve)
  browRaise: number;         // [-1, 1] -1 fruncir, +1 levantar
  browTilt: number;          // [-1, 1] Inclinación interna vs externa
  
  // Boca y Mejillas
  mouthSmile: number;        // [-1, 1] -1 tristeza/disgusto, +1 sonrisa amplia
  mouthOpen: number;         // [0, 1] Apertura mandibular
  mouthPucker: number;       // [0, 1] Beso o sorpresa "O"
  cheekPuff: number;         // [0, 1] Inflado de mejillas por esfuerzo o ternura
  
  // Orejas y Apéndices Emocionales
  earsDroop: number;         // [0, 1] Orejas caídas por cansancio/tristeza
  earsPerk: number;          // [0, 1] Orejas atentas erguidas por estímulo
}
```

---

## 2. Micro-Sacadas Pupilares y Parpadeo de Poisson

* **Parpadeo Fisiológico:**
  - Intervalos estocásticos modelados con una distribución de Poisson ($\lambda = 3.8\text{ segundos}$).
  - Duración del ciclo: $180\text{ ms}$ (cierre rápido en $50\text{ ms}$, apertura elástica en $130\text{ ms}$).
* **Micro-sacadas:**
  - La mirada humana/animal jamás permanece fija al $100\%$; introduce jitter sub-angular determinista cada $400-800\text{ ms}$ con amplitud de $\pm 0.04\text{ rad}$.

---

## 3. Catálogo de 20 Recetas Emocionales Canónicas

| Emoción | Párpados | Pupilas | Boca / Mejillas | Orejas / Cabeza |
|---|---|---|---|---|
| **1. Neutral Atento** | Abiertos (0.0) | Enfoque frontal | Recta (0.0) | Niveladas, leve micro-sacada |
| **2. Alegría** | Entrecerrados (Squint 0.7) | Brillantes, normales | Sonrisa amplia (0.85) | Erguidas, barbilla arriba |
| **3. Curiosidad** | Uno amplio, otro entrecerrado | Dilatadas (+0.3), mirando foco | Boca pequeña "o" (0.2) | Cabeza ladeada $+18^\circ$ |
| **4. Sorpresa** | Ojos abiertos al máximo (+1.0) | Dilatación rápida (+0.6) | Boca abierta redonda (0.8) | Orejas tiesas hacia atrás |
| **5. Confusión** | Asimétricos (0.2 / 0.5) | Mirada errante hacia arriba | Boca ladeada (-0.2) | Ceño fruncido asimétrico |
| **6. Tristeza** | Párpados caídos (0.6) | Mirada hacia el suelo | Comisuras hacia abajo (-0.8) | Orejas totalmente caídas |
| **7. Frustración** | Entrecerrados con tensión | Fijas y tensas | Labios apretados, mejillas tensas | Sacudida breve de cabeza |
| **8. Enojo Estilizado** | Ceño muy fruncido (-0.9) | Pequeñas (-0.4) | Boca abierta con dientes/pliegues | Orejas hacia los lados (modo avión) |
| **9. Timidez / Pudor** | Ojos semicerrados (0.5) | Mirando hacia abajo y lado | Sonrisa pequeña sutil (0.3) | Mejillas infladas con rubor |
| **10. Sueño / Cansancio**| Párpados pesados (0.85) | Movimiento muy lento | Bostezo o boca relajada | Cabeza cabeceando hacia adelante |
| **11. Concentración** | Ojos entrecerrados intensos | Fijas en un punto preciso | Boca recta apretada | Orejas orientadas al frente |
| **12. Alivio** | Cierre lento y suspiro | Mirada que sube y se relaja | Sonrisa suave (0.4) | Hombros y cuerpo descienden |
| **13. Orgullo** | Ojos entrecerrados confiados | Mirada desde arriba | Sonrisa socarrona (0.5) | Pecho inflado, cabeza erguida |
| **14. Entusiasmo** | Ojos dilatados y brillantes | Pupilas grandes (+0.5) | Sonrisa abierta máxima (1.0) | Orejas vibrando o balanceándose |
| **15. Empatía** | Ojos tiernos y suaves | Mirada suave fija | Sonrisa comprensiva leve | Cabeza inclinada con afecto |
| **16. Incertidumbre** | Ojos moviéndose de lado a lado | Ligeramente contraídas | Boca vacilante ondulada | Orejas fluctuantes |
| **17. Satisfacción** | Ojos cerrados plácidamente | — | Sonrisa apacible continua | Ronroneo o micro-balanceo |
| **18. Expectativa** | Ojos bien abiertos expectantes| Grandes, enfocadas al cursor | Boca entreabierta atenta | Cuerpo en tensión preparatoria |
| **19. Picardía / Travesura**| Un ojo guiñado (1.0 / 0.0) | Mirada de reojo | Sonrisa asimétrica ladeada | Cabeza ladeada con salto |
| **20. Sobresalto** | Ojos desorbitados instantáneos| Dilatación repentina | Apertura brusca | Retracción de cuello y cuerpo |
