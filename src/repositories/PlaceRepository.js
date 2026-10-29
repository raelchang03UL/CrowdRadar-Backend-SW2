import Place from "../models/Place.js";

export default {
    async findActive() {
        return Place.findAll({ where: { activo: true }, order: [["id", "ASC"]], raw: true });
    },

    async findActiveById(id) {
        return Place.findOne({ where: { id, activo: true }, raw: true });
    }
};
