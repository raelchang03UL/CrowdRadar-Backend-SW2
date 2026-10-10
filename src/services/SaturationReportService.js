import SaturationReportRepository from "../repositories/SaturationReportRepository.js";
import { reportCooldownMinutes } from "../config/environment.js";
import {
    saturationReportLevels,
    saturationReportResults
} from "../domain/saturationReport.js";

export class SaturationReportError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

class SaturationReportService {
    async create({ userId, placeId, level }) {
        if (!Number.isSafeInteger(placeId)) {
            throw new SaturationReportError(400, "PLACE_INVALID", "El lugar indicado no es válido.");
        }
        if (!saturationReportLevels.includes(level)) {
            throw new SaturationReportError(400, "LEVEL_INVALID", "Selecciona un nivel de saturación válido.");
        }
        const result = await SaturationReportRepository.create({
            userId,
            placeId,
            level,
            cooldownMinutes: reportCooldownMinutes()
        });
        if (result.kind === saturationReportResults.placeNotFound) {
            throw new SaturationReportError(404, "PLACE_NOT_FOUND", "No encontramos ese lugar.");
        }
        if (result.kind === saturationReportResults.cooldown) {
            throw new SaturationReportError(409, "REPORT_COOLDOWN", "Ya registraste un reporte para este lugar. Inténtalo más tarde.");
        }
        return result.report;
    }
}

export default new SaturationReportService();
