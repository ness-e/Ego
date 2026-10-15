import { describe, it, expect, vi } from "vitest";
import {
  ACTION_SOUND,
  EMOTE_SOUND,
  FloatingSound,
  SOUND_DEFAULT_VOLUME,
  SOUND_IDLE_SUSPEND_MS,
  SOUND_NAMES,
  SOUND_VOLUME_BOUNDS,
  STATE_SOUND,
  createFloatingSound,
  hasAudioSupport,
  soundFor,
  type AvatarSoundEngine,
  type FloatingSoundEngineOptions,
} from "../floating/floating-sound.js";

function fakeEngine(): AvatarSoundEngine & { calls: string[] } {
  const calls: string[] = [];
  let volume = SOUND_DEFAULT_VOLUME;
  let enabled = true;
  return {
    calls,
    play: (name: string) => {
      calls.push(`play:${name}`);
      return true;
    },
    setVolume: (v: number) => {
      calls.push(`setVolume:${v}`);
      volume = v;
      return volume;
    },
    getVolume: () => volume,
    setEnabled: (on: boolean) => {
      calls.push(`setEnabled:${on}`);
      enabled = on;
    },
    isEnabled: () => enabled,
    idle: () => {
      calls.push("idle");
    },
    resume: () => {
      calls.push("resume");
    },
    dispose: () => {
      calls.push("dispose");
    },
  };
}

describe("Task8: sound map (D3, COUC-20 procedural)", () => {
  it("approval->approval, error->error (contrato plan Step 1)", () => {
    expect(soundFor("hitl_approval")).toBe("approval");
    expect(soundFor("error")).toBe("error");
  });

  it("cubre el mapa del plan: work/finish/question/approve/think/search/rate/sleep", () => {
    expect(soundFor("expanded")).toBe("work");
    expect(soundFor("finished")).toBe("finish");
    expect(soundFor("question")).toBe("question");
    expect(soundFor("approve")).toBe("approve");
    expect(soundFor("compact")).toBe("think");
    expect(soundFor("searching")).toBe("search");
    expect(soundFor("ratelimit")).toBe("rate");
    expect(soundFor("sleeping")).toBe("sleep");
    expect(soundFor("alert")).toBe("approval");
  });

  it("UI chrome: open/close/hover/peek passthrough, desconocido->blip", () => {
    expect(soundFor("open")).toBe("open");
    expect(soundFor("close")).toBe("close");
    expect(soundFor("hover")).toBe("hover");
    expect(soundFor("peek")).toBe("peek");
    expect(soundFor("hidden")).toBe("blip");
    expect(soundFor("narnia-no-existe")).toBe("blip");
  });
});

describe("Task8: constantes avatar (28 recetas, volumen, idle)", () => {
  it("SOUND_NAMES tiene los 28 literales de coucou", () => {
    expect(SOUND_NAMES).toHaveLength(28);
    expect([...SOUND_NAMES]).toContain("approval");
    expect([...SOUND_NAMES]).toContain("think");
    expect([...SOUND_NAMES]).toContain("sleep");
  });

  it("volumen 0.12 bounds [0,0.2], idle 1500 ms", () => {
    expect(SOUND_DEFAULT_VOLUME).toBe(0.12);
    expect([...SOUND_VOLUME_BOUNDS]).toEqual([0, 0.2]);
    expect(SOUND_IDLE_SUSPEND_MS).toBe(1500);
  });

  it("STATE/EMOTE/ACTION tablas presentes (envoltorio sound.js)", () => {
    expect(STATE_SOUND["approval"]).toBe("approval");
    expect(STATE_SOUND["thinking"]).toBe("think");
    expect(EMOTE_SOUND["love"]).toBe("love");
    expect(ACTION_SOUND["success"]).toBe("finish");
    expect(ACTION_SOUND["approve"]).toBe("approve");
  });

  it("NUNCA binarios WAV: ningun nombre ni tabla referencia .wav", () => {
    expect(JSON.stringify([...SOUND_NAMES])).not.toMatch(/\.wav/i);
    expect(JSON.stringify({ STATE_SOUND, EMOTE_SOUND, ACTION_SOUND })).not.toMatch(
      /\.wav/i,
    );
  });
});

describe("Task8: wrapper createSoundEngine (muted/no-op)", () => {
  it("envuelve createSoundEngine: delega play y propaga volumen/idleMs", () => {
    const engine = fakeEngine();
    const createEngine = vi.fn(
      (_opts: FloatingSoundEngineOptions) => engine,
    );
    const snd = createFloatingSound({
      muted: false,
      masterVolume: 0.12,
      createEngine,
    });
    expect(createEngine).toHaveBeenCalledTimes(1);
    expect(createEngine).toHaveBeenCalledWith(
      expect.objectContaining({ masterVolume: 0.12, idleMs: 1500 }),
    );
    expect(snd.play("approval")).toBe(true);
    expect(engine.calls).toContain("play:approval");
    expect(snd.playFor("hitl_approval")).toBe(true);
    expect(engine.calls).toContain("play:approval");
  });

  it("muted->no-op: no toca el motor y retorna false", () => {
    const engine = fakeEngine();
    const snd = createFloatingSound({
      muted: true,
      createEngine: () => engine,
    });
    expect(snd.isMuted()).toBe(true);
    expect(snd.audible).toBe(false);
    expect(snd.play("approval")).toBe(false);
    expect(snd.playFor("hitl_approval")).toBe(false);
    expect(engine.calls.filter((c) => c.startsWith("play:"))).toHaveLength(0);
    // setMuted(true) en caliente tambien corta el sonido.
    const live = createFloatingSound({ createEngine: () => engine });
    live.setMuted(true);
    expect(live.play("error")).toBe(false);
  });

  it("sin AudioContext->no-op: sin fabrica ni contexto nunca lanza", () => {
    const hadAudio =
      typeof (globalThis as Record<string, unknown>)["AudioContext"] !==
        "undefined" ||
      typeof (globalThis as Record<string, unknown>)["webkitAudioContext"] !==
        "undefined";
    if (hadAudio) {
      expect(hasAudioSupport()).toBe(true);
      return;
    }
    expect(hasAudioSupport()).toBe(false);
    const snd = new FloatingSound({});
    expect(() => snd.play("approval")).not.toThrow();
    expect(() => snd.playFor("hitl_approval")).not.toThrow();
    expect(snd.play("approval")).toBe(false);
    expect(snd.playFor("hitl_approval")).toBe(false);
    expect(snd.audible).toBe(false);
    expect(() => {
      snd.idle();
      snd.resume();
      snd.dispose();
    }).not.toThrow();
  });

  it("fabrica que lanza -> degrada a no-op en vez de romper el flotante", () => {
    const snd = createFloatingSound({
      createEngine: () => {
        throw new Error("denegado por autoplay");
      },
    });
    expect(snd.audible).toBe(false);
    expect(snd.play("approval")).toBe(false);
  });

  it("setVolume respeta el clamp canonico [0,0.2]", () => {
    const engine = fakeEngine();
    const snd = createFloatingSound({ createEngine: () => engine });
    expect(snd.setVolume(99)).toBe(0.2);
    expect(snd.setVolume(-5)).toBe(0);
    expect(snd.getVolume()).toBe(0);
  });
});
