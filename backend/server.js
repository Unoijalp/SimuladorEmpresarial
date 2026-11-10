// =====================================================================
// server.js
// Punto de entrada: pone la aplicación a escuchar y gestiona el
// apagado ordenado (Render envía SIGTERM al reiniciar o redesplegar).
// =====================================================================
import { env } from './src/config/env.js';
import app from './src/app.js';
import { cerrarPool, consultar } from './src/config/database.js';

const servidor = app.listen(env.puerto, () => {
  console.log(`[API] Escuchando en el puerto ${env.puerto} (${env.nodeEnv})`);

  // "Despierta" la base de datos al arrancar, sin bloquear el servidor.
  consultar('SELECT 1')
    .then(() => console.log('[DB] Conexión con PostgreSQL verificada.'))
    .catch((error) => console.error('[DB] No se pudo conectar al arrancar:', error.message));
});

/** Cierra el servidor HTTP y el pool de conexiones antes de salir. */
function apagar(senal) {
  console.log(`[API] ${senal} recibido. Cerrando...`);
  servidor.close(async () => {
    await cerrarPool().catch(() => {});
    process.exit(0);
  });
  // Si algo queda colgado, se fuerza la salida a los 10 segundos.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
process.on('unhandledRejection', (motivo) => console.error('[API] Promesa rechazada sin manejar:', motivo));