/**
 * Formateador de mensajes mínimo, compatible con la parte de ICU MessageFormat que usamos:
 *
 *   "Hola, {name}"
 *   "{count, plural, =0 {Sin juegos} one {# juego} other {# juegos}}"
 *   "{kind, select, game {Juego} post {Avance} other {Otro}}"
 *   "Aceptás los <terms>Términos</terms> y la <privacy>Privacidad</privacy>"
 *
 * Se escribió a mano (en vez de traer intl-messageformat) para no sumar ~17 kB al JS del navegador y
 * porque Cache Components nos obliga a resolver el idioma sin `headers()`. Es framework-agnóstico: la
 * versión con React vive en translator.tsx.
 */

export type Primitive = string | number | boolean | Date | null | undefined;
export type Values = Record<string, Primitive>;

type Node =
  | { t: "text"; v: string }
  | { t: "arg"; name: string }
  | { t: "pound" }
  | { t: "plural"; name: string; offset: number; cases: Record<string, Node[]> }
  | { t: "select"; name: string; cases: Record<string, Node[]> }
  | { t: "tag"; name: string; children: Node[] };

export class MessageSyntaxError extends Error {
  constructor(message: string, source: string, position: number) {
    super(`${message} (posición ${position} en «${source}»)`);
    this.name = "MessageSyntaxError";
  }
}

const parseCache = new Map<string, Node[]>();

export function parse(source: string): Node[] {
  const cached = parseCache.get(source);
  if (cached) return cached;

  let i = 0;

  const fail = (message: string): never => {
    throw new MessageSyntaxError(message, source, i);
  };

  const skipSpaces = () => {
    while (i < source.length && /\s/.test(source[i] as string)) i++;
  };

  function parseNodes(stop: { brace: boolean; tag?: string }, inPlural: boolean): Node[] {
    const nodes: Node[] = [];
    let text = "";
    const flush = () => {
      if (text) {
        nodes.push({ t: "text", v: text });
        text = "";
      }
    };

    while (i < source.length) {
      const ch = source[i] as string;

      if (ch === "{") {
        flush();
        i++;
        nodes.push(parseArgument(inPlural));
        continue;
      }
      if (ch === "}") {
        if (stop.brace) break;
        fail("Llave de cierre sin abrir");
      }
      if (ch === "<") {
        if (source.startsWith("</", i)) {
          if (stop.tag !== undefined) break;
          fail("Etiqueta de cierre sin abrir");
        }
        const open = /^<([A-Za-z][\w-]*)>/.exec(source.slice(i));
        if (open) {
          flush();
          const name = open[1] as string;
          i += open[0].length;
          const children = parseNodes({ brace: false, tag: name }, inPlural);
          const close = `</${name}>`;
          if (!source.startsWith(close, i)) fail(`Falta ${close}`);
          i += close.length;
          nodes.push({ t: "tag", name, children });
          continue;
        }
      }
      if (ch === "#" && inPlural) {
        flush();
        nodes.push({ t: "pound" });
        i++;
        continue;
      }
      text += ch;
      i++;
    }
    flush();
    return nodes;
  }

  function parseArgument(inPlural: boolean): Node {
    const readUntil = (chars: string): string => {
      const start = i;
      while (i < source.length && !chars.includes(source[i] as string)) i++;
      return source.slice(start, i).trim();
    };

    const name = readUntil(",}");
    if (!name) fail("Argumento sin nombre");
    if (source[i] === "}") {
      i++;
      return { t: "arg", name };
    }
    i++; // ","
    const kind = readUntil(",}");
    if (kind !== "plural" && kind !== "select") fail(`Tipo de argumento no soportado: «${kind}»`);
    if (source[i] !== ",") fail(`Faltan las opciones de «${kind}»`);
    i++;

    let offset = 0;
    skipSpaces();
    const offsetMatch = /^offset:\s*(\d+)/.exec(source.slice(i));
    if (offsetMatch) {
      offset = Number.parseInt(offsetMatch[1] as string, 10);
      i += offsetMatch[0].length;
    }

    const cases: Record<string, Node[]> = {};
    for (;;) {
      skipSpaces();
      if (source[i] === "}") {
        i++;
        break;
      }
      const selector = readUntil(" \t\n{}");
      if (!selector) fail("Opción vacía");
      skipSpaces();
      if (source[i] !== "{") fail(`Falta «{» después de «${selector}»`);
      i++;
      cases[selector] = parseNodes({ brace: true }, inPlural || kind === "plural");
      if (source[i] !== "}") fail(`Falta «}» al final de «${selector}»`);
      i++;
    }
    if (!("other" in cases)) fail(`«${name}» necesita una opción «other»`);

    return kind === "plural" ? { t: "plural", name, offset, cases } : { t: "select", name, cases };
  }

  const nodes = parseNodes({ brace: false }, false);
  if (i < source.length) fail("Texto sin procesar");
  parseCache.set(source, nodes);
  return nodes;
}

