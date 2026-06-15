import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sf-oauth-token.php': {
        target: 'https://login.salesforce.com',
        changeOrigin: true,
        rewrite: () => '/services/oauth2/token',
      }
    }
  }
})