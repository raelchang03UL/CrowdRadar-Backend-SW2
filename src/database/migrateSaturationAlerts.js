import { QueryTypes } from "sequelize";

export const saturationAlertsMigration = "011-saturation-push-alerts";

export async function migrateSaturationAlerts(sequelize) {
    return sequelize.transaction(async (transaction) => {
        const options = { transaction };
        await sequelize.query("SELECT pg_advisory_xact_lock(310031)", options);
        await sequelize.query(`CREATE TABLE IF NOT EXISTS public.crowdradar_migrations (
            name VARCHAR(100) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, options);
        const applied = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { ...options, replacements: { name: saturationAlertsMigration }, type: QueryTypes.SELECT }
        );
        if (applied.length) return false;
        const existing = await sequelize.query(`SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name IN
            ('push_device_tokens', 'place_saturation', 'push_notification_outbox')`,
        { ...options, type: QueryTypes.SELECT });
        if (existing.length) {
            throw new Error("Esquema de alertas sin historial; revisar su origen sin borrar datos.");
        }
        await sequelize.query(`CREATE TABLE public.push_device_tokens (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            token TEXT NOT NULL UNIQUE,
            registration_id UUID NOT NULL UNIQUE,
            session_version INTEGER NOT NULL CHECK (session_version >= 0),
            session_expires_at TIMESTAMPTZ NOT NULL,
            platform VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (length(token) BETWEEN 20 AND 4096)
        )`, options);
        await sequelize.query(`CREATE TABLE public.place_saturation (
            place_id INTEGER PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
            level VARCHAR(50) NOT NULL CHECK (level IN ('TRANQUILO', 'MODERADO', 'SATURADO', 'SIN_DATOS')),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, options);
        await sequelize.query(`CREATE TABLE public.push_notification_outbox (
            id BIGSERIAL PRIMARY KEY,
            device_token_id BIGINT NOT NULL REFERENCES public.push_device_tokens(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            registration_id UUID NOT NULL,
            place_id INTEGER NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
            previous_level VARCHAR(50) NOT NULL,
            new_level VARCHAR(50) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            locked_at TIMESTAMPTZ,
            sent_at TIMESTAMPTZ,
            attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
            status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
            last_error_code VARCHAR(80)
        )`, options);
        await sequelize.query(`CREATE INDEX push_notification_outbox_pending_idx
            ON public.push_notification_outbox (available_at, id)
            WHERE status = 'PENDING'`, options);
        await sequelize.query(
            "INSERT INTO public.crowdradar_migrations (name) VALUES (:name)",
            { ...options, replacements: { name: saturationAlertsMigration } }
        );
        return true;
    });
}

export async function assertSaturationAlertsSchemaReady(sequelize) {
    try {
        const applied = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { replacements: { name: saturationAlertsMigration }, type: QueryTypes.SELECT }
        );
        if (!applied.length) throw new Error("missing");
        await sequelize.query(`SELECT id, user_id, token, platform, registration_id, session_version, session_expires_at FROM public.push_device_tokens LIMIT 0`);
        await sequelize.query(`SELECT place_id, level FROM public.place_saturation LIMIT 0`);
        await sequelize.query(`SELECT id, device_token_id, user_id, registration_id, place_id, status FROM public.push_notification_outbox LIMIT 0`);
    } catch {
        const error = new Error("Falta el esquema de alertas push. Ejecuta npm run db:migrate antes de iniciar.");
        error.code = "SCHEMA_NOT_READY";
        throw error;
    }
}
