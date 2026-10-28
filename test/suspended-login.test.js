import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import app from "../app.js";
import users from "../src/repositories/UserRepository.js";

let server, root, user;
const original = users.findByEmail;
const password = "synthetic-login-password";

before(async () => {
    user = {
        id: 1,
        email: "suspended@example.test",
        status: "SUSPENDIDO",
        passwordHash: await bcrypt.hash(password, 4)
    };
    users.findByEmail = async (email) => (email === user.email ? user : null);
    await new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", resolve);
    });
    root = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    users.findByEmail = original;
    if (server) await new Promise((resolve) => server.close(resolve));
});

async function login(email, suppliedPassword) {
    const response = await fetch(`${root}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: suppliedPassword })
    });
    return { status: response.status, body: await response.json() };
}

test("HU7.3: contraseña válida informa suspensión sin emitir sesión ni datos de cuenta", async () => {
    const result = await login(user.email, password);
    assert.deepEqual(result, {
        status: 403,
        body: {
            code: "ACCOUNT_SUSPENDED",
            message:
                "Tu cuenta está suspendida. Un administrador debe reactivarla para que puedas volver a ingresar."
        }
    });
});

test("HU7.3: clave incorrecta y cuenta inexistente no revelan estado; otros estados fallan cerrados", async () => {
    const generic = {
        status: 401,
        body: { code: "INVALID_CREDENTIALS", message: "Correo o contraseña incorrectos." }
    };
    for (const status of ["ACTIVO", "SUSPENDIDO", "INACTIVO"]) {
        user.status = status;
        assert.deepEqual(await login(user.email, "synthetic-wrong-password"), generic);
    }
    assert.deepEqual(await login("missing@example.test", password), generic);
    assert.deepEqual(await login(user.email, password), generic);
    user.status = "SUSPENDIDO";
});
