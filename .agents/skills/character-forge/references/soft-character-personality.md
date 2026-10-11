# Soft Character Personality, Behavioral States & Contextual Reactivity

Este módulo formaliza la arquitectura cognitiva y conductual para mascotas 3D, desacoplando el estado anímico temporal, la personalidad persistente y la intención activa.

---

## 1. La Tríada Conductual Desacoplada

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. PERSONALIDAD PERSISTENTE (Vector Cuantitativo 8D)            │
│    Tendencias de comportamiento fijas o de lenta evolución      │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 v
┌──────────────────────────────────────────────────────────────────┐
│ 2. ESTADO EMOCIONAL TEMPORAL (Variables Continuas de Valencia)   │
│    Energía [0,1], Valencia [-1,1], Activación [0,1], Fatiga     │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 v
┌──────────────────────────────────────────────────────────────────┐
│ 3. INTENCIÓN ACTIVA (Acting Goal)                                │
│    ¿Qué está intentando hacer en este momento exacto?            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Los 10 Perfiles Conductuales Canónicos

1. **Curioso y Activo:** Alta iniciativa, sigue el cursor con avidez, se asoma ante archivos nuevos, latencia de reacción mínima ($80\text{ ms}$).
2. **Tranquilo y Contemplativo:** Movimientos lentos y fluidos, respiración profunda, rara vez salta bruscamente, alta tolerancia a la inactividad.
3. **Juguetón e Impredecible:** Frecuentes sacudidas de pelusa, saltitos inesperados, guiños traviesos y respuestas cómicas.
4. **Tímido y Cauteloso:** Mantiene distancia del cursor, pupilas se retraen si el mouse se acerca muy rápido, orejas gachas, toma tiempo para tomar confianza.
5. **Expresivo y Teatral:** Amplitud de *squash & stretch* al $130\%$, expresiones faciales contrastadas, celebra con entusiasmo desbordante.
6. **Sereno y Elegante:** Giros suaves, amortiguamiento crítico ($\zeta = 0.8$), nunca realiza rebotes histriónicos.
7. **Enérgico y Entusiasta:** Frecuencia natural alta ($\omega_0 = 22\text{ rad/s}$), alerta inmediata ante cualquier notificación.
8. **Dormilón y Relajado:** Entra en microsueños tras 30 segundos de inactividad, párpados pesados, bosteza con frecuencia.
9. **Analítico y Concentrado:** Mirada fija y atenta durante tareas de compilación/código, orejas orientadas hacia adelante, cero distracciones.
10. **Protector y Atento:** Permanece en el borde de la pantalla vigilando, reacciona instantáneamente a errores de build con alarma visual.
