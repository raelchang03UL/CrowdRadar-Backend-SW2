import PlaceService from "../services/PlaceService.js";

function categoriaDesdeConsulta(consulta) {
    if (Object.keys(consulta).some((clave) => clave !== "categoria") ||
        (consulta.categoria !== undefined && typeof consulta.categoria !== "string")) {
        return null;
    }
    const categoria = (consulta.categoria ?? "").trim();
    return [...categoria].length <= 80 ? categoria : null;
}

export default {
    async list(req, res) {
        const categoria = categoriaDesdeConsulta(req.query);
        if (categoria === null) {
            return res.status(400).json({ message: "La categoría debe ser un único texto de hasta 80 caracteres." });
        }
        try {
            return res.status(200).json({ data: await PlaceService.listActive(categoria) });
        } catch {
            return res.status(503).json({ message: "No se pudieron cargar los lugares. Inténtalo de nuevo." });
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
