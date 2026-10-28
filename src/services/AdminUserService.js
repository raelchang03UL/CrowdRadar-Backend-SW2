import repository from "../repositories/AdminUserRepository.js";
import { AdministrationError, requireAdministrator } from "../domain/administration.js";

const invalidQuery = () => new AdministrationError(400, "ADMIN_QUERY_INVALID", "Revisa la búsqueda, el estado y la página solicitada.");

function integerParameter(value, fallback, maximum) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw invalidQuery();
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number > maximum) throw invalidQuery();
    return number;
}

export function parseAdminUserQuery(query) {
    if (!query || typeof query !== "object" || Array.isArray(query) ||
        Object.keys(query).some((key) => !["q", "status", "page", "limit"].includes(key))) throw invalidQuery();
    if ((query.q !== undefined && typeof query.q !== "string") ||
        (query.status !== undefined && typeof query.status !== "string")) throw invalidQuery();
    const q = (query.q ?? "").trim();
    const status = query.status ?? "";
    if ([...q].length > 160 || !["", "ACTIVO", "SUSPENDIDO"].includes(status)) throw invalidQuery();
    return { q, status, page: integerParameter(query.page, 1, 10000), limit: integerParameter(query.limit, 20, 50) };
}

export function parseAdminUserId(value) {
    if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647) {
        throw new AdministrationError(400, "ADMIN_USER_ID_INVALID", "El usuario indicado no es válido.");
    }
    return Number(value);
}

export function adminUserDto(row) {
    const denouncedReportCount = Number(row.denouncedReportCount);
    if (!Number.isSafeInteger(row.id) || row.id < 1 || row.id > 2147483647 ||
        !/^(0|[1-9]\d*)$/.test(String(row.denouncedReportCount)) ||
        !Number.isSafeInteger(denouncedReportCount) || denouncedReportCount < 0 ||
        !Number.isInteger(row.moderationVersion) || row.moderationVersion < 0 || row.moderationVersion > 2147483647) {
        throw new Error("Invalid administrative user row");
    }
    return {
        id: row.id, nombre: row.nombre ?? null, apellido: row.apellido ?? null,
        email: row.email ?? null, rol: row.rol ?? null, status: row.status ?? null, denouncedReportCount, moderationVersion: row.moderationVersion
    };
}

export class AdminUserService {
    constructor(users = repository) { this.users = users; }

    async transition(actor, id, query, body, action) {
        requireAdministrator(actor);
        if (Object.keys(query).length) throw invalidQuery();
        const key = action === "SUSPEND" ? "reason" : "note";
        const invalid = () => new AdministrationError(400, "MODERATION_INPUT_INVALID", "Revisa el motivo o la observación, con un máximo de 500 caracteres.");
        if (!body || typeof body !== "object" || Array.isArray(body) ||
            Object.keys(body).some(k => ![key, "expectedVersion"].includes(k)) ||
            !Number.isInteger(body.expectedVersion) || body.expectedVersion < 0 || body.expectedVersion > 2147483647 ||
            (body[key] !== undefined && typeof body[key] !== "string")) throw invalid();
        const reason = (body[key] ?? "").trim();
        if (reason.includes("\u0000") || [...reason].length > 500 || (action === "SUSPEND" && !reason)) throw invalid();
        return adminUserDto(await this.users.transition(actor, parseAdminUserId(id), {
            action, reason: reason || null, expectedVersion: body.expectedVersion
        }));
    }

    async history(actor, id, query) {
        requireAdministrator(actor);
        if (Object.keys(query).some(k => k !== "before")) throw invalidQuery();
        const before = query.before ?? null;
        if (before !== null && (typeof before !== "string" || !/^[1-9]\d{0,18}$/.test(before) || BigInt(before) > 9223372036854775807n)) throw invalidQuery();
        const rows = await this.users.history(actor, parseAdminUserId(id), before);
        const data = rows.slice(0, 20).map(r => ({
            id: String(r.id), action: r.action, reason: r.reason, previousStatus: r.previousStatus, newStatus: r.newStatus,
            createdAt: new Date(r.createdAt).toISOString(), adminId: r.adminId, adminName: r.adminName, moderationVersion: r.moderationVersion
        }));
        return { data, pagination: { nextBefore: rows.length > 20 ? data.at(-1).id : null } };
    }

    async list(actor, query) {
        requireAdministrator(actor);
        const options = parseAdminUserQuery(query);
        const rows = await this.users.list(actor, options);
        return {
            data: rows.slice(0, options.limit).map(adminUserDto),
            pagination: { page: options.page, limit: options.limit, hasNext: rows.length > options.limit }
        };
    }

    async detail(actor, id, query) {
        requireAdministrator(actor);
        if (Object.keys(query).length) throw invalidQuery();
        const row = await this.users.detail(actor, parseAdminUserId(id));
        if (!row) throw new AdministrationError(404, "USER_NOT_FOUND", "No encontramos ese usuario.");
        return adminUserDto(row);
    }
}

export default new AdminUserService();
