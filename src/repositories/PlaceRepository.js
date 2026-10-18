import Place from "../models/Place.js";

export const createPlaceRepository = (model = Place) => ({
    async findActive() {
        const where = { activo: true };
        return model.findAll({ where, order: [["id", "ASC"]], raw: true });
    },
    async findActiveById(id) {
        return model.findOne({ where: { id, activo: true }, raw: true });
    }
});

export default createPlaceRepository();
