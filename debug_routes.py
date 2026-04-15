from main import app
for route in app.routes:
    methods = getattr(route, "methods", [])
    path = getattr(route, "path", "")
    print(f"{methods} {path}")
