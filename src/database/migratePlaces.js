import { QueryTypes } from "sequelize";

export const placesMigration = "001-create-places";

export async function migratePlaces(sequelize) {
    return sequelize.transaction(async (transaction) => {
        const options = { transaction };
        // Serializa migraciones explícitas concurrentes; DDL e historial se confirman juntos.
        await sequelize.query("SELECT pg_advisory_xact_lock(310031)", options);
        await sequelize.query(`CREATE TABLE IF NOT EXISTS public.crowdradar_migrations (
            name VARCHAR(100) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, options);
        const applied = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { ...options, replacements: { name: placesMigration }, type: QueryTypes.SELECT }
        );
        if (applied.length) return false;
        // Sin IF NOT EXISTS: no adoptar silenciosamente una tabla ajena.
        await sequelize.query(`CREATE TABLE public.places (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(160) NOT NULL CHECK (length(trim(nombre)) > 0),
            categoria VARCHAR(80) NOT NULL CHECK (length(trim(categoria)) > 0),
            referencia VARCHAR(250),
            latitud DOUBLE PRECISION NOT NULL CHECK (latitud BETWEEN -90 AND 90),
            longitud DOUBLE PRECISION NOT NULL CHECK (longitud BETWEEN -180 AND 180),
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            demostrativo BOOLEAN NOT NULL DEFAULT FALSE
        )`, options);
        await sequelize.query(
            "INSERT INTO public.crowdradar_migrations (name) VALUES (:name)",
            { ...options, replacements: { name: placesMigration } }
        );
        return true;
    });
}
