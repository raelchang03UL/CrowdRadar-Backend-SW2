import { QueryTypes } from "sequelize";

export const pushTargetTypesMigration = "012-push-target-types";

export async function migratePushTargetTypes(sequelize) {
    return sequelize.transaction(async (transaction) => {
        const options = { transaction };
        await sequelize.query("SELECT pg_advisory_xact_lock(310031)", options);
        const applied = await sequelize.query("SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { ...options, replacements: { name: pushTargetTypesMigration }, type: QueryTypes.SELECT });
        if (applied.length) return false;
        const prior = await sequelize.query("SELECT name FROM public.crowdradar_migrations WHERE name = '011-saturation-push-alerts'",
            { ...options, type: QueryTypes.SELECT });
        if (!prior.length) throw new Error("Aplicar la migración 011 antes de los tipos de destino push.");
        // Conserva el significado anterior de todas las filas; nunca infiere por longitud o formato.
        await sequelize.query(`ALTER TABLE public.push_device_tokens ADD COLUMN target_type VARCHAR(16) NOT NULL DEFAULT 'fid'
            CONSTRAINT push_device_target_type_check CHECK (target_type IN ('fid', 'fcm-token'))`, options);
        await sequelize.query("INSERT INTO public.crowdradar_migrations (name) VALUES (:name)",
            { ...options, replacements: { name: pushTargetTypesMigration } });
        return true;
    });
}

export async function assertPushTargetTypesSchemaReady(sequelize) {
    try {
        const applied = await sequelize.query("SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { replacements: { name: pushTargetTypesMigration }, type: QueryTypes.SELECT });
        if (!applied.length) throw new Error("missing");
        await sequelize.query("SELECT target_type FROM public.push_device_tokens LIMIT 0");
    } catch {
        throw Object.assign(new Error("Falta el esquema de destinos push. Ejecuta npm run db:migrate antes de iniciar."), { code: "SCHEMA_NOT_READY" });
    }
}
