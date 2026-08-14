import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import removeConsole from 'vite-plugin-remove-console';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { viteObfuscateFile } from 'vite-plugin-obfuscator';
import svgr from 'vite-plugin-svgr';
import { codeInspectorPlugin } from 'code-inspector-plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

const asyncCssPlugin = () => {
  return {
    name: 'vite-plugin-async-css',
    // 强制在构建的最后阶段运行，确保能处理 Vite 生成的 HTML
    enforce: 'post',
    transformIndexHtml(html) {
      // 正则表达式匹配 Vite 生成的 stylesheet link
      // 匹配 <link rel="stylesheet" ... href="...">
      return html.replace(
        /<link\s+rel="stylesheet"\s+(.*?)href="([^"]+)"(.*?)>/g,
        (match, preAttrs, href, postAttrs) => {
          // 保留原始的其他属性（如 crossorigin）
          const extraAttrs = (preAttrs + postAttrs).trim();

          // 返回替换后的 HTML 结构
          return `
            <link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'" ${extraAttrs}>
            <noscript><link rel="stylesheet" href="${href}" ${extraAttrs}></noscript>
          `;
        },
      );
    },
  };
};
// https://vitejs.dev/config/

export default defineConfig(({ mode }) => {
  // const baseUrl = 'https://short-series.mrstage.com';
  const baseUrl = 'https://www.aiyo.top';

  // const baseUrl = 'http://192.168.50.200:8000';
  // const baseUrl = 'http://frp.xjetry.fun:8000';
  const env = loadEnv(mode, __dirname, '');
  const isProd = mode === 'prod';
  const enableObfuscate = isProd && env.VITE_ENABLE_OBFUSCATE === 'true';

  // 获取主机名和端口
  const getHostAndPort = (url) => {
    const urlObj = new URL(url);
    return urlObj.host; // 包含主机名和端口（如果有）
  };

  return {
    plugins: [
      codeInspectorPlugin({
        bundler: 'vite', // 指明打包器为 vite
      }),
      removeConsole({
        includes: ['log', 'warn', 'debug', 'info'], // 去掉所有 log
        excludes: ['error'], // 保留 error 日志
      }),
      react({
        strictMode: mode !== 'development',
      }),
      // 新增：生产环境 JS 混淆
      enableObfuscate &&
        viteObfuscateFile(
          {
            globalOptions: {
              compact: true,
              controlFlowFlattening: true,
              controlFlowFlatteningThreshold: 0.75,
              deadCodeInjection: true,
              deadCodeInjectionThreshold: 0.4,
              debugProtection: true,
              debugProtectionInterval: true,
              disableConsoleOutput: true,
              identifierNamesGenerator: 'hexadecimal',
              log: false,
              numbersToExpressions: true,
              renameGlobals: false,
              selfDefending: true,
              simplify: true,
              splitStrings: true,
              stringArray: true,
              stringArrayCallsTransform: true,
              stringArrayEncoding: ['base64'],
              stringArrayIndexShift: true,
              stringArrayRotate: true,
              stringArrayShuffle: true,
              stringArrayWrappersCount: 5,
              stringArrayWrappersChainedCalls: true,
              stringArrayWrappersType: 'function',
              stringArrayThreshold: 0.75,
              transformObjectKeys: true,
              unicodeEscapeSequence: false,
            },
          },
          [
            // 指定混淆的文件范围
            'assets/*.js',
            'js/*.js',
          ],
        ),

      svgr(), // 启用 svgr
      asyncCssPlugin(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: baseUrl,
          changeOrigin: true, // 修改源
          configure: (proxy) => {
            // 自定义代理配置
            proxy.on('proxyReq', (proxyReq, req) => {
              // 修改请求头
              proxyReq.setHeader('Host', getHostAndPort(baseUrl));
              // 如果需要，也可以设置 X-Forwarded-Host
              proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
            });
          },
          rewrite: (path) => {
            return path;
          },
          secure: false,
        }
      },
      // 如果需要保留之前的 CORS 配置，可以一起保留
      cors: true,
    },
    build: {
      // cssCodeSplit: true,
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (/\.(png|jpe?g|gif|svg|webp|ico)(\?.*)?$/.test(assetInfo.name)) {
              return 'img/[name]-[hash][extname]';
            }
            return '[ext]/[name]-[hash][extname]';
          },
        },
      },
    },
  };
});
