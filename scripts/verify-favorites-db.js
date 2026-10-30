import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { QueryTypes, Sequelize } from "sequelize";
import { assertIsolatedFavoritesTestDatabase } from "../src/database/databaseSafety.js";
import { migratePlaces } from "../src/database/migratePlaces.js";
import { migrateAuth } from "../src/database/migrateAuth.js";
import { migrateRecovery } from "../src/database/migrateRecovery.js";
import { migrateFavorites } from "../src/database/migrateFavorites.js";

const database = "crowdradar_hu81_test";
assertIsolatedFavoritesTestDatabase({ config: { database, host: process.env.DB_HOST } });
const credentials = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
};
const admin = new pg.Client({ ...credentials, database: "postgres" });
try {
    await admin.connect();
    if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database])).rowCount) {
        await admin.query('CREATE DATABASE "crowdradar_hu81_test"');
    }
} finally {
    await admin.end();
}

const db = new Sequelize(database, credentials.user, credentials.password, {
    host: credentials.host,
    port: credentials.port,
    dialect: "postgres",
    logging: false
});
const select = (sql, replacements = {}) => db.query(sql, { replacements, type: QueryTypes.SELECT });
let isolatedSequelize;
try {
    await db.authenticate();
    assertIsolatedFavoritesTestDatabase(db);
    await migratePlaces(db);
    await migrateAuth(db);
    await migrateRecovery(db);
    const alreadyApplied = (await select(
        "SELECT name FROM public.crowdradar_migrations WHERE name = '004-user-favorites'"
    )).length > 0;
    assert.equal(await migrateFavorites(db), !alreadyApplied);
    assert.equal(await migrateFavorites(db), false);
    const user = (await select(`INSERT INTO public.users
        (nombre, apellido, email, "passwordHash", "createdAt", "updatedAt")
        VALUES ('Usuario', 'Prueba', :email, 'not-used', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id`, {
        email: `favorites-${Date.now()}-${randomBytes(4).toString("hex")}@example.test`
    }))[0];
    const place = (await select(`INSERT INTO public.places
        (nombre, categoria, latitud, longitud) VALUES ('Lugar de prueba', 'Parque', 0, 0)
        RETURNING id`))[0];
    process.env.DB_NAME = database;
    delete process.env.DATABASE_URL;
    ({ default: isolatedSequelize } = await import("../src/config/database.js"));
    const { default: favoriteRepository } = await import("../src/repositories/FavoriteRepository.js");
    const { default: placeService } = await import("../src/services/PlaceService.js");
    const first = await favoriteRepository.add(user.id, place.id);
    const duplicate = await favoriteRepository.add(user.id, place.id);
    assert.equal(first, "added");
    assert.equal(duplicate, "exists");
    assert.deepEqual(await favoriteRepository.findPlaceIdsByUser(user.id), [place.id]);
    assert.equal((await favoriteRepository.findActivePlacesByUser(user.id)).length, 1);
    const places = await placeService.listActive(user.id);
    assert.equal(places.find(({ id }) => id === place.id).esFavorito, true);
    assert.deepEqual(await placeService.listFavorites(user.id), [
        {
            id: place.id,
            nombre: "Lugar de prueba",
            categoria: "Parque",
            referencia: null,
            latitud: 0,
            longitud: 0,
            demostrativo: false,
            esFavorito: true
        }
    ]);
    assert.equal((await select("SELECT name FROM public.crowdradar_migrations WHERE name = '004-user-favorites'")).length, 1);
    console.log("PASS: migración 004 idempotente, repositorio/servicio y rechazo de favoritos duplicados en crowdradar_hu81_test.");
} finally {
    if (isolatedSequelize) await isolatedSequelize.close();
    await db.close();
}
