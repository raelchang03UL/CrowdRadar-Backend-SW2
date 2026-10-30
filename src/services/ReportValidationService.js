import repository from "../repositories/ReportValidationRepository.js";

export const reportError = (status, code, message) =>
    Object.assign(new Error(message), { status, code, publicReportError: true });

export function parseReportId(value) {
    if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value) ||
        BigInt(value) > 9223372036854775807n) {
        throw reportError(400, "REPORT_ID_INVALID", "El reporte indicado no es válido.");
    }
    return value;
}

export function reliability({ confirmations, rejections, confirmWeight, rejectWeight }) {
    const count = confirmations + rejections;
    const totalWeight = confirmWeight + rejectWeight;
    const evidence = { minimumValidators: 3, confirmWeight, totalWeight };
    if (count < 3 || !totalWeight) {
        return { level: null, reason: "INSUFFICIENT_VALIDATIONS", ...evidence };
    }
    const level = confirmWeight * 3 >= totalWeight * 2 ? "ALTO"
        : confirmWeight * 3 <= totalWeight ? "BAJO" : "MEDIO";
    return { level, reason: null, ...evidence };
}

export function reportDto(row) {
    const count = (value) => {
        const number = Number(value);
        if (!Number.isSafeInteger(number) || number < 0) throw new Error("Invalid report count");
        return number;
    };
    const confirmations = count(row.confirmations);
    const rejections = count(row.rejections);
    return {
        id: String(row.id), placeId: row.placeId, placeName: row.placeName,
        level: row.level, createdAt: row.createdAt, isOwn: row.isOwn,
        ownDecision: row.ownDecision, alreadyDenounced: row.alreadyDenounced,
        confirmations, rejections,
        reliability: reliability({
            confirmations, rejections,
            confirmWeight: count(row.confirmWeight), rejectWeight: count(row.rejectWeight)
        })
    };
}

export default {
    async list(userId) {
        return (await repository.list(userId)).map(reportDto);
    },
    async detail(userId, id, ownOnly = false) {
        const [row] = await repository.list(userId, parseReportId(id), ownOnly);
        if (!row) throw reportError(404, "REPORT_NOT_FOUND", "El reporte no está disponible.");
        if (ownOnly && !row.isOwn) {
            throw reportError(403, "REPORT_FORBIDDEN", "Solo puedes consultar el estado propio en esta ruta.");
        }
        return { ...reportDto(row), ...(row.isPublic === false ? {removedFromPublic:true} : {}) };
    },
    async participate(actor, id, input, kind) {
        parseReportId(id);
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            throw reportError(400, "REPORT_INPUT_INVALID", "Revisa los datos enviados.");
        }
        if (kind === "vote") {
            if (Object.keys(input).some((key) => key !== "decision") ||
                !["CONFIRM", "REJECT"].includes(input.decision)) {
                throw reportError(400, "DECISION_INVALID", "Selecciona confirmar o rechazar.");
            }
        } else if (Object.keys(input).some((key) => key !== "reason") ||
            (input.reason !== undefined &&
                (typeof input.reason !== "string" || [...input.reason].length > 500))) {
            throw reportError(400, "REASON_INVALID", "El motivo admite hasta 500 caracteres.");
        }
        const result = await repository.participate(actor, id, input, kind);
        if (!result) {
            throw reportError(409, kind === "vote" ? "ALREADY_VALIDATED" : "ALREADY_DENOUNCED",
                kind === "vote" ? "Ya participaste en la validación de este reporte."
                    : "Ya registraste una denuncia para este reporte.");
        }
        return result;
    }
};
