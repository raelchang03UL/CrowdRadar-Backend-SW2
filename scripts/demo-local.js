import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import { demoLocalEnvironment } from "../src/config/demoLocalEnvironment.js";
import { assertDemoLocalProvenance } from "../src/database/databaseSafety.js";

const mode = process.argv[2];
let db;
try {
    if (!["check", "migrate", "seed", "serve"].includes(mode) || !process.env.CROWDRADAR_DEMO_ENV_FILE) {
        throw new Error("DEMO_USAGE: CROWDRADAR_DEMO_ENV_FILE y modo check/migrate/seed/serve requeridos.");
    }
    const selected = demoLocalEnvironment(dotenv.parse(readFileSync(process.env.CROWDRADAR_DEMO_ENV_FILE)));
    Object.assign(process.env, selected);
    const { createMigrationConnection } = await import("../src/config/migrationConnection.js");
    // El aprovisionamiento inicial es manual: nunca conecta a otra base para
    // crear/adoptar destinos. check solo verifica la demo ya identificada.
    db = createMigrationConnection(selected);
    await assertDemoLocalProvenance(db);
    if (mode === "check") {
        console.log("Destino demo local y procedencia verificados. No se modificaron datos.");
    } else if (mode === "migrate") {
        const result = spawnSync(process.execPath, ["scripts/migrate.js"], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
        if (result.status !== 0) throw new Error("DEMO_MIGRATION_FAILED");
    } else if (mode === "seed") {
        const { seedDemoLocalPlaces } = await import("../src/database/seedDemoLocalPlaces.js");
        const result = await seedDemoLocalPlaces(db);
        console.log(`Catálogo demostrativo: ${result.inserted} insertados, ${result.unchanged} existentes; ${result.total} lugares. Sin monitoreo en tiempo real.`);
    } else {
        const { startServer } = await import("../app.js");
        await startServer({ port: 3043, host: "127.0.0.1" });
        console.log("Demo local: API3043 / Web5543 / crowdradar_demo_local; SMTP deshabilitado.");
    }
} catch (error) {
    const code = typeof error.message === "string" ? error.message.match(/^DEMO_[A-Z_]+/)?.[0] : null;
    console.error(`${code ?? "DEMO_OPERATION_FAILED"}: operación detenida. Revisa destino/procedencia/configuración; no se muestran SQL ni credenciales.`);
    process.exitCode = 1;
} finally { if (db) await db.close(); }
