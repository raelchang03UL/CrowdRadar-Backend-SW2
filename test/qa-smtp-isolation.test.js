import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "PASSWORD_RESET_URL"];
const runner = fileURLToPath(new URL("../scripts/serve-consolidation-qa.js", import.meta.url));

// Ejecuta el runner y app/config reales. Solo sustituye las fronteras externas:
// no abre PostgreSQL, sockets HTTP ni SMTP, incluso en el caso de regresión.
const probe = `
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(process.env.QA_SMTP_RUNNER);
const dotenv = require("dotenv");
const { Sequelize } = require("sequelize");
const express = require("express");
// Nodemailer expone módulos diferentes para require/import; observar el mismo
// export ESM que usa RecoveryMailDelivery evita dejar un transporte sin doble.
const { default: nodemailer } = await import(process.env.QA_SMTP_NODEMAILER_MODULE);
const state = { dotenvLoads: 0, fixtureLoads: 0, transports: 0, sends: 0, authenticate: 0, queries: 0, listening: false };
const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "PASSWORD_RESET_URL"];
const config = dotenv.config;
dotenv.config = (...args) => {
    const loaded = config(...args);
    state.dotenvLoads++;
    if (loaded.parsed?.QA_SMTP_SYNTHETIC === "true") state.fixtureLoads++;
    return loaded;
};
Sequelize.prototype.authenticate = async function () { state.authenticate++; };
Sequelize.prototype.query = async function (sql, options) {
    assert.match(sql, /^SELECT /);
    assert.equal(this.config.host, "127.0.0.1");
    assert.equal(this.config.database, "crowdradar_cierre_fresh_20261019");
    state.queries++;
    if (sql.includes("shobj_description")) return [[{ name: this.config.database, provenance: "CrowdRadar/SW2/cierre-20261019/v1" }]];
    return Object.values(options?.replacements ?? {}).map(name => ({ name }));
};
nodemailer.createTransport = () => {
    state.transports++;
    return { sendMail: () => { state.sends++; throw new Error("SMTP real prohibido en esta prueba"); } };
};
express.application.listen = function (port, host, callback) {
    assert.equal(port, 3053);
    assert.equal(host, "127.0.0.1");
    state.listening = true;
    state.smtpBlankAtStart = keys.every(key => process.env[key] === "");
    callback();
    return {};
};
try {
    await import(pathToFileURL(process.env.QA_SMTP_RUNNER).href);
} catch (error) {
    state.error = error.code ?? error.message;
    process.exitCode = 1;
} finally {
    state.smtpBlankAfterImports = keys.every(key => process.env[key] === "");
    console.log("QA_SMTP_PROBE " + JSON.stringify(state));
}
`;

const complete = [
    "SMTP_HOST=smtp.example.invalid", "SMTP_PORT=587", "SMTP_USER=qa@example.invalid",
    "SMTP_PASSWORD=synthetic-only-not-a-credential", 'MAIL_FROM="QA <qa@example.invalid>"',
    'PASSWORD_RESET_URL="http://127.0.0.1:5553/#/reset-password"'
];

for (const [name, smtp] of [
    ["SMTP completo", complete],
    ["SMTP parcial: solo host", [complete[0]]],
    ["SMTP parcial: solo remitente", [complete[4]]]
]) {
    test(`runner QA conserva entrega deshabilitada después de dotenv con .env ${name}`, () => {
        const directory = mkdtempSync(join(tmpdir(), "crowdradar-qa-smtp-"));
        const before = Object.fromEntries(smtpKeys.map(key => [key, process.env[key]]));
        try {
            const fixture = join(directory, ".env");
            writeFileSync(fixture, [
                "QA_SMTP_SYNTHETIC=true", "DB_HOST=127.0.0.1", "DB_PORT=5432",
                "DB_USER=synthetic_qa_role", "DB_PASSWORD=", ...smtp, ""
            ].join("\n"));
            const env = { ...process.env };
            for (const key of [
                ...smtpKeys, "DATABASE_URL", "MIGRATION_DATABASE_URL", "DB_NAME", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD",
                "DB_SSL", "DB_SSL_CA", "DB_POOL_MAX", "DB_POOL_MIN", "DB_POOL_IDLE_MS", "DB_POOL_ACQUIRE_MS",
                "JWT_SECRET", "CORS_ORIGINS", "KARMA_POINTS_PER_REPORT", "REPORT_COOLDOWN_MINUTES", "NODE_OPTIONS"
            ]) delete env[key];
            Object.assign(env, {
                QA_SMTP_RUNNER: runner, QA_SMTP_NODEMAILER_MODULE: import.meta.resolve("nodemailer"),
                CROWDRADAR_QA_ENV_FILE: fixture, CROWDRADAR_QA_RUN: "cierre-20261019",
                DOTENV_CONFIG_QUIET: "true", SMTP_HOST: "inherited.example.invalid", SMTP_PASSWORD: "synthetic-inherited-only"
            });
            const result = spawnSync(process.execPath, ["--input-type=module", "--eval", probe], {
                cwd: directory, env, encoding: "utf8", timeout: 15000
            });
            assert.ifError(result.error);
            const line = result.stdout.split(/\r?\n/).find(value => value.startsWith("QA_SMTP_PROBE "));
            assert.ok(line, `Falta resultado del runner: ${result.stderr}`);
            const state = JSON.parse(line.slice("QA_SMTP_PROBE ".length));
            assert.equal(result.status, 0, `El runner no arrancó: ${JSON.stringify(state)}`);
            assert.ok(state.dotenvLoads >= 2, "database.js y app.js deben ejecutar dotenv.config reales");
            assert.equal(state.fixtureLoads, state.dotenvLoads, "Solo debe leerse el .env sintético del subproceso");
            assert.equal(state.transports, 0, `El arranque QA no debe construir una entrega SMTP habilitada: ${JSON.stringify(state)}`);
            assert.equal(state.sends, 0);
            assert.equal(state.authenticate, 1, "Debe alcanzar startServer real después de validar SMTP");
            assert.ok(state.queries > 1, "Debe ejecutar procedencia y readiness reales con DB doble");
            assert.equal(state.listening, true);
            assert.equal(state.smtpBlankAtStart, true, JSON.stringify(state));
            assert.equal(state.smtpBlankAfterImports, true, JSON.stringify(state));
        } finally {
            rmSync(directory, { recursive: true, force: true });
            assert.deepEqual(Object.fromEntries(smtpKeys.map(key => [key, process.env[key]])), before);
        }
    });
}
