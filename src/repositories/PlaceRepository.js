import Place from "../models/Place.js";

export default {
    async findActive(categoria = "") {
        const where = { activo: true };
        if (categoria) where.categoria = categoria;
        return Place.findAll({ where, order: [["id", "ASC"]], raw: true });
    },
    async findActiveCategories() {
        return Place.findAll({
            attributes: ["categoria"],
            where: { activo: true },
            group: ["categoria"],
            order: [["categoria", "ASC"]],
            raw: true
        });
    }
};
