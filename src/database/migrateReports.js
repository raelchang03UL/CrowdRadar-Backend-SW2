import { QueryTypes } from "sequelize";

export const reportsMigration = "004-create-saturation-reports";

export async function migrateReports(sequelize) {
    return sequelize.transaction(async (transaction) => {
        const options = { transaction };
        await sequelize.query("SELECT pg_advisory_xact_lock(310031)", options);
        await sequelize.query(`CREATE TABLE IF NOT EXISTS public.crowdradar_migrations (
            name VARCHAR(100) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, options);
        const applied = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { ...options, replacements: { name: reportsMigration }, type: QueryTypes.SELECT }
        );
        if (applied.length) return false;
        await sequelize.query(`CREATE TABLE public.saturation_reports (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            place_id INTEGER NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
            level VARCHAR(20) NOT NULL CHECK (level IN ('TRANQUILO', 'MODERADO', 'SATURADO')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, options);
        await sequelize.query(
            "CREATE INDEX saturation_reports_user_created_idx ON public.saturation_reports (user_id, created_at DESC)",
            options
        );
        await sequelize.query(
            "INSERT INTO public.crowdradar_migrations (name) VALUES (:name)",
            { ...options, replacements: { name: reportsMigration } }
        );
        return true;
    });
}

export async function assertReportsSchemaReady(sequelize) {
    try {
        await sequelize.query("SELECT 1 FROM public.saturation_reports LIMIT 1");
    } catch {
        const error = new Error("Falta la migración 004-create-saturation-reports. Ejecuta npm run db:migrate.");
        error.code = "SCHEMA_NOT_READY";
        throw error;
    }
}
