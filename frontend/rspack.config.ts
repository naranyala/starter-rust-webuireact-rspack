import { defineConfig } from '@rspack/cli';
import HtmlRspackPlugin from '@rspack/plugin-html';
import path from 'node:path';
import fs from 'fs';

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
      scriptLoading: 'defer',
      inject: 'body',
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
      {
        test: /winbox\.min\.js$/,
        type: 'asset/source',
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
    clean: true,
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      hidePathInfo: true,
      maxInitialRequests: 20,
      maxAsyncRequests: 20,
      cacheGroups: {
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: -10,
          chunks: 'all',
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
  },
  stats: {
    preset: 'normal',
  },
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
});