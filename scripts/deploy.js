// scripts/deploy.js
import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('\n🚀 GRID Security Deployment Script\n');
console.log('1. Deploy to Production');
console.log('2. Deploy to Staging');
console.log('3. Deploy Preview');
console.log('4. Exit');

rl.question('\nSelect an option (1-4): ', (answer) => {
  switch (answer) {
    case '1':
      console.log('\n📦 Deploying to Production...');
      execSync('vercel --prod', { stdio: 'inherit' });
      break;
    case '2':
      console.log('\n📦 Deploying to Staging...');
      execSync('vercel', { stdio: 'inherit' });
      break;
    case '3':
      console.log('\n📦 Creating Preview Deployment...');
      execSync('vercel --preview', { stdio: 'inherit' });
      break;
    case '4':
      console.log('\n👋 Goodbye!');
      break;
    default:
      console.log('\n❌ Invalid option. Please try again.');
  }
  rl.close();
});