import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/hubs.csv': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/orders.csv': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/warehouses.csv': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/orders.xlsx': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/api_keys.csv': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
