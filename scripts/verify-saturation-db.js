import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { QueryTypes } from "sequelize";
import { assertIsolatedAuthTestDatabase } from "../src/database/databaseSafety.js";
import { migratePlaces } from "../src/database/migratePlaces.js";
import { migrateAuth } from "../src/database/migrateAuth.js";
import { migrateRecovery } from "../src/database/migrateRecovery.js";
import { migrateReports, reportsMigration, assertReportsSchemaReady } from "../src/database/migrateReports.js";

// No crea ni elige otra DB: reutiliza exclusivamente la base aislada de autenticación.
const database = "crowdradar_auth_test";
assertIsolatedAuthTestDatabase({ config: { database, host: process.env.DB_HOST } });
process.env.DB_NAME = database;
delete process.env.DATABASE_URL;
const { default: sequelize } = await import("../src/config/database.js");
const { default: User } = await import("../src/models/User.js");
const { default: repository } = await import("../src/repositories/SaturationQueryRepository.js");
const { default: service } = await import("../src/services/SaturationQueryService.js");
const { default: jwt } = await import("../src/utils/jwt.js");
const { createApp } = await import("../app.js");
const originales = { query: repository.findActiveSnapshot, user: User.findByPk };
const select = (sql, replacements = {}, transaction) => sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT });
const contenido = (tabla) => select(`SELECT to_jsonb(f) AS fila FROM public.${tabla} f ORDER BY id`);
const run = `${Date.now()}-${randomBytes(6).toString("hex")}`;
let transaccion, server;
let etapa = "migración";
try {
    await sequelize.authenticate();
    assertIsolatedAuthTestDatabase(sequelize);
    await migratePlaces(sequelize);
    await migrateAuth(sequelize);
    await migrateRecovery(sequelize);
    const usuariosAntes = await contenido("users");
    const lugaresAntes = await contenido("places");
    const historialAntes = await select("SELECT name, applied_at FROM public.crowdradar_migrations ORDER BY name");
    const yaAplicada = historialAntes.some(({ name }) => name === reportsMigration);
    const reportesAntes = yaAplicada ? await contenido("saturation_reports") : [];
    assert.equal(await migrateReports(sequelize), !yaAplicada);
    assert.equal(await migrateReports(sequelize), false);
    await assertReportsSchemaReady(sequelize);
    assert.deepEqual(await contenido("users"), usuariosAntes);
    assert.deepEqual(await contenido("places"), lugaresAntes);
    const historialDespues = await select("SELECT name, applied_at FROM public.crowdradar_migrations ORDER BY name");
    for (const fila of historialAntes) assert.deepEqual(historialDespues.find(({ name }) => name === fila.name), fila);
    assert.equal(historialDespues.filter(({ name }) => name === reportsMigration).length, 1);
    assert.deepEqual(await contenido("saturation_reports"), reportesAntes);
    console.log("PASS: migración de HU 4.1 exacta, aditiva/idempotente, esquema e historial previos preservados.");

    etapa = "fixtures revertibles y consulta SQL";
    transaccion = await sequelize.transaction();
    const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
    const usuarios = [];
    for (let numero = 0; numero < 5; numero++) {
        usuarios.push(await User.create({ nombre: "QA", apellido: "Saturacion", email: `hu32-${run}-${numero}@example.test`, passwordHash, rol: "USUARIO", status: "ACTIVO", sessionVersion: 0 }, { transaction: transaccion }));
    }
    const [lugar] = await select(`INSERT INTO public.places (nombre, categoria, referencia, latitud, longitud, demostrativo)
        VALUES (:nombre, 'Prueba', 'Solo transacción aislada', -12, -77, TRUE) RETURNING id`, { nombre: `QA HU3.2 ${run}` }, transaccion);
    const [inactivo] = await select(`INSERT INTO public.places (nombre, categoria, latitud, longitud, activo, demostrativo)
        VALUES (:nombre, 'Prueba', -12, -77, FALSE, TRUE) RETURNING id`, { nombre: `QA HU3.2 inactivo ${run}` }, transaccion);
    const agregar = (persona, level, desplazamiento = "-10 minutes", destino = lugar.id) => select(`INSERT INTO public.saturation_reports (user_id, place_id, level, created_at)
        VALUES (:userId, :placeId, :level, statement_timestamp() + CAST(:desplazamiento AS INTERVAL)) RETURNING id`, {
        userId: usuarios[persona].id, placeId: destino, level, desplazamiento
    }, transaccion);
    // Las capas reales leen la misma transacción para que ningún dato ficticio se confirme.
    repository.findActiveSnapshot = (id) => originales.query(id, { transaction: transaccion });
    User.findByPk = (id, options = {}) => originales.user.call(User, id, { ...options, transaction: transaccion });
    const consultar = () => service.getForPlace(String(lugar.id));
    const vacio = await consultar();
    assert.equal(vacio.reportCount, 0);
    assert.equal(vacio.updatedAt, null);
    assert.equal(vacio.reason, "INSUFFICIENT_REPORTS");
    await agregar(0, "TRANQUILO");
    await agregar(0, "MODERADO", "-5 minutes");
    const unico = await consultar();
    assert.equal(unico.reportCount, 1);
    assert.equal(unico.level, null);
    await agregar(1, "MODERADO");
    assert.equal((await consultar()).reportCount, 2);
    await agregar(2, "MODERADO");
    const conocido = await consultar();
    assert.equal(conocido.reportCount, 3);
    assert.equal(conocido.level, "MODERADO");
    assert.equal(conocido.reason, null);
    assert.ok(new Date(conocido.updatedAt) <= new Date(conocido.evaluatedAt));
    console.log("PASS: SQL real 0/1/2 insuficientes, tres personas y último reporte por usuario.");

    for (const nivel of ["TRANQUILO", "SATURADO"]) {
        for (let numero = 0; numero < 3; numero++) await agregar(numero, nivel, "-1 minute");
        assert.equal((await consultar()).level, nivel);
    }
    await agregar(0, "TRANQUILO", "-10 seconds");
    await agregar(1, "MODERADO", "-10 seconds");
    await agregar(2, "SATURADO", "-10 seconds");
    const empate = await consultar();
    assert.equal(empate.level, null);
    assert.equal(empate.reason, "TIE");
    assert.equal(empate.reportCount, 3);
    // Cada par comparte exactamente created_at: mayor BIGSERIAL rompe el empate del último reporte.
    await select(`INSERT INTO public.saturation_reports (user_id, place_id, level, created_at)
        SELECT :userId, :placeId, nivel, statement_timestamp() - interval '1 second'
        FROM (VALUES ('TRANQUILO', 1), ('SATURADO', 2)) AS votos(nivel, orden) ORDER BY orden`, {
        userId: usuarios[1].id, placeId: lugar.id
    }, transaccion);
    assert.equal((await consultar()).level, "SATURADO");
    await agregar(3, "TRANQUILO", "-31 minutes");
    await agregar(4, "TRANQUILO", "1 minute");
    await agregar(0, "MODERADO", "1 minute");
    assert.equal((await consultar()).reportCount, 3);
    assert.equal((await consultar()).level, "SATURADO");
    await agregar(3, "TRANQUILO", "-1 minute", inactivo.id);
    await assert.rejects(service.getForPlace(String(inactivo.id)), (error) => error.code === "PLACE_NOT_FOUND");
    await assert.rejects(service.getForPlace("-2147483648"), (error) => error.code === "PLACE_NOT_FOUND");
    console.log("PASS: tres niveles, empate, BIGSERIAL determinístico, vencidos/futuros excluidos e inactivos ocultos.");

    etapa = "HTTP y sesión PostgreSQL reales";
    server = createApp().listen(0);
    const base = `http://127.0.0.1:${server.address().port}/api/places`;
    const token = jwt.generateToken({ id: usuarios[0].id, sessionVersion: 0 });
    const peticion = (id = lugar.id, credencial = token) => fetch(`${base}/${id}/saturation`, {
        headers: credencial ? { Authorization: `Bearer ${credencial}` } : {}
    });
    const respuesta = await peticion();
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
    const dto = (await respuesta.json()).data;
    assert.deepEqual(Object.keys(dto).sort(), ["placeId", "level", "reportCount", "windowMinutes", "minimumReports", "reason", "evaluatedAt", "updatedAt"].sort());
    assert.equal(dto.level, "SATURADO");
    assert.equal(dto.reportCount, 3);
    const [sinReportes] = await select(`INSERT INTO public.places (nombre, categoria, latitud, longitud, demostrativo)
        VALUES (:nombre, 'Prueba', -12, -77, TRUE) RETURNING id`, { nombre: `QA HU3.2 vacío ${run}` }, transaccion);
    const informacionInsuficiente = await peticion(sinReportes.id);
    assert.equal(informacionInsuficiente.status, 200);
    assert.deepEqual((await informacionInsuficiente.json()).data.reason, "INSUFFICIENT_REPORTS");
    for (let numero = 0; numero < 3; numero++) await agregar(numero, ["TRANQUILO", "MODERADO", "SATURADO"][numero], "-1 minute", sinReportes.id);
    const informacionEmpatada = await peticion(sinReportes.id);
    assert.equal(informacionEmpatada.status, 200);
    const dtoEmpatado = (await informacionEmpatada.json()).data;
    assert.equal(dtoEmpatado.reason, "TIE");
    assert.equal(dtoEmpatado.level, null);
    assert.equal(dtoEmpatado.reportCount, 3);
    for (const nivel of ["TRANQUILO", "MODERADO", "SATURADO"]) {
        for (let numero = 0; numero < 3; numero++) await agregar(numero, nivel, "-1 millisecond", sinReportes.id);
        const nivelHttp = await peticion(sinReportes.id);
        assert.equal(nivelHttp.status, 200);
        assert.equal((await nivelHttp.json()).data.level, nivel);
    }
    assert.equal((await peticion(lugar.id, null)).status, 401);
    assert.equal((await peticion("0")).status, 400);
    assert.equal((await peticion(inactivo.id)).status, 404);
    assert.equal((await peticion("-2147483648")).status, 404);
    await usuarios[0].update({ sessionVersion: 1 }, { transaction: transaccion });
    assert.equal((await peticion()).status, 401);
    const actualizado = jwt.generateToken({ id: usuarios[0].id, sessionVersion: 1 });
    assert.equal((await peticion(lugar.id, actualizado)).status, 200);
    await usuarios[0].update({ status: "INACTIVO" }, { transaction: transaccion });
    assert.equal((await peticion(lugar.id, actualizado)).status, 401);
    console.log("PASS: HTTP real tres niveles/insuficiencia/empate, DTO/no-store, 400/401/404 y JWT con estado/versión PostgreSQL.");

    etapa = "rollback y preservación";
    await transaccion.rollback();
    transaccion = null;
    assert.deepEqual(await contenido("users"), usuariosAntes);
    assert.deepEqual(await contenido("places"), lugaresAntes);
    assert.deepEqual(await contenido("saturation_reports"), reportesAntes);
    assert.deepEqual(await select("SELECT name, applied_at FROM public.crowdradar_migrations ORDER BY name"), historialDespues);
    console.log("PASS: rollback de todos los fixtures; usuarios/lugares/reportes e historial preservados, sin DELETE/DROP ni datos ficticios persistidos.");
} catch {
    console.error(`FAIL: comprobación de saturación detenida en ${etapa}; no se imprimen secretos ni SQL interno.`);
    process.exitCode = 1;
} finally {
    repository.findActiveSnapshot = originales.query;
    User.findByPk = originales.user;
    if (server) await new Promise((resolve) => server.close(resolve));
    if (transaccion) await transaccion.rollback();
    await sequelize.close();
}
