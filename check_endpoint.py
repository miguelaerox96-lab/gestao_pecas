import requests
try:
    r = requests.get("http://localhost:8000/brands")
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text[:100]}")
except Exception as e:
    print(f"Error: {e}")
