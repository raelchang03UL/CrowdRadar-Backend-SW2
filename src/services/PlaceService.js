import PlaceRepository from "../repositories/PlaceRepository.js";

export function validCoordinates(latitud, longitud) {
    return Number.isFinite(latitud) && latitud >= -90 && latitud <= 90 &&
        Number.isFinite(longitud) && longitud >= -180 && longitud <= 180;
}

export default {
    async listActive(categoria = "") {
        const places = await PlaceRepository.findActive(categoria);
        return places.map((place) => {
            if (!validCoordinates(place.latitud, place.longitud)) {
                throw new Error("Coordenadas de lugar inválidas.");
            }
            const { id, nombre, categoria, referencia, latitud, longitud, demostrativo } = place;
            return { id, nombre, categoria, referencia, latitud, longitud, demostrativo };
        });
    },
    async listActiveCategories() {
        const categorias = await PlaceRepository.findActiveCategories();
        return categorias.map(({ categoria }) => {
            if (typeof categoria !== "string" || !categoria.trim() ||
                categoria !== categoria.trim() || [...categoria].length > 80) {
                throw new Error("Categoría de lugar inválida.");
            }
            return categoria;
        });
    }
};
