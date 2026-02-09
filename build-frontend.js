#!/usr/bin/env bun

import fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';

async function buildFrontend() {
  console.log('Building frontend...');

  const currentDir = process.cwd();
  const isInFrontend = path.basename(currentDir) === 'frontend';
  const frontendDir = isInFrontend ? currentDir : path.join(currentDir, 'frontend');
  const originalDir = currentDir;
  
  try {
    if (!isInFrontend) {
      process.chdir(frontendDir);
    }
  } catch (error) {
    console.error('Error changing to frontend directory:', error);
    process.exit(1);
  }

  try {
    console.log('Checking frontend dependencies...');
    try {
      await fs.access('node_modules');
      console.log('Frontend dependencies already installed.');
    } catch {
      console.log('Installing frontend dependencies with Bun...');
      execSync('bun install', { stdio: 'inherit' });
    }

    console.log('Running rspack production build...');
    execSync('bun run build:incremental', { stdio: 'inherit' });

    console.log('Rspack output is already in correct structure');

    console.log('Copying static files to root...');
    await fs.mkdir('../static/js', { recursive: true });
    await fs.mkdir('../static/css', { recursive: true });

    const rootJsFiles = await fs.readdir('./dist/static/js/');
    for (const file of rootJsFiles) {
      const srcPath = `./dist/static/js/${file}`;
      const destPath = `../static/js/${file}`;
      if ((await fs.stat(srcPath)).isFile()) {
        await fs.copyFile(srcPath, destPath);
        console.log(`  Copied to root: ${file}`);
      }
    }

    const rootCssFiles = await fs.readdir('./dist/static/css/').catch(() => []);
    for (const file of rootCssFiles) {
      const srcPath = `./dist/static/css/${file}`;
      const destPath = `../static/css/${file}`;
      if ((await fs.stat(srcPath)).isFile()) {
        await fs.copyFile(srcPath, destPath);
        console.log(`  Copied to root: ${file}`);
      }
    }

    console.log('Copying WinBox assets...');
    // Ensure directories exist
    await fs.mkdir('./dist/static/css', { recursive: true });
    await fs.mkdir('./dist/static/js', { recursive: true });
    
    // Copy WinBox CSS and JS from node_modules
    try {
      await fs.copyFile('./node_modules/winbox/dist/css/winbox.min.css', './dist/static/css/winbox.min.css');
      console.log('  Copied winbox.min.css');
    } catch (e) {
      console.log('  WinBox CSS copy failed:', e.message);
    }
    try {
      await fs.copyFile('./node_modules/winbox/dist/winbox.bundle.min.js', './dist/static/js/winbox.min.js');
      console.log('  Copied winbox.min.js');
    } catch (e) {
      console.log('  WinBox JS copy failed:', e.message);
    }

    console.log('Updating index.html paths...');
    let indexHtml = await fs.readFile('./dist/index.html', 'utf8');

    indexHtml = indexHtml.replace(
      /<title>[^<]*<\/title>/,
      '<title>Rust WebUI Application</title>'
    );

    await fs.writeFile('./dist/index.html', indexHtml);

    console.log('Frontend build completed successfully!');
    console.log('Output: frontend/dist/');
  } catch (error) {
    console.error('Error during frontend build:', error);
    process.exit(1);
  } finally {
    process.chdir(originalDir);
  }
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

buildFrontend();
