import { QueryTypes } from "sequelize";
import { assertLocalDevelopmentDatabase } from "./databaseSafety.js";

// Posiciones ilustrativas en Lima, NO un catálogo real ni mediciones en vivo.
// IDs negativos reservados al fixture; la secuencia normal sigue siendo positiva.
export const demoPlaces = [
    { id: -103, nombre: "Demo · Parque Central", categoria: "Parque", direccion: "Dirección ilustrativa: Av. Ejemplo 100 (no verificada)", latitud: -12.0464, longitud: -77.0428 },
    { id: -102, nombre: "Demo · Centro Cultural", categoria: "Cultura", direccion: "Dirección ilustrativa: Jr. Ejemplo 200 (no verificada)", latitud: -12.058, longitud: -77.036 },
    { id: -101, nombre: "Demo · Plaza del Barrio", categoria: "Plaza", direccion: "Dirección ilustrativa: Calle Ejemplo 300 (no verificada)", latitud: -12.035, longitud: -77.05 }
];

export async function seedPlacesDemo(sequelize) {
    assertLocalDevelopmentDatabase(sequelize);
    await sequelize.transaction(async (transaction) => {
        for (const place of demoPlaces) {
            const options = { transaction, replacements: place };
            await sequelize.query(`INSERT INTO public.places
                (id, nombre, categoria, referencia, direccion, latitud, longitud, activo, demostrativo)
                VALUES (:id, :nombre, :categoria, 'Ubicación demostrativa; no monitoreada.', :direccion, :latitud, :longitud, TRUE, TRUE)
                ON CONFLICT (id) DO NOTHING`, options);
            const [stored] = await sequelize.query("SELECT * FROM public.places WHERE id = :id",
                { ...options, type: QueryTypes.SELECT });
            if (!stored.demostrativo || !stored.activo || stored.nombre !== place.nombre ||
                stored.categoria !== place.categoria || stored.latitud !== place.latitud || stored.longitud !== place.longitud) {
                throw new Error("Un ID reservado al fixture está ocupado. No se sobrescribió ningún lugar.");
            }
            // Solo completa nuestro fixture antiguo; nunca reemplaza una dirección existente.
            if (stored.direccion === null) {
                await sequelize.query("UPDATE public.places SET direccion = :direccion WHERE id = :id AND direccion IS NULL", options);
            }
        }
    });
}
