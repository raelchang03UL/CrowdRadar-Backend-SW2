import sequelize from "../config/database.js";

// HU 8.1: Marcar como favorito
export const agregarFavorito = async (req, res) => {
  const { id_usuario, id_lugar } = req.body;
  try {
    const [result] = await sequelize.query(
      `INSERT INTO lugar_favorito (id_usuario, id_lugar, alertas_activadas) 
       VALUES ($1, $2, true) 
       ON CONFLICT (id_usuario, id_lugar) DO NOTHING 
       RETURNING *;`,
      { bind: [id_usuario, id_lugar] }
    );
    res.status(201).json({ message: 'Lugar añadido a favoritos', data: result[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// HU 8.2: Consultar lugares favoritos del usuario
export const obtenerFavoritos = async (req, res) => {
  const { idUsuario } = req.params;
  try {
    const [results] = await sequelize.query(
      `SELECT f.id_favorito, f.alertas_activadas, l.* 
       FROM lugar_favorito f
       JOIN lugar l ON f.id_lugar = l.id_lugar
       WHERE f.id_usuario = $1;`,
      { bind: [idUsuario] }
    );
    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// HU 8.3: Activar o desactivar alertas
export const cambiarEstadoAlertas = async (req, res) => {
  const { id_usuario, alertas_activadas } = req.body;
  try {
    await sequelize.query(
      `UPDATE lugar_favorito 
       SET alertas_activadas = $1 
       WHERE id_usuario = $2;`,
      { bind: [alertas_activadas, id_usuario] }
    );
    res.status(200).json({ message: 'Estado de alertas actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// HU 8.4: Eliminar lugar de favoritos
export const eliminarFavorito = async (req, res) => {
  const { idUsuario, idLugar } = req.params;
  try {
    await sequelize.query(
      `DELETE FROM lugar_favorito 
       WHERE id_usuario = $1 AND id_lugar = $2;`,
      { bind: [idUsuario, idLugar] }
    );
    res.status(200).json({ message: 'Se eliminó el lugar de tus favoritos' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};