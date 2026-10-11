# Soft Character Lighting, Shadows & Physical Presence

Este módulo define las configuraciones ópticas, esquemas lumínicos y técnicas de sombras de contacto para dotar a las mascotas 3D de volumen táctil y presencia física en Three.js.

---

## 1. Esquema de Iluminación de Estudio de 3 Puntos + Rim

Para evitar que los personajes suaves parezcan planos o quemados, se aplica un esquema de iluminación de retrato con cuatro fuentes coordinadas:

1. **Key Light (Luz Principal):**
   - Tipo: `DirectionalLight` con ángulo de $40^\circ$ elevación y $35^\circ$ acimut.
   - Color: Blanco cálido suave (`#fffbeb`, $5500\text{ K}$).
   - Intensidad: $1.2$ a $1.6$.
   - Sombra: `PCFSoftShadowMap` con `bias: -0.0005` y `radius: 3.5` para penumbra suave.

2. **Fill Light (Luz de Relleno):**
   - Tipo: `HemisphereLight` o `DirectionalLight` suave a $-45^\circ$ opuesta a la Key.
   - Color: Tono ambiental sutilmente azulado o complementario (`#f1f5f9` cielo, `#e2e8f0` suelo).
   - Intensidad: $0.4$ a $0.6$ (evita negros puros en las cuencas de los ojos).

3. **Rim / Kicker Light (Luz de Contorno):**
   - Tipo: `DirectionalLight` posterior a $150^\circ$.
   - Función: Resalta el borde exterior de la silueta, encendiendo el efecto *Sheen / Fuzz* del material.
   - Intensidad: $1.5$ a $2.2$.

4. **Catchlight Ocular (Reflejo en Córnea):**
   - Luz puntual focalizada o reflectores virtuales colocados estratégicamente para asegurar que siempre haya una chispa de vida especular en el cuadrante superior de las pupilas.

---

## 2. Sombras de Contacto (Ground Contact Shadow)

Un personaje flotante sin sombra de contacto pierde toda credibilidad física.
* **Técnica Recomendada:** Plano de sombra de contacto con textura radial horneada o renderizado dinámico en un plano transparente con `ShadowMaterial`:
  $$O(r) = \exp\left(-\left(\frac{r}{R_{\text{contact}}}\right)^2\right) \cdot \left(1.0 - \text{clamp}\left(\frac{y_{\text{body}}}{H_{\text{jump}}}, 0, 1\right)\right)$$
* Cuando la mascota salta, la sombra de contacto se expande en radio y se atenúa en opacidad de manera inversamente proporcional a la altura.

---

## 3. Presets Canónicos de Iluminación

1. **`preset_soft_plush_studio` (Mascota Luminosa de Peluche):**
   - Ambiente cálido, rim light generoso, sombras sumamente difusas. Ideal para avatares amigables.
2. **`preset_sculpted_volume` (Estudio Escultórico Art-Toy):**
   - Contraste medio-alto, sombras proyectadas nítidas en la base, resalte especular concentrado.
3. **`preset_fantasy_glow` (Criatura Orgánica Luminosa):**
   - Luz ambiental suave combinada con un punto emisor interno que simula bioluminiscencia o dispersión interna.
4. **`preset_nocturnal_ambient` (Atmósfera Nocturna / Modo Oscuro):**
   - Dominancia de azules oscuros y púrpuras, acento rim cian o ámbar para recortar la silueta contra fondos negros.
5. **`preset_clean_minimalist` (UI / Modo Asistente Desktop):**
   - Luz hemisférica uniforme con sombra de oclusión ambiental pura bajo los pies, sin luces duras que distraigan.
6. **`preset_glossy_pop` (Caramelo / Goma Brillante):**
   - Reflejos HDRI sutiles en los ojos y cuerpo con mapas de entorno de estudio.
