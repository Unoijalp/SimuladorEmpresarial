// =====================================================================
// src/routes/index.js
// Agrupa todas las rutas bajo el prefijo /api.
// =====================================================================
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import tableRoutes from './table.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/tables', tableRoutes);

export default router;