import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SaturationReportService } from "../src/services/SaturationReportService.js";
import { assertKarmaSchemaReady } from "../src/database/migrateKarma.js";
import { assertConsolidatedReportsSchemaReady } from "../src/database/migrateReportCompatibility.js";
import { assertIsolatedConsolidationDatabase } from "../src/database/databaseSafety.js";
import app from "../app.js";
import users from "../src/repositories/UserRepository.js";
import reports from "../src/repositories/SaturationReportRepository.js";
import places from "../src/repositories/PlaceRepository.js";
import jwt from "../src/utils/jwt.js";

// Se firman únicamente tokens sintéticos; la suite no necesita un .env privado.
const previousJwtSecret = process.env.JWT_SECRET;
before(() => { process.env.JWT_SECRET = "synthetic-consolidation-only-not-for-deployment"; });
after(() => {
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
});

test("reporte valida ID y nivel antes de persistir; reusa regla aprobada 10/3", async () => {
    const calls = [];
    const service = new SaturationReportService({ create: async (options) => { calls.push(options); return { kind: "CREATED", report: { id: "1" } }; } });
    for (const placeId of [0, NaN, 1.5, 2147483648]) await assert.rejects(service.create({ placeId, level: "TRANQUILO" }), { code: "INVALID_PLACE" });
    await assert.rejects(service.create({ placeId: -701, level: "OTRO" }), { code: "INVALID_REPORT_LEVEL" });
    assert.equal(calls.length, 0);
    await service.create({ userId: 1, sessionVersion: 2, placeId: -701, level: "TRANQUILO" });
    assert.equal(calls[0].points, 10); assert.equal(calls[0].cooldownMinutes, 3);
});
test("reporte distingue duplicado y lugar inexistente; no asume éxito de respuesta desconocida", async () => {
    for (const [kind, code] of [["REPORT_COOLDOWN", "REPORT_COOLDOWN"], ["PLACE_NOT_FOUND", "PLACE_NOT_FOUND"]]) {
        const service = new SaturationReportService({ create: async () => ({ kind }) });
        await assert.rejects(service.create({ placeId: -1, level: "MODERADO" }), { code });
    }
    await assert.rejects(new SaturationReportService({ create: async () => ({ kind: "OTHER" }) }).create({ placeId: -1, level: "MODERADO" }));
});
for (const [name, guard, history] of [
    ["karma", assertKarmaSchemaReady, [{ name: "006-report-karma-ledger" }]],
    ["reportes", assertConsolidatedReportsSchemaReady, [{ name: "004-create-saturation-reports" }, { name: "005-reconcile-report-schema" }]]
]) {
    test(`${name}: readiness solo lee y no revela errores internos`, async () => {
        const calls = [];
        await guard({ query: async (sql) => { calls.push(sql); assert.match(sql, /^SELECT /); return history; } });
        assert.ok(calls.length > 1);
        for (const query of [async () => [], async () => { throw new Error("private SQL"); }]) {
            await assert.rejects(guard({ query }), (error) => error.code === "SCHEMA_NOT_READY" && !error.message.includes("private"));
        }
    });
}
test("QA no permite desarrollo, entrega, destino remoto ni nombres parecidos", () => {
    for (const config of [
        { host: "localhost", database: "crowdradar_dev" }, { host: "localhost", database: "crowdradar_sprint1" },
        { host: "db.example", database: "crowdradar_consolidacion_fresh_20261017" },
        { host: "localhost", database: "crowdradar_consolidacion_fresh_20261017_extra" }
    ]) assert.throws(() => assertIsolatedConsolidationDatabase({ config }));
});

const originals = { session: users.findSessionById, profile: users.findById, update: users.update, karma: users.findKarmaPoints, create: reports.create, places: places.findActiveWithSaturation };
let server, root;
before(() => { server = app.listen(0); root = `http://127.0.0.1:${server.address().port}`; });
beforeEach(() => { users.findSessionById = async () => ({ id: 1, status: "ACTIVO", sessionVersion: 0 }); });
after(async () => {
    Object.assign(users, { findSessionById: originals.session, findById: originals.profile, update: originals.update, findKarmaPoints: originals.karma });
    reports.create = originals.create; places.findActiveWithSaturation = originals.places;
    await new Promise((resolve) => server.close(resolve));
});
const request = (path, method = "GET", body) => fetch(root + path, { method,
    headers: { Authorization: `Bearer ${jwt.generateToken({ id: 1, sessionVersion: 0 })}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}) });
test("perfil/karma/edición no devuelven errores de persistencia al ciudadano", async () => {
    users.findById = users.update = users.findKarmaPoints = async () => { throw new Error("private SQL password hash"); };
    for (const [path, method, body] of [["/api/users/profile", "GET"], ["/api/users/karma", "GET"], ["/api/users/profile", "PUT", { nombre: "QA Nombre" }]]) {
        const response = await request(path, method, body); assert.equal(response.status, 503);
        assert.doesNotMatch(await response.text(), /private|SQL|password|hash/);
    }
});
test("perfil convierte BIGINT PostgreSQL a entero público sin secretos ni truncamiento", async () => {
    users.findById = async () => ({ id: 1, nombre: "QA", karmaPoints: "10", passwordHash: "private", sessionVersion: 0 });
    let response = await request("/api/users/profile");
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.karmaPoints, 10); assert.equal(data.passwordHash, undefined); assert.equal(data.sessionVersion, undefined);
    users.findById = async () => ({ id: 1, karmaPoints: "9007199254740992" });
    response = await request("/api/users/profile"); assert.equal(response.status, 503);
});
test("HTTP combina tres filtros, recorta textos y mantiene DTO explícito", async () => {
    places.findActiveWithSaturation = async (options) => {
        assert.equal(options.nombre, "Parque"); assert.equal(options.categoria, "Cultura");
        const evaluatedAt = new Date();
        return [{ id: -1, nombre: "QA", categoria: "Cultura", referencia: null, direccion: null,
            latitud: -12, longitud: -77, demostrativo: true, activo: true, evaluatedAt,
            votes: [1, 2, 3].map((id) => ({ id: String(id), userId: id, level: "MODERADO", createdAt: evaluatedAt })) }];
    };
    const response = await request("/api/places?nombre=%20Parque%20&categoria=Cultura&nivel=MODERADO");
    assert.equal(response.status, 200); const { data } = await response.json();
    assert.equal(data.length, 1); assert.equal(data[0].activo, undefined); assert.equal(data[0].votes, undefined);
});

// HU8 añade estado privado a lista/detalle; este doble conserva la prueba aislada de HU previas.
const { default: favoriteStateRepository } = await import("../src/repositories/FavoriteRepository.js");
const originalFavoriteStateLookup = favoriteStateRepository.findPlaceIdsByUser;
test.before(() => { favoriteStateRepository.findPlaceIdsByUser = async () => []; });
test.after(() => { favoriteStateRepository.findPlaceIdsByUser = originalFavoriteStateLookup; });
