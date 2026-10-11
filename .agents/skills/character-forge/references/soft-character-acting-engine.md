# Soft Character Acting Engine & Body Performance

Este módulo coordina la actuación dramática unificada entre mirada, microexpresiones faciales, deformación corporal y movimiento secundario en criaturas 3D.

---

## 1. El Ciclo de Actuación en 10 Fases Secuenciales

Toda acción física significativa se descompone en diez fases con duraciones y propósitos cinematográficos:

1. **Estímulo Sensorial (0–50 ms):** El personaje recibe el evento (mensaje, clic, archivo). No hay movimiento corporal aún; registra la latencia de percepción biológica.
2. **Orientación Cognitiva (50–120 ms):** Las pupilas y los ojos viran hacia el origen del estímulo antes que el cuello.
3. **Anticipación Física (120–250 ms):** Compresión elástica opuesta (*squash* preparatorio) o retracción del cuerpo para cargar energía.
4. **Lanzamiento / Acción Principal (250–450 ms):** Desplazamiento explosivo o movimiento intencional hacia el objetivo.
5. **Acento / Ápex Expresivo (450–550 ms):** Punto culminante donde la pose alcanza su deformación máxima y la expresión facial se fija.
6. **Continuación (*Follow-through*) (550–700 ms):** Las partes blandas (orejas, pelusa, accesorios) continúan su trayectoria por inercia tras el frenado del cuerpo.
7. **Rebote y Absorción (700–850 ms):** El oscilador armónico absorbe el impacto en el suelo o en la posición final.
8. **Asimilación Cognitiva (850–1000 ms):** Pausa analítica donde el personaje procesa el resultado de la acción.
9. **Retorno y Asentamiento (1000–1200 ms):** Restauración suave a la postura de reposo neutra.
10. **Memoria Contextual (1200–1250 ms):** Registro del estado anímico residual en la FSM conductual.

---

## 2. Repertorio de 22 Movimientos Corporales

1. **Respiración Sutil:** Ciclo sinusoidal lento de volumen vertical ($S_y \in [0.985, 1.015]$, período $3.2\text{ s}$).
2. **Balanceo de Reposo (*Idle Sway*):** Micro-rotación en Yaw/Roll sincronizada con la respiración.
3. **Parpadeo Espontáneo:** Ciclo de $180\text{ ms}$ según distribución de Poisson.
4. **Inclinación de Cabeza (*Head Tilt*):** Rotación Roll de $\pm 15^\circ$ expresando curiosidad o duda.
5. **Salto Corto (*Hop*):** Anticipación de $150\text{ ms}$, elevación de $20\text{ px}$ con aterrizaje amortiguado.
6. **Salto Acrobático (*Leap*):** Elevación alta con giro en espiral de $360^\circ$ en Yaw.
7. **Rebote Elástico (*Squash Bounce*):** Deformación elástica vertical sin despegarse del suelo.
8. **Estiramiento Desperezado:** Expansión vertical con bostezo y caída relajada.
9. **Sacudida de Pelusa (*Fuzz Shake*):** Oscilación rápida en Yaw a $12\text{ Hz}$ para sacudirse el polvo o tensión.
10. **Giro Rápido (*Spin*):** Giro de $180^\circ$ o $360^\circ$ para encarar un evento repentino.
11. **Asentimiento (*Nod*):** Dos ciclos rítmicos de cabeceo en Pitch afirmativo.
12. **Negación (*Head Shake*):** Tres ciclos rápidos de desacuerdo en Yaw.
13. **Encogimiento Cauteloso:** Reducción de escala vertical al $85\%$ y orejas plegadas.
14. **Expansión Orgullosa:** Pecho inflado al $115\%$ y barbilla elevada.
15. **Temblor de Anticipación:** Vibración sutil de alta frecuencia previa a una acción emocionante.
16. **Reacción a Sonido:** Giro súbito de orejas en dirección al estímulo acústico.
17. **Curiosidad ante Objeto:** Acercamiento con cuello estirado y pupilas dilatadas.
18. **Seguimiento Visual Dinámico:** Ojos y cabeza acoplados al cursor con amortiguamiento crítico.
19. **Celebración de Victoria:** Serie de saltitos rítmicos con destellos de estrellas.
20. **Retraimiento / Timidez:** El cuerpo se aleja del cursor escondiendo la mirada.
21. **Descanso y Sueño:** El centro de masa colapsa sobre el suelo con respiración pesada.
22. **Sobresalto Inesperado:** Elevación vertical instantánea con ojos desorbitados y rebote rápido.
