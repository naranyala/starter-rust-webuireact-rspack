#!/usr/bin/env bun

import fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';

async function buildFrontend() {
  console.log('Building frontend with inline bundles...');

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

    console.log('Creating inline HTML bundle...');
    
    // Read the built JS files
    const indexJs = await fs.readFile('./dist/static/js/index.47811421.js', 'utf8');
    const vendorsJs = await fs.readFile('./dist/static/js/vendors.7740078c.js', 'utf8');
    const winboxJs = await fs.readFile('./node_modules/winbox/dist/winbox.bundle.min.js', 'utf8');
    const winboxCss = await fs.readFile('./node_modules/winbox/dist/css/winbox.min.css', 'utf8');
    
    // Create inline HTML
    const inlineHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rust WebUI Application</title>
  <style>
    /* WinBox CSS */
    ${winboxCss}
    
    /* Critical CSS */
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    #app {
      width: 100%;
      height: 100%;
      display: block;
    }
    #app:empty::before {
      content: 'Loading...';
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      font-family: sans-serif;
      font-size: 18px;
      color: #333;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    // WinBox
    ${winboxJs}
  </script>
  <script>
    // React Vendors
    ${vendorsJs}
  </script>
  <script>
    // Main App
    ${indexJs}
  </script>
</body>
</html>`;

    await fs.writeFile('./dist/index.html', inlineHtml);
    console.log('Created inline HTML bundle at: frontend/dist/index.html');
    
    // Also copy to root for easy access
    await fs.writeFile('../index.html', inlineHtml);
    console.log('Also copied to: index.html');

    console.log('Frontend build completed successfully!');
  } catch (error) {
    console.error('Error during frontend build:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.chdir(originalDir);
  }
}

buildFrontend();
