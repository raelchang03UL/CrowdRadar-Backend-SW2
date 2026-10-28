import sequelize from "../config/database.js";

// Extrae el ID del usuario directamente desde la sesión JWT decodificada
const getUserIdFromReq = (req) => {
  return req.user?.id || req.user?.id_usuario || req.user?.userId;
};

// HU 8.1: Guardar o re-marcar lugar como favorito
export const agregarFavorito = async (req, res) => {
  const idUsuario = getUserIdFromReq(req);
  const { id_lugar } = req.body;

  if (!idUsuario) {
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  if (!id_lugar) {
    return res.status(400).json({ message: "El id_lugar es obligatorio" });
  }

  try {
    const [result] = await sequelize.query(
      `INSERT INTO lugar_favorito (id_usuario, id_lugar, alertas_activadas) 
       VALUES ($1, $2, true) 
       ON CONFLICT (id_usuario, id_lugar) DO UPDATE 
       SET alertas_activadas = true
       RETURNING *;`,
      { bind: [idUsuario, id_lugar] }
    );

    return res.status(201).json({
      message: "Lugar añadido a favoritos",
      data: result[0]
    });
  } catch (error) {
    console.error("Error al agregar favorito:", error);
    return res.status(500).json({ error: "Error interno del servidor al guardar favorito" });
  }
};

// HU 8.2: Consultar lugares favoritos del usuario autenticado
export const obtenerFavoritos = async (req, res) => {
  const idUsuario = getUserIdFromReq(req);

  if (!idUsuario) {
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  try {
    const [results] = await sequelize.query(
      `SELECT f.id_favorito, f.alertas_activadas, l.* 
       FROM lugar_favorito f
       JOIN lugar l ON f.id_lugar = l.id_lugar
       WHERE f.id_usuario = $1;`,
      { bind: [idUsuario] }
    );

    return res.status(200).json(results);
  } catch (error) {
    console.error("Error al obtener favoritos:", error);
    return res.status(500).json({ error: "Error interno del servidor al consultar favoritos" });
  }
};

// HU 8.4: Eliminar lugar de favoritos
export const eliminarFavorito = async (req, res) => {
  const idUsuario = getUserIdFromReq(req);
  const { idLugar } = req.params;

  if (!idUsuario) {
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  if (!idLugar) {
    return res.status(400).json({ message: "El ID del lugar es requerido" });
  }

  try {
    const [result] = await sequelize.query(
      `DELETE FROM lugar_favorito 
       WHERE id_usuario = $1 AND id_lugar = $2
       RETURNING *;`,
      { bind: [idUsuario, idLugar] }
    );

    return res.status(200).json({ 
      message: "Se eliminó el lugar de tus favoritos",
      deletedCount: result.length
    });
  } catch (error) {
    console.error("Error al eliminar favorito:", error);
    return res.status(500).json({ error: "Error interno del servidor al eliminar favorito" });
  }
};