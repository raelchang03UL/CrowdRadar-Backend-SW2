import "dotenv/config";
import assert from "node:assert/strict";
import pg from "pg";
import { Sequelize, QueryTypes } from "sequelize";
import { migratePlaces } from "../src/database/migratePlaces.js";
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
} finally { await db.close(); }
