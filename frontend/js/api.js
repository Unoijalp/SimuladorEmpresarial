// =====================================================================
// js/api.js
// Único módulo que habla con la API. Si la API gratuita estaba "dormida"
// (tarda ~1 minuto en despertar), espera y reintenta, y avisa a la
// pantalla mediante el callback "alEsperar".
// =====================================================================
import { API_BASE_URL } from './config.js';

const TIEMPO_MAXIMO_MS = 75_000;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Construye la URL completa de un endpoint, con parámetros opcionales. */
export function apiUrl(ruta, query) {
  const url = new URL(API_BASE_URL.replace(/\/$/, '') + ruta);
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor !== undefined && valor !== '') url.searchParams.set(clave, valor);
  }
  return url.toString();
}

async function pedir(url, { reintentos = 2, alEsperar } = {}) {
  for (let intento = 0; ; intento++) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);
    try {
      const res = await fetch(url, { signal: control.signal, headers: { Accept: 'application/json' } });
      let cuerpo = null;
      try { cuerpo = await res.json(); } catch { /* respuesta sin JSON */ }
      if (res.ok) return cuerpo;

      const error = new Error(cuerpo?.error?.message ?? `Error HTTP ${res.status}`);
      error.status = res.status;
      error.code = cuerpo?.error?.code;
      // 503 = base de datos despertando: se reintenta.
      if (res.status === 503 && intento < reintentos) {
        alEsperar?.();
        await dormir(3000 * (intento + 1));
        continue;
      }
      throw error;
    } catch (error) {
      if (error.status) throw error; // error HTTP ya formado arriba
      if (intento < reintentos) {
        alEsperar?.();
        await dormir(3000 * (intento + 1));
        continue;
      }
      const sinRed = new Error('No se pudo contactar con la API. Verifica tu conexión o inténtalo de nuevo.');
      sinRed.network = true;
      throw sinRed;
    } finally {
      clearTimeout(reloj);
    }
  }
}

const ruta = (tabla, final) => `/api/tables/${encodeURIComponent(tabla)}/${final}`;

export const obtenerTablas = (opciones) => pedir(apiUrl('/api/tables'), opciones);
export const obtenerMetadatos = (tabla, opciones) => pedir(apiUrl(ruta(tabla, 'metadata')), opciones);
export const obtenerDatos = (tabla, query, opciones) => pedir(apiUrl(ruta(tabla, 'data'), query), opciones);