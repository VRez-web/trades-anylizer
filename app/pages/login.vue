<script setup lang="ts">
definePageMeta({ layout: 'empty' })

const route = useRoute()
const err = ref('')
const loading = ref(false)
const login = ref('')
const password = ref('')

async function submit() {
  err.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { login: login.value, password: password.value },
    })
    const redir = typeof route.query.redirect === 'string' ? route.query.redirect : '/trades'
    await navigateTo(redir || '/trades')
  } catch (e: unknown) {
    const any = e as { statusMessage?: string; data?: { message?: string } }
    err.value = any.data?.message || any.statusMessage || 'Ошибка входа'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="card login-card">
      <h1 class="login-title">Вход</h1>
      <form class="login-form" @submit.prevent="submit">
        <label class="lbl">
          <span>Логин</span>
          <input v-model="login" class="input" type="text" name="login" autocomplete="username" required />
        </label>
        <label class="lbl">
          <span>Пароль</span>
          <input
            v-model="password"
            class="input"
            type="password"
            name="password"
            autocomplete="current-password"
            required
          />
        </label>
        <p v-if="err" class="login-err">{{ err }}</p>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? '…' : 'Войти' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  min-height: 100vh;
  box-sizing: border-box;
}
.login-card {
  width: 100%;
  max-width: 380px;
  padding: 1.5rem;
}
.login-title {
  margin: 0 0 1.25rem;
  font-size: 1.35rem;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.lbl {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.88rem;
}
.login-err {
  margin: 0;
  color: #b91c1c;
  font-size: 0.88rem;
}
</style>