export type TagRenderers<R> = Record<string, (chunks: (string | R)[]) => R>;

type Context<R> = {
  locale: string;
  values: Values;
  tags: TagRenderers<R> | undefined;
  /** Número del plural más cercano, para reemplazar el «#». */
  pound: number | undefined;
};

function formatValue(value: Primitive, locale: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return new Intl.NumberFormat(locale).format(value);
  if (value instanceof Date) return new Intl.DateTimeFormat(locale).format(value);
  return String(value);
}

function evaluate<R>(nodes: Node[], ctx: Context<R>): (string | R)[] {
  const out: (string | R)[] = [];
  const push = (chunks: (string | R)[]) => {
    for (const chunk of chunks) {
      const last = out[out.length - 1];
      // Une texto contiguo para devolver pocos fragmentos.
      if (typeof chunk === "string" && typeof last === "string") {
        out[out.length - 1] = last + chunk;
      } else {
        out.push(chunk);
      }
    }
  };

  for (const node of nodes) {
    switch (node.t) {
      case "text":
        push([node.v]);
        break;
      case "arg": {
        if (!(node.name in ctx.values)) {
          throw new Error(`Falta el valor «${node.name}» para el mensaje`);
        }
        push([formatValue(ctx.values[node.name], ctx.locale)]);
        break;
      }
      case "pound":
        push([ctx.pound === undefined ? "#" : new Intl.NumberFormat(ctx.locale).format(ctx.pound)]);
        break;
      case "plural": {
        const raw = ctx.values[node.name];
        if (typeof raw !== "number") {
          throw new Error(`«${node.name}» debe ser un número para el plural`);
        }
        const n = raw - node.offset;
        const exact = node.cases[`=${raw}`];
        const category = new Intl.PluralRules(ctx.locale).select(n);
        const chosen = exact ?? node.cases[category] ?? (node.cases["other"] as Node[]);
        push(evaluate(chosen, { ...ctx, pound: n }));
        break;
      }
      case "select": {
        const key = String(ctx.values[node.name] ?? "");
        const chosen = node.cases[key] ?? (node.cases["other"] as Node[]);
        push(evaluate(chosen, ctx));
        break;
      }
      case "tag": {
        const children = evaluate(node.children, ctx);
        const render = ctx.tags?.[node.name];
        if (render) {
          out.push(render(children));
        } else {
          // Sin renderizador, la etiqueta se ignora y queda su contenido (texto plano).
          push(children.map((c) => (typeof c === "string" ? c : String(c))));
        }
        break;
      }
    }
  }
  return out;
}

/** Texto plano: las etiquetas se descartan y queda su contenido. */
export function formatMessage(source: string, locale: string, values: Values = {}): string {
  return evaluate<never>(parse(source), { locale, values, tags: undefined, pound: undefined }).join("");
}

/** Con etiquetas: devuelve una lista de fragmentos (texto y lo que devuelvan los renderizadores). */
export function formatRich<R>(
  source: string,
  locale: string,
  values: Values = {},
  tags: TagRenderers<R> = {},
): (string | R)[] {
  return evaluate<R>(parse(source), { locale, values, tags, pound: undefined });
}
