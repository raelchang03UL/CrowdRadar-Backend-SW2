import SaturationQueryRepository from "../repositories/SaturationQueryRepository.js";

export const saturationPolicy = Object.freeze({ minimumReports: 3, windowMinutes: 30 });
const niveles = ["TRANQUILO", "MODERADO", "SATURADO"];

export function parsePlaceId(valor) {
    if (typeof valor !== "string" || !/^-?[1-9]\d*$/.test(valor)) return null;
    const id = Number(valor);
    return Number.isInteger(id) && id >= -2147483648 && id <= 2147483647 ? id : null;
}

function errorPublico(status, code, message) {
    return Object.assign(new Error(message), { status, code });
}

// Política provisional aprobada por el usuario, pendiente de acuerdo del equipo.
// No pondera confianza ni calcula aforo; cada persona aporta como máximo un voto.
export function evaluateSaturation({ placeId, evaluatedAt, votes }) {
    const instante = new Date(evaluatedAt);
    if (!Number.isInteger(placeId) || placeId === 0 || placeId < -2147483648 || placeId > 2147483647 ||
        evaluatedAt == null || !Number.isFinite(instante.getTime()) || !Array.isArray(votes)) {
        throw new Error("Snapshot de saturación inválido.");
    }
    const inicio = instante.getTime() - saturationPolicy.windowMinutes * 60_000;
    const porPersona = new Map();
    for (const reporte of votes) {
        const fecha = new Date(reporte.createdAt);
        if (!Number.isInteger(reporte.userId) || reporte.userId < 1 ||
            !niveles.includes(reporte.level) || !Number.isFinite(fecha.getTime()) ||
            !/^\d+$/.test(String(reporte.id))) {
            throw new Error("Reporte almacenado inválido.");
        }
        if (fecha.getTime() < inicio || fecha.getTime() > instante.getTime()) continue;
        const anterior = porPersona.get(reporte.userId);
        if (!anterior || fecha > anterior.fecha ||
            (fecha.getTime() === anterior.fecha.getTime() && BigInt(reporte.id) > BigInt(anterior.id))) {
            porPersona.set(reporte.userId, { ...reporte, fecha });
        }
    }
    const votos = [...porPersona.values()];
    const reportCount = votos.length;
    const updatedAt = reportCount ? new Date(votos.reduce((ultima, { fecha }) => Math.max(ultima, fecha.getTime()), -Infinity)).toISOString() : null;
    let level = null;
    let reason = "INSUFFICIENT_REPORTS";
    if (reportCount >= saturationPolicy.minimumReports) {
        const conteos = niveles.map((nivel) => ({ nivel, cantidad: votos.filter((voto) => voto.level === nivel).length }));
        const mayor = Math.max(...conteos.map(({ cantidad }) => cantidad));
        const ganadores = conteos.filter(({ cantidad }) => cantidad === mayor);
        reason = ganadores.length === 1 ? null : "TIE";
        if (ganadores.length === 1) level = ganadores[0].nivel;
    }
    return { placeId, level, reportCount, ...saturationPolicy, reason, evaluatedAt: instante.toISOString(), updatedAt };
}

export default {
    async getForPlace(valor) {
        const placeId = parsePlaceId(valor);
        if (placeId === null) throw errorPublico(400, "PLACE_ID_INVALID", "El identificador del lugar no es válido.");
        const snapshot = await SaturationQueryRepository.findActiveSnapshot(placeId);
        if (!snapshot) throw errorPublico(404, "PLACE_NOT_FOUND", "El lugar no existe o no está disponible.");
        return evaluateSaturation(snapshot);
    }
};
