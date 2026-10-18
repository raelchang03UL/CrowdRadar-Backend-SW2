import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import { invalidSession } from "../utils/passwordPolicy.js";

export const createSaturationReportRepository = (db = sequelize) => ({
    async create({ userId, sessionVersion, expiresAt, placeId, level, cooldownMinutes, points }) {
        return db.transaction(async (transaction) => {
            const options = { transaction, type: QueryTypes.SELECT };
            // Mismo orden que cambio/reset: bloquear usuario antes de cambiar sus datos.
            const [user] = await db.query(
                'SELECT id, status, "sessionVersion" FROM public.users WHERE id = :userId FOR UPDATE',
                { ...options, replacements: { userId } }
            );
            if (!user || user.status !== "ACTIVO" || user.sessionVersion !== sessionVersion ||
                (expiresAt !== undefined && expiresAt <= Math.floor(Date.now() / 1000))) throw invalidSession();
            await db.query("SELECT pg_advisory_xact_lock(hashtext(:lockKey))", {
                ...options, replacements: { lockKey: `saturation-report:${userId}:${placeId}` }
            });
            const places = await db.query("SELECT id FROM public.places WHERE id = :placeId AND activo = TRUE FOR KEY SHARE",
                { ...options, replacements: { placeId } });
            if (!places.length) return { kind: "PLACE_NOT_FOUND" };
            const recent = await db.query(`SELECT id FROM public.saturation_reports
                WHERE user_id = :userId AND place_id = :placeId
                AND created_at >= clock_timestamp() - make_interval(mins => :cooldownMinutes)
                LIMIT 1`, { ...options, replacements: { userId, placeId, cooldownMinutes } });
            if (recent.length) return { kind: "REPORT_COOLDOWN" };
            const [report] = await db.query(`INSERT INTO public.saturation_reports (user_id, place_id, level, created_at)
                VALUES (:userId, :placeId, :level, clock_timestamp())
                RETURNING id, user_id, place_id, level, created_at`,
                { ...options, replacements: { userId, placeId, level } });
            await db.query(`INSERT INTO public.report_karma_awards (report_id, user_id, points)
                VALUES (:reportId, :userId, :points)`,
                { ...options, replacements: { reportId: report.id, userId, points } });
            const [total] = await db.query(`UPDATE public.users SET karma_points = karma_points + :points
                WHERE id = :userId RETURNING karma_points`,
                { ...options, replacements: { userId, points } });
            const karmaPoints = Number(total.karma_points);
            if (!Number.isSafeInteger(karmaPoints) || karmaPoints < 0) throw new Error("Invalid karma total");
            return { kind: "CREATED", report: { ...report, pointsAwarded: points, karmaPoints } };
        });
    }
});
export default createSaturationReportRepository();
