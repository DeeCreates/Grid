import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Vercel build process...');

try {
  // Clean previous build
  if (fs.existsSync(path.join(__dirname, 'dist'))) {
    console.log('🗑️ Removing previous build...');
    fs.rmSync(path.join(__dirname, 'dist'), { recursive: true, force: true });
  }

  // Run Vite build directly
  console.log('📦 Building with Vite (skipping TypeScript errors)...');
  execSync('npx vite build', { 
    stdio: 'inherit',
    env: { 
      ...process.env, 
      SKIP_TYPESCRIPT: 'true',
      NODE_OPTIONS: '--max-old-space-size=4096'
    }
  });

  // Check if dist folder exists
  if (!fs.existsSync(path.join(__dirname, 'dist'))) {
    throw new Error('Build failed: dist folder not found');
  }

  // Check assets
  const assetsDir = path.join(__dirname, 'dist/assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const cssFiles = files.filter(f => f.endsWith('.css'));
    const jsFiles = files.filter(f => f.endsWith('.js'));
    
    console.log(`✅ Found ${cssFiles.length} CSS files`);
    console.log(`✅ Found ${jsFiles.length} JavaScript files`);
    
    if (cssFiles.length > 0) {
      console.log(`📄 CSS files: ${cssFiles.join(', ')}`);
    }
  }

  console.log('✅ Build completed successfully!');
  console.log(`📁 Output directory: dist`);
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}