# Creative Evaluation, Originality Rubrics & Visual Self-Critique

Este documento formaliza el protocolo de autocrítica visual y la rúbrica cuantitativa para evaluar la diversidad estructural y la originalidad de las propuestas de personajes antes de su entrega.

---

## 1. El Protocolo de las 15 Preguntas de Autocrítica Visual

Al completar una primera iteración de un personaje, el ingeniero/agente debe someter la solución a este interrogatorio riguroso:

1. **Prueba del Contorno Ciego**: ¿Se distingue la silueta y se reconoce el personaje si se rellena todo de negro absoluto?
2. **El Rasgo Memorable (*The Hook*)**: ¿Hay una característica visual única que un usuario pueda recordar y describir mañana?
3. **Coherencia de Estilo**: ¿Todos los elementos pertenecen al mismo universo visual o hay partes que parecen de librerías distintas?
4. **Diferenciación Táctil**: ¿Los materiales se perciben táctilmente distintos (ej. madera mate vs metal pulido vs goma) o parecen el mismo plástico coloreado?
5. **Función de la Luz**: ¿La iluminación modela los volúmenes y resalta la silueta o actúa como un lavado plano?
6. **Legibilidad Emocional**: ¿La expresión comunica la intención concreta del personaje o se parece a un emoji predecible?
7. **Gravedad y Masa**: ¿El movimiento transmite peso, inercia y amortiguamiento o parece una flotación matemática ingrávida?
8. **Integración de Accesorios**: ¿Los accesorios están integrados funcionalmente o parecen pegados como disfraces postizos?
9. **Encuadre y Formato**: ¿La escala y la cámara están optimizadas para el entorno final (UI pequeña, hero web o icono)?
10. **Economía de Elementos**: ¿Hay partículas, luces o biseles redundantes que solo añaden ruido visual sin aportar significado?
11. **Prueba de Plantilla**: ¿El personaje parece un avatar genérico de banco de imágenes 3D? (Si la respuesta es sí, rehacer).
12. **Autocopia del Agente**: ¿El personaje se parece a la solución de la tarea anterior? ¿Hemos repetido el robot con visor cian?
13. **Viabilidad Técnica**: ¿Cumple los presupuestos de draw calls ($\le 10$) y $0\text{ bytes GC}$ en el render loop?
14. **El Test de la Navaja de Ockham**: ¿Se puede quitar un elemento sin perder nada de personalidad? Si es así, quítalo.
15. **La Alternativa Radical**: ¿Existe una dirección artística radicalmente más audaz que no nos atrevimos a probar por comodidad?

---

## 2. Rúbrica Cuantitativa de Comparación entre Variantes (0 a 10)

Cuando se generan 3 conceptos alternativos, se evalúan en esta matriz comparativa. **Si dos variantes obtienen una diferencia menor a 3 puntos en "Diferenciación Estructural", una de ellas debe ser descartada por redundante**:

```
Eje de Evaluación                      Criterio de Calificación Máxima (10 pts)
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
1. Diferenciación Estructural          Morfologías radicalmente distintas (ej. monolito angular vs criatura blanda).
                                       Puntuación baja (1-4) si solo cambian colores, escala o accesorios.

2. Contraste de Silueta                Siluetas exteriores inconfundibles al compararlas en blanco y negro.

3. Singularidad de Materialidad        Técnicas de superficie opuestas (ej. papel origami vs cerámica vidriada).

4. Coherencia Narrativa con la Marca   Resuelve el objetivo de negocio y comunica el tono sin recurrir a clichés.

5. Viabilidad de Animación & Código    Se implementa limpiamente en código sin requerir assets de 50 MB.
```

---

## 3. El Criterio de Descarte de Variantes Superficiales

```
                                [ ¿Es una variante válida? ]
                                             │
                       ¿Difiere en silueta o concepto central?
                                    /                 \
                                  (SÍ)                (NO)
                                   │                   │
                     ¿Difiere en su materialidad?      ▼
                          /                 \     [ 🚫 DESCARTAR ]
                        (SÍ)                (NO)  "Es la misma mascota
                         │                   │     con otro disfraz"
                         ▼                   ▼
                  [ ✅ APROBADA ]      [ REESTRUCTURAR ]
```
Este filtro garantiza que el usuario reciba un abanico de posibilidades genuinamente creativo y profesional.
