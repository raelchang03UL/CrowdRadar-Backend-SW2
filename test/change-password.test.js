import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import jsonwebtoken from "jsonwebtoken";
process.env.JWT_SECRET = "change-password-unit-only-not-a-production-secret";
const { default: app } = await import("../app.js");
const { default: repository } = await import("../src/repositories/UserRepository.js");
const { default: jwt } = await import("../src/utils/jwt.js");
const { validPassword } = await import("../src/utils/passwordPolicy.js");
let server, url, user, failSave, failSession, lockedVersion, missingUser, failLogin;
const originals = { findSessionById: repository.findSessionById, withLockedUser: repository.withLockedUser, findByEmail: repository.findByEmail, findById: repository.findById };
const oldPassword = "unit-current-password";
const newPassword = "unit-new-password";
before(() => {
    repository.findSessionById = async () => {
        if (failSession) throw new Error("private-db-detail");
        if (missingUser) return null;
        return user;
    };
    repository.findByEmail = async () => {
        if (failLogin) throw new Error("private-db-connection-info");
        return user;
    };
    repository.findById = async () => {
        const { passwordHash, sessionVersion, update, ...safe } = user;
        return safe;
    };
    repository.withLockedUser = async (id, operation) => {
        if (lockedVersion !== undefined) user.sessionVersion = lockedVersion;
        return operation(user, {});
    };
    server = app.listen(0);
    url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    Object.assign(repository, originals);
    await new Promise((resolve) => server.close(resolve));
});
beforeEach(async () => {
    failSave = failSession = missingUser = failLogin = false;
    lockedVersion = undefined;
    user = { id: 1, email: "unit@example.test", nombre: "Rael", apellido: "Chang", rol: "USUARIO", status: "ACTIVO", sessionVersion: 0, passwordHash: await bcrypt.hash(oldPassword, 4) };
    user.update = async (data) => {
        if (failSave) throw new Error("private-sql-detail");
        Object.assign(user, data);
    };
});
const request = async ({ body = { currentPassword: oldPassword, newPassword, confirmPassword: newPassword }, token = jwt.generateToken(user), path = "/api/auth/password/change", method = "POST" } = {}) => {
    const response = await fetch(`${url}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
};

test("HU 2.3 cambia hash/version y rechaza JWT anterior en perfil y lugares", async () => {
    const token = jwt.generateToken(user);
    const result = await request({ token });
    assert.deepEqual(result, { status: 200, body: { message: "Contraseña actualizada. Inicia sesión nuevamente." } });
    assert.equal(user.sessionVersion, 1);
    assert.equal(await bcrypt.compare(newPassword, user.passwordHash), true);
    assert.equal(await bcrypt.compare(oldPassword, user.passwordHash), false);
    for (const path of ["/api/users/profile", "/api/places"]) {
        const stale = await request({ path, method: "GET", token });
        assert.equal(stale.status, 401);
        assert.equal(stale.body.code, "SESSION_INVALID");
    }
    const login = await request({ path: "/api/auth/login", body: { email: user.email, password: newPassword } });
    assert.equal(login.status, 200);
    assert.equal(jwt.verifyToken(login.body.data.token).sessionVersion, 1);
    assert.equal((await request({ path: "/api/users/profile", method: "GET", token: login.body.data.token })).status, 200);
    assert.equal((await request({ path: "/api/auth/login", body: { email: user.email, password: oldPassword } })).status, 401);
});

test("HU 2.3 rechaza actual incorrecta sin cambiar hash/version", async () => {
    const previous = user.passwordHash;
    const result = await request({ body: { currentPassword: "unit-wrong-password", newPassword, confirmPassword: newPassword } });
    assert.equal(result.status, 403);
    assert.equal(result.body.code, "CURRENT_PASSWORD_INVALID");
    assert.equal(user.passwordHash, previous);
    assert.equal(user.sessionVersion, 0);
});

test("HU 2.3 valida campos, confirmación, Unicode y no reutilización", async () => {
    for (const body of [{}, { currentPassword: oldPassword, newPassword, confirmPassword: newPassword, rol: "ADMIN" },
        { currentPassword: oldPassword, newPassword: "corta", confirmPassword: "corta" },
        { currentPassword: oldPassword, newPassword: "        ", confirmPassword: "        " },
        { currentPassword: oldPassword, newPassword: "é".repeat(37), confirmPassword: "é".repeat(37) },
        { currentPassword: "x".repeat(73), newPassword, confirmPassword: newPassword }]) {
        const result = await request({ body });
        assert.equal(result.status, 400);
        assert.equal(result.body.code, "PASSWORD_VALIDATION");
    }
    assert.equal((await request({ body: { currentPassword: oldPassword, newPassword, confirmPassword: oldPassword } })).body.code, "PASSWORD_MISMATCH");
    assert.equal((await request({ body: { currentPassword: oldPassword, newPassword: oldPassword, confirmPassword: oldPassword } })).body.code, "PASSWORD_REUSED");
    assert.equal(validPassword("é".repeat(36)), true);
    assert.equal(validPassword("😀".repeat(4)), false);
    assert.equal(user.sessionVersion, 0);
});

test("HU 2.3 rechaza sesión ausente, expirada, legacy y usuario inactivo", async () => {
    const legacy = jsonwebtoken.sign({ id: 1, email: user.email }, process.env.JWT_SECRET);
    const expired = jsonwebtoken.sign({ id: 1, sessionVersion: 0 }, process.env.JWT_SECRET, { expiresIn: -1 });
    for (const token of [null, "invalid-unit-token", legacy, expired]) {
        const result = await request({ token });
        assert.equal(result.status, 401);
        assert.equal(result.body.code, "SESSION_INVALID");
    }
    const token = jwt.generateToken(user);
    user.status = "INACTIVO";
    assert.equal((await request({ token })).status, 401);
    user.status = "ACTIVO";
    missingUser = true;
    assert.equal((await request({ token })).status, 401);
});

test("HU 2.3 revalida versión bajo lock y no sobrescribe otro cambio", async () => {
    const previous = user.passwordHash;
    lockedVersion = 1;
    const result = await request();
    assert.equal(result.status, 401);
    assert.equal(result.body.code, "SESSION_INVALID");
    assert.equal(user.passwordHash, previous);
});

test("HU 2.3 falla cerrado ante DB sin filtrar detalles internos", async () => {
    failSave = true;
    const previous = user.passwordHash;
    const result = await request();
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "SERVICE_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(result.body), /private|sql|passwordHash/);
    assert.equal(user.passwordHash, previous);
    assert.equal(user.sessionVersion, 0);
    failSession = true;
    assert.equal((await request()).status, 503);
});

test("HU 2.3 login rechaza límite bcrypt y no expone fallo DB en login/registro", async () => {
    const overlong = await request({ path: "/api/auth/login", body: { email: user.email, password: "x".repeat(73) } });
    assert.equal(overlong.status, 401);
    failLogin = true;
    for (const path of ["/api/auth/login", "/api/auth/register"]) {
        const body = path.endsWith("register") ? { nombre: "Rael", apellido: "Chang", email: user.email, password: oldPassword } : { email: user.email, password: oldPassword };
        const result = await request({ path, body });
        assert.equal(result.status, 503);
        assert.equal(result.body.code, "SERVICE_UNAVAILABLE");
        assert.doesNotMatch(JSON.stringify(result.body), /private-db|connection-info/);
    }
});
