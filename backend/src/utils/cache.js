// =====================================================================
// src/utils/cache.js
// Caché en memoria con tiempo de vida (TTL). Evita repetir consultas
// costosas al catálogo de PostgreSQL. Si varias solicitudes piden el
// mismo dato a la vez, solo se ejecuta UNA consulta y todas comparten
// el resultado.
// =====================================================================

export class CacheTTL {
  /** @param {number} ttlMs - Tiempo de vida de cada entrada, en milisegundos. */
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.entradas = new Map();
  }

  /**
   * Devuelve el valor en caché o lo calcula con la función indicada.
   * Si el cálculo falla, no se guarda nada y el error se propaga.
   */
  async obtenerOCalcular(clave, calcular) {
    const ahora = Date.now();
    const existente = this.entradas.get(clave);
    if (existente && existente.expira > ahora) {
      return existente.promesa;
    }

    const promesa = calcular();
    const entrada = { promesa, expira: ahora + this.ttlMs };
    this.entradas.set(clave, entrada);

    try {
      return await promesa;
    } catch (error) {
      if (this.entradas.get(clave) === entrada) this.entradas.delete(clave);
      throw error;
    }
  }

  /** Elimina una entrada (útil cuando el CRUD modifique datos). */
  invalidar(clave) {
    this.entradas.delete(clave);
  }

  /** Vacía toda la caché. */
  limpiar() {
    this.entradas.clear();
  }
}