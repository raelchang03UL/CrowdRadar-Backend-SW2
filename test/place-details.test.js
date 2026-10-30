import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
process.env.JWT_SECRET = "place-details-test-not-a-real-secret";
const { default: app } = await import("../app.js");
const { default: repository } = await import("../src/repositories/PlaceRepository.js");
const { default: users } = await import("../src/repositories/UserRepository.js");
const { default: Place } = await import("../src/models/Place.js");
const { default: jwt } = await import("../src/utils/jwt.js");
const original = { list: repository.findActive, detail: repository.findActiveById, session: users.findSessionById };
const lugar = { id: -103, nombre: "Demo · Parque Central", categoria: "Parque", direccion: "Dirección de prueba", referencia: "Referencia", latitud: -12.04, longitud: -77.04, activo: true, demostrativo: true };
let server, url;
before(async () => {
    users.findSessionById = async () => ({ id: 1, status: "ACTIVO", rol: "USUARIO", sessionVersion: 0 });
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    url = `http://127.0.0.1:${server.address().port}/api/places`;
});
beforeEach(() => {
    repository.findActive = async () => [];
    repository.findActiveById = async () => lugar;
});
after(async () => {
    repository.findActive = original.list;
    repository.findActiveById = original.detail;
    users.findSessionById = original.session;
    await new Promise((resolve) => server.close(resolve));
});
const request = (path = "", authenticated = true) => fetch(`${url}${path}`, {
    headers: authenticated ? { Authorization: `Bearer ${jwt.generateToken({ id: 1, email: "test@example.com", sessionVersion: 0 })}` } : {}
});

test("HU 3.3 requiere sesión para consultar el detalle", async () => {
    assert.equal((await request("/-103", false)).status, 401);
});
test("HU 3.3 acepta ID demo negativo y devuelve dirección sin estado interno", async () => {
    repository.findActiveById = async (id) => { assert.equal(id, -103); return lugar; };
    const response = await request("/-103");
    const { activo, ...publico } = lugar;
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { ...publico, esFavorito: false } });
});
test("HU 3.3 dirección antigua queda null, no se sustituye por referencia", async () => {
    repository.findActiveById = async () => ({ ...lugar, direccion: undefined });
    assert.equal((await (await request("/-103")).json()).data.direccion, null);
});
test("HU 3.3 inexistente o inactivo responde 404", async () => {
    repository.findActiveById = async () => null;
    const response = await request("/99");
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { message: "El lugar no está disponible." });
});
test("HU 3.3 valida ID antes de acceder al repositorio", async () => {
    repository.findActiveById = async () => assert.fail("ID inválido no debe consultar");
    for (const id of ["0", "abc", "1.5", "01", "2147483648", "-2147483649", "1e2"]) {
        assert.equal((await request(`/${id}`)).status, 400);
    }
});
test("HU 3.3 fallos de DB y coordenadas devuelven error público", async () => {
    for (const load of [async () => { throw new Error("SQL internal"); }, async () => ({ ...lugar, latitud: NaN })]) {
        repository.findActiveById = load;
        const response = await request("/-103");
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { message: "No se pudo cargar la información del lugar. Inténtalo de nuevo." });
    }
});test("HU 3.3 repositorio filtra lugares activos por ID", async () => {
    const findOne = Place.findOne;
    try {
        Place.findOne = async (options) => {
            assert.deepEqual(options, { where: { id: -103, activo: true }, raw: true });
            return null;
        };
        await original.detail(-103);
    } finally { Place.findOne = findOne; }
});

// HU8 añade estado privado a lista/detalle; este doble conserva la prueba aislada de HU previas.
const { default: favoriteStateRepository } = await import("../src/repositories/FavoriteRepository.js");
const originalFavoriteStateLookup = favoriteStateRepository.findPlaceIdsByUser;
test.before(() => { favoriteStateRepository.findPlaceIdsByUser = async () => []; });
test.after(() => { favoriteStateRepository.findPlaceIdsByUser = originalFavoriteStateLookup; });
