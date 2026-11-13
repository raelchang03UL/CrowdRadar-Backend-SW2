// PRUEBAS UNITARIAS — CAJA NEGRA
// Unidad: src/config/environment.js (lectura y validación de variables de entorno).
// Cada función recibe `env` como parámetro, así que se prueba sin tocar process.env.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    reportCooldownMinutes, karmaPointsPerReport, databaseConfiguration, validateEnvironment, corsOptions
} from "../../../src/config/environment.js";

const entornoMinimo = () => ({
    DB_NAME: "crowdradar_dev", DB_USER: "postgres", DB_PASSWORD: "x", DB_HOST: "localhost", JWT_SECRET: "secreto"
});

describe("reportCooldownMinutes — rango: entero ≥ 1", () => {
    it("sin variable usa el valor por defecto 3", () => assert.equal(reportCooldownMinutes({}), 3));
    it("límite inferior válido: 1", () => assert.equal(reportCooldownMinutes({ REPORT_COOLDOWN_MINUTES: "1" }), 1));
    for (const invalido of ["0", "-1", "1.5", "abc", ""]) {
        it(`rechaza ${JSON.stringify(invalido)}`, () => {
            assert.throws(() => reportCooldownMinutes({ REPORT_COOLDOWN_MINUTES: invalido }), /REPORT_COOLDOWN_MINUTES/);
        });
    }
});

describe("karmaPointsPerReport — rango: entero seguro ≥ 0", () => {
    it("sin variable usa 10", () => assert.equal(karmaPointsPerReport({}), 10));
    it("límite inferior válido: 0", () => assert.equal(karmaPointsPerReport({ KARMA_POINTS_PER_REPORT: "0" }), 0));
    it("límite superior válido: Number.MAX_SAFE_INTEGER", () => {
        assert.equal(karmaPointsPerReport({ KARMA_POINTS_PER_REPORT: "9007199254740991" }), Number.MAX_SAFE_INTEGER);
    });
    for (const invalido of ["-1", "9007199254740992", "2.5", "diez"]) {
        it(`rechaza ${invalido}`, () => {
            assert.throws(() => karmaPointsPerReport({ KARMA_POINTS_PER_REPORT: invalido }), /KARMA_POINTS_PER_REPORT/);
        });
    }
});

describe("databaseConfiguration — pool de conexiones", () => {
    it("valores por defecto: max 5, min 0", () => {
        const { options } = databaseConfiguration({});
        assert.equal(options.pool.max, 5);
        assert.equal(options.pool.min, 0);
    });
    it("DB_POOL_MAX acepta los límites 1 y 20", () => {
        assert.equal(databaseConfiguration({ DB_POOL_MAX: "1" }).options.pool.max, 1);
        assert.equal(databaseConfiguration({ DB_POOL_MAX: "20" }).options.pool.max, 20);
    });
    it("DB_POOL_MAX rechaza 0 y 21 (fuera de rango)", () => {
        assert.throws(() => databaseConfiguration({ DB_POOL_MAX: "0" }), /DB_POOL_MAX/);
        assert.throws(() => databaseConfiguration({ DB_POOL_MAX: "21" }), /DB_POOL_MAX/);
    });
    it("DB_POOL_MIN no puede superar a DB_POOL_MAX", () => {
        assert.equal(databaseConfiguration({ DB_POOL_MAX: "3", DB_POOL_MIN: "3" }).options.pool.min, 3);
        assert.throws(() => databaseConfiguration({ DB_POOL_MAX: "3", DB_POOL_MIN: "4" }), /DB_POOL_MIN/);
    });
    it("DB_SSL=true exige verificación del certificado", () => {
        const { options } = databaseConfiguration({ DB_SSL: "true", DB_SSL_CA: "linea1\\nlinea2" });
        assert.equal(options.dialectOptions.ssl.rejectUnauthorized, true);
        assert.equal(options.dialectOptions.ssl.ca, "linea1\nlinea2");
    });
    it("DATABASE_URL tiene precedencia sobre DB_*", () => {
        const resultado = databaseConfiguration({ DATABASE_URL: "postgres://u:p@h/db", DB_NAME: "otra" });
        assert.equal(resultado.url, "postgres://u:p@h/db");
        assert.equal(resultado.database, undefined);
    });
    it("sin DATABASE_URL usa DB_* y el puerto 5432 por defecto", () => {
        const resultado = databaseConfiguration(entornoMinimo());
        assert.equal(resultado.database, "crowdradar_dev");
        assert.equal(resultado.options.port, 5432);
    });
});

