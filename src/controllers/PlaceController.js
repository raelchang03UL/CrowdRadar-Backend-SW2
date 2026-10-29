import PlaceService from "../services/PlaceService.js";

export default {
    async list(req, res) {
        try {
            return res.status(200).json({ data: await PlaceService.listActive(req.user.id) });
        } catch {
            return res.status(503).json({ message: "No se pudieron cargar los lugares. Inténtalo de nuevo." });
        }
    },

    async favorites(req, res) {
        try {
            return res.status(200).json({ data: await PlaceService.listFavorites(req.user.id) });
        } catch {
            return res.status(503).json({ message: "No se pudieron cargar tus favoritos. Inténtalo de nuevo." });
        }
    },

    async addFavorite(req, res) {
        const placeId = Number(req.params.id);
        if (!Number.isSafeInteger(placeId) || placeId === 0) {
            return res.status(400).json({ message: "El identificador del lugar no es válido.", code: "INVALID_PLACE_ID" });
        }
        try {
            const result = await PlaceService.addFavorite(req.user.id, placeId);
            if (result === "notFound") {
                return res.status(404).json({ message: "El lugar no existe o no está disponible.", code: "PLACE_NOT_FOUND" });
            }
            if (result === "exists") {
                return res.status(409).json({ message: "Este lugar ya pertenece a tus favoritos.", code: "FAVORITE_ALREADY_EXISTS" });
            }
            return res.status(201).json({ message: "Lugar agregado a tus favoritos.", data: { placeId, esFavorito: true } });
        } catch {
            return res.status(503).json({ message: "No se pudo guardar el favorito. Inténtalo de nuevo." });
        }
    }
};
