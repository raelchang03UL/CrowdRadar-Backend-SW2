import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "hu35-test-only-not-a-real-secret";
const { default: app } = await import("../app.js");
const { default: repositorio } = await import("../src/repositories/PlaceRepository.js");
const { default: usuarios } = await import("../src/repositories/UserRepository.js");
const { default: servicio } = await import("../src/services/PlaceService.js");
const { default: Place } = await import("../src/models/Place.js");
const { default: jwt } = await import("../src/utils/jwt.js");
const originales = {
    findActive: repositorio.findActive,
    findActiveCategories: repositorio.findActiveCategories,
    findSessionById: usuarios.findSessionById
};
const lugares = [
    { id: -103, nombre: "Demo · Parque", categoria: "Parque", referencia: null, latitud: -12, longitud: -77, activo: true, demostrativo: true },
    { id: -102, nombre: "Demo · Museo", categoria: "Cultura", referencia: null, latitud: -12.1, longitud: -77.1, activo: true, demostrativo: true },
    { id: -101, nombre: "Demo · Otro parque", categoria: "Parque", referencia: null, latitud: -12.2, longitud: -77.2, activo: true, demostrativo: true }
];
let servidor, url, llamadas;
before(() => {
    usuarios.findSessionById = async () => ({ id: 1, status: "ACTIVO", rol: "USUARIO", sessionVersion: 0 });
    servidor = app.listen(0);
    url = `http://127.0.0.1:${servidor.address().port}/api/places`;
});
beforeEach(() => {
    llamadas = [];
    repositorio.findActive = async (categoria) => {
        llamadas.push(categoria);
        return lugares.filter((lugar) => !categoria || lugar.categoria === categoria);
    };
    repositorio.findActiveCategories = async () => [{ categoria: "Cultura" }, { categoria: "Parque" }];
});
after(async () => {
    Object.assign(repositorio, { findActive: originales.findActive, findActiveCategories: originales.findActiveCategories });
    usuarios.findSessionById = originales.findSessionById;
    await new Promise((resolve, reject) => servidor.close((error) => error ? reject(error) : resolve()));
});
const solicitar = (ruta = "", token = jwt.generateToken({ id: 1, sessionVersion: 0 })) =>
    fetch(url + ruta, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
const datosPublicos = ({ activo, ...lugar }) => lugar;

test("HU 3.5 exige sesión en catálogo y lista filtrada", async () => {
    for (const ruta of ["/categories", "?categoria=Parque"]) {
        assert.equal((await solicitar(ruta, null)).status, 401);
        assert.equal((await solicitar(ruta, "token-invalido-de-prueba")).status, 401);
    }
    assert.deepEqual(llamadas, []);
});

test("HU 3.5 catálogo entrega solo textos públicos y admite catálogo vacío", async () => {
    let respuesta = await solicitar("/categories");
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), { data: ["Cultura", "Parque"] });
    repositorio.findActiveCategories = async () => [];
    respuesta = await solicitar("/categories");
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), { data: [] });
});

test("HU 3.5 cambiar categoría reemplaza resultados y ninguna coincidencia devuelve lista vacía", async () => {
    for (const categoria of ["Parque", "Cultura", "Desconocida", "parque"]) {
        const respuesta = await solicitar(`?categoria=${encodeURIComponent(categoria)}`);
        assert.equal(respuesta.status, 200);
        assert.deepEqual(await respuesta.json(), {
            data: lugares.filter((lugar) => lugar.categoria === categoria).map(datosPublicos)
        });
    }
    assert.deepEqual(llamadas, ["Parque", "Cultura", "Desconocida", "parque"]);
});

test("HU 3.5 sin categoría, vacío o espacios restaura todos los lugares", async () => {
    for (const ruta of ["", "?categoria=", "?categoria=%20%20", "?categoria=%20Parque%20"]) {
        const respuesta = await solicitar(ruta);
        assert.equal(respuesta.status, 200);
        const categoria = ruta.endsWith("Parque%20") ? "Parque" : "";
        assert.deepEqual(await respuesta.json(), { data: lugares.filter((lugar) => !categoria || lugar.categoria === categoria).map(datosPublicos) });
    }
    assert.deepEqual(llamadas, ["", "", "", "Parque"]);
});

test("HU 3.5 rechaza extras, arreglos, repetidos y más de 80 caracteres antes del repositorio", async () => {
    for (const consulta of [
        "?nombre=Parque", "?categoria=Parque&extra=1", "?categoria=Parque&categoria=Cultura",
        "?categoria[]=Parque", "?categoria[x]=Parque", `?categoria=${"a".repeat(81)}`
    ]) {
        const respuesta = await solicitar(consulta);
        assert.equal(respuesta.status, 400);
        assert.deepEqual(await respuesta.json(), { message: "La categoría debe ser un único texto de hasta 80 caracteres." });
    }
    assert.deepEqual(llamadas, []);
    assert.equal((await solicitar("/categories?categoria=Parque")).status, 400);
});

test("HU 3.5 límite Unicode, comodines e intento SQL se tratan como texto literal", async () => {
    for (const categoria of ["a".repeat(80), "🟢".repeat(80), "%", "_", "\\", "Parque' OR TRUE --"]) {
        const respuesta = await solicitar(`?categoria=${encodeURIComponent(categoria)}`);
        assert.equal(respuesta.status, 200);
        assert.deepEqual(await respuesta.json(), { data: [] });
        assert.equal(llamadas.at(-1), categoria);
    }
});

test("HU 3.5 fallos de catálogo y filtro ocultan excepciones internas", async () => {
    repositorio.findActive = repositorio.findActiveCategories = async () => { throw new Error("credencial-db-interna"); };
    for (const [ruta, mensaje] of [
        ["?categoria=Parque", "No se pudieron cargar los lugares. Inténtalo de nuevo."],
        ["/categories", "No se pudieron cargar las categorías. Inténtalo de nuevo."]
    ]) {
        const respuesta = await solicitar(ruta);
        assert.equal(respuesta.status, 503);
        assert.deepEqual(await respuesta.json(), { message: mensaje });
    }
});

test("HU 3.5 repositorio usa igualdad ORM, activos y órdenes determinísticos", async () => {
    const findAll = Place.findAll;
    try {
        const opciones = [];
        Place.findAll = async (consulta) => { opciones.push(consulta); return []; };
        await originales.findActive("Parque' OR TRUE --");
        await originales.findActive("");
        await originales.findActiveCategories();
        assert.deepEqual(opciones, [
            { where: { activo: true, categoria: "Parque' OR TRUE --" }, order: [["id", "ASC"]], raw: true },
            { where: { activo: true }, order: [["id", "ASC"]], raw: true },
            { attributes: ["categoria"], where: { activo: true }, group: ["categoria"], order: [["categoria", "ASC"]], raw: true }
        ]);
    } finally { Place.findAll = findAll; }
});

test("HU 3.5 servicio mantiene DTO mínimo y rechaza etiquetas de categoría corruptas", async () => {
    assert.deepEqual(await servicio.listActive("Parque"), lugares.filter((lugar) => lugar.categoria === "Parque").map(datosPublicos));
    for (const categoria of [null, 4, "", "   ", " Parque ", "a".repeat(81)]) {
        repositorio.findActiveCategories = async () => [{ categoria }];
        await assert.rejects(servicio.listActiveCategories(), /Categoría de lugar inválida/);
    }
});
