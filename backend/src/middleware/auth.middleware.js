// =====================================================================
// src/middleware/auth.middleware.js
// Control de acceso para operaciones de ESCRITURA (POST/PUT/PATCH/DELETE).
// Las lecturas (GET) son públicas. La clave se envía en la cabecera
//   Authorization: Bearer <clave>      o      X-API-Key: <clave>
// y se compara contra WRITE_API_KEYS (variable de entorno).
// =====================================================================
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const hash = (texto) => crypto.createHash('sha256').update(texto).digest();

// Se guardan los hashes (no las claves) y se comparan en tiempo constante.
const hashesValidos = env.clavesEscritura.map(hash);

function claveEsValida(clave) {
  const hashRecibido = hash(clave);
  return hashesValidos.some((valido) => crypto.timingSafeEqual(valido, hashRecibido));
}

/** Extrae la clave de las cabeceras de la solicitud (o null si no viene). */
function extraerClave(req) {
  const autorizacion = req.get('authorization');
  if (autorizacion?.toLowerCase().startsWith('bearer ')) {
    return autorizacion.slice(7).trim();
  }
  return req.get('x-api-key')?.trim() || null;
}

export function requerirAccesoDeEscritura(req, res, next) {
  if (hashesValidos.length === 0) {
    return next(
      new AppError(403, 'WRITES_DISABLED', 'Las operaciones de escritura están deshabilitadas.')
    );
  }

  const clave = extraerClave(req);
  if (!clave) {
    return next(new AppError(401, 'AUTH_REQUIRED', 'Se requiere una clave de API para esta operación.'));
  }
  if (!claveEsValida(clave)) {
    return next(new AppError(403, 'FORBIDDEN', 'La clave de API no es válida.'));
  }
  next();
}