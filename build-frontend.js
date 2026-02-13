#!/usr/bin/env bun

import fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { buildLog, Colors, ProgressBar } from './frontend/build-logger.js';

const BUILD_STEPS = [
  'dependency-check',
  'rspack-build',
  'assets-copy',
  'winbox-copy',
  'html-update'
];

async function buildFrontend() {
  const startTime = process.hrtime.bigint();
  const buildId = Date.now().toString(36);
  
  buildLog.info(`Starting frontend build (ID: ${buildId})`, { 
    buildId,
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
    nodeVersion: process.version,
    platform: process.platform
  }, 'BUILD');

  const progressBar = buildLog.createProgressBar(BUILD_STEPS.length, 'Build Progress');
  
  try {
    const currentDir = process.cwd();
    const isInFrontend = path.basename(currentDir) === 'frontend';
    const frontendDir = isInFrontend ? currentDir : path.join(currentDir, 'frontend');
    const originalDir = currentDir;

    try {
      if (!isInFrontend) {
        process.chdir(frontendDir);
        buildLog.debug('Changed working directory', { newDir: frontendDir }, 'BUILD');
      }
    } catch (error) {
      buildLog.error('Error changing to frontend directory', { 
        error: error.message,
        directory: frontendDir
      }, 'BUILD');
      process.exit(1);
    }

    await stepDependencyCheck();
    progressBar.increment(1, 'Dependencies');

    await stepRspackBuild();
    progressBar.increment(1, 'Rspack Build');

    await stepAssetsCopy();
    progressBar.increment(1, 'Assets Copy');

    await stepWinboxCopy();
    progressBar.increment(1, 'WinBox Copy');

    await stepHtmlUpdate();
    progressBar.increment(1, 'HTML Update');

    progressBar.complete('Build Complete');

    const endTime = process.hrtime.bigint();
    const totalDurationMs = Number(endTime - startTime) / 1_000_000;
    
    printBuildSummary({
      buildId,
      success: true,
      durationMs: totalDurationMs,
      steps: BUILD_STEPS.length,
      cwd: originalDir
    });

    buildLog.info('Frontend build completed successfully!', {
      buildId,
      duration_ms: totalDurationMs.toFixed(2),
      outputDir: 'frontend/dist/'
    }, 'BUILD');

  } catch (error) {
    progressBar.increment(1, 'Build Failed');
    
    const endTime = process.hrtime.bigint();
    const totalDurationMs = Number(endTime - startTime) / 1_000_000;
    
    printBuildSummary({
      buildId,
      success: false,
      durationMs: totalDurationMs,
      error: error.message,
      steps: BUILD_STEPS.length
    });

    buildLog.error(`Frontend build failed: ${error.message}`, { 
      buildId,
      error: error.message,
      stack: error.stack,
      duration_ms: totalDurationMs.toFixed(2)
    }, 'BUILD');
    process.exit(1);
  }
}

async function stepDependencyCheck() {
  const stepTimer = buildLog.startTimer('dependency-check');
  
  buildLog.info('Checking frontend dependencies...', {}, 'DEPS');
  
  try {
    await fs.access('node_modules');
    buildLog.info('Frontend dependencies already installed.', {}, 'DEPS');
  } catch {
    buildLog.info('Installing frontend dependencies with Bun...', {}, 'DEPS');
    const installTimer = buildLog.startTimer('bun-install');
    execSync('bun install', { stdio: 'inherit' });
    installTimer.stop('info', 'Bun install completed');
    buildLog.info('Frontend dependencies installed successfully.', {}, 'DEPS');
  }
  
  stepTimer.stop('info', 'Dependency check completed');
}

