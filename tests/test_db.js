import { execSync } from 'child_process';

const passwords = ['postgres', 'root', 'admin', '123456', 'zeparty', '1234', 'password', ''];
const psqlPath = '"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe"';

for (const p of passwords) {
  try {
    const cmd = `set PGPASSWORD=${p} && ${psqlPath} -U postgres -h 127.0.0.1 -c "SELECT 1;"`;
    const out = execSync(cmd, { shell: 'cmd.exe', encoding: 'utf8' });
    console.log(`✅ FOUND POSTGRES PASSWORD: "${p}"`);
    process.exit(0);
  } catch (err) {
    // ignore
  }
}

console.log('❌ None of the tested passwords worked.');
