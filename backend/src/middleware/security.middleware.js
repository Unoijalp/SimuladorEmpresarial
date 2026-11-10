// =====================================================================
// src/middleware/security.middleware.js
// Cabeceras de seguridad (helmet), CORS y límite de solicitudes.
// =====================================================================
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { errores } from '../utils/errors.js';

/** Cabeceras HTTP de seguridad con la configuración recomendada. */
export const cabecerasDeSeguridad = helmet();

/**
 * CORS: solo los dominios listados en CORS_ORIGINS pueden consumir la API
 * desde un navegador. Las herramientas que no son navegadores (Python,
 * curl) no envían cabecera Origin y no se ven afectadas por CORS.
 */
export const politicaCors = cors({
  origin(origen, callback) {
    if (!origen || env.corsOrigins.includes(origen)) return callback(null, true);
    return callback(null, false); // el navegador bloqueará la respuesta
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 600,
});

/** Límite de solicitudes por IP dentro de una ventana de tiempo. */
export const limitadorDeSolicitudes = rateLimit({
  windowMs: env.rateLimitVentanaMs,
  limit: env.rateLimitMaximo,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => next(errores.demasiadasSolicitudes()),
});