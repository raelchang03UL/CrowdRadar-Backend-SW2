import Place from "../models/Place.js";
import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

export default {
    async findActive() {
        return Place.findAll({ where: { activo: true }, order: [["id", "ASC"]], raw: true });
    },
    async findActiveWithSaturation({ windowMinutes, transaction } = {}) {
        if (!Number.isInteger(windowMinutes) || windowMinutes < 1) throw new Error("Ventana de consulta inválida.");
        // Una lectura para todo el catálogo: mismo reloj/snapshot, sin consultas por marcador.
        return sequelize.query(`WITH reloj AS MATERIALIZED (
            SELECT statement_timestamp() AS evaluated_at
        ), lugares AS MATERIALIZED (
            SELECT id, nombre, categoria, referencia, latitud, longitud, demostrativo
            FROM public.places WHERE activo = TRUE
        ), ultimos AS (
            SELECT DISTINCT ON (r.place_id, r.user_id)
                r.id, r.place_id, r.user_id, r.level, r.created_at
            FROM public.saturation_reports r
            JOIN lugares ON lugares.id = r.place_id CROSS JOIN reloj
            WHERE r.created_at >= reloj.evaluated_at - make_interval(mins => :windowMinutes)
              AND r.created_at <= reloj.evaluated_at
            ORDER BY r.place_id, r.user_id, r.created_at DESC, r.id DESC
        )
        SELECT lugares.*, reloj.evaluated_at AS "evaluatedAt",
            COALESCE(jsonb_agg(jsonb_build_object(
                'id', ultimos.id::text, 'userId', ultimos.user_id,
                'level', ultimos.level, 'createdAt', ultimos.created_at
            )) FILTER (WHERE ultimos.id IS NOT NULL), '[]'::jsonb) AS votes
        FROM lugares CROSS JOIN reloj LEFT JOIN ultimos ON ultimos.place_id = lugares.id
        GROUP BY lugares.id, lugares.nombre, lugares.categoria, lugares.referencia,
            lugares.latitud, lugares.longitud, lugares.demostrativo, reloj.evaluated_at
        ORDER BY lugares.id ASC`, { replacements: { windowMinutes }, transaction, type: QueryTypes.SELECT });
    }
};
