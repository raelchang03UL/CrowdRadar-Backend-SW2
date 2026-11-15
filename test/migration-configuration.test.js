import test from "node:test";
import assert from "node:assert/strict";
import { databaseConfiguration } from "../src/config/environment.js";
import { migrationConfiguration } from "../src/config/migrationConnection.js";
import { assertMigrationTarget } from "../src/database/databaseSafety.js";

test("API y migraciones seleccionan roles diferentes sin conectar ni revelar secretos", () => {
    const env = { DATABASE_URL: "postgres://app@localhost/qa", MIGRATION_DATABASE_URL: "postgres://ddl@localhost/qa", JWT_SECRET: "synthetic-only" };
    assert.equal(databaseConfiguration(env).url, env.DATABASE_URL);
    assert.equal(migrationConfiguration(env).url, env.MIGRATION_DATABASE_URL);
    assert.equal(migrationConfiguration(env).options.pool.max, 1);
    assert.equal(databaseConfiguration(env).options.pool.max, 5);
    assert.equal(migrationConfiguration({ DB_HOST: "localhost", DB_USER: "local", DB_PASSWORD: "", DB_NAME: "qa", JWT_SECRET: "test" }).database, "qa");
});

test("pool acotado, TLS verificado y barrera Supabase se mantienen con rol separado", () => {
    const env = { DATABASE_URL: "postgres://app@localhost/qa", MIGRATION_DATABASE_URL: "postgres://ddl@db.project.supabase.co/postgres", DB_SSL: "true", JWT_SECRET: "synthetic-only" };
    const config = migrationConfiguration(env);
    assert.equal(config.options.dialectOptions.ssl.rejectUnauthorized, true);
    assert.throws(() => assertMigrationTarget({ config: { host: new URL(config.url).hostname, database: "postgres" } }), /Destino protegido/);
    for (const settings of [{ DB_POOL_MAX: "0" }, { DB_POOL_MAX: "21" }, { DB_POOL_MIN: "6" }, { DB_POOL_IDLE_MS: "NaN" }, { DB_POOL_ACQUIRE_MS: "1" }]) {
        assert.throws(() => databaseConfiguration({ ...env, ...settings }), /DB_POOL/);
    }
    assert.throws(() => migrationConfiguration({ ...env, MIGRATION_DATABASE_URL: "postgres://ddl@host/qa?sslmode=disable" }), /TLS/);
});
