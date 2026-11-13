// PRUEBAS DE INTEGRACIÓN — ESTRATEGIA BOTTOM-UP (de abajo hacia arriba) con PostgreSQL REAL
//
// Paso 1 (nivel inferior): Repositorio ↔ PostgreSQL.
//         La prueba actúa como DRIVER: invoca directamente al repositorio porque el
//         servicio que normalmente lo llamaría todavía no participa.
// Paso 2 (subsistema): Servicio + Repositorio + PostgreSQL.
//         El Driver ahora invoca al servicio real, que usa el repositorio ya probado.
// (El nivel superior —HTTP y controladores— se integra en la prueba Big Bang.)
//
// Requiere .env.test con TEST_DB_USER y TEST_DB_PASSWORD; sin ellos la suite se OMITE.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { configuracionPruebas, recrearBaseDeDatos, migrarEsquema, insertarLugares, eliminarBaseDeDatos } from "../../helpers/baseDatosIntegracion.js";

const config = configuracionPruebas("bottomup");
const omitir = config.omitir ?? false;
let m; // módulos de la aplicación, importados después de apuntar a la base aislada

before(async () => {
    if (omitir) return;
    await recrearBaseDeDatos(config);
    m = {
        sequelize: (await import("../../../src/config/database.js")).default,
        UserRepository: (await import("../../../src/repositories/UserRepository.js")).default,
        PlaceRepository: (await import("../../../src/repositories/PlaceRepository.js")).default,
        FavoriteRepository: (await import("../../../src/repositories/FavoriteRepository.js")).default,
        SaturationReportRepository: (await import("../../../src/repositories/SaturationReportRepository.js")).default,
        AuthService: (await import("../../../src/services/AuthService.js")).default,
        SaturationReportService: (await import("../../../src/services/SaturationReportService.js")).default,
        SaturationQueryService: (await import("../../../src/services/SaturationQueryService.js")),
        PlaceService: (await import("../../../src/services/PlaceService.js")).default,
        UserService: (await import("../../../src/services/UserService.js")).default
    };
    await migrarEsquema(m.sequelize);
    await insertarLugares(m.sequelize);
});

after(async () => {
    if (omitir) return;
    await m.sequelize.close();
    await eliminarBaseDeDatos(config);
});

const consultar = (sql, replacements = {}) => m.sequelize.query(sql, { replacements, type: "SELECT" });
const crearUsuario = (email, extra = {}) => m.UserRepository.create({
    nombre: "Prueba", apellido: "Integración", email, passwordHash: "x", rol: "USUARIO", status: "ACTIVO", ...extra
});

describe("Paso 1 — Driver → Repositorio → PostgreSQL", { skip: omitir }, () => {
    it("UserRepository.create persiste el usuario con valores por defecto de la BD", async () => {
        const usuario = await crearUsuario("driver1@crowdradar.test");
        const [fila] = await consultar(`SELECT email, "sessionVersion", karma_points FROM public.users WHERE id = :id`, { id: usuario.id });
        assert.deepEqual({ ...fila, karma_points: Number(fila.karma_points) }, { email: "driver1@crowdradar.test", sessionVersion: 0, karma_points: 0 });
    });

    it("la restricción UNIQUE de email existe en la BD real", async () => {
        await crearUsuario("unico@crowdradar.test");
        await assert.rejects(crearUsuario("unico@crowdradar.test"), (e) => e.name === "SequelizeUniqueConstraintError");
    });

    it("findByEmail encuentra cuentas antiguas guardadas con mayúsculas o espacios (corrección 1)", async () => {
        // Simula un registro anterior a la corrección, insertado sin normalizar.
        const antiguo = await crearUsuario("  Legacy.User@CrowdRadar.TEST ");
        const encontrado = await m.UserRepository.findByEmail("legacy.user@crowdradar.test");
        assert.equal(encontrado.id, antiguo.id);
        assert.equal(await m.UserRepository.findByEmail("nadie@crowdradar.test"), null);
    });

    it("update modifica solo los campos enviados y no devuelve el hash", async () => {
        const usuario = await crearUsuario("update@crowdradar.test", { distrito: "Lima" });
        const actualizado = await m.UserRepository.update(usuario.id, { distrito: "Surco" });
        assert.equal(actualizado.distrito, "Surco");
        assert.equal(actualizado.nombre, "Prueba");
        assert.equal(actualizado.passwordHash, undefined);
        assert.equal(await m.UserRepository.update(999999, { distrito: "X" }), null);
    });

    it("PlaceRepository.findActive filtra por nombre (ILIKE) y trata % y _ como texto literal", async () => {
        assert.deepEqual((await m.PlaceRepository.findActive({ nombre: "parque" })).map((l) => l.id), [2]);
        assert.deepEqual((await m.PlaceRepository.findActive({ categoria: "Mercado" })).map((l) => l.id), [3]);
        assert.deepEqual(await m.PlaceRepository.findActive({ nombre: "%" }), []);
        assert.deepEqual((await m.PlaceRepository.findActiveCategories()).map((c) => c.categoria), ["Mercado", "Parque", "Plaza"]);
    });

    it("SaturationReportRepository.create: inserta, otorga karma y aplica el enfriamiento en una transacción", async () => {
        const usuario = await crearUsuario("reporte@crowdradar.test");
        const pedido = { userId: usuario.id, sessionVersion: 0, placeId: 1, level: "MODERADO", cooldownMinutes: 3, points: 10 };

        const creado = await m.SaturationReportRepository.create(pedido);
        assert.equal(creado.kind, "CREATED");
        assert.equal(creado.report.karmaPoints, 10);

        assert.deepEqual(await m.SaturationReportRepository.create(pedido), { kind: "REPORT_COOLDOWN" });
        assert.deepEqual(await m.SaturationReportRepository.create({ ...pedido, placeId: 999 }), { kind: "PLACE_NOT_FOUND" });

        const [{ total }] = await consultar("SELECT COUNT(*)::int AS total FROM public.saturation_reports WHERE user_id = :id", { id: usuario.id });
        const [{ karma }] = await consultar("SELECT karma_points::int AS karma FROM public.users WHERE id = :id", { id: usuario.id });
        assert.equal(total, 1);
        assert.equal(karma, 10);
    });

    it("SaturationReportRepository.create rechaza una sesión desactualizada sin escribir nada (rollback)", async () => {
        const usuario = await crearUsuario("sesion@crowdradar.test");
        await assert.rejects(m.SaturationReportRepository.create({ userId: usuario.id, sessionVersion: 5, placeId: 1, level: "SATURADO", cooldownMinutes: 3, points: 10 }),
            { code: "SESSION_INVALID" });
        const [{ total }] = await consultar("SELECT COUNT(*)::int AS total FROM public.saturation_reports WHERE user_id = :id", { id: usuario.id });
        assert.equal(total, 0);
    });

    it("FavoriteRepository: agregar, duplicado, inexistente, listar y quitar", async () => {
        const usuario = await crearUsuario("favoritos@crowdradar.test");
        const evaluar = m.SaturationQueryService.evaluateSaturation;
        assert.equal(await m.FavoriteRepository.add(usuario.id, 2, evaluar), "added");
        assert.equal(await m.FavoriteRepository.add(usuario.id, 2, evaluar), "exists");
        assert.equal(await m.FavoriteRepository.add(usuario.id, 999, evaluar), "notFound");
        assert.deepEqual(await m.FavoriteRepository.findPlaceIdsByUser(usuario.id), [2]);
        await m.FavoriteRepository.remove(usuario.id, 2);
        assert.deepEqual(await m.FavoriteRepository.findPlaceIdsByUser(usuario.id), []);
    });
});

