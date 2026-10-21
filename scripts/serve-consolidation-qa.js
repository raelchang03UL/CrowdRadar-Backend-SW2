import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import { assertConsolidationQaProvenance, consolidationQaDatabases } from "../src/database/databaseSafety.js";

if (!process.env.CROWDRADAR_QA_ENV_FILE) throw new Error("Indica un archivo privado local mediante CROWDRADAR_QA_ENV_FILE.");
const input = dotenv.parse(readFileSync(process.env.CROWDRADAR_QA_ENV_FILE));
const qaRun = process.env.CROWDRADAR_QA_RUN;
const qaDatabase = consolidationQaDatabases(qaRun)[0];
const port = qaRun === "cierre-20261019" ? 3053 : 3033;
const webPorts = qaRun === "cierre-20261019" ? [5553] : [5533, 5534];
if (input.DATABASE_URL || !["localhost", "127.0.0.1", "::1"].includes(input.DB_HOST)) throw new Error("QA solo admite DB_* local.");
Object.assign(process.env, { DB_HOST: input.DB_HOST, DB_PORT: input.DB_PORT ?? "5432", DB_USER: input.DB_USER,
    DB_PASSWORD: input.DB_PASSWORD, DB_NAME: qaDatabase, DATABASE_URL: "", DB_SSL: "false",
    NODE_ENV: "test", JWT_SECRET: randomBytes(48).toString("hex"),
    CORS_ORIGINS: webPorts.flatMap(value => [`http://localhost:${value}`, `http://127.0.0.1:${value}`]).join(",") });
// dotenv posterior conserva valores existentes: vacíos explícitos impiden reactivar SMTP desde .env.
for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "PASSWORD_RESET_URL"]) process.env[key] = "";
const { default: db } = await import("../src/config/database.js");
await assertConsolidationQaProvenance(db, qaRun);
const { startServer } = await import("../app.js");
await startServer({ port, host: "127.0.0.1" });
