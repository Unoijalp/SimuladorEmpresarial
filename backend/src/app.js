// =====================================================================
// src/app.js
// Construye y configura la aplicación Express (sin ponerla a escuchar;
// eso lo hace server.js). El ORDEN de los middleware importa.
// =====================================================================
import express from 'express';
import { env } from './config/env.js';
import rutas from './routes/index.js';
import {
  cabecerasDeSeguridad,
  politicaCors,
  limitadorDeSolicitudes,
} from './middleware/security.middleware.js';
import { manejarErrores, manejarRutaNoEncontrada } from './middleware/error.middleware.js';

const app = express();

// Detrás del proxy de Render, la IP real del cliente viene en X-Forwarded-For.
app.set('trust proxy', env.trustProxy);

app.use(cabecerasDeSeguridad);
app.use(politicaCors);
app.use(limitadorDeSolicitudes);
app.use(express.json({ limit: '100kb' }));

// Información básica en la raíz (útil para comprobar que el servicio vive).
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'Julio & Asociados S.A. - API REST',
    endpoints: ['/api/health', '/api/tables', '/api/tables/:table/metadata', '/api/tables/:table/data'],
  });
});

app.use('/api', rutas);

// Siempre al final: rutas inexistentes y manejo central de errores.
app.use(manejarRutaNoEncontrada);
app.use(manejarErrores);

export default app;