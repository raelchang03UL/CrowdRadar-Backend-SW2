import test from "node:test";
import assert from "node:assert/strict";
import { databaseConfiguration, validateEnvironment, corsOptions } from "../src/config/environment.js";

test("DB acepta configuración por variables sin fijar host/proveedor", () => {
    const env = { DB_NAME: "staging", DB_HOST: "db.internal.example", DB_USER: "app", DB_PASSWORD: "", DB_PORT: "5544", JWT_SECRET: "test-only" };
    assert.doesNotThrow(() => validateEnvironment(env));
    const config = databaseConfiguration(env);
    assert.equal(config.options.host, env.DB_HOST);
    assert.equal(config.options.port, 5544);
    assert.equal(config.database, "staging");
    assert.equal(config.options.dialectOptions, undefined);
});

test("DATABASE_URL y TLS verificado son opcionales, sin permitir URL malformada ni TLS inseguro", () => {
    const env = { DATABASE_URL: "postgresql://app@db.internal.example/staging", DB_SSL: "true", DB_SSL_CA: "test-ca\\nline", JWT_SECRET: "test-only" };
    assert.doesNotThrow(() => validateEnvironment(env));
    const config = databaseConfiguration(env);
    assert.equal(config.url, env.DATABASE_URL);
    assert.deepEqual(config.options.dialectOptions.ssl, { rejectUnauthorized: true, ca: "test-ca\nline" });
    for (const DATABASE_URL of ["invalid", "https://example.com/db", "postgresql://host/", "postgresql://host/db?sslmode=disable"]) {
        assert.throws(() => validateEnvironment({ ...env, DATABASE_URL }), /DATABASE_URL|Configura TLS/);
    }
    assert.throws(() => validateEnvironment({ ...env, DB_SSL: "unsafe" }), /DB_SSL/);
});

test("CORS configurable admite orígenes explícitos y Android, sin cookies ni wildcard", () => {
    const options = corsOptions({ CORS_ORIGINS: "http://localhost:5500, https://app.example" });
    for (const [origin, expected] of [[undefined, true], ["http://localhost:5500", true], ["https://app.example", true], ["https://other.example", false]]) {
        options.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, expected); });
    }
    assert.equal(options.credentials, false);
    assert.throws(() => corsOptions({ CORS_ORIGINS: "*" }), /explícitos/);
    assert.throws(() => corsOptions({ CORS_ORIGINS: "https://app.example/path" }), /sin ruta/);
});