async function stepRspackBuild() {
  const stepTimer = buildLog.startTimer('rspack-build');
  
  buildLog.info('Running rspack production build...', {}, 'RSPACK');
  
  const stats = {
    startTime: Date.now(),
    attempt: 1
  };
  
  try {
    execSync('bun run build:incremental', { stdio: 'inherit' });
    stats.endTime = Date.now();
    stats.success = true;
    
    stepTimer.stop('info', 'Rspack build completed successfully', {
      duration_ms: stats.endTime - stats.startTime,
      attempt: stats.attempt
    });
  } catch (error) {
    stats.endTime = Date.now();
    stats.success = false;
    
    stepTimer.stop('error', 'Rspack build failed', {
      error: error.message,
      duration_ms: stats.endTime - stats.startTime
    });
    throw error;
  }
  
  buildLog.debug('Rspack output is already in correct structure', {}, 'ASSETS');
}

async function stepAssetsCopy() {
  const stepTimer = buildLog.startTimer('assets-copy');
  
  buildLog.info('Copying static files to root...', {}, 'ASSETS');
  
  const stats = {
    jsFiles: 0,
    cssFiles: 0,
    totalSize: 0
  };
  
  try {
    await fs.mkdir('../static/js', { recursive: true });
    await fs.mkdir('../static/css', { recursive: true });

    const rootJsFiles = await fs.readdir('./dist/static/js/');
    for (const file of rootJsFiles) {
      const srcPath = `./dist/static/js/${file}`;
      const destPath = `../static/js/${file}`;
      if ((await fs.stat(srcPath)).isFile()) {
        await fs.copyFile(srcPath, destPath);
        stats.jsFiles++;
        stats.totalSize += (await fs.stat(srcPath)).size;
        buildLog.debug(`Copied JS asset to root`, { file, size: (await fs.stat(srcPath)).size }, 'ASSETS');
      }
    }

    const rootCssFiles = await fs.readdir('./dist/static/css/').catch(() => []);
    for (const file of rootCssFiles) {
      const srcPath = `./dist/static/css/${file}`;
      const destPath = `../static/css/${file}`;
      if ((await fs.stat(srcPath)).isFile()) {
        await fs.copyFile(srcPath, destPath);
        stats.cssFiles++;
        stats.totalSize += (await fs.stat(srcPath)).size;
        buildLog.debug(`Copied CSS asset to root`, { file, size: (await fs.stat(srcPath)).size }, 'ASSETS');
      }
    }
    
    stepTimer.stop('info', 'Assets copied successfully', {
      jsFiles: stats.jsFiles,
      cssFiles: stats.cssFiles,
      totalSize: stats.totalSize,
      totalSizeHuman: formatBytes(stats.totalSize)
    });
  } catch (error) {
    stepTimer.stop('error', 'Asset copying failed', { error: error.message });
    throw error;
  }
}

async function stepWinboxCopy() {
  const stepTimer = buildLog.startTimer('winbox-copy');
  
  buildLog.info('Copying WinBox assets...', {}, 'WINBOX');
  
  const stats = {
    cssCopied: false,
    jsCopied: false
  };
  
  try {
    await fs.mkdir('./dist/static/css', { recursive: true });
    await fs.mkdir('./dist/static/js', { recursive: true });

    try {
      await fs.copyFile('./node_modules/winbox/dist/css/winbox.min.css', './dist/static/css/winbox.min.css');
      stats.cssCopied = true;
      buildLog.info('Copied winbox.min.css', {}, 'WINBOX');
    } catch (e) {
      buildLog.warn('WinBox CSS copy failed', { error: e.message }, 'WINBOX');
    }
    
    try {
      await fs.copyFile('./node_modules/winbox/dist/winbox.bundle.min.js', './dist/static/js/winbox.min.js');
      stats.jsCopied = true;
      buildLog.info('Copied winbox.min.js', {}, 'WINBOX');
    } catch (e) {
      buildLog.warn('WinBox JS copy failed', { error: e.message }, 'WINBOX');
    }
    
    stepTimer.stop('info', 'WinBox assets processed', {
      cssCopied: stats.cssCopied,
      jsCopied: stats.jsCopied
    });
  } catch (error) {
    stepTimer.stop('error', 'WinBox asset processing failed', { error: error.message });
    throw error;
  }
}

