// =====================================================================
// src/routes/health.routes.js
// Rutas de verificación de disponibilidad.
// =====================================================================
import { Router } from 'express';
import { verificarSalud } from '../controllers/health.controller.js';

const router = Router();

router.get('/', verificarSalud); // GET /api/health

export default router;