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
    /** Простая авторизация: задайте оба, иначе вход отключён (все страницы и API открыты). Env: NUXT_ADMIN_USER, NUXT_ADMIN_PASSWORD */
    adminUser: '',
    adminPassword: '',
    /** Секрет подписи cookie сессии. Env: NUXT_AUTH_SECRET */
    authSecret: '',
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
