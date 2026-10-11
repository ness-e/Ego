# Soft Character Asset Pipeline & Blender-to-Three.js Bridge

Este módulo documenta el flujo de trabajo reproducible desde el concepto hasta la integración final en tiempo real en Three.js y React Three Fiber.

---

## 1. El Pipeline Profesional de 14 Etapas

```
 1. Brief & Dirección de Arte
    └─> 2. Generación de Conceptos Divergentes (3 propuestas)
        └─> 3. Aprobación de Silueta & Invariantes
            └─> 4. Modelado de Geometría Base (Blender / Procedural)
                └─> 5. Retopología & UV Packing sin costuras
                    └─> 6. Materiales PBR & Pruebas de Fuzz/Sheen
                        └─> 7. Iluminación de Estudio de Revisión
                            └─> 8. Rigging Nodal & Morph Targets
                                └─> 9. Calibración de 20 Expresiones Faciales
                                    └─> 10. Coreografía de 10 Actuaciones
                                        └─> 11. Optimización & LODs
                                            └─> 12. Exportación glTF / GLB
                                                └─> 13. Integración en Three.js Runtime
                                                    └─> 14. Validación en Quality Lab (Sin Regresiones)
```

---

## 2. Compatibilidad y Advertencias Blender -> glTF

1. **Sistemas de Pelo de Blender (Hair Curves):**
   - **Limitación:** Las curvas de pelo de Blender *Geometry Nodes* NO se exportan directamente a glTF estándar.
   - **Solución:** Convertir a mallas de tarjetas (*Hair Cards*) o utilizar el shader procedural de *Shell Fur* en el frontend Three.js.
2. **Materiales Principled BSDF:**
   - La propiedad *Sheen* de Blender 4.x se exporta a la extensión oficial `KHR_materials_sheen`.
   - La dispersión subsuperficial (*Subsurface*) se mapea a `KHR_materials_subsurface` o `KHR_materials_transmission`.
   - Asegurarse de que el `GLTFLoader` de Three.js tenga activadas las extensiones KHR correspondientes.
3. **Escalas y Ejes:**
   - Blender usa $Z$-up, glTF y Three.js usan $Y$-up. Siempre aplicar rotación y escala (`Ctrl+A -> All Transforms`) antes de exportar.
