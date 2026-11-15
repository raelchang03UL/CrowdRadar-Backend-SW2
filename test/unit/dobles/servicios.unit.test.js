// PRUEBAS UNITARIAS CON DOBLES DE PRUEBA
// Unidades: SaturationReportService (recibe su repositorio por constructor: inyección de
// dependencias), UserService y PlaceService (repositorios sustituidos con mock.method).
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { SaturationReportService, SaturationReportError } from "../../../src/services/SaturationReportService.js";
import UserService, { UserNotFoundError } from "../../../src/services/UserService.js";
import UserRepository from "../../../src/repositories/UserRepository.js";
import ReportRepository from "../../../src/repositories/ReportRepository.js";
import PlaceService from "../../../src/services/PlaceService.js";
import PlaceRepository from "../../../src/repositories/PlaceRepository.js";
import FavoriteRepository from "../../../src/repositories/FavoriteRepository.js";

afterEach(() => mock.restoreAll());

describe("SaturationReportService.create (Mock inyectado por constructor)", () => {
    let repositorio, servicio;
    const solicitud = (cambios = {}) => ({ userId: 1, sessionVersion: 0, expiresAt: 9999999999, placeId: 15, level: "SATURADO", ...cambios });

    beforeEach(() => {
        repositorio = { create: mock.fn(async () => ({ kind: "CREATED", report: { id: "1", level: "SATURADO" } })) };
        servicio = new SaturationReportService(repositorio);
        process.env.REPORT_COOLDOWN_MINUTES = "3";
        process.env.KARMA_POINTS_PER_REPORT = "10";
    });
    afterEach(() => {
        delete process.env.REPORT_COOLDOWN_MINUTES;
        delete process.env.KARMA_POINTS_PER_REPORT;
    });

    it("envía al repositorio la solicitud con enfriamiento y puntos de karma de la configuración", async () => {
        const reporte = await servicio.create(solicitud());
        assert.deepEqual(reporte, { id: "1", level: "SATURADO" });
        assert.equal(repositorio.create.mock.callCount(), 1);
        assert.deepEqual(repositorio.create.mock.calls[0].arguments[0], {
            ...solicitud(), cooldownMinutes: 3, points: 10
        });
    });

    it("lugar inválido (0, decimal, fuera de INTEGER) → 400 sin llamar al repositorio", async () => {
        for (const placeId of [0, 1.5, 2147483648, -2147483649, "15"]) {
            await assert.rejects(servicio.create(solicitud({ placeId })), { status: 400, code: "INVALID_PLACE" });
        }
        assert.equal(repositorio.create.mock.callCount(), 0);
    });

    it("nivel fuera del conjunto → 400 INVALID_REPORT_LEVEL", async () => {
        await assert.rejects(servicio.create(solicitud({ level: "LLENO" })), { code: "INVALID_REPORT_LEVEL" });
    });

    it("traduce cada resultado del repositorio a un error público", async () => {
        const traducciones = [
            [{ kind: "PLACE_NOT_FOUND" }, 404, "PLACE_NOT_FOUND"],
            [{ kind: "REPORT_COOLDOWN" }, 409, "REPORT_COOLDOWN"]
        ];
        for (const [respuesta, status, code] of traducciones) {
            repositorio.create.mock.mockImplementationOnce(async () => respuesta); // thenReturn por llamada
            await assert.rejects(servicio.create(solicitud()), (e) => e instanceof SaturationReportError && e.status === status && e.code === code);
        }
    });

    it("resultado inesperado del repositorio → error interno (no se inventa un reporte)", async () => {
        repositorio.create.mock.mockImplementationOnce(async () => ({ kind: "CREATED" }));
        await assert.rejects(servicio.create(solicitud()), /Unexpected report result/);
    });

    it("configuración inválida de enfriamiento → no llega a la base de datos", async () => {
        process.env.REPORT_COOLDOWN_MINUTES = "0";
        await assert.rejects(servicio.create(solicitud()), /REPORT_COOLDOWN_MINUTES/);
        assert.equal(repositorio.create.mock.callCount(), 0);
    });
});

