// PRUEBAS UNITARIAS — CAJA BLANCA
// Unidades: period() de PlaceHistoryService y requireAdministratorSession() de domain/administration.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { period, hourlyBlocks } from "../../../src/services/PlaceHistoryService.js";
import { requireAdministrator, requireAdministratorSession, AdministrationError } from "../../../src/domain/administration.js";

// period(from, to) — código etiquetado (función interna date + cuerpo):
//   P1 typeof value !== "string" || !/AAAA-MM-DD/ || empieza con "0000"  → 400 formato
//   P2 fecha inexistente (p. ej. 2026-02-30)                              → 400 inexistente
//   P3 end <= start || end - start > 31 días                              → 400 rango
// V(G) = 3 + 1 = 4 caminos:
//   C1 P1=V  |  C2 P1=F,P2=V  |  C3 P1=F,P2=F,P3=V  |  C4 todo falso → período válido
describe("period — camino básico (V(G) = 4)", () => {
    it("C1: formato inválido", () => {
        for (const desde of [20261101, "2026/11/01", "01-11-2026", "0000-01-01"]) {
            assert.throws(() => period(desde, "2026-11-02"), { code: "PERIOD_INVALID", message: /AAAA-MM-DD/ });
        }
    });
    it("C2: fecha con formato correcto pero inexistente", () => {
        assert.throws(() => period("2026-02-30", "2026-03-01"), { code: "PERIOD_INVALID", message: /no existe/ });
    });
    it("C3: rango invertido o mayor de 31 días", () => {
        assert.throws(() => period("2026-11-10", "2026-11-01"), { message: /entre 1 y 31 días/ });
        assert.throws(() => period("2026-10-01", "2026-11-01"), { message: /entre 1 y 31 días/ });
    });
    it("C4: período válido en hora de Lima (UTC-5), fin exclusivo", () => {
        assert.deepEqual(period("2026-11-01", "2026-11-01"), {
            from: "2026-11-01", to: "2026-11-01",
            start: "2026-11-01T05:00:00.000Z", end: "2026-11-02T05:00:00.000Z", timezone: "America/Lima"
        });
    });
    it("valor límite de P3: 31 días exactos es válido", () => {
        assert.doesNotThrow(() => period("2026-10-01", "2026-10-31"));
    });
    it("hourlyBlocks genera 24 bloques por día y rechaza más de 10000 filas", () => {
        const rango = period("2026-11-01", "2026-11-01");
        const bloques = hourlyBlocks(1, rango, []);
        assert.equal(bloques.length, 24);
        assert.equal(bloques[0].reason, "INSUFFICIENT_REPORTS");
        assert.throws(() => hourlyBlocks(1, rango, Array.from({ length: 10001 })), { code: "PERIOD_TOO_DENSE" });
    });
});

// requireAdministratorSession(current, actor): un predicado compuesto con 5 condiciones OR
// y luego requireAdministrator (1 predicado). Cobertura de condición múltiple: se fuerza
// cada condición simple a VERDADERO por separado manteniendo las demás en FALSO.
describe("requireAdministratorSession — cobertura de condiciones", () => {
    const ahora = Math.floor(Date.now() / 1000);
    const actual = { status: "ACTIVO", sessionVersion: 2, rol: "ADMIN" };
    const actor = { sessionVersion: 2, exp: ahora + 3600 };
    const casos = [
        ["!current", null, actor],
        ["status ≠ ACTIVO", { ...actual, status: "SUSPENDIDO" }, actor],
        ["sessionVersion distinta", actual, { ...actor, sessionVersion: 1 }],
        ["exp no entero", actual, { ...actor, exp: "mañana" }],
        ["exp vencido (límite: exp = ahora)", actual, { ...actor, exp: ahora }]
    ];
    for (const [condicion, current, quien] of casos) {
        it(`${condicion} → 401 SESSION_INVALID`, () => {
            assert.throws(() => requireAdministratorSession(current, quien), { status: 401, code: "SESSION_INVALID" });
        });
    }
    it("todas falsas pero rol USUARIO → 403 ADMIN_REQUIRED", () => {
        assert.throws(() => requireAdministratorSession({ ...actual, rol: "USUARIO" }, actor),
            (error) => error instanceof AdministrationError && error.status === 403);
    });
    it("todas falsas y rol ADMIN → no lanza", () => {
        assert.doesNotThrow(() => requireAdministratorSession(actual, actor));
    });
    it("requireAdministrator tolera actor indefinido (?.)", () => {
        assert.throws(() => requireAdministrator(undefined), { code: "ADMIN_REQUIRED" });
    });
});
