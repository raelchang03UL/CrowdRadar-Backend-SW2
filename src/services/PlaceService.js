import PlaceRepository from "../repositories/PlaceRepository.js";
import FavoriteRepository from "../repositories/FavoriteRepository.js";

export function validCoordinates(latitud, longitud) {
    return Number.isFinite(latitud) && latitud >= -90 && latitud <= 90 &&
        Number.isFinite(longitud) && longitud >= -180 && longitud <= 180;
}

function toPublicPlace(place, esFavorito) {
    if (!validCoordinates(place.latitud, place.longitud)) {
        throw new Error("Coordenadas de lugar inválidas.");
    }
    const { id, nombre, categoria, referencia, latitud, longitud, demostrativo } = place;
    return { id, nombre, categoria, referencia, latitud, longitud, demostrativo, esFavorito };
}

export default {
    async listActive(userId) {
        const [places, favoriteIds] = await Promise.all([
            PlaceRepository.findActive(),
            FavoriteRepository.findPlaceIdsByUser(userId)
        ]);
        const favorites = new Set(favoriteIds);
        return places.map((place) => toPublicPlace(place, favorites.has(place.id)));
    },

    async listFavorites(userId) {
        const places = await FavoriteRepository.findActivePlacesByUser(userId);
        return places.map((place) => toPublicPlace(place, true));
    },

    async addFavorite(userId, placeId) {
        return FavoriteRepository.add(userId, placeId);
    }
};
