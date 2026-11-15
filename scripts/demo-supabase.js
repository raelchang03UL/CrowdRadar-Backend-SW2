import { Sequelize } from "sequelize";
import { demoDatabaseConfiguration } from "../src/config/demoSupabaseEnvironment.js";
import { assertDemoInitialEmpty, assertDemoProvenance } from "../src/database/demoSupabaseSafety.js";
import { grantDemoApiPermissions, provisionDemoSupabase, seedDemoSupabaseCatalog } from "../src/database/provisionDemoSupabase.js";

// No dotenv autoload: select the private env explicitly with node --env-file.
// Commands do not accept arbitrary target IDs/hosts or SQL from arguments.
const mode = process.argv[2];
const purposes = { preflight: "bootstrap", bootstrap: "bootstrap", "check-api": "api", "check-migration": "migration", grants: "migration", catalog: "migration" };
let db;
try {
    if (!Object.hasOwn(purposes, mode)) throw Object.assign(new Error("DEMO_USAGE"), { code: "DEMO_USAGE" });
    const purpose = purposes[mode];
    const config = demoDatabaseConfiguration(process.env, purpose);
    db = new Sequelize(config.database, config.username, config.password, config.options);
    if (mode === "preflight") await assertDemoInitialEmpty(db, process.env);
    else if (mode === "bootstrap") await provisionDemoSupabase(db, process.env);
    else if (mode === "grants") await grantDemoApiPermissions(db, process.env);
    else if (mode === "catalog") await seedDemoSupabaseCatalog(db, process.env);
    else await assertDemoProvenance(db, process.env, purpose);
    console.log(`Demo Supabase ${mode}: completado; sin secretos en salida.`);
} catch (error) {
    const code = /^DEMO_[A-Z_]+$/.test(error.code ?? "") ? error.code : "DEMO_OPERATION_FAILED";
    console.error(`${code}: operación detenida; no se muestran SQL ni credenciales.`);
    process.exitCode = 1;
} finally { if (db) await db.close(); }
