| Campo | Valor |
| --- | --- |
| Estado | Revisable — fuente vigente de métricas y objetivos. Actualizado con decisión P22 (Presupuesto y métricas de UX/UI) 2026-10-06 |
| Owner | ness-e |
| Fecha | 2026-10-06 |
| Fuente histórica | `../prd/13-12-experiencia-de-usuario-e-interfaz.md` (congelado) + Decisiones P1-P8, P11, P22 2026-10-06 |

# Métricas y OKRs

## North Star
Sub-Egos y capacidades que recuperan y operan con éxito sobre la memoria del proyecto dentro de un horizonte de 7 días, con un recall de contexto ≥85% y una reconstrucción del contexto en menos de 30 segundos.

## OKRs P0

### O1: P0-Alpha completado (Fases 01-05)
**Objetivo:** Establecer un núcleo cognitivo funcional y estable.
- **KR1**: El *Golden Path Alpha* (20 pasos) pasa exitosamente, incluyendo persistencia entre sesiones.
- **KR2**: Ejecución estable del flujo completo (Cognitive loop, Model Router, Sub-Egos y herramientas) en el entorno Electron+VantaDB.
- **KR3**: Zero losses de memoria confirmados tras reinicios del sistema y renderizado correcto en el Dynamic Workspace.

### O2: P0-Beta completado (Fases 06-12)
**Objetivo:** Lograr un producto operativo y distribuible que asista en proyectos reales.
- **KR1**: El *Golden Path Beta* se completa satisfactoriamente en un proyecto real de varios días utilizando múltiples dominios funcionales.
- **KR2**: Recall del contexto ≥85% sobre datos ingeridos y tareas de segundo plano, sin fugas de datos entre Sub-Egos.
- **KR3**: Instalador de escritorio empaquetado, firmado y probado con cero regresiones críticas y auto-updater funcional.
- **KR4 (Criterio de salida UX)**: Un usuario puede realizar los flujos principales sin conocer la arquitectura interna ni requerir comandos técnicos o intervención en logs.

## Regla de Finalización de Fase
- **Fase = DONE**: Una fase sólo se considera completa si cumple la regla estricta:  
  `IMPLEMENTADO + INTEGRADO + PRUEBA FUNCIONAL PASA + PRUEBA DE ERROR PASA + PERSISTENCIA VERIFICADA + NO HAY REGRESIONES CRÍTICAS + CRITERIOS DE UX CUMPLIDOS (Usable + Consistente + Estados completos + Accesibilidad básica + Design System)`.

## Medición del Esfuerzo y Control de Presupuesto UI (Decisión P22)

Para asegurar un desarrollo predecible y equilibrado entre lógica interna y experiencia de usuario (ver estrategia detallada en [../product/ux-ui.md](../product/ux-ui.md)), el control del esfuerzo se gestiona con dos magnitudes desacopladas:

### 1. Estimación vs. Control de Tiempo
- **Effort Points (Escala Fibonacci 1, 2, 3, 5, 8, 13):** Utilizados exclusivamente para la estimación de complejidad relativa, incertidumbre y tamaño de las capacidades o tareas.
- **Horas-persona:** Utilizadas exclusivamente para el control de presupuesto, consumo de tiempo real y capacidad de trabajo del equipo.
- **Regla estricta:** **NO convertir puntos a horas**. Los puntos de esfuerzo reflejan complejidad e incertidumbre conceptual; las horas miden tiempo físico transcurrido. Una equivalencia lineal directa distorsiona la estimación y enmascara problemas reales de implementación.

### 2. Fórmula del Presupuesto UI
El esfuerzo invertido en diseño y experiencia de usuario se controla por fase y acumulado mediante la relación:

$$\text{UI Budget \%} = \left(\frac{\text{Horas UI}}{\text{Horas Totales}}\right) \times 100$$

- **Objetivo global P0:** 15–20% del esfuerzo total destinado a UI/UX (60–70% distribuido en cada feature funcional y 30–40% reservado para pulido transversal y pre-launch).
- **Rangos por fase:** Del 10% al 30% según la naturaleza de la fase (ej. 10–15% en Core vs. 25–30% en Dynamic Workspace / Canvas).

### 3. Sistema de Semáforo de Presupuesto UI
El consumo de horas de interfaz de usuario se audita de forma continua mediante cuatro estados de alerta:

| Rango de Consumo | Estado | Diagnóstico y Acción requerida |
| --- | :---: | --- |
| **0% – 70%** | **Normal** (Verde) | Ritmo saludable. Desarrollo dentro de los márgenes previstos de la fase. |
| **70% – 90%** | **Atención** (Amarillo) | Consumo elevado. Evaluar causas de fricción visual o sobre-diseño; supervisar desviaciones en el tablero. |
| **90% – 100%** | **Límite** (Naranja) | Techo de presupuesto alcanzado. Congelar microinteracciones y refinamientos no esenciales; enfocar el esfuerzo estrictamente en completitud funcional y usabilidad básica (L2). |
| **> 100%** | **Excedido** (Rojo) | Alerta crítica de sobrecoste UI. Congelar cualquier ajuste estético; autorizar únicamente correcciones de bloqueos críticos de usabilidad y accesibilidad mínima. |

### 4. Métricas de Seguimiento Obligatorias
Durante la ejecución de cada fase se rastrean las siguientes variables:
- **Effort Points estimados:** Volumen de complejidad planificado para la capacidad.
- **Horas totales reales:** Tiempo invertido en todas las actividades (arquitectura, lógica, pruebas, UI).
- **Horas UI reales:** Tiempo invertido específicamente en diseño, prototipado, tokens, maquetación, componentes declarativos y accesibilidad.
- **UI Budget %:** Ratio real resultante vs. presupuesto meta asignado a la fase.
- **Rework Rate (%):** Proporción de horas reinvertidas en rediseñar o refactorizar interfaces por ambigüedades tempranas o deuda técnica de UX:  
  $$\text{Rework Rate (\%)} = \left(\frac{\text{Horas retrabajo}}{\text{Horas UI totales}}\right) \times 100$$  
  *(Rework Rate (%) = (Horas retrabajo / Horas UI totales) × 100)*.
- **Desviación (Deviation %):** Porcentaje de variación entre las horas UI presupuestadas y las efectivamente consumidas.

## Métricas P0 de viabilidad
- Eficiencia del **Enrutamiento de Modelos**: Precisión en la elección del rol funcional correcto por parte del Model Router.
- Uso de **Capacidades**: Frecuencia de invocación correcta de las herramientas expuestas por las plantillas de especialistas en el runtime de ejecución aislado.
- Resolución de conflictos en **Cuarentena**: Tiempo promedio de validación humana en el workspace dinámico.
