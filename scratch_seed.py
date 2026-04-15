import sys
import os
from sqlalchemy.orm import Session
from main import engine, models

# Mock Parts Data
def seed_mock_parts():
    with Session(engine) as db:
        part_types = db.query(models.PartType).all()
        type_map = {t.name: t.id for t in part_types}

        if not type_map:
            print("No part types found. Seed DB first.")
            return

        mock_parts = [
            models.Part(
                part_number="MTR-001", location="Corredor A1",
                type_id=type_map.get("Motor"), brand="BMW", model="Série 3 (E90)", year="2005-2011",
                price=1200.50, description="Motor completo N47. A trabalhar certinho.", 
                status="Available", dynamic_data={"Cilindrada (cc)": "1995", "Combustível": "Diesel", "Quilometragem": "180000"}
            ),
            models.Part(
                part_number="MTR-002", location="Corredor A2",
                type_id=type_map.get("Motor"), brand="Audi", model="A4", year="2012-2015",
                price=1450.00, description="Motor TFSI. Bloco em bom estado.", 
                status="Available", dynamic_data={"Cilindrada (cc)": "1798", "Combustível": "Gasolina", "Quilometragem": "155000"}
            ),
            models.Part(
                part_number="CX-540", location="Corredor B1",
                type_id=type_map.get("Caixa de Velocidades"), brand="Mercedes-Benz", model="Classe C (W204)", year="2007-2014",
                price=850.00, description="Caixa manual de 6 velocidades testada.", 
                status="Available", dynamic_data={"Tipo": "Manual", "Nº Velocidades": "6"}
            ),
            models.Part(
                part_number="PRT-11A", location="Estante 3",
                type_id=type_map.get("Porta"), brand="VW", model="Golf VII", year="2013-2020",
                price=150.00, description="Porta completa, inclui vidro e elevador.", 
                status="Available", dynamic_data={"Lado/Posição": "Frente Direita", "Cor": "Branco"}
            ),
            models.Part(
                part_number="PRT-12B", location="Estante 3",
                type_id=type_map.get("Porta"), brand="Renault", model="Clio IV", year="2012-2019",
                price=120.00, description="Pequeno risco visível na foto.", 
                status="Available", dynamic_data={"Lado/Posição": "Traseira Esquerda", "Cor": "Preto"}
            ),
            models.Part(
                part_number="FRL-88", location="Prateleira F",
                type_id=type_map.get("Farol"), brand="Peugeot", model="208", year="2012-2019",
                price=85.00, description="Apoios todos impecáveis.", 
                status="Available", dynamic_data={"Lado/Posição": "Esquerdo", "Tipo de Luz": "Halogéneo"}
            ),
            models.Part(
                part_number="FRL-89", location="Prateleira F",
                type_id=type_map.get("Farol"), brand="Peugeot", model="308", year="2014-2021",
                price=210.00, description="Full LED.", 
                status="Available", dynamic_data={"Lado/Posição": "Direito", "Tipo de Luz": "LED"}
            ),
            models.Part(
                part_number="JNT-AL-17", location="Pavilhão Central",
                type_id=type_map.get("Jante"), brand="Honda", model="Civic", year="2006-2011",
                price=200.00, description="Conjunto de 4 jantes originais Honda com raspões nos passeios.", 
                status="Available", dynamic_data={"Tamanho (Pol)": "17", "Furação": "5x114.3"}
            ),
            models.Part(
                part_number="RTV-06", location="Prateleira R",
                type_id=type_map.get("Retrovisor"), brand="Fiat", model="500", year="2007-",
                price=65.00, description="Capa branca, espelho intacto.", 
                status="Available", dynamic_data={"Lado": "Direito", "Elétrico": "Sim"}
            ),
            models.Part(
                part_number="EMP-01X", location="Expositor 1",
                type_id=type_map.get("Motor"), brand="BMW", model="", year="",
                price=None, description="Apenas Slot configurado.", 
                status="EmptySlot", dynamic_data={"Cilindrada (cc)": "3000", "Combustível": "Diesel"}
            ),
        ]

        # Ignore if part already exists
        for mp in mock_parts:
            existing = db.query(models.Part).filter(models.Part.part_number == mp.part_number).first()
            if not existing:
                db.add(mp)
        
        db.commit()
        print("Mock parts seeded correctly.")

if __name__ == '__main__':
    seed_mock_parts()
