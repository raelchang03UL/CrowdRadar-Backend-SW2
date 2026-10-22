import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import { Sequelize, QueryTypes } from "sequelize";
import { databaseConfiguration } from "../src/config/environment.js";
import { assertMigrationTarget, assertIsolatedConsolidationDatabase, consolidationQaDatabases, closureQaProvenance, assertConsolidationQaProvenance } from "../src/database/databaseSafety.js";
import { migratePlaces } from "../src/database/migratePlaces.js";
import { migrateAuth } from "../src/database/migrateAuth.js";
import { migrateRecovery } from "../src/database/migrateRecovery.js";
import { migratePlaceDetails, assertPlaceDetailsSchemaReady } from "../src/database/migratePlaceDetails.js";
import { migrateReportCompatibility, legacyReportsMigration, assertConsolidatedReportsSchemaReady } from "../src/database/migrateReportCompatibility.js";
import { migrateKarma, assertKarmaSchemaReady } from "../src/database/migrateKarma.js";

// Credencial privada solo en memoria; nunca copiar .env ni imprimir errores SQL.
const privateEnv = process.env.CROWDRADAR_QA_ENV_FILE
    ? dotenv.parse(readFileSync(process.env.CROWDRADAR_QA_ENV_FILE)) : {};
const input = { ...privateEnv, ...process.env };
assert.ok(!input.DATABASE_URL, "QA exige DB_* local, no DATABASE_URL.");
assert.ok(["localhost", "127.0.0.1", "::1"].includes(input.DB_HOST), "Host QA debe ser loopback.");
const qaRun = process.env.CROWDRADAR_QA_RUN;
const targetDatabases = consolidationQaDatabases(qaRun);
const [freshName, legacyName] = targetDatabases;
console.log(`Destinos exclusivos: ${freshName}, ${legacyName}; no se eliminan bases.`);
const connection = (database) => {
    const cfg = databaseConfiguration({ ...input, DB_NAME: database, DATABASE_URL: "", DB_SSL: "false" });
    return new Sequelize(cfg.database, cfg.username, cfg.password, cfg.options);
};
const admin = connection("postgres");
const databases = [];
let httpServer, globalDb;
const syntheticPassword = randomBytes(24).toString("hex");
let blocks = 0;
const pass = (message) => { blocks++; console.log(`PASS ${blocks}: ${message}`); };
try {
    // Verificar el par completo antes de crear cualquiera: nunca adoptar destinos existentes.
    for (const name of targetDatabases) {
        const exists = await admin.query("SELECT datname FROM pg_database WHERE datname = :name", { replacements: { name }, type: QueryTypes.SELECT });
        // No adoptar una base existente: sus datos no son automáticamente nuestros.
        assert.equal(exists.length, 0, `El destino ${name} ya existe; conservar y usar una nueva ejecución revisada.`);
    }
    console.log("Precondición: ambas bases inexistentes; creación limitada al par autorizado.");
    for (const name of targetDatabases) {
        await admin.query(`CREATE DATABASE "${name}"`);
        if (qaRun === "cierre-20261019") {
            await admin.query(`COMMENT ON DATABASE "${name}" IS '${closureQaProvenance}'`);
        }
        const db = connection(name);
        await assertConsolidationQaProvenance(db, qaRun);
        assertMigrationTarget(db);
        const [identity] = await db.query("SELECT current_database() AS name", { type: QueryTypes.SELECT });
        assert.equal(identity.name, name);
        databases.push(db);
    }
    const [fresh, legacy] = databases;
    for (const db of databases) {
        await migratePlaces(db); await migrateAuth(db); await migrateRecovery(db);
        await assert.rejects(assertPlaceDetailsSchemaReady(db), { code: "SCHEMA_NOT_READY" });
        await db.query(`INSERT INTO public.users (nombre, apellido, email, "passwordHash", status, rol, "createdAt", "updatedAt")
            VALUES ('QA', 'Preservación', 'sentinel@example.invalid', 'synthetic-not-a-login-hash', 'ACTIVO', 'USUARIO', NOW(), NOW())`);
        await db.query("INSERT INTO public.places (id, nombre, categoria, latitud, longitud, activo, demostrativo) VALUES (-701, 'QA Parque', 'Parque', -12, -77, TRUE, TRUE)");
    }
    // Fixture exacto del esquema histórico de Manu (1595d36), no nueva migración.
    await legacy.query(`CREATE TABLE public.saturation_reports (
        id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        place_id INTEGER NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
        level VARCHAR(20) NOT NULL CHECK (level IN ('TRANQUILO', 'MODERADO', 'SATURADO')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await legacy.query("CREATE INDEX saturation_reports_user_created_idx ON public.saturation_reports (user_id, created_at DESC)");
    await legacy.query("INSERT INTO public.crowdradar_migrations (name) VALUES (:name)", { replacements: { name: legacyReportsMigration } });
    await legacy.query("INSERT INTO public.saturation_reports (user_id, place_id, level) SELECT id, -701, 'MODERADO' FROM public.users");
    const usersBefore = await legacy.query("SELECT * FROM public.users ORDER BY id", { type: QueryTypes.SELECT });
    const reportsBefore = await legacy.query("SELECT * FROM public.saturation_reports ORDER BY id", { type: QueryTypes.SELECT });
    for (const db of databases) {
        await migratePlaceDetails(db);
        await Promise.all([migrateReportCompatibility(db), migrateReportCompatibility(db)]);
        await Promise.all([migrateKarma(db), migrateKarma(db)]);
        assert.equal(await migratePlaceDetails(db), false);
        assert.equal(await migrateReportCompatibility(db), false);
        assert.equal(await migrateKarma(db), false);
        await assertPlaceDetailsSchemaReady(db);
        await assertConsolidatedReportsSchemaReady(db);
        await assertKarmaSchemaReady(db);
        const foreignKeys = await db.query("SELECT confdeltype FROM pg_constraint WHERE conrelid = 'public.saturation_reports'::regclass AND contype = 'f'", { type: QueryTypes.SELECT });
        assert.equal(foreignKeys.length, 2);
        assert.ok(foreignKeys.every(({ confdeltype }) => confdeltype === "a"));
    }
    pass("base nueva y legacy actualizan, repiten y soportan migradores concurrentes; readiness sin DDL.");
    assert.deepEqual((await legacy.query("SELECT * FROM public.users ORDER BY id", { type: QueryTypes.SELECT })).map(({ karma_points, ...user }) => user), usersBefore);
    assert.deepEqual(await legacy.query("SELECT * FROM public.saturation_reports ORDER BY id", { type: QueryTypes.SELECT }), reportsBefore);
    const history = await legacy.query("SELECT name FROM public.crowdradar_migrations", { type: QueryTypes.SELECT });
    assert.ok(history.some(({ name }) => name === legacyReportsMigration));
    assert.ok(!history.some(({ name }) => name === "004-saturation-reports"));
    assert.equal((await legacy.query("SELECT SUM(karma_points) AS total FROM public.users", { type: QueryTypes.SELECT }))[0].total, "0");
    pass("datos e identidad histórica conservados; no se inventa karma retrospectivo.");

    // Solo después de fijar el destino se importa la composición de la API.
    Object.assign(process.env, { DB_HOST: input.DB_HOST, DB_PORT: input.DB_PORT ?? "5432", DB_USER: input.DB_USER,
        DB_PASSWORD: input.DB_PASSWORD, DB_NAME: freshName, DATABASE_URL: "", DB_SSL: "false", NODE_ENV: "test",
        JWT_SECRET: randomBytes(48).toString("hex"), REPORT_COOLDOWN_MINUTES: "3", KARMA_POINTS_PER_REPORT: "10" });
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "PASSWORD_RESET_URL"]) delete process.env[key];
    const { default: app } = await import("../app.js");
    globalDb = (await import("../src/config/database.js")).default;
    assertIsolatedConsolidationDatabase(globalDb, qaRun);
    await assertConsolidationQaProvenance(globalDb, qaRun);
    const { createSaturationReportRepository } = await import("../src/repositories/SaturationReportRepository.js");
    const { SaturationReportService } = await import("../src/services/SaturationReportService.js");
    const repo = createSaturationReportRepository(fresh);
    const service = new SaturationReportService(repo);
    await new Promise((resolve) => { httpServer = app.listen(0, "127.0.0.1", resolve); });
    const root = `http://127.0.0.1:${httpServer.address().port}`;
    const call = (path, { token, method = "GET", body } = {}) => fetch(root + path, {
        method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const accounts = [];
    for (let index = 0; index < 3; index++) {
        const email = `qa-consolidation-${index}@example.invalid`;
        assert.equal((await call("/api/auth/register", { method: "POST", body: { nombre: "QA", apellido: "Consolidación", email, password: syntheticPassword } })).status, 201);
        const login = await call("/api/auth/login", { method: "POST", body: { email, password: syntheticPassword } });
        assert.equal(login.status, 200);
        accounts.push((await login.json()).data);
    }
    const [account] = accounts;
    const submit = (token) => call("/api/places/-701/reports", { token, method: "POST", body: { level: "TRANQUILO" } });
    const simultaneous = await Promise.all([submit(account.token), submit(account.token)]);
    assert.deepEqual(simultaneous.map(({ status }) => status).sort(), [201, 409]);
    const created = await simultaneous.find(({ status }) => status === 201).json();
    assert.equal(created.data.pointsAwarded, 10);
    assert.equal(created.data.karmaPoints, 10);
    assert.equal((await (await call("/api/users/karma", { token: account.token })).json()).data.karmaPoints, 10);
    pass("HTTP/DB reales: registro/login, envío concurrente 201/409 y premio único de 10 puntos.");
    assert.equal((await submit()).status, 401);
    for (const placeId of ["0", "abc", "1e2", "2147483648"]) assert.equal((await call(`/api/places/${placeId}/reports`, { token: account.token, method: "POST", body: { level: "TRANQUILO" } })).status, 400);
    assert.equal((await call("/api/places/-701/reports", { token: account.token, method: "POST", body: { level: "SATURADO", userId: 1 } })).status, 400);
    assert.equal((await call("/api/places/2147483647/reports", { token: account.token, method: "POST", body: { level: "TRANQUILO" } })).status, 404);
    const own = (await (await call("/api/users/reports?userId=1", { token: account.token })).json()).data;
    assert.equal(own.length, 1);
    const other = (await (await call("/api/users/reports", { token: accounts[1].token })).json()).data;
    assert.deepEqual(other, []);
    pass("autorización, acceso ajeno, ID/cuerpo inválidos, lugar ausente e historial propio.");
    for (const otherAccount of accounts.slice(1)) assert.equal((await submit(otherAccount.token)).status, 201);
    const saturation = (await (await call("/api/places/-701/saturation", { token: account.token })).json()).data;
    assert.equal(saturation.level, "TRANQUILO"); assert.equal(saturation.reportCount, 3);
    const filtered = await call("/api/places?nombre=Parque&categoria=Parque&nivel=TRANQUILO", { token: account.token });
    assert.equal(filtered.status, 200);
    assert.deepEqual((await filtered.json()).data.map(({ id }) => id), [-701]);
    assert.deepEqual((await (await call("/api/places?nombre=%25&categoria=Parque&nivel=TRANQUILO", { token: account.token })).json()).data, []);
    pass("reporte → snapshot de 3 personas → filtros combinados con SQL literal.");

    await fresh.query("INSERT INTO public.places (id, nombre, categoria, latitud, longitud, activo, demostrativo) VALUES (-702, 'QA Rollback', 'Parque', -12, -77, TRUE, TRUE)");
    const counters = () => fresh.query("SELECT (SELECT COUNT(*) FROM public.saturation_reports) AS reports, (SELECT COUNT(*) FROM public.report_karma_awards) AS awards, (SELECT SUM(karma_points) FROM public.users) AS karma", { type: QueryTypes.SELECT });
    const before = await counters();
    const failingRepo = createSaturationReportRepository({ transaction: fresh.transaction.bind(fresh), query: (sql, options) => {
        if (sql.startsWith("UPDATE public.users SET karma_points")) throw new Error("injected rollback");
        return fresh.query(sql, options);
    } });
    await assert.rejects(failingRepo.create({ userId: account.user.id, sessionVersion: 0, placeId: -702, level: "SATURADO", cooldownMinutes: 3, points: 10 }));
    assert.deepEqual(await counters(), before);
    await fresh.query('UPDATE public.users SET "sessionVersion" = 1 WHERE id = :id', { replacements: { id: account.user.id } });
    await assert.rejects(service.create({ userId: account.user.id, sessionVersion: 0, placeId: -702, level: "MODERADO" }), { code: "SESSION_INVALID" });
    assert.deepEqual(await counters(), before);
    assert.equal((await call("/api/users/reports", { token: account.token })).status, 401);
    pass("rollback tras INSERT/ledger conserva reportes y karma; revalidación de sesión bajo lock.");
    console.log(`Resultado: ${blocks}/${blocks} bloques PostgreSQL/HTTP reales. Sin SMTP, sin bases históricas ni borrados.`);
} catch (error) {
    console.error(`FAIL de QA aislada (${error.code ?? error.name}); no se muestran SQL, filas, claves ni JWT. ${error instanceof assert.AssertionError ? 'Aserción no satisfecha.' : ''}`);
    process.exitCode = 1;
} finally {
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    if (globalDb) await globalDb.close();
    for (const db of databases) await db.close();
    await admin.close();
}
