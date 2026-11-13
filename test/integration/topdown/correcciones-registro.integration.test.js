// Pruebas de regresión de las correcciones aplicadas en la rama `pruebas`.
// Integración Top-Down: ruta -> middleware de validación -> controlador -> servicio,
// con el repositorio de usuarios sustituido por un Stub en memoria (capa inferior).
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "pruebas-correcciones-secreto-solo-test";

const { createApp } = await import("../../../app.js");
const { default: UserRepository } = await import("../../../src/repositories/UserRepository.js");
const { default: jwt } = await import("../../../src/utils/jwt.js");

const originales = {
    create: UserRepository.create,
    findByEmail: UserRepository.findByEmail,
    findSessionById: UserRepository.findSessionById,
    update: UserRepository.update
};
let server, base, usuarios, siguienteId;

before(() => {
    // Stub: imita la restricción UNIQUE de PostgreSQL sobre la columna email.
    UserRepository.create = async (data) => {
        if ([...usuarios.values()].some((u) => u.email === data.email)) throw new Error("23505 unique_violation");
        const usuario = { ...data, id: siguienteId++, sessionVersion: 0, karmaPoints: 0 };
        usuarios.set(usuario.id, usuario);
        return usuario;
    };
    // El Stub reproduce la consulta real: comparación sin mayúsculas ni espacios.
    UserRepository.findByEmail = async (email) =>
        [...usuarios.values()].find((u) => u.email.trim().toLowerCase() === email) ?? null;
    UserRepository.findSessionById = async (id) => usuarios.get(id) ?? null;
    UserRepository.update = async (id, data) => {
        const usuario = usuarios.get(id);
        if (!usuario) return null;
        Object.assign(usuario, data);
        const { passwordHash, sessionVersion, ...publico } = usuario;
        return publico;
    };
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
    usuarios = new Map();
    siguienteId = 1;
});

after(async () => {
    Object.assign(UserRepository, originales);
    await new Promise((resolve) => server.close(resolve));
});

const enviar = (ruta, body, { method = "POST", token } = {}) => fetch(`${base}${ruta}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
});
const registro = (extra = {}) => ({ nombre: "Ana", apellido: "Pérez", email: "ana@crowdradar.test", password: "ClaveSegura1", ...extra });

test("Corrección 1: el correo se guarda normalizado (sin espacios y en minúsculas)", async () => {
    const respuesta = await enviar("/api/auth/register", registro({ email: "  Ana.Perez@CrowdRadar.TEST " }));
    assert.equal(respuesta.status, 201);
    assert.equal((await respuesta.json()).data.email, "ana.perez@crowdradar.test");
    assert.equal(usuarios.get(1).email, "ana.perez@crowdradar.test");
});

test("Corrección 1: no se puede crear una segunda cuenta que solo difiere en mayúsculas", async () => {
    assert.equal((await enviar("/api/auth/register", registro())).status, 201);
    const duplicado = await enviar("/api/auth/register", registro({ email: "ANA@CrowdRadar.test" }));
    assert.equal(duplicado.status, 400);
    assert.equal((await duplicado.json()).code, "EMAIL_EXISTS");
    assert.equal(usuarios.size, 1);
});

test("Corrección 1: el inicio de sesión no distingue mayúsculas en el correo", async () => {
    await enviar("/api/auth/register", registro());
    const login = await enviar("/api/auth/login", { email: "ANA@crowdradar.TEST", password: "ClaveSegura1" });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).data.user.email, "ana@crowdradar.test");
});

test("Corrección 2: nombre o apellido con solo espacios se rechaza con 400", async () => {
    for (const campo of ["nombre", "apellido"]) {
        const respuesta = await enviar("/api/auth/register", registro({ [campo]: "     " }));
        assert.equal(respuesta.status, 400, campo);
    }
    assert.equal(usuarios.size, 0);
});

test("Corrección 2: nombres y apellidos se guardan sin espacios sobrantes", async () => {
    await enviar("/api/auth/register", registro({ nombre: "  Ana ", apellido: " Pérez  " }));
    assert.equal(usuarios.get(1).nombre, "Ana");
    assert.equal(usuarios.get(1).apellido, "Pérez");
});

test("Corrección 3: textos de más de 255 caracteres responden 400 y no 503 de la BD", async () => {
    const largo = "a".repeat(256);
    for (const campo of ["nombre", "apellido", "telefono", "distrito"]) {
        const respuesta = await enviar("/api/auth/register", registro({ [campo]: largo }));
        assert.equal(respuesta.status, 400, campo);
    }
    // Valor límite permitido: exactamente 255 caracteres.
    assert.equal((await enviar("/api/auth/register", registro({ distrito: "d".repeat(255) }))).status, 201);
});

test("Corrección 2 y 3: la edición de perfil valida nombre vacío, longitud y cuerpo vacío", async () => {
    await enviar("/api/auth/register", registro());
    const token = jwt.generateToken({ id: 1, sessionVersion: 0 });
    for (const body of [{}, { nombre: "   " }, { telefono: "9".repeat(256) }]) {
        const respuesta = await enviar("/api/users/profile", body, { method: "PUT", token });
        assert.equal(respuesta.status, 400, JSON.stringify(body));
    }
    const valido = await enviar("/api/users/profile", { nombre: "  Ana María " }, { method: "PUT", token });
    assert.equal(valido.status, 200);
    assert.equal(usuarios.get(1).nombre, "Ana María");
});

test("Corrección 4: una ruta inexistente responde JSON 404 en lugar de HTML", async () => {
    const respuesta = await fetch(`${base}/api/no-existe`);
    assert.equal(respuesta.status, 404);
    assert.match(respuesta.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await respuesta.json(), { code: "NOT_FOUND", message: "El recurso solicitado no existe." });
});
