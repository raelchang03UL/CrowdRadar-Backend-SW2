import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "hu81-test-only-not-a-real-secret";
const { default: app } = await import("../app.js");
const { default: placesRepository } = await import("../src/repositories/PlaceRepository.js");
const { default: favoriteRepository } = await import("../src/repositories/FavoriteRepository.js");
const { default: userRepository } = await import("../src/repositories/UserRepository.js");
const { default: jwt } = await import("../src/utils/jwt.js");

let server;
let baseUrl;
let places;
let favorites;
const originalFindActive = placesRepository.findActive;
const originalFindFavoriteIds = favoriteRepository.findPlaceIdsByUser;
const originalFindActiveFavorites = favoriteRepository.findActivePlacesByUser;
const originalAddFavorite = favoriteRepository.add;
const originalFindSession = userRepository.findSessionById;

const place = {
    id: 8,
    nombre: "Parque de prueba",
    categoria: "Parque",
    referencia: null,
    latitud: -12.0464,
    longitud: -77.0428,
    demostrativo: true
};

before(() => {
    userRepository.findSessionById = async (id) => ({ id, status: "ACTIVO", rol: "USUARIO", sessionVersion: 0 });
    placesRepository.findActive = async () => places;
    favoriteRepository.findPlaceIdsByUser = async (userId) =>
        favorites.filter((favorite) => favorite.userId === userId).map(({ placeId }) => placeId);
    favoriteRepository.findActivePlacesByUser = async (userId) =>
        favorites
            .filter((favorite) => favorite.userId === userId)
            .map(({ placeId }) => places.find((item) => item.id === placeId))
            .filter(Boolean)
            .map((item) => ({ ...item, esFavorito: true }));
    favoriteRepository.add = async (userId, placeId) => {
        if (!places.some((item) => item.id === placeId)) return "notFound";
        if (favorites.some((item) => item.userId === userId && item.placeId === placeId)) return "exists";
        favorites.push({ userId, placeId });
        return "added";
    };
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}/api/places`;
});

beforeEach(() => {
    places = [{ ...place }];
    favorites = [];
});

after(async () => {
    placesRepository.findActive = originalFindActive;
    favoriteRepository.findPlaceIdsByUser = originalFindFavoriteIds;
    favoriteRepository.findActivePlacesByUser = originalFindActiveFavorites;
    favoriteRepository.add = originalAddFavorite;
    userRepository.findSessionById = originalFindSession;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

const tokenFor = (id = 1) => jwt.generateToken({ id, email: `user${id}@example.com`, sessionVersion: 0 });
const request = (path, { method = "GET", id = 1, token = tokenFor(id) } = {}) =>
    fetch(`${baseUrl}${path}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

test("el listado de lugares informa el estado de favorito del usuario autenticado", async () => {
    favorites.push({ userId: 1, placeId: place.id });
    const response = await request("/");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.map(({ esFavorito }) => esFavorito), [true]);

    const otherUserResponse = await request("/", { id: 2 });
    assert.deepEqual((await otherUserResponse.json()).data.map(({ esFavorito }) => esFavorito), [false]);
});

test("registrar un favorito lo asocia al usuario autenticado", async () => {
    const response = await request(`/${place.id}/favorite`, { method: "POST", id: 2 });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
        message: "Lugar agregado a tus favoritos.",
        data: { placeId: place.id, esFavorito: true }
    });
    assert.deepEqual(favorites, [{ userId: 2, placeId: place.id }]);
});

test("un favorito duplicado responde 409 con un mensaje explícito", async () => {
    favorites.push({ userId: 1, placeId: place.id });
    const response = await request(`/${place.id}/favorite`, { method: "POST" });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
        message: "Este lugar ya pertenece a tus favoritos.",
        code: "FAVORITE_ALREADY_EXISTS"
    });
});

test("no permite registrar lugares inexistentes ni IDs inválidos", async () => {
    const missing = await request("/999/favorite", { method: "POST" });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).code, "PLACE_NOT_FOUND");
    const invalid = await request("/abc/favorite", { method: "POST" });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).code, "INVALID_PLACE_ID");
});

test("la lista de favoritos contiene solo los del usuario", async () => {
    favorites.push({ userId: 1, placeId: place.id }, { userId: 2, placeId: place.id });
    const response = await request("/favorites");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.map(({ id, esFavorito }) => ({ id, esFavorito })), [
        { id: place.id, esFavorito: true }
    ]);
});

test("el registro de favoritos requiere autenticación", async () => {
    const response = await request(`/${place.id}/favorite`, { method: "POST", token: null });
    assert.equal(response.status, 401);
});
