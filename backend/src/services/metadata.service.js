// =====================================================================
// src/services/metadata.service.js
// Obtiene la ESTRUCTURA de una tabla (columnas, tipos, claves,
// restricciones y relaciones) consultando el catálogo de PostgreSQL.
// Nunca lee los registros de la tabla. El resultado se guarda en una
// caché en memoria para no repetir consultas al catálogo.
// =====================================================================
import { consultar } from '../config/database.js';
import { env } from '../config/env.js';
import { buscarTablaAutorizada } from '../config/tables.config.js';
import { CacheTTL } from '../utils/cache.js';
import { errores } from '../utils/errors.js';

const cache = new CacheTTL(env.cacheMetadatosSegundos * 1000);

// Acciones referenciales de las llaves foráneas (códigos de pg_constraint).
const ACCIONES_FK = {
  a: 'NO ACTION',
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};

// --- Consulta 1: columnas -------------------------------------------
const SQL_COLUMNAS = `
  SELECT column_name,
         data_type,
         character_maximum_length,
         numeric_precision,
         numeric_scale,
         is_nullable,
         column_default,
         is_identity
  FROM information_schema.columns
  WHERE table_schema = $1 AND table_name = $2
  ORDER BY ordinal_position
`;

// --- Consulta 2: restricciones de la tabla (PK, FK, UNIQUE, CHECK) ----
const SQL_RESTRICCIONES = `
  SELECT con.conname::text AS nombre,
         con.contype::text AS tipo,
         ARRAY(
           SELECT a.attname::text
           FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, orden)
           JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
           ORDER BY k.orden
         ) AS columnas,
         fns.nspname::text AS esquema_referenciado,
         fcls.relname::text AS tabla_referenciada,
         ARRAY(
           SELECT a.attname::text
           FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, orden)
           JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum
           ORDER BY k.orden
         ) AS columnas_referenciadas,
         con.confupdtype::text AS accion_update,
         con.confdeltype::text AS accion_delete,
         pg_get_constraintdef(con.oid) AS definicion
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  LEFT JOIN pg_class fcls ON fcls.oid = con.confrelid
  LEFT JOIN pg_namespace fns ON fns.oid = fcls.relnamespace
  WHERE ns.nspname = $1
    AND cls.relname = $2
    AND con.contype IN ('p', 'f', 'u', 'c')
  ORDER BY con.contype, con.conname
`;

// --- Consulta 3: llaves foráneas de OTRAS tablas que apuntan a esta ---
const SQL_REFERENCIADA_POR = `
  SELECT con.conname::text AS nombre,
         cls.relname::text AS tabla,
         ARRAY(
           SELECT a.attname::text
           FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, orden)
           JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
           ORDER BY k.orden
         ) AS columnas,
         ARRAY(
           SELECT a.attname::text
           FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, orden)
           JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum
           ORDER BY k.orden
         ) AS columnas_referenciadas
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  JOIN pg_class fcls ON fcls.oid = con.confrelid
  JOIN pg_namespace fns ON fns.oid = fcls.relnamespace
  WHERE con.contype = 'f'
    AND fns.nspname = $1
    AND fcls.relname = $2
    AND ns.nspname = $1
  ORDER BY cls.relname, con.conname
`;

/** Lee el catálogo y arma el objeto de metadatos de una tabla. */
async function cargarMetadatos(tabla) {
  const parametros = [tabla.esquema, tabla.nombre];

  const [columnasRes, restriccionesRes, referenciadaRes] = await Promise.all([
    consultar(SQL_COLUMNAS, parametros),
    consultar(SQL_RESTRICCIONES, parametros),
    consultar(SQL_REFERENCIADA_POR, parametros),
  ]);

  // Sin columnas = la tabla no existe (o el rol no tiene permiso sobre ella).
  if (columnasRes.rowCount === 0) throw errores.tablaNoDisponible();

  const restricciones = restriccionesRes.rows;
  const clavePrimaria = restricciones.find((r) => r.tipo === 'p')?.columnas ?? [];
  const llavesForaneas = restricciones.filter((r) => r.tipo === 'f');
  const unicas = restricciones.filter((r) => r.tipo === 'u');
  const checks = restricciones.filter((r) => r.tipo === 'c');

  // Columnas con restricción UNIQUE de una sola columna.
  const columnasUnicas = new Set(
    unicas.filter((u) => u.columnas.length === 1).map((u) => u.columnas[0])
  );

  const columnas = columnasRes.rows.map((c, indice) => {
    const fk = llavesForaneas.find((f) => f.columnas.includes(c.column_name));
    const posicionEnFk = fk ? fk.columnas.indexOf(c.column_name) : -1;
    const esNumeric = c.data_type === 'numeric';

    return {
      position: indice + 1,
      name: c.column_name,
      type: c.data_type,
      max_length: c.character_maximum_length,
      numeric_precision: esNumeric ? c.numeric_precision : null,
      numeric_scale: esNumeric ? c.numeric_scale : null,
      nullable: c.is_nullable === 'YES',
      default: c.column_default,
      identity: c.is_identity === 'YES',
      primary_key: clavePrimaria.includes(c.column_name),
      unique: columnasUnicas.has(c.column_name),
      foreign_key: Boolean(fk),
      references: fk
        ? {
            schema: fk.esquema_referenciado,
            table: fk.tabla_referenciada,
            column: fk.columnas_referenciadas[posicionEnFk],
          }
        : null,
    };
  });

  return {
    schema: tabla.esquema,
    primary_key: clavePrimaria,
    columns: columnas,
    constraints: {
      unique: unicas.map((u) => ({ name: u.nombre, columns: u.columnas })),
      check: checks.map((c) => ({ name: c.nombre, definition: c.definicion })),
    },
    relations: {
      // A qué tablas apunta esta tabla.
      references: llavesForaneas.map((f) => ({
        constraint: f.nombre,
        columns: f.columnas,
        referenced_table: f.tabla_referenciada,
        referenced_columns: f.columnas_referenciadas,
        on_update: ACCIONES_FK[f.accion_update] ?? null,
        on_delete: ACCIONES_FK[f.accion_delete] ?? null,
      })),
      // Qué tablas AUTORIZADAS apuntan a esta (se omiten las no expuestas
      // para no revelar la existencia de otras tablas).
      referenced_by: referenciadaRes.rows
        .filter((r) => buscarTablaAutorizada(r.tabla))
        .map((r) => ({
          constraint: r.nombre,
          table: r.tabla,
          columns: r.columnas,
          referenced_columns: r.columnas_referenciadas,
        })),
    },
  };
}

/**
 * Devuelve los metadatos (estructura) de una tabla autorizada.
 * Usa caché; lanza TABLE_UNAVAILABLE si la tabla no existe en la base.
 */
export function obtenerMetadatos(tabla) {
  return cache.obtenerOCalcular(`${tabla.esquema}.${tabla.nombre}`, () => cargarMetadatos(tabla));
}