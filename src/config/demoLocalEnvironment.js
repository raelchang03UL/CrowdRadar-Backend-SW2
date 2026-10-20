import { randomBytes } from "node:crypto";

// Solo selecciona DB_* del archivo privado; nunca hereda SMTP/URLs/secretos.
export function demoLocalEnvironment(input) {
    if (input.DATABASE_URL || input.MIGRATION_DATABASE_URL ||
        !["localhost", "127.0.0.1", "::1"].includes(input.DB_HOST) ||
        !input.DB_USER || !input.DB_PASSWORD ||
        !/^\d{1,5}$/.test(input.DB_PORT ?? "5432") ||
        Number(input.DB_PORT ?? "5432") < 1 || Number(input.DB_PORT ?? "5432") > 65535) {
        throw new Error("DEMO_CONFIG_INVALID: se requieren DB_* locales válidos; sin URLs remotas.");
    }
    return {
        DB_HOST: input.DB_HOST, DB_PORT: input.DB_PORT ?? "5432", DB_USER: input.DB_USER,
        DB_PASSWORD: input.DB_PASSWORD, DB_NAME: "crowdradar_demo_local", DB_SSL: "false", DB_SSL_CA: "",
        DATABASE_URL: "", MIGRATION_DATABASE_URL: "", NODE_ENV: "test",
        JWT_SECRET: randomBytes(48).toString("hex"),
        CORS_ORIGINS: "http://127.0.0.1:5543,http://localhost:5543",
        REPORT_COOLDOWN_MINUTES: "3", KARMA_POINTS_PER_REPORT: "10",
        SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_PASSWORD: "", MAIL_FROM: "", PASSWORD_RESET_URL: "",
    };
}
