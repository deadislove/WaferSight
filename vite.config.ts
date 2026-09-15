// vite.config.ts (若你的 vite.config 是 ts 檔) 或 vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts', // 或 main.js
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3-multiple-ciphers'],
              output: {
                // format: 'cjs',
                entryFileNames: '[name].js',
              },
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts', // 保持 TypeScript
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs', // <--- 關鍵：強制編譯成 CommonJS
                entryFileNames: 'preload.cjs', // 輸出為 Electron 預期讀取的 preload.js
              },
            },
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.cjs',
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  define: {
    // 解決 Vite 打包 ESM 時找不到 __dirname 的問題
    __dirname: 'import.meta.dirname',
  },
})