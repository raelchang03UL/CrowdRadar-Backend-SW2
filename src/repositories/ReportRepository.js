import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";

export default {
    async findByUserId(userId) {
        return sequelize.query(`
            SELECT
                reports.id,
                reports.created_at AS "createdAt",
                reports.level,
                places.id AS "placeId",
                places.nombre AS "placeName"
            FROM public.saturation_reports AS reports
            INNER JOIN public.places AS places ON places.id = reports.place_id
            WHERE reports.user_id = :userId
            ORDER BY reports.created_at DESC, reports.id DESC
        `, {
            replacements: { userId },
            type: QueryTypes.SELECT
        });
    }
};
