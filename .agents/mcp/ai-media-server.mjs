#!/usr/bin/env node
// ai-media-server.mjs — MCP stdio server: imagenes, texto y GIF gratis.
// Sin API key, sin login, sin dependencias (Node >= 20 trae fetch).
//   imagenes -> image.pollinations.ai (modelo anonimo: sana)
//   texto    -> text.pollinations.ai   (modelo anonimo: openai-fast / GPT-OSS 20B)
//   gif      -> N frames + ffmpeg local (ya instalado)
// Salida por stdout SOLO protocolo JSON-RPC; logs a stderr.
import { createInterface } from 'node:readline';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const execFileP = promisify(execFile);
const OUT_DIR = resolve(process.env.AI_OUT_DIR || join(homedir(), 'ai-out'));
const IMG_API = 'https://image.pollinations.ai/prompt/';
const TXT_API = 'https://text.pollinations.ai/';

export function imageUrl(prompt, { width = 1024, height = 1024, model = 'sana', seed = 0, nologo = 'true' } = {}) {
  const q = new URLSearchParams({ width, height, model, seed, nologo });
  return IMG_API + encodeURIComponent(String(prompt).slice(0, 1500)) + '?' + q;
}
export function textUrl(prompt, model = 'openai-fast') {
  return TXT_API + encodeURIComponent(String(prompt).slice(0, 4000)) + '?model=' + encodeURIComponent(model);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ponytail: la capa anonima de Pollinations devuelve 402/429 a rafagas; backoff exponencial.
// Si alguna vez hay API key, sustituir esto por el endpoint gen.pollinations.ai autenticado.
async function fetchImage(prompt, opts, tries = 8) {
  let wait = 3000;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(imageUrl(prompt, opts));
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) throw new Error('imagen vacia o demasiado pequena');
      return buf;
    }
    const body = (await res.text()).slice(0, 160).replace(/\s+/g, ' ');
    if (res.status !== 402 && res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}: ${body}`);
    if (i === tries - 1) throw new Error(`HTTP ${res.status} tras ${tries} intentos (cuota anonima agotada): ${body}`);
    process.stderr.write(`reintento ${i + 1} en ${wait}ms (HTTP ${res.status})\n`);
    await sleep(wait);
    wait = Math.min(wait * 2, 30000);
  }
}

async function saveImage(prompt, opts, file) {
  const buf = await fetchImage(prompt, opts);
  await mkdir(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, file);
  await writeFile(path, buf);
  return { path, bytes: buf.length };
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';

const TOOLS = [
  {
    name: 'generate_image',
    description: 'Genera una imagen desde texto y la guarda en disco. Gratis, sin API key. Modelo anonimo: sana.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Descripcion de la imagen' },
        width: { type: 'integer', default: 1024 },
        height: { type: 'integer', default: 1024 },
        seed: { type: 'integer', default: 0, description: 'Cambialo para variar la misma prompt' },
        model: { type: 'string', default: 'sana' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_text',
    description: 'Genera texto (copy, posts, borradores) con LLM gratis y sin API key. Modelo anonimo: openai-fast (GPT-OSS 20B).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        model: { type: 'string', default: 'openai-fast' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_gif',
    description: 'Genera un GIF animado: N imagenes con semillas distintas + ffmpeg local. Gratis, sin API key.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        frames: { type: 'integer', default: 8, description: '2-30' },
        fps: { type: 'integer', default: 6 },
        width: { type: 'integer', default: 384 },
        height: { type: 'integer', default: 384 },
      },
      required: ['prompt'],
    },
  },
];

async function callTool(name, a = {}) {
  if (name === 'generate_image') {
    const p = (a.width | 0) || 1024, q = (a.height | 0) || 1024;
    const { path, bytes } = await saveImage(a.prompt, { width: p, height: q, model: a.model || 'sana', seed: a.seed ?? 0 }, `${stamp()}-${slug(a.prompt)}.jpg`);
    return `Imagen generada (${p}x${q}, ${(bytes / 1024).toFixed(0)} KB):\n${path}`;
  }
  if (name === 'generate_text') {
    const res = await fetch(textUrl(a.prompt, a.model || 'openai-fast'));
    if (!res.ok) throw new Error(`texto HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.text()).trim();
  }
  if (name === 'generate_gif') {
    const frames = Math.min(Math.max(a.frames | 0 || 8, 2), 30);
    const fps = Math.min(Math.max(a.fps | 0 || 6, 1), 24);
    const w = (a.width | 0) || 384, h = (a.height | 0) || 384;
    const tmp = join(OUT_DIR, `.frames-${stamp()}`);
    await mkdir(tmp, { recursive: true });
    for (let i = 0; i < frames; i++) {
      const buf = await fetchImage(`${a.prompt}, frame ${i + 1} of ${frames}, slight variation`, { width: w, height: h, model: 'sana', seed: 1000 + i });
      await writeFile(join(tmp, `${String(i).padStart(3, '0')}.jpg`), buf);
      if (i < frames - 1) await sleep(1500);
    }
    const out = join(OUT_DIR, `${stamp()}-${slug(a.prompt)}.gif`);
    // ponytail: paleta por defecto de ffmpeg; anadir palettegen/paletteuse si aparece banding.
    await execFileP('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(tmp, '%03d.jpg'), '-loop', '0', out]);
    await rm(tmp, { recursive: true, force: true });
    return `GIF generado (${frames} frames, ${fps} fps, ${w}x${h}):\n${out}`;
  }
  throw new Error(`tool desconocida: ${name}`);
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const text = (id, s) => send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: s }] } });
const fail = (id, e) => send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${e.message || e}` }], isError: true } });

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return send({ jsonrpc: '2.0', id, result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'ai-media', version: '1.0.0' },
      instructions: 'Generacion gratis de imagen, texto y GIF sin API key. Salida en ' + OUT_DIR,
    } });
  }
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  if (method === 'tools/call') {
    try { return text(id, await callTool(params?.name, params?.arguments)); }
    catch (e) { return fail(id, e); }
  }
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method no soportado: ${method}` } });
}

if (process.argv.includes('--selftest')) {
  const u = imageUrl('a red cat', { width: 256, height: 256 });
  console.assert(u.startsWith(IMG_API) && u.includes('width=256') && u.includes('nologo=true'), 'imageUrl rota');
  console.assert(textUrl('hi there').includes('hi%20there'), 'textUrl rota');
  console.assert(slug('Neon City!! 2099') === 'neon-city-2099', 'slug roto');
  console.log('selftest ok ->', u.slice(0, 90) + '...');
  process.exit(0);
} else {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => { const s = line.trim(); if (!s) return; try { handle(JSON.parse(s)); } catch (e) { process.stderr.write(`parse: ${e.message}\n`); } });
  process.stderr.write(`ai-media MCP listo (salida: ${OUT_DIR})\n`);
}
