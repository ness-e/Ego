// Los paquetes del AI SDK son ESM-only ("type": "module", sin condicion require).
// Nuestro dist es CJS, asi que un import estatico compila a require() y rompe
// Electron main (Node 20) con ERR_REQUIRE_ESM. import() nativo se preserva
// verbatim bajo module NodeNext: carga perezosa una sola vez, con cache.
const cache = new Map<string, Promise<unknown>>();

export function loadEsm<T>(specifier: string): Promise<T> {
  let p = cache.get(specifier) as Promise<T> | undefined;
  if (!p) {
    p = import(specifier) as Promise<T>;
    cache.set(specifier, p);
  }
  return p;
}
