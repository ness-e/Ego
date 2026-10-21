// studio.js — cableado del Robot Studio (ESM vanilla, sin dependencias).
// Motor importado de src/index.js (registra <ego-avatar>); aquí solo UI.
// Adapted from ego-avatar (MIT), repos-referencia/avatar/demo/robot-studio/studio.js

import {
  EgoAvatar,
  VERSION,
  STATES,
  EMOTES,
  STATE_NAMES,
  EMOTE_NAMES,
  HOOK_STATE_MAP,
  SOUND_NAMES,
  MICRO_NAMES,
} from '../../src/index.js';

void EgoAvatar;
void STATES;
void EMOTES;
void STATE_NAMES;
void EMOTE_NAMES;

const $ = (id) => document.getElementById(id);
const face = $('face');
const home = $('home');
const overlay = $('agentOverlay');
const slot = $('slot');
const status = $('status');
const hudApiCall = $('hud-api-call');
const chat = $('chat');
const chatInput = $('chatInput');
const chatSend = $('chatSend');
const buildBadge = $('buildBadge');
const controls = $('controls');
const pointerFollow = $('pointerFollow');
const soundSwitch = $('soundSwitch');
const dock = $('dock');
const dockToggle = $('dockToggle');
const seedInput = $('seedInput');
const segSize = $('segSize');
const segMode = $('segMode');
const motionChk = $('motionChk');
const autoSleepSec = $('autoSleepSec');
const pointerDock = $('pointerDock');
const soundChk = $('soundChk');
const soundVol = $('soundVol');
const soundVolOut = $('soundVolOut');
const soundBtns = $('soundBtns');
const microBtns = $('microBtns');
const hookSel = $('hookSel');
const hookNoReturn = $('hookNoReturn');
const presenceBtns = $('presenceBtns');
const genomeText = $('genomeText');

buildBadge.textContent = `Robot Studio ${VERSION}`;

/* ── píldora de estado (etiquetas en español) ── */
const STATE_ES = {
  idle: 'en reposo',
  thinking: 'pensando',
  working: 'trabajando',
  searching: 'buscando',
  listening: 'escuchando',
  waiting: 'en espera',
  success: 'éxito',
  finished: 'terminado',
  error: 'error',
  ratelimit: 'límite de tasa',
  approval: 'aprobación',
  question: 'pregunta',
  dizzy: 'mareado',
  sleeping: 'durmiendo',
};

face.addEventListener('state-change', (event) => {
  const state = event.detail.state;
  status.textContent = `${state} · ${STATE_ES[state] || 'cambio de estado'}`;
});

/* ── barra flotante: delegación → play() ── */
controls.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-play]');
  if (!btn) return;
  if (hudApiCall) hudApiCall.textContent = `avatar.play('${btn.dataset.play}')`;
  face.play(btn.dataset.play);
});

/* ── interruptores de seguimiento y sonido ── */
function setFollow(on) {
  face.setPointerFollow(on);
  pointerFollow.checked = on;
  pointerDock.checked = on;
}
pointerFollow.addEventListener('change', () => setFollow(pointerFollow.checked));
pointerDock.addEventListener('change', () => setFollow(pointerDock.checked));
setFollow(pointerFollow.checked);

function setSound(on) {
  face.setSoundEnabled(on);
  soundSwitch.checked = on;
  soundChk.checked = on;
}
soundSwitch.addEventListener('change', () => setSound(soundSwitch.checked));
soundChk.addEventListener('change', () => setSound(soundChk.checked));
setSound(true);

soundVol.addEventListener('input', () => {
  const v = face.setSoundVolume(parseFloat(soundVol.value));
  soundVolOut.textContent = Number(v).toFixed(3);
});
soundVolOut.textContent = Number(face.getSoundVolume()).toFixed(3);

/* ── dock en móvil ── */
dockToggle.addEventListener('click', () => {
  const open = dock.classList.toggle('open');
  dockToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
});

/* ── genes: deslizadores genéricos vía data-gene ── */
function fmtVal(input, v) {
  if (input.dataset.fmt === 'int') return String(Math.round(v));
  return String(Math.round(v * 1000) / 1000);
}
function refreshOutput(input) {
  const out = input.closest('.ctl')?.querySelector('output');
  if (out) out.textContent = fmtVal(input, parseFloat(input.value));
}
function getPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}
document.querySelectorAll('#dock [data-gene]').forEach((input) => {
  input.addEventListener('input', () => {
    refreshOutput(input);
    face.setGene(input.dataset.gene, parseFloat(input.value));
  });
});

