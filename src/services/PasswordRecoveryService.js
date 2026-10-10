import { createHash, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import bcrypt from "bcrypt";
import repository from "../repositories/PasswordRecoveryRepository.js";
import { trustedResetUrl, resetLink } from "../config/passwordRecovery.js";
import { AuthError, validPassword } from "../utils/passwordPolicy.js";

export const forgotMessage = "Si el correo corresponde a una cuenta, recibirás un enlace para restablecer tu contraseña.";
export const resetMessage = "Contraseña restablecida. Inicia sesión nuevamente.";
export const invalidResetToken = () => new AuthError(400, "RESET_TOKEN_INVALID", "El enlace no es válido o ha expirado. Solicita uno nuevo.");
export const digest = (value) => createHash("sha256").update(value).digest("hex");
const validTokenFormat = (value) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const serviceUnavailable = () => new AuthError(503, "SERVICE_UNAVAILABLE", "No se pudo completar la solicitud. Inténtalo de nuevo.");

export default class PasswordRecoveryService {
    constructor({ delivery = null, resetUrl = process.env.PASSWORD_RESET_URL, repository: persistence = repository } = {}) {
        this.delivery = delivery;
        this.resetUrl = delivery ? trustedResetUrl(resetUrl) : null;
        this.repository = persistence;
        this.pendingDeliveries = new Set();
    }

    queueDelivery(operation) {
        // No se espera I/O del proveedor en la respuesta HTTP, ni se registra contenido sensible.
        const pending = Promise.resolve().then(operation).catch(() => {}).finally(() => this.pendingDeliveries.delete(pending));
        this.pendingDeliveries.add(pending);
    }

    async drainDeliveries() {
        await Promise.all([...this.pendingDeliveries]);
    }

    async limit(ip, email) {
        const entries = email === undefined
            ? [{ keyHash: digest(`reset-ip:${ip}`), maximum: 30 }]
            : [{ keyHash: digest(`forgot-ip:${ip}`), maximum: 10 }, { keyHash: digest(`forgot-email:${email}`), maximum: 3 }];
        if (!await this.repository.consumeLimits(entries)) {
            throw new AuthError(429, "RATE_LIMITED", "Demasiados intentos. Espera unos minutos e inténtalo nuevamente.");
        }
    }

    async forgot(body, ip) {
        const started = performance.now();
        try {
            // Uniforme antes de validar/consultar cuentas; sin proveedor no se genera ni almacena token.
            if (!this.resetUrl || typeof this.delivery?.sendResetLink !== "function" ||
                typeof this.delivery?.sendPasswordChangedNotification !== "function") {
                throw new AuthError(503, "RECOVERY_UNAVAILABLE", "La recuperación de contraseña no está disponible. Inténtalo más tarde.");
            }
            if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
                typeof body.email !== "string" || body.email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
                throw new AuthError(400, "EMAIL_VALIDATION", "Ingresa un correo electrónico válido.");
            }
            const email = body.email.trim().toLowerCase();
            await this.limit(ip, email);
            const token = randomBytes(32).toString("hex");
            const account = await this.repository.issueForEmail(email, digest(token));
            if (account) this.queueDelivery(() => this.delivery.sendResetLink({ email: account.email, resetUrl: resetLink(this.resetUrl, token) }));
            return { message: forgotMessage };
        } catch (error) {
            if (error instanceof AuthError) throw error;
            throw serviceUnavailable();
        } finally {
            // Piso común para evitar el atajo habitual de cuentas inexistentes. No es garantía frente a carga extrema.
            await delay(Math.max(0, 200 - (performance.now() - started)));
        }
    }

    async validate(body, ip) {
        try {
            await this.limit(ip);
            if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
                !validTokenFormat(body.token) || !await this.repository.validToken(digest(body.token))) throw invalidResetToken();
            return { valid: true };
        } catch (error) {
            if (error instanceof AuthError) throw error;
            throw serviceUnavailable();
        }
    }

    async reset(body, ip) {
        try {
            await this.limit(ip);
            if (!body || typeof body !== "object" || Array.isArray(body) || !validTokenFormat(body.token)) throw invalidResetToken();
            const fields = ["token", "newPassword", "confirmPassword"];
            if (Object.keys(body).some((field) => !fields.includes(field)) || !validPassword(body.newPassword) || typeof body.confirmPassword !== "string") {
                throw new AuthError(400, "PASSWORD_VALIDATION", "La contraseña nueva debe tener al menos 8 caracteres y no superar 72 bytes.");
            }
            if (body.newPassword !== body.confirmPassword) throw new AuthError(400, "PASSWORD_MISMATCH", "La confirmación no coincide con la contraseña nueva.");
            const account = await this.repository.withLockedToken(digest(body.token), async (user, transaction) => {
                if (!user) throw invalidResetToken();
                if (await bcrypt.compare(body.newPassword, user.passwordHash)) {
                    throw new AuthError(400, "PASSWORD_REUSED", "Elige una contraseña diferente de la actual.");
                }
                if (user.sessionVersion >= 2147483647) throw new Error("Session version exhausted");
                const passwordHash = await bcrypt.hash(body.newPassword, 10);
                await this.repository.savePassword(user, passwordHash, transaction);
                return { email: user.email };
            });
            if (typeof this.delivery?.sendPasswordChangedNotification === "function") {
                this.queueDelivery(() => this.delivery.sendPasswordChangedNotification({ email: account.email }));
            }
            return { message: resetMessage };
        } catch (error) {
            if (error instanceof AuthError) throw error;
            throw serviceUnavailable();
        }
    }
}
