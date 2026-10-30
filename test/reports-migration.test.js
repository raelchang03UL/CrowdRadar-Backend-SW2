import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { migrateReports, reportsMigration, assertReportsSchemaReady } from "../src/database/migrateReports.js";

test("HU 3.2 conserva exactamente la migración de almacenamiento de HU 4.1", async () => {
    const texto = await readFile(new URL("../src/database/migrateReports.js", import.meta.url), "utf8");
    const contenido = Buffer.from(texto.replace(/\r\n/g, "\n"));
    // Hash del blob Git en d49578cfdff7ef5bdc77c97c14207642715f41b1.
    const blob = createHash("sha1").update(`blob ${contenido.length}\0`).update(contenido).digest("hex");
    assert.equal(blob, "da04019f28d6fbc4858cc53458ed09da2d9dd661");
});
test("reportes exige historial 003 antes de crear tablas", async () => {
    const consultas = [];
    const conexion = {
        transaction: async (operacion) => operacion({}),
        query: async (sql) => { consultas.push(sql); return []; }
    };
    await assert.rejects(migrateReports(conexion), /Aplica 003/);
    assert.ok(consultas.every((sql) => sql.startsWith("SELECT")));
});
test("reportes agrega esquema e historial juntos y es idempotente", async () => {
    let aplicada = false;
    const consultas = [];
    const transaccion = {};
    const conexion = {
        transaction: async (operacion) => operacion(transaccion),
        query: async (sql, options) => {
            assert.equal(options.transaction, transaccion);
            consultas.push(sql);
            if (sql.startsWith("SELECT name")) return [{ name: "003-password-recovery" }, ...(aplicada ? [{ name: reportsMigration }] : [])];
            if (sql.startsWith("INSERT INTO public.crowdradar_migrations")) aplicada = true;
            return [];
        }
    };
    assert.equal(await migrateReports(conexion), true);
    assert.equal(await migrateReports(conexion), false);
    assert.equal(consultas.filter((sql) => sql.startsWith("CREATE TABLE public.saturation_reports")).length, 1);
    assert.ok(consultas.every((sql) => !/DROP|DELETE|ALTER TABLE/.test(sql)));
});
test("verificación de reportes solo lee y falla cerrado sin historial/tabla", async () => {
    const consultas = [];
    await assertReportsSchemaReady({ query: async (sql) => { consultas.push(sql); return [{ name: reportsMigration }]; } });
    assert.equal(consultas.length, 2);
    assert.ok(consultas.every((sql) => sql.startsWith("SELECT")));
    await assert.rejects(assertReportsSchemaReady({ query: async () => [] }), (error) => error.code === "SCHEMA_NOT_READY");
    await assert.rejects(assertReportsSchemaReady({ query: async () => { throw new Error("secret-db-detail"); } }), (error) => error.code === "SCHEMA_NOT_READY" && !error.message.includes("secret-db-detail"));
});
