import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

export default {
    async findActiveSnapshot(placeId, { transaction } = {}) {
        // Una sola lectura comparte reloj y snapshot para lugar, ventana y últimos votos.
        const filas = await sequelize.query(`WITH reloj AS MATERIALIZED (
            SELECT statement_timestamp() AS evaluated_at
        ), lugar AS (
            SELECT id FROM public.places WHERE id = :placeId AND activo = TRUE
        ), ultimos AS (
            SELECT DISTINCT ON (r.user_id) r.id, r.user_id, r.level, r.created_at
            FROM public.saturation_reports r
            CROSS JOIN reloj CROSS JOIN lugar
            WHERE r.place_id = lugar.id
              AND r.is_public=TRUE
              AND r.created_at >= reloj.evaluated_at - make_interval(mins => :windowMinutes)
              AND r.created_at <= reloj.evaluated_at
            ORDER BY r.user_id, r.created_at DESC, r.id DESC
        )
        SELECT lugar.id AS "placeId", reloj.evaluated_at AS "evaluatedAt",
            COALESCE(jsonb_agg(jsonb_build_object(
                'id', ultimos.id::text, 'userId', ultimos.user_id,
                'level', ultimos.level, 'createdAt', ultimos.created_at
            )) FILTER (WHERE ultimos.id IS NOT NULL), '[]'::jsonb) AS votes
        FROM lugar CROSS JOIN reloj LEFT JOIN ultimos ON TRUE
        GROUP BY lugar.id, reloj.evaluated_at`, {
            replacements: { placeId, windowMinutes: 30 }, transaction, type: QueryTypes.SELECT
        });
        return filas[0] ?? null;
    }
};
