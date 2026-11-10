// =====================================================================
// src/controllers/table.controller.js
// Capa HTTP: recibe la solicitud, llama al servicio y arma la respuesta
// JSON. No contiene SQL ni reglas de negocio.
// =====================================================================
import * as tableService from '../services/table.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { errores } from '../utils/errors.js';

// GET /api/tables
export const listarTablas = asyncHandler(async (req, res) => {
  const tablas = await tableService.listarTablas();
  res.json({ success: true, count: tablas.length, tables: tablas });
});

// GET /api/tables/:table/metadata  (solo estructura, sin registros)
export const obtenerMetadatos = asyncHandler(async (req, res) => {
  const tabla = tableService.resolverTabla(req.params.table);
  const { table, ...metadata } = await tableService.obtenerMetadatosCompletos(tabla);
  res.json({ success: true, table, metadata });
});

// GET /api/tables/:table/data  (registros paginados)
export const obtenerRegistros = asyncHandler(async (req, res) => {
  const tabla = tableService.resolverTabla(req.params.table);
  const resultado = await tableService.obtenerRegistros(tabla, req.query);
  res.json({ success: true, ...resultado });
});

// ---------------------------------------------------------------------
// CRUD PREPARADO (aún no implementado). Cuando se implemente, cada
// función validará el cuerpo contra los metadatos, usará consultas
// parametrizadas y respetará tabla.escribible.
// ---------------------------------------------------------------------
const prepararEscritura = (req) => {
  tableService.resolverTabla(req.params.table); // 404 si no está autorizada
  throw errores.noImplementado(); // 501 hasta implementar
};

export const crearRegistro = asyncHandler(async (req) => prepararEscritura(req));
export const actualizarRegistro = asyncHandler(async (req) => prepararEscritura(req));
export const eliminarRegistro = asyncHandler(async (req) => prepararEscritura(req));