/* presets de redondez */
document.querySelectorAll('[data-round]').forEach((btn) => {
  btn.addEventListener('click', () => {
    face.setGene('shape.roundness', parseInt(btn.dataset.round, 10));
    syncDockFromGenome();
  });
});

/* presets de tono */
$('huePresets').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-hue]');
  if (!btn) return;
  face.patchGenome({
    palette: { hue: parseInt(btn.dataset.hue, 10), accentHue: parseInt(btn.dataset.accent, 10) },
  });
  syncDockFromGenome();
});

/* marca y apéndice */
$('sel-marking').addEventListener('change', (event) => {
  face.setGene('marking', event.target.value);
});
$('sel-appendage').addEventListener('change', (event) => {
  face.setGene('appendage', event.target.value);
});

/* identidad */
function randomSeed() {
  return `subego:${Math.random().toString(16).slice(2, 8)}`;
}
$('seedApply').addEventListener('click', () => {
  const v = seedInput.value.trim();
  if (!v) return;
  face.setSeed(v);
  syncDockFromGenome();
});
$('seedRandom').addEventListener('click', () => {
  seedInput.value = randomSeed();
  face.setSeed(seedInput.value);
  syncDockFromGenome();
});

/* runtime */
segSize.addEventListener('change', (event) => {
  const radio = event.target.closest('input[name="avatar-size"]');
  if (radio) face.setAttribute('size', radio.value);
});
segMode.addEventListener('change', (event) => {
  const radio = event.target.closest('input[name="avatar-mode"]');
  if (!radio) return;
  face.setMode(radio.value);
  // Despegar/Caja solo existen en el motor canvas
  document.querySelectorAll('[data-studio-only]').forEach((b) => {
    b.disabled = radio.value !== 'studio';
  });
  if (radio.value === 'studio') syncStudioControls();
});
motionChk.addEventListener('change', () => {
  face.setAttribute('motion', motionChk.checked ? 'reduce' : 'auto');
});
autoSleepSec.addEventListener('change', () => {
  const raw = autoSleepSec.value.trim();
  if (raw === '') {
    face.removeAttribute('auto-sleep');
    return;
  }
  const secs = Number(raw);
  if (!Number.isFinite(secs) || secs <= 0) {
    face.setAttribute('auto-sleep', '0');
    return;
  }
  face.setAttribute('auto-sleep', String(Math.round(secs * 1000)));
});

/* sonido: catálogo de 28 botones */
SOUND_NAMES.forEach((name) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.sound = name;
  b.textContent = name;
  soundBtns.appendChild(b);
});
soundBtns.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-sound]');
  if (!btn) return;
  face.playSound(btn.dataset.sound);
});

/* micros: 21 botones */
MICRO_NAMES.forEach((name) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.micro = name;
  b.textContent = name;
  microBtns.appendChild(b);
});
microBtns.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-micro]');
  if (!btn) return;
  face.playMicro(btn.dataset.micro);
});

/* hooks */
Object.keys(HOOK_STATE_MAP).forEach((hook) => {
  const opt = document.createElement('option');
  opt.value = hook;
  opt.textContent = `${hook} → ${HOOK_STATE_MAP[hook]}`;
  hookSel.appendChild(opt);
});
$('hookNotify').addEventListener('click', () => {
  face.notify(hookSel.value, { noAutoReturn: hookNoReturn.checked });
});

/* presencia */
const PRESENCE_OPS = {
  home: () => face.presence.forceHome(),
  compact: () => face.presence.forceCompact(),
  hidden: () => face.presence.forceHidden(),
  launch: () => face.presence.launch(),
};
presenceBtns.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-presence]');
  if (!btn) return;
  PRESENCE_OPS[btn.dataset.presence]?.();
});

