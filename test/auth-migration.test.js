import test from "node:test";
import assert from "node:assert/strict";
import { migrateAuth, assertAuthSchemaReady, authMigration } from "../src/database/migrateAuth.js";
import { assertIsolatedAuthTestDatabase } from "../src/database/databaseSafety.js";

const previousColumns = ["id", "nombre", "apellido", "email", "passwordHash", "telefono", "rol", "distrito", "status", "createdAt", "updatedAt"];
function connection(columns = []) {
    let applied = false;
    const queries = [];
    const transaction = {};
    return {
        queries,
        transaction: async (operation) => operation(transaction),
        query: async (sql, options) => {
            assert.equal(options.transaction, transaction);
            queries.push(sql);
            if (sql.startsWith("SELECT name")) return applied ? [{ name: authMigration }] : [];
            if (sql.startsWith("SELECT column_name")) return columns.map((column_name) => ({ column_name }));
            if (sql.startsWith("INSERT INTO public.crowdradar_migrations")) applied = true;
            return [];
        }
    };
}

test("HU 2.3 migración limpia usa DDL explícito transaccional e historial único", async () => {
    const db = connection();
    assert.equal(await migrateAuth(db), true);
    assert.equal(await migrateAuth(db), false);
    assert.equal(db.queries.filter((sql) => sql.startsWith("CREATE TABLE public.users")).length, 1);
    assert.equal(db.queries.filter((sql) => sql.startsWith("ALTER TABLE public.users ADD COLUMN")).length, 1);
    assert.ok(db.queries.every((sql) => !/DROP|DELETE|TRUNCATE/i.test(sql)));
});

test("HU 2.3 migración previa solo añade la columna, no actualiza usuarios", async () => {
    const db = connection(previousColumns);
    assert.equal(await migrateAuth(db), true);
    assert.ok(db.queries.every((sql) => !/CREATE TABLE public.users|UPDATE public.users|DROP|DELETE/i.test(sql)));
});

test("HU 2.3 migración rechaza esquema desconocido o columna sin historial", async () => {
    for (const columns of [["id", "marcador"], [...previousColumns, "sessionVersion"]]) {
        const db = connection(columns);
        await assert.rejects(migrateAuth(db), /Esquema users no reconocido/);
        assert.ok(db.queries.every((sql) => !sql.startsWith("ALTER TABLE") && !sql.startsWith("INSERT INTO")));
    }
});

test("HU 2.3 arranque exige migración sin DDL ni error interno", async () => {
    const missing = { query: async (sql) => { assert.match(sql, /^SELECT /); return []; } };
    await assert.rejects(assertAuthSchemaReady(missing), (error) => error.code === "SCHEMA_NOT_READY" && error.message.includes("npm run db:migrate"));
    const privateFailure = { query: async () => { throw new Error("private-db-information"); } };
    await assert.rejects(assertAuthSchemaReady(privateFailure), (error) => error.code === "SCHEMA_NOT_READY" && !error.message.includes("private"));
});

test("HU 2.3 prueba DB rechaza destinos históricos, remotos y desarrollo", () => {
    assert.doesNotThrow(() => assertIsolatedAuthTestDatabase({ config: { host: "localhost", database: "crowdradar_auth_test" } }));
    for (const config of [{ host: "localhost", database: "crowdradar_dev" }, { host: "localhost", database: "crowdradar_sprint1" }, { host: "db.remote.example", database: "crowdradar_auth_test" }]) {
        assert.throws(() => assertIsolatedAuthTestDatabase({ config }), /solo admite/);
    }
});
