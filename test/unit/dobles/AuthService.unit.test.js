// PRUEBAS UNITARIAS CON DOBLES DE PRUEBA (Stub, Mock y Spy)
// Unidad bajo prueba: AuthService (src/services/AuthService.js)
// Dependencias sustituidas: UserRepository (acceso a datos) y bcrypt (cifrado).
//
// Equivalencias con Mockito (PPT Semana 11):
//   when(repo.findByEmail(..)).thenReturn(x)  →  mock.method(repo, "findByEmail", async () => x)
//   verify(repo).create(args)                 →  repo.create.mock.calls[0].arguments
//   verify(repo, never()).create(..)          →  repo.create.mock.callCount() === 0
//   when(..).thenThrow(new Error(..))         →  mock.method(repo, "x", async () => { throw ... })
//   spy(objetoReal)                           →  mock.method(objeto, "metodo") sin implementación
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "secreto-de-prueba-unitaria";
const { default: AuthService } = await import("../../../src/services/AuthService.js");
const { default: UserRepository } = await import("../../../src/repositories/UserRepository.js");
const { default: jwt } = await import("../../../src/utils/jwt.js");
const { default: bcrypt } = await import("bcrypt");
const { AuthError } = await import("../../../src/utils/passwordPolicy.js");

const datosRegistro = () => ({ nombre: " Ana ", apellido: "Pérez", email: " Ana@CrowdRadar.TEST ", password: "ClaveSegura1" });

// @After: restaurar las implementaciones reales después de cada caso.
afterEach(() => mock.restoreAll());

describe("AuthService.register", () => {
    beforeEach(() => {
        // Stub de bcrypt para que la prueba sea rápida y determinista.
        mock.method(bcrypt, "hash", async (texto) => `hash(${texto})`);
    });

    it("guarda el usuario con correo normalizado, rol USUARIO, estado ACTIVO y sin la contraseña en claro", async () => {
        mock.method(UserRepository, "findByEmail", async () => null);
        const create = mock.method(UserRepository, "create", async (datos) => ({ id: 1, ...datos }));

        const resultado = await AuthService.register(datosRegistro());

        // verify(repo).findByEmail("ana@crowdradar.test")
        assert.deepEqual(UserRepository.findByEmail.mock.calls[0].arguments, ["ana@crowdradar.test"]);
        // verify(repo, times(1)).create(argumentos esperados)
        assert.equal(create.mock.callCount(), 1);
        const guardado = create.mock.calls[0].arguments[0];
        assert.equal(guardado.email, "ana@crowdradar.test");
        assert.equal(guardado.nombre, "Ana");
        assert.equal(guardado.rol, "USUARIO");
        assert.equal(guardado.status, "ACTIVO");
        assert.equal(guardado.passwordHash, "hash(ClaveSegura1)");
        assert.equal("password" in guardado, false);
        assert.deepEqual(resultado, { id: 1, nombre: "Ana", apellido: "Pérez", email: "ana@crowdradar.test" });
    });

    it("correo ya registrado → EMAIL_EXISTS y nunca llama a create ni a bcrypt", async () => {
        mock.method(UserRepository, "findByEmail", async () => ({ id: 9 }));
        const create = mock.method(UserRepository, "create");

        await assert.rejects(AuthService.register(datosRegistro()), { status: 400, code: "EMAIL_EXISTS" });
        assert.equal(create.mock.callCount(), 0);
        assert.equal(bcrypt.hash.mock.callCount(), 0);
    });

    it("contraseña inválida → PASSWORD_VALIDATION sin consultar el repositorio", async () => {
        const findByEmail = mock.method(UserRepository, "findByEmail");
        await assert.rejects(AuthService.register({ ...datosRegistro(), password: "corta" }), { code: "PASSWORD_VALIDATION" });
        assert.equal(findByEmail.mock.callCount(), 0);
    });

    it("thenThrow: si el repositorio falla, el error se propaga (el controlador lo convierte en 503)", async () => {
        mock.method(UserRepository, "findByEmail", async () => { throw new Error("conexión perdida"); });
        await assert.rejects(AuthService.register(datosRegistro()), /conexión perdida/);
    });
});

