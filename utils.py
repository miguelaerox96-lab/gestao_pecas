def generate_part_search_index(part):
    """
    Generates a unified string for searching based on part fields.
    Accepts both a SQLAlchemy model instance or a dictionary.
    """
    if isinstance(part, dict):
        p_num = part.get('part_number') or ''
        brand = part.get('brand') or ''
        model = part.get('model') or ''
        desc = part.get('description') or ''
        dyn = part.get('dynamic_data') or {}
    else:
        p_num = getattr(part, 'part_number', '') or ''
        brand = getattr(part, 'brand', '') or ''
        model = getattr(part, 'model', '') or ''
        desc = getattr(part, 'description', '') or ''
        dyn = getattr(part, 'dynamic_data', {}) or {}

    dynamic_values = " ".join([str(v) for v in dyn.values()]) if dyn else ""
    return f"{p_num} {brand} {model} {desc} {dynamic_values}".strip().lower()

def generate_vehicle_search_index(vehicle):
    """
    Generates a unified string for searching based on vehicle fields.
    Accepts both a SQLAlchemy model instance or a dictionary.
    """
    if isinstance(vehicle, dict):
        vin = vehicle.get('vin') or ''
        make = vehicle.get('make') or ''
        model = vehicle.get('model') or ''
        desc = vehicle.get('description') or ''
        engine = vehicle.get('engine') or ''
    else:
        vin = getattr(vehicle, 'vin', '') or ''
        make = getattr(vehicle, 'make', '') or ''
        model = getattr(vehicle, 'model', '') or ''
        desc = getattr(vehicle, 'description', '') or ''
        engine = getattr(vehicle, 'engine', '') or ''
    
    return f"{vin} {make} {model} {desc} {engine}".strip().lower()
