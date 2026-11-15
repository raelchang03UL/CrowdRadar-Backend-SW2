// PRUEBAS DE INTEGRACIÓN — ESTRATEGIA BIG BANG con PostgreSQL REAL
//
// Todos los componentes reales se integran a la vez —HTTP, rutas, middlewares,
// controladores, servicios, repositorios y PostgreSQL— y se prueba el sistema en conjunto,
// sin Stubs ni Drivers. Si algo falla, el diagnóstico es más difícil (desventaja descrita
// en la PPT); por eso se ejecuta DESPUÉS de las suites Top-Down y Bottom-Up.
//
// Requiere .env.test con TEST_DB_USER y TEST_DB_PASSWORD; sin ellos la suite se OMITE.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { configuracionPruebas, recrearBaseDeDatos, migrarEsquema, insertarLugares, eliminarBaseDeDatos } from "../../helpers/baseDatosIntegracion.js";

const config = configuracionPruebas("bigbang");
const omitir = config.omitir ?? false;
let sequelize, server, base;

before(async () => {
    if (omitir) return;
    await recrearBaseDeDatos(config);
    sequelize = (await import("../../../src/config/database.js")).default;
    await migrarEsquema(sequelize);
    await insertarLugares(sequelize);
    // Se usa la misma inicialización que el servidor real: valida entorno y esquema.
    const { initializeApplication } = await import("../../../app.js");
    const { app } = await initializeApplication();
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (omitir) return;
    await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
    await eliminarBaseDeDatos(config);
});

async function llamar(ruta, { method = "GET", body, token } = {}) {
    const respuesta = await fetch(`${base}${ruta}`, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const texto = await respuesta.text();
    return { status: respuesta.status, body: texto ? JSON.parse(texto) : null };
}

async function registrarYEntrar(alias) {
    const email = `${alias}@bigbang.test`;
    const registro = await llamar("/api/auth/register", { method: "POST", body: { nombre: "Ciudadano", apellido: alias, email, password: "ClaveSegura1", distrito: "Lima" } });
    assert.equal(registro.status, 201, JSON.stringify(registro.body));
    const login = await llamar("/api/auth/login", { method: "POST", body: { email, password: "ClaveSegura1" } });
    assert.equal(login.status, 200);
    return { id: registro.body.data.id, token: login.body.data.token };
}

describe("Big Bang — sistema completo sobre PostgreSQL", { skip: omitir }, () => {
    let ana, beto, carla;

    it("la API arranca con el esquema migrado (health/ready)", async () => {
        const { status, body } = await llamar("/health/ready");
        assert.equal(status, 200);
        assert.deepEqual(body, { ready: true });
    });

    it("tres ciudadanos se registran e inician sesión", async () => {
        ana = await registrarYEntrar("ana");
        beto = await registrarYEntrar("beto");
        carla = await registrarYEntrar("carla");
        const perfil = await llamar("/api/users/profile", { token: ana.token });
        assert.equal(perfil.body.data.email, "ana@bigbang.test");
    });

    it("catálogo: categorías, búsqueda y detalle", async () => {
        assert.deepEqual((await llamar("/api/places/categories", { token: ana.token })).body.data, ["Mercado", "Parque", "Plaza"]);
        const busqueda = await llamar("/api/places?nombre=mercado", { token: ana.token });
        assert.deepEqual(busqueda.body.data.map((l) => l.nombre), ["Mercado Central"]);
        assert.equal((await llamar("/api/places/3", { token: ana.token })).body.data.categoria, "Mercado");
        assert.equal((await llamar("/api/places/999", { token: ana.token })).status, 404);
    });

    it("reportes de los tres ciudadanos → nivel de saturación, karma y filtro por nivel", async () => {
        for (const ciudadano of [ana, beto, carla]) {
            const respuesta = await llamar("/api/places/3/reports", { method: "POST", body: { level: "SATURADO" }, token: ciudadano.token });
            assert.equal(respuesta.status, 201);
        }
        assert.equal((await llamar("/api/places/3/reports", { method: "POST", body: { level: "SATURADO" }, token: ana.token })).status, 409);

        const saturacion = await llamar("/api/places/3/saturation", { token: beto.token });
        assert.deepEqual([saturacion.body.data.level, saturacion.body.data.reportCount], ["SATURADO", 3]);
        assert.equal((await llamar("/api/users/karma", { token: ana.token })).body.data.karmaPoints, 10);
        assert.deepEqual((await llamar("/api/places?nivel=SATURADO", { token: ana.token })).body.data.map((l) => l.id), [3]);
    });

    it("favoritos: agregar, consultar, duplicado y eliminar", async () => {
        assert.equal((await llamar("/api/places/2/favorite", { method: "POST", token: carla.token })).status, 201);
        assert.equal((await llamar("/api/places/2/favorite", { method: "POST", token: carla.token })).status, 409);
        assert.deepEqual((await llamar("/api/places/favorites", { token: carla.token })).body.data.map((l) => l.id), [2]);
        assert.equal((await llamar("/api/places/2/favorite", { method: "DELETE", token: carla.token })).status, 204);
        assert.deepEqual((await llamar("/api/places/favorites", { token: carla.token })).body.data, []);
    });

    it("validación comunitaria: otro ciudadano confirma un reporte y no puede repetir", async () => {
        const [reporte] = (await llamar("/api/users/reports", { token: ana.token })).body.data;
        const voto = await llamar(`/api/reports/${reporte.id}/validations`, { method: "POST", body: { decision: "CONFIRM" }, token: beto.token });
        assert.equal(voto.status, 201, JSON.stringify(voto.body));
        const repetido = await llamar(`/api/reports/${reporte.id}/validations`, { method: "POST", body: { decision: "REJECT" }, token: beto.token });
        assert.equal(repetido.status, 409);
        const detalle = await llamar(`/api/reports/${reporte.id}`, { token: carla.token });
        assert.equal(detalle.body.data.confirmations, 1);
    });

    it("administración: un ADMIN suspende a un ciudadano, que ya no puede entrar ni usar su token", async () => {
        await sequelize.query("UPDATE public.users SET rol = 'ADMIN' WHERE id = :id", { replacements: { id: carla.id } });
        assert.equal((await llamar("/api/admin/users", { token: ana.token })).status, 403);

        const detalle = await llamar(`/api/admin/users/${beto.id}`, { token: carla.token });
        assert.equal(detalle.status, 200, JSON.stringify(detalle.body));
        const suspension = await llamar(`/api/admin/users/${beto.id}/suspend`, {
            method: "POST", token: carla.token,
            body: { reason: "Reportes falsos reiterados", expectedVersion: detalle.body.data.moderationVersion }
        });
        assert.equal(suspension.status, 200, JSON.stringify(suspension.body));

        assert.equal((await llamar("/api/users/profile", { token: beto.token })).status, 401);
        const login = await llamar("/api/auth/login", { method: "POST", body: { email: "beto@bigbang.test", password: "ClaveSegura1" } });
        assert.deepEqual([login.status, login.body.code], [403, "ACCOUNT_SUSPENDED"]);
    });

    it("rutas inexistentes y JSON mal formado responden JSON coherente", async () => {
        assert.equal((await llamar("/api/no-existe")).status, 404);
        const malo = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{malo" });
        assert.equal(malo.status, 400);
        assert.equal((await malo.json()).code, "INVALID_JSON");
    });
});