describe("UserService", () => {
    it("getProfile oculta campos internos y convierte karma BIGINT a número", async () => {
        mock.method(UserRepository, "findById", async () => ({
            toJSON: () => ({ id: 1, nombre: "Ana", email: "a@b.pe", passwordHash: "secreto", sessionVersion: 3, karmaPoints: "40" })
        }));
        const perfil = await UserService.getProfile(1);
        assert.equal(perfil.karmaPoints, 40);
        assert.equal("passwordHash" in perfil, false);
        assert.equal("sessionVersion" in perfil, false);
    });

    it("getProfile de un usuario inexistente → UserNotFoundError", async () => {
        mock.method(UserRepository, "findById", async () => null);
        await assert.rejects(UserService.getProfile(99), UserNotFoundError);
    });

    it("karma almacenado negativo se considera dato corrupto", async () => {
        mock.method(UserRepository, "findKarmaPoints", async () => ({ karmaPoints: "-5" }));
        await assert.rejects(UserService.getKarmaPoints(1), /Invalid stored karma/);
    });

    it("updateProfile envía al repositorio los textos recortados", async () => {
        const update = mock.method(UserRepository, "update", async (id, datos) => ({ id, ...datos, karmaPoints: 0 }));
        const perfil = await UserService.updateProfile(1, { nombre: "  Ana ", distrito: " Lima " });
        assert.deepEqual(update.mock.calls[0].arguments, [1, { nombre: "Ana", distrito: "Lima" }]);
        assert.equal(perfil.nombre, "Ana");
    });

    it("getReports convierte el id BIGINT a texto y placeId a número", async () => {
        mock.method(ReportRepository, "findByUserId", async () => [{ id: 12n, placeId: "4", level: "MODERADO" }]);
        assert.deepEqual(await UserService.getReports(1), [{ id: "12", placeId: 4, level: "MODERADO" }]);
    });
});

describe("PlaceService (Stubs de PlaceRepository y FavoriteRepository)", () => {
    const lugar = (id, cambios = {}) => ({ id, nombre: `Lugar ${id}`, categoria: "Parque", referencia: "Ref", latitud: -12, longitud: -77, demostrativo: true, ...cambios });

    it("listActive sin filtro de nivel marca favoritos del usuario y no consulta saturación", async () => {
        mock.method(PlaceRepository, "findActive", async () => [lugar(1), lugar(2)]);
        const conSaturacion = mock.method(PlaceRepository, "findActiveWithSaturation");
        mock.method(FavoriteRepository, "findPlaceIdsByUser", async () => [2]);

        const lugares = await PlaceService.listActive({ nombre: "", categoria: "" }, 7);

        assert.deepEqual(lugares.map(({ id, esFavorito, direccion }) => ({ id, esFavorito, direccion })),
            [{ id: 1, esFavorito: false, direccion: null }, { id: 2, esFavorito: true, direccion: null }]);
        assert.equal(conSaturacion.mock.callCount(), 0);
        assert.deepEqual(FavoriteRepository.findPlaceIdsByUser.mock.calls[0].arguments, [7]);
    });

    it("listActive con nivel filtra según la evaluación de saturación", async () => {
        const evaluatedAt = "2026-11-13T15:00:00.000Z";
        const votos = (nivel) => [1, 2, 3].map((u) => ({ id: String(u), userId: u, level: nivel, createdAt: "2026-11-13T14:55:00.000Z" }));
        mock.method(PlaceRepository, "findActiveWithSaturation", async () => [
            { ...lugar(1), evaluatedAt, votes: votos("SATURADO") },
            { ...lugar(2), evaluatedAt, votes: votos("TRANQUILO") }
        ]);
        const lugares = await PlaceService.listActive({ nivel: "SATURADO" });
        assert.deepEqual(lugares.map((l) => l.id), [1]);
        assert.equal(PlaceRepository.findActiveWithSaturation.mock.calls[0].arguments[0].windowMinutes, 30);
    });

    it("un lugar con coordenadas corruptas en la BD produce un error (no se publica)", async () => {
        mock.method(PlaceRepository, "findActive", async () => [lugar(1, { latitud: 200 })]);
        await assert.rejects(PlaceService.listActive({}), /Coordenadas de lugar inválidas/);
    });

    it("getActiveById devuelve null si no existe, sin consultar favoritos", async () => {
        mock.method(PlaceRepository, "findActiveById", async () => null);
        const favoritos = mock.method(FavoriteRepository, "findPlaceIdsByUser");
        assert.equal(await PlaceService.getActiveById(5, 1), null);
        assert.equal(favoritos.mock.callCount(), 0);
    });

    it("listActiveCategories valida cada categoría (vacía, con espacios o > 80 caracteres)", async () => {
        mock.method(PlaceRepository, "findActiveCategories", async () => [{ categoria: "Mercado" }, { categoria: "Parque" }]);
        assert.deepEqual(await PlaceService.listActiveCategories(), ["Mercado", "Parque"]);
        for (const categoria of ["", " Parque", "c".repeat(81), null]) {
            PlaceRepository.findActiveCategories.mock.mockImplementationOnce(async () => [{ categoria }]);
            await assert.rejects(PlaceService.listActiveCategories(), /Categoría de lugar inválida/);
        }
    });
});
