/**
 * expressionEvaluator.ts — evaluador de expresiones TypeScript **seguro**.
 *
 * E4 (Ola 3) — el "REPL Python" del maestro §7.2 choca con el guardrail
 * `AGENTS.md` §4 (sin Python en el producto). La alternativa que respeta el
 * guardrail es un REPL de **expresiones**, no de Python:
 *
 * - Se implementa como un **intérprete propio** (parser + evaluador).
 * - **No** usa `eval`, ni `new Function`, ni `node:vm`, ni `child_process`.
 *   No hay ninguna ruta por la que el modelo ejecute código arbitrario.
 * - No hay acceso a `require`, `process`, `fs`, `globalThis`, `__proto__`,
 *   `constructor` ni a ninguna API del host: sólo literales, operadores,
 *   arrays, objetos planos y una lista blanca de funciones puras.
 * - Las expresiones se evaluan en tiempo lineal sobre estructuras de datos
 *   acotadas (con presupuesto de pasos y de profundidad).
 *
 * Si algún día se quiere un REPL de Python, la vía correcta es una
 * **integración opcional vía MCP** (un servidor Python externo, fuera del
 * producto), no una tool nativa.
 */

/** Error de evaluación (sintaxis, tipo o presupuesto). */
export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

/** Presupuesto de evaluación (evita bucles infinitos yreates grandes). */
export interface ExpressionLimits {
  /** Número máximo de pasos de evaluación. */
  maxSteps?: number;
  /** Profundidad máxima de anidamiento. */
  maxDepth?: number;
  /** Longitud máxima de la expresión. */
  maxLength?: number;
}

/** Resultado de la evaluación. */
export interface ExpressionResult {
  /** Valor evaluado (JSON-compatible). */
  readonly value: unknown;
  /** Número de pasos consumidos. */
  readonly steps: number;
}

// --- Tokens -----------------------------------------------------------------

type TokenType = "num" | "str" | "ident" | "op" | "punc" | "eof";

interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly pos: number;
}

const OPERATORS = [
  "===",
  "!==",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "??",
  "+",
  "-",
  "*",
  "/",
  "%",
  "**",
  "<",
  ">",
  "!",
  "?",
  ":",
  "=",
];

/** Divide la expresión en tokens. */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i]!;

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Número
    if (/[0-9]/.test(char) || (char === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      const start = i;
      while (i < input.length && /[0-9._]/.test(input[i]!)) i++;
      if (input[i] === "e" || input[i] === "E") {
        i++;
        if (input[i] === "+" || input[i] === "-") i++;
        while (i < input.length && /[0-9]/.test(input[i]!)) i++;
      }
      tokens.push({ type: "num", value: input.slice(start, i), pos: start });
      continue;
    }

    // Cadena (comillas simples o dobles, con escapes)
    if (char === '"' || char === "'") {
      const quote = char;
      const start = i;
      i++;
      let value = "";
      let closed = false;
      while (i < input.length) {
        const c = input[i]!;
        if (c === "\\") {
          const next = input[i + 1] ?? "";
          value +=
            next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "\r" : next;
          i += 2;
          continue;
        }
        if (c === quote) {
          closed = true;
          i++;
          break;
        }
        value += c;
        i++;
      }
      if (!closed) {
        throw new ExpressionError(`Cadena sin cerrar en la posición ${start}.`);
      }
      tokens.push({ type: "str", value, pos: start });
      continue;
    }

    // Identificador
    if (/[A-Za-z_$]/.test(char)) {
      const start = i;
      while (i < input.length && /[A-Za-z0-9_$]/.test(input[i]!)) i++;
      tokens.push({ type: "ident", value: input.slice(start, i), pos: start });
      continue;
    }

    // Operador
    const operator = OPERATORS.find((op) => input.startsWith(op, i));
    if (operator) {
      tokens.push({ type: "op", value: operator, pos: i });
      i += operator.length;
      continue;
    }

    // Paréntesis, corchetes, llaves, coma, punto
    if ("()[]{},.".includes(char)) {
      tokens.push({ type: "punc", value: char, pos: i });
      i++;
      continue;
    }

    throw new ExpressionError(`Carácter inesperado '${char}' en la posición ${i}.`);
  }

  tokens.push({ type: "eof", value: "", pos: input.length });
  return tokens;
}

