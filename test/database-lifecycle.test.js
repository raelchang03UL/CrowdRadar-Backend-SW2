import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../app.js";
import sequelize from "../src/config/database.js";
import User from "../src/models/User.js";
import { migratePlaces } from "../src/database/migratePlaces.js";
import { assertLocalDevelopmentDatabase, assertIsolatedPlacesTestDatabase, assertMigrationTarget } from "../src/database/databaseSafety.js";

test("arranque remoto no usa allowlist ni ejecuta DDL de places", async () => {
    const original = { config: { ...sequelize.config }, authenticate: sequelize.authenticate, transaction: sequelize.transaction, query: sequelize.query, sync: User.sync };
    const calls = [];
    let server;
    try {
        Object.assign(sequelize.config, { host: "db.staging.example", database: "crowdradar_staging" });
        sequelize.authenticate = async () => calls.push("authenticate");
        sequelize.transaction = sequelize.query = () => assert.fail("Arranque no debe migrar places");
        User.sync = async (...args) => { assert.deepEqual(args, []); calls.push("User.sync"); };
        server = await startServer({ port: 0 });
        const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { message: "CrowdRadar API" });
        assert.deepEqual(calls, ["authenticate", "User.sync"]);
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
    const { default: app } = await import("../app.js");
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
