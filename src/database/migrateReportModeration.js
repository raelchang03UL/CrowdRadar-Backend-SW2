import { QueryTypes } from "sequelize";
export const reportModerationMigration = "009-report-moderation";
export async function migrateReportModeration(db) {
    return db.transaction(async (transaction) => {
        const options = { transaction };
        await db.query("SELECT pg_advisory_xact_lock(310031)", options);
        const history = await db.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name IN (:previous,:current)",
            {
                ...options,
                type: QueryTypes.SELECT,
                replacements: {
                    previous: "008-user-moderation",
                    current: reportModerationMigration
                }
            }
        );
        if (!history.some((r) => r.name === "008-user-moderation"))
            throw new Error("Aplica008 antes de009.");
        if (history.some((r) => r.name === reportModerationMigration)) return false;
        await db.query(
            `ALTER TABLE public.saturation_reports
            ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN moderation_version INTEGER NOT NULL DEFAULT 0 CHECK (moderation_version>=0),
            ADD COLUMN reviewed_denunciations INTEGER NOT NULL DEFAULT 0 CHECK (reviewed_denunciations>=0),
            ADD COLUMN review_decision VARCHAR(7) NOT NULL DEFAULT 'PENDING',
            ADD CONSTRAINT report_review_state_consistent CHECK (
                (moderation_version=0 AND review_decision='PENDING' AND reviewed_denunciations=0 AND is_public)
                OR (moderation_version>0 AND reviewed_denunciations>0 AND
                    ((review_decision='KEEP' AND is_public) OR (review_decision='REMOVE' AND NOT is_public))))`,
            options
        );
        await db.query(
            `CREATE TABLE public.report_moderation_actions (
            id BIGSERIAL PRIMARY KEY,
            report_id BIGINT NOT NULL REFERENCES public.saturation_reports(id),
            admin_user_id INTEGER NOT NULL REFERENCES public.users(id),
            admin_name VARCHAR(511) NOT NULL,
            decision VARCHAR(6) NOT NULL CHECK (decision IN ('KEEP','REMOVE')),
            reason VARCHAR(500) NOT NULL CHECK(length(trim(reason))>0),
            previous_public BOOLEAN NOT NULL CHECK(previous_public),
            new_public BOOLEAN NOT NULL,
            reviewed_denunciations INTEGER NOT NULL CHECK(reviewed_denunciations>0),
            moderation_version INTEGER NOT NULL CHECK(moderation_version>0),
            created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
            UNIQUE(report_id,moderation_version),
            CHECK((decision='KEEP' AND new_public) OR (decision='REMOVE' AND NOT new_public))
        )`,
            options
        );
        await db.query(
            "CREATE INDEX report_moderation_actions_report_id_desc ON public.report_moderation_actions(report_id,id DESC)",
            options
        );
        await db.query("INSERT INTO public.crowdradar_migrations(name) VALUES(:name)", {
            ...options,
            replacements: { name: reportModerationMigration }
        });
        return true;
    });
}
export async function assertReportModerationSchemaReady(db) {
    try {
        const rows = await db.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name=:name",
            { type: QueryTypes.SELECT, replacements: { name: reportModerationMigration } }
        );
        if (!rows.length) throw new Error("missing");
        await db.query(
            "SELECT is_public,moderation_version,reviewed_denunciations,review_decision FROM public.saturation_reports LIMIT 0"
        );
        await db.query(
            "SELECT id,report_id,admin_user_id,admin_name,decision,reason,previous_public,new_public,reviewed_denunciations,moderation_version,created_at FROM public.report_moderation_actions LIMIT 0"
        );
    } catch {
        throw Object.assign(
            new Error(
                "Falta el esquema de revisión de reportes. Ejecuta npm run db:migrate antes de iniciar."
            ),
            { code: "SCHEMA_NOT_READY" }
        );
    }
}
