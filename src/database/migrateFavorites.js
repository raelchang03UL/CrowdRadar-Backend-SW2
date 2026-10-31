import { QueryTypes } from "sequelize";

export const favoritesMigration = "010-user-favorites";

export async function migrateFavorites(sequelize) {
    return sequelize.transaction(async (transaction) => {
        const options = { transaction };
        await sequelize.query("SELECT pg_advisory_xact_lock(310031)", options);
        const history = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name IN (:places, :auth, :recovery, :favorites)",
            {
                ...options,
                replacements: {
                    places: "001-create-places",
                    auth: "002-users-session-version",
                    recovery: "003-password-recovery",
                    favorites: favoritesMigration
                },
                type: QueryTypes.SELECT
            }
        );
        const applied = new Set(history.map(({ name }) => name));
        if (!applied.has("001-create-places") ||
            !applied.has("002-users-session-version") ||
            !applied.has("003-password-recovery")) {
            throw new Error("Aplica 001, 002 y 003 antes de 010-user-favorites.");
        }
        if (applied.has(favoritesMigration)) return false;
        const existing = await sequelize.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'favorites'",
            { ...options, type: QueryTypes.SELECT }
        );
        if (existing.length) throw new Error("Tabla favorites sin historial; revisar su origen sin borrar datos.");
        await sequelize.query(`CREATE TABLE public.favorites (
            user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            place_id INTEGER NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, place_id)
        )`, options);
        await sequelize.query(
            "INSERT INTO public.crowdradar_migrations (name) VALUES (:name)",
            { ...options, replacements: { name: favoritesMigration } }
        );
        return true;
    });
}

export async function assertFavoritesSchemaReady(sequelize) {
    try {
        const applied = await sequelize.query(
            "SELECT name FROM public.crowdradar_migrations WHERE name = :name",
            { replacements: { name: favoritesMigration }, type: QueryTypes.SELECT }
        );
        if (!applied.length) throw new Error("missing");
        await sequelize.query("SELECT user_id, place_id, created_at FROM public.favorites LIMIT 0");
    } catch {
        const error = new Error("Falta el esquema de favoritos. Ejecuta npm run db:migrate antes de iniciar.");
        error.code = "SCHEMA_NOT_READY";
        throw error;
    }
}
