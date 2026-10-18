import Place from "../models/Place.js";
import { Op } from "sequelize";

export const literalNamePattern = (nombre) => `%${nombre.replace(/[\\%_]/g, "\\$&")}%`;

export const createPlaceRepository = (model = Place) => ({
    async findActive({ nombre = "", categoria = "" } = {}) {
        const where = { activo: true };
        if (nombre) where.nombre = { [Op.iLike]: literalNamePattern(nombre) };
        if (categoria) where.categoria = categoria;
        return model.findAll({ where, order: [["id", "ASC"]], raw: true });
    },
    async findActiveById(id) {
        return model.findOne({ where: { id, activo: true }, raw: true });
    },
    async findActiveCategories() {
        return model.findAll({
            attributes: ["categoria"], where: { activo: true },
            group: ["categoria"], order: [["categoria", "ASC"]], raw: true
        });
    }
});
export default createPlaceRepository();
