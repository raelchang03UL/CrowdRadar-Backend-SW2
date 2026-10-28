const express = require('express');
const router = express.Router();
const {
  agregarFavorito,
  obtenerFavoritos,
  cambiarEstadoAlertas,
  eliminarFavorito,
} = require('../controllers/favoritoController');

// HU 8.1: Agregar a favoritos
router.post('/', agregarFavorito);

// HU 8.2: Obtener favoritos por ID de usuario
router.get('/:idUsuario', obtenerFavoritos);

// HU 8.3: Toggle de alertas
router.put('/alertas', cambiarEstadoAlertas);

// HU 8.4: Eliminar favorito
router.delete('/:idUsuario/:idLugar', eliminarFavorito);

module.exports = router;