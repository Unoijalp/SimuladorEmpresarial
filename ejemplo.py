import requests
import pandas as pd

url = "https://simuladorempresarial.onrender.com/api/tables/unidades_medida/data"

response = requests.get(
    url,
    params={
        "page": 1,
        "limit": 100
    }
)
response.raise_for_status()

payload = response.json()
df = pd.DataFrame(payload["data"])

print(payload["pagination"])
print(df)

# DataFrame -> matriz NumPy
matriz = df.to_numpy()

# DataFrame -> lista de listas
matriz_lista = df.values.tolist()

# Nombres de columnas
columnas = df.columns.tolist()