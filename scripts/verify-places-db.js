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

    // El modelo/API se importan solo después de fijar y comprobar el destino aislado.
    // La tabla users centinela no es un esquema de autenticación: se dobla únicamente
    // su consulta de sesión; lugares/repository/HTTP sí usan PostgreSQL real.
    process.env.DB_NAME = database;
    process.env.DATABASE_URL = "";
    process.env.DB_SSL = "false";
    process.env.JWT_SECRET = "hu35-isolated-runner-not-a-real-secret";
    const { default: conexionPrueba } = await import("../src/config/database.js");
    assertIsolatedPlacesTestDatabase(conexionPrueba);
    const { default: Place } = await import("../src/models/Place.js");
    const { default: repositorio } = await import("../src/repositories/PlaceRepository.js");
    const { default: usuarios } = await import("../src/repositories/UserRepository.js");
    const { default: jwt } = await import("../src/utils/jwt.js");
    const { default: app } = await import("../app.js");
    const lugaresAntes = await select("SELECT * FROM public.places ORDER BY id");
    const sesionOriginal = usuarios.findSessionById;
    const consultaOriginal = Place.findAll;
    let transaccionCategoria, servidor;
    try {
        transaccionCategoria = await conexionPrueba.transaction();
        const categoriaAlfa = "QA HU35 Alfa";
        const categoriaBeta = "QA HU35 Beta";
        const categoriaInactiva = "QA HU35 Solo inactivos";
        for (const [id, categoria, activo] of [
            [-350005, categoriaAlfa, true], [-350004, categoriaAlfa, true],
            [-350003, categoriaBeta, true], [-350002, categoriaAlfa, false],
            [-350001, categoriaInactiva, false]
        ]) {
            await conexionPrueba.query(`INSERT INTO public.places
                (id, nombre, categoria, latitud, longitud, activo, demostrativo)
                VALUES ($1, 'QA HU35 transaccional', $2, -12, -77, $3, FALSE)`,
                { transaction: transaccionCategoria, bind: [id, categoria, activo] });
        }
        // Todas las consultas de lugares del recorrido comparten la transacción
        // que se revierte al terminar; no se publican fixtures persistentes.
        Place.findAll = (opciones) => consultaOriginal.call(Place, { ...opciones, transaction: transaccionCategoria });
        const filtrados = await repositorio.findActive(categoriaAlfa);
        assert.deepEqual(filtrados.map(({ id }) => id), [-350005, -350004]);
        assert.equal((await repositorio.findActive(categoriaBeta)).length, 1);
        assert.equal((await repositorio.findActive("QA HU35 inexistente")).length, 0);
        assert.equal((await repositorio.findActive("%" )).length, 0);
        assert.equal((await repositorio.findActive("QA HU35 Alfa' OR TRUE --")).length, 0);
        const categorias = (await repositorio.findActiveCategories()).map(({ categoria }) => categoria);
        assert.equal(categorias.filter((categoria) => categoria === categoriaAlfa).length, 1);
        assert.ok(categorias.includes(categoriaBeta));
        assert.ok(!categorias.includes(categoriaInactiva));
        assert.ok(categorias.every((categoria) => categoria.trim()));
        assert.ok((await repositorio.findActive()).every(({ activo }) => activo));
        console.log("PASS: HU 3.5 ORM real filtra por igualdad, activos/orden, catálogo único y SQL literal.");

        usuarios.findSessionById = async () => ({ id: 1, status: "ACTIVO", rol: "USUARIO", sessionVersion: 0 });
        servidor = app.listen(0);
        const url = `http://127.0.0.1:${servidor.address().port}/api/places`;
        const token = jwt.generateToken({ id: 1, sessionVersion: 0 });
        const solicitar = (ruta, autenticado = true) => fetch(url + ruta,
            { headers: autenticado ? { Authorization: `Bearer ${token}` } : {} });
        assert.equal((await solicitar("/categories", false)).status, 401);
        assert.equal((await solicitar("?categoria=" + encodeURIComponent(categoriaAlfa), false)).status, 401);
        const catalogo = await solicitar("/categories");
        assert.equal(catalogo.status, 200);
        assert.deepEqual((await catalogo.json()).data, categorias);
        for (const [categoria, ids] of [[categoriaAlfa, [-350005, -350004]], [categoriaBeta, [-350003]], ["QA HU35 inexistente", []]]) {
            const respuesta = await solicitar("?categoria=" + encodeURIComponent(categoria));
            assert.equal(respuesta.status, 200);
            assert.deepEqual((await respuesta.json()).data.map(({ id }) => id), ids);
        }
        const sinFiltro = await solicitar("?categoria=");
        assert.equal(sinFiltro.status, 200);
        assert.equal((await sinFiltro.json()).data.length, (await repositorio.findActive()).length);
        assert.equal((await solicitar("?categoria=Parque&categoria=Cultura")).status, 400);
        assert.equal((await solicitar("?categoria=Parque&extra=1")).status, 400);
        console.log("PASS: HU 3.5 HTTP + PostgreSQL real, cambio/quitar filtro, vacío, catálogo y 400/401 (sesión doblada).");
    } finally {
        if (servidor) await new Promise((resolve) => servidor.close(resolve));
        Place.findAll = consultaOriginal;
        usuarios.findSessionById = sesionOriginal;
        if (transaccionCategoria) await transaccionCategoria.rollback();
        await conexionPrueba.close();
    }
    assert.deepEqual(await select("SELECT * FROM public.places ORDER BY id"), lugaresAntes);
    assert.deepEqual(await select("SELECT * FROM public.users ORDER BY id"), before);
    console.log("PASS: HU 3.5 fixtures revertidos y datos de lugares/users conservados.");
} finally { await db.close(); }
