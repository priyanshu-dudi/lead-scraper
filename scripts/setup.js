// ============================================================
// LeadForge Ultimate — Master Setup Script
// ============================================================
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname.replace('scripts', '').replace(/\\/g, '/');

function exec(cmd, cwd = ROOT) {
  console.log(`\n📦 Running: ${cmd}`);
  try {
    execSync(cmd, { cwd, stdio: 'inherit', shell: true });
    console.log(`✅ Done`);
  } catch (err) {
    console.error(`❌ Failed: ${err.message}`);
  }
}

async function setup() {
  console.log(`
╔═══════════════════════════════════════════════╗
║     LeadForge Ultimate — Setup Wizard          ║
╚═══════════════════════════════════════════════╝
`);

  // ── Create directories ─────────────────────────────────────
  const dirs = ['exports', 'logs', 'exports/csv', 'exports/json'];
  dirs.forEach(dir => {
    const fullPath = path.join(ROOT, dir);
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`📁 Created: ${dir}`);
  });

  // ── Create .env from example ───────────────────────────────
  const envExample = path.join(ROOT, 'config/.env.example');
  const envFile = path.join(ROOT, 'config/.env');
  if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envFile);
    console.log('📄 Created config/.env from template');
    console.log('⚠️  Remember to add your OPENAI_API_KEY to config/.env');
  }

  // ── Backend dependencies ───────────────────────────────────
  console.log('\n🔧 Installing backend dependencies...');
  exec('npm install', path.join(ROOT, 'backend'));

  // ── Frontend dependencies ──────────────────────────────────
  console.log('\n🎨 Installing frontend dependencies...');
  exec('npm install', path.join(ROOT, 'frontend'));

  // ── Playwright browsers ────────────────────────────────────
  console.log('\n🌐 Installing Playwright browsers...');
  exec('npx playwright install chromium', path.join(ROOT, 'backend'));

  // ── Python dependencies ────────────────────────────────────
  console.log('\n🐍 Installing Python dependencies...');
  exec('pip install -r requirements.txt', ROOT);

  // ── Backend package.json type fix ─────────────────────────
  const backendPkg = path.join(ROOT, 'backend/package.json');
  const pkg = JSON.parse(fs.readFileSync(backendPkg, 'utf-8'));
  if (!pkg.type) {
    pkg.type = 'module';
    fs.writeFileSync(backendPkg, JSON.stringify(pkg, null, 2));
    console.log('📝 Fixed backend package.json (added "type": "module")');
  }

  console.log(`
╔═══════════════════════════════════════════════╗
║  ✅ Setup complete!                             ║
║                                                ║
║  Next steps:                                   ║
║  1. Edit config/.env (add OPENAI_API_KEY)      ║
║  2. Run: node scripts/start-all.js             ║
║  3. Open: http://localhost:5173                 ║
╚═══════════════════════════════════════════════╝
`);
}

setup().catch(console.error);
