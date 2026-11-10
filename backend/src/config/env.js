// =====================================================================
// src/config/env.js
// Lee las variables de entorno UNA sola vez, las convierte a los tipos
// correctos y las expone en un objeto inmutable. El resto del código
// importa "env" en lugar de leer process.env directamente.
// =====================================================================
import 'dotenv/config';

/** Convierte un texto a entero; si no es válido devuelve el valor por defecto. */
const aEntero = (valor, porDefecto) => {
  const numero = Number.parseInt(valor, 10);
  return Number.isFinite(numero) ? numero : porDefecto;
};

/** Convierte "a, b, c" en ["a", "b", "c"], ignorando elementos vacíos. */
const aLista = (valor) =>
  (valor ?? '')
    .split(',')
    .map((elemento) => elemento.trim())
    .filter(Boolean);

const nodeEnv = process.env.NODE_ENV ?? 'development';
const esProduccion = nodeEnv === 'production';

export const env = Object.freeze({
  nodeEnv,
  esProduccion,
  puerto: aEntero(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigins: aLista(process.env.CORS_ORIGINS),

  // Paginación
  limitePorDefecto: aEntero(process.env.DEFAULT_PAGE_LIMIT, 100),
  limiteMaximo: aEntero(process.env.MAX_PAGE_LIMIT, 1000),

  // Límite de solicitudes
  rateLimitVentanaMs: aEntero(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMaximo: aEntero(process.env.RATE_LIMIT_MAX, 120),
  trustProxy: aEntero(process.env.TRUST_PROXY, esProduccion ? 1 : 0),

  // Base de datos
  dbTiempoConexionMs: aEntero(process.env.DB_CONNECTION_TIMEOUT_MS, 20_000),
  dbTiempoConsultaMs: aEntero(process.env.DB_QUERY_TIMEOUT_MS, 15_000),

  // Conteo y cachés
  umbralConteoExacto: aEntero(process.env.COUNT_EXACT_THRESHOLD, 50_000),
  cacheMetadatosSegundos: aEntero(process.env.METADATA_CACHE_TTL_SECONDS, 300),
  cacheConteoSegundos: aEntero(process.env.COUNT_CACHE_TTL_SECONDS, 60),

  // Claves de escritura (vacío = escritura deshabilitada)
  clavesEscritura: aLista(process.env.WRITE_API_KEYS),
});

// Validación mínima: sin base de datos la API no puede funcionar.
if (!env.databaseUrl) {
  console.error(
    '[CONFIG] Falta la variable DATABASE_URL. Copia .env.example como .env y complétala.'
  );
  process.exit(1);
}