import requests
import json

BASE_URL = "http://localhost:8000"

# 1. Check if route exists (GET error is expected if POST only)
r = requests.get(f"{BASE_URL}/maintenance/clear")
print(f"GET /maintenance/clear: {r.status_code}")

# 2. Try POST without Auth (should be 401/403)
r = requests.post(f"{BASE_URL}/maintenance/clear", json={"mode": "partial"})
print(f"POST /maintenance/clear (No Auth): {r.status_code} - {r.text}")
