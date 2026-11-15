import { QueryTypes } from "sequelize";
import db from "../config/database.js";
export default {
    async hourly(placeId, start, end) {
        return db.transaction(async (transaction) => {
            await db.query("SET LOCAL statement_timeout = '5000'", {transaction});
            return db.query(`WITH bounded AS (
                SELECT id,user_id,level,created_at,
                    date_trunc('hour',created_at AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima' AS bucket_start
                FROM public.saturation_reports WHERE place_id = :placeId AND is_public=TRUE AND created_at >= :start AND created_at < :end
            ) SELECT DISTINCT ON(bucket_start,user_id) id::text,user_id AS "userId",level,
                created_at AS "createdAt",bucket_start AS "bucketStart"
            FROM bounded ORDER BY bucket_start,user_id,created_at DESC,id DESC LIMIT 10001`,
            {transaction,replacements:{placeId,start,end},type:QueryTypes.SELECT});
        });
    }
};
