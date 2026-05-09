// ============================================================
// LeadForge Ultimate — Start All Services
// ============================================================
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

function startProcess(name, cmd, args, cwd, color) {
  const colors = {
    cyan: '\x1b[36m', green: '\x1b[32m',
    yellow: '\x1b[33m', reset: '\x1b[0m',
  };

  console.log(`${colors[color]}🚀 Starting ${name}...${colors.reset}`);

  const proc = spawn(cmd, args, {
    cwd,
    stdio: 'pipe',
    shell: true,
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) console.log(`${colors[color]}[${name}]${colors.reset} ${line}`);
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim() && !line.includes('ExperimentalWarning')) {
        console.log(`${colors[color]}[${name}]${colors.reset} ${line}`);
      }
    });
  });

  proc.on('exit', (code) => {
    console.log(`\x1b[31m[${name}] Process exited with code ${code}\x1b[0m`);
  });

  return proc;
}

// Check if .env exists
const envFile = path.join(ROOT, 'config/.env');
if (!fs.existsSync(envFile)) {
  console.log('\x1b[33m⚠️  config/.env not found. Run: node scripts/setup.js first\x1b[0m');
  process.exit(1);
}

console.log(`
╔═══════════════════════════════════════════════════╗
║       🚀 LeadForge Ultimate — Starting Up          ║
╚═══════════════════════════════════════════════════╝
`);

const backend = startProcess(
  'Backend',
  'node',
  ['server.js'],
  path.join(ROOT, 'backend'),
  'cyan'
);

// Wait a bit for backend to start before frontend
setTimeout(() => {
  const frontend = startProcess(
    'Frontend',
    'npm',
    ['run', 'dev'],
    path.join(ROOT, 'frontend'),
    'green'
  );

  setTimeout(() => {
    console.log(`
\x1b[32m╔═══════════════════════════════════════════════════╗
║  ✅ LeadForge Ultimate is running!                  ║
║                                                     ║
║  🎯 Dashboard: http://localhost:5173                ║
║  🔌 API:       http://localhost:3001                ║
║  📊 Health:    http://localhost:3001/api/health     ║
╚═══════════════════════════════════════════════════╝\x1b[0m
`);
  }, 3000);

}, 2000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\x1b[33m⏹️  Shutting down LeadForge...\x1b[0m');
  backend.kill();
  process.exit(0);
});
