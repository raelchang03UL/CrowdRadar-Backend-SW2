import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jsonwebtoken from "jsonwebtoken";
process.env.JWT_SECRET = "hu36-test-only-not-a-real-secret";
const { default: app } = await import("../app.js");
const { default: repositorio } = await import("../src/repositories/PlaceRepository.js");
const { default: repositorioUsuario } = await import("../src/repositories/UserRepository.js");
const { default: sequelize } = await import("../src/config/database.js");
const { default: jwt } = await import("../src/utils/jwt.js");
const { default: servicio, parseSaturationFilter } = await import("../src/services/PlaceService.js");
const { saturationPolicy } = await import("../src/services/SaturationQueryService.js");
const instante = "2026-10-11T15:00:00.000Z";
const reporte = (userId, level, createdAt = "2026-10-11T14:50:00.000Z", id = userId) => ({ userId, level, createdAt, id: String(id) });
const tres = (nivel) => [1, 2, 3].map((id) => reporte(id, nivel));
const lugar = (id, votes) => ({ id, nombre: `Lugar ${id}`, categoria: "Parque", referencia: null,
    latitud: -12, longitud: -77, demostrativo: true, activo: true, evaluatedAt: instante, votes });
const dto = ({ id, nombre, categoria, referencia, latitud, longitud, demostrativo }) =>
    ({ id, nombre, categoria, referencia, direccion: null, latitud, longitud, demostrativo });
