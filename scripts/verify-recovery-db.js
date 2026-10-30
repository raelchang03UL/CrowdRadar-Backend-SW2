import "dotenv/config";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import bcrypt from "bcrypt";
import { QueryTypes } from "sequelize";
import { assertIsolatedAuthTestDatabase, assertIsolatedConsolidationDatabase, consolidationQaDatabases, assertConsolidationQaProvenance } from "../src/database/databaseSafety.js";
import { migrateAuth } from "../src/database/migrateAuth.js";
import { migrateRecovery, assertRecoverySchemaReady, recoveryMigration } from "../src/database/migrateRecovery.js";
import { createMemoryRecoveryDelivery } from "../test/helpers/memoryRecoveryDelivery.js";

// Destino fijo, protegido antes de conectar. No usa DB_NAME/DATABASE_URL como destino.
const qaRun = process.env.CROWDRADAR_QA_RUN;
if (qaRun) {
    const input = dotenv.parse(readFileSync(process.env.CROWDRADAR_QA_ENV_FILE));
    assert.ok(!input.DATABASE_URL && ["localhost", "127.0.0.1", "::1"].includes(input.DB_HOST), "Solo DB_* local.");
    Object.assign(process.env, { DB_HOST: input.DB_HOST, DB_PORT: input.DB_PORT ?? "5432", DB_USER: input.DB_USER,
        DB_PASSWORD: input.DB_PASSWORD, DB_SSL: "false", NODE_ENV: "test", JWT_SECRET: randomBytes(48).toString("hex") });
    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "PASSWORD_RESET_URL"]) delete process.env[key];
}
const database = qaRun ? consolidationQaDatabases(qaRun)[0] : "crowdradar_auth_test";
const assertTarget = (db) => qaRun ? assertIsolatedConsolidationDatabase(db, qaRun) : assertIsolatedAuthTestDatabase(db);
assertTarget({ config: { database, host: process.env.DB_HOST } });
const credentials = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
if (!qaRun) {
    const admin = new pg.Client({ ...credentials, database: "postgres" });
    try {
        await admin.connect();
        if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database])).rowCount) {
            await admin.query('CREATE DATABASE "crowdradar_auth_test"');
        }
    } finally { await admin.end(); }
}
process.env.DB_NAME = database;
process.env.DATABASE_URL = "";
const { default: sequelize } = await import("../src/config/database.js");
const { default: repository } = await import("../src/repositories/PasswordRecoveryRepository.js");
const { default: PasswordRecoveryService, digest, forgotMessage } = await import("../src/services/PasswordRecoveryService.js");
const { default: AuthService } = await import("../src/services/AuthService.js");
const { createApp } = await import("../app.js");
const { default: User } = await import("../src/models/User.js");
const select = (sql, replacements = {}, transaction) => sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT });
const mailbox = createMemoryRecoveryDelivery();
const run = `${Date.now()}-${randomBytes(6).toString("hex")}`;
// Namespace exclusivo del runner evita compartir presupuesto con otras ejecuciones QA.
// El SQL, umbrales y persistencia se mantienen reales; no borra/resetea límites previos.
const isolatedRepository = Object.create(repository);
isolatedRepository.consumeLimits = (entries) => repository.consumeLimits(entries.map((entry) => ({ ...entry, keyHash: digest(`${run}:${entry.keyHash}`) })));
const options = { delivery: mailbox.delivery, resetUrl: "http://localhost:5500/#/reset-password", repository: isolatedRepository };
const service = new PasswordRecoveryService(options);
const ip = `isolated-recovery-${run}`;
let server;
let stage = "migración";
try {
    await sequelize.authenticate();
    assertTarget(sequelize);
    if (qaRun) await assertConsolidationQaProvenance(sequelize, qaRun);
    await migrateAuth(sequelize);
    const before = await select("SELECT to_jsonb(u) AS data FROM public.users u ORDER BY id");
    await migrateRecovery(sequelize);
    assert.equal(await migrateRecovery(sequelize), false);
    assert.ok(JSON.stringify(await select("SELECT to_jsonb(u) AS data FROM public.users u ORDER BY id")) === JSON.stringify(before), "003 conserva usuarios");
    assert.equal((await select("SELECT name FROM public.crowdradar_migrations WHERE name = :name", { name: recoveryMigration })).length, 1);
    await assertRecoverySchemaReady(sequelize);
    console.log("PASS: 003 aditiva/idempotente, usuarios preservados e historial único.");

    server = createApp({ recoveryService: service }).listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (path, body, token, method = "POST") => {
        const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, body: await response.json() };
    };
    let count = 0;
    const account = async () => {
        const email = `recovery-db-${run}-${++count}@example.test`;
        const password = randomBytes(24).toString("hex");
        const data = await AuthService.register({ nombre: "Rael", apellido: "Chang", email, password });
        return { ...data, password };
    };
    const issue = async (user, customService = service) => {
        assert.deepEqual(await customService.forgot({ email: user.email }, ip), { message: forgotMessage });
        await customService.drainDeliveries();
        const message = mailbox.messages.filter((value) => value.type === "reset-link" && value.email === user.email).at(-1);
        assert.ok(Boolean(message), "enlace capturado solo en memoria de prueba");
        return new URLSearchParams(new URL(message.resetUrl).hash.split("?")[1]).get("token");
    };
    stage = "éxito HTTP y sesiones";
    const user = await account();
    const login = await request("/api/auth/login", { email: user.email, password: user.password });
    assert.equal(login.status, 200);
    const oldJwt = login.body.data.token;
    const token = await issue(user);
    const records = await select("SELECT * FROM public.password_reset_tokens WHERE user_id = :id", { id: user.id });
    assert.equal(records.length, 1);
    assert.ok(records[0].token_hash === digest(token), "persistido solo hash");
    assert.ok(!JSON.stringify(records).includes(token), "sin token original persistido");
    const ttl = new Date(records[0].expires_at) - new Date(records[0].created_at);
    assert.ok(ttl >= 899000 && ttl <= 901000, "expiración 15 minutos");
    assert.equal((await request("/api/auth/password/reset/validate", { token })).status, 200);
    assert.equal((await request("/api/auth/password/reset/validate", { token })).status, 200);
    assert.equal((await select("SELECT consumed_at FROM public.password_reset_tokens WHERE user_id = :id", { id: user.id }))[0].consumed_at, null);
    const nextPassword = randomBytes(24).toString("hex");
    const alternative = randomBytes(24).toString("hex");
    const resets = await Promise.all([
        request("/api/auth/password/reset", { token, newPassword: nextPassword, confirmPassword: nextPassword }),
        request("/api/auth/password/reset", { token, newPassword: alternative, confirmPassword: alternative })
    ]);
    assert.deepEqual(resets.map(({ status }) => status).sort(), [200, 400]);
    assert.equal(resets.find(({ status }) => status === 400).body.code, "RESET_TOKEN_INVALID");
    assert.equal(resets.find(({ status }) => status === 200).body.data, undefined);
    const winner = resets[0].status === 200 ? nextPassword : alternative;
    const stored = await User.findByPk(user.id);
    assert.equal(stored.sessionVersion, 1);
    assert.equal(await bcrypt.compare(winner, stored.passwordHash), true);
    assert.equal((await request("/api/users/profile", undefined, oldJwt, "GET")).status, 401);
    assert.equal((await request("/api/auth/login", { email: user.email, password: user.password })).status, 401);
    assert.equal((await request("/api/auth/login", { email: user.email, password: winner })).status, 200);
    assert.equal((await request("/api/auth/password/reset/validate", { token })).body.code, "RESET_TOKEN_INVALID");
    await service.drainDeliveries();
    assert.equal(mailbox.messages.filter((message) => message.type === "password-changed" && message.email === user.email).length, 1);
    console.log("PASS: validación sin consumo; reset HTTP concurrente con un ganador; JWT viejo rechazado, login nuevo y aviso postcommit.");

    stage = "invalidación por solicitud y cambio autenticado";
    const pending = await account();
    const first = await issue(pending);
    const second = await issue(pending);
    await assert.rejects(service.validate({ token: first }, ip), (error) => error.code === "RESET_TOKEN_INVALID");
    assert.deepEqual(await service.validate({ token: second }, ip), { valid: true });
    const changed = randomBytes(24).toString("hex");
    await AuthService.changePassword(pending.id, 0, { currentPassword: pending.password, newPassword: changed, confirmPassword: changed });
    await assert.rejects(service.validate({ token: second }, ip), (error) => error.code === "RESET_TOKEN_INVALID");
    console.log("PASS: nueva solicitud y cambio autenticado invalidan enlaces pendientes transaccionalmente.");

    stage = "validación, rollback y expiración bajo lock";
    const rollbackUser = await account();
    const rollbackToken = await issue(rollbackUser);
    const beforeRollback = await User.findByPk(rollbackUser.id);
    for (const body of [{ token: rollbackToken, newPassword: "short", confirmPassword: "short" },
        { token: rollbackToken, newPassword: nextPassword, confirmPassword: alternative },
        { token: rollbackToken, newPassword: rollbackUser.password, confirmPassword: rollbackUser.password }]) {
        await assert.rejects(service.reset(body, ip), (error) => ["PASSWORD_VALIDATION", "PASSWORD_MISMATCH", "PASSWORD_REUSED"].includes(error.code));
        assert.equal(await repository.validToken(digest(rollbackToken)), true);
    }
    const failingRepository = Object.create(isolatedRepository);
    failingRepository.savePassword = async (...args) => { await repository.savePassword(...args); throw new Error("test-after-update"); };
    const failingService = new PasswordRecoveryService({ ...options, repository: failingRepository });
    await assert.rejects(failingService.reset({ token: rollbackToken, newPassword: nextPassword, confirmPassword: nextPassword }, ip), (error) => error.code === "SERVICE_UNAVAILABLE");
    const afterRollback = await User.findByPk(rollbackUser.id);
    assert.ok(beforeRollback.passwordHash === afterRollback.passwordHash, "rollback hash");
    assert.equal(afterRollback.sessionVersion, beforeRollback.sessionVersion);
    assert.equal(await repository.validToken(digest(rollbackToken)), true);
    await failingService.drainDeliveries();
    assert.equal(mailbox.messages.filter((message) => message.type === "password-changed" && message.email === rollbackUser.email).length, 0);
    await sequelize.query("UPDATE public.password_reset_tokens SET expires_at = clock_timestamp() + INTERVAL '300 milliseconds' WHERE user_id = :id AND consumed_at IS NULL", { replacements: { id: rollbackUser.id } });
    assert.deepEqual(await service.validate({ token: rollbackToken }, ip), { valid: true });
    const blocking = await sequelize.transaction();
    let expired;
    try {
        await select("SELECT id FROM public.users WHERE id = :id FOR UPDATE", { id: rollbackUser.id }, blocking);
        expired = service.reset({ token: rollbackToken, newPassword: nextPassword, confirmPassword: nextPassword }, ip);
        await delay(500);
    } finally { await blocking.commit(); }
    await assert.rejects(expired, (error) => error.code === "RESET_TOKEN_INVALID");
    assert.ok((await User.findByPk(rollbackUser.id)).passwordHash === beforeRollback.passwordHash);
    console.log("PASS: validaciones no consumen; fallo posterior al UPDATE revierte hash/versión/token; expiración al esperar lock rechazada.");

    stage = "abuso persistente y anti enumeración";
    const limited = await account();
    const localIp = `isolated-rate-${run}`;
    for (let i = 0; i < 3; i++) await service.forgot({ email: limited.email }, `${localIp}-${i}`);
    const restarted = new PasswordRecoveryService(options);
    await assert.rejects(restarted.forgot({ email: ` ${limited.email.toUpperCase()} ` }, `${localIp}-restart`), (error) => error.code === "RATE_LIMITED");
    const abuseIp = `isolated-reset-abuse-${run}`;
    for (let i = 0; i < 30; i++) await assert.rejects(service.validate({ token: "invalid" }, abuseIp), (error) => error.code === "RESET_TOKEN_INVALID");
    await assert.rejects(restarted.reset({}, abuseIp), (error) => error.code === "RATE_LIMITED");
    const forgotAbuseIp = `isolated-forgot-abuse-${run}`;
    for (let i = 0; i < 10; i++) await service.forgot({ email: `unknown-${run}-${i}@example.test` }, forgotAbuseIp);
    await assert.rejects(restarted.forgot({ email: user.email }, forgotAbuseIp), (error) => error.code === "RATE_LIMITED");
    const unknown = `unknown-${run}@example.test`;
    assert.deepEqual(await service.forgot({ email: unknown }, `unknown-${run}`), { message: forgotMessage });
    const disabled = new PasswordRecoveryService({ resetUrl: options.resetUrl });
    for (const value of [user.email, unknown]) await assert.rejects(disabled.forgot({ email: value }, ip), (error) => error.code === "RECOVERY_UNAVAILABLE");
    // Un error nunca se convierte en respuesta con información interna.
    const unavailable = new PasswordRecoveryService({ ...options, repository: { consumeLimits: async () => { throw new Error("private-db-info"); } } });
    for (const value of [user.email, unknown]) await assert.rejects(unavailable.forgot({ email: value }, ip), (error) => error.code === "SERVICE_UNAVAILABLE" && !error.message.includes("private"));
    const ambiguous = await account();
    await AuthService.register({ nombre: "Rael", apellido: "Chang", email: ambiguous.email.toUpperCase(), password: ambiguous.password });
    assert.deepEqual(await service.forgot({ email: ambiguous.email }, `ambiguous-${run}`), { message: forgotMessage });
    assert.equal(mailbox.messages.filter((message) => message.email.toLowerCase() === ambiguous.email).length, 0);
    assert.equal((await select("SELECT id FROM public.password_reset_tokens WHERE user_id = :id", { id: ambiguous.id })).length, 0);
    console.log("PASS: límites email normalizado/forgot IP/reset IP sobreviven nueva instancia; correos ambiguos no eligen cuenta ni filtran existencia.");
    await service.drainDeliveries();
    console.log("PASS: recuperación PostgreSQL aislada completa; ningún correo real enviado ni secreto impreso.");
} catch {
    console.error(`FAIL: comprobación aislada de recuperación (${stage}); datos sensibles omitidos.`);
    process.exitCode = 1;
} finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
}
