import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServerlessHandler, safeInitializationDiagnostic } from "../src/runtime/serverlessHandler.js";

test("diagnóstico usa vocabulario fijo y omite mensaje, SQL, stack y códigos desconocidos", () => {
    const privateValue = "postgresql://private:password@host/db";
    const hostile = Object.assign(new Error(privateValue), {
        name: privateValue, code: "SECRET_ONLY_UPPERCASE", sql: privateValue,
        original: { code: privateValue, message: privateValue }, cause: { code: "ECONNREFUSED", message: privateValue }
    });
    assert.deepEqual(safeInitializationDiagnostic(hostile, privateValue), {
        event: "crowdradar_initialization_failed", stage: "initialize", errorType: "UNKNOWN",
        code: "UNKNOWN", causeCode: "ECONNREFUSED"
    });
    assert.doesNotMatch(JSON.stringify(safeInitializationDiagnostic(hostile, "readiness")), /private|password|host|SECRET_ONLY_UPPERCASE/);
    const databaseError = Object.assign(new Error(privateValue), { name: "SequelizeConnectionError", original: { code: "28P01" } });
    assert.equal(safeInitializationDiagnostic(databaseError, "readiness").causeCode, "28P01");
});

test("error pg de Sequelize se reconoce solo por mensaje exacto sin publicarlo", () => {
    assert.equal(safeInitializationDiagnostic(new Error("Please install pg package manually"), "imports").code, "DEPENDENCY_PG_MISSING");
    assert.equal(safeInitializationDiagnostic(new Error("Please install pg package manually: private"), "imports").code, "UNKNOWN");
    assert.equal(safeInitializationDiagnostic(Object.assign(new Error("private path"), { code: "ERR_MODULE_NOT_FOUND" }), "imports").code, "ERR_MODULE_NOT_FOUND");
});

test("fallo concurrente registra una etapa segura y mantiene 503 público uniforme", async () => {
    const logs = [];
    let starts = 0;
    const handler = createServerlessHandler({ log: value => logs.push(value), initialize: async ({ setStage }) => {
        starts++; setStage("imports");
        throw new Error("Please install pg package manually");
    } });
    const replies = Array.from({ length: 3 }, () => ({ headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = value; } }));
    await Promise.all(replies.map(response => handler({}, response)));
    assert.equal(starts, 1);
    assert.deepEqual(logs, [{ event: "crowdradar_initialization_failed", stage: "imports", errorType: "Error", code: "DEPENDENCY_PG_MISSING" }]);
    for (const response of replies) {
        assert.equal(response.statusCode, 503);
        assert.equal(JSON.parse(response.body).code, "SERVICE_UNAVAILABLE");
        assert.doesNotMatch(response.body, /imports|DEPENDENCY|pg|Please/);
    }
});

test("Sequelize utiliza el pg importado explícitamente sin conectar ni alterar TLS", () => {
    const source = `import assert from 'node:assert/strict';
        import pg from 'pg';
        import database from './src/config/database.js';
        assert.equal(database.options.dialectModule, pg);
        assert.equal(database.config.dialectModule, pg);
        assert.equal(database.connectionManager.lib, pg);
        assert.equal(database.config.database, 'crowdradar_runtime_driver_test');
        assert.equal(database.options.dialectOptions.ssl.rejectUnauthorized, true);
        assert.equal(database.options.pool.max, 5);
        assert.equal(database.options.logging, false);
        await database.close();
        process.stdout.write('DRIVER_PINNED');`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
        cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 10000,
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: "test",
            DATABASE_URL: "postgresql://qa:synthetic@127.0.0.1:1/crowdradar_runtime_driver_test", DB_SSL: "true" }
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /DRIVER_PINNED/);
});
