import { QueryTypes } from "sequelize";

export const reportsMigration = "004-saturation-reports";

export async function migrateReports(sequelize) {
    return sequelize.transaction(async (transaction) => {
        const options = { transaction };
        await sequelize.query("SELECT pg_advisory_xact_lock(310031)", options);
        const history = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name IN (:recovery, :reports)",
            {
                ...options,
                replacements: {
                    recovery: "003-password-recovery",
                    reports: reportsMigration
                },
                type: QueryTypes.SELECT
            }
        );
        if (!history.some(({ name }) => name === "003-password-recovery")) {
            throw new Error("Aplica 003-password-recovery antes de 004-saturation-reports.");
        }
        if (history.some(({ name }) => name === reportsMigration)) return false;
        await sequelize.query(`CREATE TABLE public.saturation_reports (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES public.users(id),
            place_id INTEGER NOT NULL REFERENCES public.places(id),
            level VARCHAR(12) NOT NULL CHECK (level IN ('TRANQUILO', 'MODERADO', 'SATURADO')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, options);
        await sequelize.query(
            "CREATE INDEX saturation_reports_user_place_created ON public.saturation_reports (user_id, place_id, created_at DESC)",
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
        const applied = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { replacements: { name: reportsMigration }, type: QueryTypes.SELECT }
        );
        if (!applied.length) throw new Error("missing");
        await sequelize.query(
            "SELECT user_id, place_id, level, created_at FROM public.saturation_reports LIMIT 0"
        );
    } catch {
        const error = new Error("Falta el esquema de reportes. Ejecuta npm run db:migrate antes de iniciar.");
        error.code = "SCHEMA_NOT_READY";
        throw error;
    }
}
