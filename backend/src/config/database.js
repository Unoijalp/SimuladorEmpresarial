// =====================================================================
// src/config/database.js
// Conexión a PostgreSQL mediante un pool de conexiones.
// Es el ÚNICO archivo que crea conexiones a la base de datos.
// =====================================================================
import pg from 'pg';
import { env } from './env.js';

const { Pool, types } = pg;

// ---------------------------------------------------------------------
// Conversión de tipos. Por defecto "pg" devuelve BIGINT y NUMERIC como
// texto ("1", "12.5000"). Para que el JSON (y pandas en Python) reciba
// números, los convertimos cuando es seguro hacerlo:
//   - BIGINT (OID 20): número si cabe en el rango entero seguro de JS.
//   - NUMERIC (OID 1700): número si tiene 15 dígitos o menos (sin
//     pérdida de precisión). Si no, se conserva como texto exacto.
// ---------------------------------------------------------------------
types.setTypeParser(20, (valor) => {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) ? numero : valor;
});

types.setTypeParser(1700, (valor) => {
  const cantidadDigitos = valor.replace(/[^0-9]/g, '').length;
  const numero = Number(valor);
  return Number.isFinite(numero) && cantidadDigitos <= 15 ? numero : valor;
});

// ---------------------------------------------------------------------
// Pool de conexiones.
// Neon suspende el cómputo tras 5 minutos de inactividad, así que:
//   - connectionTimeoutMillis es holgado para tolerar el "despertar".
//   - idleTimeoutMillis cierra conexiones ociosas antes de que el
//     servidor las corte.
// Los límites de duración de consulta del servidor (statement_timeout)
// se configuran en el rol de PostgreSQL (ver script de roles).
// ---------------------------------------------------------------------
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: env.dbTiempoConexionMs,
  query_timeout: env.dbTiempoConsultaMs,
  keepAlive: true,
});

// Si una conexión ociosa falla (p. ej. Neon la cierra), "pg" emite un
// evento "error". Sin este manejador, Node cerraría todo el proceso.
pool.on('error', (error) => {
  console.error('[DB] Error en una conexión inactiva:', error.message);
});

// Códigos de error que indican un problema transitorio de conexión.
const CODIGOS_CONEXION = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000',
  '08001',
  '08003',
  '08006',
]);

/** Indica si el error se debe a que la base de datos no está accesible. */
export function esErrorDeConexion(error) {
  if (!error) return false;
  if (CODIGOS_CONEXION.has(error.code)) return true;
  return /Connection terminated|timeout exceeded when trying to connect|Connection refused/i.test(
    error.message ?? ''
  );
}

/** Indica si el error se debe a que una consulta tardó demasiado. */
export function esErrorDeTiempoAgotado(error) {
  return error?.code === '57014' || /Query read timeout/i.test(error?.message ?? '');
}

/**
 * Ejecuta una consulta parametrizada.
 * Si falla por un problema de conexión (p. ej. la base estaba
 * "dormida"), reintenta UNA vez antes de rendirse.
 *
 * @param {string} texto - SQL con marcadores $1, $2, ...
 * @param {Array} parametros - Valores para los marcadores.
 */
export async function consultar(texto, parametros = []) {
  try {
    return await pool.query(texto, parametros);
  } catch (error) {
    if (esErrorDeConexion(error)) {
      return pool.query(texto, parametros);
    }
    throw error;
  }
}

/** Cierra el pool (se usa al apagar el servidor). */
export async function cerrarPool() {
  await pool.end();
}