// =====================================================================
// src/validators/query.validator.js
// Valida y normaliza los parámetros de la URL (?page, ?limit, ?sort,
// ?order) de GET /api/tables/:table/data. Nada que no esté validado
// llega a la consulta SQL.
// =====================================================================
import { env } from '../config/env.js';
import { errores } from '../utils/errors.js';

// Protección contra paginaciones absurdamente profundas (OFFSET costoso).
const OFFSET_MAXIMO = 1_000_000;

/** Convierte un parámetro a entero positivo o devuelve el valor por defecto. */
function enteroPositivo(valor, nombre, porDefecto) {
  if (valor === undefined || valor === '') return porDefecto;
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) {
    throw errores.parametroInvalido(`El parámetro '${nombre}' debe ser un entero positivo.`);
  }
  const numero = Number.parseInt(valor, 10);
  if (numero < 1) {
    throw errores.parametroInvalido(`El parámetro '${nombre}' debe ser mayor o igual a 1.`);
  }
  return numero;
}

/**
 * @param {object} query - req.query de Express.
 * @param {string[]} columnasValidas - Columnas reales de la tabla (del catálogo).
 * @param {object} tabla - Configuración de la tabla autorizada.
 * @returns {{page:number, limit:number, offset:number, sort:string|null, order:'ASC'|'DESC'}}
 */
export function validarParametrosDeConsulta(query, columnasValidas, tabla) {
  const limiteMaximo = tabla.limiteMaximo ?? env.limiteMaximo;

  const page = enteroPositivo(query.page, 'page', 1);
  const limit = enteroPositivo(query.limit, 'limit', Math.min(env.limitePorDefecto, limiteMaximo));

  if (limit > limiteMaximo) {
    throw errores.parametroInvalido(`El parámetro 'limit' no puede superar ${limiteMaximo}.`);
  }

  const offset = (page - 1) * limit;
  if (offset > OFFSET_MAXIMO) {
    throw errores.parametroInvalido('La página solicitada está fuera del rango permitido.');
  }

  // sort: debe ser exactamente una columna existente de la tabla.
  let sort = null;
  if (query.sort !== undefined && query.sort !== '') {
    if (typeof query.sort !== 'string' || !columnasValidas.includes(query.sort)) {
      throw errores.parametroInvalido("El parámetro 'sort' no es una columna válida de la tabla.", {
        valid_columns: columnasValidas,
      });
    }
    sort = query.sort;
  }

  // order: solo ASC o DESC (sin distinguir mayúsculas).
  let order = 'ASC';
  if (query.order !== undefined && query.order !== '') {
    const normalizado = typeof query.order === 'string' ? query.order.toUpperCase() : '';
    if (normalizado !== 'ASC' && normalizado !== 'DESC') {
      throw errores.parametroInvalido("El parámetro 'order' debe ser ASC o DESC.");
    }
    order = normalizado;
  }

  return { page, limit, offset, sort, order };
}