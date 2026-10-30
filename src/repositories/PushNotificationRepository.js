import { QueryTypes } from "sequelize";
import { randomUUID } from "node:crypto";
import sequelize from "../config/database.js";
import SaturationQueryRepository from "./SaturationQueryRepository.js";
const select = (sql, options = {}) => sequelize.query(sql, { ...options, type: QueryTypes.SELECT });
const eligible = `d.registration_id = o.registration_id AND d.user_id = o.user_id
    AND u.status = 'ACTIVO' AND u."sessionVersion" = d.session_version
    AND d.session_expires_at > CURRENT_TIMESTAMP AND p.activo = TRUE
    AND EXISTS (SELECT 1 FROM public.favorites f WHERE f.user_id = o.user_id AND f.place_id = o.place_id)`;
export default {
    async registerDevice({ userId, token, platform, sessionVersion, expiresAt }) {
        return sequelize.transaction(async (transaction) => {
            const registrationId = randomUUID();
            // Serializa las transferencias del mismo token sin depender de que la fila exista.
            await sequelize.query("SELECT pg_advisory_xact_lock(hashtextextended(:token, 81003))", { transaction, replacements: { token } });
            const valid = await select(`SELECT id FROM public.users WHERE id = :userId
                AND status = 'ACTIVO' AND "sessionVersion" = :sessionVersion
                AND to_timestamp(:expiresAt) > CURRENT_TIMESTAMP FOR SHARE`,
            { transaction, replacements: { userId, sessionVersion, expiresAt } });
            if (!valid.length) throw Object.assign(new Error("La sesión ya no está vigente."), { code: "SESSION_INVALID", status: 401 });
            await sequelize.query(`DELETE FROM public.push_notification_outbox WHERE device_token_id IN
                (SELECT id FROM public.push_device_tokens WHERE token = :token)`, { transaction, replacements: { token } });
            await sequelize.query(`INSERT INTO public.push_device_tokens
                (user_id, token, platform, registration_id, session_version, session_expires_at)
                VALUES (:userId, :token, :platform, :registrationId, :sessionVersion, to_timestamp(:expiresAt))
                ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform,
                    registration_id = EXCLUDED.registration_id, session_version = EXCLUDED.session_version,
                    session_expires_at = EXCLUDED.session_expires_at, updated_at = CURRENT_TIMESTAMP`,
            { transaction, replacements: { userId, token, platform, registrationId, sessionVersion, expiresAt } });
            return registrationId;
        });
    },
    async removeDevice({ userId, token, registrationId = null, sessionVersion, expiresAt }) {
        await sequelize.query(`DELETE FROM public.push_device_tokens WHERE user_id = :userId AND token = :token
            AND session_version = :sessionVersion AND session_expires_at = to_timestamp(:expiresAt)
            AND (:registrationId IS NULL OR registration_id = CAST(:registrationId AS uuid))`,
        { replacements: { userId, token, registrationId, sessionVersion, expiresAt } });
    },
    async findReconciliationIds(afterId = -2147483649, limit = 200) {
        const rows = await select(`SELECT p.id FROM public.places p WHERE p.activo = TRUE AND p.id > :afterId
            AND EXISTS (SELECT 1 FROM public.favorites f WHERE f.place_id = p.id)
            ORDER BY p.id LIMIT :limit`, { replacements: { afterId, limit } });
        return rows.map(({ id }) => id);
    },
    async reconcilePlace({ placeId, evaluate }) {
        return sequelize.transaction(async (transaction) => {
            const options = { transaction, replacements: { placeId } };
            const places = await select(`SELECT id FROM public.places WHERE id = :placeId AND activo = TRUE FOR UPDATE`, options);
            if (!places.length) return { kind: "PLACE_NOT_FOUND" };
            const snapshot = await SaturationQueryRepository.findActiveSnapshot(placeId, { transaction });
            const level = evaluate(snapshot).level ?? "SIN_DATOS";
            const existing = await select(`SELECT level FROM public.place_saturation WHERE place_id = :placeId FOR UPDATE`, options);
            if (!existing.length) {
                await sequelize.query(`INSERT INTO public.place_saturation (place_id, level) VALUES (:placeId, :level)`,
                    { transaction, replacements: { placeId, level } });
                return { kind: "INITIALIZED", level };
            }
            const previousLevel = existing[0].level;
            if (previousLevel === level) return { kind: "UNCHANGED", level };
            await sequelize.query(`UPDATE public.place_saturation SET level = :level, updated_at = CURRENT_TIMESTAMP WHERE place_id = :placeId`,
                { transaction, replacements: { placeId, level } });
            await sequelize.query(`INSERT INTO public.push_notification_outbox
                (device_token_id, user_id, registration_id, place_id, previous_level, new_level)
                SELECT d.id, d.user_id, d.registration_id, :placeId, :previousLevel, :level
                FROM public.favorites f JOIN public.push_device_tokens d ON d.user_id = f.user_id
                JOIN public.users u ON u.id = d.user_id
                WHERE f.place_id = :placeId AND u.status = 'ACTIVO'
                    AND u."sessionVersion" = d.session_version AND d.session_expires_at > CURRENT_TIMESTAMP`,
            { transaction, replacements: { placeId, previousLevel, level } });
            return { kind: "CHANGED", previousLevel, level };
        });
    },
    async claimPending(limit = 50) {
        return sequelize.transaction(async (transaction) => {
            await sequelize.query(`UPDATE public.push_notification_outbox SET status = 'FAILED', locked_at = NULL,
                last_error_code = 'RETRIES_EXHAUSTED' WHERE status = 'PENDING' AND attempts >= 5
                AND (locked_at IS NULL OR locked_at < CURRENT_TIMESTAMP - INTERVAL '2 minutes')`, { transaction });
            const rows = await select(`SELECT o.id, o.device_token_id AS "deviceTokenId", o.user_id AS "userId",
                    o.registration_id AS "registrationId", d.session_version AS "sessionVersion",
                    o.place_id AS "placeId", o.previous_level AS "previousLevel", o.new_level AS "newLevel", d.token,
                    d.platform, o.attempts + 1 AS attempts
                FROM public.push_notification_outbox o JOIN public.push_device_tokens d ON d.id = o.device_token_id
                JOIN public.users u ON u.id = o.user_id JOIN public.places p ON p.id = o.place_id
                WHERE o.status = 'PENDING' AND o.attempts < 5 AND o.available_at <= CURRENT_TIMESTAMP
                    AND (o.locked_at IS NULL OR o.locked_at < CURRENT_TIMESTAMP - INTERVAL '2 minutes') AND ${eligible}
                ORDER BY o.id LIMIT :limit FOR UPDATE OF o SKIP LOCKED`, { transaction, replacements: { limit } });
            if (!rows.length) return [];
            await sequelize.query(`UPDATE public.push_notification_outbox SET locked_at = CURRENT_TIMESTAMP,
                attempts = attempts + 1 WHERE id IN (:ids)`, { transaction, replacements: { ids: rows.map(({ id }) => id) } });
            return rows;
        });
    },
    async isEligible(notification) {
        const rows = await select(`SELECT o.id FROM public.push_notification_outbox o
            JOIN public.push_device_tokens d ON d.id = o.device_token_id JOIN public.users u ON u.id = o.user_id
            JOIN public.places p ON p.id = o.place_id WHERE o.id = :id AND o.status = 'PENDING'
            AND o.attempts = :attempts AND d.token = :token AND o.registration_id = :registrationId AND ${eligible}`,
        { replacements: notification });
        return rows.length === 1;
    },
    async markDelivered(id, attempts) {
        await sequelize.query(`UPDATE public.push_notification_outbox SET status = 'SENT', sent_at = CURRENT_TIMESTAMP,
            locked_at = NULL, last_error_code = NULL WHERE id = :id AND status = 'PENDING' AND attempts = :attempts`,
        { replacements: { id, attempts } });
    },
    async markFailed(id, attempts, errorCode) {
        await sequelize.query(`UPDATE public.push_notification_outbox
            SET status = CASE WHEN :attempts >= 5 THEN 'FAILED' ELSE 'PENDING' END,
                available_at = CURRENT_TIMESTAMP + (LEAST(300, POWER(2, :attempts)) * INTERVAL '1 second'),
                locked_at = NULL, last_error_code = :errorCode
            WHERE id = :id AND status = 'PENDING' AND attempts = :attempts`,
        { replacements: { id, attempts, errorCode } });
    },
    async removeDeviceById(id, registrationId) {
        await sequelize.query(`DELETE FROM public.push_device_tokens WHERE id = :id AND registration_id = :registrationId`,
            { replacements: { id, registrationId } });
    }
};
