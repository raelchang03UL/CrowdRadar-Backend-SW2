// PRUEBAS UNITARIAS — CAJA NEGRA
// Unidades: parsePlaceId, parseReportId, parseSaturationFilter y validCoordinates.
// Técnicas: Partición de equivalencia (rango, valor, conjunto, lógica) + Valores límite.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePlaceId } from "../../../src/services/SaturationQueryService.js";
import { parseReportId } from "../../../src/services/ReportValidationService.js";
import { parseSaturationFilter, validCoordinates } from "../../../src/services/PlaceService.js";

// parsePlaceId: entero INTEGER de PostgreSQL distinto de 0, enviado como texto.
// | Condición | Válida                                  | No válidas                                   |
// | Tipo      | texto                                   | número, null                                 |
// | Formato   | dígitos con signo opcional, sin ceros   | "01", "1.5", " 1", "abc", "0"                |
// | Rango     | [-2147483648, 2147483647] sin el 0      | < -2147483648 ; > 2147483647                 |
describe("parsePlaceId", () => {
    const tabla = [
        ["1", 1], ["-1", -1], ["42", 42],
        ["2147483647", 2147483647], ["-2147483648", -2147483648], // límites válidos
        ["2147483648", null], ["-2147483649", null],              // límites +1 / -1
        ["0", null], ["01", null], ["1.5", null], [" 1", null], ["abc", null], ["", null],
        [1, null], [null, null], [undefined, null]
    ];
    for (const [entrada, esperado] of tabla) {
        it(`${JSON.stringify(entrada)} -> ${esperado}`, () => assert.equal(parsePlaceId(entrada), esperado));
    }
});

// parseReportId: BIGINT positivo como texto, máximo 9223372036854775807 (2^63 - 1).
describe("parseReportId", () => {
    for (const valido of ["1", "999", "9223372036854775807"]) {
        it(`acepta ${valido}`, () => assert.equal(parseReportId(valido), valido));
    }
    for (const invalido of ["0", "-1", "01", "9223372036854775808", "1".repeat(20), "1e3", "abc", 1, null]) {
        it(`rechaza ${JSON.stringify(invalido)} con 400 REPORT_ID_INVALID`, () => {
            assert.throws(() => parseReportId(invalido), { status: 400, code: "REPORT_ID_INVALID" });
        });
    }
});

// parseSaturationFilter: miembro de un conjunto {TRANQUILO, MODERADO, SATURADO}.
describe("parseSaturationFilter", () => {
    it("clase válida: cada miembro del conjunto se devuelve tal cual", () => {
        for (const nivel of ["TRANQUILO", "MODERADO", "SATURADO"]) {
            assert.equal(parseSaturationFilter({ nivel }), nivel);
        }
    });
    it("los espacios exteriores se ignoran", () => {
        assert.equal(parseSaturationFilter({ nivel: "  SATURADO " }), "SATURADO");
    });
    it("sin filtro (ausente, vacío o espacios) devuelve null", () => {
        assert.equal(parseSaturationFilter({}), null);
        assert.equal(parseSaturationFilter({ nombre: "Plaza" }), null);
        assert.equal(parseSaturationFilter({ nivel: "" }), null);
        assert.equal(parseSaturationFilter({ nivel: "   " }), null);
    });
    it("clase no válida: valores fuera del conjunto o con otra capitalización", () => {
        for (const nivel of ["saturado", "LLENO", "SATURADOS"]) {
            assert.throws(() => parseSaturationFilter({ nivel }), { code: "SATURATION_FILTER_INVALID" });
        }
    });
    it("clase no válida: tipo distinto de texto (parámetro repetido) o claves desconocidas", () => {
        assert.throws(() => parseSaturationFilter({ nivel: ["SATURADO", "MODERADO"] }), { code: "SATURATION_FILTER_INVALID" });
        assert.throws(() => parseSaturationFilter({ orden: "asc" }), { code: "SATURATION_FILTER_INVALID" });
    });
    it("clase no válida: la consulta no es un objeto", () => {
        for (const consulta of [null, undefined, "SATURADO", []]) {
            assert.throws(() => parseSaturationFilter(consulta), { code: "SATURATION_FILTER_INVALID" });
        }
    });
});

// validCoordinates: latitud en [-90, 90], longitud en [-180, 180], números finitos.
describe("validCoordinates — valores límite", () => {
    const casos = [
        { lat: -12.0464, lon: -77.0428, esperado: true, nota: "Lima (valor nominal)" },
        { lat: -90, lon: 0, esperado: true, nota: "latitud mínima" },
        { lat: 90, lon: 0, esperado: true, nota: "latitud máxima" },
        { lat: -90.000001, lon: 0, esperado: false, nota: "latitud mínima - ε" },
        { lat: 90.000001, lon: 0, esperado: false, nota: "latitud máxima + ε" },
        { lat: 0, lon: -180, esperado: true, nota: "longitud mínima" },
        { lat: 0, lon: 180, esperado: true, nota: "longitud máxima" },
        { lat: 0, lon: -180.000001, esperado: false, nota: "longitud mínima - ε" },
        { lat: 0, lon: 180.000001, esperado: false, nota: "longitud máxima + ε" },
        { lat: Number.NaN, lon: 0, esperado: false, nota: "NaN" },
        { lat: 0, lon: Number.POSITIVE_INFINITY, esperado: false, nota: "infinito" },
        { lat: "10", lon: "10", esperado: false, nota: "texto en lugar de número" }
    ];
    for (const { lat, lon, esperado, nota } of casos) {
        it(`${nota}: (${lat}, ${lon}) -> ${esperado}`, () => assert.equal(validCoordinates(lat, lon), esperado));
    }
});
