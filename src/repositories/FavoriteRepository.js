import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

export default {
    async remove(userId, placeId) {
        await sequelize.query(`DELETE FROM public.favorites
            WHERE user_id = :userId AND place_id = :placeId`,
        { replacements: { userId, placeId }, type: QueryTypes.DELETE });
    }
};
