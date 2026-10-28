import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Op } from "sequelize";
process.env.JWT_SECRET = "place-details-test-not-a-real-secret";
const { default: app } = await import("../app.js");
const { default: repository, literalNamePattern } = await import("../src/repositories/PlaceRepository.js");
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

test("HU 3.4 requiere sesión para buscar lugares", async () => {
    assert.equal((await request("?nombre=Parque", false)).status, 401);
});
test("HU 3.4 recorta búsqueda, conserva todas las coincidencias y permite vacío", async () => {
    repository.findActive = async ({ nombre }) => {
        assert.equal(nombre, "Parque");
        return [lugar, { ...lugar, id: 2, nombre: "Otro Parque" }];
    };
    assert.equal((await (await request("?nombre=%20Parque%20")).json()).data.length, 2);
    repository.findActive = async ({ nombre }) => { assert.equal(nombre, ""); return []; };
    assert.deepEqual(await (await request("?nombre=%20%20")).json(), { data: [] });
});
test("HU 3.4 consulta sin coincidencias responde 200 lista vacía", async () => {
    const response = await request("?nombre=inexistente");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: [] });
});
test("HU 3.4 rechaza consulta larga, repetida y parámetros extra", async () => {
    repository.findActive = async () => assert.fail("No debe consultar");
    for (const query of [`?nombre=${"a".repeat(161)}`, "?nombre=a&nombre=b", "?nombre[x]=a", "?extra=Parque"]) {
        assert.equal((await request(query)).status, 400);
    }
});
test("HU 3.4 error de búsqueda no filtra información interna", async () => {
    repository.findActive = async () => { throw new Error("SQL technical"); };
    const response = await request("?nombre=Parque");
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { message: "No se pudieron cargar los lugares. Inténtalo de nuevo." });
});

test("HU 3.4 repositorio busca nombre literal y conserva todos los activos", async () => {
    assert.equal(literalNamePattern("50%_\\"), "%50\\%\\_\\\\%");
    const findAll = Place.findAll;
    try {
        Place.findAll = async (options) => {
            assert.equal(options.where.activo, true);
            assert.equal(options.where.nombre[Op.iLike], "%50\\%\\_\\\\%");
            assert.deepEqual(options.order, [["id", "ASC"]]);
            return [];
        };
        await original.list({ nombre: "50%_\\" });
    } finally { Place.findAll = findAll; }
});