describe("Paso 2 — Driver → Servicio → Repositorio → PostgreSQL", { skip: omitir }, () => {
    it("AuthService.register + login con bcrypt real y correo normalizado", async () => {
        const registrado = await m.AuthService.register({ nombre: "Ana", apellido: "Pérez", email: "Ana@Servicio.test", password: "ClaveSegura1" });
        assert.equal(registrado.email, "ana@servicio.test");
        const [fila] = await consultar(`SELECT "passwordHash" FROM public.users WHERE id = :id`, { id: registrado.id });
        assert.match(fila.passwordHash, /^\$2[aby]\$10\$/);

        const { token, user } = await m.AuthService.login("ANA@servicio.test", "ClaveSegura1");
        assert.equal(user.id, registrado.id);
        assert.ok(token.split(".").length === 3);
        await assert.rejects(m.AuthService.register({ nombre: "Ana", apellido: "Otra", email: "ana@SERVICIO.test", password: "ClaveSegura1" }), { code: "EMAIL_EXISTS" });
    });

    it("AuthService.changePassword incrementa sessionVersion en la BD real", async () => {
        const { id } = await m.AuthService.register({ nombre: "Leo", apellido: "Díaz", email: "leo@servicio.test", password: "ClaveSegura1" });
        await m.AuthService.changePassword(id, 0, { currentPassword: "ClaveSegura1", newPassword: "ClaveNueva22", confirmPassword: "ClaveNueva22" });
        const [fila] = await consultar(`SELECT "sessionVersion" FROM public.users WHERE id = :id`, { id });
        assert.equal(fila.sessionVersion, 1);
        await assert.rejects(m.AuthService.login("leo@servicio.test", "ClaveSegura1"), { code: "INVALID_CREDENTIALS" });
    });

    it("SaturationReportService + SaturationQueryService: tres votos producen un nivel con el SQL real", async () => {
        for (const n of [1, 2, 3]) {
            const usuario = await crearUsuario(`votante${n}@servicio.test`);
            await m.SaturationReportService.create({ userId: usuario.id, sessionVersion: 0, placeId: 3, level: n < 3 ? "SATURADO" : "TRANQUILO" });
        }
        const resultado = await m.SaturationQueryService.default.getForPlace("3");
        assert.equal(resultado.level, "SATURADO");
        assert.equal(resultado.reportCount, 3);
        await assert.rejects(m.SaturationQueryService.default.getForPlace("999"), { status: 404 });
    });

    it("PlaceService.listActive con filtro de nivel usa la consulta agregada real (findActiveWithSaturation)", async () => {
        const lugares = await m.PlaceService.listActive({ nombre: "", categoria: "", nivel: "SATURADO" });
        assert.deepEqual(lugares.map((l) => l.id), [3]);
    });

    it("UserService.getReports devuelve el historial con el nombre del lugar (JOIN real)", async () => {
        const usuario = await crearUsuario("historial@servicio.test");
        await m.SaturationReportService.create({ userId: usuario.id, sessionVersion: 0, placeId: 2, level: "TRANQUILO" });
        const reportes = await m.UserService.getReports(usuario.id);
        assert.equal(reportes.length, 1);
        assert.deepEqual([reportes[0].placeId, reportes[0].placeName, typeof reportes[0].id], [2, "Parque Kennedy", "string"]);
    });
});
