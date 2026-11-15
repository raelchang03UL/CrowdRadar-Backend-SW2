import { QueryTypes } from "sequelize";

export const placeDetailsMigration = "004-places-direccion";

// Readiness solo de lectura: nunca adopta ni modifica un esquema al arrancar.
export async function assertPlaceDetailsSchemaReady(sequelize) {
    try {
        const applied = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { replacements: { name: placeDetailsMigration }, type: QueryTypes.SELECT }
        );
        if (!applied.length) throw new Error("missing");
        await sequelize.query("SELECT direccion FROM public.places LIMIT 0");
    } catch {
        const error = new Error("Falta el esquema de detalle de lugares. Ejecuta npm run db:migrate antes de iniciar.");
        error.code = "SCHEMA_NOT_READY";
        throw error;
    }
}

// Migración aditiva: conserva el catálogo y no inventa direcciones antiguas.
export async function migratePlaceDetails(sequelize) {
    return sequelize.transaction(async (transaction) => {
        const options = { transaction };
        await sequelize.query("SELECT pg_advisory_xact_lock(310031)", options);
        const applied = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { ...options, replacements: { name: placeDetailsMigration }, type: QueryTypes.SELECT }
        );
        if (applied.length) return false;
        await sequelize.query(`ALTER TABLE public.places ADD COLUMN direccion VARCHAR(250)
            CHECK (direccion IS NULL OR length(trim(direccion)) > 0)`, options);
        await sequelize.query(
            "INSERT INTO public.crowdradar_migrations (name) VALUES (:name)",
            { ...options, replacements: { name: placeDetailsMigration } }
        );
        return true;
    });
}
