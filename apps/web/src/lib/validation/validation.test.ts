import { describe, expect, it } from "vitest";
import {
  AUTH_FORM_ERROR_KEYS,
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  resetPasswordSchema,
  signupSchema,
} from "./auth";
import { parseLocale, parseLoginError, parseNextPath, parseUsernameParam } from "./common";
import {
  ONBOARDING_FORM_ERROR_KEYS,
  SETTINGS_FORM_ERROR_KEYS,
  followSchema,
  onboardingSchema,
  preferencesSchema,
  updateProfileSchema,
  usernameSchema,
} from "./profile";
import { byteLength, charLength, fieldErrorsFrom, sanitizeLine, sanitizeMultiline } from "./text";
import es from "@/messages/es.json";
import en from "@/messages/en.json";

describe("sanitizeLine", () => {
  it("recorta y junta espacios", () => {
    expect(sanitizeLine("  Valen   Ruiz \n")).toBe("Valen Ruiz");
  });
  it("saca caracteres de control y saltos de línea", () => {
    expect(sanitizeLine("Va\u0000len\tRuiz\r\nok")).toBe("Va len Ruiz ok");
  });
  it("saca los caracteres invisibles y de dirección que sirven para falsificar nombres", () => {
    // RLO (U+202E) hace que «Admin» se vea invertido; ZWSP (U+200B) y BOM (U+FEFF) no se ven.
    expect(sanitizeLine("\u202EAdmin\u200B\uFEFF")).toBe("Admin");
    expect(sanitizeLine("a\u2066b\u2069c")).toBe("abc");
  });
  it("conserva emojis compuestos (ZWJ) y acentos, y unifica la forma Unicode", () => {
    expect(sanitizeLine("👨‍👩‍👧 Familia")).toBe("👨‍👩‍👧 Familia");
    expect(sanitizeLine("Café")).toBe("Café"); // e + acento combinado → é
  });
});

describe("sanitizeMultiline", () => {
  it("conserva los saltos de línea pero limita las líneas en blanco", () => {
    expect(sanitizeMultiline("hola\r\n\r\n\r\n\r\nchau")).toBe("hola\n\nchau");
  });
  it("saca espacios al final de cada línea y controles", () => {
    expect(sanitizeMultiline("uno   \ndos\u0000")).toBe("uno\ndos");
  });
  it("también saca los invisibles", () => {
    expect(sanitizeMultiline("\u202Ehola")).toBe("hola");
  });
});

describe("charLength / byteLength", () => {
  it("cuenta como Postgres: un emoji es un carácter", () => {
    expect("😀".length).toBe(2);
    expect(charLength("😀")).toBe(1);
    expect(charLength("ñ")).toBe(1);
  });
  it("cuenta bytes en UTF-8", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("ñ")).toBe(2);
    expect(byteLength("😀")).toBe(4);
  });
});

describe("emailSchema", () => {
  it("normaliza a minúsculas y sin espacios", () => {
    expect(emailSchema.parse("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  it.each(["", "nope", "a@", "@b.com", "a b@c.com", `${"x".repeat(250)}@a.com`])("rechaza %j", (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("acepta 8+ caracteres con letras y números", () => {
    expect(passwordSchema.safeParse("Trafal12345").success).toBe(true);
  });
  it.each(["corta1", "sololetrasaa", "12345678", ""])("rechaza %j", (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });
  it("cuenta bytes: 72 bytes como máximo (bcrypt ignora el resto)", () => {
    expect(passwordSchema.safeParse("a1".repeat(36)).success).toBe(true); // 72 bytes
    expect(passwordSchema.safeParse("a1".repeat(36) + "x").success).toBe(false); // 73
    // 36 letras «ñ» = 36 caracteres pero 72 bytes, más un dígito = 73 bytes
    expect(passwordSchema.safeParse("ñ".repeat(35) + "a1x").success).toBe(false);
  });
  it("no recorta ni normaliza la contraseña", () => {
    const result = passwordSchema.safeParse("  Trafal1  ");
    expect(result.success && result.data).toBe("  Trafal1  ");
  });
});

describe("signupSchema", () => {
  const valid = { email: "Nueva@Trafal.test", password: "Trafal12345", confirm: "Trafal12345", consent: true };

  it("acepta datos válidos y normaliza el email", () => {
    const result = signupSchema.safeParse(valid);
    expect(result.success && result.data.email).toBe("nueva@trafal.test");
  });
  it("exige que la confirmación coincida", () => {
    const result = signupSchema.safeParse({ ...valid, confirm: "Trafal12346" });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.map((i) => [i.path[0], i.message])).toEqual([["confirm", "passwordsDontMatch"]]);
  });
  it("exige la casilla de 18+ y términos", () => {
    const result = signupSchema.safeParse({ ...valid, consent: false });
    expect(!result.success && result.error.issues.map((i) => [i.path[0], i.message])).toEqual([["consent", "consentRequired"]]);
  });
  it("informa a la vez contraseña débil y confirmación distinta", () => {
    const result = signupSchema.safeParse({ ...valid, password: "corta", confirm: "otra" });
    const fields = !result.success ? result.error.issues.map((i) => i.path[0]) : [];
    expect(fields).toContain("password");
    expect(fields).toContain("confirm");
  });
  it("exige repetir la contraseña", () => {
    const result = signupSchema.safeParse({ ...valid, confirm: "" });
    expect(result.success).toBe(false);
  });
});

describe("login / olvidé mi contraseña / reset", () => {
  it("login exige email válido y alguna contraseña", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "no", password: "x" }).success).toBe(false);
  });
  it("login NO exige fortaleza (la cuenta puede ser anterior a la regla)", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
  it("forgot exige un email válido", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });
  it("reset exige contraseña fuerte y que coincida", () => {
    expect(resetPasswordSchema.safeParse({ password: "Trafal12345", confirm: "Trafal12345" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "Trafal12345", confirm: "x" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "debil", confirm: "debil" }).success).toBe(false);
  });
});

