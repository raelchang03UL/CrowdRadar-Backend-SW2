import SaturationReportRepository from "../repositories/SaturationReportRepository.js";
import { reportCooldownMinutes, karmaPointsPerReport } from "../config/environment.js";
import { saturationReportLevels } from "../domain/saturationReport.js";

export class SaturationReportError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export class SaturationReportService {
    constructor(repository = SaturationReportRepository) { this.repository = repository; }
    async create({ userId, sessionVersion, expiresAt, placeId, level }) {
        if (!Number.isInteger(placeId) || placeId === 0 || placeId < -2147483648 || placeId > 2147483647) {
            throw new SaturationReportError(400, "INVALID_PLACE", "El lugar indicado no es válido.");
        }
        if (!saturationReportLevels.includes(level)) {
            throw new SaturationReportError(400, "INVALID_REPORT_LEVEL", "Selecciona un nivel de saturación válido.");
        }
        const result = await this.repository.create({
            userId, sessionVersion, expiresAt, placeId, level,
            cooldownMinutes: reportCooldownMinutes(), points: karmaPointsPerReport()
        });
        if (result.kind === "PLACE_NOT_FOUND") throw new SaturationReportError(404, "PLACE_NOT_FOUND", "No encontramos ese lugar.");
        if (result.kind === "REPORT_COOLDOWN") throw new SaturationReportError(409, "REPORT_COOLDOWN", "Ya registraste un reporte para este lugar. Inténtalo más tarde.");
        if (result.kind !== "CREATED" || !result.report) throw new Error("Unexpected report result");
        return result.report;
    }
}
export default new SaturationReportService();
