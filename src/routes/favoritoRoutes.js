import express from 'express';
import {
  agregarFavorito,
  obtenerFavoritos,
  eliminarFavorito,
} from '../controllers/favoritoController.js';

const router = express.Router();

// HU 8.2: Obtener los favoritos del usuario autenticado
router.get('/', obtenerFavoritos);

// HU 8.1: Agregar un lugar a favoritos
router.post('/', agregarFavorito);

// HU 8.4: Eliminar un lugar de favoritos por ID de lugar
router.delete('/:idLugar', eliminarFavorito);

export default router;