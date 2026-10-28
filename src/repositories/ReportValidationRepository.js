import { QueryTypes } from "sequelize";
import db from "../config/database.js";
import { invalidSession } from "../utils/passwordPolicy.js";

const publicError = (status, code, message) => Object.assign(new Error(message), { status, code, publicReportError: true });
export default {
    async list(userId, id = null, ownOnly = false) {
        return db.query(`WITH recent AS (
            SELECT r.*,p.nombre FROM public.saturation_reports r
            JOIN public.places p ON p.id=r.place_id
            WHERE p.activo=TRUE AND (:id IS NULL OR r.id=CAST(:id AS BIGINT))
              AND (r.is_public=TRUE OR (:ownOnly = TRUE AND r.user_id=:userId AND :id IS NOT NULL))
            ORDER BY r.created_at DESC,r.id DESC LIMIT 50
        ) SELECT r.id::text, r.place_id AS "placeId", r.nombre AS "placeName", r.level,
            r.created_at AS "createdAt", r.is_public AS "isPublic", (r.user_id = :userId) AS "isOwn",
            COUNT(v.user_id) FILTER (WHERE v.decision = 'CONFIRM') AS confirmations,
            COUNT(v.user_id) FILTER (WHERE v.decision = 'REJECT') AS rejections,
            COALESCE(SUM(v.weight) FILTER (WHERE v.decision = 'CONFIRM'),0) AS "confirmWeight",
            COALESCE(SUM(v.weight) FILTER (WHERE v.decision = 'REJECT'),0) AS "rejectWeight",
            MAX(v.decision) FILTER (WHERE v.user_id = :userId) AS "ownDecision",
            EXISTS(SELECT 1 FROM public.report_denunciations d WHERE d.report_id=r.id AND d.user_id=:userId) AS "alreadyDenounced"
            FROM recent r
            LEFT JOIN public.report_validations v ON v.report_id=r.id
            GROUP BY r.id,r.place_id,r.nombre,r.level,r.created_at,r.user_id,r.is_public
            ORDER BY r.created_at DESC,r.id DESC`,
            { replacements: { userId, id, ownOnly }, type: QueryTypes.SELECT });
    },
    async participate(actor, id, input, kind) {
        return db.transaction(async (transaction) => {
            const options = { transaction, type: QueryTypes.SELECT };
            const [user] = await db.query('SELECT id,status,"sessionVersion",karma_points FROM public.users WHERE id=:userId FOR UPDATE', { ...options, replacements: { userId: actor.id } });
            if (!user || user.status !== "ACTIVO" || user.sessionVersion !== actor.sessionVersion || actor.exp <= Math.floor(Date.now()/1000)) throw invalidSession();
            const [report] = await db.query("SELECT r.user_id FROM public.saturation_reports r JOIN public.places p ON p.id=r.place_id WHERE r.id=:id AND p.activo=TRUE AND r.is_public=TRUE FOR SHARE OF r,p", { ...options, replacements: { id } });
            if (!report) throw publicError(404,"REPORT_NOT_FOUND","El reporte no está disponible.");
            if (report.user_id === actor.id) throw publicError(403,"SELF_PARTICIPATION","No puedes validar ni denunciar tu propio reporte.");
            const replacements = { id, userId: actor.id };
            let sql;
            if (kind === "vote") {
                const karma = Number(user.karma_points);
                if (!Number.isSafeInteger(karma) || karma < 0) throw new Error("Invalid karma");
                Object.assign(replacements, { decision: input.decision, weight: 1+Math.min(Math.floor(karma/10),4) });
                sql = "INSERT INTO public.report_validations(report_id,user_id,decision,weight) VALUES(:id,:userId,:decision,:weight) ON CONFLICT DO NOTHING RETURNING decision";
            } else {
                replacements.reason = input.reason?.trim() || null;
                sql = "INSERT INTO public.report_denunciations(report_id,user_id,reason) VALUES(:id,:userId,:reason) ON CONFLICT DO NOTHING RETURNING report_id::text";
            }
            const rows = await db.query(sql,{ ...options, replacements });
            return rows[0] ?? null;
        });
    }
};
