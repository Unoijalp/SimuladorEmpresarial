// =====================================================================
// js/config.js
// Configuración pública del frontend. La URL de la API NO es un secreto.
// Aquí nunca van contraseñas ni claves.
//
// Detección automática del entorno:
//   - Desarrollo (localhost o una IP de red local, p. ej. 192.168.x.x):
//     el backend está en el puerto 3000 de la MISMA máquina que sirve la
//     página. Así también funciona desde un teléfono en tu Wi-Fi.
//   - Producción (cualquier otro dominio, p. ej. usuario.github.io):
//     se usa la URL pública del backend. Cámbiala en la Etapa 5.
// =====================================================================
const URL_API_PRODUCCION = 'https://TU-API.onrender.com';

const { hostname } = window.location;
const esDesarrollo =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);

export const API_BASE_URL = esDesarrollo ? `http://${hostname}:3000` : URL_API_PRODUCCION;