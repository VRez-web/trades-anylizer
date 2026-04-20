import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  alias: {
    '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
  },
  runtimeConfig: {
    bybitApiKey: '',
    bybitApiSecret: '',
    /** HTTP(S) прокси для запросов к api.bybit.com (обход геоблокировки CloudFront с IP хостинга). Env: NUXT_BYBIT_HTTP_PROXY */
    bybitHttpProxy: '',
    bybitTestnet: false,
    public: {
      depositUsdt: 0,
    },
  },
})
