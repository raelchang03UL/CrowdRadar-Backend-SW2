import Place from "../models/Place.js";
import { Op } from "sequelize";

export const literalNamePattern = (nombre) => `%${nombre.replace(/[\\%_]/g, "\\$&")}%`;

export const createPlaceRepository = (model = Place) => ({
    async findActive(nombre = "") {
        const where = { activo: true };
        if (nombre) where.nombre = { [Op.iLike]: literalNamePattern(nombre) };
        return model.findAll({ where, order: [["id", "ASC"]], raw: true });
    },
    async findActiveById(id) {
        return model.findOne({ where: { id, activo: true }, raw: true });
    }
});

export default createPlaceRepository();
