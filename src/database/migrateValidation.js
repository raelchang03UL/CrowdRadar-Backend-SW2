import { QueryTypes } from "sequelize";
export const validationMigration = "007-report-validation";
export async function migrateValidation(db) {
    return db.transaction(async (transaction) => {
        const options = { transaction };
        await db.query("SELECT pg_advisory_xact_lock(310031)", options);
        const history = await db.query("SELECT name FROM public.crowdradar_migrations WHERE name IN (:previous, :current)", {
            ...options, replacements: { previous: "006-report-karma-ledger", current: validationMigration }, type: QueryTypes.SELECT
        });
        if (!history.some(({ name }) => name === "006-report-karma-ledger")) throw new Error("Aplica006 antes de007.");
        if (history.some(({ name }) => name === validationMigration)) return false;
        await db.query(`CREATE TABLE public.report_validations (
            report_id BIGINT NOT NULL REFERENCES public.saturation_reports(id),
            user_id INTEGER NOT NULL REFERENCES public.users(id),
            decision VARCHAR(7) NOT NULL CHECK (decision IN ('CONFIRM','REJECT')),
            weight SMALLINT NOT NULL CHECK (weight BETWEEN 1 AND 5),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (report_id,user_id)
        )`, options);
        await db.query(`CREATE TABLE public.report_denunciations (
            report_id BIGINT NOT NULL REFERENCES public.saturation_reports(id),
            user_id INTEGER NOT NULL REFERENCES public.users(id),
            reason VARCHAR(500), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (report_id,user_id)
        )`, options);
        await db.query("CREATE INDEX saturation_reports_place_created ON public.saturation_reports (place_id,created_at DESC,id DESC)", options);
        await db.query("INSERT INTO public.crowdradar_migrations(name) VALUES (:name)", { ...options, replacements: { name: validationMigration } });
        return true;
    });
}
export async function assertValidationSchemaReady(db) {
    try {
        const rows = await db.query("SELECT name FROM public.crowdradar_migrations WHERE name = :name", { replacements: { name: validationMigration }, type: QueryTypes.SELECT });
        if (!rows.length) throw new Error("missing");
        await db.query("SELECT report_id,user_id,decision,weight FROM public.report_validations LIMIT 0");
        await db.query("SELECT report_id,user_id,reason FROM public.report_denunciations LIMIT 0");
    } catch {
        throw Object.assign(new Error("Falta el esquema de validación. Ejecuta npm run db:migrate antes de iniciar."), { code: "SCHEMA_NOT_READY" });
    }
}
