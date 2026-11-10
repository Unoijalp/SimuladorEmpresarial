// =====================================================================
// src/utils/sql.js
// Utilidades para construir SQL de forma segura.
// Los VALORES siempre viajan como parámetros ($1, $2...). Los
// IDENTIFICADORES (tablas, columnas) no pueden parametrizarse en
// PostgreSQL, por eso solo se usan nombres que vienen de la lista
// blanca o del catálogo de la base de datos, y además se entrecomillan.
// =====================================================================

const PATRON_IDENTIFICADOR = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Verifica que un texto tenga forma de identificador SQL simple (máx. 63 caracteres). */
export function esIdentificadorValido(nombre) {
  return typeof nombre === 'string' && nombre.length <= 63 && PATRON_IDENTIFICADOR.test(nombre);
}

/** Entrecomilla un identificador: usuarios -> "usuarios". Duplica comillas internas. */
export function citarIdentificador(nombre) {
  return `"${String(nombre).replace(/"/g, '""')}"`;
}

/** Devuelve "esquema"."tabla" listo para usar dentro de una consulta. */
export function nombreCompleto(tabla) {
  return `${citarIdentificador(tabla.esquema)}.${citarIdentificador(tabla.nombre)}`;
}