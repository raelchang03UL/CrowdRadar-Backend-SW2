import repository from "../repositories/HistoryRepository.js";
import places from "../repositories/PlaceRepository.js";
import { evaluateSaturation, parsePlaceId } from "./SaturationQueryService.js";

export const historyPolicy = Object.freeze({ minimumReports: 3, windowMinutes: 60 });
const day = 86400000;
const hour = 3600000;
const error = (status, code, message) =>
    Object.assign(new Error(message), { status, code, publicHistoryError: true });

// Lima no aplica horario de verano. El final es exclusivo en SQL.
export function period(from, to) {
    const date = (value) => {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) {
            throw error(400, "PERIOD_INVALID", "Usa fechas válidas AAAA-MM-DD.");
        }
        const parsed = new Date(value + "T00:00:00.000Z");
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
            throw error(400, "PERIOD_INVALID", "La fecha indicada no existe.");
        }
        return parsed.getTime() + 5 * hour;
    };
    const start = date(from);
    const end = date(to) + day;
    if (end <= start || end - start > 31 * day) {
        throw error(400, "PERIOD_INVALID", "El período debe incluir entre 1 y 31 días.");
    }
    return {
        from, to, start: new Date(start).toISOString(),
        end: new Date(end).toISOString(), timezone: "America/Lima"
    };
}

export function hourlyBlocks(placeId, range, rows) {
    if (rows.length > 10000) {
        throw error(422, "PERIOD_TOO_DENSE", "Hay demasiados datos; selecciona un período más corto.");
    }
    const byHour = new Map();
    for (const row of rows) {
        const key = new Date(row.bucketStart).toISOString();
        if (!byHour.has(key)) byHour.set(key, []);
        byHour.get(key).push(row);
    }
    const result = [];
    for (let start = Date.parse(range.start); start < Date.parse(range.end); start += hour) {
        const key = new Date(start).toISOString();
        const snapshot = evaluateSaturation({
            placeId, evaluatedAt: new Date(start + hour - 1).toISOString(),
            votes: byHour.get(key) ?? []
        }, historyPolicy);
        result.push({
            start: key, end: new Date(start + hour).toISOString(),
            level: snapshot.level, reportCount: snapshot.reportCount, reason: snapshot.reason
        });
    }
    return result;
}

export function summary(blocks) {
    const counts = { TRANQUILO: 0, MODERADO: 0, SATURADO: 0 };
    let insufficient = 0;
    for (const block of blocks) {
        if (block.level) counts[block.level]++;
        else insufficient++;
    }
    return { counts, insufficient, sufficient: blocks.length - insufficient };
}

export function quietHours(blocks) {
    const hours = new Map();
    for (const block of blocks) {
        if (!block.level) continue;
        const lima = new Date(Date.parse(block.start) - 5 * hour);
        const key = lima.getUTCHours();
        if (!hours.has(key)) hours.set(key, { hour: key, days: new Set(), quietDays: 0 });
        const item = hours.get(key);
        item.days.add(lima.toISOString().slice(0, 10));
        if (block.level === "TRANQUILO") item.quietDays++;
    }
    const eligible = [...hours.values()]
        .filter((item) => item.days.size >= 3)
        .map(({ hour, days, quietDays }) => ({ hour, days: days.size, quietDays }));
    if (!eligible.length) return { reason: "INSUFFICIENT_HISTORY", minimumDays: 3, recommendations: [] };
    // Un horario sin ningún bloque tranquilo no es una recomendación.
    const candidates = eligible.filter((item) => item.quietDays > 0);
    if (!candidates.length) return { reason: "NO_QUIET_HOURS", minimumDays: 3, recommendations: [] };
    candidates.sort((a, b) => b.quietDays * a.days - a.quietDays * b.days || a.hour - b.hour);
    let rank = 1;
    return {
        reason: null, minimumDays: 3,
        recommendations: candidates.map((item, index) => {
            const previous = candidates[index - 1];
            if (previous && previous.quietDays * item.days !== item.quietDays * previous.days) rank = index + 1;
            return { ...item, rank };
        })
    };
}

export default {
    async history(id, from, to) {
        const placeId = parsePlaceId(id);
        if (placeId === null) throw error(400, "PLACE_ID_INVALID", "El lugar indicado no es válido.");
        const range = period(from, to);
        const place = await places.findActiveById(placeId);
        if (!place) throw error(404, "PLACE_NOT_FOUND", "El lugar no está disponible.");
        const rows = await repository.hourly(placeId, range.start, range.end);
        const blocks = hourlyBlocks(placeId, range, rows);
        return { placeId, placeName: place.nombre, period: range, blocks, ...summary(blocks), hasReports: rows.length > 0 };
    },
    async compare(id, a, b) {
        // Validar ambos períodos antes de iniciar consultas.
        period(a.from, a.to);
        period(b.from, b.to);
        const first = await this.history(id, a.from, a.to);
        const second = await this.history(id, b.from, b.to);
        return { placeId: first.placeId, timezone: "America/Lima", first, second, comparable: first.sufficient > 0 && second.sufficient > 0 };
    },
    async recommendations(id, from, to) {
        const history = await this.history(id, from, to);
        return { placeId: history.placeId, period: history.period, ...quietHours(history.blocks) };
    }
};
