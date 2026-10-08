import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import bcrypt from "bcrypt";
import { QueryTypes } from "sequelize";
import { migrateAuth, assertAuthSchemaReady, authMigration } from "../src/database/migrateAuth.js";
import { assertIsolatedAuthTestDatabase } from "../src/database/databaseSafety.js";

// No usa DB_NAME/DATABASE_URL como destino ni elimina tablas/bases.
const database = "crowdradar_auth_test";
const host = process.env.DB_HOST;
assertIsolatedAuthTestDatabase({ config: { database, host } });
const credentials = { host, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
const admin = new pg.Client({ ...credentials, database: "postgres" });
try {
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (!exists.rowCount) await admin.query('CREATE DATABASE "crowdradar_auth_test"');
} finally { await admin.end(); }
process.env.DB_NAME = database;
delete process.env.DATABASE_URL;
const { default: sequelize } = await import("../src/config/database.js");
const { default: app, startServer } = await import("../app.js");
const { default: User } = await import("../src/models/User.js");
const { default: AuthService } = await import("../src/services/AuthService.js");
const { default: jwt } = await import("../src/utils/jwt.js");
const select = (sql, options = {}) => sequelize.query(sql, { type: QueryTypes.SELECT, ...options });
let server;
try {
    await sequelize.authenticate();
    const existing = await select("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'");
    if (!existing.length) {
        // Base limpia comprobada en una transacción revertida; no deja esquema.
        const transaction = await sequelize.transaction();
        try {
            const isolated = { transaction: (operation) => operation(transaction), query: (sql, options) => sequelize.query(sql, options) };
            assert.equal(await migrateAuth(isolated), true);
            const columns = await select("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'", { transaction });
            assert.ok(columns.some(({ column_name }) => column_name === "sessionVersion"));
            assert.equal(await migrateAuth(isolated), false);
        } finally { await transaction.rollback(); }
        console.log("PASS: migración desde base limpia e idempotencia dentro de rollback.");
        // Esquema previo exacto, exclusivamente en la base aislada.
        await sequelize.query(`CREATE TABLE public.users (
            id SERIAL PRIMARY KEY, nombre VARCHAR(255) NOT NULL, apellido VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE, "passwordHash" VARCHAR(255) NOT NULL,
            telefono VARCHAR(255), rol VARCHAR(255), distrito VARCHAR(255), status VARCHAR(255),
            "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL
        )`);
        const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 4);
        await sequelize.query(`INSERT INTO public.users (nombre, apellido, email, "passwordHash", rol, status, "createdAt", "updatedAt")
            VALUES ('Rael', 'Chang', :email, :passwordHash, 'USUARIO', 'ACTIVO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        { replacements: { email: `migration-sentinel-${Date.now()}@example.test`, passwordHash } });
    }
    const before = await select("SELECT to_jsonb(u) - 'sessionVersion' AS data FROM public.users u ORDER BY id");
    await migrateAuth(sequelize);
    assert.equal(await migrateAuth(sequelize), false);
    assert.deepEqual(await select("SELECT to_jsonb(u) - 'sessionVersion' AS data FROM public.users u ORDER BY id"), before);
    assert.equal((await select("SELECT name FROM public.crowdradar_migrations WHERE name = :name", { replacements: { name: authMigration } })).length, 1);
    await assertAuthSchemaReady(sequelize);
    console.log("PASS: actualización aditiva, usuarios/columnas previas conservados e historial único.");
    const constraintTransaction = await sequelize.transaction();
    try {
        await assert.rejects(sequelize.query('UPDATE public.users SET "sessionVersion" = -1', { transaction: constraintTransaction }),
            (error) => error.parent?.code === "23514");
    } finally { await constraintTransaction.rollback(); }
    console.log("PASS: PostgreSQL rechaza versión negativa; rollback sin modificar usuarios.");

    server = await startServer({ port: 0 });
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/`)).status, 200);
    const request = async (path, { body, token, method = "POST" } = {}) => {
        const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, body: await response.json() };
    };
    const currentPassword = randomBytes(24).toString("hex");
    const nextPassword = randomBytes(24).toString("hex");
    const otherPassword = randomBytes(24).toString("hex");
    const email = `auth-db-${Date.now()}@example.test`;
    assert.equal((await request("/api/auth/register", { body: { nombre: "Rael", apellido: "Chang", email, password: currentPassword } })).status, 201);
    const login = await request("/api/auth/login", { body: { email, password: currentPassword } });
    assert.equal(login.status, 200);
    const token = login.body.data.token;
    const id = login.body.data.user.id;
    const old = await User.findByPk(id);
    assert.equal(old.sessionVersion, 0);
    const incorrect = await request("/api/auth/password/change", { token, body: { currentPassword: randomBytes(24).toString("hex"), newPassword: nextPassword, confirmPassword: nextPassword } });
    assert.equal(incorrect.status, 403);
    assert.equal((await User.findByPk(id)).passwordHash, old.passwordHash);
    const body = { currentPassword, newPassword: nextPassword, confirmPassword: nextPassword };
    const simultaneous = await Promise.all([
        request("/api/auth/password/change", { token, body }),
        request("/api/auth/password/change", { token, body: { ...body, newPassword: otherPassword, confirmPassword: otherPassword } })
    ]);
    assert.deepEqual(simultaneous.map(({ status }) => status).sort(), [200, 401]);
    const winnerPassword = simultaneous[0].status === 200 ? nextPassword : otherPassword;
    const stored = await User.findByPk(id);
    assert.equal(stored.sessionVersion, 1);
    assert.equal(await bcrypt.compare(winnerPassword, stored.passwordHash), true);
    assert.equal((await request("/api/users/profile", { token, method: "GET" })).status, 401);
    assert.equal((await request("/api/auth/login", { body: { email, password: currentPassword } })).status, 401);
    const renewed = await request("/api/auth/login", { body: { email, password: winnerPassword } });
    assert.equal(renewed.status, 200);
    assert.equal(jwt.verifyToken(renewed.body.data.token).sessionVersion, 1);
    const profile = await request("/api/users/profile", { token: renewed.body.data.token, method: "GET" });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.data.passwordHash, undefined);
    assert.equal(profile.body.data.sessionVersion, undefined);
    console.log("PASS: HTTP real registro/login/cambio concurrente; un ganador, JWT anterior rechazado y login nuevo correcto.");
    // Fuerza un fallo después del UPDATE para demostrar rollback de hash y versión.
    const update = User.prototype.update;
    try {
        User.prototype.update = async function (...args) { await update.apply(this, args); throw new Error("test-rollback"); };
        await assert.rejects(AuthService.changePassword(id, 1, { currentPassword: winnerPassword, newPassword: currentPassword, confirmPassword: currentPassword }), /test-rollback/);
    } finally { User.prototype.update = update; }
    const retained = await User.findByPk(id);
    assert.equal(retained.sessionVersion, stored.sessionVersion);
    assert.equal(retained.passwordHash, stored.passwordHash);
    console.log("PASS: fallo después de guardar revierte hash y versión juntos.");
} finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
}
