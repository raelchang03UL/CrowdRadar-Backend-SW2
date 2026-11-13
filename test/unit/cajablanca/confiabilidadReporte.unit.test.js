// PRUEBAS UNITARIAS — CAJA BLANCA (prueba del camino básico, McCabe)
// Unidad: reliability() de src/services/ReportValidationService.js
//
// Código etiquetado:
//   (1) count = confirmations + rejections; totalWeight = confirmWeight + rejectWeight
//   (2) if (count < 3            ── nodo predicado P1
//   (3)     || !totalWeight)     ── nodo predicado P2
//   (4)     return INSUFFICIENT_VALIDATIONS
//   (5) confirmWeight*3 >= totalWeight*2 ?   ── nodo predicado P3
//   (6)     "ALTO"
//   (7) : confirmWeight*3 <= totalWeight ?   ── nodo predicado P4
//   (8)     "BAJO"
//   (9)     : "MEDIO"
//  (10) return { level, ... }
//
// Grafo de flujo: 1→2, 2→4 (V), 2→3 (F), 3→4 (V), 3→5 (F), 5→6 (V), 5→7 (F),
//                 7→8 (V), 7→9 (F), 6→10, 8→10, 9→10, 4→fin, 10→fin
// Complejidad ciclomática:
//   V(G) = P + 1 = 4 + 1 = 5
//   V(G) = A - N + 2 = 14 - 11 + 2 = 5   (N incluye el nodo fin)
//
// Caminos independientes y casos de prueba:
//   C1: 1-2-4           count < 3                           → INSUFFICIENT
//   C2: 1-2-3-4         count ≥ 3 y peso total 0            → INSUFFICIENT
//   C3: 1-2-3-5-6-10    confirmWeight/total ≥ 2/3           → ALTO
//   C4: 1-2-3-5-7-8-10  confirmWeight/total ≤ 1/3           → BAJO
//   C5: 1-2-3-5-7-9-10  1/3 < confirmWeight/total < 2/3     → MEDIO
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reliability, reportDto } from "../../../src/services/ReportValidationService.js";

const r = (confirmations, rejections, confirmWeight, rejectWeight) =>
    reliability({ confirmations, rejections, confirmWeight, rejectWeight });

describe("reliability — caminos independientes (V(G) = 5)", () => {
    it("C1: menos de 3 validaciones → sin nivel (INSUFFICIENT_VALIDATIONS)", () => {
        const resultado = r(1, 1, 10, 10);
        assert.equal(resultado.level, null);
        assert.equal(resultado.reason, "INSUFFICIENT_VALIDATIONS");
    });
    it("C2: 3 validaciones pero peso total 0 → sin nivel", () => {
        const resultado = r(3, 0, 0, 0);
        assert.equal(resultado.level, null);
        assert.equal(resultado.reason, "INSUFFICIENT_VALIDATIONS");
    });
    it("C3: peso de confirmación exactamente 2/3 → ALTO (frontera del predicado P3)", () => {
        assert.equal(r(2, 1, 2, 1).level, "ALTO");
    });
    it("C4: peso de confirmación exactamente 1/3 → BAJO (frontera del predicado P4)", () => {
        assert.equal(r(1, 2, 1, 2).level, "BAJO");
    });
    it("C5: peso de confirmación 1/2 → MEDIO", () => {
        const resultado = r(2, 2, 1, 1);
        assert.equal(resultado.level, "MEDIO");
        assert.equal(resultado.reason, null);
    });
});

describe("reliability — cobertura de condiciones (cada condición simple V/F)", () => {
    it("P1 en su frontera: count = 2 es insuficiente y count = 3 ya evalúa", () => {
        assert.equal(r(2, 0, 5, 0).level, null);
        assert.equal(r(3, 0, 5, 0).level, "ALTO");
    });
    it("P3 justo por debajo de 2/3 cae en MEDIO (detecta el mutante >= → >)", () => {
        // 65/100 < 2/3
        assert.equal(r(3, 3, 65, 35).level, "MEDIO");
    });
    it("P4 justo por encima de 1/3 cae en MEDIO (detecta el mutante <= → <)", () => {
        // 34/100 > 1/3
        assert.equal(r(3, 3, 34, 66).level, "MEDIO");
    });
    it("la evidencia devuelta incluye mínimo de validadores y pesos", () => {
        assert.deepEqual(r(3, 0, 3, 0), {
            level: "ALTO", reason: null, minimumValidators: 3, confirmWeight: 3, totalWeight: 3
        });
    });
});

describe("reportDto — función interna count()", () => {
    const fila = (cambios = {}) => ({
        id: 7n, placeId: 1, placeName: "Plaza", level: "MODERADO", createdAt: "2026-10-01T00:00:00Z",
        isOwn: false, ownDecision: null, alreadyDenounced: false,
        confirmations: "2", rejections: "1", confirmWeight: "2", rejectWeight: "1", ...cambios
    });
    it("camino feliz: convierte BIGINT/texto a número y el id a texto", () => {
        const dto = reportDto(fila());
        assert.equal(dto.id, "7");
        assert.equal(dto.confirmations, 2);
        assert.equal(dto.reliability.level, "ALTO");
    });
    it("valor límite: un conteo 0 es válido (mata el mutante `< 0` → `<= 0`)", () => {
        const dto = reportDto(fila({ confirmations: "0", rejections: "0", confirmWeight: "0", rejectWeight: "0" }));
        assert.equal(dto.confirmations, 0);
        assert.equal(dto.reliability.reason, "INSUFFICIENT_VALIDATIONS");
    });
    it("camino de error: conteo negativo o no entero lanza excepción", () => {
        for (const confirmations of ["-1", "1.5", "abc", "9007199254740992"]) {
            assert.throws(() => reportDto(fila({ confirmations })), /Invalid report count/, confirmations);
        }
    });
});
