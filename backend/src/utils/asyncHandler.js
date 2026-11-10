// =====================================================================
// src/utils/asyncHandler.js
// Envuelve un controlador asíncrono para que cualquier error (promesa
// rechazada) llegue al manejador central de errores de Express.
// =====================================================================

export const asyncHandler = (controlador) => (req, res, next) =>
  Promise.resolve(controlador(req, res, next)).catch(next);