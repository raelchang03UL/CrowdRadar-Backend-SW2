import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

const select = (sql, options = {}) => sequelize.query(sql, { ...options, type: QueryTypes.SELECT });

export default {
    async findPlaceIdsByUser(userId) {
        const rows = await select(
            "SELECT place_id FROM public.favorites WHERE user_id = :userId",
            { replacements: { userId } }
        );
        return rows.map(({ place_id }) => place_id);
    },

    async findActivePlacesByUser(userId) {
        return select(`SELECT p.id, p.nombre, p.categoria, p.referencia, p.latitud, p.longitud,
                p.demostrativo, TRUE AS "esFavorito"
            FROM public.favorites f
            JOIN public.places p ON p.id = f.place_id
            WHERE f.user_id = :userId AND p.activo = TRUE
            ORDER BY f.created_at DESC, p.id ASC`,
        { replacements: { userId } });
    },

    async add(userId, placeId) {
        const inserted = await select(`INSERT INTO public.favorites (user_id, place_id)
            SELECT :userId, p.id FROM public.places p
            WHERE p.id = :placeId AND p.activo = TRUE
            ON CONFLICT (user_id, place_id) DO NOTHING
            RETURNING place_id`,
        { replacements: { userId, placeId } });
        if (inserted.length) return "added";
        const places = await select(
            "SELECT id FROM public.places WHERE id = :placeId AND activo = TRUE",
            { replacements: { placeId } }
        );
        return places.length ? "exists" : "notFound";
    }
};
