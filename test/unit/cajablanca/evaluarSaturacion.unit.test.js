// PRUEBAS UNITARIAS — CAJA BLANCA (camino básico + bucles)
// Unidad: evaluateSaturation() de src/services/SaturationQueryService.js
//
// Nodos predicado (simplificando cada condición compuesta a un nodo, como en el ejemplo
// "SI a O b" de la PPT, y luego cubriendo sus condiciones simples por separado):
//   P1  snapshot inválido (placeId / evaluatedAt / votes)        → lanza error
//   P2  bucle for: ¿quedan reportes?
//   P3  reporte almacenado inválido                              → lanza error
//   P4  reporte fuera de la ventana de 30 min                    → continue
//   P5  ¿es el voto más reciente de esa persona?                 → reemplaza
//   P6  ¿reportCount ≥ mínimo (3)?
//   P7  ¿hay un único ganador?                                   → nivel / TIE
// V(G) = P + 1 = 7 + 1 = 8 caminos independientes:
//   C1 P1=V                         snapshot inválido
//   C2 P1=F, P2=F, P6=F             sin reportes
//   C3 ... P3=V                     reporte corrupto
//   C4 ... P4=V                     reporte fuera de ventana se ignora
//   C5 ... P5=F                     voto anterior de la misma persona no reemplaza
//   C6 ... P5=V, P6=F               1-2 personas → INSUFFICIENT_REPORTS
//   C7 ... P6=V, P7=V               mayoría clara → nivel
//   C8 ... P6=V, P7=F               empate → TIE
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateSaturation, saturationPolicy } from "../../../src/services/SaturationQueryService.js";

const evaluatedAt = "2026-11-13T15:00:00.000Z";
const voto = (userId, level, minutosAntes = 5, id = userId) => ({
    id: String(id), userId, level,
    createdAt: new Date(Date.parse(evaluatedAt) - minutosAntes * 60_000).toISOString()
});
const evaluar = (votes, extra = {}) => evaluateSaturation({ placeId: 10, evaluatedAt, votes, ...extra });

describe("evaluateSaturation — caminos independientes (V(G) = 8)", () => {
    it("C1: snapshot inválido lanza error (cada condición simple del predicado P1)", () => {
        for (const malo of [{ placeId: 0 }, { placeId: 1.5 }, { placeId: 2147483648 }, { evaluatedAt: null },
            { evaluatedAt: "no-es-fecha" }, { votes: null }]) {
            assert.throws(() => evaluar([], malo), /Snapshot de saturación inválido/, JSON.stringify(malo));
        }
    });
    it("C2: el bucle no itera (0 reportes) → INSUFFICIENT_REPORTS y updatedAt null", () => {
        const resultado = evaluar([]);
        assert.deepEqual([resultado.level, resultado.reason, resultado.reportCount, resultado.updatedAt],
            [null, "INSUFFICIENT_REPORTS", 0, null]);
    });
    it("C3: un reporte almacenado inválido lanza error", () => {
        for (const corrupto of [{ ...voto(1, "SATURADO"), userId: 0 }, { ...voto(1, "LLENO") },
            { ...voto(1, "SATURADO"), createdAt: "x" }, { ...voto(1, "SATURADO"), id: "abc" }]) {
            assert.throws(() => evaluar([corrupto]), /Reporte almacenado inválido/);
        }
    });
    it("C4: reportes fuera de la ventana (antes o en el futuro) se ignoran", () => {
        const viejos = [voto(1, "SATURADO", 31), voto(2, "SATURADO", 45), voto(3, "SATURADO", -1)];
        assert.equal(evaluar(viejos).reportCount, 0);
    });
    it("C5: un voto más antiguo de la misma persona no reemplaza al reciente", () => {
        const votos = [voto(1, "SATURADO", 2, 20), voto(1, "TRANQUILO", 10, 10), voto(2, "SATURADO"), voto(3, "SATURADO")];
        const resultado = evaluar(votos);
        assert.equal(resultado.reportCount, 3);
        assert.equal(resultado.level, "SATURADO");
    });
    it("C6: dos personas no alcanzan el mínimo de 3", () => {
        const resultado = evaluar([voto(1, "SATURADO"), voto(2, "SATURADO")]);
        assert.equal(resultado.level, null);
        assert.equal(resultado.reason, "INSUFFICIENT_REPORTS");
        assert.equal(resultado.reportCount, 2);
    });
    it("C7: mayoría simple da el nivel", () => {
        const resultado = evaluar([voto(1, "MODERADO"), voto(2, "MODERADO"), voto(3, "TRANQUILO")]);
        assert.equal(resultado.level, "MODERADO");
        assert.equal(resultado.reason, null);
    });
    it("C8: empate entre niveles → sin nivel (TIE)", () => {
        const resultado = evaluar([voto(1, "SATURADO"), voto(2, "TRANQUILO"), voto(3, "MODERADO")]);
        assert.equal(resultado.level, null);
        assert.equal(resultado.reason, "TIE");
    });
});

describe("evaluateSaturation — prueba de bucles y fronteras", () => {
    it("límite de la ventana: exactamente 30 min antes cuenta, 30 min + 1 ms no", () => {
        const borde = { id: "1", userId: 1, level: "SATURADO", createdAt: new Date(Date.parse(evaluatedAt) - 30 * 60_000).toISOString() };
        const fuera = { ...borde, id: "2", userId: 2, createdAt: new Date(Date.parse(evaluatedAt) - 30 * 60_000 - 1).toISOString() };
        assert.equal(evaluar([borde, fuera]).reportCount, 1);
    });
    it("misma fecha y misma persona: gana el id mayor (comparación BigInt)", () => {
        const votos = [voto(1, "TRANQUILO", 5, 9), voto(1, "SATURADO", 5, 10), voto(2, "SATURADO"), voto(3, "SATURADO")];
        assert.equal(evaluar(votos).level, "SATURADO");
    });
    it("updatedAt es la fecha del voto más reciente considerado", () => {
        const resultado = evaluar([voto(1, "SATURADO", 20), voto(2, "SATURADO", 3), voto(3, "SATURADO", 10)]);
        assert.equal(resultado.updatedAt, new Date(Date.parse(evaluatedAt) - 3 * 60_000).toISOString());
    });
    it("muchas iteraciones (bucle n veces): 100 personas, mayoría SATURADO", () => {
        const votos = Array.from({ length: 100 }, (_, i) => voto(i + 1, i < 60 ? "SATURADO" : "TRANQUILO"));
        const resultado = evaluar(votos);
        assert.equal(resultado.reportCount, 100);
        assert.equal(resultado.level, "SATURADO");
    });
    it("la política es configurable (mínimo y ventana)", () => {
        const resultado = evaluateSaturation({ placeId: 1, evaluatedAt, votes: [voto(1, "SATURADO", 50)] },
            { minimumReports: 1, windowMinutes: 60 });
        assert.equal(resultado.level, "SATURADO");
        assert.equal(saturationPolicy.minimumReports, 3);
    });
});
