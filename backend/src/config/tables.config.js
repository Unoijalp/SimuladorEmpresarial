// =====================================================================
// src/config/tables.config.js
// LISTA BLANCA de tablas que la API puede exponer.
//
// Para habilitar una tabla nueva: agrega un objeto a TABLAS_AUTORIZADAS
// y reinicia el backend. Aparecerá sola en el frontend (GET /api/tables).
// Una tabla que NO esté en esta lista es inalcanzable desde la API,
// aunque exista en la base de datos.
//
// Campos de cada tabla:
//   nombre        Nombre real de la tabla en PostgreSQL.
//   esquema       Esquema de PostgreSQL (por defecto "public").
//   descripcion   Texto que se muestra en la tarjeta y en los metadatos.
//   escribible    Reservado para el CRUD (false = solo lectura).
//   limiteMaximo  (opcional) Máximo de registros por página para esta tabla.
// =====================================================================
import { esIdentificadorValido } from '../utils/sql.js';

export const ESQUEMA_POR_DEFECTO = 'public';

export const TABLAS_AUTORIZADAS = [
  {
    nombre: 'unidades_medida',
    descripcion:
      'Catálogo de unidades de medida (masa, longitud, tiempo, cantidad y volumen).',
    escribible: false,
  },
  {
    nombre: 'clientes',
    descripcion: 'Clientes de la empresa, con su ubicación geográfica.',
    escribible: false,
  },
  {
    nombre: 'productos',
    descripcion:
      'Productos fabricados: costos, precios, peso y dimensiones con sus unidades.',
    escribible: false,
  },
  {
    nombre: 'maquinas',
    descripcion: 'Máquinas disponibles en la planta de producción.',
    escribible: false,
  },
  {
    nombre: 'pedidos',
    descripcion:
      'Pedidos de clientes (un pedido corresponde a un producto) con su tiempo de preparación.',
    escribible: false,
  },
  {
    nombre: 'tiempos_fabricacion',
    descripcion:
      'Tiempo unitario de fabricación de cada pedido en cada máquina.',
    escribible: false,
  },
];

// ---------------------------------------------------------------------
// Índice por nombre para búsquedas rápidas. Se construye al arrancar y
// valida que los nombres de la lista blanca sean identificadores SQL
// seguros (si no, el servidor se detiene antes de atender solicitudes).
// ---------------------------------------------------------------------
const indicePorNombre = new Map();

for (const tabla of TABLAS_AUTORIZADAS) {
  const esquema = tabla.esquema ?? ESQUEMA_POR_DEFECTO;
  if (!esIdentificadorValido(tabla.nombre) || !esIdentificadorValido(esquema)) {
    throw new Error(`Nombre de tabla o esquema inválido en tables.config.js: ${tabla.nombre}`);
  }
  indicePorNombre.set(tabla.nombre, Object.freeze({ ...tabla, esquema }));
}

/**
 * Busca una tabla autorizada por su nombre exacto.
 * @returns {object|undefined} La configuración, o undefined si no está autorizada.
 */
export function buscarTablaAutorizada(nombre) {
  return typeof nombre === 'string' ? indicePorNombre.get(nombre) : undefined;
}

/** Devuelve todas las tablas autorizadas (ya normalizadas). */
export function listarTablasAutorizadas() {
  return [...indicePorNombre.values()];
}