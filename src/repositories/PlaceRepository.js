import Place from "../models/Place.js";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

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
    },
    async findActiveWithSaturation({ windowMinutes, transaction, nombre = "", categoria = "" } = {}) {
        if (!Number.isInteger(windowMinutes) || windowMinutes < 1) throw new Error("Ventana de consulta inválida.");
        // Una lectura para todo el catálogo: mismo reloj/snapshot, sin consultas por marcador.
        return sequelize.query(`WITH reloj AS MATERIALIZED (
            SELECT statement_timestamp() AS evaluated_at
        ), lugares AS MATERIALIZED (
            SELECT id, nombre, categoria, referencia, direccion, latitud, longitud, demostrativo
            FROM public.places WHERE activo = TRUE AND (:nombre = '' OR nombre ILIKE :pattern) AND (:categoria = '' OR categoria = :categoria)
        ), ultimos AS (
            SELECT DISTINCT ON (r.place_id, r.user_id)
                r.id, r.place_id, r.user_id, r.level, r.created_at
            FROM public.saturation_reports r
            JOIN lugares ON lugares.id = r.place_id CROSS JOIN reloj
            WHERE r.created_at >= reloj.evaluated_at - make_interval(mins => :windowMinutes)
              AND r.is_public=TRUE
              AND r.created_at <= reloj.evaluated_at
            ORDER BY r.place_id, r.user_id, r.created_at DESC, r.id DESC
        )
        SELECT lugares.*, reloj.evaluated_at AS "evaluatedAt",
            COALESCE(jsonb_agg(jsonb_build_object(
                'id', ultimos.id::text, 'userId', ultimos.user_id,
                'level', ultimos.level, 'createdAt', ultimos.created_at
            )) FILTER (WHERE ultimos.id IS NOT NULL), '[]'::jsonb) AS votes
        FROM lugares CROSS JOIN reloj LEFT JOIN ultimos ON ultimos.place_id = lugares.id
        GROUP BY lugares.id, lugares.nombre, lugares.categoria, lugares.referencia, lugares.direccion,
            lugares.latitud, lugares.longitud, lugares.demostrativo, reloj.evaluated_at
        ORDER BY lugares.id ASC`, { replacements: { windowMinutes, nombre, pattern: literalNamePattern(nombre), categoria }, transaction, type: QueryTypes.SELECT });
    }
});
export default createPlaceRepository();
