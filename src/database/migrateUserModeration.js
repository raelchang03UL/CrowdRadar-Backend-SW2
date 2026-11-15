import { QueryTypes } from "sequelize";

export const userModerationMigration = "008-user-moderation";
export async function migrateUserModeration(db) {
    return db.transaction(async (transaction) => {
        const options = { transaction };
        await db.query("SELECT pg_advisory_xact_lock(310031)", options);
        const history = await db.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name IN (:previous,:current)",
            {
                ...options,
                type: QueryTypes.SELECT,
                replacements: {
                    previous: "007-report-validation",
                    current: userModerationMigration
                }
            }
        );
        if (!history.some((r) => r.name === "007-report-validation"))
            throw new Error("Aplica 007 antes de 008-user-moderation.");
        if (history.some((r) => r.name === userModerationMigration)) return false;
        // No adoptar una tabla/columna sin procedencia; DDL e historial son atómicos.
        await db.query(
            "ALTER TABLE public.users ADD COLUMN moderation_version INTEGER NOT NULL DEFAULT 0 CHECK (moderation_version >= 0)",
            options
        );
        await db.query(
            `CREATE TABLE public.user_moderation_actions (
            id BIGSERIAL PRIMARY KEY,
            target_user_id INTEGER NOT NULL REFERENCES public.users(id),
            admin_user_id INTEGER NOT NULL REFERENCES public.users(id),
            admin_name VARCHAR(511) NOT NULL,
            action VARCHAR(10) NOT NULL CHECK (action IN ('SUSPEND','REACTIVATE')),
            reason VARCHAR(500),
            previous_status VARCHAR(10) NOT NULL,
            new_status VARCHAR(10) NOT NULL,
            moderation_version INTEGER NOT NULL CHECK (moderation_version > 0),
            created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
            UNIQUE(target_user_id,moderation_version),
            CHECK (target_user_id <> admin_user_id),
            CHECK (reason IS NULL OR length(trim(reason)) > 0),
            CHECK ((action='SUSPEND' AND previous_status='ACTIVO' AND new_status='SUSPENDIDO' AND reason IS NOT NULL)
                OR (action='REACTIVATE' AND previous_status='SUSPENDIDO' AND new_status='ACTIVO'))
        )`,
            options
        );
        await db.query(
            "CREATE INDEX user_moderation_actions_user_id_desc ON public.user_moderation_actions(target_user_id,id DESC)",
            options
        );
        await db.query("INSERT INTO public.crowdradar_migrations(name) VALUES(:name)", {
            ...options,
            replacements: { name: userModerationMigration }
        });
        return true;
    });
}

export async function assertUserModerationSchemaReady(db) {
    try {
        const rows = await db.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name=:name",
            {
                replacements: { name: userModerationMigration },
                type: QueryTypes.SELECT
            }
        );
        if (!rows.length) throw new Error("missing");
        await db.query("SELECT moderation_version FROM public.users LIMIT 0");
        await db.query(
            "SELECT id,target_user_id,admin_user_id,admin_name,action,reason,previous_status,new_status,moderation_version,created_at FROM public.user_moderation_actions LIMIT 0"
        );
    } catch {
        throw Object.assign(
            new Error(
                "Falta el esquema de moderación. Ejecuta npm run db:migrate antes de iniciar."
            ),
            { code: "SCHEMA_NOT_READY" }
        );
    }
}
