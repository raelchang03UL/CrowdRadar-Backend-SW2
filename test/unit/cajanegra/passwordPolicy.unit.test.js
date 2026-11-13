// PRUEBAS UNITARIAS — CAJA NEGRA
// Unidad bajo prueba: validPassword(value, { minimum }) de src/utils/passwordPolicy.js
// Técnicas: Partición de equivalencia + Análisis de valores límite.
//
// Especificación (HU 1.2 / HU 2.3):
//   - Debe ser un texto (string).
//   - Mínimo 8 caracteres (se cuentan caracteres Unicode, no bytes).
//   - No puede estar formado solo por espacios.
//   - Máximo 72 bytes en UTF-8 (límite de bcrypt).
//
// Tabla de clases de equivalencia
// | Condición            | Clase válida             | Clases no válidas                       |
// |----------------------|--------------------------|-----------------------------------------|
// | Tipo (lógica)        | CV1: string              | CNV1: null, undefined, número, arreglo  |
// | Longitud (rango)     | CV2: 8 ≤ caracteres      | CNV2: < 8 caracteres                    |
// | Contenido (lógica)   | CV3: algún no-espacio    | CNV3: solo espacios                     |
// | Tamaño (rango)       | CV4: ≤ 72 bytes UTF-8    | CNV4: > 72 bytes UTF-8                  |
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validPassword, AuthError, invalidSession } from "../../../src/utils/passwordPolicy.js";

describe("validPassword — partición de equivalencia", () => {
    const casos = [
        { id: "CP-01", clases: "CV1,CV2,CV3,CV4", entrada: "ClaveSegura1", esperado: true },
        { id: "CP-02", clases: "CNV1 (null)", entrada: null, esperado: false },
        { id: "CP-03", clases: "CNV1 (undefined)", entrada: undefined, esperado: false },
        { id: "CP-04", clases: "CNV1 (número)", entrada: 12345678, esperado: false },
        { id: "CP-05", clases: "CNV1 (arreglo)", entrada: ["ClaveSegura1"], esperado: false },
        { id: "CP-06", clases: "CNV2", entrada: "abc", esperado: false },
        { id: "CP-07", clases: "CNV3", entrada: "          ", esperado: false },
        { id: "CP-08", clases: "CNV4", entrada: "x".repeat(100), esperado: false }
    ];
    for (const { id, clases, entrada, esperado } of casos) {
        it(`${id} [${clases}] devuelve ${esperado}`, () => {
            assert.equal(validPassword(entrada), esperado);
        });
    }
});

describe("validPassword — análisis de valores límite", () => {
    it("VL-01 longitud 7 (justo debajo del mínimo) es inválida", () => {
        assert.equal(validPassword("a".repeat(7)), false);
    });
    it("VL-02 longitud 8 (en el mínimo) es válida", () => {
        assert.equal(validPassword("a".repeat(8)), true);
    });
    it("VL-03 longitud 9 (justo encima del mínimo) es válida", () => {
        assert.equal(validPassword("a".repeat(9)), true);
    });
    it("VL-04 72 bytes (en el máximo) es válida", () => {
        assert.equal(validPassword("a".repeat(72)), true);
    });
    it("VL-05 73 bytes (justo encima del máximo) es inválida", () => {
        assert.equal(validPassword("a".repeat(73)), false);
    });
    it("VL-06 el máximo se mide en bytes: 36 «ñ» = 72 bytes es válida, 36 «ñ» + 1 = 73 bytes no", () => {
        assert.equal(validPassword("ñ".repeat(36)), true);
        assert.equal(validPassword("ñ".repeat(36) + "a"), false);
    });
    it("VL-07 el mínimo se mide en caracteres: 8 emojis (32 bytes) es válida, 7 emojis no", () => {
        assert.equal(validPassword("😀".repeat(8)), true);
        assert.equal(validPassword("😀".repeat(7)), false);
    });
    it("VL-08 espacios internos sí cuentan como caracteres", () => {
        assert.equal(validPassword("  a    b"), true);
    });
});

describe("validPassword — parámetro minimum (usado por login)", () => {
    it("con minimum=1 acepta 1 carácter y rechaza la cadena vacía", () => {
        assert.equal(validPassword("x", { minimum: 1 }), true);
        assert.equal(validPassword("", { minimum: 1 }), false);
    });
});

describe("AuthError e invalidSession", () => {
    it("AuthError conserva estado HTTP, código y mensaje", () => {
        const error = new AuthError(400, "CODIGO", "mensaje");
        assert.ok(error instanceof Error);
        assert.deepEqual([error.status, error.code, error.message], [400, "CODIGO", "mensaje"]);
    });
    it("invalidSession crea un 401 SESSION_INVALID nuevo en cada llamada", () => {
        const a = invalidSession();
        const b = invalidSession();
        assert.equal(a.status, 401);
        assert.equal(a.code, "SESSION_INVALID");
        assert.notEqual(a, b);
    });
});
