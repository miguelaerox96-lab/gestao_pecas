"""
Script para limpar a base de dados, mantendo apenas marcas e localizacoes.
Apaga: parts, part_types, type_fields, inquiries, history, vehicles
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Part, PartType, TypeField, Inquiry, HistoryRecord, Vehicle, User

def clear_data():
    db = SessionLocal()
    try:
        counts_before = {
            "parts": db.query(Part).count(),
            "part_types": db.query(PartType).count(),
            "type_fields": db.query(TypeField).count(),
            "inquiries": db.query(Inquiry).count(),
            "history": db.query(HistoryRecord).count(),
            "vehicles": db.query(Vehicle).count(),
            "users": db.query(User).count(),
        }
        print("=== Antes da limpeza ===")
        for table, count in counts_before.items():
            print(f"  {table}: {count} registos")

        print("\nA limpar dados...")

        db.query(Inquiry).delete()
        db.query(HistoryRecord).delete()
        db.query(Part).delete()
        db.query(TypeField).delete()
        db.query(PartType).delete()
        db.query(Vehicle).delete()

        db.commit()

        counts_after = {
            "parts": db.query(Part).count(),
            "part_types": db.query(PartType).count(),
            "type_fields": db.query(TypeField).count(),
            "inquiries": db.query(Inquiry).count(),
            "history": db.query(HistoryRecord).count(),
            "vehicles": db.query(Vehicle).count(),
            "users": db.query(User).count(),
        }
        print("\n=== Depois da limpeza ===")
        for table, count in counts_after.items():
            print(f"  {table}: {count} registos")

        print("\nLimpeza concluida! Marcas e localizacoes mantidas.")

    except Exception as e:
        db.rollback()
        print(f"\nERRO: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    resposta = input("Tens a certeza que queres apagar todos os dados (exceto marcas e localizacoes)? [s/N]: ")
    if resposta.strip().lower() == "s":
        clear_data()
    else:
        print("Operacao cancelada.")
