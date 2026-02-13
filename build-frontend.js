#!/usr/bin/env bun

import fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { buildLog } from './frontend/build-logger.js';

async function buildFrontend() {
  const timer = buildLog.startTimer('frontend-build');
  
  try {
    buildLog.info('Starting frontend build process', { 
      timestamp: new Date().toISOString(),
      cwd: process.cwd()
    }, 'FRONTEND_BUILD');

    const currentDir = process.cwd();
    const isInFrontend = path.basename(currentDir) === 'frontend';
    const frontendDir = isInFrontend ? currentDir : path.join(currentDir, 'frontend');
    const originalDir = currentDir;

    try {
      if (!isInFrontend) {
        process.chdir(frontendDir);
        buildLog.debug('Changed working directory', { newDir: frontendDir }, 'FRONTEND_BUILD');
      }
    } catch (error) {
      buildLog.error('Error changing to frontend directory', { 
        error: error.message,
        directory: frontendDir
      }, 'FRONTEND_BUILD');
      process.exit(1);
    }

    // Check and install dependencies
    const depsTimer = buildLog.startTimer('dependency-check');
    try {
      buildLog.info('Checking frontend dependencies...', {}, 'DEPENDENCIES');
      try {
        await fs.access('node_modules');
        buildLog.info('Frontend dependencies already installed.', {}, 'DEPENDENCIES');
      } catch {
        buildLog.info('Installing frontend dependencies with Bun...', {}, 'DEPENDENCIES');
        execSync('bun install', { stdio: 'inherit' });
        buildLog.info('Frontend dependencies installed successfully.', {}, 'DEPENDENCIES');
      }
      depsTimer.stop('info', 'Dependency check completed', { 
        directory: isInFrontend ? 'frontend' : 'root' 
      }, 'DEPENDENCIES');
    } catch (error) {
      depsTimer.stop('error', 'Dependency installation failed', { 
        error: error.message 
      }, 'DEPENDENCIES');
      throw error;
    }

    // Run rspack build
    const buildTimer = buildLog.startTimer('rspack-build');
    try {
      buildLog.info('Running rspack production build...', {}, 'RSPACK_BUILD');
      execSync('bun run build:incremental', { stdio: 'inherit' });
      buildTimer.stop('info', 'Rspack build completed successfully', {}, 'RSPACK_BUILD');
    } catch (error) {
      buildTimer.stop('error', 'Rspack build failed', { error: error.message }, 'RSPACK_BUILD');
      throw error;
    }

    buildLog.info('Rspack output is already in correct structure', {}, 'ASSETS_COPY');

    // Copy static files to root
    const assetsTimer = buildLog.startTimer('assets-copy');
    try {
      buildLog.info('Copying static files to root...', {}, 'ASSETS_COPY');
      await fs.mkdir('../static/js', { recursive: true });
      await fs.mkdir('../static/css', { recursive: true });

      const rootJsFiles = await fs.readdir('./dist/static/js/');
      for (const file of rootJsFiles) {
        const srcPath = `./dist/static/js/${file}`;
        const destPath = `../static/js/${file}`;
        if ((await fs.stat(srcPath)).isFile()) {
          await fs.copyFile(srcPath, destPath);
          buildLog.debug(`Copied JS asset to root`, { file, size: (await fs.stat(srcPath)).size }, 'ASSETS_COPY');
        }
      }

      const rootCssFiles = await fs.readdir('./dist/static/css/').catch(() => []);
      for (const file of rootCssFiles) {
        const srcPath = `./dist/static/css/${file}`;
        const destPath = `../static/css/${file}`;
        if ((await fs.stat(srcPath)).isFile()) {
          await fs.copyFile(srcPath, destPath);
          buildLog.debug(`Copied CSS asset to root`, { file, size: (await fs.stat(srcPath)).size }, 'ASSETS_COPY');
        }
      }
      assetsTimer.stop('info', 'Assets copied successfully', { 
        jsFiles: rootJsFiles.length,
        cssFiles: rootCssFiles.length
      }, 'ASSETS_COPY');
    } catch (error) {
      assetsTimer.stop('error', 'Asset copying failed', { error: error.message }, 'ASSETS_COPY');
      throw error;
    }

    // Copy WinBox assets
    const winboxTimer = buildLog.startTimer('winbox-copy');
    try {
      buildLog.info('Copying WinBox assets...', {}, 'WINBOX_COPY');
      // Ensure directories exist
      await fs.mkdir('./dist/static/css', { recursive: true });
      await fs.mkdir('./dist/static/js', { recursive: true });

      // Copy WinBox CSS and JS from node_modules
      try {
        await fs.copyFile('./node_modules/winbox/dist/css/winbox.min.css', './dist/static/css/winbox.min.css');
        buildLog.info('Copied winbox.min.css', {}, 'WINBOX_COPY');
      } catch (e) {
        buildLog.warn('WinBox CSS copy failed', { error: e.message }, 'WINBOX_COPY');
      }
      try {
        await fs.copyFile('./node_modules/winbox/dist/winbox.bundle.min.js', './dist/static/js/winbox.min.js');
        buildLog.info('Copied winbox.min.js', {}, 'WINBOX_COPY');
      } catch (e) {
        buildLog.warn('WinBox JS copy failed', { error: e.message }, 'WINBOX_COPY');
      }
      winboxTimer.stop('info', 'WinBox assets processed', {}, 'WINBOX_COPY');
    } catch (error) {
      winboxTimer.stop('error', 'WinBox asset processing failed', { error: error.message }, 'WINBOX_COPY');
      throw error;
    }

    // Update index.html
    const htmlTimer = buildLog.startTimer('html-update');
    try {
      buildLog.info('Updating index.html paths...', {}, 'HTML_UPDATE');
      let indexHtml = await fs.readFile('./dist/index.html', 'utf8');

      // Update title
      indexHtml = indexHtml.replace(
        /<title>[^<]*<\/title>/,
        '<title>Rust WebUI Application</title>'
      );

      // Ensure webui.js is included in the generated index.html
      if (!indexHtml.includes('/webui.js')) {
        // Find the closing body tag and insert webui.js script before other scripts
        const bodyTagIndex = indexHtml.lastIndexOf('</body>');
        if (bodyTagIndex !== -1) {
          const webuiScript = '  <!-- WebUI JavaScript Bridge -->\n  <script src="/webui.js"></script>\n';
          indexHtml = indexHtml.slice(0, bodyTagIndex) + webuiScript + indexHtml.slice(bodyTagIndex);
          buildLog.info('Added webui.js script tag to index.html', {}, 'HTML_UPDATE');
        } else {
          buildLog.warn('Could not find </body> tag to insert webui.js', {}, 'HTML_UPDATE');
        }
      } else {
        buildLog.info('webui.js script tag already exists in index.html', {}, 'HTML_UPDATE');
      }

      await fs.writeFile('./dist/index.html', indexHtml);
      htmlTimer.stop('info', 'HTML updated successfully', {
        size: Buffer.byteLength(indexHtml)
      }, 'HTML_UPDATE');
    } catch (error) {
      htmlTimer.stop('error', 'HTML update failed', { error: error.message }, 'HTML_UPDATE');
      throw error;
    }

    buildLog.info('Frontend build completed successfully!', {
      outputDir: 'frontend/dist/',
      duration: timer.stop('info', 'Frontend build completed', {}, 'FRONTEND_BUILD')
    }, 'FRONTEND_BUILD');

  } catch (error) {
    timer.stop('error', `Frontend build failed: ${error.message}`, { 
      error: error.message,
      stack: error.stack
    }, 'FRONTEND_BUILD');
    buildLog.error('Error during frontend build:', { 
      error: error.message,
      stack: error.stack
    }, 'FRONTEND_BUILD');
    process.exit(1);
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
