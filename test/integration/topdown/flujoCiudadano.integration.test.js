// PRUEBAS DE INTEGRACIÓN — ESTRATEGIA TOP-DOWN (incremental, de arriba hacia abajo)
//
// Jerarquía de CrowdRadar:
//   Nivel 1  HTTP (Express) → rutas → middlewares
//   Nivel 2  Controladores
//   Nivel 3  Servicios (reglas de negocio)
//   Nivel 4  Repositorios → PostgreSQL
//
// Incremento 1: se integran los niveles 1-2 reales; el nivel 3 (servicios) es un STUB.
//               Verifica el contrato HTTP ↔ controlador: qué datos llegan al servicio y
//               cómo se traduce su respuesta a códigos HTTP.
// Incremento 2: el Stub del servicio se reemplaza por el servicio REAL; ahora el STUB
//               está en el nivel 4 (repositorios en memoria). Se vuelve a probar el flujo
//               completo del ciudadano a través de las capas reales 1-3.
// (El nivel 4 real con PostgreSQL se integra en test/integration/bottomup y bigbang.)
import { describe, it, before, after, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "top-down-secreto-solo-pruebas";
process.env.REPORT_COOLDOWN_MINUTES = "3";
process.env.KARMA_POINTS_PER_REPORT = "10";

const { createApp } = await import("../../../app.js");
const { default: jwt } = await import("../../../src/utils/jwt.js");
const { default: bcrypt } = await import("bcrypt");
const { default: UserRepository } = await import("../../../src/repositories/UserRepository.js");
const { default: PlaceRepository } = await import("../../../src/repositories/PlaceRepository.js");
const { default: FavoriteRepository } = await import("../../../src/repositories/FavoriteRepository.js");
const { default: ReportRepository } = await import("../../../src/repositories/ReportRepository.js");
const { default: SaturationReportRepository } = await import("../../../src/repositories/SaturationReportRepository.js");
const { default: SaturationQueryRepository } = await import("../../../src/repositories/SaturationQueryRepository.js");
const { default: PlaceService } = await import("../../../src/services/PlaceService.js");
const { default: SaturationReportService, SaturationReportError } = await import("../../../src/services/SaturationReportService.js");

let server, base;
before(() => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));
afterEach(() => mock.restoreAll());

