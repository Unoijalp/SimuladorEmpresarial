// =====================================================================
// src/controllers/health.controller.js
// GET /api/health          -> verificación liviana (no toca la base).
//                             Es la ruta que debe usar el "Health Check
//                             Path" de Render (no despierta a Neon).
// GET /api/health?deep=true -> además ejecuta SELECT 1 en PostgreSQL
//                              (sirve para "despertar" una base dormida).
// GET /api/health?ip=true   -> diagnóstico de despliegue: devuelve la IP
//                              del cliente tal como la ve el servidor
//                              (sirve para ajustar TRUST_PROXY).
// =====================================================================
import { consultar } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const verificarSalud = asyncHandler(async (req, res) => {
  const respuesta = {
    success: true,
    status: 'ok',
    service: 'julio-asociados-api',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
  };

  if (req.query.ip === 'true') {
    respuesta.client_ip = req.ip; // solo la IP de quien consulta
  }

  if (req.query.deep === 'true') {
    const inicio = Date.now();
    await consultar('SELECT 1');
    respuesta.database = { status: 'ok', latency_ms: Date.now() - inicio };
  }

  res.json(respuesta);
});