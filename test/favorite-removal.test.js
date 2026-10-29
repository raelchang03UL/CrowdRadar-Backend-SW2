import test, { before, after } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "hu84-test-only-not-a-real-secret";
const { default: app } = await import("../app.js");
const { default: favoriteRepository } = await import("../src/repositories/FavoriteRepository.js");
const { default: sequelize } = await import("../src/config/database.js");
const { default: userRepository } = await import("../src/repositories/UserRepository.js");
const { default: jwt } = await import("../src/utils/jwt.js");

let server;
let baseUrl;
const originalRemove = favoriteRepository.remove;
const originalSession = userRepository.findSessionById;

before(() => {
    userRepository.findSessionById = async () => ({ id: 1, status: "ACTIVO", rol: "USUARIO", sessionVersion: 0 });
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}/api/places`;
});

after(async () => {
    favoriteRepository.remove = originalRemove;
    userRepository.findSessionById = originalSession;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

const authorization = `Bearer ${jwt.generateToken({ id: 1, email: "test@example.com", sessionVersion: 0 })}`;

test("HU 8.4 elimina el favorito del usuario autenticado", async () => {
    const calls = [];
    favoriteRepository.remove = async (userId, placeId) => calls.push({ userId, placeId });

    const response = await fetch(`${baseUrl}/7/favorite`, {
        method: "DELETE",
        headers: { Authorization: authorization }
    });

    assert.equal(response.status, 204);
    assert.deepEqual(calls, [{ userId: 1, placeId: 7 }]);
    assert.equal(await response.text(), "");
});

test("HU 8.4 exige autenticación y valida el identificador", async () => {
    favoriteRepository.remove = async () => assert.fail("No debe eliminar sin una sesión válida.");
    const unauthenticated = await fetch(`${baseUrl}/7/favorite`, { method: "DELETE" });
    assert.equal(unauthenticated.status, 401);

    const invalid = await fetch(`${baseUrl}/invalid/favorite`, {
        method: "DELETE",
        headers: { Authorization: authorization }
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).code, "INVALID_PLACE_ID");
});

test("HU 8.4 no expone errores de persistencia", async () => {
    favoriteRepository.remove = async () => {
        throw new Error("internal database details");
    };

    const response = await fetch(`${baseUrl}/7/favorite`, {
        method: "DELETE",
        headers: { Authorization: authorization }
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
        message: "No se pudo eliminar el favorito. Inténtalo de nuevo."
    });
});

test("HU 8.4 borra la asociación por usuario y lugar, sin ampliar el alcance", async () => {
    const originalQuery = sequelize.query;
    try {
        favoriteRepository.remove = originalRemove;
        sequelize.query = async (sql, options) => {
            assert.match(sql, /DELETE FROM public\.favorites/);
            assert.match(sql, /WHERE user_id = :userId AND place_id = :placeId/);
            assert.deepEqual(options.replacements, { userId: 12, placeId: -7 });
            return [];
        };
        await favoriteRepository.remove(12, -7);
    } finally {
        sequelize.query = originalQuery;
    }
});
