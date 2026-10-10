import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

class Place extends Model {}

Place.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(160), allowNull: false, validate: { notEmpty: true } },
    categoria: { type: DataTypes.STRING(80), allowNull: false, validate: { notEmpty: true } },
    referencia: { type: DataTypes.STRING(250) },
    latitud: { type: DataTypes.DOUBLE, allowNull: false, validate: { min: -90, max: 90, isFloat: true } },
    longitud: { type: DataTypes.DOUBLE, allowNull: false, validate: { min: -180, max: 180, isFloat: true } },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    demostrativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, { sequelize, modelName: "Place", tableName: "places", timestamps: false });

export default Place;
