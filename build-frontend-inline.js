#!/usr/bin/env bun

import fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { buildLog } from './frontend/build-logger.js';

async function buildFrontend() {
  const timer = buildLog.startTimer('frontend-inline-build');
  
  try {
    buildLog.info('Starting frontend inline build process', { 
      timestamp: new Date().toISOString(),
      cwd: process.cwd()
    }, 'INLINE_FRONTEND_BUILD');

    const currentDir = process.cwd();
    const isInFrontend = path.basename(currentDir) === 'frontend';
    const frontendDir = isInFrontend ? currentDir : path.join(currentDir, 'frontend');
    const originalDir = currentDir;

    try {
      if (!isInFrontend) {
        process.chdir(frontendDir);
        buildLog.debug('Changed working directory', { newDir: frontendDir }, 'INLINE_FRONTEND_BUILD');
      }
    } catch (error) {
      buildLog.error('Error changing to frontend directory', { 
        error: error.message,
        directory: frontendDir
      }, 'INLINE_FRONTEND_BUILD');
      process.exit(1);
    }

    // Check and install dependencies
    const depsTimer = buildLog.startTimer('inline-dependency-check');
    try {
      buildLog.info('Checking frontend dependencies...', {}, 'INLINE_DEPENDENCIES');
      try {
        await fs.access('node_modules');
        buildLog.info('Frontend dependencies already installed.', {}, 'INLINE_DEPENDENCIES');
      } catch {
        buildLog.info('Installing frontend dependencies with Bun...', {}, 'INLINE_DEPENDENCIES');
        execSync('bun install', { stdio: 'inherit' });
        buildLog.info('Frontend dependencies installed successfully.', {}, 'INLINE_DEPENDENCIES');
      }
      depsTimer.stop('info', 'Inline dependency check completed', { 
        directory: isInFrontend ? 'frontend' : 'root' 
      }, 'INLINE_DEPENDENCIES');
    } catch (error) {
      depsTimer.stop('error', 'Inline dependency installation failed', { 
        error: error.message 
      }, 'INLINE_DEPENDENCIES');
      throw error;
    }

    // Run rspack build
    const buildTimer = buildLog.startTimer('inline-rspack-build');
    try {
      buildLog.info('Running rspack production build...', {}, 'INLINE_RSPACK_BUILD');
      execSync('bun run build:incremental', { stdio: 'inherit' });
      buildTimer.stop('info', 'Inline rspack build completed successfully', {}, 'INLINE_RSPACK_BUILD');
    } catch (error) {
      buildTimer.stop('error', 'Inline rspack build failed', { error: error.message }, 'INLINE_RSPACK_BUILD');
      throw error;
    }

    // Create inline HTML bundle
    const inlineTimer = buildLog.startTimer('inline-bundle-create');
    try {
      buildLog.info('Creating inline HTML bundle...', {}, 'INLINE_BUNDLE_CREATE');

      // Read the built JS files
      const indexJsPath = './dist/static/js/index.47811421.js';
      const vendorsJsPath = './dist/static/js/vendors.7740078c.js';
      
      let indexJs, vendorsJs;
      try {
        indexJs = await fs.readFile(indexJsPath, 'utf8');
        vendorsJs = await fs.readFile(vendorsJsPath, 'utf8');
      } catch (readError) {
        buildLog.warn('Could not find expected JS files, checking for alternative names...', { 
          error: readError.message 
        }, 'INLINE_BUNDLE_CREATE');
        
        // Look for files with similar patterns
        const jsDir = './dist/static/js/';
        const jsFiles = await fs.readdir(jsDir);
        const indexFile = jsFiles.find(f => f.startsWith('index.'));
        const vendorFile = jsFiles.find(f => f.startsWith('vendors.') || f.includes('vendor'));
        
        if (indexFile) {
          buildLog.info(`Found index file: ${indexFile}`, {}, 'INLINE_BUNDLE_CREATE');
          indexJs = await fs.readFile(`${jsDir}${indexFile}`, 'utf8');
        } else {
          throw new Error('Could not find index JS file');
        }
        
        if (vendorFile) {
          buildLog.info(`Found vendor file: ${vendorFile}`, {}, 'INLINE_BUNDLE_CREATE');
          vendorsJs = await fs.readFile(`${jsDir}${vendorFile}`, 'utf8');
        } else {
          buildLog.warn('No vendor file found, proceeding without it', {}, 'INLINE_BUNDLE_CREATE');
          vendorsJs = '';
        }
      }

      const winboxJs = await fs.readFile('./node_modules/winbox/dist/winbox.bundle.min.js', 'utf8');
      const winboxCss = await fs.readFile('./node_modules/winbox/dist/css/winbox.min.css', 'utf8');

      // Create inline HTML
      let inlineHtml = `<!DOCTYPE html>
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

      // Ensure webui.js is included in the inline HTML
      const hasWebuiScript = inlineHtml.includes('/webui.js') || inlineHtml.includes('webui.js');
      if (!hasWebuiScript) {
        // Add webui.js script to the inline HTML before other scripts
        inlineHtml = inlineHtml.replace(
          /(<body>)/,
          '$1  <!-- WebUI JavaScript Bridge -->\n  <script src="/webui.js"></script>\n'
        );
        buildLog.info('Added webui.js script tag to inline HTML', {}, 'INLINE_BUNDLE_CREATE');
      } else {
        buildLog.info('webui.js script tag already exists in inline HTML', {}, 'INLINE_BUNDLE_CREATE');
      }

      await fs.writeFile('./dist/index.html', inlineHtml);
      buildLog.info('Created inline HTML bundle at: frontend/dist/index.html', {
        size: Buffer.byteLength(inlineHtml)
      }, 'INLINE_BUNDLE_CREATE');

      // Also copy to root for easy access
      await fs.writeFile('../index.html', inlineHtml);
      buildLog.info('Also copied to: index.html', { 
        size: Buffer.byteLength(inlineHtml) 
      }, 'INLINE_BUNDLE_CREATE');

      inlineTimer.stop('info', 'Inline bundle created successfully', { 
        size: Buffer.byteLength(inlineHtml) 
      }, 'INLINE_BUNDLE_CREATE');
    } catch (error) {
      inlineTimer.stop('error', 'Inline bundle creation failed', { error: error.message }, 'INLINE_BUNDLE_CREATE');
      throw error;
    }

    buildLog.info('Frontend inline build completed successfully!', {
      outputDir: 'frontend/dist/',
      duration: timer.stop('info', 'Frontend inline build completed', {}, 'INLINE_FRONTEND_BUILD')
    }, 'INLINE_FRONTEND_BUILD');

  } catch (error) {
    timer.stop('error', `Frontend inline build failed: ${error.message}`, { 
      error: error.message,
      stack: error.stack
    }, 'INLINE_FRONTEND_BUILD');
    buildLog.error('Error during frontend inline build:', { 
      error: error.message,
      stack: error.stack
    }, 'INLINE_FRONTEND_BUILD');
    process.exit(1);
  }
}

buildFrontend();