describe("AuthService.login", () => {
    const usuario = (cambios = {}) => ({
        id: 3, nombre: "Ana", apellido: "Pérez", email: "ana@crowdradar.test", rol: "USUARIO",
        status: "ACTIVO", sessionVersion: 0, passwordHash: "hash", ...cambios
    });

    it("credenciales correctas → token y usuario público; generateToken se espía (Spy) y usa la implementación real", async () => {
        mock.method(UserRepository, "findByEmail", async () => usuario());
        mock.method(bcrypt, "compare", async () => true);
        const espia = mock.method(jwt, "generateToken"); // Spy: sin implementación, llama a la real

        const { token, user } = await AuthService.login("ANA@crowdradar.test", "ClaveSegura1");

        assert.equal(espia.mock.callCount(), 1);
        assert.equal(espia.mock.calls[0].arguments[0].id, 3);
        assert.equal(espia.mock.calls[0].result, token); // el Spy registra el valor real devuelto
        assert.equal(jwt.verifyToken(token).id, 3);
        assert.deepEqual(user, { id: 3, nombre: "Ana", apellido: "Pérez", email: "ana@crowdradar.test", rol: "USUARIO" });
        assert.equal(UserRepository.findByEmail.mock.calls[0].arguments[0], "ana@crowdradar.test");
    });

    it("usuario inexistente → 401 INVALID_CREDENTIALS sin comparar contraseñas", async () => {
        mock.method(UserRepository, "findByEmail", async () => null);
        const compare = mock.method(bcrypt, "compare");
        await assert.rejects(AuthService.login("x@y.pe", "ClaveSegura1"), { status: 401, code: "INVALID_CREDENTIALS" });
        assert.equal(compare.mock.callCount(), 0);
    });

    it("contraseña incorrecta → 401 aunque la cuenta esté suspendida (no revela el estado)", async () => {
        mock.method(UserRepository, "findByEmail", async () => usuario({ status: "SUSPENDIDO" }));
        mock.method(bcrypt, "compare", async () => false);
        await assert.rejects(AuthService.login("ana@crowdradar.test", "otra"), { status: 401 });
    });

    it("contraseña correcta y cuenta SUSPENDIDO → 403 ACCOUNT_SUSPENDED sin emitir token", async () => {
        mock.method(UserRepository, "findByEmail", async () => usuario({ status: "SUSPENDIDO" }));
        mock.method(bcrypt, "compare", async () => true);
        const generar = mock.method(jwt, "generateToken");
        await assert.rejects(AuthService.login("ana@crowdradar.test", "ClaveSegura1"), { status: 403, code: "ACCOUNT_SUSPENDED" });
        assert.equal(generar.mock.callCount(), 0);
    });

    it("otro estado no ACTIVO → 401 uniforme", async () => {
        mock.method(UserRepository, "findByEmail", async () => usuario({ status: "ELIMINADO" }));
        mock.method(bcrypt, "compare", async () => true);
        await assert.rejects(AuthService.login("ana@crowdradar.test", "ClaveSegura1"), { status: 401, code: "INVALID_CREDENTIALS" });
    });

    it("contraseña vacía o > 72 bytes se rechaza antes de ir a la base de datos", async () => {
        const findByEmail = mock.method(UserRepository, "findByEmail");
        for (const clave of ["", "a".repeat(73), null]) {
            await assert.rejects(AuthService.login("ana@crowdradar.test", clave), { status: 401 });
        }
        assert.equal(findByEmail.mock.callCount(), 0);
    });
});

describe("AuthService.changePassword", () => {
    const entrada = (cambios = {}) => ({ currentPassword: "ClaveActual1", newPassword: "ClaveNueva22", confirmPassword: "ClaveNueva22", ...cambios });
    let usuarioBloqueado;

    beforeEach(() => {
        usuarioBloqueado = { id: 5, status: "ACTIVO", sessionVersion: 4, passwordHash: "hash-actual", update: mock.fn(async () => {}) };
        // Stub de la transacción: ejecuta la operación con el usuario falso y una transacción ficticia.
        mock.method(UserRepository, "withLockedUser", async (id, operacion) => operacion(usuarioBloqueado, "tx-1"));
        mock.method(UserRepository, "invalidatePasswordResetTokens", async () => {});
        mock.method(bcrypt, "compare", async (texto, hash) => hash === "hash-actual" && texto === "ClaveActual1");
        mock.method(bcrypt, "hash", async () => "hash-nuevo");
    });

    it("éxito: actualiza hash, incrementa sessionVersion e invalida tokens dentro de la misma transacción", async () => {
        await AuthService.changePassword(5, 4, entrada());

        assert.deepEqual(usuarioBloqueado.update.mock.calls[0].arguments,
            [{ passwordHash: "hash-nuevo", sessionVersion: 5 }, { transaction: "tx-1" }]);
        assert.deepEqual(UserRepository.invalidatePasswordResetTokens.mock.calls[0].arguments, [5, "tx-1"]);
    });

    it("confirmación distinta → PASSWORD_MISMATCH sin abrir transacción", async () => {
        await assert.rejects(AuthService.changePassword(5, 4, entrada({ confirmPassword: "Distinta123" })), { code: "PASSWORD_MISMATCH" });
        assert.equal(UserRepository.withLockedUser.mock.callCount(), 0);
    });

    it("contraseña nueva inválida → PASSWORD_VALIDATION", async () => {
        await assert.rejects(AuthService.changePassword(5, 4, entrada({ newPassword: "corta", confirmPassword: "corta" })), { code: "PASSWORD_VALIDATION" });
    });

    it("sessionVersion del token desactualizada → SESSION_INVALID y no se actualiza nada", async () => {
        await assert.rejects(AuthService.changePassword(5, 3, entrada()), { status: 401, code: "SESSION_INVALID" });
        assert.equal(usuarioBloqueado.update.mock.callCount(), 0);
    });

    it("contraseña actual incorrecta → 403 CURRENT_PASSWORD_INVALID", async () => {
        await assert.rejects(AuthService.changePassword(5, 4, entrada({ currentPassword: "Equivocada1" })), { status: 403 });
    });

    it("reutilizar la contraseña actual → PASSWORD_REUSED", async () => {
        bcrypt.compare.mock.mockImplementation(async () => true);
        await assert.rejects(AuthService.changePassword(5, 4, entrada()), { code: "PASSWORD_REUSED" });
    });

    it("valor límite: sessionVersion = 2147483647 (máximo INTEGER) no puede incrementarse", async () => {
        usuarioBloqueado.sessionVersion = 2147483647;
        await assert.rejects(AuthService.changePassword(5, 2147483647, entrada()), /exhausted/);
        assert.equal(usuarioBloqueado.update.mock.callCount(), 0);
    });

    it("los errores de dominio son AuthError (el controlador los distingue de fallos internos)", async () => {
        await assert.rejects(AuthService.changePassword(5, 4, entrada({ confirmPassword: "x" })), (e) => e instanceof AuthError);
    });
});
