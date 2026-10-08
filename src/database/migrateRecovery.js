import { QueryTypes } from "sequelize";

export const recoveryMigration = "003-password-recovery";

export async function migrateRecovery(sequelize) {
    return sequelize.transaction(async (transaction) => {
        const options = { transaction };
        await sequelize.query("SELECT pg_advisory_xact_lock(310031)", options);
        const history = await sequelize.query("SELECT name FROM public.crowdradar_migrations WHERE name IN (:auth, :recovery)",
            { ...options, replacements: { auth: "002-users-session-version", recovery: recoveryMigration }, type: QueryTypes.SELECT });
        if (!history.some(({ name }) => name === "002-users-session-version")) throw new Error("Aplica 002 antes de 003-password-recovery.");
        if (history.some(({ name }) => name === recoveryMigration)) return false;
        const existing = await sequelize.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
            AND table_name IN ('password_reset_tokens', 'password_recovery_limits')`, { ...options, type: QueryTypes.SELECT });
        if (existing.length) throw new Error("Esquema de recuperación sin historial; revisar su origen sin borrar datos.");
        await sequelize.query(`CREATE TABLE public.password_reset_tokens (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES public.users(id),
            token_hash CHAR(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
            expires_at TIMESTAMPTZ NOT NULL,
            consumed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (expires_at > created_at)
        )`, options);
        await sequelize.query(`CREATE UNIQUE INDEX password_reset_one_unused_per_user
            ON public.password_reset_tokens (user_id) WHERE consumed_at IS NULL`, options);
        await sequelize.query(`CREATE TABLE public.password_recovery_limits (
            key_hash CHAR(64) PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),
            bucket_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            attempts INTEGER NOT NULL CHECK (attempts > 0)
        )`, options);
        await sequelize.query("INSERT INTO public.crowdradar_migrations (name) VALUES (:name)",
            { ...options, replacements: { name: recoveryMigration } });
        return true;
    });
}

export async function assertRecoverySchemaReady(sequelize) {
    try {
        const applied = await sequelize.query("SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { replacements: { name: recoveryMigration }, type: QueryTypes.SELECT });
        if (!applied.length) throw new Error("missing");
        await sequelize.query("SELECT token_hash, expires_at, consumed_at FROM public.password_reset_tokens LIMIT 0");
        await sequelize.query("SELECT key_hash, bucket_start, attempts FROM public.password_recovery_limits LIMIT 0");
    } catch {
        const error = new Error("Falta el esquema de recuperación. Ejecuta npm run db:migrate antes de iniciar.");
        error.code = "SCHEMA_NOT_READY";
        throw error;
    }
}
