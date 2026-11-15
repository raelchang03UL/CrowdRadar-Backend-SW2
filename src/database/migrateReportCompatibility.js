import { QueryTypes } from "sequelize";
import { migrateReports, reportsMigration } from "./migrateReports.js";

export const legacyReportsMigration = "004-create-saturation-reports";
export const reportCompatibilityMigration = "005-reconcile-report-schema";

// Las dos 004 publicadas permanecen en Git. Esta transición registra qué historia
// existe: no marca la 004 canónica como ejecutada sobre una tabla legacy.
export async function migrateReportCompatibility(db) {
    const history = await db.query("SELECT name FROM public.crowdradar_migrations WHERE name IN (:canonical, :legacy)", {
        replacements: { canonical: reportsMigration, legacy: legacyReportsMigration }, type: QueryTypes.SELECT
    });
    if (!history.length) await migrateReports(db);
    return db.transaction(async (transaction) => {
        const options = { transaction };
        await db.query("SELECT pg_advisory_xact_lock(310031)", options);
        const applied = await db.query("SELECT name FROM public.crowdradar_migrations WHERE name = :name", {
            ...options, replacements: { name: reportCompatibilityMigration }, type: QueryTypes.SELECT
        });
        if (applied.length) return false;
        // Validar antes de cambiar; SQL desconocido o datos inválidos revierten todo.
        await db.query("SELECT id, user_id, place_id, level, created_at FROM public.saturation_reports LIMIT 0", options);
        const invalid = await db.query("SELECT id FROM public.saturation_reports WHERE level NOT IN ('TRANQUILO', 'MODERADO', 'SATURADO') OR level IS NULL LIMIT 1", { ...options, type: QueryTypes.SELECT });
        if (invalid.length) throw new Error("Reportes incompatibles: revisar datos sin borrarlos.");
        await db.query("ALTER TABLE public.saturation_reports ALTER COLUMN level TYPE VARCHAR(12)", options);
        // Ambos esquemas publicados usan estos nombres PostgreSQL por defecto.
        await db.query("ALTER TABLE public.saturation_reports DROP CONSTRAINT saturation_reports_user_id_fkey, DROP CONSTRAINT saturation_reports_place_id_fkey", options);
        await db.query(`ALTER TABLE public.saturation_reports
            ADD CONSTRAINT saturation_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
            ADD CONSTRAINT saturation_reports_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id)`, options);
        await db.query("CREATE INDEX IF NOT EXISTS saturation_reports_user_place_created ON public.saturation_reports (user_id, place_id, created_at DESC)", options);
        await db.query("INSERT INTO public.crowdradar_migrations (name) VALUES (:name)", {
            ...options, replacements: { name: reportCompatibilityMigration }
        });
        return true;
    });
}

export async function assertConsolidatedReportsSchemaReady(db) {
    try {
        const history = await db.query("SELECT name FROM public.crowdradar_migrations WHERE name IN (:canonical, :legacy, :compatibility)", {
            replacements: { canonical: reportsMigration, legacy: legacyReportsMigration, compatibility: reportCompatibilityMigration }, type: QueryTypes.SELECT
        });
        if (!history.some(({ name }) => name === reportCompatibilityMigration) ||
            !history.some(({ name }) => [reportsMigration, legacyReportsMigration].includes(name))) throw new Error("missing");
        await db.query("SELECT id, user_id, place_id, level, created_at FROM public.saturation_reports LIMIT 0");
    } catch {
        throw Object.assign(new Error("Falta conciliar el esquema de reportes. Ejecuta npm run db:migrate antes de iniciar."), { code: "SCHEMA_NOT_READY" });
    }
}
