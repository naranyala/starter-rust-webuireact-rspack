import { defineConfig } from '@rspack/cli';
import HtmlRspackPlugin from '@rspack/plugin-html';
import path from 'node:path';

export default defineConfig({
  entry: {
    index: './src/main.tsx',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    new HtmlRspackPlugin({
      template: './index.html',
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true,
            },
          },
        },
        type: 'javascript/auto',
      },
      {
        test: /\.css$/,
        type: 'css',
      },
      {
        test: /\.module\.css$/,
        type: 'css',
        generator: {
          localIdentName: '[local]',
        },
      },
    ],
  },
  experiments: {
    css: true,
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: './',
    filename: 'static/js/[name].[contenthash:8].js',
    cssFilename: 'static/css/[name].[contenthash:8].css',
    clean: false, // Don't clean for faster incremental builds
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
    hot: true, // Enable hot module replacement
  },
  optimization: {
    splitChunks: false, // Disable for faster incremental builds
  },
  stats: {
    preset: 'normal',
  },
  cache: {
    type: 'memory', // Use memory cache for development
  },
});