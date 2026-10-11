import PlaceService from "../services/PlaceService.js";

export default {
    async list(req, res) {
        const nombre = req.query.nombre ?? "";
        if (Object.keys(req.query).some((key) => key !== "nombre") || typeof nombre !== "string" || nombre.trim().length > 160) {
            return res.status(400).json({ message: "Busca por nombre usando hasta 160 caracteres." });
        }
        try {
            return res.status(200).json({ data: await PlaceService.listActive(nombre.trim()) });
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
            const place = await PlaceService.getActiveById(id);
            if (!place) return res.status(404).json({ message: "El lugar no está disponible." });
            return res.status(200).json({ data: place });
        } catch {
            return res.status(503).json({ message: "No se pudo cargar la información del lugar. Inténtalo de nuevo." });
        }
    }
};
