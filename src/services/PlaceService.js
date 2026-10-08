import PlaceRepository from "../repositories/PlaceRepository.js";

export function validCoordinates(latitud, longitud) {
    return Number.isFinite(latitud) && latitud >= -90 && latitud <= 90 &&
        Number.isFinite(longitud) && longitud >= -180 && longitud <= 180;
}

export default {
    async listActive() {
        const places = await PlaceRepository.findActive();
        return places.map((place) => {
            if (!validCoordinates(place.latitud, place.longitud)) {
                throw new Error("Coordenadas de lugar inválidas.");
            }
            const { id, nombre, categoria, referencia, latitud, longitud, demostrativo } = place;
            return { id, nombre, categoria, referencia, latitud, longitud, demostrativo };
        });
    }
};
