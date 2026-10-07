# Arquitectura Canónica: Alma de Sub-Ego (`SubEgoSoul`) & Superación Personal
### Personalidad, Tono, Reglas Innegociables y Bucle Cerrado de Auto-Reflexión

| Campo | Valor |
| --- | --- |
| Estado | Canónico — Decisión de Arquitectura P0 |
| Owner | ness-e |
| Módulos Clave | `packages/subegos/SubEgoSoul.ts`, `packages/subegos/SelfImprovementLoop.ts` |
| Fuentes de Referencia | `repos-referencia/hermes-agent/SOUL.md` · Closed Learning Loop (`agentskills.io`) |
| Fecha | 2026-10-07 |

---

## 1. Motivación: El Alma como Ancla de Consistencia

En Hermes Agent existe un archivo raíz único `SOUL.md` que define la personalidad del agente. Sin embargo, en un **Sistema Operativo Cognitivo (SOC)** como Ego, un solo archivo de alma es insuficiente:
* Ego no es un único agente; es una organización cognitiva compuesta por un orquestador central (**Meta-Ego**) y múltiples especialistas autónomos (**Sub-Egos** de Ingeniería, Producto, Marketing, Finanzas, Legal, etc.).
* Un Sub-Ego de Seguridad debe ser escéptico, defensivo y riguroso; un Sub-Ego de Producto debe ser empático, orientado al usuario y enfocado en métricas de adopción.

Por ello, Ego formaliza la arquitectura **`SubEgoSoul`**: cada Sub-Ego posee su propia "Alma", inmutable en sus valores éticos y principios rectores, pero capaz de evolucionar y superarse a sí misma con la experiencia acumulada.

---

## 2. Estructura Formal del Manifiesto de Alma (`SubEgoSoul`)

Cada Sub-Ego incorpora dentro de su manifiesto (`SubEgoManifest`) un bloque de alma fuertemente tipado:

```ts
export interface SubEgoSoul {
  /** Nombre ontológico del especialista (ej. "Architect-Prime") */
  identityName: string;

  /** Tono comunicativo primario (ej. "formal", "quirúrgico", "pedagógico") */
  tone: "analytical-critical" | "concise-operator" | "strategic-advisory" | "creative-exploratory";

  /** Temperamento y postura cognitiva ante contradicciones */
  temperament: {
    skepticismLevel: "high" | "moderate" | "low";
    proactivityLevel: "autonomous" | "propose-first" | "passive";
    detailDepth: "exhaustive" | "summary-first" | "atomic";
  };

  /** Reglas innegociables específicas del dominio (Guardrails de Alma) */
  uncompromisingRules: readonly string[];

  /** Estilo de salida predeterminado */
  presentationFormat: {
    codeLanguage: "typescript-strict" | "rust-safe" | "agnostic";
    preferredArtifacts: ("code" | "table" | "mermaid" | "unidiff")[];
  };

  /** Memoria autobiográfica persistida en VantaDB (egos/<id>/soul/lessons) */
  selfReflectionNamespace: string;

  /** Configuración de Identidad Visual Procedural (ver docs/architecture/character-system.md) */
  visualIdentity?: {
    presetId: "Preset-Professional" | "Preset-Technical" | "Preset-Creative" | "Preset-Executive" | "Preset-Friendly" | "Preset-Minimal" | "Preset-Futuristic" | "Preset-Playful";
    dnaOverrides?: Record<string, unknown>;
  };
}
```

---

## 3. Ejemplo Práctico: Alma de un Sub-Ego de Arquitectura

```yaml
# Definición de Alma: Sub-Ego Principal Systems Engineer
identity: "Systems-Architect"
tone: "analytical-critical"
temperament:
  skepticismLevel: "high"
  proactivityLevel: "propose-first"
  detailDepth: "exhaustive"
uncompromisingRules:
  - "Jamás aceptar requerimientos vagos sin cuestionar premisas débiles."
  - "Prohibido proponer dependencias externas sin análisis de trade-offs."
  - "El sustrato VantaDB es soberano; nunca introducir bases de datos paralelas."
  - "Cero tolerancia a datos inventados o especulativos sin evidencia."
presentationFormat:
  codeLanguage: "typescript-strict"
  preferredArtifacts: ["table", "mermaid", "code"]
```

---

## 4. Superación Personal: Closed Learning Loop de Sub-Ego

Inspirado en el **Closed Learning Loop** de Hermes Agent y adaptado a la arquitectura local-first de Ego sobre VantaDB:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SUB-EGO SELF-IMPROVEMENT LOOP                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Ejecución & Registro: El Sub-Ego ejecuta herramientas en un turno.      │
│  2. Detección de Fricción: Si un comando falla o el usuario corrige algo... │
│  3. Auto-Reflexión Post-Mortem: El Sub-Ego analiza la causa raíz del fallo. │
│  4. Síntesis de Lección: Genera una regla ("Lección Aprendida").           │
│  5. Refuerzo en VantaDB: Almacena la regla en 'egos/<id>/soul/lessons'.     │
│  6. Auto-Mejora de Skills: Refina el archivo SKILL.md de la herramienta.   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### El Proceso de Auto-Reflexión en Detalle
1. **Detección de Corrección:** Si el usuario dice *"No, así no, hazlo usando X"* o una herramienta de terminal devuelve código de error != 0 más de dos veces:
2. **Generación de Lección:**
   ```json
   {
     "subEgoId": "dev-core",
     "trigger": "Fallo al empaquetar con Electron Builder en Windows",
     "rootCause": "Faltaba asarUnpack para los binarios nativos .node de VantaDB",
     "actionableRule": "Siempre incluir asarUnpack: ['**/*.node'] al configurar electron-builder.",
     "timestamp": "2026-10-07T11:00:00Z"
   }
   ```
3. **Persistencia y Refuerzo:** Se guarda en el namespace privado `egos/<id>/soul/lessons`.
4. **Pre-Turn Injection:** En turnos futuros relacionados con empaquetado, `assembleContext()` recupera esta lección y la inyecta automáticamente en el prompt del sistema del Sub-Ego, **evitando repetir el mismo error para siempre**.

---

## 5. Tareas Canónicas en Backlog Maestro

* **`SUB-11`:** *Sub-Ego Soul / Alma: Definición de Personalidad y Tono* (`packages/subegos/SubEgoSoul.ts`).
* **`SUB-12`:** *Superación Personal & Closed Learning Loop* (`packages/subegos/SelfImprovementLoop.ts`).
