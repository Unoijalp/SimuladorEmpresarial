// =====================================================================
// src/middleware/error.middleware.js
// Manejo CENTRAL de errores. Todas las respuestas de error tienen la
// misma forma:
//   { "success": false, "error": { "code": "...", "message": "..." } }
// Los detalles internos (SQL, rutas, stack) solo se escriben en el log
// del servidor; nunca se envían al cliente.
// =====================================================================
import { esErrorDeConexion, esErrorDeTiempoAgotado } from '../config/database.js';
import { AppError } from '../utils/errors.js';

/** Se ejecuta cuando ninguna ruta coincidió con la solicitud. */
export function manejarRutaNoEncontrada(req, res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'La ruta solicitada no existe.'));
}

/** Convierte cualquier error en un AppError seguro para enviar al cliente. */
function normalizarError(error) {
  if (error instanceof AppError) return error;

  if (error?.type === 'entity.parse.failed') {
    return new AppError(400, 'INVALID_JSON', 'El cuerpo de la solicitud no es un JSON válido.');
  }
  if (error?.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la solicitud es demasiado grande.');
  }
  if (esErrorDeConexion(error)) {
    return new AppError(
      503,
      'DATABASE_UNAVAILABLE',
      'La base de datos no está disponible en este momento. Intenta de nuevo en unos segundos.'
    );
  }
  if (esErrorDeTiempoAgotado(error)) {
    return new AppError(504, 'QUERY_TIMEOUT', 'La consulta tardó demasiado y fue cancelada.');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Ocurrió un error interno del servidor.');
}

// Express identifica un manejador de errores por tener 4 parámetros.
// eslint-disable-next-line no-unused-vars
export function manejarErrores(error, req, res, next) {
  const appError = normalizarError(error);

  // Los errores del servidor (5xx) se registran con todo su detalle.
  if (appError.statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, error);
  }
  if (appError.statusCode === 503) res.set('Retry-After', '5');

  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
  });
}