describe("validateEnvironment", () => {
    it("acepta el entorno mínimo completo", () => assert.doesNotThrow(() => validateEnvironment(entornoMinimo())));
    it("DB_PASSWORD vacía está permitida (PostgreSQL local con trust)", () => {
        assert.doesNotThrow(() => validateEnvironment({ ...entornoMinimo(), DB_PASSWORD: "" }));
    });
    it("informa todas las variables obligatorias que faltan", () => {
        assert.throws(() => validateEnvironment({}), /DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, JWT_SECRET/);
    });
    it("JWT_SECRET con solo espacios cuenta como ausente", () => {
        assert.throws(() => validateEnvironment({ ...entornoMinimo(), JWT_SECRET: "   " }), /JWT_SECRET/);
    });
    it("DB_SSL solo admite true o false", () => {
        assert.throws(() => validateEnvironment({ ...entornoMinimo(), DB_SSL: "si" }), /DB_SSL/);
    });
    it("SATURATION_EVENT_SECRET: 31 caracteres falla, 32 caracteres pasa (valor límite)", () => {
        assert.throws(() => validateEnvironment({ ...entornoMinimo(), SATURATION_EVENT_SECRET: "s".repeat(31) }));
        assert.doesNotThrow(() => validateEnvironment({ ...entornoMinimo(), SATURATION_EVENT_SECRET: "s".repeat(32) }));
    });
    it("FCM_PROJECT_ID: longitud válida 6..30, minúsculas, sin guion al final", () => {
        for (const valido of ["abcdef", "a".repeat(30), "crowd-radar-demo"]) {
            assert.doesNotThrow(() => validateEnvironment({ ...entornoMinimo(), FCM_PROJECT_ID: valido }), valido);
        }
        for (const invalido of ["abcde", "a".repeat(31), "Crowd-Radar", "proyecto-"]) {
            assert.throws(() => validateEnvironment({ ...entornoMinimo(), FCM_PROJECT_ID: invalido }), /FCM_PROJECT_ID/, invalido);
        }
    });
    it("DATABASE_URL: solo PostgreSQL, con base y sin sslmode", () => {
        const base = { JWT_SECRET: "secreto" };
        assert.doesNotThrow(() => validateEnvironment({ ...base, DATABASE_URL: "postgresql://u:p@host:5432/db" }));
        for (const url of ["no-es-url", "mysql://u:p@host/db", "postgres://u:p@host", "postgres://u:p@host/db?sslmode=require"]) {
            assert.throws(() => validateEnvironment({ ...base, DATABASE_URL: url }), undefined, url);
        }
    });
});

describe("corsOptions", () => {
    const permitido = (opciones, origen) => new Promise((resolve) => opciones.origin(origen, (_, ok) => resolve(ok)));
    it("permite orígenes listados y peticiones sin Origin (Android/CLI)", async () => {
        const opciones = corsOptions({ CORS_ORIGINS: "http://localhost:5500" });
        assert.equal(await permitido(opciones, "http://localhost:5500"), true);
        assert.equal(await permitido(opciones, undefined), true);
    });
    it("rechaza orígenes no listados", async () => {
        const opciones = corsOptions({ CORS_ORIGINS: "http://localhost:5500" });
        assert.equal(await permitido(opciones, "https://sitio-malicioso.test"), false);
    });
    it("no admite comodín ni orígenes con ruta", () => {
        assert.throws(() => corsOptions({ CORS_ORIGINS: "*" }), /explícitos/);
        assert.throws(() => corsOptions({ CORS_ORIGINS: "http://localhost:5500/app" }), /sin ruta/);
        assert.throws(() => corsOptions({ CORS_ORIGINS: "ftp://localhost" }), /HTTP/);
    });
});
