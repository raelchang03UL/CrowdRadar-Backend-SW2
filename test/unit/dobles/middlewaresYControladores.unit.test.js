// PRUEBAS UNITARIAS CON DOBLES DE PRUEBA
// Unidades: middlewares y controladores probados de forma aislada, sin servidor HTTP.
// `req` es un Stub (objeto con datos fijos), `res` y `next` son Spies que registran llamadas.
import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { respuestaFalsa } from "../../helpers/respuestaFalsa.js";

process.env.JWT_SECRET = "secreto-de-prueba-unitaria";
const { default: authMiddleware } = await import("../../../src/middlewares/authMiddleware.js");
const { default: adminMiddleware } = await import("../../../src/middlewares/adminMiddleware.js");
const { default: validateSchema } = await import("../../../src/middlewares/validateSchema.js");
const { createPublicAbuseMiddleware } = await import("../../../src/middlewares/publicAbuse.js");
const { normalizeEmailField } = await import("../../../src/routes/auth.routes.js");
const { default: UserRepository } = await import("../../../src/repositories/UserRepository.js");
const { default: jwt } = await import("../../../src/utils/jwt.js");
const { default: AuthController } = await import("../../../src/controllers/AuthController.js");
const { default: AuthService } = await import("../../../src/services/AuthService.js");
const { default: PlaceController } = await import("../../../src/controllers/PlaceController.js");
const { default: PlaceService } = await import("../../../src/services/PlaceService.js");
const { AuthError } = await import("../../../src/utils/passwordPolicy.js");

afterEach(() => mock.restoreAll());

describe("authMiddleware", () => {
    const conToken = (token) => ({ headers: { authorization: `Bearer ${token}` } });

    it("token válido y sesión vigente → llama a next() y adjunta el rol de la BD (no el del token)", async () => {
        mock.method(UserRepository, "findSessionById", async () => ({ id: 4, status: "ACTIVO", sessionVersion: 1, rol: "ADMIN" }));
        const req = conToken(jwt.generateToken({ id: 4, sessionVersion: 1, rol: "USUARIO" }));
        const res = respuestaFalsa();
        const next = mock.fn();

        await authMiddleware(req, res, next);

        assert.equal(next.mock.callCount(), 1);
        assert.equal(req.user.rol, "ADMIN");
        assert.equal(res.status.mock.callCount(), 0);
    });

    it("sin cabecera, esquema distinto de Bearer o token manipulado → 401 sin consultar la BD", async () => {
        const consulta = mock.method(UserRepository, "findSessionById");
        for (const headers of [{}, { authorization: "Basic abc" }, { authorization: "Bearer a b" }, { authorization: "Bearer xxx.yyy.zzz" }]) {
            const res = respuestaFalsa();
            const next = mock.fn();
            await authMiddleware({ headers }, res, next);
            assert.equal(res.statusCode, 401, JSON.stringify(headers));
            assert.equal(res.body.code, "SESSION_INVALID");
            assert.equal(next.mock.callCount(), 0);
        }
        assert.equal(consulta.mock.callCount(), 0);
    });

    it("token sin sessionVersion entero (JWT antiguo) → 401", async () => {
        const res = respuestaFalsa();
        await authMiddleware(conToken(jwt.generateToken({ id: 4 })), res, mock.fn());
        assert.equal(res.statusCode, 401);
    });

    it("sesión revocada (otra sessionVersion) o cuenta suspendida → 401", async () => {
        for (const sesion of [{ status: "ACTIVO", sessionVersion: 2 }, { status: "SUSPENDIDO", sessionVersion: 1 }, null]) {
            mock.method(UserRepository, "findSessionById", async () => sesion);
            const res = respuestaFalsa();
            await authMiddleware(conToken(jwt.generateToken({ id: 4, sessionVersion: 1 })), res, mock.fn());
            assert.equal(res.statusCode, 401, JSON.stringify(sesion));
            mock.restoreAll();
        }
    });

    it("thenThrow: la BD no responde → 503 SERVICE_UNAVAILABLE", async () => {
        mock.method(UserRepository, "findSessionById", async () => { throw new Error("timeout"); });
        const res = respuestaFalsa();
        await authMiddleware(conToken(jwt.generateToken({ id: 4, sessionVersion: 1 })), res, mock.fn());
        assert.equal(res.statusCode, 503);
    });
});

describe("adminMiddleware", () => {
    it("rol ADMIN pasa; cualquier otro rol recibe 403", () => {
        const next = mock.fn();
        adminMiddleware({ user: { rol: "ADMIN" } }, respuestaFalsa(), next);
        assert.equal(next.mock.callCount(), 1);

        const res = respuestaFalsa();
        adminMiddleware({ user: { rol: "USUARIO" } }, res, next);
        assert.equal(res.statusCode, 403);
        assert.equal(next.mock.callCount(), 1);
    });
});

