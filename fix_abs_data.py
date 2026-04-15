from database import SessionLocal
import models

def fix_abs_type():
    db = SessionLocal()
    try:
        # Find ABS type
        abs_type = db.query(models.PartType).filter(models.PartType.name == "ABS").first()
        if not abs_type:
            print("Type 'ABS' not found.")
            return

        # Find 'Referência' field in ABS type
        ref_field = next((f for f in abs_type.fields if f.name == "Referência"), None)
        if not ref_field:
            print("Field 'Referência' not found in ABS type.")
            # Note: Maybe it's without accent or something?
            # Let's check all fields
            for f in abs_type.fields:
                print(f"Found field: '{f.name}' (Required: {f.required_field})")
            return

        print(f"Updating '{ref_field.name}' in 'ABS' to Required=True...")
        ref_field.required_field = True
        db.commit()
        print("Done.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_abs_type()