async function llamar(ruta, { method = "GET", body, token } = {}) {
    const respuesta = await fetch(`${base}${ruta}`, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const texto = await respuesta.text();
    return { status: respuesta.status, body: texto ? JSON.parse(texto) : null };
}

describe("Incremento 1: HTTP + middlewares + controladores reales, servicios como Stub", () => {
    let token;
    beforeEach(() => {
        mock.method(UserRepository, "findSessionById", async () => ({ id: 1, status: "ACTIVO", sessionVersion: 0, rol: "USUARIO" }));
        token = jwt.generateToken({ id: 1, sessionVersion: 0 });
    });

    it("GET /api/places entrega al servicio los filtros normalizados y el id del usuario autenticado", async () => {
        const stub = mock.method(PlaceService, "listActive", async () => [{ id: 1, nombre: "Plaza" }]);
        const { status, body } = await llamar("/api/places?nombre=%20Plaza%20&nivel=SATURADO", { token });
        assert.equal(status, 200);
        assert.deepEqual(body.data, [{ id: 1, nombre: "Plaza" }]);
        assert.deepEqual(stub.mock.calls[0].arguments, [{ nombre: "Plaza", categoria: "", nivel: "SATURADO" }, 1]);
    });

    it("parámetros inválidos se rechazan en el controlador, sin llegar al servicio", async () => {
        const stub = mock.method(PlaceService, "listActive");
        assert.equal((await llamar("/api/places?nivel=LLENO", { token })).status, 400);
        assert.equal((await llamar("/api/places?orden=asc", { token })).status, 400);
        assert.equal((await llamar(`/api/places?nombre=${"x".repeat(161)}`, { token })).status, 400);
        assert.equal(stub.mock.callCount(), 0);
    });

    it("POST /api/places/:id/reports pasa userId, sessionVersion, exp y placeId numérico al servicio", async () => {
        const stub = mock.method(SaturationReportService, "create", async () => ({
            id: "9", place_id: 15, level: "MODERADO", created_at: "2026-11-13T10:00:00.000Z", pointsAwarded: 10, karmaPoints: 30
        }));
        const { status, body } = await llamar("/api/places/15/reports", { method: "POST", body: { level: "MODERADO" }, token });
        assert.equal(status, 201);
        // Contrato: el controlador traduce snake_case de la BD a camelCase de la API.
        assert.deepEqual(body.data, { id: "9", placeId: 15, level: "MODERADO", createdAt: "2026-11-13T10:00:00.000Z", pointsAwarded: 10, karmaPoints: 30 });
        const [entrada] = stub.mock.calls[0].arguments;
        assert.equal(entrada.userId, 1);
        assert.equal(entrada.placeId, 15);
        assert.equal(entrada.sessionVersion, 0);
        assert.equal(Number.isInteger(entrada.expiresAt), true);
    });

    it("los errores públicos del servicio llegan al cliente con su código; los internos como 503", async () => {
        const stub = mock.method(SaturationReportService, "create", async () => {
            throw new SaturationReportError(409, "REPORT_COOLDOWN", "Ya registraste un reporte para este lugar. Inténtalo más tarde.");
        });
        const conflicto = await llamar("/api/places/15/reports", { method: "POST", body: { level: "SATURADO" }, token });
        assert.deepEqual([conflicto.status, conflicto.body.code], [409, "REPORT_COOLDOWN"]);

        stub.mock.mockImplementation(async () => { throw new Error("deadlock detected"); });
        const interno = await llamar("/api/places/15/reports", { method: "POST", body: { level: "SATURADO" }, token });
        assert.deepEqual([interno.status, interno.body.code], [503, "SERVICE_UNAVAILABLE"]);
        assert.doesNotMatch(JSON.stringify(interno.body), /deadlock/);
    });

    it("las rutas protegidas no llaman al servicio sin token válido", async () => {
        const stub = mock.method(PlaceService, "listActive");
        assert.equal((await llamar("/api/places")).status, 401);
        assert.equal((await llamar("/api/places", { token: "token-falso" })).status, 401);
        assert.equal(stub.mock.callCount(), 0);
    });
});

describe("Incremento 2: servicios reales, repositorios como Stub en memoria (flujo completo del ciudadano)", () => {
    let bd;

    beforeEach(() => {
        bd = {
            usuarios: new Map(), siguienteId: 1, reportes: [],
            lugares: [
                { id: 1, nombre: "Plaza de Armas", categoria: "Plaza", referencia: "Centro", direccion: null, latitud: -12.0464, longitud: -77.0302, demostrativo: true },
                { id: 2, nombre: "Parque Kennedy", categoria: "Parque", referencia: "Miraflores", direccion: null, latitud: -12.1211, longitud: -77.0297, demostrativo: true }
            ]
        };
        mock.method(bcrypt, "hash", async (texto) => `hash:${texto}`);
        mock.method(bcrypt, "compare", async (texto, hash) => hash === `hash:${texto}`);
        mock.method(UserRepository, "findByEmail", async (email) => [...bd.usuarios.values()].find((u) => u.email === email) ?? null);
        mock.method(UserRepository, "create", async (datos) => {
            const usuario = { ...datos, id: bd.siguienteId++, sessionVersion: 0, karmaPoints: 0 };
            bd.usuarios.set(usuario.id, usuario);
            return usuario;
        });
        mock.method(UserRepository, "findSessionById", async (id) => bd.usuarios.get(id) ?? null);
        mock.method(UserRepository, "findById", async (id) => {
            const usuario = bd.usuarios.get(id);
            if (!usuario) return null;
            const { passwordHash, sessionVersion, ...publico } = usuario;
            return publico;
        });
        mock.method(UserRepository, "findKarmaPoints", async (id) => ({ karmaPoints: bd.usuarios.get(id).karmaPoints }));
        mock.method(UserRepository, "withLockedUser", async (id, operacion) => {
            const usuario = bd.usuarios.get(id);
            return operacion(usuario && { ...usuario, update: async (cambios) => Object.assign(usuario, cambios) }, "tx");
        });
        mock.method(UserRepository, "invalidatePasswordResetTokens", async () => {});
        mock.method(PlaceRepository, "findActive", async ({ nombre = "", categoria = "" } = {}) =>
            bd.lugares.filter((l) => l.nombre.toLowerCase().includes(nombre.toLowerCase()) && (!categoria || l.categoria === categoria)));
        mock.method(FavoriteRepository, "findPlaceIdsByUser", async () => []);
        mock.method(SaturationReportRepository, "create", async ({ userId, placeId, level, cooldownMinutes, points }) => {
            if (!bd.lugares.some((l) => l.id === placeId)) return { kind: "PLACE_NOT_FOUND" };
            if (bd.reportes.some((r) => r.userId === userId && r.placeId === placeId)) return { kind: "REPORT_COOLDOWN", cooldownMinutes };
            const reporte = { id: String(bd.reportes.length + 1), userId, placeId, level, createdAt: new Date().toISOString() };
            bd.reportes.push(reporte);
            bd.usuarios.get(userId).karmaPoints += points;
            return { kind: "CREATED", report: { id: reporte.id, place_id: placeId, level, created_at: reporte.createdAt, pointsAwarded: points, karmaPoints: bd.usuarios.get(userId).karmaPoints } };
        });
        mock.method(ReportRepository, "findByUserId", async (userId) => bd.reportes.filter((r) => r.userId === userId)
            .map(({ id, placeId, level, createdAt }) => ({ id, placeId: String(placeId), level, createdAt, isPublic: true, placeName: bd.lugares.find((l) => l.id === placeId).nombre })));
        mock.method(SaturationQueryRepository, "findActiveSnapshot", async (placeId) => ({
            placeId, evaluatedAt: new Date().toISOString(),
            votes: bd.reportes.filter((r) => r.placeId === placeId).map(({ id, userId, level, createdAt }) => ({ id, userId, level, createdAt }))
        }));
    });

    it("registro → login → perfil → lugares → reporte → karma → historial → cambio de contraseña", async () => {
        // 1. Registro (AuthService real normaliza y cifra)
        const registro = await llamar("/api/auth/register", { method: "POST", body: { nombre: "Ana", apellido: "Pérez", email: "Ana@CrowdRadar.test", password: "ClaveSegura1" } });
        assert.equal(registro.status, 201);
        assert.equal(bd.usuarios.get(1).passwordHash, "hash:ClaveSegura1");

        // 2. Login con otra capitalización del correo
        const login = await llamar("/api/auth/login", { method: "POST", body: { email: "ana@crowdradar.TEST", password: "ClaveSegura1" } });
        assert.equal(login.status, 200);
        const { token } = login.body.data;

        // 3. Perfil
        const perfil = await llamar("/api/users/profile", { token });
        assert.equal(perfil.body.data.email, "ana@crowdradar.test");
        assert.equal(perfil.body.data.karmaPoints, 0);

        // 4. Búsqueda de lugares (PlaceService real valida coordenadas y marca favoritos)
        const lugares = await llamar("/api/places?nombre=parque", { token });
        assert.deepEqual(lugares.body.data.map((l) => [l.id, l.esFavorito]), [[2, false]]);

        // 5. Reporte de saturación y 6. karma acumulado
        const reporte = await llamar("/api/places/2/reports", { method: "POST", body: { level: "SATURADO" }, token });
        assert.equal(reporte.status, 201);
        assert.equal(reporte.body.data.pointsAwarded, 10);
        assert.equal((await llamar("/api/users/karma", { token })).body.data.karmaPoints, 10);

        // Un segundo reporte inmediato choca con el enfriamiento
        const repetido = await llamar("/api/places/2/reports", { method: "POST", body: { level: "TRANQUILO" }, token });
        assert.equal(repetido.status, 409);

        // 7. Historial personal y saturación (1 voto: aún insuficiente)
        const historial = await llamar("/api/users/reports", { token });
        assert.deepEqual(historial.body.data.map((r) => [r.placeId, r.level, r.placeName]), [[2, "SATURADO", "Parque Kennedy"]]);
        const saturacion = await llamar("/api/places/2/saturation", { token });
        assert.equal(saturacion.body.data.reason, "INSUFFICIENT_REPORTS");
        assert.equal(saturacion.body.data.reportCount, 1);

        // 8. Cambio de contraseña: invalida el token anterior y permite entrar con la nueva
        const cambio = await llamar("/api/auth/password/change", { method: "POST", token, body: { currentPassword: "ClaveSegura1", newPassword: "ClaveNueva22", confirmPassword: "ClaveNueva22" } });
        assert.equal(cambio.status, 200);
        assert.equal((await llamar("/api/users/profile", { token })).status, 401);
        assert.equal((await llamar("/api/auth/login", { method: "POST", body: { email: "ana@crowdradar.test", password: "ClaveSegura1" } })).status, 401);
        assert.equal((await llamar("/api/auth/login", { method: "POST", body: { email: "ana@crowdradar.test", password: "ClaveNueva22" } })).status, 200);
    });

    it("lugar inexistente: el servicio real traduce PLACE_NOT_FOUND del repositorio a 404", async () => {
        await llamar("/api/auth/register", { method: "POST", body: { nombre: "Luis", apellido: "Rojas", email: "luis@crowdradar.test", password: "ClaveSegura1" } });
        const { token } = (await llamar("/api/auth/login", { method: "POST", body: { email: "luis@crowdradar.test", password: "ClaveSegura1" } })).body.data;
        const respuesta = await llamar("/api/places/999/reports", { method: "POST", body: { level: "SATURADO" }, token });
        assert.deepEqual([respuesta.status, respuesta.body.code], [404, "PLACE_NOT_FOUND"]);
        assert.equal(bd.usuarios.get(1).karmaPoints, 0);
    });

    it("tres ciudadanos distintos que reportan SATURADO producen un nivel calculado", async () => {
        const tokens = [];
        for (const nombre of ["uno", "dos", "tres"]) {
            await llamar("/api/auth/register", { method: "POST", body: { nombre: "Ciudadano", apellido: nombre, email: `${nombre}@crowdradar.test`, password: "ClaveSegura1" } });
            tokens.push((await llamar("/api/auth/login", { method: "POST", body: { email: `${nombre}@crowdradar.test`, password: "ClaveSegura1" } })).body.data.token);
        }
        for (const token of tokens) {
            assert.equal((await llamar("/api/places/1/reports", { method: "POST", body: { level: "SATURADO" }, token })).status, 201);
        }
        const saturacion = await llamar("/api/places/1/saturation", { token: tokens[0] });
        assert.equal(saturacion.body.data.level, "SATURADO");
        assert.equal(saturacion.body.data.reportCount, 3);
    });
});
