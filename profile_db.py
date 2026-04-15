import sqlite3, time

conn = sqlite3.connect('storage/autoparts.db')
cursor = conn.cursor()

print('=== INDEXES ===')
cursor.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' ORDER BY tbl_name")
for row in cursor.fetchall():
    print(f'  {row[1]}.{row[0]}: {row[2]}')

print()
print('=== ROW COUNTS ===')
for table in ['parts', 'users', 'vehicles', 'inquiries', 'history']:
    try:
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
        count = cursor.fetchone()[0]
        print(f'  {table}: {count} rows')
    except Exception as e:
        print(f'  {table}: ERROR - {e}')

print()
print('=== QUERY TIMING (ms) ===')

def t(label, sql, params=()):
    start = time.time()
    cursor.execute(sql, params)
    cursor.fetchall()
    print(f'  {label}: {(time.time()-start)*1000:.1f}ms')

t('COUNT(*) parts', 'SELECT COUNT(*) FROM parts')
t('COUNT(*) parts status=Available', 'SELECT COUNT(*) FROM parts WHERE status=?', ('Available',))
t('COUNT(*) parts status=Sold', 'SELECT COUNT(*) FROM parts WHERE status=?', ('Sold',))
t('COUNT(*) parts status=EmptySlot', 'SELECT COUNT(*) FROM parts WHERE status=?', ('EmptySlot',))
t('SELECT 20 parts (no filter)', 'SELECT * FROM parts ORDER BY id DESC LIMIT 20')
t('SELECT 20 parts (Available)', 'SELECT * FROM parts WHERE status=? ORDER BY id DESC LIMIT 20', ('Available',))
t('SELECT brands', 'SELECT DISTINCT brand FROM parts WHERE brand IS NOT NULL ORDER BY brand')
t('SELECT all types', 'SELECT * FROM part_types')
t('SELECT type_fields', 'SELECT * FROM type_fields')
t('SELECT locations', 'SELECT * FROM locations')
t('SELECT /me (users)', 'SELECT * FROM users LIMIT 1')

# Check if there's a PRAGMA journal mode or WAL
cursor.execute('PRAGMA journal_mode')
print()
print(f'  Journal mode: {cursor.fetchone()[0]}')
cursor.execute('PRAGMA page_size')
print(f'  Page size: {cursor.fetchone()[0]}')
cursor.execute('PRAGMA cache_size')
print(f'  Cache size: {cursor.fetchone()[0]}')

conn.close()