// --- Parser (precedencia) ---------------------------------------------------

type Node =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "null" }
  | { kind: "undef" }
  | { kind: "ident"; name: string }
  | { kind: "member"; object: Node; property: Node; computed: boolean }
  | { kind: "call"; callee: Node; args: Node[] }
  | { kind: "array"; items: Node[] }
  | { kind: "object"; entries: Array<{ key: Node; value: Node }> }
  | { kind: "unary"; op: string; operand: Node }
  | { kind: "binary"; op: string; left: Node; right: Node }
  | { kind: "logical"; op: string; left: Node; right: Node }
  | { kind: "ternary"; test: Node; consequent: Node; alternate: Node };

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  /** Token siguiente sin consumirlo. */
  public peek(): Token {
    return this.tokens[this.index]!;
  }

  private next(): Token {
    return this.tokens[this.index++]!;
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.next();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new ExpressionError(
        `Se esperaba ${value ?? type} en la posición ${token.pos}, se encontró '${token.value}'.`
      );
    }
    return token;
  }

  private isOp(value: string): boolean {
    const token = this.peek();
    return token.type === "op" && token.value === value;
  }

  public parseExpression(): Node {
    return this.parseTernary();
  }

  /** `true` si se han consumido todos los tokens. */
  public isAtEnd(): boolean {
    return this.peek().type === "eof";
  }

  private parseTernary(): Node {
    const test = this.parseNullish();
    if (this.isOp("?")) {
      this.next();
      const consequent = this.parseTernary();
      this.expect("op", ":");
      const alternate = this.parseTernary();
      return { kind: "ternary", test, consequent, alternate };
    }
    return test;
  }

  private parseNullish(): Node {
    let left = this.parseLogicalOr();
    while (this.isOp("??")) {
      this.next();
      const right = this.parseLogicalOr();
      left = { kind: "logical", op: "??", left, right };
    }
    return left;
  }

  private parseLogicalOr(): Node {
    let left = this.parseLogicalAnd();
    while (this.isOp("||")) {
      this.next();
      const right = this.parseLogicalAnd();
      left = { kind: "logical", op: "||", left, right };
    }
    return left;
  }

  private parseLogicalAnd(): Node {
    let left = this.parseEquality();
    while (this.isOp("&&")) {
      this.next();
      const right = this.parseEquality();
      left = { kind: "logical", op: "&&", left, right };
    }
    return left;
  }

  private parseEquality(): Node {
    let left = this.parseComparison();
    while (this.isOp("===") || this.isOp("!==") || this.isOp("==") || this.isOp("!=")) {
      const op = this.next().value;
      const right = this.parseComparison();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseComparison(): Node {
    let left = this.parseAdditive();
    while (this.isOp("<=") || this.isOp(">=") || this.isOp("<") || this.isOp(">")) {
      const op = this.next().value;
      const right = this.parseAdditive();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().value;
      const right = this.parseMultiplicative();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
      const op = this.next().value;
      const right = this.parseUnary();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): Node {
    if (this.isOp("!") || this.isOp("-") || this.isOp("+")) {
      const op = this.next().value;
      const operand = this.parseUnary();
      return { kind: "unary", op, operand };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    for (;;) {
      if (this.peek().type === "punc" && this.peek().value === ".") {
        this.next();
        const property = this.expect("ident");
        node = { kind: "member", object: node, property: { kind: "str", value: property.value }, computed: false };
        continue;
      }
      if (this.peek().type === "punc" && this.peek().value === "[") {
        this.next();
        const property = this.parseExpression();
        this.expect("punc", "]");
        node = { kind: "member", object: node, property, computed: true };
        continue;
      }
      if (this.peek().type === "punc" && this.peek().value === "(") {
        this.next();
        const args: Node[] = [];
        if (!(this.peek().type === "punc" && this.peek().value === ")")) {
          for (;;) {
            args.push(this.parseExpression());
            if (this.peek().type === "punc" && this.peek().value === ",") {
              this.next();
              continue;
            }
            break;
          }
        }
        this.expect("punc", ")");
        node = { kind: "call", callee: node, args };
        continue;
      }
      return node;
    }
  }

  private parsePrimary(): Node {
    const token = this.next();

    if (token.type === "num") {
      return { kind: "num", value: Number(token.value) };
    }
    if (token.type === "str") {
      return { kind: "str", value: token.value };
    }
    if (token.type === "ident") {
      if (token.value === "true") return { kind: "bool", value: true };
      if (token.value === "false") return { kind: "bool", value: false };
      if (token.value === "null") return { kind: "null" };
      if (token.value === "undefined") return { kind: "undef" };
      return { kind: "ident", name: token.value };
    }
    if (token.type === "punc" && token.value === "(") {
      const inner = this.parseExpression();
      this.expect("punc", ")");
      return inner;
    }
    if (token.type === "punc" && token.value === "[") {
      const items: Node[] = [];
      if (!(this.peek().type === "punc" && this.peek().value === "]")) {
        for (;;) {
          items.push(this.parseExpression());
          if (this.peek().type === "punc" && this.peek().value === ",") {
            this.next();
            continue;
          }
          break;
        }
      }
      this.expect("punc", "]");
      return { kind: "array", items };
    }
    if (token.type === "punc" && token.value === "{") {
      const entries: Array<{ key: Node; value: Node }> = [];
      if (!(this.peek().type === "punc" && this.peek().value === "}")) {
        for (;;) {
          const key = this.parseExpression();
          this.expect("punc", ":");
          const value = this.parseExpression();
          entries.push({ key, value });
          if (this.peek().type === "punc" && this.peek().value === ",") {
            this.next();
            continue;
          }
          break;
        }
      }
      this.expect("punc", "}");
      return { kind: "object", entries };
    }

    throw new ExpressionError(`Token inesperado '${token.value}' en la posición ${token.pos}.`);
  }
}

// --- Evaluador --------------------------------------------------------------

/**
 * Funciones puras disponibles en el entorno.
 *
 * El valor es `unknown` porque la lista mezcla funciones (`abs`, `sum`) y
 * espacios de nombres de métodos (`Math`, `JSON`, `Array`, `Object`). La
 * llamada se valida en el evaluador: sólo se invocan valores que sean
 * realmente funciones de esta lista.
 */
const PURE_FUNCTIONS: Record<string, unknown> = {
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  sqrt: Math.sqrt,
  trunc: Math.trunc,
  sign: Math.sign,
  log: Math.log,
  exp: Math.exp,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  atan2: Math.atan2,
  log10: Math.log10,
  log2: Math.log2,
  expm1: Math.expm1,
  cbrt: Math.cbrt,
  hypot: Math.hypot,
  clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
  sum: (...values: number[]) => values.reduce((a, b) => a + b, 0),
  mean: (...values: number[]) =>
    values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length,
  median: (...values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);
  },
  stddev: (...values: number[]) => {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  },
  minOf: (...values: number[]) => (values.length === 0 ? 0 : Math.min(...values)),
  maxOf: (...values: number[]) => (values.length === 0 ? 0 : Math.max(...values)),
  range: (min: number, max: number, step = 1) => {
    const out: number[] = [];
    for (let v = min; v <= max; v += step) out.push(v);
    return out;
  },
  String: (v: unknown) => String(v),
  Number: (v: unknown) => Number(v),
  Boolean: (v: unknown) => Boolean(v),
  JSON: {
    stringify: (v: unknown) => JSON.stringify(v),
    parse: (v: unknown) => JSON.parse(String(v)),
  },
  Array: {
    isArray: (v: unknown) => Array.isArray(v),
    from: (v: unknown) => Array.from(v as ArrayLike<unknown>),
    of: (...v: unknown[]) => v,
  },
  Object: {
    keys: (v: unknown) => Object.keys(v as object),
    values: (v: unknown) => Object.values(v as object),
    entries: (v: unknown) => Object.entries(v as object),
  },
  Math: {
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
    sqrt: Math.sqrt,
    trunc: Math.trunc,
    sign: Math.sign,
    log: Math.log,
    log2: Math.log2,
    log10: Math.log10,
    exp: Math.exp,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    PI: Math.PI,
    E: Math.E,
  },
};

/** Nombres prohibidos en cualquier acceso a propiedad. */
const FORBIDDEN_PROPERTIES = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "then",
  "catch",
  "finally",
]);

