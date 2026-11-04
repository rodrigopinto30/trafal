import { describe, expect, it } from "vitest";
import { MessageSyntaxError, formatMessage, formatRich } from "./format";

describe("formatMessage", () => {
  it("devuelve el texto tal cual si no hay argumentos", () => {
    expect(formatMessage("Hola mundo", "es")).toBe("Hola mundo");
  });

  it("reemplaza variables", () => {
    expect(formatMessage("Hola, {name}", "es", { name: "Valen" })).toBe("Hola, Valen");
  });

  it("formatea números según el idioma", () => {
    expect(formatMessage("{n} partidas", "es", { n: 1234 })).toBe("1234 partidas".replace("1234", new Intl.NumberFormat("es").format(1234)));
    expect(formatMessage("{n} plays", "en", { n: 1234567 })).toBe("1,234,567 plays");
  });

  it("falla con un mensaje claro si falta una variable", () => {
    expect(() => formatMessage("Hola, {name}", "es")).toThrow(/name/);
  });

  describe("plurales", () => {
    const message = "{count, plural, =0 {Sin juegos} one {# juego} other {# juegos}}";

    it("elige la categoría correcta en español", () => {
      expect(formatMessage(message, "es", { count: 0 })).toBe("Sin juegos");
      expect(formatMessage(message, "es", { count: 1 })).toBe("1 juego");
      expect(formatMessage(message, "es", { count: 2 })).toBe("2 juegos");
      expect(formatMessage(message, "es", { count: 1500 })).toBe(`${new Intl.NumberFormat("es").format(1500)} juegos`);
    });

    it("elige la categoría correcta en inglés", () => {
      const en = "{count, plural, one {# follower} other {# followers}}";
      expect(formatMessage(en, "en", { count: 1 })).toBe("1 follower");
      expect(formatMessage(en, "en", { count: 0 })).toBe("0 followers");
      expect(formatMessage(en, "en", { count: 2 })).toBe("2 followers");
    });

    it("la opción exacta (=N) gana sobre la categoría", () => {
      expect(formatMessage("{n, plural, =1 {uno exacto} one {uno} other {otros}}", "en", { n: 1 })).toBe("uno exacto");
    });

    it("exige un número", () => {
      expect(() => formatMessage(message, "es", { count: "tres" })).toThrow(/número/);
    });

    it("permite variables dentro de las opciones", () => {
      expect(formatMessage("{n, plural, one {{who} tiene # amigo} other {{who} tiene # amigos}}", "es", { n: 3, who: "Ana" })).toBe(
        "Ana tiene 3 amigos",
      );
    });
  });

  describe("select", () => {
    const message = "{kind, select, game {Juego} post {Avance} other {Otro}}";
    it("elige por valor y cae en other", () => {
      expect(formatMessage(message, "es", { kind: "game" })).toBe("Juego");
      expect(formatMessage(message, "es", { kind: "post" })).toBe("Avance");
      expect(formatMessage(message, "es", { kind: "xyz" })).toBe("Otro");
    });
  });

  describe("etiquetas", () => {
    it("en texto plano se descartan y queda el contenido", () => {
      expect(formatMessage("Aceptás los <terms>Términos</terms>.", "es")).toBe("Aceptás los Términos.");
    });

    it("con renderizadores devuelve fragmentos", () => {
      const chunks = formatRich<string>("Aceptás los <terms>Términos</terms> y la <b>Privacidad</b>.", "es", {}, {
        terms: (c) => `[${c.join("")}]`,
        b: (c) => `*${c.join("")}*`,
      });
      expect(chunks.join("")).toBe("Aceptás los [Términos] y la *Privacidad*.");
    });

    it("las etiquetas pueden contener variables", () => {
      const out = formatRich<string>("Te mandamos un link a <strong>{email}</strong>.", "es", { email: "a@b.com" }, {
        strong: (c) => `**${c.join("")}**`,
      });
      expect(out.join("")).toBe("Te mandamos un link a **a@b.com**.");
    });
  });

  describe("errores de sintaxis", () => {
    it("detecta una llave sin cerrar", () => {
      expect(() => formatMessage("Hola {name", "es", { name: "x" })).toThrow(MessageSyntaxError);
    });
    it("exige la opción other", () => {
      expect(() => formatMessage("{n, plural, one {# cosa}}", "es", { n: 1 })).toThrow(/other/);
    });
    it("detecta una etiqueta sin cerrar", () => {
      expect(() => formatMessage("<b>negrita", "es")).toThrow(MessageSyntaxError);
    });
  });
});
