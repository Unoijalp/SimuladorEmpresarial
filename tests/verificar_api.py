#!/usr/bin/env python3
# =====================================================================
# tests/verificar_api.py
# Pruebas de extremo a extremo de la API de Julio & Asociados S.A.
# Recorre TODAS las tablas que devuelve /api/tables, así que si agregas
# una tabla nueva en el backend, queda probada automáticamente.
#
# Uso:
#   pip install requests pandas
#   python tests/verificar_api.py http://localhost:3000
#   python tests/verificar_api.py http://localhost:3000 --origen http://localhost:5500
#   python tests/verificar_api.py https://tu-api.onrender.com --origen https://usuario.github.io
#
# Código de salida: 0 = todo bien, 1 = hubo fallos, 2 = no se pudo conectar.
# =====================================================================
import argparse
import math
import sys
import time

import requests

try:
    import pandas as pd
except ImportError:  # pandas es opcional: solo afecta a la prueba de DataFrame
    pd = None

TIPOS_NUMERICOS = {"bigint", "integer", "smallint", "numeric", "double precision", "real"}


class Verificador:
    def __init__(self, base, origen, timeout):
        self.base = base.rstrip("/")
        self.origen = origen
        self.timeout = timeout
        self.sesion = requests.Session()
        self.exitos = 0
        self.fallos = []

    # ---------- Utilidades ------------------------------------------
    def pedir(self, metodo, ruta, **kwargs):
        """Hace una solicitud; si la API está despertando (503), reintenta."""
        for intento in range(4):
            try:
                r = self.sesion.request(metodo, self.base + ruta, timeout=self.timeout, **kwargs)
                if r.status_code == 429 and intento < 3:
                    # Límite de solicitudes: se espera a que se reinicie la ventana.
                    espera = min(int(r.headers.get("RateLimit-Reset", 30)) + 1, 65)
                    print(f"   (429: límite de solicitudes; espero {espera} s...)")
                    time.sleep(espera)
                    continue
                if r.status_code == 503 and intento < 3:
                    print(f"   (503: la API está despertando; reintento {intento + 1}/3...)")
                    time.sleep(5 * (intento + 1))
                    continue
                return r
            except requests.exceptions.RequestException:
                if intento == 3:
                    raise
                print(f"   (sin respuesta; reintento {intento + 1}/3...)")
                time.sleep(5)

    def get(self, ruta, **kwargs):
        return self.pedir("GET", ruta, **kwargs)

    def comprobar(self, descripcion, condicion, detalle=""):
        if condicion:
            self.exitos += 1
            print(f"  [OK]    {descripcion}")
        else:
            self.fallos.append(descripcion)
            print(f"  [FALLO] {descripcion}" + (f"  -> {detalle}" if detalle else ""))

    # ---------- Bloques de pruebas ----------------------------------
    def disponibilidad(self):
        print("\n1. Disponibilidad")
        r = self.get("/api/health")
        self.comprobar("GET /api/health responde 200 con status ok",
                       r.status_code == 200 and r.json().get("status") == "ok")
        r = self.get("/api/health", params={"deep": "true"})
        self.comprobar("GET /api/health?deep=true confirma la base de datos",
                       r.status_code == 200 and r.json().get("database", {}).get("status") == "ok",
                       f"{r.status_code} {r.text[:150]}")
        self.comprobar("Cabecera de seguridad X-Content-Type-Options presente",
                       r.headers.get("X-Content-Type-Options") == "nosniff")
        self.comprobar("Límite de solicitudes informado (cabecera RateLimit-Limit)",
                       "RateLimit-Limit" in r.headers)

    def listado(self):
        print("\n2. Listado dinámico de tablas")
        inicio = time.perf_counter()
        r = self.get("/api/tables")
        ms = round((time.perf_counter() - inicio) * 1000)
        js = r.json()
        self.comprobar(f"GET /api/tables responde 200 ({ms} ms)", r.status_code == 200 and js.get("success"))
        tablas = js.get("tables", [])
        self.comprobar("count coincide con la cantidad de tablas y hay al menos una",
                       js.get("count") == len(tablas) > 0)
        campos = {"name", "description", "available", "column_count", "record_count", "endpoints"}
        self.comprobar("Cada tabla trae nombre, descripción, disponibilidad, columnas y registros",
                       bool(tablas) and all(campos <= set(t) for t in tablas))
        no_disp = [t["name"] for t in tablas if not t["available"]]
        self.comprobar("Todas las tablas figuran como disponibles", bool(tablas) and not no_disp,
                       f"no disponibles: {no_disp}")
        return [t for t in tablas if t["available"]]

    def probar_tabla(self, t):
        nombre = t["name"]
        etiqueta = f"[{nombre}]"
        base = f"/api/tables/{nombre}"
        print(f"\n3. Tabla {nombre}")

        # --- Nivel 1: metadatos (independiente de los datos) ---
        r = self.get(base + "/metadata")
        js = r.json()
        self.comprobar(f"{etiqueta} metadatos: 200 y success", r.status_code == 200 and js.get("success"))
        meta = js["metadata"]
        columnas = meta["columns"]
        nombres = [c["name"] for c in columnas]
        self.comprobar(f"{etiqueta} metadatos NO incluyen registros", "data" not in js and "data" not in meta)
        self.comprobar(f"{etiqueta} column_count coincide con el listado y con las columnas",
                       meta["column_count"] == len(columnas) == t["column_count"])
        self.comprobar(f"{etiqueta} tiene clave primaria", len(meta["primary_key"]) > 0)
        self.comprobar(f"{etiqueta} cada columna trae tipo y nulabilidad",
                       all("type" in c and "nullable" in c for c in columnas))
        pk = meta["primary_key"][0]

        # --- Nivel 2: datos (independiente de los metadatos) ---
        total = t["record_count"] or 0
        limite = max(1, min(1000, math.ceil(max(total, 1) / 3)))
        filas, ultima = [], None
        for pagina in range(1, 5):
            r = self.get(base + "/data", params={"page": pagina, "limit": limite})
            if r.status_code != 200:
                self.comprobar(f"{etiqueta} datos página {pagina}: 200", False, f"{r.status_code} {r.text[:120]}")
                return
            js = r.json()
            filas += js["data"]
            ultima = js["pagination"]
            if not ultima["has_next"]:
                break
        self.comprobar(f"{etiqueta} datos: no incluyen metadatos", "metadata" not in js)
        if filas:
            self.comprobar(f"{etiqueta} las columnas de los datos coinciden con los metadatos",
                           list(filas[0].keys()) == nombres)
        ids = [f[pk] for f in filas]
        self.comprobar(f"{etiqueta} paginación sin duplicados ni saltos de orden",
                       len(set(ids)) == len(ids) and ids == sorted(ids))
        if not ultima["has_next"] and ultima["total_records_exact"]:
            self.comprobar(f"{etiqueta} suma de páginas = total_records ({ultima['total_records']})",
                           len(filas) == ultima["total_records"], f"se leyeron {len(filas)}")

        # --- Ordenamiento ---
        r = self.get(base + "/data", params={"sort": pk, "order": "DESC", "limit": limite})
        ids_desc = [f[pk] for f in r.json().get("data", [])]
        self.comprobar(f"{etiqueta} orden descendente por {pk}",
                       r.status_code == 200 and ids_desc == sorted(ids_desc, reverse=True))
        otras = [n for n in nombres if n != pk]
        if otras:
            r = self.get(base + "/data", params={"sort": otras[-1], "limit": 5})
            self.comprobar(f"{etiqueta} ordenar por otra columna ({otras[-1]}) funciona", r.status_code == 200)

        # --- Python / pandas ---
        if pd is None:
            print(f"  [OMITIDA] {etiqueta} prueba de DataFrame (instala pandas: pip install pandas)")
        elif filas:
            df = pd.DataFrame(filas)
            self.comprobar(f"{etiqueta} DataFrame -> to_numpy() y values.tolist() con la forma correcta",
                           df.to_numpy().shape == (len(filas), len(nombres))
                           and len(df.values.tolist()) == len(filas))
            malos = [c["name"] for c in columnas
                     if c["type"] in TIPOS_NUMERICOS and df[c["name"]].notna().all()
                     and not pd.api.types.is_numeric_dtype(df[c["name"]])]
            self.comprobar(f"{etiqueta} columnas numéricas llegan como números a pandas", not malos, f"{malos}")

    def parametros_invalidos(self, tabla):
        print("\n4. Validación y seguridad")
        pk = "id"
        casos = {
            "limit=0": {"limit": 0},
            "limit por encima del máximo": {"limit": 100000},
            "page no numérica": {"page": "abc"},
            "page=0": {"page": 0},
            "sort con intento de inyección SQL": {"sort": f"{pk}; DROP TABLE x"},
            "order inválido": {"order": "DESC;--"},
        }
        for descripcion, params in casos.items():
            r = self.get(f"/api/tables/{tabla}/data", params=params)
            ok = r.status_code == 400 and r.json().get("success") is False and "code" in r.json().get("error", {})
            self.comprobar(f"Se rechaza {descripcion} con 400", ok, f"{r.status_code}")

        for descripcion, ruta in {
            "tabla inexistente": "/api/tables/no_existe/metadata",
            "esquema del sistema (pg_catalog.pg_user)": "/api/tables/pg_catalog.pg_user/data",
            "nombre de tabla con inyección SQL": "/api/tables/clientes%3BDROP%20TABLE%20clientes/data",
            "ruta inexistente": "/api/nada",
        }.items():
            r = self.get(ruta)
            self.comprobar(f"Respuesta 404 ante {descripcion}", r.status_code == 404 and r.json().get("success") is False,
                           f"{r.status_code}")

        for metodo in ("POST", "PATCH", "DELETE"):
            ruta = f"/api/tables/{tabla}/data" + ("" if metodo == "POST" else "/1")
            r = self.pedir(metodo, ruta, json={"x": 1})
            self.comprobar(f"{metodo} sin clave de API es rechazado (401/403)", r.status_code in (401, 403),
                           f"{r.status_code}")

    def cors(self):
        if not self.origen:
            print("\n5. CORS: omitido (indica --origen para probarlo)")
            return
        print("\n5. CORS")
        r = self.get("/api/tables", headers={"Origin": self.origen})
        self.comprobar(f"Origen autorizado {self.origen} recibe Access-Control-Allow-Origin",
                       r.headers.get("Access-Control-Allow-Origin") == self.origen,
                       f"recibido: {r.headers.get('Access-Control-Allow-Origin')}")
        r = self.get("/api/tables", headers={"Origin": "https://sitio-no-autorizado.example"})
        self.comprobar("Un origen NO autorizado no recibe la cabecera CORS",
                       "Access-Control-Allow-Origin" not in r.headers)

    def ejecutar(self):
        self.disponibilidad()
        tablas = self.listado()
        for t in tablas:
            self.probar_tabla(t)
        if tablas:
            self.parametros_invalidos(tablas[0]["name"])
        self.cors()


def main():
    parser = argparse.ArgumentParser(description="Pruebas de extremo a extremo de la API.")
    parser.add_argument("url", help="URL base de la API, p. ej. http://localhost:3000")
    parser.add_argument("--origen", help="Origen del frontend a probar con CORS, p. ej. http://localhost:5500")
    parser.add_argument("--timeout", type=int, default=90, help="Segundos máximos por solicitud (por defecto 90)")
    args = parser.parse_args()

    v = Verificador(args.url, args.origen, args.timeout)
    print(f"Verificando {v.base} ...")
    try:
        v.ejecutar()
    except requests.exceptions.RequestException as error:
        print(f"\nNo se pudo contactar con la API: {error}")
        return 2

    print("\n" + "=" * 60)
    print(f"Resultado: {v.exitos} pruebas correctas, {len(v.fallos)} con fallos")
    for f in v.fallos:
        print(f"  - {f}")
    return 0 if not v.fallos else 1


if __name__ == "__main__":
    sys.exit(main())