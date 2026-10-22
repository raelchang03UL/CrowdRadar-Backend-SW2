import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
process.env.JWT_SECRET = "hu31-test-only-not-a-real-secret";
const { default: app } = await import("../app.js");
const { default: repository } = await import("../src/repositories/PlaceRepository.js");
const { default: userRepository } = await import("../src/repositories/UserRepository.js");
const { default: Place } = await import("../src/models/Place.js");
const { default: jwt } = await import("../src/utils/jwt.js");
const { seedPlacesDemo } = await import("../src/database/seedPlacesDemo.js");
let server, baseUrl, places;
const original = repository.findActive;
const originalSession = userRepository.findSessionById;
const validPlace = { id: 1, nombre: "Lugar de prueba", categoria: "Parque", referencia: "Prueba", direccion: "Dirección de prueba", latitud: -12.0464, longitud: -77.0428, activo: true, demostrativo: true };
before(() => {
    userRepository.findSessionById = async () => ({ id: 1, status: "ACTIVO", rol: "USUARIO", sessionVersion: 0 });
    repository.findActive = async () => places;
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}/api/places`;
});
beforeEach(() => { places = []; repository.findActive = async () => places; });
after(async () => {
    repository.findActive = original;
    userRepository.findSessionById = originalSession;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
const request = (token = jwt.generateToken({ id: 1, email: "test@example.com", sessionVersion: 0 })) =>
    fetch(baseUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test("HU 3.1 exige token y rechaza token inválido", async () => {
    assert.equal((await request(null)).status, 401);
    assert.equal((await request("invalid-test-token")).status, 401);
});
test("HU 3.1 devuelve lista vacía autenticada", async () => {
    const res = await request();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { data: [] });
});
test("HU 3.1 entrega coordenadas y campos mínimos sin datos internos", async () => {
    places = [validPlace];
    const res = await request();
    assert.equal(res.status, 200);
    const { activo, ...expected } = validPlace;
    assert.deepEqual(await res.json(), { data: [expected] });
});
test("HU 3.1 no expone coordenadas inválidas", async () => {
    for (const latitud of [91, -91, NaN, Infinity, null, "-12"]) {
        places = [{ ...validPlace, latitud }];
        const res = await request();
        assert.equal(res.status, 503);
        assert.equal((await res.json()).data, undefined);
    }
    places = [{ ...validPlace, longitud: 181 }];
    assert.equal((await request()).status, 503);
});
test("HU 3.1 error de repositorio devuelve mensaje público sin excepción", async () => {
    repository.findActive = async () => { throw new Error("internal-db-host-detail"); };
    const res = await request();
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { message: "No se pudieron cargar los lugares. Inténtalo de nuevo." });
});
test("HU 3.1 fixture rechaza entrega y host externo antes de conectar", async () => {
    for (const config of [
        { host: "localhost", database: "crowdradar_sprint1" },
        { host: "remote.example.com", database: "crowdradar_dev" }
    ]) {
        await assert.rejects(seedPlacesDemo({ config, transaction: () => assert.fail("No debe conectar") }), /solo admite/);
    }
});

test("HU 3.1 repositorio solicita solo activos en orden determinístico", async () => {
    const findAll = Place.findAll;
    try {
        Place.findAll = async (options) => {
            assert.deepEqual(options, { where: { activo: true }, order: [["id", "ASC"]], raw: true });
            return [];
        };
        assert.deepEqual(await original(), []);
    } finally { Place.findAll = findAll; }
});

test("HU 3.1 modelo rechaza coordenadas inválidas sin conectar DB", async () => {
    for (const latitud of [-91, 91, NaN, Infinity, null]) {
        await assert.rejects(Place.build({ ...validPlace, latitud }).validate());
    }
});
