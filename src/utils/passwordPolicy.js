export function validPassword(value, { minimum = 8 } = {}) {
    return typeof value === "string" && Array.from(value).length >= minimum &&
        Boolean(value.trim()) && Buffer.byteLength(value, "utf8") <= 72;
}

export class AuthError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export const invalidSession = () => new AuthError(401, "SESSION_INVALID", "Tu sesión ya no es válida. Inicia sesión nuevamente.");
