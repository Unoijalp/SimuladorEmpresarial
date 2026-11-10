import requests, pandas as pd

base = "http://localhost:3000/api/tables/pedidos"

metadata = requests.get(f"{base}/metadata"); metadata.raise_for_status()
print([c["name"] for c in metadata.json()["metadata"]["columns"]])

respuesta = requests.get(f"{base}/data", params={"page": 1, "limit": 100})
respuesta.raise_for_status()
df = pd.DataFrame(respuesta.json()["data"])
print(df.dtypes)