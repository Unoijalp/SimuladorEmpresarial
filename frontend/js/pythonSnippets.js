// =====================================================================
// js/pythonSnippets.js
// Genera ejemplos de Python con la URL real y los parámetros actuales.
// Coinciden con el formato real de las respuestas de la API.
// =====================================================================

const MATRICES = `# DataFrame -> matriz NumPy
matriz = df.to_numpy()

# DataFrame -> lista de listas
matriz_lista = df.values.tolist()

# Nombres de columnas
columnas = df.columns.tolist()`;

/** Ejemplo para consultar SOLO los metadatos. */
export function pythonMetadatos(url) {
  return `import requests
import pandas as pd

url = "${url}"

response = requests.get(url)
response.raise_for_status()

metadata = response.json()["metadata"]

print(metadata["column_count"], "columnas")
print(pd.DataFrame(metadata["columns"])[["name", "type", "nullable", "primary_key"]])`;
}

/** Ejemplo para consultar SOLO los registros (url sin parámetros). */
export function pythonDatos(url, { page, limit, sort, order }) {
  const orden = sort ? `,\n        "sort": "${sort}",\n        "order": "${order}"` : '';
  return `import requests
import pandas as pd

url = "${url}"

response = requests.get(
    url,
    params={
        "page": ${page},
        "limit": ${limit}${orden}
    }
)
response.raise_for_status()

payload = response.json()
df = pd.DataFrame(payload["data"])

print(payload["pagination"])
print(df)

${MATRICES}`;
}