/* ── exportar / importar ── */
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
$('expSvg').addEventListener('click', () => {
  // el modo Studio dibuja en canvas: no hay SVG que exportar
  if (face.getMode && face.getMode() === 'studio') {
    status.textContent = 'SVG no disponible en modo Studio (canvas)';
    return;
  }
  download('ego-avatar.svg', face.toSVGString(), 'image/svg+xml');
});
$('expJson').addEventListener('click', () => {
  download('ego-avatar-genome.json', JSON.stringify(face.getGenome(), null, 2), 'application/json');
});
$('copyGenome').addEventListener('click', async () => {
  const text = JSON.stringify(face.getGenome(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    genomeText.value = text;
    genomeText.select();
    document.execCommand('copy');
  }
});
$('resetGenome').addEventListener('click', () => {
  face.resetGenome();
  syncDockFromGenome();
});

/** Aplana un objeto anidado a rutas hoja: {shape:{roundness:80}} → [['shape.roundness', 80]]. */
function flatten(obj, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...flatten(value, path));
    } else {
      out.push([path, value]);
    }
  }
  return out;
}
$('applyGenome').addEventListener('click', () => {
  let parsed;
  try {
    parsed = JSON.parse(genomeText.value);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object') return;
  const patch = {};
  for (const [path, value] of flatten(parsed)) {
    if (path === 'seed') {
      if (typeof value === 'string' && value) {
        seedInput.value = value;
        face.setSeed(value);
      }
      continue;
    }
    if (path === 'markingDetail' || path.startsWith('markingDetail.')) continue;
    const parts = path.split('.');
    let cur = patch;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] && typeof cur[parts[i]] === 'object' ? cur[parts[i]] : {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  face.patchGenome(patch);
  syncDockFromGenome();
});

/* refleja el genoma vivo en los controles del dock */
function syncDockFromGenome() {
  const genome = face.getGenome();
  if (!genome) return;
  document.querySelectorAll('#dock [data-gene]').forEach((input) => {
    const v = getPath(genome, input.dataset.gene);
    if (typeof v === 'number' && Number.isFinite(v)) {
      input.value = String(v);
      refreshOutput(input);
    }
  });
  const marking = $('sel-marking');
  if (typeof genome.marking === 'string') marking.value = genome.marking;
  const appendage = $('sel-appendage');
  if (typeof genome.appendage === 'string') appendage.value = genome.appendage;
}

/* ── chat ── */
let inPanel = false;
let busy = false;
let replyToken = 0;
let heroSize = face.getAttribute('size') || '140';

const replies = [
  { state: 'success', label: 'Expresión · éxito', texts: ['La tarea está terminada y todo salió bien.', 'Listo. El resultado quedó guardado sin errores.', 'Hecho: ejecuté el plan de principio a fin.'] },
  { state: 'warning', label: 'Expresión · aviso', texts: ['Esta acción sobrescribirá contenido existente. ¿Confirmas?', 'Detecté un cambio delicado: revísalo antes de continuar.', 'Voy a tocar archivos importantes. ¿Sigo adelante?'] },
  { state: 'angry', label: 'Expresión · enfado', texts: ['Esa petición choca con mis reglas y no puedo ejecutarla.', 'Lo siento: este contenido está fuera de lo permitido.', 'Operación bloqueada por política. Probemos otra vía.'] },
  { state: 'error', label: 'Expresión · error', texts: ['Falló la conexión con el servicio. Reinténtalo en un momento.', 'Algo salió mal por aquí; no se completó la operación.', 'Error interno: guardé el contexto para diagnosticarlo.'] },
  { state: 'surprise', label: 'Expresión · sorpresa', texts: ['Vaya, encontré algo que no esperaba en los datos.', 'Este resultado me sorprendió: merece una segunda mirada.', 'Inesperado pero interesante. Lo dejo anotado.'] },
  { state: 'waiting', label: 'Expresión · espera', texts: ['Sigo esperando una respuesta externa; dame un momento.', 'La tarea continúa en segundo plano. Te aviso al terminar.', 'Aún no hay novedades: continúo a la espera.'] },
  { state: 'love', label: 'Expresión · cariño', texts: ['¡Me encanta esa idea! Vamos a por ella.', 'Qué buen mensaje. Gracias por compartirlo.', 'Eso me alegra el día. ¿Seguimos?'] },
];

function flipMove(el, destination, newSize) {
  const first = el.getBoundingClientRect();
  destination.appendChild(el);
  el.setAttribute('size', newSize);
  const last = el.getBoundingClientRect();
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;
  const animation = el.animate(
    [
      { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` },
      { transform: 'translate(0,0) scale(1)' },
    ],
    { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' },
  );
  return animation.finished.catch(() => {});
}

async function openAgent() {
  if (inPanel) return;
  inPanel = true;
  heroSize = face.getAttribute('size') || '140';
  face.play('greet');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  await new Promise((resolve) => setTimeout(resolve, 70));
  await flipMove(face, slot, 56);
  chatInput.focus();
  // transición título → último mensaje: parte de arriba y planea al final
  chat.scrollTop = 0;
  scrollChatToEnd(true);
}

function closeAgent() {
  if (!inPanel) return;
  replyToken++;
  busy = false;
  chatSend.disabled = false;
  inPanel = false;
  const first = face.getBoundingClientRect();
  home.insertBefore(face, home.firstChild);
  face.setAttribute('size', heroSize);
  const last = face.getBoundingClientRect();
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;
  face.animate(
    [
      { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` },
      { transform: 'translate(0,0) scale(1)' },
    ],
    { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' },
  );
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  face.reset();
}

function addMessage(role, text, className = '', label = '', state = '') {
  const row = document.createElement('div');
  row.className = `message ${role}${className ? ` ${className}` : ''}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (className.split(' ').includes('typing')) {
    // indicador vivo: tres puntos con rebote escalonado (sin texto fijo)
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'tdot';
      bubble.appendChild(dot);
    }
  } else if (label) {
    const replyText = document.createElement('div');
    replyText.className = 'reply-text';
    replyText.textContent = text;
    bubble.appendChild(replyText);
    const tag = document.createElement('div');
    tag.className = `expression-tag ${state}`;
    tag.textContent = label;
    bubble.appendChild(tag);
  } else {
    bubble.textContent = text;
  }
  row.appendChild(bubble);
  chat.appendChild(row);
  scrollChatToEnd(true);
  return row;
}

/** ¿El usuario prefiere movimiento reducido? (respeta el SO) */
function reduceMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Lleva el chat al último mensaje (suave salvo movimiento reducido). */
function scrollChatToEnd(smooth = true) {
  // doble rAF: mide tras el layout definitivo (la fila ya existe y el
  // typing saliente ya colapsó), y overflow-anchor:none en CSS evita que el
  // anclaje del navegador pelee con este scroll programado
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      chat.scrollTo({ top: chat.scrollHeight, behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
    } catch {
      chat.scrollTop = chat.scrollHeight;
    }
  }));
}

function chooseReply() {
  const group = replies[Math.floor(Math.random() * replies.length)];
  return {
    state: group.state,
    label: group.label,
    text: group.texts[Math.floor(Math.random() * group.texts.length)],
  };
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || busy) return;
  const token = ++replyToken;
  busy = true;
  chatSend.disabled = true;
  addMessage('user', text);
  chatInput.value = '';
  face.reset();
  await face.play('send');
  if (token !== replyToken || !inPanel) return;

  const typing = addMessage('agent', '', 'typing');
  await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 900));
  if (token !== replyToken || !inPanel) return;
  // transición último → nuevo: el typing se funde y la respuesta emerge
  typing.classList.add('leaving');
  await new Promise((resolve) => setTimeout(resolve, reduceMotion() ? 0 : 180));
  if (token !== replyToken || !inPanel) return;
  typing.remove();
  scrollChatToEnd(true); // re-ancla tras colapsar el typing saliente
  const reply = chooseReply();
  face.play(reply.state);
  addMessage('agent', reply.text, '', reply.label, reply.state);
  busy = false;
  chatSend.disabled = false;
  chatInput.focus({ preventScroll: true });
}

face.addEventListener('dblclick', openAgent);
$('closeAgent').addEventListener('click', closeAgent);
overlay.addEventListener('click', (event) => {
  if (event.target === overlay) closeAgent();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && inPanel) closeAgent();
});

chatInput.addEventListener('input', () => {
  if (!busy && chatInput.value.length && face.getState() === 'idle') face.play('input');
});
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
chatSend.addEventListener('click', sendMessage);

/* ── Studio (modo canvas): presets, estilos, voz, colores y física ── */
function studioParams() {
  try {
    return typeof face.getStudioParams === 'function' ? face.getStudioParams() : null;
  } catch {
    return null;
  }
}

/* deslizadores genéricos: todo input[type=range][data-sp] → setStudioParam */
document.querySelectorAll('#dock input[type="range"][data-sp]').forEach((input) => {
  input.addEventListener('input', () => {
    const out = input.closest('.ctl')?.querySelector('output');
    if (out) out.textContent = String(parseFloat(input.value));
    face.setStudioParam(input.dataset.sp, parseFloat(input.value));
  });
});

/* presets fieles */
let currentPreset = 'cx-faithful';
document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (face.applyStudioPreset(btn.dataset.preset)) {
      currentPreset = btn.dataset.preset;
      status.textContent = `preset studio · ${btn.dataset.preset}`;
      syncStudioControls();
    }
  });
});

/* restablecer = re-aplicar el preset vigente; micro aleatorio ahora */
$('btnResetPreset').addEventListener('click', () => {
  if (face.applyStudioPreset(currentPreset)) {
    status.textContent = `preset studio · ${currentPreset} (restablecido)`;
    syncStudioControls();
  }
});
$('btnRandomMicro').addEventListener('click', () => {
  const name = MICRO_NAMES[Math.floor(Math.random() * MICRO_NAMES.length)];
  if (face.playMicro(name)) status.textContent = `micro · ${name}`;
});

/* estilos de ojo / boca / accesorio */
$('eyeStyleBtns').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-eyes]');
  if (!btn) return;
  face.setStudioParam('eyeStyle', btn.dataset.eyes);
  syncStudioControls();
});
$('mouthStyleBtns').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-mouth]');
  if (!btn) return;
  face.setStudioParam('mouthStyle', btn.dataset.mouth);
  syncStudioControls();
});
$('accBtns').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-acc]');
  if (!btn) return;
  face.setStudioParam('accessory', btn.dataset.acc);
  syncStudioControls();
});

/* voz: hablar + re-sincronía de boca (speak auto-cambia mouthStyle) */
function speakFromInput() {
  const text = $('speechText').value.trim();
  if (!text) return;
  face.speak(text, Math.min(6, Math.max(2.4, text.length * 0.065)));
  setTimeout(syncStudioControls, 300);
}
$('speakBtn').addEventListener('click', speakFromInput);
$('speechText').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') speakFromInput();
});

/* colores: pickers + swatches */
function bindColor(pickerId, key) {
  $(pickerId).addEventListener('input', (event) => {
    face.setStudioParam(key, event.target.value);
    syncStudioControls();
  });
}
bindColor('bodyColorPick', 'bodyColor');
bindColor('visorColorPick', 'visorColor');
bindColor('eyeColorPick', 'eyeColor');
document.querySelectorAll('[data-body]').forEach((btn) => {
  btn.addEventListener('click', () => {
    face.setStudioParam('bodyColor', btn.dataset.body);
    syncStudioControls();
  });
});
document.querySelectorAll('[data-visor]').forEach((btn) => {
  btn.addEventListener('click', () => {
    face.setStudioParam('visorColor', btn.dataset.visor);
    syncStudioControls();
  });
});
document.querySelectorAll('[data-eye]').forEach((btn) => {
  btn.addEventListener('click', () => {
    face.setStudioParam('eyeColor', btn.dataset.eye);
    syncStudioControls();
  });
});

/* interruptores booleanos + ciclo de manos */
$('tglVisor').addEventListener('click', () => {
  face.setStudioParam('showVisor', !face.getStudioParam('showVisor'));
  syncStudioControls();
});
$('tglPods').addEventListener('click', () => {
  face.setStudioParam('showSidePods', !face.getStudioParam('showSidePods'));
  syncStudioControls();
});
$('tglAutoColor').addEventListener('click', () => {
  face.setStudioParam('autoStateColors', !face.getStudioParam('autoStateColors'));
  syncStudioControls();
});
$('handsCycle').addEventListener('click', () => {
  const order = ['auto', 'always', 'hidden'];
  const cur = face.getStudioParam('handsMode');
  const next = order[(order.indexOf(cur) + 1 + order.length) % order.length] || 'auto';
  face.setStudioParam('handsMode', next);
  syncStudioControls();
});

/* refleja los params vivos del Studio en todos sus controles */
function syncStudioControls() {
  const p = studioParams();
  if (!p) return; // modo SVG: sin host studio, se omite en silencio
  document.querySelectorAll('#eyeStyleBtns [data-eyes]').forEach((b) => {
    b.classList.toggle('active', b.dataset.eyes === p.eyeStyle);
  });
  document.querySelectorAll('#mouthStyleBtns [data-mouth]').forEach((b) => {
    b.classList.toggle('active', b.dataset.mouth === p.mouthStyle);
  });
  document.querySelectorAll('#accBtns [data-acc]').forEach((b) => {
    b.classList.toggle('active', b.dataset.acc === p.accessory);
  });
  document.querySelectorAll('#dock input[type="range"][data-sp]').forEach((input) => {
    const v = p[input.dataset.sp];
    if (typeof v === 'number' && Number.isFinite(v)) {
      input.value = String(v);
      const out = input.closest('.ctl')?.querySelector('output');
      if (out) out.textContent = String(v);
    }
  });
  const setPicker = (id, v) => {
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) $(id).value = v;
  };
  setPicker('bodyColorPick', p.bodyColor);
  setPicker('visorColorPick', p.visorColor);
  setPicker('eyeColorPick', p.eyeColor);
  document.querySelectorAll('[data-body]').forEach((b) => {
    b.classList.toggle('active', b.dataset.body === p.bodyColor);
  });
  document.querySelectorAll('[data-visor]').forEach((b) => {
    b.classList.toggle('active', b.dataset.visor === p.visorColor);
  });
  document.querySelectorAll('[data-eye]').forEach((b) => {
    b.classList.toggle('active', b.dataset.eye === p.eyeColor);
  });
  const tglVisor = $('tglVisor');
  tglVisor.textContent = `Visor: ${p.showVisor ? 'ON' : 'OFF'}`;
  tglVisor.classList.toggle('active', !!p.showVisor);
  const tglPods = $('tglPods');
  tglPods.textContent = `Orejas: ${p.showSidePods ? 'ON' : 'OFF'}`;
  tglPods.classList.toggle('active', !!p.showSidePods);
  const tglAuto = $('tglAutoColor');
  tglAuto.textContent = `Color estado: ${p.autoStateColors ? 'ON' : 'OFF'}`;
  tglAuto.classList.toggle('active', !!p.autoStateColors);
  const handsLabels = { auto: 'Manos: Auto', always: 'Manos: Fijas', hidden: 'Manos: Ocultas' };
  const hands = $('handsCycle');
  hands.textContent = handsLabels[p.handsMode] || 'Manos: Auto';
  hands.classList.toggle('active', p.handsMode !== 'hidden');
  const pill = $('handsPill');
  if (pill) pill.textContent = `✋ ${handsLabels[p.handsMode] || 'Manos: Auto'}`;
  const dim = $('dimensions-pill');
  if (dim) {
    const pct = (v) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—');
    const num = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—');
    dim.textContent = `📐 Ancho: ${pct(p.bodyWidthRatio)} · Alto: ${pct(p.bodyHeightRatio)} · n=${num(p.squircleN)} · Escala: ${num(p.userScale, 2)}x`;
  }
}

/* ── HUD superior: giro, hablar, zen ── */
$('hudSpin').addEventListener('click', () => {
  face.playMicro('roll');
});
$('hudTalk').addEventListener('click', () => {
  const input = $('speechText');
  const text = (input && input.value.trim()) || '¡Hola! Soy tu avatar.';
  face.speak(text, Math.min(6, Math.max(2.4, text.length * 0.065)));
  setTimeout(syncStudioControls, 300);
});
function setZen(on) {
  document.body.classList.toggle('zen', on);
  $('exitZen').hidden = !on;
}
$('hudZen').addEventListener('click', () => setZen(true));
$('exitZen').addEventListener('click', () => setZen(false));

/* estado inicial */
syncDockFromGenome();
syncStudioControls();
/* Despegar/Caja solo existen en el motor canvas */
(function gateStudioOnly() {
  const studio = face.getMode ? face.getMode() === 'studio' : true;
  document.querySelectorAll('[data-studio-only]').forEach((b) => {
    b.disabled = !studio;
  });
})();
/* el backend canvas carga perezoso: re-sincroniza al estar listo */
setTimeout(syncStudioControls, 900);
