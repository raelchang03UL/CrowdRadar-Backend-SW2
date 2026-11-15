import repository from "../repositories/AdminReportRepository.js";
import { AdministrationError, requireAdministrator } from "../domain/administration.js";
const invalidQuery = () =>
    new AdministrationError(
        400,
        "ADMIN_QUERY_INVALID",
        "Revisa el estado, el autor o la página solicitada."
    );
export function adminReportId(value) {
    if (
        typeof value !== "string" ||
        !/^[1-9]\d{0,18}$/.test(value) ||
        BigInt(value) > 9223372036854775807n
    ) {
        throw new AdministrationError(
            400,
            "ADMIN_REPORT_ID_INVALID",
            "El reporte indicado no es válido."
        );
    }
    return value;
}
function cursor(value) {
    if (value === undefined) return null;
    try {
        return adminReportId(value);
    } catch {
        throw invalidQuery();
    }
}
function count(value, minimum = 0) {
    const number = Number(value);
    if (
        !/^(0|[1-9]\d*)$/.test(String(value)) ||
        !Number.isSafeInteger(number) ||
        number < minimum ||
        number > 2147483647
    )
        throw new Error("Invalid administrative count");
    return number;
}
export function adminReportDto(row) {
    const total = count(row.denunciationCount, 1),
        reviewed = count(row.reviewedDenunciationCount),
        version = count(row.moderationVersion);
    if (
        typeof row.isPublic !== "boolean" ||
        !["PENDING", "KEPT", "REMOVED"].includes(row.reviewState) ||
        (row.reviewState === "REMOVED") === row.isPublic ||
        reviewed > total
    )
        throw new Error("Invalid administrative report state");
    return {
        id: adminReportId(String(row.id)),
        placeId: row.placeId,
        placeName: row.placeName,
        level: row.level,
        createdAt: new Date(row.createdAt).toISOString(),
        author: {
            id: row.authorId,
            name: row.authorName.trim() || "Nombre no registrado",
            rol: row.authorRole ?? null
        },
        denunciationCount: total,
        reviewedDenunciationCount: reviewed,
        reviewState: row.reviewState,
        isPublic: row.isPublic,
        moderationVersion: version
    };
}
function detailDto(row) {
    const data = adminReportDto(row);
    data.reasons = row.reasons.map((g) => ({ reason: g.reason, count: count(g.count, 1) }));
    if (data.reasons.reduce((sum, g) => sum + g.count, 0) !== data.denunciationCount)
        throw new Error("Inconsistent denunciation groups");
    const history = row.history
        .slice(0, 20)
        .map((a) => ({
            id: adminReportId(a.id),
            decision: a.decision,
            reason: a.reason,
            adminId: a.adminId,
            adminName: a.adminName,
            createdAt: new Date(a.createdAt).toISOString(),
            reviewedDenunciationCount: count(a.reviewedDenunciationCount, 1),
            moderationVersion: count(a.moderationVersion, 1)
        }));
    return {
        data,
        history,
        historyPagination: { nextBefore: row.history.length > 20 ? history.at(-1).id : null }
    };
}
export class AdminReportService {
    constructor(reports = repository) {
        this.reports = reports;
    }
    async list(actor, query) {
        requireAdministrator(actor);
        if (Object.keys(query).some((k) => !["state", "authorId", "before"].includes(k)))
            throw invalidQuery();
        const state = query.state ?? "PENDING";
        if (!["PENDING", "KEPT", "REMOVED", "ALL"].includes(state)) throw invalidQuery();
        let authorId = null;
        if (query.authorId !== undefined) {
            if (
                typeof query.authorId !== "string" ||
                !/^[1-9]\d{0,9}$/.test(query.authorId) ||
                Number(query.authorId) > 2147483647
            )
                throw invalidQuery();
            authorId = Number(query.authorId);
        }
        const rows = await this.reports.list(actor, {
                state,
                authorId,
                before: cursor(query.before)
            }),
            data = rows.slice(0, 20).map(adminReportDto);
        return { data, pagination: { nextBefore: rows.length > 20 ? data.at(-1).id : null } };
    }
    async detail(actor, id, query) {
        requireAdministrator(actor);
        if (Object.keys(query).some((k) => k !== "beforeHistory")) throw invalidQuery();
        const row = await this.reports.detail(
            actor,
            adminReportId(id),
            cursor(query.beforeHistory)
        );
        if (!row)
            throw new AdministrationError(
                404,
                "ADMIN_REPORT_NOT_FOUND",
                "El reporte denunciado no está disponible."
            );
        return detailDto(row);
    }
    async decide(actor, id, query, body) {
        requireAdministrator(actor);
        if (Object.keys(query).length) throw invalidQuery();
        const invalid = () =>
            new AdministrationError(
                400,
                "REPORT_MODERATION_INPUT_INVALID",
                "Selecciona una decisión y escribe un motivo de hasta 500 caracteres."
            );
        if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body) ||
            Object.keys(body).some(
                (k) =>
                    ![
                        "decision",
                        "reason",
                        "expectedVersion",
                        "expectedDenunciationCount"
                    ].includes(k)
            ) ||
            !["KEEP", "REMOVE"].includes(body.decision) ||
            typeof body.reason !== "string" ||
            !Number.isInteger(body.expectedVersion) ||
            body.expectedVersion < 0 ||
            body.expectedVersion > 2147483647 ||
            !Number.isInteger(body.expectedDenunciationCount) ||
            body.expectedDenunciationCount < 1 ||
            body.expectedDenunciationCount > 2147483647
        )
            throw invalid();
        const reason = body.reason.trim();
        if (!reason || reason.includes("\u0000") || [...reason].length > 500) throw invalid();
        return detailDto(await this.reports.decide(actor, adminReportId(id), { ...body, reason }));
    }
}
export default new AdminReportService();
