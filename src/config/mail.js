import { trustedResetUrl } from "./passwordRecovery.js";

// Entrega SMTP de recuperación (Brevo, Gmail u otro proveedor). Sin variables SMTP_* queda deshabilitada: 503 uniforme.
const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"];

export class MailConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.code = "CONFIG_INVALID";
    }
}

export function mailConfiguration(env = process.env) {
    const filled = (name) => typeof env[name] === "string" && env[name].trim() !== "";
    if (![...required, "MAIL_FROM"].some(filled)) return null;
    const missing = required.filter((name) => !filled(name));
    if (missing.length) {
        throw new MailConfigurationError(`Configuración de correo incompleta: faltan ${missing.join(", ")}. Completa todas las variables SMTP o elimínalas para dejar la recuperación deshabilitada.`);
    }
    const port = Number(env.SMTP_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new MailConfigurationError("SMTP_PORT debe ser un puerto válido (habitualmente 587 o 465).");
    }
    if (!filled("PASSWORD_RESET_URL")) {
        throw new MailConfigurationError("Define PASSWORD_RESET_URL para construir el enlace de recuperación.");
    }
    let resetUrl;
    try { resetUrl = trustedResetUrl(env.PASSWORD_RESET_URL.trim(), env); } catch (error) { throw new MailConfigurationError(error.message); }
    const host = env.SMTP_HOST.trim();
    const user = env.SMTP_USER.trim();
    return {
        host,
        port,
        // 465 cifra desde el inicio; cualquier otro puerto exige STARTTLS. Nunca credenciales en texto plano.
        secure: port === 465,
        user,
        // Google muestra la contraseña de aplicación en grupos con espacios; sus 16 letras no los incluyen.
        password: host === "smtp.gmail.com" ? env.SMTP_PASSWORD.replace(/\s/g, "") : env.SMTP_PASSWORD,
        from: filled("MAIL_FROM") ? env.MAIL_FROM.trim() : { name: "CrowdRadar", address: user },
        resetUrl
    };
}
