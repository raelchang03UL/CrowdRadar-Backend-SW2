import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import { assertIsolatedConsolidationDatabase } from "../src/database/databaseSafety.js";

if (!process.env.CROWDRADAR_QA_ENV_FILE) throw new Error("Indica un archivo privado local mediante CROWDRADAR_QA_ENV_FILE.");
const input = dotenv.parse(readFileSync(process.env.CROWDRADAR_QA_ENV_FILE));
if (input.DATABASE_URL || !["localhost", "127.0.0.1", "::1"].includes(input.DB_HOST)) throw new Error("QA solo admite DB_* local.");
Object.assign(process.env, { DB_HOST: input.DB_HOST, DB_PORT: input.DB_PORT ?? "5432", DB_USER: input.DB_USER,
    DB_PASSWORD: input.DB_PASSWORD, DB_NAME: "crowdradar_consolidacion_fresh_20261017", DATABASE_URL: "", DB_SSL: "false",
    NODE_ENV: "test", JWT_SECRET: randomBytes(48).toString("hex"),
    CORS_ORIGINS: "http://localhost:5533,http://127.0.0.1:5533,http://localhost:5534,http://127.0.0.1:5534" });
for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM", "PASSWORD_RESET_URL"]) delete process.env[key];
const { default: db } = await import("../src/config/database.js");
assertIsolatedConsolidationDatabase(db);
const { startServer } = await import("../app.js");
await startServer({ port: 3033 });