describe("validateSchema y normalizeEmailField", () => {
    const middleware = validateSchema({ type: "object", properties: { n: { type: "integer" } }, required: ["n"] });

    it("cuerpo válido → next(); inválido → 400 con detalle de AJV", () => {
        const next = mock.fn();
        middleware({ body: { n: 1 } }, respuestaFalsa(), next);
        assert.equal(next.mock.callCount(), 1);

        const res = respuestaFalsa();
        middleware({ body: { n: "uno" } }, res, next);
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.errors[0].instancePath, "/n");
    });

    it("normalizeEmailField modifica solo un email de tipo texto", () => {
        const req = { body: { email: "  ANA@Mail.PE ", nombre: " X " } };
        const next = mock.fn();
        normalizeEmailField(req, respuestaFalsa(), next);
        assert.deepEqual(req.body, { email: "ana@mail.pe", nombre: " X " });
        for (const body of [undefined, [], { email: 5 }]) {
            normalizeEmailField({ body }, respuestaFalsa(), next);
        }
        assert.equal(next.mock.callCount(), 4);
    });
});

describe("createPublicAbuseMiddleware (repositorio de límites como Mock)", () => {
    const peticion = (path, method = "POST") => ({ path, method });

    it("dentro del límite → next() y se consulta el límite de esa ruta (5 para /register)", async () => {
        const repository = { consumeLimits: mock.fn(async () => true) };
        const middleware = createPublicAbuseMiddleware({ repository, clientAddress: () => "203.0.113.5" });
        const next = mock.fn();
        await middleware(peticion("/register"), respuestaFalsa(), next);
        assert.equal(next.mock.callCount(), 1);
        const [[limite]] = repository.consumeLimits.mock.calls[0].arguments;
        assert.equal(limite.maximum, 5);
        assert.match(limite.keyHash, /^[a-f0-9]{64}$/); // la IP nunca se guarda en claro
    });

    it("límite agotado → 429 con Retry-After", async () => {
        const middleware = createPublicAbuseMiddleware({ repository: { consumeLimits: async () => false }, clientAddress: () => "203.0.113.5" });
        const res = respuestaFalsa();
        await middleware(peticion("/login"), res, mock.fn());
        assert.equal(res.statusCode, 429);
        assert.equal(res.headers["Retry-After"], "900");
    });

    it("sin IP de cliente o con fallo del repositorio → 503 (falla cerrado)", async () => {
        for (const [clientAddress, consumeLimits] of [[() => undefined, async () => true], [() => "203.0.113.5", async () => { throw new Error("db"); }]]) {
            const res = respuestaFalsa();
            await createPublicAbuseMiddleware({ repository: { consumeLimits }, clientAddress })(peticion("/login"), res, mock.fn());
            assert.equal(res.statusCode, 503);
        }
    });

    it("GET y rutas sin política no se limitan", async () => {
        const repository = { consumeLimits: mock.fn() };
        const middleware = createPublicAbuseMiddleware({ repository, clientAddress: () => "203.0.113.5" });
        const next = mock.fn();
        await middleware(peticion("/login", "GET"), respuestaFalsa(), next);
        await middleware(peticion("/otra"), respuestaFalsa(), next);
        assert.equal(next.mock.callCount(), 2);
        assert.equal(repository.consumeLimits.mock.callCount(), 0);
    });
});

describe("Controladores con el servicio sustituido", () => {
    it("AuthController.login: éxito → 200; AuthError → su estado; error inesperado → 503 sin detalles", async () => {
        mock.method(AuthService, "login", async () => ({ token: "t", user: { id: 1 } }));
        let res = respuestaFalsa();
        await AuthController.login({ body: { email: "a@b.pe", password: "x" } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.data.token, "t");

        AuthService.login.mock.mockImplementation(async () => { throw new AuthError(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos."); });
        res = respuestaFalsa();
        await AuthController.login({ body: {} }, res);
        assert.deepEqual([res.statusCode, res.body.code], [401, "INVALID_CREDENTIALS"]);

        AuthService.login.mock.mockImplementation(async () => { throw new Error("SQL: relation users does not exist"); });
        res = respuestaFalsa();
        await AuthController.login({ body: {} }, res);
        assert.equal(res.statusCode, 503);
        assert.doesNotMatch(JSON.stringify(res.body), /SQL/);
    });

    it("PlaceController.addFavorite: valida el id y traduce los resultados del servicio", async () => {
        const agregar = mock.method(PlaceService, "addFavorite", async () => "created");
        const llamar = async (id) => {
            const res = respuestaFalsa();
            await PlaceController.addFavorite({ params: { id }, user: { id: 1 } }, res);
            return res;
        };
        assert.equal((await llamar("abc")).statusCode, 400);
        assert.equal((await llamar("2147483648")).statusCode, 400);
        assert.equal(agregar.mock.callCount(), 0);

        assert.equal((await llamar("7")).statusCode, 201);
        agregar.mock.mockImplementationOnce(async () => "notFound");
        assert.equal((await llamar("7")).statusCode, 404);
        agregar.mock.mockImplementationOnce(async () => "exists");
        assert.equal((await llamar("7")).statusCode, 409);
        agregar.mock.mockImplementationOnce(async () => { throw new Error("db"); });
        assert.equal((await llamar("7")).statusCode, 503);
    });
});
