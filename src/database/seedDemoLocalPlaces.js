import { QueryTypes } from "sequelize";
import { assertDemoLocalProvenance } from "./databaseSafety.js";
import { demoLocalPlaces } from "./demoLocalPlaces.js";

const fields = ["id", "nombre", "categoria", "direccion", "referencia", "latitud", "longitud", "activo", "demostrativo"];
export async function seedDemoLocalPlaces(db, catalog = demoLocalPlaces) {
    await assertDemoLocalProvenance(db);
    return db.transaction(async transaction => {
        const options = { transaction, type: QueryTypes.SELECT };
        await db.query("SELECT pg_advisory_xact_lock(hashtext('crowdradar-demo-local-catalog-v1'))", options);
        let inserted = 0;
        for (const place of catalog) {
            const query = { ...options, replacements: place };
            const occupied = await db.query("SELECT * FROM public.places WHERE id=:id OR lower(nombre)=lower(:nombre) FOR UPDATE", query);
            if (occupied.some(row => fields.some(field => row[field] !== place[field]))) {
                throw new Error("DEMO_CATALOG_CONFLICT: ID/nombre ocupado o datos distintos; no se sobrescribió el catálogo.");
            }
            if (occupied.length === 0) {
                await db.query(`INSERT INTO public.places (id,nombre,categoria,direccion,referencia,latitud,longitud,activo,demostrativo)
                    VALUES (:id,:nombre,:categoria,:direccion,:referencia,:latitud,:longitud,:activo,:demostrativo)`, query);
                inserted++;
            }
        }
        return { inserted, unchanged: catalog.length - inserted, total: catalog.length };
    });
}