describe("usernameSchema y onboardingSchema", () => {
  it.each([
    ["rodri", "rodri"],
    ["  Sofía_Dev ", "sofia_dev"],
    ["ÑANDÚ", "nandu"],
    ["_oculto_", "_oculto_"],
    ["a__b", "a__b"],
  ])("acepta %j y lo guarda como %j", (input, stored) => {
    const result = usernameSchema.safeParse(input);
    expect(result.success && result.data).toBe(stored);
  });
  it.each(["", "ab", "con espacio", "con-guion", "abc.", ".abc", "a..b", "___", "x".repeat(31), "emoji😀"])("rechaza %j", (input) => {
    const result = usernameSchema.safeParse(input);
    expect(!result.success && result.error.issues[0]?.message).toBe("invalid_username");
  });
  it("marca los reservados", () => {
    const result = usernameSchema.safeParse("Admin");
    expect(!result.success && result.error.issues[0]?.message).toBe("reserved_username");
  });
  it("onboarding valida usuario y nombre", () => {
    const ok = onboardingSchema.safeParse({ username: " Valen_Makes2 ", displayName: "  Valentina   Ruiz " });
    expect(ok.success && ok.data).toEqual({ username: "valen_makes2", displayName: "Valentina Ruiz" });
    const bad = onboardingSchema.safeParse({ username: "a", displayName: "   " });
    expect(!bad.success && bad.error.issues.map((i) => [i.path[0], i.message])).toEqual([
      ["username", "invalid_username"],
      ["displayName", "invalid_display_name"],
    ]);
  });
  it("el nombre admite hasta 50 caracteres (un emoji cuenta como uno)", () => {
    expect(onboardingSchema.safeParse({ username: "rodri", displayName: "😀".repeat(50) }).success).toBe(true);
    expect(onboardingSchema.safeParse({ username: "rodri", displayName: "x".repeat(51) }).success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  const base = { displayName: "Valen", bio: "", city: "", country: "", engines: [], favoriteGenres: [] };

  it("normaliza y convierte vacíos en null", () => {
    const result = updateProfileSchema.safeParse({ ...base, city: "  Rosario ", country: " ar ", bio: "Hola\r\n\r\n\r\nmundo" });
    expect(result.success && result.data).toMatchObject({ city: "Rosario", country: "AR", bio: "Hola\n\nmundo" });
    const empty = updateProfileSchema.safeParse(base);
    expect(empty.success && empty.data).toMatchObject({ city: null, country: null });
  });
  it("saca repetidos de motores y géneros", () => {
    const result = updateProfileSchema.safeParse({ ...base, engines: ["godot", "godot", "unity"], favoriteGenres: ["arcade", "arcade"] });
    expect(result.success && [result.data.engines, result.data.favoriteGenres]).toEqual([["godot", "unity"], ["arcade"]]);
  });
  it.each([
    [{ bio: "x".repeat(281) }, "bio", "bioTooLong"],
    [{ city: "x".repeat(81) }, "city", "cityTooLong"],
    [{ country: "ZZ" }, "country", "invalidCountry"],
    [{ country: "ARG" }, "country", "invalidCountry"],
    [{ engines: ["nope"] }, "engines", "invalidEngine"],
    [{ engines: ["godot", "unity", "gamemaker", "phaser", "pico8", "scratch", "twine", "construct", "other"] }, "engines", "tooManyEngines"],
    [{ favoriteGenres: ["nope"] }, "favoriteGenres", "invalidGenre"],
    [{ displayName: "   " }, "displayName", "invalid_display_name"],
  ])("rechaza %j", (patch, field, key) => {
    const result = updateProfileSchema.safeParse({ ...base, ...patch });
    expect(!result.success && result.error.issues.map((i) => [i.path[0], i.message])).toEqual([[field, key]]);
  });
  it("acepta los 17 géneros", () => {
    const all = ["platformer", "arcade", "puzzle", "narrative", "roguelike", "cozy", "horror", "rhythm", "racing", "adventure", "strategy", "shooter", "simulation", "sports", "fighting", "idle", "other"];
    expect(updateProfileSchema.safeParse({ ...base, favoriteGenres: all }).success).toBe(true);
  });
  it("saca los caracteres invisibles del nombre y la bio", () => {
    const result = updateProfileSchema.safeParse({ ...base, displayName: "\u202EAdmin", bio: "\u200Bhola" });
    expect(result.success && [result.data.displayName, result.data.bio]).toEqual(["Admin", "hola"]);
  });
});

describe("otros esquemas y parámetros", () => {
  it("preferences solo admite los idiomas del producto", () => {
    expect(preferencesSchema.safeParse({ locale: "en" }).success).toBe(true);
    expect(preferencesSchema.safeParse({ locale: "fr" }).success).toBe(false);
    expect(preferencesSchema.safeParse({}).success).toBe(false);
  });
  it("follow exige un uuid y un booleano", () => {
    expect(followSchema.safeParse({ targetId: "5eed0000-0000-4000-8000-000000000002", follow: true }).success).toBe(true);
    expect(followSchema.safeParse({ targetId: "no-es-uuid", follow: true }).success).toBe(false);
    expect(followSchema.safeParse({ targetId: "5eed0000-0000-4000-8000-000000000002", follow: "true" }).success).toBe(false);
  });
  it("parseLocale cae al idioma por defecto", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("fr")).toBe("es");
    expect(parseLocale(null)).toBe("es");
  });
  it("parseNextPath solo deja rutas internas", () => {
    expect(parseNextPath("/settings/profile")).toBe("/settings/profile");
    expect(parseNextPath("https://evil.example")).toBeNull();
    expect(parseNextPath("//evil.example")).toBeNull();
    expect(parseNextPath("/\\evil.example")).toBeNull();
    expect(parseNextPath(`/${"a".repeat(3000)}`)).toBeNull();
    expect(parseNextPath(undefined)).toBeNull();
  });
  it("parseLoginError ignora cualquier valor desconocido", () => {
    expect(parseLoginError("linkExpired")).toBe("linkExpired");
    expect(parseLoginError("<script>")).toBeUndefined();
  });
  it("parseUsernameParam decodifica, normaliza y descarta lo imposible", () => {
    expect(parseUsernameParam("Valen_Makes")).toBe("valen_makes");
    expect(parseUsernameParam("agus.codes")).toBe("agus.codes");
    expect(parseUsernameParam("%E0%A4%A")).toBeNull(); // percent-encoding roto: decodeURIComponent lanzaría
    expect(parseUsernameParam("con%20espacio")).toBeNull();
    expect(parseUsernameParam("a")).toBeNull();
    expect(parseUsernameParam("%00")).toBeNull();
  });
});

describe("fieldErrorsFrom", () => {
  it("traduce las claves conocidas y deja un solo error por campo", () => {
    const result = signupSchema.safeParse({ email: "no", password: "x", confirm: "y", consent: false });
    const errors = !result.success ? fieldErrorsFrom(result.error, AUTH_FORM_ERROR_KEYS, (key) => `T:${key}`, "generic") : {};
    expect(errors).toEqual({ email: "T:invalidEmail", password: "T:weakPassword", confirm: "T:passwordsDontMatch", consent: "T:consentRequired" });
  });
  it("nunca muestra el texto técnico de Zod: lo reemplaza por el mensaje genérico", () => {
    const result = loginSchema.safeParse({}); // faltan los campos: Zod diría «Invalid input: expected string…»
    const errors = !result.success ? fieldErrorsFrom(result.error, AUTH_FORM_ERROR_KEYS, (key) => `T:${key}`, "generic") : {};
    expect(errors).toEqual({ email: "T:generic", password: "T:generic" });
  });
});

describe("las claves de error de los esquemas existen en las traducciones", () => {
  const dictionaries = { es, en } as const;
  for (const [locale, messages] of Object.entries(dictionaries)) {
    it(`auth.errors (${locale})`, () => {
      for (const key of AUTH_FORM_ERROR_KEYS) expect(messages.auth.errors, key).toHaveProperty(key);
    });
    it(`onboarding.errors (${locale})`, () => {
      for (const key of ONBOARDING_FORM_ERROR_KEYS) expect(messages.onboarding.errors, key).toHaveProperty(key);
    });
    it(`settings.errors (${locale})`, () => {
      for (const key of SETTINGS_FORM_ERROR_KEYS) {
        // «invalid_display_name» se traduce con el texto del onboarding (es el mismo mensaje).
        const home = key === "invalid_display_name" ? messages.onboarding.errors : messages.settings.errors;
        expect(home, key).toHaveProperty(key);
      }
    });
  }
});
