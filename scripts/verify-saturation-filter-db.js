import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { QueryTypes } from "sequelize";
import { assertIsolatedAuthTestDatabase } from "../src/database/databaseSafety.js";
import { assertAuthSchemaReady } from "../src/database/migrateAuth.js";
import { assertReportsSchemaReady } from "../src/database/migrateReports.js";

// Reutiliza solo esta base ya preparada. No crea bases ni ejecuta migraciones/DDL.
const database = "crowdradar_auth_test";
assertIsolatedAuthTestDatabase({ config: { database, host: process.env.DB_HOST } });
process.env.DB_NAME = database;
delete process.env.DATABASE_URL;
const { default: sequelize } = await import("../src/config/database.js");
const { default: User } = await import("../src/models/User.js");
const { default: Place } = await import("../src/models/Place.js");
const { default: repositorio } = await import("../src/repositories/PlaceRepository.js");
const { default: servicio } = await import("../src/services/PlaceService.js");
const { evaluateSaturation, saturationPolicy } = await import("../src/services/SaturationQueryService.js");
const { default: jwt } = await import("../src/utils/jwt.js");
const { createApp } = await import("../app.js");
const originales = { consulta: repositorio.findActiveWithSaturation, usuario: User.findByPk, lugares: Place.findAll };
const seleccionar = (sql, replacements = {}, transaction) => sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT });
const contenido = (tabla) => seleccionar(`SELECT to_jsonb(f) AS fila FROM public.${tabla} f ORDER BY id`);
const historial = () => seleccionar("SELECT name, applied_at FROM public.crowdradar_migrations ORDER BY name");
const ejecucion = `${Date.now()}-${randomBytes(6).toString("hex")}`;
let transaccion, servidor;
let etapa = "esquema y barreras";
try {
    await sequelize.authenticate();
    assertIsolatedAuthTestDatabase(sequelize);
    assert.equal((await seleccionar("SELECT current_database() AS nombre"))[0].nombre, database);
    await assertAuthSchemaReady(sequelize);
    await assertReportsSchemaReady(sequelize);
    const usuariosAntes = await contenido("users");
    const lugaresAntes = await contenido("places");
    const reportesAntes = await contenido("saturation_reports");
    const historialAntes = await historial();
    console.log("PASS: solo crowdradar_auth_test local, esquemas existentes verificados sin migrar ni DDL.");

    etapa = "fixtures revertibles y consulta batch";
    transaccion = await sequelize.transaction();
    const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
    const personas = [];
    for (let numero = 0; numero < 5; numero++) {
        personas.push(await User.create({ nombre: "QA", apellido: "Filtro", email: `hu36-${ejecucion}-${numero}@example.test`,
            passwordHash, rol: "USUARIO", status: "ACTIVO", sessionVersion: 0 }, { transaction: transaccion }));
    }
    const lugares = {};
    for (const nombre of ["TRANQUILO", "MODERADO", "SATURADO", "sin", "empate", "insuficiente", "vencido", "inactivo"]) {
        [lugares[nombre]] = await seleccionar(`INSERT INTO public.places
            (nombre, categoria, referencia, latitud, longitud, activo, demostrativo)
            VALUES (:nombre, 'Prueba', 'Solo transacción aislada', -12, -77, :activo, TRUE) RETURNING id`, {
            nombre: `QA HU3.6 ${nombre} ${ejecucion}`, activo: nombre !== "inactivo"
        }, transaccion);
    }
    const idsFixtures = new Set(Object.values(lugares).map(({ id }) => id));
    const agregar = (persona, destino, level, desplazamiento = "-10 minutes") => seleccionar(`INSERT INTO public.saturation_reports
        (user_id, place_id, level, created_at)
        VALUES (:userId, :placeId, :level, statement_timestamp() + CAST(:desplazamiento AS INTERVAL)) RETURNING id`, {
        userId: personas[persona].id, placeId: lugares[destino].id, level, desplazamiento
    }, transaccion);
    for (const nivel of ["TRANQUILO", "MODERADO", "SATURADO"]) {
        for (let persona = 0; persona < 3; persona++) await agregar(persona, nivel, nivel);
    }
    for (let persona = 0; persona < 3; persona++) {
        await agregar(persona, "empate", ["TRANQUILO", "MODERADO", "SATURADO"][persona]);
        await agregar(persona, "vencido", "SATURADO", "-31 minutes");
        await agregar(persona, "vencido", "TRANQUILO", "1 minute");
        await agregar(persona, "inactivo", "SATURADO");
    }
    await agregar(0, "insuficiente", "TRANQUILO");
    await agregar(0, "insuficiente", "TRANQUILO", "-5 minutes");
    await agregar(1, "insuficiente", "TRANQUILO");
    await agregar(0, "TRANQUILO", "SATURADO", "-11 minutes");
    await agregar(0, "TRANQUILO", "SATURADO", "1 minute");
    // Igual fecha: el último ID decide; el SQL serializa el BIGSERIAL como texto.
    const idsMismaFecha = await seleccionar(`INSERT INTO public.saturation_reports (user_id, place_id, level, created_at)
        SELECT :userId, :placeId, nivel, statement_timestamp() - interval '1 second'
        FROM (VALUES ('TRANQUILO', 1), ('SATURADO', 2)) AS votos(nivel, orden) ORDER BY orden RETURNING id`, {
        userId: personas[0].id, placeId: lugares.SATURADO.id
    }, transaccion);
    // Inyección solo de transacción: repositorios, middleware JWT y modelos siguen siendo reales.
    repositorio.findActiveWithSaturation = (opciones) => originales.consulta({ ...opciones, transaction: transaccion });
    User.findByPk = (id, opciones = {}) => originales.usuario.call(User, id, { ...opciones, transaction: transaccion });
    Place.findAll = (opciones = {}) => originales.lugares.call(Place, { ...opciones, transaction: transaccion });
    const snapshots = (await repositorio.findActiveWithSaturation({ windowMinutes: saturationPolicy.windowMinutes }))
        .filter(({ id }) => idsFixtures.has(id));
    assert.deepEqual(snapshots.map(({ id }) => id), snapshots.map(({ id }) => id).sort((a, b) => a - b));
    assert.equal(snapshots.length, 7);
    assert.equal(new Set(snapshots.map(({ evaluatedAt }) => new Date(evaluatedAt).toISOString())).size, 1);
    const estimaciones = new Map(snapshots.map((fila) => [fila.id,
        evaluateSaturation({ placeId: fila.id, evaluatedAt: fila.evaluatedAt, votes: fila.votes })]));
    for (const nivel of ["TRANQUILO", "MODERADO", "SATURADO"]) {
        assert.equal(estimaciones.get(lugares[nivel].id).level, nivel);
        assert.equal(estimaciones.get(lugares[nivel].id).reportCount, 3);
    }
    assert.equal(estimaciones.get(lugares.sin.id).reportCount, 0);
    assert.equal(estimaciones.get(lugares.insuficiente.id).reportCount, 2);
    assert.equal(estimaciones.get(lugares.empate.id).reason, "TIE");
    assert.equal(estimaciones.get(lugares.vencido.id).reportCount, 0);
    const votosIguales = snapshots.find(({ id }) => id === lugares.SATURADO.id).votes;
    assert.equal(votosIguales.find(({ userId }) => userId === personas[0].id).id, String(idsMismaFecha[1].id));
    assert.ok(votosIguales.every(({ id }) => typeof id === "string"));
    console.log("PASS: SQL batch real, reloj/snapshot común, último por persona, fecha/ID, tres niveles, sin/insuficientes/empate, vencidos/futuros e inactivos.");

    etapa = "HTTP y JWT PostgreSQL reales";
    servidor = createApp().listen(0);
    const base = `http://127.0.0.1:${servidor.address().port}/api/places`;
    const token = jwt.generateToken({ id: personas[0].id, sessionVersion: 0 });
    const pedir = (consulta = "", credencial = token) => fetch(`${base}${consulta}`, {
        headers: credencial ? { Authorization: `Bearer ${credencial}` } : {}
    });
    const filasFixtures = (filas) => filas.filter(({ id }) => idsFixtures.has(id));
    for (const nivel of ["TRANQUILO", "MODERADO", "SATURADO"]) {
        const respuesta = await pedir(`?nivel=${nivel}`);
        assert.equal(respuesta.status, 200);
        assert.equal(respuesta.headers.get("cache-control"), "no-store");
        const filas = (await respuesta.json()).data;
        assert.deepEqual(filasFixtures(filas).map(({ id }) => id), [lugares[nivel].id]);
        for (const fila of filas) assert.deepEqual(Object.keys(fila).sort(),
            ["id", "nombre", "categoria", "referencia", "latitud", "longitud", "demostrativo"].sort());
    }
    for (const consulta of ["", "?nivel=", "?nivel=%20%20"]) {
        const respuesta = await pedir(consulta);
        assert.equal(respuesta.status, 200);
        assert.equal(filasFixtures((await respuesta.json()).data).length, 7);
    }
    for (const consulta of ["?nivel=tranquilo", "?nivel=ALTO", "?nivel=TRANQUILO&nivel=SATURADO", "?nivel[]=SATURADO", "?categoria=Prueba"]) {
        const respuesta = await pedir(consulta);
        assert.equal(respuesta.status, 400);
        assert.equal(respuesta.headers.get("cache-control"), "no-store");
        assert.equal((await respuesta.json()).code, "SATURATION_FILTER_INVALID");
    }
    assert.equal((await pedir("?nivel=invalido", null)).status, 401);
    await personas[0].update({ sessionVersion: 1 }, { transaction: transaccion });
    const revocada = await pedir("?nivel=SATURADO");
    assert.equal(revocada.status, 401);
    assert.equal(revocada.headers.get("cache-control"), "no-store");
    const vigente = jwt.generateToken({ id: personas[0].id, sessionVersion: 1 });
    assert.equal((await pedir("?nivel=SATURADO", vigente)).status, 200);
    await personas[0].update({ status: "INACTIVO" }, { transaction: transaccion });
    assert.equal((await pedir("?nivel=SATURADO", vigente)).status, 401);
    await personas[0].update({ status: "ACTIVO" }, { transaction: transaccion });
    console.log("PASS: HTTP real tres filtros/cambio/Todos, DTO histórico/no-store/400, JWT con estado/versión PostgreSQL y revocación.");

    etapa = "actualización de reportes, exclusión y vacío";
    for (let persona = 0; persona < 3; persona++) await agregar(persona, "TRANQUILO", "MODERADO", "-1 second");
    const tranquilos = filasFixtures(await servicio.listActive("TRANQUILO"));
    assert.deepEqual(tranquilos, []);
    const moderados = filasFixtures(await servicio.listActive("MODERADO"));
    assert.deepEqual(moderados.map(({ id }) => id).sort((a, b) => a - b), [lugares.TRANQUILO.id, lugares.MODERADO.id].sort((a, b) => a - b));
    for (let persona = 0; persona < 3; persona++) await agregar(persona, "SATURADO", "MODERADO", "-1 millisecond");
    assert.deepEqual(filasFixtures(await servicio.listActive("SATURADO")), []);
    assert.equal(filasFixtures(await servicio.listActive()).length, 7);
    // Consulta HTTP sin coincidencias: no simula repositorios ni confirma fixtures.
    const sinCoincidencias = await pedir("?nivel=TRANQUILO", vigente);
    assert.equal(sinCoincidencias.status, 200);
    assert.deepEqual(filasFixtures((await sinCoincidencias.json()).data), []);
    console.log("PASS: último reporte modifica el filtro; insuficiencia/empate quedan fuera, Todos recupera siete activos y vacío es 200.");

    etapa = "rollback y preservación";
    await transaccion.rollback();
    transaccion = null;
    assert.deepEqual(await contenido("users"), usuariosAntes);
    assert.deepEqual(await contenido("places"), lugaresAntes);
    assert.deepEqual(await contenido("saturation_reports"), reportesAntes);
    assert.deepEqual(await historial(), historialAntes);
    console.log("PASS: rollback completo; filas e historial conservados sin DELETE/DROP ni fixtures confirmados. Las secuencias pueden avanzar.");
} catch {
    console.error(`FAIL: comprobación de filtro detenida en ${etapa}; no se imprimen secretos ni SQL interno.`);
    process.exitCode = 1;
} finally {
    repositorio.findActiveWithSaturation = originales.consulta;
    User.findByPk = originales.usuario;
    Place.findAll = originales.lugares;
    if (servidor) await new Promise((resolve) => servidor.close(resolve));
    if (transaccion) await transaccion.rollback();
    await sequelize.close();
}
