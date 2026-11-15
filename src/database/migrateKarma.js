import { QueryTypes } from "sequelize";
import { reportCompatibilityMigration } from "./migrateReportCompatibility.js";

export const karmaMigration = "006-report-karma-ledger";
export async function migrateKarma(db) {
    return db.transaction(async (transaction) => {
        const options = { transaction };
        await db.query("SELECT pg_advisory_xact_lock(310031)", options);
        const history = await db.query("SELECT name FROM public.crowdradar_migrations WHERE name IN (:reports, :karma)", {
            ...options, replacements: { reports: reportCompatibilityMigration, karma: karmaMigration }, type: QueryTypes.SELECT
        });
        if (!history.some(({ name }) => name === reportCompatibilityMigration)) throw new Error("Aplica 005 antes de karma.");
        if (history.some(({ name }) => name === karmaMigration)) return false;
        await db.query(`ALTER TABLE public.users ADD COLUMN karma_points BIGINT NOT NULL DEFAULT 0
            CHECK (karma_points >= 0 AND karma_points <= 9007199254740991)`, options);
        await db.query(`CREATE TABLE public.report_karma_awards (
            report_id BIGINT PRIMARY KEY REFERENCES public.saturation_reports(id),
            user_id INTEGER NOT NULL REFERENCES public.users(id),
            points INTEGER NOT NULL CHECK (points >= 0),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, options);
        await db.query("INSERT INTO public.crowdradar_migrations (name) VALUES (:name)", {
            ...options, replacements: { name: karmaMigration }
        });
        return true;
    });
}

export async function assertKarmaSchemaReady(db) {
    try {
        const history = await db.query("SELECT name FROM public.crowdradar_migrations WHERE name = :name", {
            replacements: { name: karmaMigration }, type: QueryTypes.SELECT
        });
        if (!history.length) throw new Error("missing");
        await db.query("SELECT karma_points FROM public.users LIMIT 0");
        await db.query("SELECT report_id, user_id, points FROM public.report_karma_awards LIMIT 0");
    } catch {
        throw Object.assign(new Error("Falta el esquema de karma. Ejecuta npm run db:migrate antes de iniciar."), { code: "SCHEMA_NOT_READY" });
    }
}
