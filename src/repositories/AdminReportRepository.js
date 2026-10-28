import { QueryTypes } from "sequelize";
import db from "../config/database.js";
import { AdministrationError, requireAdministratorSession } from "../domain/administration.js";

const effectiveState = `CASE WHEN NOT r.is_public THEN 'REMOVED'
    WHEN r.review_decision='KEEP' AND r.reviewed_denunciations=d.total THEN 'KEPT' ELSE 'PENDING' END`;
const fields = `r.id::text,r.place_id AS "placeId",p.nombre AS "placeName",r.level,r.created_at AS "createdAt",
    u.id AS "authorId",concat_ws(' ',u.nombre,u.apellido) AS "authorName",u.rol AS "authorRole",
    d.total AS "denunciationCount",r.reviewed_denunciations AS "reviewedDenunciationCount",
    r.is_public AS "isPublic",r.moderation_version AS "moderationVersion",${effectiveState} AS "reviewState"`;
const from = `FROM public.saturation_reports r JOIN public.places p ON p.id=r.place_id
    JOIN public.users u ON u.id=r.user_id
    CROSS JOIN LATERAL (SELECT COUNT(*) AS total FROM public.report_denunciations WHERE report_id=r.id) d`;
const evidence = `,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('reason',g.reason,'count',g.count) ORDER BY g.count DESC,g.reason ASC NULLS LAST),'[]'::jsonb)
        FROM (SELECT NULLIF(btrim(reason),'') AS reason,COUNT(*) AS count FROM public.report_denunciations
            WHERE report_id=r.id GROUP BY 1) g) AS reasons,
    (SELECT COALESCE(jsonb_agg(to_jsonb(h)-'sortId' ORDER BY h."sortId" DESC),'[]'::jsonb) FROM (
        SELECT a.id AS "sortId",a.id::text,a.decision,a.reason,a.admin_user_id AS "adminId",a.admin_name AS "adminName",
            a.created_at AS "createdAt",a.reviewed_denunciations AS "reviewedDenunciationCount",a.moderation_version AS "moderationVersion"
        FROM public.report_moderation_actions a WHERE a.report_id=r.id
            AND (:beforeHistory IS NULL OR a.id<CAST(:beforeHistory AS BIGINT)) ORDER BY a.id DESC LIMIT 21
    ) h) AS history`;
const missing = () =>
    new AdministrationError(
        404,
        "ADMIN_REPORT_NOT_FOUND",
        "El reporte denunciado no está disponible."
    );
const changed = () =>
    new AdministrationError(
        409,
        "REPORT_STATE_CHANGED",
        "El reporte o sus denuncias cambiaron. Actualiza la información antes de decidir."
    );

export function createAdminReportRepository(connection = db) {
    const read = (actor, operation) =>
        connection.transaction(async (transaction) => {
            const options = { transaction, type: QueryTypes.SELECT };
            await connection.query("SET LOCAL statement_timeout='5s'", { transaction });
            const [admin] = await connection.query(
                'SELECT id,rol,status,"sessionVersion" FROM public.users WHERE id=:actorId FOR SHARE',
                {
                    ...options,
                    replacements: { actorId: actor.id }
                }
            );
            requireAdministratorSession(admin, actor);
            return operation(options);
        });
    const detail = async (id, beforeHistory, options) => {
        const [row] = await connection.query(
            `SELECT ${fields}${evidence} ${from} WHERE r.id=:id AND d.total>0`,
            {
                ...options,
                replacements: { id, beforeHistory }
            }
        );
        return row ?? null;
    };
    return {
        list(actor, { state, authorId, before }) {
            return read(actor, (options) =>
                connection.query(
                    `SELECT ${fields} ${from} WHERE d.total>0
                AND (:state = 'ALL' OR ${effectiveState}=:state) AND (:authorId IS NULL OR r.user_id=:authorId)
                AND (:before IS NULL OR r.id<CAST(:before AS BIGINT)) ORDER BY r.id DESC LIMIT 21`,
                    {
                        ...options,
                        replacements: { state, authorId, before }
                    }
                )
            );
        },
        detail(actor, id, beforeHistory) {
            return read(actor, (options) => detail(id, beforeHistory, options));
        },
        decide(actor, id, input) {
            return connection.transaction(async (transaction) => {
                const options = { transaction, type: QueryTypes.SELECT };
                await connection.query("SET LOCAL statement_timeout='5s'", { transaction });
                const [initial] = await connection.query(
                    "SELECT user_id FROM public.saturation_reports WHERE id=:id",
                    {
                        ...options,
                        replacements: { id }
                    }
                );
                if (!initial) throw missing();
                // Todas las rutas bloquean usuarios antes que reportes; orden de ID estable.
                const users = await connection.query(
                    'SELECT id,nombre,apellido,rol,status,"sessionVersion" FROM public.users WHERE id IN (:actorId,:authorId) ORDER BY id FOR SHARE',
                    {
                        ...options,
                        replacements: { actorId: actor.id, authorId: initial.user_id }
                    }
                );
                const admin = users.find((u) => u.id === actor.id),
                    author = users.find((u) => u.id === initial.user_id);
                requireAdministratorSession(admin, actor);
                if (author?.rol !== "USUARIO")
                    throw new AdministrationError(
                        403,
                        "MODERATION_CITIZEN_ONLY",
                        "Solo puedes moderar reportes de cuentas ciudadanas."
                    );
                const [report] = await connection.query(
                    "SELECT user_id,is_public,review_decision,moderation_version,reviewed_denunciations FROM public.saturation_reports WHERE id=:id FOR UPDATE",
                    {
                        ...options,
                        replacements: { id }
                    }
                );
                if (!report || report.user_id !== initial.user_id) throw changed();
                const [{ total }] = await connection.query(
                    "SELECT COUNT(*) AS total FROM public.report_denunciations WHERE report_id=:id",
                    {
                        ...options,
                        replacements: { id }
                    }
                );
                const count = Number(total);
                if (
                    !report.is_public ||
                    count < 1 ||
                    report.moderation_version !== input.expectedVersion ||
                    count !== input.expectedDenunciationCount ||
                    (input.decision === "KEEP" &&
                        report.review_decision === "KEEP" &&
                        report.reviewed_denunciations === count)
                )
                    throw changed();
                if (report.moderation_version >= 2147483647)
                    throw new Error("Moderation revision exhausted");
                const isPublic = input.decision === "KEEP",
                    version = report.moderation_version + 1;
                await connection.query(
                    `UPDATE public.saturation_reports SET is_public=:isPublic,review_decision=:decision,
                    moderation_version=:version,reviewed_denunciations=:count WHERE id=:id`,
                    {
                        transaction,
                        replacements: { id, isPublic, decision: input.decision, version, count }
                    }
                );
                await connection.query(
                    `INSERT INTO public.report_moderation_actions(report_id,admin_user_id,admin_name,decision,reason,previous_public,new_public,reviewed_denunciations,moderation_version)
                    VALUES(:id,:adminId,:adminName,:decision,:reason,TRUE,:isPublic,:count,:version)`,
                    {
                        transaction,
                        replacements: {
                            id,
                            adminId: actor.id,
                            adminName:
                                `${admin.nombre ?? ""} ${admin.apellido ?? ""}`.trim() ||
                                `Administrador #${actor.id}`,
                            decision: input.decision,
                            reason: input.reason,
                            isPublic,
                            count,
                            version
                        }
                    }
                );
                return detail(id, null, options);
            });
        }
    };
}
export default createAdminReportRepository();
