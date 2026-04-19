echo 'postgresql://r3:r3vibe@localhost:5432/r3vibe' > /tmp/dburl.txt

python3 - << 'PYEOF'
import subprocess, pathlib

url = pathlib.Path('/tmp/dburl.txt').read_text().strip()

result = subprocess.run(
['node', '-e', f'''
const {{Pool}} = require('pg');
const pool = new Pool({{connectionString: {repr(url)}}});
pool.query('SELECT 1').then(() => {{ console.log('CONNECTED'); pool.end(); }}).catch(e => {{ console.error('FAILED:', e.message); pool.end(); }});
'''],
cwd='/home/r3v/Stable',
capture_output=True, text=True
)
print(result.stdout)
print(result.stderr)
PYEOF

curl -s https://postgres-production-9ee0.up.railway.app/api/ping | head -c 100
