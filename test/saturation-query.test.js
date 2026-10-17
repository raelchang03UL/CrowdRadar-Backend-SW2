import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
process.env.JWT_SECRET = "hu32-test-only-not-a-real-secret";
const { default: app } = await import("../app.js");
const { default: repository } = await import("../src/repositories/SaturationQueryRepository.js");
const { default: userRepository } = await import("../src/repositories/UserRepository.js");
const { default: sequelize } = await import("../src/config/database.js");
const { default: jwt } = await import("../src/utils/jwt.js");
const { evaluateSaturation, parsePlaceId, saturationPolicy } = await import("../src/services/SaturationQueryService.js");
const evaluatedAt = "2026-10-11T15:00:00.000Z";
const reporte = (userId, level, createdAt = "2026-10-11T14:50:00.000Z", id = userId) => ({ userId, level, createdAt, id: String(id) });
const evaluar = (votes) => evaluateSaturation({ placeId: -310001, evaluatedAt, votes });
const tres = (nivel) => [1, 2, 3].map((id) => reporte(id, nivel));
let server, base, snapshot;
const originales = { query: repository.findActiveSnapshot, session: userRepository.findSessionById };
before(() => {
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}/api/places`;
});
beforeEach(() => {
    snapshot = { placeId: -310001, evaluatedAt, votes: tres("TRANQUILO") };
    repository.findActiveSnapshot = async (id) => ({ ...snapshot, placeId: id });
    userRepository.findSessionById = async () => ({ id: 1, status: "ACTIVO", rol: "USUARIO", sessionVersion: 0 });
});
after(async () => {
    repository.findActiveSnapshot = originales.query;
    userRepository.findSessionById = originales.session;
    await new Promise((resolve) => server.close(resolve));
});
const consultar = (id = "-310001", token = jwt.generateToken({ id: 1, sessionVersion: 0 })) =>
    fetch(`${base}/${id}/saturation`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test("HU 3.2 exige tres personas distintas: 0, 1 y 2 no dan un nivel", () => {
    for (let cantidad = 0; cantidad < 3; cantidad++) {
        const resultado = evaluar(tres("TRANQUILO").slice(0, cantidad));
        assert.equal(resultado.level, null);
        assert.equal(resultado.reason, "INSUFFICIENT_REPORTS");
        assert.equal(resultado.reportCount, cantidad);
        assert.equal(resultado.updatedAt, cantidad ? "2026-10-11T14:50:00.000Z" : null);
    }
    assert.deepEqual(saturationPolicy, { minimumReports: 3, windowMinutes: 30 });
});
test("HU 3.2 reconoce cada nivel y usa más votos, sin exigir mayoría absoluta", () => {
    for (const nivel of ["TRANQUILO", "MODERADO", "SATURADO"]) {
        assert.equal(evaluar(tres(nivel)).level, nivel);
        assert.equal(evaluar(tres(nivel)).reason, null);
    }
    const resultado = evaluar([reporte(1, "SATURADO"), reporte(2, "SATURADO"), reporte(3, "MODERADO"), reporte(4, "TRANQUILO")]);
    assert.equal(resultado.level, "SATURADO");
    assert.equal(resultado.reportCount, 4);
});
test("HU 3.2 una persona no suma varios votos y su último reporte reemplaza el anterior", () => {
    assert.equal(evaluar([reporte(1, "TRANQUILO"), reporte(1, "TRANQUILO"), reporte(1, "TRANQUILO")]).reportCount, 1);
    const resultado = evaluar([...tres("TRANQUILO"), reporte(1, "SATURADO", "2026-10-11T14:59:00.000Z", 8), reporte(2, "SATURADO", "2026-10-11T14:59:30.000Z", 9)]);
    assert.equal(resultado.level, "SATURADO");
    assert.equal(resultado.reportCount, 3);
    assert.equal(resultado.updatedAt, "2026-10-11T14:59:30.000Z");
});
test("HU 3.2 empate a tres niveles o entre dos devuelve sin información suficiente", () => {
    for (const votos of [
        [reporte(1, "TRANQUILO"), reporte(2, "MODERADO"), reporte(3, "SATURADO")],
        [reporte(1, "TRANQUILO"), reporte(2, "TRANQUILO"), reporte(3, "SATURADO"), reporte(4, "SATURADO")]
    ]) {
        const resultado = evaluar(votos);
        assert.equal(resultado.level, null);
        assert.equal(resultado.reason, "TIE");
        assert.notEqual(resultado.updatedAt, null);
    }
});
test("HU 3.2 ventana inclusiva y exclusión de vencidos o futuros", () => {
    const resultado = evaluar([
        reporte(1, "MODERADO", "2026-10-11T14:30:00.000Z"),
        reporte(2, "MODERADO", "2026-10-11T15:00:00.000Z"),
        reporte(3, "TRANQUILO"),
        reporte(4, "SATURADO", "2026-10-11T14:29:59.999Z"),
        reporte(5, "SATURADO", "2026-10-11T15:00:00.001Z")
    ]);
    assert.equal(resultado.reportCount, 3);
    assert.equal(resultado.level, "MODERADO");
    assert.equal(resultado.updatedAt, evaluatedAt);
    // Un reporte futuro no sustituye el último reporte válido de esa persona.
    assert.equal(evaluar([...tres("TRANQUILO"), reporte(1, "SATURADO", "2026-10-11T15:01:00.000Z", 10)]).level, "TRANQUILO");
});
test("HU 3.2 misma fecha usa mayor ID sin perder precisión BIGSERIAL", () => {
    const votos = [reporte(2, "SATURADO"), reporte(3, "MODERADO"), reporte(1, "SATURADO", "2026-10-11T14:50:00.000Z", "9007199254740993"), reporte(1, "TRANQUILO", "2026-10-11T14:50:00.000Z", "9007199254740992")];
    assert.equal(evaluar(votos).level, "SATURADO");
    assert.equal(evaluar(votos).reportCount, 3);
    assert.equal(evaluar(votos.reverse()).level, "SATURADO");
});
test("HU 3.2 ID admite demos negativos y los límites de INTEGER", () => {
    for (const valor of ["1", "-310001", "-2147483648", "2147483647"]) assert.equal(parsePlaceId(valor), Number(valor));
    for (const valor of ["0", "-0", "01", "+1", "1.2", "1e2", "NaN", "2147483648", "-2147483649", "1 OR 1=1", " 1", "", undefined, 1]) assert.equal(parsePlaceId(valor), null);
});
test("HU 3.2 datos almacenados inválidos no fabrican una estimación", () => {
    assert.throws(() => evaluateSaturation({ placeId: 0, evaluatedAt, votes: [] }));
    assert.throws(() => evaluateSaturation({ placeId: 1, evaluatedAt: null, votes: [] }));
    for (const cambio of [{ level: "DESCONOCIDO" }, { userId: null }, { createdAt: "invalida" }, { id: "abc" }]) {
        assert.throws(() => evaluar([{ ...reporte(1, "TRANQUILO"), ...cambio }]));
    }
});
test("HU 3.2 GET exige JWT, sesión activa y versión vigente, incluso para datos vacíos", async () => {
    snapshot.votes = [];
    assert.equal((await consultar("1", null)).status, 401);
    assert.equal((await consultar("1", "token-invalido")).status, 401);
    for (const usuario of [null, { id: 1, status: "INACTIVO", sessionVersion: 0 }, { id: 1, status: "ACTIVO", sessionVersion: 1 }]) {
        userRepository.findSessionById = async () => usuario;
        const respuesta = await consultar();
        assert.equal(respuesta.status, 401);
        assert.equal(respuesta.headers.get("cache-control"), "no-store");
    }
});
test("HU 3.2 GET devuelve solo el DTO acordado y no se cachea", async () => {
    const respuesta = await consultar();
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
    assert.deepEqual(await respuesta.json(), { data: evaluar(tres("TRANQUILO")) });
});
test("HU 3.2 GET conserva 200 para insuficiencia y empate, sin inventar un nivel", async () => {
    for (const votos of [[], [reporte(1, "SATURADO")], [reporte(1, "TRANQUILO"), reporte(2, "MODERADO"), reporte(3, "SATURADO")]]) {
        snapshot.votes = votos;
        const respuesta = await consultar();
        assert.equal(respuesta.status, 200);
        assert.deepEqual(await respuesta.json(), { data: evaluar(votos) });
    }
});
test("HU 3.2 GET ID inválido da 400 sin consultar DB", async () => {
    repository.findActiveSnapshot = () => assert.fail("No debe consultar con ID inválido");
    for (const id of ["0", "1.5", "2147483648", "abc"]) {
        const respuesta = await consultar(id);
        assert.equal(respuesta.status, 400);
        assert.equal((await respuesta.json()).code, "PLACE_ID_INVALID");
    }
});
test("HU 3.2 GET inexistente o inactivo da el mismo 404", async () => {
    repository.findActiveSnapshot = async () => null;
    const respuesta = await consultar();
    assert.equal(respuesta.status, 404);
    assert.deepEqual(await respuesta.json(), { message: "El lugar no existe o no está disponible.", code: "PLACE_NOT_FOUND" });
});
test("HU 3.2 fallos SQL y de sesión dan 503 público, sin internos", async () => {
    for (const tipo of ["consulta", "sesion"]) {
        if (tipo === "consulta") repository.findActiveSnapshot = async () => { throw new Error("secret-sql-password"); };
        else userRepository.findSessionById = async () => { throw new Error("secret-sql-password"); };
        const respuesta = await consultar();
        assert.equal(respuesta.status, 503);
        assert.equal(respuesta.headers.get("cache-control"), "no-store");
        const cuerpo = await respuesta.json();
        assert.equal(cuerpo.code, "SERVICE_UNAVAILABLE");
        assert.ok(!JSON.stringify(cuerpo).includes("secret-sql-password"));
    }
});
test("HU 3.2 repositorio usa una lectura parametrizada, activos y último voto determinístico", async () => {
    const query = sequelize.query;
    try {
        let llamadas = 0;
        sequelize.query = async (sql, options) => {
            llamadas++;
            assert.match(sql, /WITH reloj AS MATERIALIZED/);
            assert.match(sql, /statement_timestamp\(\)/);
            assert.match(sql, /activo = TRUE/);
            assert.match(sql, /DISTINCT ON \(r.user_id\)/);
            assert.match(sql, /r.created_at >=/);
            assert.match(sql, /r.created_at <=/);
            assert.match(sql, /r.created_at DESC, r.id DESC/);
            assert.deepEqual(options.replacements, { placeId: -310001, windowMinutes: 30 });
            return [snapshot];
        };
        assert.deepEqual(await originales.query(-310001), snapshot);
        assert.equal(llamadas, 1);
        sequelize.query = async () => [];
        assert.equal(await originales.query(1), null);
    } finally { sequelize.query = query; }
});