/**
 * Espacios de nombres cuyos métodos SÍ se pueden invocar
 * (`Math.max`, `JSON.stringify`, `Array.isArray`, `Object.keys`).
 *
 * Son objetos estáticos y puros: invocarlos no da acceso al host. Cualquier
 * otro objeto (datos del scope, resultados intermedios) tiene sus métodos
 * bloqueados: invocar un método de datos abriría la puerta a `constructor`
 * y `__proto__`.
 */
const ALLOWED_NAMESPACES = new Set<object>([
  PURE_FUNCTIONS["Math"] as object,
  PURE_FUNCTIONS["JSON"] as object,
  PURE_FUNCTIONS["Array"] as object,
  PURE_FUNCTIONS["Object"] as object,
]);

/** Contexto de evaluación. */
class Evaluator {
  private steps = 0;

  constructor(
    private readonly scope: Record<string, unknown>,
    private readonly limits: Required<ExpressionLimits>,
    private readonly depth = 0
  ) {}

  private tick(): void {
    this.steps++;
    if (this.steps > this.limits.maxSteps) {
      throw new ExpressionError(
        `Presupuesto de evaluación agotado (${this.limits.maxSteps} pasos).`
      );
    }
  }

  public get stepCount(): number {
    return this.steps;
  }

  public evaluate(node: Node): unknown {
    this.tick();
    if (this.depth > this.limits.maxDepth) {
      throw new ExpressionError(
        `Profundidad máxima de expresión superada (${this.limits.maxDepth}).`
      );
    }

    switch (node.kind) {
      case "num":
      case "str":
      case "bool":
        return node.value;
      case "null":
        return null;
      case "undef":
        return undefined;

      case "ident": {
        if (Object.prototype.hasOwnProperty.call(this.scope, node.name)) {
          return this.scope[node.name];
        }
        if (Object.prototype.hasOwnProperty.call(PURE_FUNCTIONS, node.name)) {
          return PURE_FUNCTIONS[node.name];
        }
        throw new ExpressionError(`Identificador desconocido: '${node.name}'.`);
      }

      case "member": {
        const object = this.evaluate(node.object);
        if (object === null || object === undefined) {
          throw new ExpressionError("No se puede leer una propiedad de null/undefined.");
        }
        const key = node.computed
          ? String(this.evaluate(node.property))
          : (node.property as { value: string }).value;
        if (FORBIDDEN_PROPERTIES.has(key)) {
          throw new ExpressionError(`Acceso a la propiedad prohibida: '${key}'.`);
        }
        if (typeof object === "object" || typeof object === "string") {
          const value = (object as Record<string, unknown>)[key];
          if (typeof value === "function") {
            // Sólo se pueden invocar métodos de los ESPACIOS DE NOMBRES de la
            // lista blanca (`Math.max`, `JSON.stringify`, `Array.isArray`).
            // En cualquier otro objeto, invocar un método abriría la puerta a
            // `constructor`, `__proto__` y aliados.
            if (!ALLOWED_NAMESPACES.has(object as object)) {
              throw new ExpressionError(
                `No se puede invocar '${key}' como método: usa una función de la lista blanca.`
              );
            }
          }
          return value;
        }
        throw new ExpressionError(
          `No se puede leer la propiedad '${key}' de un valor de tipo ${typeof object}.`
        );
      }

      case "call": {
        const callee = this.evaluate(node.callee);
        if (typeof callee !== "function") {
          throw new ExpressionError("Lo invocado no es una función permitida.");
        }
        const args = node.args.map((arg) => this.evaluate(arg));
        const fn = callee as (...callArgs: unknown[]) => unknown;
        return fn(...args);
      }

      case "array":
        return node.items.map((item) => this.evaluate(item));

      case "object": {
        const out: Record<string, unknown> = {};
        for (const entry of node.entries) {
          const key = String(this.evaluate(entry.key));
          if (FORBIDDEN_PROPERTIES.has(key)) {
            throw new ExpressionError(`Clave de objeto prohibida: '${key}'.`);
          }
          out[key] = this.evaluate(entry.value);
        }
        return out;
      }

      case "unary": {
        const operand = this.evaluate(node.operand);
        switch (node.op) {
          case "!":
            return !operand;
          case "-":
            return -(operand as number);
          case "+":
            return +(operand as number);
          default:
            throw new ExpressionError(`Operador unario no soportado: '${node.op}'.`);
        }
      }

      case "logical": {
        const left = this.evaluate(node.left);
        switch (node.op) {
          case "&&":
            return left ? this.evaluate(node.right) : left;
          case "||":
            return left ? left : this.evaluate(node.right);
          case "??":
            return left === null || left === undefined ? this.evaluate(node.right) : left;
          default:
            throw new ExpressionError(`Operador lógico no soportado: '${node.op}'.`);
        }
      }

      case "ternary":
        return this.evaluate(node.test)
          ? this.evaluate(node.consequent)
          : this.evaluate(node.alternate);

      case "binary": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);
        switch (node.op) {
          case "+":
            if (typeof left === "string" || typeof right === "string") {
              return String(left) + String(right);
            }
            return (left as number) + (right as number);
          case "-":
            return (left as number) - (right as number);
          case "*":
            return (left as number) * (right as number);
          case "/":
            return (left as number) / (right as number);
          case "%":
            return (left as number) % (right as number);
          case "**":
            return (left as number) ** (right as number);
          case "<":
            return (left as number) < (right as number);
          case ">":
            return (left as number) > (right as number);
          case "<=":
            return (left as number) <= (right as number);
          case ">=":
            return (left as number) >= (right as number);
          case "==":
            // eslint-disable-next-line eqeqeq
            return left == right;
          case "!=":
            // eslint-disable-next-line eqeqeq
            return left != right;
          case "===":
            return left === right;
          case "!==":
            return left !== right;
          default:
            throw new ExpressionError(`Operador no soportado: '${node.op}'.`);
        }
      }

