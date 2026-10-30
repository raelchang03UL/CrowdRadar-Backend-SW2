import FavoriteRepository from "../repositories/FavoriteRepository.js";
import PlaceRepository from "../repositories/PlaceRepository.js";
import { evaluateSaturation, saturationPolicy } from "./SaturationQueryService.js";

const niveles = ["TRANQUILO", "MODERADO", "SATURADO"];

export function parseSaturationFilter(consulta) {
    const invalido = () => Object.assign(new Error("El filtro de saturación no es válido."), {
        code: "SATURATION_FILTER_INVALID"
    });
    if (!consulta || typeof consulta !== "object" || Array.isArray(consulta) ||
        Object.keys(consulta).some((clave) => !["nombre", "categoria", "nivel"].includes(clave))) throw invalido();
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

function toPublicPlace(place, esFavorito) {
    if (!validCoordinates(place.latitud, place.longitud)) throw new Error("Coordenadas de lugar inválidas.");
    const { id, nombre, categoria, referencia, direccion, latitud, longitud, demostrativo } = place;
    return { id, nombre, categoria, referencia, direccion: direccion ?? null, latitud, longitud, demostrativo, ...(esFavorito === undefined ? {} : { esFavorito }) };
}

export default {
    async listFavorites(userId) { return (await FavoriteRepository.findActivePlacesByUser(userId)).map((place) => toPublicPlace(place, true)); },
    async addFavorite(userId, placeId) { return FavoriteRepository.add(userId, placeId, evaluateSaturation); },
    async removeFavorite(userId, placeId) {
        await FavoriteRepository.remove(userId, placeId);
    },
    async listActive(filters = {}, userId) {
        const nivel = parseSaturationFilter(filters);
        const places = nivel === null ? await PlaceRepository.findActive(filters) :
            await PlaceRepository.findActiveWithSaturation({ nombre: filters.nombre ?? '', categoria: filters.categoria ?? '', nivel: filters.nivel, windowMinutes: saturationPolicy.windowMinutes });
        const favoriteIds = userId === undefined ? null : new Set(await FavoriteRepository.findPlaceIdsByUser(userId));
        return (nivel === null ? places : places.filter((place) =>
            evaluateSaturation({ placeId: place.id, evaluatedAt: place.evaluatedAt, votes: place.votes }).level === nivel)).map((place) => toPublicPlace(place, favoriteIds === null ? undefined : favoriteIds.has(place.id)));
    },
    async getActiveById(id, userId) {
        const place = await PlaceRepository.findActiveById(id);
        const favoriteIds = place && userId !== undefined ? new Set(await FavoriteRepository.findPlaceIdsByUser(userId)) : null;
        return place ? toPublicPlace(place, favoriteIds === null ? undefined : favoriteIds.has(place.id)) : null;
    },
    async listActiveCategories() {
        return (await PlaceRepository.findActiveCategories()).map(({ categoria }) => {
            if (typeof categoria !== "string" || !categoria.trim() ||
                categoria !== categoria.trim() || [...categoria].length > 80) {
                throw new Error("Categoría de lugar inválida.");
            }
            return categoria;
        });
    }
};
