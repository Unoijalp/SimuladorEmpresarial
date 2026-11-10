// =====================================================================
// src/routes/table.routes.js
// Rutas del recurso "tablas". Solo conecta URL + método con su
// controlador (y su middleware de acceso, si aplica).
// =====================================================================
import { Router } from 'express';
import * as controlador from '../controllers/table.controller.js';
import { requerirAccesoDeEscritura } from '../middleware/auth.middleware.js';

const router = Router();

// --- Lectura (públicas) ---------------------------------------------
router.get('/', controlador.listarTablas); // GET /api/tables
router.get('/:table/metadata', controlador.obtenerMetadatos); // GET /api/tables/:table/metadata
router.get('/:table/data', controlador.obtenerRegistros); // GET /api/tables/:table/data

// --- Escritura (protegidas con clave de API; aún no implementadas) ---
router.post('/:table/data', requerirAccesoDeEscritura, controlador.crearRegistro);
router.put('/:table/data/:id', requerirAccesoDeEscritura, controlador.actualizarRegistro);
router.patch('/:table/data/:id', requerirAccesoDeEscritura, controlador.actualizarRegistro);
router.delete('/:table/data/:id', requerirAccesoDeEscritura, controlador.eliminarRegistro);

export default router;