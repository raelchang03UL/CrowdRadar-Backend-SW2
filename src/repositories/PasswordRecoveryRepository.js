import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

const select = (sql, options = {}) => sequelize.query(sql, { ...options, type: QueryTypes.SELECT });

class PasswordRecoveryRepository {
    async consumeLimits(entries) {
        return sequelize.transaction(async (transaction) => {
            let allowed = true;
            // Orden global impide ciclos de locks entre email/IP compartidos.
            for (const { keyHash, maximum } of [...entries].sort((a, b) => a.keyHash.localeCompare(b.keyHash))) {
                const rows = await select(`INSERT INTO public.password_recovery_limits (key_hash, attempts) VALUES (:keyHash, 1)
                    ON CONFLICT (key_hash) DO UPDATE SET
                    attempts = CASE WHEN password_recovery_limits.bucket_start <= CURRENT_TIMESTAMP - INTERVAL '15 minutes'
                        THEN 1 ELSE LEAST(password_recovery_limits.attempts + 1, 1000000) END,
                    bucket_start = CASE WHEN password_recovery_limits.bucket_start <= CURRENT_TIMESTAMP - INTERVAL '15 minutes'
                        THEN CURRENT_TIMESTAMP ELSE password_recovery_limits.bucket_start END
                    RETURNING attempts`, { transaction, replacements: { keyHash } });
                if (rows[0].attempts > maximum) allowed = false;
            }
            return allowed;
        });
    }

    async issueForEmail(email, tokenHash) {
        return sequelize.transaction(async (transaction) => {
            const rows = await select(`SELECT id, email FROM public.users WHERE LOWER(BTRIM(email)) = :email AND status = 'ACTIVO'
                ORDER BY id LIMIT 2 FOR UPDATE`, { transaction, replacements: { email } });
            // Un correo normalizado ambiguo no permite elegir otra cuenta arbitrariamente.
            if (rows.length !== 1) return null;
            const user = rows[0];
            await this.invalidateForUser(user.id, transaction);
            await sequelize.query(`INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at)
                VALUES (:id, :tokenHash, CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
            { transaction, replacements: { id: user.id, tokenHash } });
            return { email: user.email };
        });
    }

    async validToken(tokenHash) {
        const rows = await select(`SELECT t.id FROM public.password_reset_tokens t JOIN public.users u ON u.id = t.user_id
            WHERE t.token_hash = :tokenHash AND t.consumed_at IS NULL AND t.expires_at > CURRENT_TIMESTAMP AND u.status = 'ACTIVO'`,
        { replacements: { tokenHash } });
        return rows.length === 1;
    }

    async withLockedToken(tokenHash, operation) {
        return sequelize.transaction(async (transaction) => {
            const candidate = await select("SELECT user_id FROM public.password_reset_tokens WHERE token_hash = :tokenHash",
                { transaction, replacements: { tokenHash } });
            if (!candidate.length) return operation(null, transaction);
            // Todos los flujos bloquean primero usuario y después sus tokens.
            const users = await select('SELECT id, email, status, "passwordHash", "sessionVersion" FROM public.users WHERE id = :id FOR UPDATE',
                { transaction, replacements: { id: candidate[0].user_id } });
            // Vigencia se comprueba en el instante del consumo atómico, después de esperar el lock.
            // Un error de validación/guardado revierte este consumo en la misma transacción.
            const tokens = await select(`UPDATE public.password_reset_tokens SET consumed_at = clock_timestamp() WHERE token_hash = :tokenHash
                AND consumed_at IS NULL AND expires_at > clock_timestamp() RETURNING id`,
            { transaction, replacements: { tokenHash } });
            if (!users.length || users[0].status !== "ACTIVO" || !tokens.length) return operation(null, transaction);
            return operation(users[0], transaction);
        });
    }

    async invalidateForUser(id, transaction) {
        await sequelize.query("UPDATE public.password_reset_tokens SET consumed_at = clock_timestamp() WHERE user_id = :id AND consumed_at IS NULL",
            { transaction, replacements: { id } });
    }

    async savePassword(user, passwordHash, transaction) {
        await sequelize.query(`UPDATE public.users SET "passwordHash" = :passwordHash, "sessionVersion" = "sessionVersion" + 1,
            "updatedAt" = clock_timestamp() WHERE id = :id`, { transaction, replacements: { id: user.id, passwordHash } });
        await this.invalidateForUser(user.id, transaction);
    }
}

export default new PasswordRecoveryRepository();
