import sqlite3
conn = sqlite3.connect('autoparts.db')
cursor = conn.cursor()
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='parts'")
print(cursor.fetchone()[0])
conn.close()
