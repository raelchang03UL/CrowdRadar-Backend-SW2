// PRUEBAS UNITARIAS — CAJA NEGRA
// Unidades: esquemas AJV de registro/perfil y utilidades de normalización.
// Se compilan los esquemas reales con la misma configuración que validateSchema.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { registerSchema, loginSchema } from "../../../src/validations/authSchemas.js";
import { updateUserSchema } from "../../../src/validations/userSchemas.js";
import { saturationReportSchema } from "../../../src/validations/reportSchemas.js";
import { normalizeEmail, normalizeText, trimFields } from "../../../src/utils/normalization.js";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validarRegistro = ajv.compile(registerSchema);
const validarLogin = ajv.compile(loginSchema);
const validarPerfil = ajv.compile(updateUserSchema);
const validarReporte = ajv.compile(saturationReportSchema);
const registro = (cambios = {}) => ({ nombre: "Ana", apellido: "Pérez", email: "ana@crowdradar.test", password: "ClaveSegura1", ...cambios });

describe("registerSchema — partición de equivalencia", () => {
    it("CV: datos completos válidos (con y sin campos opcionales)", () => {
        assert.equal(validarRegistro(registro()), true);
        assert.equal(validarRegistro(registro({ telefono: "987654321", distrito: "Lima" })), true);
    });
    it("CNV: falta cualquier campo obligatorio", () => {
        for (const campo of ["nombre", "apellido", "email", "password"]) {
            const datos = registro();
            delete datos[campo];
            assert.equal(validarRegistro(datos), false, campo);
        }
    });
    it("CNV: campos no permitidos (p. ej. intentar asignarse rol)", () => {
        assert.equal(validarRegistro(registro({ rol: "ADMIN" })), false);
    });
    it("CNV: correo con formato inválido", () => {
        for (const email of ["ana", "ana@", "@crowdradar.test", "ana crowdradar.test"]) {
            assert.equal(validarRegistro(registro({ email })), false, email);
        }
    });
    it("CNV: tipos distintos de texto", () => {
        assert.equal(validarRegistro(registro({ nombre: 123 })), false);
        assert.equal(validarRegistro(registro({ telefono: 987654321 })), false);
    });
});

describe("registerSchema — valores límite", () => {
    it("nombre: 1 carácter falla, 2 caracteres pasa", () => {
        assert.equal(validarRegistro(registro({ nombre: "A" })), false);
        assert.equal(validarRegistro(registro({ nombre: "Al" })), true);
    });
    it("nombre: 2 caracteres visibles rodeados de espacios pasa; 1 visible + espacios falla", () => {
        assert.equal(validarRegistro(registro({ nombre: "  Al  " })), true);
        assert.equal(validarRegistro(registro({ nombre: "  A   " })), false);
    });
    it("texto: 255 caracteres pasa, 256 falla", () => {
        assert.equal(validarRegistro(registro({ apellido: "p".repeat(255) })), true);
        assert.equal(validarRegistro(registro({ apellido: "p".repeat(256) })), false);
    });
    it("password: 7 caracteres falla, 8 pasa (el límite de 72 bytes lo controla el servicio)", () => {
        assert.equal(validarRegistro(registro({ password: "1234567" })), false);
        assert.equal(validarRegistro(registro({ password: "12345678" })), true);
    });
});

describe("loginSchema", () => {
    it("exige email y password, sin campos extra", () => {
        assert.equal(validarLogin({ email: "a@b.pe", password: "x" }), true);
        assert.equal(validarLogin({ email: "a@b.pe" }), false);
        assert.equal(validarLogin({ email: "a@b.pe", password: "x", recordar: true }), false);
    });
});

describe("updateUserSchema", () => {
    it("acepta actualizar un solo campo", () => assert.equal(validarPerfil({ distrito: "Miraflores" }), true));
    it("rechaza el cuerpo vacío (minProperties = 1)", () => assert.equal(validarPerfil({}), false));
    it("no permite cambiar email, password ni rol por esta ruta", () => {
        for (const campo of ["email", "password", "rol"]) assert.equal(validarPerfil({ [campo]: "x" }), false, campo);
    });
    it("telefono: 255 pasa, 256 falla", () => {
        assert.equal(validarPerfil({ telefono: "9".repeat(255) }), true);
        assert.equal(validarPerfil({ telefono: "9".repeat(256) }), false);
    });
});

describe("saturationReportSchema — miembro de un conjunto", () => {
    it("acepta los tres niveles y rechaza cualquier otro", () => {
        for (const level of ["TRANQUILO", "MODERADO", "SATURADO"]) assert.equal(validarReporte({ level }), true);
        for (const level of ["tranquilo", "LLENO", "", 1]) assert.equal(validarReporte({ level }), false);
        assert.equal(validarReporte({}), false);
    });
});

describe("normalización", () => {
    it("normalizeEmail recorta y pasa a minúsculas", () => {
        assert.equal(normalizeEmail("  Ana.Perez@CrowdRadar.TEST "), "ana.perez@crowdradar.test");
    });
    it("normalizeEmail y normalizeText devuelven sin cambios lo que no es texto", () => {
        for (const valor of [null, undefined, 5, ["a"]]) {
            assert.equal(normalizeEmail(valor), valor);
            assert.equal(normalizeText(valor), valor);
        }
    });
    it("trimFields recorta solo los campos indicados, sin mutar el original ni añadir claves", () => {
        const original = { nombre: "  Ana ", password: "  con espacios  " };
        const copia = trimFields(original, ["nombre", "apellido"]);
        assert.deepEqual(copia, { nombre: "Ana", password: "  con espacios  " });
        assert.equal(original.nombre, "  Ana ");
        assert.equal("apellido" in copia, false);
    });
});
