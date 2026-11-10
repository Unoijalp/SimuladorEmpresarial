// =====================================================================
// src/services/table.service.js
// Lógica de negocio: listar tablas, contar registros y consultar datos
// con paginación y ordenamiento. Es la ÚNICA capa que arma consultas
// SQL sobre las tablas del usuario.
// =====================================================================
import { consultar, esErrorDeConexion } from '../config/database.js';
import { env } from '../config/env.js';
import { buscarTablaAutorizada, listarTablasAutorizadas } from '../config/tables.config.js';
import { validarParametrosDeConsulta } from '../validators/query.validator.js';
import { CacheTTL } from '../utils/cache.js';
import { errores } from '../utils/errors.js';
import { citarIdentificador, nombreCompleto } from '../utils/sql.js';
import { obtenerMetadatos } from './metadata.service.js';

const cacheConteo = new CacheTTL(env.cacheConteoSegundos * 1000);

/** Busca la tabla en la lista blanca; si no está autorizada lanza 404. */
export function resolverTabla(nombre) {
  const tabla = buscarTablaAutorizada(nombre);
  if (!tabla) throw errores.tablaNoEncontrada();
  return tabla;
}

/**
 * Cuenta los registros de una tabla de forma eficiente:
 *  - Primero lee el ESTIMADO del catálogo (no toca la tabla).
 *  - Si el estimado es pequeño (o aún no existe), hace COUNT(*) exacto.
 *  - Si el estimado supera el umbral, devuelve el estimado y lo marca.
 * @returns {Promise<{total:number, exact:boolean}>}
 */
export function contarRegistros(tabla) {
  return cacheConteo.obtenerOCalcular(`${tabla.esquema}.${tabla.nombre}`, async () => {
    const estimadoRes = await consultar(
      `SELECT c.reltuples::bigint AS estimado
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind IN ('r', 'p')`,
      [tabla.esquema, tabla.nombre]
    );
    if (estimadoRes.rowCount === 0) throw errores.tablaNoDisponible();

    const estimado = estimadoRes.rows[0].estimado;
    if (estimado >= env.umbralConteoExacto) {
      return { total: estimado, exact: false };
    }

    const exactoRes = await consultar(`SELECT count(*) AS total FROM ${nombreCompleto(tabla)}`);
    return { total: exactoRes.rows[0].total, exact: true };
  });
}

/** Resumen de todas las tablas autorizadas (alimenta las tarjetas del frontend). */
export async function listarTablas() {
  const resumenes = await Promise.all(
    listarTablasAutorizadas().map(async (tabla) => {
      const base = {
        name: tabla.nombre,
        description: tabla.descripcion ?? null,
        endpoints: {
          metadata: `/api/tables/${tabla.nombre}/metadata`,
          data: `/api/tables/${tabla.nombre}/data`,
        },
      };

      try {
        const [metadatos, conteo] = await Promise.all([
          obtenerMetadatos(tabla),
          contarRegistros(tabla),
        ]);
        return {
          ...base,
          available: true,
          column_count: metadatos.columns.length,
          record_count: conteo.total,
          record_count_exact: conteo.exact,
        };
      } catch (error) {
        // Si cae la base de datos entera, se propaga (503). Si solo falta
        // esta tabla, se marca como no disponible y se siguen mostrando las demás.
        if (esErrorDeConexion(error)) throw error;
        if (error.code === 'TABLE_UNAVAILABLE') {
          return { ...base, available: false, column_count: null, record_count: null };
        }
        throw error;
      }
    })
  );
  return resumenes;
}

/** Metadatos completos de una tabla (estructura + descripción + conteo). */
export async function obtenerMetadatosCompletos(tabla) {
  const [metadatos, conteo] = await Promise.all([obtenerMetadatos(tabla), contarRegistros(tabla)]);
  return {
    table: tabla.nombre,
    description: tabla.descripcion ?? null,
    column_count: metadatos.columns.length,
    record_count: conteo.total,
    record_count_exact: conteo.exact,
    ...metadatos,
  };
}

/** Construye la cláusula ORDER BY (con la clave primaria como desempate). */
function construirOrderBy({ sort, order }, clavePrimaria) {
  const columnasOrden = [];
  if (sort) columnasOrden.push(`${citarIdentificador(sort)} ${order}`);

  // La clave primaria garantiza un orden estable entre páginas.
  for (const columna of clavePrimaria) {
    if (columna !== sort) {
      columnasOrden.push(`${citarIdentificador(columna)} ${sort ? 'ASC' : order}`);
    }
  }
  return columnasOrden.length > 0 ? `ORDER BY ${columnasOrden.join(', ')}` : '';
}

/**
 * Consulta los registros de una tabla con paginación y ordenamiento.
 * No depende de que el cliente haya pedido antes los metadatos.
 */
export async function obtenerRegistros(tabla, query) {
  const metadatos = await obtenerMetadatos(tabla);
  const nombresColumnas = metadatos.columns.map((c) => c.name);
  const opciones = validarParametrosDeConsulta(query, nombresColumnas, tabla);

  // Se listan las columnas explícitamente (nunca SELECT *).
  const listaColumnas = nombresColumnas.map(citarIdentificador).join(', ');
  const orderBy = construirOrderBy(opciones, metadatos.primary_key);
  const sql = `SELECT ${listaColumnas} FROM ${nombreCompleto(tabla)} ${orderBy} LIMIT $1 OFFSET $2`;

  const [conteo, resultado] = await Promise.all([
    contarRegistros(tabla),
    consultar(sql, [opciones.limit, opciones.offset]),
  ]);

  const totalPaginas = Math.ceil(conteo.total / opciones.limit);
  return {
    table: tabla.nombre,
    pagination: {
      page: opciones.page,
      limit: opciones.limit,
      total_records: conteo.total,
      total_records_exact: conteo.exact,
      total_pages: totalPaginas,
      has_previous: opciones.page > 1,
      has_next: opciones.page < totalPaginas,
    },
    query: {
      sort: opciones.sort ?? (metadatos.primary_key[0] ?? null),
      order: opciones.order,
    },
    data: resultado.rows,
  };
}