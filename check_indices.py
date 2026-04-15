import sqlite3
conn = sqlite3.connect('autoparts.db')
c = conn.cursor()
c.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='parts'")
for row in c.fetchall():
    print(row)
conn.close()
