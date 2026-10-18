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
    async listActive(filters = {}) {
        return (await PlaceRepository.findActive(filters)).map(toPublicPlace);
    },
    async getActiveById(id) {
        const place = await PlaceRepository.findActiveById(id);
        return place ? toPublicPlace(place) : null;
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
