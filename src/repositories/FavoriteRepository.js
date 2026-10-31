import SaturationQueryRepository from "./SaturationQueryRepository.js";
import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

const select = (sql, options = {}) => sequelize.query(sql, { ...options, type: QueryTypes.SELECT });

export default {
    async remove(userId, placeId) {
        await sequelize.transaction(async (transaction) => {
            await select("SELECT id FROM public.places WHERE id = :placeId FOR UPDATE", { transaction, replacements: { placeId } });
            // Un evento anterior no reaparece al quitar y volver a marcar un lugar.
            await sequelize.query(`DELETE FROM public.push_notification_outbox WHERE user_id = :userId AND place_id = :placeId AND status = 'PENDING'`, { transaction, replacements: { userId, placeId } });
            await sequelize.query(`DELETE FROM public.favorites WHERE user_id = :userId AND place_id = :placeId`, { transaction, replacements: { userId, placeId }, type: QueryTypes.DELETE });
        });
    },
    async findPlaceIdsByUser(userId) {
        const rows = await select(
            "SELECT place_id FROM public.favorites WHERE user_id = :userId",
            { replacements: { userId } }
        );
        return rows.map(({ place_id }) => place_id);
    },

    async findActivePlacesByUser(userId) {
        return select(`SELECT p.id, p.nombre, p.categoria, p.referencia, p.direccion, p.latitud, p.longitud,
                p.demostrativo, TRUE AS "esFavorito"
            FROM public.favorites f
            JOIN public.places p ON p.id = f.place_id
            WHERE f.user_id = :userId AND p.activo = TRUE
            ORDER BY f.created_at DESC, p.id ASC`,
        { replacements: { userId } });
    },

    async add(userId, placeId, evaluate) {
        return sequelize.transaction(async (transaction) => {
            const options = { transaction, replacements: { userId, placeId } };
            const places = await select("SELECT id FROM public.places WHERE id = :placeId AND activo = TRUE FOR UPDATE", options);
            if (!places.length) return "notFound";
            const [{ hadFavorites }] = await select(`SELECT EXISTS (SELECT 1 FROM public.favorites WHERE place_id = :placeId) AS "hadFavorites"`, options);
            const inserted = await select(`INSERT INTO public.favorites (user_id, place_id) VALUES (:userId, :placeId)
                ON CONFLICT (user_id, place_id) DO NOTHING RETURNING place_id`, options);
            if (!inserted.length) return "exists";
            // Captura el cálculo real al marcar: el primer tick posterior no pierde la primera transición.
            const snapshot = await SaturationQueryRepository.findActiveSnapshot(placeId, { transaction });
            const level = evaluate(snapshot).level ?? "SIN_DATOS";
            await sequelize.query(`INSERT INTO public.place_saturation (place_id, level) VALUES (:placeId, :level)
                ON CONFLICT (place_id) DO UPDATE SET level = EXCLUDED.level, updated_at = CURRENT_TIMESTAMP
                WHERE :hadFavorites = FALSE`, { transaction, replacements: { placeId, level, hadFavorites } });
            return "added";
        });
    }
};
