import { QueryTypes } from "sequelize";
import db from "../config/database.js";
import { AdministrationError, requireAdministratorSession } from "../domain/administration.js";

const fields = `u.id,u.nombre,u.apellido,u.email,u.rol,u.status,u.moderation_version AS "moderationVersion",
    (SELECT COUNT(*) FROM public.saturation_reports r
        WHERE r.user_id=u.id AND EXISTS (
            SELECT 1 FROM public.report_denunciations d WHERE d.report_id=r.id
        )) AS "denouncedReportCount"`;

export const literalUserPattern = (query) => `%${query.replace(/[\\%_]/g, "\\$&")}%`;

export function createAdminUserRepository(connection = db) {
    // La comprobación y la lectura comparten transacción. Un cambio concurrente de
    // rol/estado debe esperar el lock; no basta el rol leído antes en middleware.
    const readAsAdministrator = (actor, read) => connection.transaction(async (transaction) => {
        const options = { transaction, type: QueryTypes.SELECT };
        await connection.query("SET LOCAL statement_timeout = '5s'", { transaction });
        const [current] = await connection.query(
            'SELECT id,rol,status,"sessionVersion" FROM public.users WHERE id=:actorId FOR SHARE',
            { ...options, replacements: { actorId: actor.id } }
        );
        requireAdministratorSession(current, actor);
        return read(options);
    });

    return {
        list(actor, { q, status, page, limit }) {
            return readAsAdministrator(actor, (options) => connection.query(
                `SELECT ${fields} FROM public.users u
                 WHERE (:q = '' OR concat_ws(' ',u.nombre,u.apellido) ILIKE :pattern OR u.email ILIKE :pattern)
                   AND (:status = '' OR u.status = :status)
                 ORDER BY u.id ASC LIMIT :take OFFSET :offset`,
                { ...options, replacements: { q, pattern: literalUserPattern(q), status, take: limit + 1, offset: (page - 1) * limit } }
            ));
        },
        history(actor, id, before) {
            return readAsAdministrator(actor, async options => {
                const [exists] = await connection.query("SELECT id FROM public.users WHERE id=:id", { ...options, replacements: { id } });
                if (!exists) throw new AdministrationError(404, "USER_NOT_FOUND", "No encontramos ese usuario.");
                return connection.query(`SELECT id::text, action,reason,previous_status AS "previousStatus",new_status AS "newStatus",
                    created_at AS "createdAt",admin_user_id AS "adminId",admin_name AS "adminName",moderation_version AS "moderationVersion"
                    FROM public.user_moderation_actions WHERE target_user_id=:id
                    AND (:before IS NULL OR id<CAST(:before AS BIGINT)) ORDER BY user_moderation_actions.id DESC LIMIT 21`,
                { ...options, replacements: { id, before } });
            });
        },
        transition(actor, id, { action, reason, expectedVersion }) {
            return connection.transaction(async transaction => {
                const options = { transaction, type: QueryTypes.SELECT };
                await connection.query("SET LOCAL statement_timeout = '5s'", { transaction });
                // Orden estable también cuando dos administradores deciden sobre la misma cuenta.
                const locked = await connection.query(`SELECT id,nombre,apellido,rol,status,"sessionVersion",moderation_version AS "moderationVersion"
                    FROM public.users WHERE id IN (:actorId,:id) ORDER BY id FOR UPDATE`,
                { ...options, replacements: { actorId: actor.id, id } });
                const admin = locked.find(u => u.id === actor.id), target = locked.find(u => u.id === id);
                requireAdministratorSession(admin, actor);
                if (!target) throw new AdministrationError(404, "USER_NOT_FOUND", "No encontramos ese usuario.");
                if (target.rol !== "USUARIO" || id === actor.id) throw new AdministrationError(403, "MODERATION_CITIZEN_ONLY", "Solo puedes moderar cuentas ciudadanas.");
                const previousStatus = action === "SUSPEND" ? "ACTIVO" : "SUSPENDIDO";
                const newStatus = action === "SUSPEND" ? "SUSPENDIDO" : "ACTIVO";
                if (target.status !== previousStatus || target.moderationVersion !== expectedVersion) {
                    throw new AdministrationError(409, "ACCOUNT_STATE_CHANGED", "La cuenta cambió. Actualiza su información antes de decidir.");
                }
                if (target.sessionVersion >= 2147483647 || expectedVersion >= 2147483647) throw new Error("Version exhausted");
                await connection.query(`UPDATE public.users SET status=:newStatus,"sessionVersion"="sessionVersion"+1,
                    moderation_version=moderation_version+1,"updatedAt"=clock_timestamp() WHERE id=:id`,
                { transaction, replacements: { newStatus, id } });
                await connection.query("UPDATE public.password_reset_tokens SET consumed_at=clock_timestamp() WHERE user_id=:id AND consumed_at IS NULL", { transaction, replacements: { id } });
                await connection.query(`INSERT INTO public.user_moderation_actions(target_user_id,admin_user_id,admin_name,action,reason,previous_status,new_status,moderation_version)
                    VALUES(:id,:adminId,:adminName,:action,:reason,:previousStatus,:newStatus,:version)`,
                { transaction, replacements: { id, adminId: actor.id, adminName: `${admin.nombre ?? ''} ${admin.apellido ?? ''}`.trim() || `Administrador #${actor.id}`,
                    action, reason, previousStatus, newStatus, version: expectedVersion + 1 } });
                const [row] = await connection.query(`SELECT ${fields} FROM public.users u WHERE u.id=:id`, { ...options, replacements: { id } });
                return row;
            });
        },
        detail(actor, id) {
            return readAsAdministrator(actor, async (options) => {
                const [row] = await connection.query(`SELECT ${fields} FROM public.users u WHERE u.id=:id`,
                    { ...options, replacements: { id } });
                return row ?? null;
            });
        }
    };
}

export default createAdminUserRepository();
