# Soft Character Conversation Performance & Voice Sync

Este módulo define la interacción multimodal durante conversaciones de voz o texto con el usuario.

---

## 1. Modulación Labial y Corporal por Amplitud de Audio

Cuando no se dispone de un analizador fonético de visemas complejo, la sincronización se resuelve mediante el envolvente RMS de amplitud de audio:

```typescript
export interface AudioPerformanceDriver {
  rmsAmplitude: number;     // [0, 1] Volumen instantáneo normalizado
  spectralCentroid: number; // Agudos vs Graves
  isUserSpeaking: boolean;
  isAgentSpeaking: boolean;
}
```

* **Apertura de Boca por Amplitud:**
  $$\text{mouthOpen}(t) = \text{clamp}\left(0, 1, 1.4 \cdot \text{rmsAmplitude}(t)\right)$$
* **Micro-cabeceo Sincronizado:** Durante el habla del agente, pequeñas sacudidas verticales de cabeza ($\pm 0.05\text{ rad}$) acompañan los picos de volumen rítmicos, emulando la cadencia del discurso.

---

## 2. Modos de Conversación

1. **Modo Escucha Activa (*Listening*):**
   - El personaje inclina la cabeza hacia el usuario ($+12^\circ$ Roll), abre ligeramente los ojos y orienta una oreja hacia adelante.
   - Si el usuario hace una pausa larga, asiente sutilmente para indicar recepción.
2. **Modo Procesamiento / Pensando (*Thinking*):**
   - La mirada sube hacia el cuadrante superior derecho ($-0.3\text{ Pitch}, +0.4\text{ Yaw}$), el cuerpo realiza una suave respiración y las orejas oscilan en cadencia reflexiva.
3. **Modo Respuesta (*Speaking*):**
   - Contacto visual intermitente (70% al usuario, 30% a puntos neutros), modulación labial por amplitud y gestos de énfasis en las manos/cuerpo.
