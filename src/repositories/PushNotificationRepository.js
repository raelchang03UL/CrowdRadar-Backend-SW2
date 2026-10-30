import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

const select = (sql, options = {}) =>
    sequelize.query(sql, { ...options, type: QueryTypes.SELECT });

export default {
    async registerDevice({ userId, token, platform }) {
        const rows = await select(`INSERT INTO public.push_device_tokens (user_id, token, platform)
            VALUES (:userId, :token, :platform)
            ON CONFLICT (token) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                platform = EXCLUDED.platform,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id`,
        { replacements: { userId, token, platform } });
        return rows[0].id;
    },

    async removeDevice({ userId, token }) {
        await sequelize.query(`DELETE FROM public.push_device_tokens
            WHERE user_id = :userId AND token = :token`,
        { replacements: { userId, token } });
    },

    async applySaturation({ placeId, level }) {
        return sequelize.transaction(async (transaction) => {
            const options = { transaction, replacements: { placeId } };
            const places = await select(`SELECT id FROM public.places
                WHERE id = :placeId AND activo = TRUE FOR UPDATE`, options);
            if (!places.length) return { kind: "PLACE_NOT_FOUND" };
            const existing = await select(`SELECT level FROM public.place_saturation
                WHERE place_id = :placeId FOR UPDATE`, options);
            if (!existing.length) {
                await sequelize.query(`INSERT INTO public.place_saturation (place_id, level)
                    VALUES (:placeId, :level)`,
                { ...options, replacements: { placeId, level } });
                return { kind: "INITIALIZED" };
            }
            const previousLevel = existing[0].level;
            if (previousLevel === level) return { kind: "UNCHANGED" };
            await sequelize.query(`UPDATE public.place_saturation
                SET level = :level, updated_at = CURRENT_TIMESTAMP WHERE place_id = :placeId`,
            { ...options, replacements: { placeId, level } });
            await sequelize.query(`INSERT INTO public.push_notification_outbox
                (device_token_id, place_id, previous_level, new_level)
                SELECT DISTINCT d.id, :placeId, :previousLevel, :level
                FROM public.favorites f
                JOIN public.push_device_tokens d ON d.user_id = f.user_id
                WHERE f.place_id = :placeId`,
            { ...options, replacements: { placeId, previousLevel, level } });
            return { kind: "CHANGED", previousLevel };
        });
    },

    async claimPending(limit = 50) {
        return sequelize.transaction(async (transaction) => {
            const rows = await select(`SELECT o.id, o.device_token_id AS "deviceTokenId",
                    o.place_id AS "placeId", o.previous_level AS "previousLevel",
                    o.new_level AS "newLevel", d.token, p.nombre AS "placeName",
                    o.attempts + 1 AS attempts
                FROM public.push_notification_outbox o
                JOIN public.push_device_tokens d ON d.id = o.device_token_id
                JOIN public.places p ON p.id = o.place_id
                WHERE o.status = 'PENDING' AND o.available_at <= CURRENT_TIMESTAMP
                    AND (o.locked_at IS NULL OR o.locked_at < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
                ORDER BY o.id
                LIMIT :limit
                FOR UPDATE OF o SKIP LOCKED`,
            { transaction, replacements: { limit } });
            if (!rows.length) return [];
            await sequelize.query(`UPDATE public.push_notification_outbox
                SET locked_at = CURRENT_TIMESTAMP, attempts = attempts + 1
                WHERE id IN (:ids)`,
            { transaction, replacements: { ids: rows.map(({ id }) => id) } });
            return rows;
        });
    },

    async markDelivered(id) {
        await sequelize.query(`UPDATE public.push_notification_outbox
            SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, locked_at = NULL,
                last_error_code = NULL
            WHERE id = :id AND status = 'PENDING'`,
        { replacements: { id } });
    },

    async markFailed(id, attempts, errorCode) {
        await sequelize.query(`UPDATE public.push_notification_outbox
            SET status = CASE WHEN :attempts >= 5 THEN 'FAILED' ELSE 'PENDING' END,
                available_at = CURRENT_TIMESTAMP +
                    (LEAST(300, POWER(2, :attempts)) * INTERVAL '1 second'),
                locked_at = NULL, last_error_code = :errorCode
            WHERE id = :id AND status = 'PENDING'`,
        { replacements: { id, attempts, errorCode } });
    },

    async removeDeviceById(id) {
        await sequelize.query("DELETE FROM public.push_device_tokens WHERE id = :id",
            { replacements: { id } });
    }
};
