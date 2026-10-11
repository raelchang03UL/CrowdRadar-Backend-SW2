import PlaceRepository from "../repositories/PlaceRepository.js";

export function validCoordinates(latitud, longitud) {
    return Number.isFinite(latitud) && latitud >= -90 && latitud <= 90 &&
        Number.isFinite(longitud) && longitud >= -180 && longitud <= 180;
}

function toPublicPlace(place) {
    if (!validCoordinates(place.latitud, place.longitud)) throw new Error("Coordenadas de lugar inválidas.");
    const { id, nombre, categoria, referencia, direccion, latitud, longitud, demostrativo } = place;
    return { id, nombre, categoria, referencia, direccion: direccion ?? null, latitud, longitud, demostrativo };
}

export default {
    async listActive() {
        const places = await PlaceRepository.findActive();
        return places.map(toPublicPlace);
    },
    async getActiveById(id) {
        const place = await PlaceRepository.findActiveById(id);
        return place ? toPublicPlace(place) : null;
    }
};
