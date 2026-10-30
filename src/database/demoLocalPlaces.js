// Instantánea cartográfica verificada 2026-10-19, no observaciones ciudadanas.
// Coordenadas Nominatim/OSM: punto representativo del objeto, NO puerta/GPS.
// Fuentes por lugar, precisión/atribución y direcciones en docs/CATALOGO_DEMO_LOCAL.md.
export const demoLocalPlaces = Object.freeze([
    { id: -2005, nombre: "Parque John F. Kennedy", categoria: "Parque", direccion: null,
        referencia: "Entre calles Shell, Lima, Virgen Milagrosa y Av. Óscar Benavides, Miraflores.",
        latitud: -12.1217806, longitud: -77.0304221 },
    { id: -2004, nombre: "Parque del Amor", categoria: "Parque", direccion: "Malecón Cisneros, Miraflores",
        referencia: "También denominado Parque Alberto Andrade Carmona. Punto cartográfico, no acceso exacto.",
        latitud: -12.1267365, longitud: -77.0365127 },
    { id: -2003, nombre: "Larcomar", categoria: "Comercio", direccion: "Malecón de la Reserva 610, Miraflores",
        referencia: "Miraflores, Lima. Punto cartográfico del centro comercial, no acceso exacto.",
        latitud: -12.1322184, longitud: -77.0302263 },
    { id: -2002, nombre: "Huaca Pucllana", categoria: "Cultura", direccion: "Calle General Borgoño, cuadra 8, Miraflores",
        referencia: "Sitio arqueológico. Punto cartográfico del recinto, no acceso exacto.",
        latitud: -12.1114871, longitud: -77.0339531 },
    { id: -2001, nombre: "Museo Amano", categoria: "Cultura", direccion: "Calle Retiro 160, Miraflores",
        referencia: "Museo Textil Precolombino, Miraflores, Lima. Ubicación cartográfica de referencia.",
        latitud: -12.1140615, longitud: -77.0407663 },
].map(place => Object.freeze({ ...place, activo: true, demostrativo: true })));
