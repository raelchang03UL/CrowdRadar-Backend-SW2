import { invalidSession } from '../utils/passwordPolicy.js';
export const administratorRole = "ADMIN";

export class AdministrationError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export function requireAdministrator(actor) {
    if (actor?.rol !== administratorRole) {
        throw new AdministrationError(403, "ADMIN_REQUIRED", "Esta sección está disponible para administradores.");
    }
}

export function requireAdministratorSession(current, actor) {
    if (!current || current.status !== 'ACTIVO' || current.sessionVersion !== actor.sessionVersion ||
        !Number.isSafeInteger(actor.exp) || actor.exp <= Math.floor(Date.now()/1000)) throw invalidSession();
    requireAdministrator(current);
}
