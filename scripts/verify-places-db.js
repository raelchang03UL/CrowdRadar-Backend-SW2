import "dotenv/config";
import assert from "node:assert/strict";
import pg from "pg";
import { Sequelize, QueryTypes } from "sequelize";
import { migratePlaces } from "../src/database/migratePlaces.js";
import { migratePlaceDetails, placeDetailsMigration } from "../src/database/migratePlaceDetails.js";
import { createPlaceRepository } from "../src/repositories/PlaceRepository.js";
import Place from "../src/models/Place.js";
import { seedPlacesDemo, demoPlaces } from "../src/database/seedPlacesDemo.js";
import { assertIsolatedPlacesTestDatabase } from "../src/database/databaseSafety.js";

// Único destino de esta comprobación; no usa DB_NAME de .env.
const database = "crowdradar_hu31_test";
const host = process.env.DB_HOST;
assertIsolatedPlacesTestDatabase({ config: { host, database } });
const credentials = { host, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
const admin = new pg.Client({ ...credentials, database: "postgres" });
try {
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (!exists.rowCount) await admin.query('CREATE DATABASE "crowdradar_hu31_test"');
} finally { await admin.end(); }
const db = new Sequelize(database, credentials.user, credentials.password, { host, port: credentials.port, dialect: "postgres", logging: false });
const select = (sql) => db.query(sql, { type: QueryTypes.SELECT });
try {
    // Tabla centinela, solo en la base aislada: la migración no debe tocar users.
    await db.query("CREATE TABLE IF NOT EXISTS public.users (id INTEGER PRIMARY KEY, marcador TEXT NOT NULL)");
    await db.query("INSERT INTO public.users VALUES (1, 'conservar') ON CONFLICT (id) DO NOTHING");
    const before = await select("SELECT * FROM public.users ORDER BY id");
    const columnsBefore = await select("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position");
    await migratePlaces(db);
    assert.equal(await migratePlaces(db), false);
    assert.deepEqual(await select("SELECT * FROM public.users ORDER BY id"), before);
    assert.deepEqual(await select("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position"), columnsBefore);
    assert.equal((await select("SELECT * FROM public.crowdradar_migrations WHERE name = '001-create-places'")).length, 1);
    console.log("PASS: migración idempotente, historial único, datos y estructura users intactos.");
    const placesBefore = await select("SELECT id, nombre, categoria, referencia, latitud, longitud, activo, demostrativo FROM public.places ORDER BY id");
    await migratePlaceDetails(db);
    assert.equal(await migratePlaceDetails(db), false);
    assert.equal((await select(`SELECT name FROM public.crowdradar_migrations WHERE name = '${placeDetailsMigration}'`)).length, 1);
    assert.deepEqual(await select("SELECT id, nombre, categoria, referencia, latitud, longitud, activo, demostrativo FROM public.places ORDER BY id"), placesBefore);
    assert.deepEqual(await select("SELECT * FROM public.users ORDER BY id"), before);
    console.log("PASS: dirección aditiva, migración 004 idempotente; lugares y usuarios anteriores preservados.");
    for (const [latitud, longitud] of [[91, 0], [0, 181], [NaN, 0], [0, Infinity]]) {
        const transaction = await db.transaction();
        try {
            await assert.rejects(db.query(`INSERT INTO public.places (nombre, categoria, latitud, longitud)
                VALUES ('Inválido', 'Prueba', $1, $2)`, { transaction, bind: [latitud, longitud] }),
                (error) => error.parent?.code === '23514');
        } finally { await transaction.rollback(); }
    }
    console.log("PASS: PostgreSQL rechaza rango inválido, NaN e infinito (4 casos, rollback).");
    await seedPlacesDemo(db);
    await seedPlacesDemo(db);
    const rows = await select("SELECT * FROM public.places WHERE demostrativo = TRUE AND activo = TRUE ORDER BY id");
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(({ id, nombre, latitud, longitud }) => ({ id, nombre, latitud, longitud })),
        demoPlaces.map(({ id, nombre, latitud, longitud }) => ({ id, nombre, latitud, longitud })));
    console.log("PASS: fixture explícito de 3 lugares, coordenadas determinísticas y sin duplicados.");
    const transaction = await db.transaction();
    try {
        await db.query("INSERT INTO public.places (id, nombre, categoria, latitud, longitud, activo) VALUES (-999, 'Inactivo de prueba', 'Prueba', 0, 0, FALSE)", { transaction });
        const inactive = await db.query("SELECT * FROM public.places WHERE id = -999 AND activo = TRUE", { transaction, type: QueryTypes.SELECT });
        assert.equal(inactive.length, 0);
    } finally { await transaction.rollback(); }
    console.log("PASS: lugar inactivo no aparece en la consulta activa; fila de prueba revertida.");
    // Usa el repositorio real sobre PostgreSQL aislado, sin sync ni DDL implícito.
    const modelo = db.define("PlaceDbTest", Place.getAttributes(), { tableName: "places", timestamps: false });
    const repository = createPlaceRepository(modelo);
    assert.equal((await repository.findActiveById(-103)).direccion, demoPlaces[0].direccion);
    assert.equal(await repository.findActiveById(2147483647), null);
    const tx = await db.transaction();
    try {
        await modelo.create({ id: -998, nombre: "Literal 50%_\\ ruta", categoria: "Prueba", direccion: null, latitud: 0, longitud: 0, activo: true, demostrativo: false }, { transaction: tx });
        await modelo.create({ id: -997, nombre: "Demo oculto", categoria: "Prueba", latitud: 0, longitud: 0, activo: false, demostrativo: false }, { transaction: tx });
        const transactionalRepository = createPlaceRepository({
            findAll: (options) => modelo.findAll({ ...options, transaction: tx }),
            findOne: (options) => modelo.findOne({ ...options, transaction: tx })
        });
        assert.equal(await transactionalRepository.findActiveById(-997), null);
        assert.equal((await transactionalRepository.findActiveById(-998)).direccion, null);
    } finally { await tx.rollback(); }
    console.log("PASS: repositorio real: detalle, dirección opcional e inactivos (fixtures temporales revertidos).");
} finally { await db.close(); }
