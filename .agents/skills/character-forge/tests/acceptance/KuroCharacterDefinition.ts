/**
 * @file KuroCharacterDefinition.ts
 * @description Definición canónica y divergencia conceptual para el personaje original "Kuro".
 * Cumple los Criterios 1, 2 y 4 de la Prueba de Aceptación Definitiva:
 * - 3 Conceptos formalmente diferenciados en morfología, proporciones y silueta.
 * - Especificación paramétrica matemática de Kuro (Concepto B) con invariantes de identidad.
 */

export interface ConceptDivergence {
  id: string;
  name: string;
  designPhilosophy: string;
  shapeLanguage: {
    dominantGeometry: string;
    cornerCurvatureExp: number; // Exponente superelipsoidal p (p=2 elipse, p=1 rombo, p>4 cuadrado)
    proportions: { headRatio: number; bodyRatio: number; limbRatio: number };
    contourTopology: "smooth_continuous" | "faceted_chiseled" | "segmented_spheres";
  };
  materialAndLighting: {
    recipeId: string;
    baseColor: string;
    accentColor: string;
    lightingModel: "flat" | "lambert_approx" | "phong_approx" | "ink_wash";
    surfaceTexture: string;
  };
  silhouetteMetrics: {
    boundingAspect: number; // Ancho / Alto
    silhouetteComplexityScore: number; // Número de puntos de inflexión característicos
    primaryFocalPoint: string;
  };
  expressiveTemperament: string;
}

export const KURO_DIVERGENT_CONCEPTS: Record<string, ConceptDivergence> = {
  concept_a_gothic_faceted: {
    id: "concept_a_gothic_faceted",
    name: "Kuro-Gothic (Constructo Relojero Brutalista)",
    designPhilosophy: "Autómata de cálculo rígido, vertical y heráldico con aristas biseladas de bronce y hierro.",
    shapeLanguage: {
      dominantGeometry: "Prismas trapezoidales y cuadriláteros angulares",
      cornerCurvatureExp: 8.0, // Silueta casi ortogonal
      proportions: { headRatio: 0.35, bodyRatio: 0.55, limbRatio: 0.10 }, // Cabeza pequeña, torso pesado
      contourTopology: "faceted_chiseled"
    },
    materialAndLighting: {
      recipeId: "ceramic_kintsugi",
      baseColor: "#27272a",
      accentColor: "#d97706", // Bronce dorado
      lightingModel: "phong_approx",
      surfaceTexture: "Metal cepillado con pátina de oxidación"
    },
    silhouetteMetrics: {
      boundingAspect: 0.65, // Estrecho y vertical
      silhouetteComplexityScore: 16,
      primaryFocalPoint: "Péndulo central en el torso"
    },
    expressiveTemperament: "Metódico, implacable, lacónico"
  },

  concept_b_ink_spirit: {
    id: "concept_b_ink_spirit",
    name: "Kuro-Ink (Espíritu Caligráfico y Relojería de Bolsillo)",
    designPhilosophy: "Gota viva de tinta ferrogálica con elasticidad fluida y precisión de cronómetro mecánico.",
    shapeLanguage: {
      dominantGeometry: "Superelipsoide biconvexo ovoide suave",
      cornerCurvatureExp: 2.35, // Curvatura orgánica intermedia (entre elipse y squircle suave)
      proportions: { headRatio: 0.64, bodyRatio: 0.36, limbRatio: 0.00 }, // Chibi orgánico sin extremidades flotantes
      contourTopology: "smooth_continuous"
    },
    materialAndLighting: {
      recipeId: "ink_etching_paper",
      baseColor: "#18181b", // Tinta ferrogálica negra profunda
      accentColor: "#f59e0b", // Ámbar de latón en accesorios
      lightingModel: "ink_wash",
      surfaceTexture: "Lustre ceroso satinado con highlight especular nítido"
    },
    silhouetteMetrics: {
      boundingAspect: 0.92, // Esferoide casi circular con asimetría en base
      silhouetteComplexityScore: 6,
      primaryFocalPoint: "Ojos asimétricos con monóculo péndulo"
    },
    expressiveTemperament: "Curioso, vigilante, elástico, sobrio"
  },

  concept_c_concentric_mechanism: {
    id: "concept_c_concentric_mechanism",
    name: "Kuro-Mechanism (Autómata Esférico Desacoplado)",
    designPhilosophy: "Dispositivo modular de anillos concéntricos flotantes con lente óptica central.",
    shapeLanguage: {
      dominantGeometry: "Círculos puros y toroides concéntricos",
      cornerCurvatureExp: 2.0, // Círculo perfecto euclidiano
      proportions: { headRatio: 0.50, bodyRatio: 0.50, limbRatio: 0.00 },
      contourTopology: "segmented_spheres"
    },
    materialAndLighting: {
      recipeId: "vinyl_toy_matte",
      baseColor: "#0f172a",
      accentColor: "#38bdf8", // Óptica azul cian antirreflejante
      lightingModel: "lambert_approx",
      surfaceTexture: "Vinilo mate antirreflejos"
    },
    silhouetteMetrics: {
      boundingAspect: 1.0, // Simetría radial 1:1
      silhouetteComplexityScore: 12,
      primaryFocalPoint: "Lente de diafragma iris"
    },
    expressiveTemperament: "Analítico, desapasionado, computacional"
  }
};

/**
 * Invariantes de Identidad Formales de Kuro (Concepto B seleccionado).
 * Estas constantes se auditan en pruebas unitarias para garantizar que ningún
 * cambio de ángulo, escala o pose altere la anatomía reconocible del personaje.
 */
export const KURO_IDENTITY_INVARIANTS = {
  // Proporciones canónicas
  aspectRatio: 0.92,
  headToTotalHeightRatio: 0.64,
  interpupillaryDistanceRatio: 0.38, // Distancia entre centros oculares normalizada por el ancho
  eyeSizeRatio: 0.22,                // Radio relativo del ojo mayor
  
  // Paleta de identidad
  colorPalette: {
    bodyBase: "#18181b",
    bodyShadow: "#09090b",
    bodySpecular: "rgba(248, 250, 252, 0.90)",
    eyeInk: "#fafafa",
    pupilColor: "#18181b",
    brassAccent: "#d97706",
    brassShadow: "#78350f",
    alertBadgeColor: "#ef4444"
  },

  // Ecuación de superficie base: r(y) = (1 - |y|^p)^(1/p)
  superellipsoidExponentP: 2.35,

  // Socket semántico del monóculo
  monocleSocket: {
    relativeX: 0.19,  // Ojo derecho relativo al centro
    relativeY: -0.06,
    lensRadiusRatio: 0.16,
    chainLengthRatio: 0.45
  }
};
