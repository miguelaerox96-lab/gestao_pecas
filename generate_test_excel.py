import openpyxl
from openpyxl.styles import Font

def generate_test_excel():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Teste Multi-Tipo"

    # Headers
    headers = [
        "TIPO", "REF_PECA", "LOCALIZACAO", "MARCA", "MODELO", "ANO", 
        "PRECO", "MOSTRAR_PRECO_SITE", "OBSERVACOES", "FOTOS_FILENAMES",
        "Cilindrada", "Cavalagem", "Combustivel", "Amperagem", "Voltagem"
    ]
    
    # Instructions (optional but helpful as per our system)
    ws.append(["TYPE_ID=1 (Este ID será ignorado se a coluna TIPO estiver preenchida)"])
    ws.append([])
    ws.append(headers)

    # Format Headers
    for col in range(1, len(headers) + 1):
        ws.cell(row=3, column=col).font = Font(bold=True)

    # Sample Data
    data = [
        ["Motor", "AUDI-A4-2.0", "Section A-1", "Audi", "A4", "2015", "1200", "sim", "Motor em bom estado", "motor1.jpg", "2000cc", "150cv", "Diesel", "", ""],
        ["Motor", "BMW-320D", "Section A-2", "BMW", "Série 3", "2012", "1500", "sim", "Testado", "", "1995cc", "184cv", "Diesel", "", ""],
        ["Alternador", "ALT-001", "Section B-1", "Bosch", "Universal", "2020", "85", "sim", "Novo", "alt.png", "", "", "", "90A", "12V"],
    ]

    for row in data:
        ws.append(row)

    file_name = "Template_Teste_MultiTipo.xlsx"
    wb.save(file_name)
    print(f"File created: {file_name}")

if __name__ == "__main__":
    generate_test_excel()
