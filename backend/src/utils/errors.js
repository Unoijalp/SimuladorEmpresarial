// =====================================================================
// src/utils/errors.js
// Error propio de la aplicación. Lleva el código HTTP y un código
// interno estable que los clientes (frontend, Python) pueden consultar.
// =====================================================================

export class AppError extends Error {
  /**
   * @param {number} statusCode - Código HTTP (400, 404, 429...).
   * @param {string} code - Código interno estable (p. ej. "TABLE_NOT_FOUND").
   * @param {string} message - Mensaje legible para el cliente.
   * @param {object} [details] - Información adicional opcional.
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Fábricas de errores frecuentes, para no repetir códigos y mensajes.
export const errores = {
  tablaNoEncontrada: () =>
    new AppError(404, 'TABLE_NOT_FOUND', 'La tabla solicitada no existe o no está disponible.'),

  tablaNoDisponible: () =>
    new AppError(
      404,
      'TABLE_UNAVAILABLE',
      'La tabla está autorizada pero no existe actualmente en la base de datos.'
    ),

  parametroInvalido: (mensaje, details) =>
    new AppError(400, 'INVALID_PARAMETER', mensaje, details),

  demasiadasSolicitudes: () =>
    new AppError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Demasiadas solicitudes. Espera un momento antes de volver a intentar.'
    ),

  noImplementado: () =>
    new AppError(501, 'NOT_IMPLEMENTED', 'Esta operación está preparada pero aún no se ha implementado.'),
};