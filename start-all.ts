import { spawn } from 'child_process';

function runService(name: string, command: string, args: string[]) {
  const child = spawn(command, args, { stdio: 'inherit', shell: true });
  child.on('error', (err) => {
    console.error(`Failed to start ${name}:`, err);
  });
  child.on('exit', (code) => {
    console.log(`${name} exited with code ${code}`);
  });
  return child;
}

console.log('Starting all services...');

// Run User Service
runService('User Service', 'npx', ['tsx', 'apps/user-service/src/main.ts']);

// Run Wallet Service
runService('Wallet Service', 'npx', ['tsx', 'apps/wallet-service/src/main.ts']);

// Run Gateway
runService('Gateway', 'npx', ['tsx', 'apps/gateway/src/main.ts']);
