// Private child-process harness for the opt-in Flutter VM integration test.
// It never exposes captured mail through HTTP, sends mail, or prints secrets.
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { assertIsolatedAuthTestDatabase, assertIsolatedConsolidationDatabase, consolidationQaDatabases, assertConsolidationQaProvenance } from "../src/database/databaseSafety.js";

const respond = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
let server;
let sequelize;
let input;
let closing;

async function close() {
    if (closing) return closing;
    closing = (async () => {
        input?.close();
        if (server) {
            server.closeIdleConnections();
            await new Promise((resolve) => server.close(resolve));
        }
        await sequelize?.close();
    })();
    return closing;
}

process.once("SIGTERM", () => { close().finally(() => process.exit()); });

try {
    if (process.env.CROWDRADAR_RECOVERY_INTEGRATION !== "1" || process.env.NODE_ENV !== "test") {
        throw new Error("test-only");
    }
    dotenv.config({ quiet: true });
    const qaRun = process.env.CROWDRADAR_QA_RUN;
    if (qaRun) {
        const privateEnv = dotenv.parse(readFileSync(process.env.CROWDRADAR_QA_ENV_FILE));
        if (privateEnv.DATABASE_URL || !["localhost", "127.0.0.1", "::1"].includes(privateEnv.DB_HOST)) throw new Error("local-only");
        Object.assign(process.env, { DB_HOST: privateEnv.DB_HOST, DB_PORT: privateEnv.DB_PORT ?? "5432",
            DB_USER: privateEnv.DB_USER, DB_PASSWORD: privateEnv.DB_PASSWORD, DB_SSL: "false",
            JWT_SECRET: randomBytes(48).toString("hex") });
        for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "PASSWORD_RESET_URL"]) delete process.env[key];
    }
    const database = qaRun ? consolidationQaDatabases(qaRun)[0] : "crowdradar_auth_test";
    const host = process.env.DB_HOST;
    const assertTarget = (db) => qaRun ? assertIsolatedConsolidationDatabase(db, qaRun) : assertIsolatedAuthTestDatabase(db);
    assertTarget({ config: { database, host } });
    process.env.DB_NAME = database;
    // Empty rather than absent prevents later dotenv imports from reloading
    // a DATABASE_URL from .env. The guarded local DB remains the only target.
    process.env.DATABASE_URL = "";
    // Only the structured IPC channel below may write stdout. Imported code
    // cannot accidentally include a credential or mail in a diagnostic.
    console.log = console.info = console.debug = console.warn = console.error = () => {};

    ({ default: sequelize } = await import("../src/config/database.js"));
    assertTarget(sequelize);
    await sequelize.authenticate();
    if (qaRun) await assertConsolidationQaProvenance(sequelize, qaRun);
    const { migratePlaces } = await import("../src/database/migratePlaces.js");
    const { migrateAuth } = await import("../src/database/migrateAuth.js");
    const { migrateRecovery } = await import("../src/database/migrateRecovery.js");
    await migratePlaces(sequelize);
    await migrateAuth(sequelize);
    await migrateRecovery(sequelize);

    const { default: PasswordRecoveryService } = await import("../src/services/PasswordRecoveryService.js");
    const { default: persistence } = await import("../src/repositories/PasswordRecoveryRepository.js");
    const { createMemoryRecoveryDelivery } = await import("../test/helpers/memoryRecoveryDelivery.js");
    const { createApp } = await import("../app.js");
    const mailbox = createMemoryRecoveryDelivery();
    // Other isolated runners share this DB. Keep this child's abuse counters
    // in their own namespace, with the real thresholds and SQL transactions.
    // The dedicated backend runner checks production rate-limit behaviour.
    const namespace = randomUUID();
    const repository = Object.create(persistence);
    repository.consumeLimits = (entries) => persistence.consumeLimits(entries.map((entry) => ({
        ...entry,
        keyHash: createHash("sha256").update(namespace).update(entry.keyHash).digest("hex")
    })));
    const recoveryService = new PasswordRecoveryService({
        delivery: mailbox.delivery,
        resetUrl: "http://127.0.0.1:5500/#/reset-password",
        repository
    });
    const app = createApp({ recoveryService });
    server = await new Promise((resolve, reject) => {
        const listener = app.listen(3031, "127.0.0.1", () => resolve(listener));
        listener.once("error", reject);
    });
    input = createInterface({ input: process.stdin, crlfDelay: Infinity });
    respond({ event: "ready", port: 3031, isolatedDatabase: true, memoryDelivery: true,
        database, qaRun: qaRun ?? "auth-historical" });
    for await (const line of input) {
        let command;
        try { command = JSON.parse(line); } catch {
            respond({ event: "error", code: "INVALID_COMMAND" });
            continue;
        }
        if (command.command === "shutdown") break;
        if (command.command !== "mailbox" ||
            !/^qa\.hu212\.[a-zA-Z0-9._-]+@example\.test$/.test(command.email ?? "")) {
            respond({ event: "error", code: "INVALID_COMMAND" });
            continue;
        }
        await recoveryService.drainDeliveries();
        const messages = mailbox.messages.filter((message) => message.email === command.email);
        const resetLinks = messages.filter((message) => message.type === "reset-link");
        // The link travels only through the anonymous pipe owned by the test.
        // Never run this harness with stdout redirected to a file or terminal.
        respond({
            event: "mailbox",
            resetUrl: resetLinks.at(-1)?.resetUrl ?? null,
            resetCount: resetLinks.length,
            changedCount: messages.filter((message) => message.type === "password-changed").length
        });
    }
    await recoveryService.drainDeliveries();
    await close();
} catch {
    // No exception text: DB, HTTP and delivery exceptions may contain secrets.
    respond({ event: "error", code: "LOCAL_RECOVERY_HARNESS_FAILED" });
    process.exitCode = 1;
    await close().catch(() => {});
}
