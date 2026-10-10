import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import { saturationReportResults } from "../domain/saturationReport.js";

class SaturationReportRepository {
    async create({ userId, placeId, level, cooldownMinutes }) {
        return sequelize.transaction(async (transaction) => {
            const options = { transaction };
            await sequelize.query(
                "SELECT pg_advisory_xact_lock(hashtext(:lockKey))",
                {
                    ...options,
                    replacements: { lockKey: `saturation-report:${userId}:${placeId}` }
                }
            );
            const places = await sequelize.query(
                "SELECT id FROM public.places WHERE id = :placeId AND activo = TRUE",
                { ...options, replacements: { placeId }, type: QueryTypes.SELECT }
            );
            if (!places.length) return { kind: saturationReportResults.placeNotFound };
            const recent = await sequelize.query(
                `SELECT created_at FROM public.saturation_reports
                 WHERE user_id = :userId AND place_id = :placeId
                 ORDER BY created_at DESC LIMIT 1`,
                { ...options, replacements: { userId, placeId }, type: QueryTypes.SELECT }
            );
            if (recent.length) {
                const elapsed = Date.now() - new Date(recent[0].created_at).getTime();
                if (elapsed < cooldownMinutes * 60 * 1000) {
                    return { kind: saturationReportResults.cooldown };
                }
            }
            const [created] = await sequelize.query(
                `INSERT INTO public.saturation_reports (user_id, place_id, level)
                 VALUES (:userId, :placeId, :level)
                 RETURNING id, user_id, place_id, level, created_at`,
                { ...options, replacements: { userId, placeId, level }, type: QueryTypes.SELECT }
            );
            return { kind: saturationReportResults.created, report: created };
        });
    }
}

export default new SaturationReportRepository();
