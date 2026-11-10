# Julio & Asociados S.A. — Plataforma de datos (API REST + explorador web)

Plataforma para explorar y consumir tablas de PostgreSQL mediante una API REST.
Arquitectura desacoplada en tres componentes que se despliegan por separado:

| Componente | Tecnología | Alojamiento |
|---|---|---|
| Frontend | HTML5, CSS3, JavaScript (sin framework) | GitHub Pages |
| Backend | Node.js + Express | Render (Web Service) |
| Base de datos | PostgreSQL | Neon |

El frontend nunca contiene credenciales: solo conoce la URL pública de la API.
La base de datos solo es accesible desde el backend.

## Estructura

```text
julio-asociados/
├── frontend/          Sitio estático (index.html, explorer.html, css/, js/)
├── backend/           API (server.js, src/config, routes, controllers, services, ...)
├── tests/             verificar_api.py (pruebas de extremo a extremo)
├── .github/workflows/ deploy-frontend.yml (publica el frontend en GitHub Pages)
└── README.md
```

## Requisitos

Node.js 20 o superior, Git, Python 3 con `requests` y `pandas` (para las pruebas),
una base PostgreSQL (por ejemplo, Neon) y un rol de **solo lectura** para la API.

## Rol de solo lectura en PostgreSQL

```sql
CREATE ROLE app_lector WITH LOGIN PASSWORD 'CLAVE_LARGA_SOLO_LETRAS_Y_NUMEROS';
GRANT USAGE ON SCHEMA public TO app_lector;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_lector;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
    GRANT SELECT ON TABLES TO app_lector;
ALTER ROLE app_lector SET statement_timeout = '10s';
```

## Ejecución local

```bash
cd backend
npm install
cp .env.example .env      # completa DATABASE_URL con la cadena del rol app_lector
npm run dev               # http://localhost:3000
```

Frontend: abre la carpeta `frontend/` con Live Server de VS Code (puerto 5500).
No abras los archivos con doble clic: los módulos de JavaScript requieren http://.

## Variables de entorno del backend

| Variable | Descripción | Valor típico |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión (rol de solo lectura). **Secreto.** | `postgresql://app_lector:...@host/db?sslmode=require` |
| `CORS_ORIGINS` | Orígenes del frontend permitidos, separados por comas, sin ruta final | `https://usuario.github.io,http://localhost:5500` |
| `TRUST_PROXY` | Número de proxies delante de la API (calibrar con `/api/health?ip=true`) | `0` local; en Render se calibra |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Solicitudes por IP y ventana (ms) | `120` / `60000` |
| `DEFAULT_PAGE_LIMIT` / `MAX_PAGE_LIMIT` | Paginación | `100` / `1000` |
| `COUNT_EXACT_THRESHOLD` | Sobre este estimado no se hace `COUNT(*)` exacto | `50000` |
| `WRITE_API_KEYS` | Claves para POST/PUT/PATCH/DELETE. Vacío = escritura deshabilitada | vacío |

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Disponibilidad (`?deep=true` verifica la base; `?ip=true` muestra tu IP) |
| GET | `/api/tables` | Tablas autorizadas, con descripción, columnas y registros |
| GET | `/api/tables/:table/metadata` | Estructura: columnas, tipos, claves, restricciones y relaciones (sin registros) |
| GET | `/api/tables/:table/data` | Registros paginados: `page`, `limit`, `sort`, `order` |
| POST / PUT / PATCH / DELETE | `/api/tables/:table/data[/:id]` | Preparados; exigen clave de API; hoy responden 501 |

Errores: `{ "success": false, "error": { "code": "...", "message": "..." } }`
(400 parámetros inválidos, 401/403 sin autorización, 404 tabla no disponible, 429 límite, 503 base no disponible).

## Consumo desde Python

```python
import requests
import pandas as pd

base = "https://TU-API.onrender.com/api/tables/pedidos"

metadata = requests.get(f"{base}/metadata").json()["metadata"]
print(pd.DataFrame(metadata["columns"])[["name", "type", "nullable", "primary_key"]])

r = requests.get(f"{base}/data", params={"page": 1, "limit": 100})
r.raise_for_status()
df = pd.DataFrame(r.json()["data"])

matriz = df.to_numpy()
matriz_lista = df.values.tolist()
columnas = df.columns.tolist()
```

Nota: la primera consulta tras un periodo de inactividad puede tardar cerca de un minuto
(plan gratuito de Render). Usa un `timeout` generoso, por ejemplo `timeout=90`.

## Agregar una tabla nueva

1. Crea la tabla en PostgreSQL y dale `SELECT` al rol `app_lector`.
2. Agrega un objeto en `backend/src/config/tables.config.js` (nombre y descripción).
3. Haz push; Render redespliega y aparece una tarjeta nueva en el frontend sin tocarlo.

Se exponen todas las columnas de la tabla autorizada.

## Pruebas

```bash
python tests/verificar_api.py http://localhost:3000 --origen http://localhost:5500
python tests/verificar_api.py https://TU-API.onrender.com --origen https://USUARIO.github.io
```

## Despliegue

1. **Neon:** proyecto con la base y el rol `app_lector`.
2. **Render:** Web Service desde este repositorio con Root Directory `backend`,
   Build Command `npm install`, Start Command `npm start`, Health Check Path `/api/health`,
   y las variables de entorno de la tabla anterior.
3. **Frontend:** escribe la URL de Render en `frontend/js/config.js`, activa
   Settings > Pages > Source = GitHub Actions y haz push a `main`.
4. **CORS:** agrega el origen de GitHub Pages a `CORS_ORIGINS` en Render.

## Limitaciones del plan gratuito

- Render suspende el servicio tras 15 minutos sin tráfico; el primer arranque tarda cerca de un minuto.
- Neon suspende el cómputo tras 5 minutos sin actividad y se reactiva con la siguiente consulta.
- Neon Free ofrece 1 GB por proyecto; Render Free incluye 750 horas al mes.
- GitHub Pages no admite uso comercial como hosting gratuito de un negocio; si el proyecto se
  vuelve un producto, hay que migrar el frontend.

## Seguridad

- Las credenciales viven solo en variables de entorno del backend; `.env` está en `.gitignore`.
- El rol de la API es de solo lectura y con `statement_timeout`.
- Solo se atienden tablas de la lista blanca; identificadores validados y entrecomillados; valores parametrizados.
- CORS limitado al dominio del frontend; límite de solicitudes por IP; cabeceras `helmet`.
- Las rutas de escritura requieren clave de API y no están implementadas.