const originales = { todos: repositorio.findActive, niveles: repositorio.findActiveWithSaturation, sesion: repositorioUsuario.findSessionById };
let servidor, base, lugares, consultasTodos, consultasNiveles;
before(() => {
    servidor = app.listen(0);
    base = `http://127.0.0.1:${servidor.address().port}/api/places`;
});
beforeEach(() => {
    lugares = [lugar(-36, tres("TRANQUILO")), lugar(1, tres("MODERADO")), lugar(2, tres("SATURADO")),
        lugar(3, []), lugar(4, tres("TRANQUILO").slice(0, 2)),
        lugar(5, [reporte(1, "TRANQUILO"), reporte(2, "MODERADO"), reporte(3, "SATURADO")])];
    consultasTodos = 0;
    consultasNiveles = 0;
    repositorio.findActive = async () => { consultasTodos++; return lugares; };
    repositorio.findActiveWithSaturation = async (opciones) => {
        consultasNiveles++;
        assert.deepEqual(opciones, { nombre: "", categoria: "", nivel: opciones.nivel, windowMinutes: saturationPolicy.windowMinutes });
        return lugares;
    };
    repositorioUsuario.findSessionById = async () => ({ id: 1, status: "ACTIVO", rol: "USUARIO", sessionVersion: 0 });
});
after(async () => {
    repositorio.findActive = originales.todos;
    repositorio.findActiveWithSaturation = originales.niveles;
    repositorioUsuario.findSessionById = originales.sesion;
    await new Promise((resolve) => servidor.close(resolve));
});
const consultar = (consulta = "", token = jwt.generateToken({ id: 1, sessionVersion: 0 })) =>
    fetch(`${base}${consulta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test("HU 3.6 valida únicamente nivel, respeta mayúsculas y recorta sus extremos", () => {
    assert.equal(parseSaturationFilter({}), null);
    for (const nivel of ["", "  ", "\t\n"]) assert.equal(parseSaturationFilter({ nivel }), null);
    for (const nivel of ["TRANQUILO", "MODERADO", "SATURADO"]) assert.equal(parseSaturationFilter({ nivel: ` ${nivel} ` }), nivel);
    for (const consulta of [null, [], "TRANQUILO", { nivel: null }, { nivel: 3 }, { nivel: ["TRANQUILO"] },
        { nivel: {} }, { nivel: "tranquilo" }, { nivel: "TODOS" }, { nivel: "TRAN QUILO" }, { extra: "Parque" },
        { nivel: "TRANQUILO", extra: "x" }, { "nivel[]": "TRANQUILO" }, { nivel: "' OR 1=1 --" }]) {
        assert.throws(() => parseSaturationFilter(consulta), (error) => error.code === "SATURATION_FILTER_INVALID");
    }
});

test("HU 3.6 sin filtro, vacío y espacios conservan flujo original y DTO de lugares", async () => {
    for (const consulta of ["", "?nivel=", "?nivel=%20%20"]) {
        const respuesta = await consultar(consulta);
        assert.equal(respuesta.status, 200);
        assert.equal(respuesta.headers.get("cache-control"), "no-store");
        assert.deepEqual(await respuesta.json(), { data: lugares.map((place) => ({ ...dto(place), esFavorito: false })) });
    }
    assert.equal(consultasTodos, 3);
    assert.equal(consultasNiveles, 0);
});

test("HU 3.6 muestra cada nivel; insuficiencia y empate solo permanecen en Todos", async () => {
    for (const [nivel, id] of [["TRANQUILO", -36], ["MODERADO", 1], ["SATURADO", 2]]) {
        const respuesta = await consultar(`?nivel=${nivel}`);
        assert.equal(respuesta.status, 200);
        assert.deepEqual(await respuesta.json(), { data: [{ ...dto(lugares.find((fila) => fila.id === id)), esFavorito: false }] });
        assert.equal(respuesta.headers.get("cache-control"), "no-store");
    }
    assert.equal(consultasTodos, 0);
    assert.equal(consultasNiveles, 3);
});

test("HU 3.6 cambiar y quitar el filtro vuelve a consultar el listado correcto", async () => {
    assert.equal((await (await consultar("?nivel=TRANQUILO")).json()).data[0].id, -36);
    assert.equal((await (await consultar("?nivel=%20SATURADO%20")).json()).data[0].id, 2);
    assert.deepEqual((await (await consultar()).json()).data, lugares.map((place) => ({ ...dto(place), esFavorito: false })));
    assert.equal(consultasNiveles, 2);
    assert.equal(consultasTodos, 1);
});

test("HU 3.6 filtro sin coincidencias es 200 vacío, no error ni nivel inventado", async () => {
    lugares = [lugar(1, []), lugar(2, tres("MODERADO"))];
    const respuesta = await consultar("?nivel=TRANQUILO");
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), { data: [] });
    lugares = [];
    assert.deepEqual(await (await consultar("?nivel=SATURADO")).json(), { data: [] });
});

test("HU 3.6 reutiliza último voto, votos distintos y nivel más votado de HU 3.2 sin mayoría absoluta", async () => {
    lugares = [lugar(1, [reporte(1, "TRANQUILO"), reporte(1, "TRANQUILO"), reporte(1, "TRANQUILO")]),
        lugar(2, [reporte(1, "TRANQUILO"), reporte(1, "SATURADO", "2026-10-11T14:59:00.000Z", 20),
            reporte(2, "SATURADO"), reporte(3, "MODERADO"), reporte(4, "TRANQUILO")])];
    assert.deepEqual(await servicio.listActive({ nivel: "SATURADO" }), [dto(lugares[1])]);
    assert.deepEqual(await servicio.listActive({ nivel: "TRANQUILO" }), []);
});

test("HU 3.6 comparte ventana inclusiva, excluye futuros y conserva precisión BIGSERIAL", async () => {
    lugares = [lugar(1, [reporte(1, "SATURADO", "2026-10-11T14:30:00.000Z", "9007199254740993"),
        reporte(1, "TRANQUILO", "2026-10-11T14:30:00.000Z", "9007199254740992"),
        reporte(2, "SATURADO", instante), reporte(3, "MODERADO"),
        reporte(4, "TRANQUILO", "2026-10-11T14:29:59.999Z"), reporte(5, "TRANQUILO", "2026-10-11T15:00:00.001Z")])];
    assert.deepEqual(await servicio.listActive({ nivel: "SATURADO" }), [dto(lugares[0])]);
    assert.deepEqual(await servicio.listActive({ nivel: "TRANQUILO" }), []);
});

test("HU 3.6 valores, duplicados, arrays y claves desconocidas fallan antes del repositorio", async () => {
    for (const consulta of ["?nivel=tranquilo", "?nivel=ALTO", "?nivel=TODOS", "?nivel=TRANQUILO&nivel=SATURADO",
        "?nivel=TRANQUILO&nivel=TRANQUILO", "?nivel[]=TRANQUILO", "?nivel[x]=TRANQUILO", "?extra=x",
        "?nivel=SATURADO&extra=Parque", "?nivel=%27%20OR%201=1--"]) {
        const respuesta = await consultar(consulta);
        assert.equal(respuesta.status, 400);
        assert.equal(respuesta.headers.get("cache-control"), "no-store");
        assert.deepEqual(await respuesta.json(), { code: "SATURATION_FILTER_INVALID", message: "El filtro de saturación no es válido." });
    }
    assert.equal(consultasTodos, 0);
    assert.equal(consultasNiveles, 0);
});

test("HU 3.6 exige JWT antes de validar filtro y no consulta datos sin sesión", async () => {
    const expirado = jsonwebtoken.sign({ id: 1, sessionVersion: 0 }, process.env.JWT_SECRET, { expiresIn: -1 });
    for (const token of [null, "token-invalido", jwt.generateToken({ id: 1 }), expirado]) {
        const respuesta = await consultar("?nivel=invalido", token);
        assert.equal(respuesta.status, 401);
        assert.equal(respuesta.headers.get("cache-control"), "no-store");
        assert.equal((await respuesta.json()).code, "SESSION_INVALID");
    }
    assert.equal(consultasTodos, 0);
    assert.equal(consultasNiveles, 0);
});

test("HU 3.6 sesión inexistente, inactiva o revocada falla cerrado incluso con lista vacía", async () => {
    lugares = [];
    for (const usuario of [null, { status: "INACTIVO", sessionVersion: 0 }, { status: "ACTIVO", sessionVersion: 1 }]) {
        repositorioUsuario.findSessionById = async () => usuario;
        const respuesta = await consultar("?nivel=SATURADO");
        assert.equal(respuesta.status, 401);
        assert.equal(respuesta.headers.get("cache-control"), "no-store");
    }
    assert.equal(consultasNiveles, 0);
});

test("HU 3.6 errores de sesión o SQL son públicos y conservan no-store", async () => {
    repositorio.findActiveWithSaturation = async () => { throw Object.assign(new Error("detalle-privado-db"), { code: "SATURATION_FILTER_INVALID" }); };
    const respuesta = await consultar("?nivel=SATURADO");
    assert.equal(respuesta.status, 503);
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
    assert.deepEqual(await respuesta.json(), { message: "No se pudieron cargar los lugares. Inténtalo de nuevo." });
    repositorioUsuario.findSessionById = async () => { throw new Error("detalle-privado-db"); };
    const falloSesion = await consultar("?nivel=SATURADO");
    assert.equal(falloSesion.status, 503);
    assert.equal(falloSesion.headers.get("cache-control"), "no-store");
    assert.equal((await falloSesion.json()).code, "SERVICE_UNAVAILABLE");
});

test("HU 3.6 datos de reporte y coordenadas inválidos no se entregan", async () => {
    for (const cambio of [{ votes: [{ ...reporte(1, "SATURADO"), id: "inválido" }] }, { latitud: 91 }, { longitud: NaN }]) {
        lugares = [{ ...lugar(1, tres("SATURADO")), ...cambio }];
        const respuesta = await consultar("?nivel=SATURADO");
        assert.equal(respuesta.status, 503);
        assert.equal((await respuesta.json()).data, undefined);
    }
});

test("HU 3.6 repositorio usa un batch parametrizado y snapshot/reloj compartidos", async () => {
    const consultaOriginal = sequelize.query;
    const transaccion = { prueba: "sin-conexión" };
    try {
        let llamadas = 0;
        sequelize.query = async (sql, opciones) => {
            llamadas++;
            assert.equal((sql.match(/statement_timestamp\(\)/g) ?? []).length, 1);
            assert.match(sql, /WITH reloj AS MATERIALIZED/);
            assert.match(sql, /WHERE activo = TRUE/);
            assert.match(sql, /DISTINCT ON \(r.place_id, r.user_id\)/);
            assert.match(sql, /r.created_at >= reloj.evaluated_at - make_interval\(mins => :windowMinutes\)/);
            assert.match(sql, /r.created_at <= reloj.evaluated_at/);
            assert.match(sql, /ORDER BY r.place_id, r.user_id, r.created_at DESC, r.id DESC/);
            assert.match(sql, /ultimos.id::text/);
            assert.match(sql, /LEFT JOIN ultimos ON ultimos.place_id = lugares.id/);
            assert.match(sql, /ORDER BY lugares.id ASC/);
            assert.doesNotMatch(sql, /level\s*=|COUNT\s*\(/i);
            assert.deepEqual(opciones.replacements, { windowMinutes: 17, nombre: "", pattern: "%%", categoria: "" });
            assert.equal(opciones.transaction, transaccion);
            assert.equal(opciones.type, "SELECT");
            return lugares;
        };
        assert.deepEqual(await originales.niveles({ windowMinutes: 17, transaction: transaccion }), lugares);
        assert.equal(llamadas, 1);
        for (const windowMinutes of [undefined, 0, -1, "30", 1.5, "1); DROP TABLE x"]) {
            await assert.rejects(originales.niveles({ windowMinutes }), /Ventana de consulta inválida/);
        }
        assert.equal(llamadas, 1);
    } finally { sequelize.query = consultaOriginal; }
});

test("HU 3.6 llamadas directas del servicio también rechazan filtros inválidos", async () => {
    for (const nivel of ["tranquilo", "TODOS", [], {}]) {
        await assert.rejects(servicio.listActive({ nivel }), (error) => error.code === "SATURATION_FILTER_INVALID");
    }
    assert.equal(consultasTodos, 0);
    assert.equal(consultasNiveles, 0);
});

// HU8 añade estado privado a lista/detalle; este doble conserva la prueba aislada de HU previas.
const { default: favoriteStateRepository } = await import("../src/repositories/FavoriteRepository.js");
const originalFavoriteStateLookup = favoriteStateRepository.findPlaceIdsByUser;
test.before(() => { favoriteStateRepository.findPlaceIdsByUser = async () => []; });
test.after(() => { favoriteStateRepository.findPlaceIdsByUser = originalFavoriteStateLookup; });
