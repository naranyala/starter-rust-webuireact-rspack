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
      scriptLoading: 'blocking',
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
    ],
  },
  experiments: {
    css: true,
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: './',
    filename: 'js/[name].js',
    cssFilename: 'css/[name].css',
    clean: true,
  },
  optimization: {
    // Don't split chunks - bundle everything together
    splitChunks: {
      chunks: 'async',
    },
    minimize: true,
  },
  performance: {
    // Disable performance warnings for large bundles
    hints: false,
  },
  stats: {
    preset: 'normal',
  },
});