async function stepHtmlUpdate() {
  const stepTimer = buildLog.startTimer('html-update');
  
  buildLog.info('Updating index.html paths...', {}, 'HTML');
  
  const stats = {
    size: 0,
    titleUpdated: false,
    webuiScriptAdded: false
  };
  
  try {
    let indexHtml = await fs.readFile('./dist/index.html', 'utf8');
    const originalSize = Buffer.byteLength(indexHtml);
    stats.size = originalSize;

    const titleMatch = indexHtml.match(/<title>[^<]*<\/title>/);
    if (titleMatch) {
      indexHtml = indexHtml.replace(titleMatch[0], '<title>Rust WebUI Application</title>');
      stats.titleUpdated = true;
    }

    const hasWebuiScript = indexHtml.includes('/webui.js') || indexHtml.includes('webui.js');
    if (!hasWebuiScript) {
      const bodyTagIndex = indexHtml.lastIndexOf('</body>');
      if (bodyTagIndex !== -1) {
        const webuiScript = '  <!-- WebUI JavaScript Bridge -->\n  <script src="/webui.js"></script>\n';
        indexHtml = indexHtml.slice(0, bodyTagIndex) + webuiScript + indexHtml.slice(bodyTagIndex);
        stats.webuiScriptAdded = true;
        buildLog.info('Added webui.js script tag to index.html', {}, 'HTML');
      } else {
        buildLog.warn('Could not find </body> tag to insert webui.js', {}, 'HTML');
      }
    } else {
      buildLog.info('webui.js script tag already exists in index.html', {}, 'HTML');
    }

    await fs.writeFile('./dist/index.html', indexHtml);
    stats.size = Buffer.byteLength(indexHtml);
    
    stepTimer.stop('info', 'HTML updated successfully', {
      size: stats.size,
      sizeDelta: stats.size - originalSize,
      titleUpdated: stats.titleUpdated,
      webuiScriptAdded: stats.webuiScriptAdded
    });
  } catch (error) {
    stepTimer.stop('error', 'HTML update failed', { error: error.message });
    throw error;
  }
}

function printBuildSummary(stats) {
  const { buildId, success, durationMs, steps, error, cwd } = stats;
  
  console.log('\n' + Colors.bright + Colors.white + '═'.repeat(60) + Colors.reset);
  console.log(Colors.bright + Colors.white + '  BUILD SUMMARY' + Colors.reset);
  console.log(Colors.bright + Colors.white + '═'.repeat(60) + Colors.reset);
  
  console.log(`  ${Colors.cyan}Build ID:${Colors.reset}      ${buildId}`);
  console.log(`  ${Colors.cyan}Status:${Colors.reset}       ${success ? Colors.green + 'SUCCESS' + Colors.reset : Colors.red + 'FAILED' + Colors.reset}`);
  console.log(`  ${Colors.cyan}Duration:${Colors.reset}     ${Colors.white}${durationMs.toFixed(2)}ms${Colors.reset}`);
  console.log(`  ${Colors.cyan}Steps:${Colors.reset}        ${Colors.white}${steps}${Colors.reset}`);
  console.log(`  ${Colors.cyan}Working Dir:${Colors.reset}  ${Colors.gray}${cwd}${Colors.reset}`);
  
  if (error) {
    console.log(`  ${Colors.cyan}Error:${Colors.reset}       ${Colors.red}${error}${Colors.reset}`);
  }
  
  console.log(Colors.bright + Colors.white + '═'.repeat(60) + Colors.reset + '\n');
  
  const logStats = buildLog.getStats();
  console.log(Colors.bright + Colors.white + '  LOG STATS' + Colors.reset);
  console.log(Colors.bright + Colors.white + '─'.repeat(60) + Colors.reset);
  console.log(`  ${Colors.green}Info:${Colors.reset}        ${logStats.info}`);
  console.log(`  ${Colors.yellow}Warnings:${Colors.reset}   ${logStats.warnings}`);
  console.log(`  ${Colors.red}Errors:${Colors.reset}       ${logStats.errors}`);
  console.log(Colors.bright + Colors.white + '─'.repeat(60) + Colors.reset + '\n');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