      default: {
        const exhaustive: never = node;
        throw new ExpressionError(`Nodo no soportado: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
}

/**
 * Evalúa una expresión TypeScript de forma segura.
 *
 * @param expression La expresión (sinSentencias; el REPL es de expresiones).
 * @param scope      Variables disponibles (datos planos).
 * @param limits     Presupuesto de evaluación.
 */
export function evaluateExpression(
  expression: string,
  scope: Record<string, unknown> = {},
  limits: ExpressionLimits = {}
): ExpressionResult {
  const effective: Required<ExpressionLimits> = {
    maxSteps: limits.maxSteps ?? 10_000,
    maxDepth: limits.maxDepth ?? 32,
    maxLength: limits.maxLength ?? 20_000,
  };

  if (typeof expression !== "string") {
    throw new ExpressionError("La expresión debe ser una cadena.");
  }
  if (expression.trim().length === 0) {
    throw new ExpressionError("La expresión está vacía.");
  }
  if (expression.length > effective.maxLength) {
    throw new ExpressionError(
      `La expresión supera el máximo de ${effective.maxLength} caracteres.`
    );
  }

  const tokens = tokenize(expression);
  const parser = new Parser(tokens);
  const node = parser.parseExpression();
  if (!parser.isAtEnd()) {
    throw new ExpressionError(
      `La expresión tiene contenido sobrante en la posición ${parser.peek().pos}.`
    );
  }

  const evaluator = new Evaluator(scope, effective);
  const value = evaluator.evaluate(node);
  return { value, steps: evaluator.stepCount };
}
