# Aesthetic Taxonomy & Operational Visual Styles

Este documento formaliza una biblioteca enciclopédica y operativa de direcciones artísticas, traduciendo cada estilo a decisiones concretas de geometría, shaders, paletas, cámaras y movimiento.

---

## 1. Estilos de Ilustración y Gráficos 2D por Código

```
Estilo Visual              Características Clave de Construcción en Código                    Técnica Recomendada
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Flat & Bauhaus             Geometría euclidiana pura (círculo, rectángulo, triángulo 45°).     SVG nativo en React,
                           Cero gradientes, paleta primaria estricta (rojo, azul, amarillo).   cero filtros de desenfoque.

Ilustración Editorial      Líneas con grosores modulados, siluetas asimétricas sofisticadas,   SVG con curvas Bézier
                           espacios negativos amplios, grano fino textural de fondo.           cúbicas y feTurbulence sutil.

Rubber Hose (Vintage)      Extremidades curvadas de radio continuo sin codos visibles,          SVG / Canvas 2D con
                           ojos estilo "pie-eye" (cuña recortada), animación a 12 FPS.         morphing de trazados.

Risografía & Serigrafía    Paleta limitada de 2 a 3 tintas planas con registro imperfecto      SVG feColorMatrix con
                           (*misregistration offset* de 1-2px) y tramado de semitono.          desfase de capas de canal.

Grabado & Linóleo          Líneas de hachurado (*cross-hatching*) paralelas que siguen la      Canvas 2D / Shaders GLSL con
                           curvatura del volumen; monocromía de alto contraste.                patrones de líneas angulares.

Pixel Art & Dithered       Resolución ultra-baja (32×32 a 64×64) escalada con nearest-neighbor, Canvas 2D `image-rendering:
                           paletas indexadas de 16 colores y dithering con matriz de Bayer.     pixelated`, matriz 4x4.
```

---

## 2. Estilos 3D de Fabricación Táctil y Materialidad Física

En lugar del plástico CG por defecto, los personajes deben adoptar materialidades físicas memorables:

### 2.1. Claymation / Arcilla Artesanal ("Clay Render")
- **Geometría**: Volúmenes orgánicos suavizados con ligeras asimetrías y micro-abolladuras procedurales mediante desplazamiento de vértices por ruido simplex.
- **Material**: `roughness = 0.88`, `metalness = 0.0`, textura sutil de huellas dactilares mediante micro-bump mapping analítico.
- **Animación**: Velocidad de refresco escalonada a 12 FPS (*on-twos*) para simular animación artesanal fotograma a fotograma.

### 2.2. Origami y Paper Craft (Papel Plegado Facetado)
- **Geometría**: Superficies no curvas; mallas `BufferGeometry` compuestas exclusivamente por caras planas triangulares y cuadrangulares con normales planas (*Flat Shading* forzado).
- **Material**: Papel mate con grano fibroso fino (`roughness = 0.95`), translúcido a contraluz (*transmission = 0.25*).
- **Iluminación**: Luz rasante dura para proyectar sombras nítidas entre los pliegues de papel.

### 2.3. Vidrio Ahumado y Cristal Facetado
- **Material**: `MeshPhysicalMaterial` con `transmission = 0.92`, `roughness = 0.08`, `ior = 1.54` (vidrio borosilicatado), dispersión cromática interna y núcleo interior opaco visible a través de la refracción.

### 2.4. Fieltro y Tejido Textil ("Needle Felted")
- **Material**: Sombreado de terciopelo (*Velvet / Peach Fuzz*) mediante un shader Fresnel invertido que ilumina los bordes rasantes con micro-fibras suaves, complementado con una paleta cálida y difusa.

---

## 3. Estéticas Digitales y Experimentales

| Dirección Artística | Claves Visuales | Construcción Técnica | Contexto Ideal de Uso |
|---|---|---|---|
| **Solarpunk** | Fusión de curvas botánicas, latón dorado pulido, madera clara y paneles de vidrio verde. | Mallas orgánicas con acentos metálicos reflectantes y shaders de fotosíntesis. | Productos de sostenibilidad, energía limpia, finanzas éticas. |
| **Brutalismo Digital** | Tipografía masiva monoespaciada, geometrías cúbicas monolíticas de hormigón/pizarra, wireframe visible. | Prismas ortogonales con aristas biseladas mínimas, blanco y negro puro con un acento ácido. | Herramientas de infraestructura, terminales CLI, ciberseguridad. |
| **Terminal / CRT Retro** | Pantalla monocroma verde fósforo o ámbar, líneas de escaneo (*scanlines*), curvatura de tubo catódico. | Shaders GLSL de post-procesado con distorsión en barril y bloom de fósforo. | DevOps, emuladores, plataformas de hacking ético. |
| **Arte Generativo / SDF** | Formas fluidas matemáticamente puras generadas por funciones de distancia firmada (*Raymarching*). | Shaders de pantalla completa evaluando SDFs con transformaciones no euclidianas. | Experiencias inmersivas WebGL de vanguardia. |

---

## 4. El Poder de los Estilos Híbridos

Las identidades visuales más memorables surgen de cruzar dos mundos aparentemente incompatibles:

```
[ Concepto Tradicional ]    x    [ Tratamiento Tecnológico ]    =    [ Identidad Híbrida Memorable ]
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
Escultura de Arcilla               Núcleo Lumínico Emisivo           Un golem de barro interactivo con
modelada a mano.                   de datos en el pecho.             grietas por donde late energía digital.

Pliegues geométricos               Física reactiva de resorte        Un animal de papel kraft que se
de Origami de papel.               y seguimiento de cursor.          despliega al respirar y mirar al puntero.

Grabado clásico en                 Interactividad SVG por DOM        Un centinela con tramas de grabado antiguo
madera (Linograbado).              reactiva al scroll y hover.       cuyas líneas vibran al pasar el cursor.
```
Esta hibridación elimina de raíz la sensación de "muñeco 3D genérico de plantilla".
