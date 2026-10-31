import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../app.js";
import sequelize from "../src/config/database.js";
import User from "../src/models/User.js";
import { migratePlaces } from "../src/database/migratePlaces.js";
import { migrateFavorites } from "../src/database/migrateFavorites.js";
import { assertLocalDevelopmentDatabase, assertIsolatedPlacesTestDatabase, assertIsolatedFavoritesTestDatabase, assertMigrationTarget } from "../src/database/databaseSafety.js";

// Estas pruebas sustituyen la conexión por dobles: no necesitan el .env de
// ninguna persona ni deben construir un transporte SMTP de su terminal.
test.beforeEach((context) => {
    const synthetic = {
        NODE_ENV: "test", DB_NAME: "qa_lifecycle", DB_HOST: "localhost",
        DB_PORT: "5432", DB_USER: "unused_qa_role", DB_PASSWORD: "",
        JWT_SECRET: "synthetic-lifecycle-only-not-for-deployment",
        CORS_ORIGINS: "http://localhost:5500"
    };
    const unset = ["DATABASE_URL", "DB_SSL", "SMTP_HOST", "SMTP_PORT",
        "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "PASSWORD_RESET_URL"];
    const saved = new Map([...Object.keys(synthetic), ...unset].map((key) => [key, process.env[key]]));
    Object.assign(process.env, synthetic);
    for (const key of unset) delete process.env[key];
    context.after(() => {
        for (const [key, value] of saved) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
});

test("arranque rechaza esquema de detalle incompleto antes de aceptar tráfico", async () => {
    const original = { authenticate: sequelize.authenticate, query: sequelize.query };
    const queries = [];
    try {
        sequelize.authenticate = async () => {};
        sequelize.query = async (sql, options) => {
            queries.push(sql);
            assert.match(sql, /^SELECT /);
            if (options?.replacements?.name === "004-places-direccion") return [];
            return [{ name: "ready" }];
        };
        await assert.rejects(startServer({ port: 0 }), { code: "SCHEMA_NOT_READY" });
        assert.ok(queries.some((sql) => sql.includes("crowdradar_migrations")));
    } finally { Object.assign(sequelize, original); }
});

test("arranque remoto no usa allowlist ni ejecuta ningún DDL", async () => {
    const original = { config: { ...sequelize.config }, authenticate: sequelize.authenticate, transaction: sequelize.transaction, query: sequelize.query, sync: User.sync };
    const calls = [];
    let server;
    try {
        Object.assign(sequelize.config, { host: "db.staging.example", database: "crowdradar_staging" });
        sequelize.authenticate = async () => calls.push("authenticate");
        sequelize.transaction = () => assert.fail("Arranque no debe migrar");
        sequelize.query = async (sql, options = {}) => {
            assert.match(sql, /^SELECT /);
            calls.push("schema-read");
            return [{ name: options.replacements?.name || "002-users-session-version" }, { name: "004-saturation-reports" }, { name: "005-reconcile-report-schema" }, { name: "006-report-karma-ledger" }, { name: "007-report-validation" }];

        };
        User.sync = () => assert.fail("Arranque no debe sincronizar modelos");
        server = await startServer({ port: 0, host: "127.0.0.1" });
        if (!server.listening) await new Promise(resolve => server.once("listening", resolve));
        assert.equal(server.address().address, "127.0.0.1");
        const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { message: "CrowdRadar API" });
        assert.equal(calls[0], "authenticate");
        assert.ok(calls.length > 1 && calls.slice(1).every((call) => call === "schema-read"));
    } finally {
        if (server) await new Promise((resolve) => server.close(resolve));
        Object.assign(sequelize.config, original.config);
        Object.assign(sequelize, { authenticate: original.authenticate, transaction: original.transaction, query: original.query });
        User.sync = original.sync;
    }
});

test("migración explícita portable conserva transacción e idempotencia", async () => {
    let applied = false;
    let transactions = 0;
    const transaction = {};
    const queries = [];
    const connection = {
        config: { host: "db.staging.example", database: "crowdradar_staging" },
        transaction: async (callback) => { transactions++; return callback(transaction); },
        query: async (sql, options) => {
            assert.equal(options.transaction, transaction);
            queries.push(sql);
            if (sql.startsWith("SELECT name")) return applied ? [{ name: "001-create-places" }] : [];
            if (sql.startsWith("INSERT INTO public.crowdradar_migrations")) applied = true;
            return [];
        }
    };
    assert.doesNotThrow(() => assertMigrationTarget(connection));
    assert.equal(await migratePlaces(connection), true);
    assert.equal(await migratePlaces(connection), false);
    assert.equal(transactions, 2);
    assert.equal(queries.filter((q) => q.startsWith("CREATE TABLE public.places")).length, 1);
    assert.ok(queries.every((q) => !/DROP|DELETE|ALTER TABLE|users/i.test(q)));
});

test("migración de favoritos exige esquema previo y es aditiva e idempotente", async () => {
    const history = new Set([
        "001-create-places",
        "002-users-session-version",
        "003-password-recovery"
    ]);
    let transactions = 0;
    const queries = [];
    const connection = {
        transaction: async (callback) => {
            transactions++;
            return callback({});
        },
        query: async (sql, options = {}) => {
            queries.push(sql);
            if (sql.includes("WHERE name IN")) {
                return [...history].map((name) => ({ name }));
            }
            if (sql.includes("WHERE name = :name")) {
                return history.has(options.replacements.name) ? [{ name: options.replacements.name }] : [];
            }
            if (sql.startsWith("SELECT table_name")) return [];
            if (sql.startsWith("INSERT INTO public.crowdradar_migrations")) {
                history.add(options.replacements.name);
            }
            return [];
        }
    };
    assert.equal(await migrateFavorites(connection), true);
    assert.equal(await migrateFavorites(connection), false);
    assert.equal(transactions, 2);
    assert.equal(queries.filter((sql) => sql.startsWith("CREATE TABLE public.favorites")).length, 1);
    assert.ok(queries.some((sql) => sql.includes("PRIMARY KEY (user_id, place_id)")));
    assert.ok(queries.every((sql) => !/\b(DROP|DELETE FROM|ALTER TABLE)\b/i.test(sql)));
});

test("migración de favoritos rechaza historial incompleto sin crear tabla", async () => {
    const queries = [];
    const connection = {
        transaction: async (callback) => callback({}),
        query: async (sql) => {
            queries.push(sql);
            return sql.includes("WHERE name IN")
                ? [{ name: "001-create-places" }, { name: "002-users-session-version" }]
                : [];
        }
    };
    await assert.rejects(migrateFavorites(connection), /Aplica 001, 002 y 003/);
    assert.ok(!queries.some((sql) => sql.startsWith("CREATE TABLE public.favorites")));
});

test("políticas demo y prueba aislada rechazan destinos protegidos antes de conectar", () => {
    for (const config of [
        { host: "localhost", database: "crowdradar_sprint1" },
        { host: "db.remote.example", database: "crowdradar_dev" },
        { host: "db.project.supabase.co", database: "crowdradar_dev" },
        { host: "localhost", database: "otra_base" }
    ]) {
        assert.throws(() => assertLocalDevelopmentDatabase({ config }), /solo admite/);
        assert.throws(() => assertIsolatedPlacesTestDatabase({ config }), /solo admite/);
    }
    assert.throws(() => assertIsolatedPlacesTestDatabase({ config: { host: "localhost", database: "crowdradar_dev" } }), /solo admite/);
    assert.doesNotThrow(() => assertIsolatedPlacesTestDatabase({ config: { host: "localhost", database: "crowdradar_hu31_test" } }));
    assert.throws(() => assertIsolatedFavoritesTestDatabase({ config: { host: "db.remote.example", database: "crowdradar_hu81_test" } }), /solo admite/);
    assert.throws(() => assertIsolatedFavoritesTestDatabase({ config: { host: "localhost", database: "crowdradar_dev" } }), /solo admite/);
    assert.doesNotThrow(() => assertIsolatedFavoritesTestDatabase({ config: { host: "localhost", database: "crowdradar_hu81_test" } }));
});

test("CLI de migración conserva barreras para entrega, sistema y Supabase", () => {
    for (const config of [
        { host: "localhost", database: "crowdradar_sprint1" },
        { host: "localhost", database: "postgres" },
        { host: "db.project.supabase.co", database: "postgres" },
        { host: "aws-0.pooler.supabase.com", database: "crowdradar" }
    ]) assert.throws(() => assertMigrationTarget({ config }), /Destino protegido/);
});

test("CORS admite preflight Web JSON y Authorization sin omitir JWT", async () => {
    const { createApp } = await import("../app.js");
    const app = createApp();
    const server = app.listen(0);
    const url = `http://127.0.0.1:${server.address().port}/api/places`;
    try {
        const preflight = await fetch(url, { method: "OPTIONS", headers: { Origin: "http://localhost:5500", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization,content-type" } });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:5500");
        assert.match(preflight.headers.get("access-control-allow-headers"), /Authorization/i);
        assert.equal(preflight.headers.get("access-control-allow-credentials"), null);
        const unauthorized = await fetch(url, { headers: { Origin: "http://localhost:5500" } });
        assert.equal(unauthorized.status, 401);
        const unlisted = await fetch(url, { headers: { Origin: "https://unlisted.example" } });
        assert.equal(unlisted.headers.get("access-control-allow-origin"), null);
        assert.equal(unlisted.status, 401);
    } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("CORS permite la baja autenticada de un token push", async () => {
    const { corsOptions } = await import("../src/config/environment.js");
    const options = corsOptions({ CORS_ORIGINS: "http://localhost:5500" });
    assert.ok(options.methods.includes("DELETE"));
});
