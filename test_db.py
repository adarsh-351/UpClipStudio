import sys
sys.path.insert(0, r'C:\Users\LENOVO\Desktop\New folder\UpClipStudio')
from routes.youtube import init_db, get_db

init_db()
print('Database initialized successfully')

# Verify tables
conn = get_db()
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print('Tables:', [t[0] for t in tables])
conn.close()