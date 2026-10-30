import PlaceService, { parseSaturationFilter } from "../services/PlaceService.js";

export default {
    async favorites(req, res) {
        try {
            return res.status(200).json({ data: await PlaceService.listFavorites(req.user.id) });
        } catch {
            return res.status(503).json({ message: "No se pudieron cargar tus favoritos. Int�ntalo de nuevo." });
        }
    },

    async addFavorite(req, res) {
        const placeId = Number(req.params.id);
        if (!/^-?[1-9]\d*$/.test(req.params.id) || !Number.isInteger(placeId) || placeId < -2147483648 || placeId > 2147483647) {
            return res.status(400).json({ message: "El identificador del lugar no es v�lido.", code: "INVALID_PLACE_ID" });
        }
        try {
            const result = await PlaceService.addFavorite(req.user.id, placeId);
            if (result === "notFound") {
                return res.status(404).json({ message: "El lugar no existe o no est� disponible.", code: "PLACE_NOT_FOUND" });
            }
            if (result === "exists") {
                return res.status(409).json({ message: "Este lugar ya pertenece a tus favoritos.", code: "FAVORITE_ALREADY_EXISTS" });
            }
            return res.status(201).json({ message: "Lugar agregado a tus favoritos.", data: { placeId, esFavorito: true } });
        } catch {
            return res.status(503).json({ message: "No se pudo guardar el favorito. Int�ntalo de nuevo." });
        }
    },
    async removeFavorite(req, res) {
        const placeId = Number(req.params.id);
        if (!/^-?[1-9]\d*$/.test(req.params.id) || !Number.isInteger(placeId) || placeId < -2147483648 || placeId > 2147483647) {
            return res.status(400).json({ message: "El identificador del lugar no es válido.", code: "INVALID_PLACE_ID" });
        }
        try {
            await PlaceService.removeFavorite(req.user.id, placeId);
            return res.status(204).end();
        } catch {
            return res.status(503).json({ message: "No se pudo eliminar el favorito. Inténtalo de nuevo." });
        }
    },

    async list(req, res) {
        let nivel;
        try { nivel = parseSaturationFilter(req.query); } catch {
            return res.status(400).json({ code: "SATURATION_FILTER_INVALID", message: "El filtro de saturación no es válido." });
        }
        const { nombre = "", categoria = "" } = req.query;
        if (Object.keys(req.query).some((key) => !["nombre", "categoria", "nivel"].includes(key)) ||
            typeof nombre !== "string" || [...nombre.trim()].length > 160 ||
            typeof categoria !== "string" || [...categoria.trim()].length > 80) {
            return res.status(400).json({ message: "La búsqueda admite nombre (160 caracteres) y categoría (80), una sola vez." });
        }
        try {
            return res.status(200).json({ data: await PlaceService.listActive({ nombre: nombre.trim(), categoria: categoria.trim(), nivel: nivel ?? "" }, req.user.id) });
        } catch {
            return res.status(503).json({ message: "No se pudieron cargar los lugares. Inténtalo de nuevo." });
        }
    },
    async detail(req, res) {
        const id = Number(req.params.id);
        if (!/^-?[1-9]\d*$/.test(req.params.id) || !Number.isInteger(id) || id < -2147483648 || id > 2147483647) {
            return res.status(400).json({ message: "El identificador del lugar no es válido." });
        }
        try {
            const place = await PlaceService.getActiveById(id, req.user.id);
            if (!place) return res.status(404).json({ message: "El lugar no está disponible." });
            return res.status(200).json({ data: place });
        } catch {
            return res.status(503).json({ message: "No se pudo cargar la información del lugar. Inténtalo de nuevo." });
        }
    },
    async categories(req, res) {
        if (Object.keys(req.query).length) {
            return res.status(400).json({ message: "La consulta de categorías no admite parámetros." });
        }
        try {
            return res.status(200).json({ data: await PlaceService.listActiveCategories() });
        } catch {
            return res.status(503).json({ message: "No se pudieron cargar las categorías. Inténtalo de nuevo." });
        }
    }
};
