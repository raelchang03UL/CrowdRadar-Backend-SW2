import PlaceRepository from "../repositories/PlaceRepository.js";
import { evaluateSaturation, saturationPolicy } from "./SaturationQueryService.js";

const niveles = ["TRANQUILO", "MODERADO", "SATURADO"];

export function parseSaturationFilter(consulta) {
    const invalido = () => Object.assign(new Error("El filtro de saturación no es válido."), {
        code: "SATURATION_FILTER_INVALID"
    });
    if (!consulta || typeof consulta !== "object" || Array.isArray(consulta) ||
        Object.keys(consulta).some((clave) => clave !== "nivel")) throw invalido();
    if (consulta.nivel === undefined) return null;
    if (typeof consulta.nivel !== "string") throw invalido();
    const nivel = consulta.nivel.trim();
    if (nivel === "") return null;
    if (!niveles.includes(nivel)) throw invalido();
    return nivel;
}

export function validCoordinates(latitud, longitud) {
    return Number.isFinite(latitud) && latitud >= -90 && latitud <= 90 &&
        Number.isFinite(longitud) && longitud >= -180 && longitud <= 180;
}

export default {
    async listActive(nivel = null) {
        if (nivel !== null && !niveles.includes(nivel)) {
            throw Object.assign(new Error("El filtro de saturación no es válido."), { code: "SATURATION_FILTER_INVALID" });
        }
        const places = nivel === null ? await PlaceRepository.findActive() :
            await PlaceRepository.findActiveWithSaturation({ windowMinutes: saturationPolicy.windowMinutes });
        const seleccionados = nivel === null ? places : places.filter((lugar) =>
            evaluateSaturation({ placeId: lugar.id, evaluatedAt: lugar.evaluatedAt, votes: lugar.votes }).level === nivel);
        return seleccionados.map((place) => {
            if (!validCoordinates(place.latitud, place.longitud)) {
                throw new Error("Coordenadas de lugar inválidas.");
            }
            const { id, nombre, categoria, referencia, latitud, longitud, demostrativo } = place;
            return { id, nombre, categoria, referencia, latitud, longitud, demostrativo };
        });
    }
};
