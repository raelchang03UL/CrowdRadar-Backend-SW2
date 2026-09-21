import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";

process.env.JWT_SECRET = "crowdradar-test-secret-not-for-production";

const { default: app } = await import("../app.js");
const { default: UserRepository } = await import(
    "../src/repositories/UserRepository.js"
);

let server;
let baseUrl;
let nextId;
let users;

const originalRepositoryMethods = {
    create: UserRepository.create,
    findById: UserRepository.findById,
    findByEmail: UserRepository.findByEmail,
    update: UserRepository.update
};

const publicUser = (user) => {
    if (!user) return null;
    const { passwordHash, password, ...safeUser } = user;
    return safeUser;
};

before(() => {
    UserRepository.create = async (data) => {
        const now = new Date().toISOString();
        const user = {
            ...data,
            id: nextId++,
            createdAt: now,
            updatedAt: now
        };
        users.set(user.id, user);
        return user;
    };

    UserRepository.findById = async (id) => publicUser(users.get(id));

    UserRepository.findByEmail = async (email) =>
        [...users.values()].find((user) => user.email === email) ?? null;

    UserRepository.update = async (id, data) => {
        const user = users.get(id);
        if (!user) return null;
        const updated = {
            ...user,
            ...data,
            id: user.id,
            updatedAt: new Date().toISOString()
        };
        users.set(id, updated);
        return publicUser(updated);
    };

    server = app.listen(0);
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    Object.assign(UserRepository, originalRepositoryMethods);
    await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
});

beforeEach(() => {
    nextId = 1;
    users = new Map();
});

const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers ?? {})
        }
    });
    const body = await response.json();
    return { response, body };
};

const registerCitizen = async () => {
    const payload = {
        nombre: "Ana",
        apellido: "Ruiz",
        email: "ana.ruiz@correo.pe",
        password: "ClaveSegura123",
        telefono: "987654321",
        distrito: "Lima"
    };

    const result = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
    });

    return { ...result, payload };
};

test("HU 1.2 registra al ciudadano y cifra la contraseña", async () => {
    const { response, body, payload } = await registerCitizen();

    assert.equal(response.status, 201);
    assert.equal(body.data.email, payload.email);
    assert.equal(body.data.passwordHash, undefined);

    const storedUser = [...users.values()][0];
    assert.notEqual(storedUser.passwordHash, payload.password);
    assert.equal(await bcrypt.compare(payload.password, storedUser.passwordHash), true);
    assert.equal(storedUser.rol, "USUARIO");
    assert.equal(storedUser.status, "ACTIVO");

    const duplicate = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
    });
    assert.equal(duplicate.response.status, 400);
    assert.equal(duplicate.body.message, "El correo ya está registrado.");
});

test("HU 1.1 inicia sesión, genera JWT y rechaza una contraseña inválida", async () => {
    const { payload } = await registerCitizen();

    const login = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
            email: payload.email,
            password: payload.password
        })
    });

    assert.equal(login.response.status, 200);
    assert.equal(login.body.data.user.email, payload.email);
    assert.match(login.body.data.token, /^[^.]+\.[^.]+\.[^.]+$/);

    const invalidLogin = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
            email: payload.email,
            password: "Incorrecta123"
        })
    });
    assert.equal(invalidLogin.response.status, 401);
    assert.equal(invalidLogin.body.message, "Correo o contraseña incorrectos.");
});

test("HU 1.3 muestra el perfil únicamente con un token válido", async () => {
    const { payload } = await registerCitizen();
    const login = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: payload.email, password: payload.password })
    });

    const withoutToken = await request("/api/users/profile");
    assert.equal(withoutToken.response.status, 401);

    const profile = await request("/api/users/profile", {
        headers: { Authorization: `Bearer ${login.body.data.token}` }
    });
    assert.equal(profile.response.status, 200);
    assert.equal(profile.body.data.nombre, payload.nombre);
    assert.equal(profile.body.data.passwordHash, undefined);
});

test("HU 1.4 actualiza el perfil y conserva los cambios en la consulta siguiente", async () => {
    const { payload } = await registerCitizen();
    const login = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: payload.email, password: payload.password })
    });
    const headers = { Authorization: `Bearer ${login.body.data.token}` };

    const update = await request("/api/users/profile", {
        method: "PUT",
        headers,
        body: JSON.stringify({
            nombre: "Ana María",
            apellido: "Ruiz Mendoza",
            telefono: "912345678",
            distrito: "Miraflores"
        })
    });

    assert.equal(update.response.status, 200);
    assert.equal(update.body.data.nombre, "Ana María");
    assert.equal(update.body.data.distrito, "Miraflores");

    const profile = await request("/api/users/profile", { headers });
    assert.equal(profile.response.status, 200);
    assert.equal(profile.body.data.apellido, "Ruiz Mendoza");
    assert.equal(profile.body.data.telefono, "912345678");

    const invalidUpdate = await request("/api/users/profile", {
        method: "PUT",
        headers,
        body: JSON.stringify({ nombre: "A" })
    });
    assert.equal(invalidUpdate.response.status, 400);
    assert.equal(invalidUpdate.body.message, "Datos inválidos.");
});
