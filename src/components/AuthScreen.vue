<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  authMode: "login" | "register";
  authError: string;
  defaultHandle: string;
  defaultPassword: string;
}>();

const emit = defineEmits<{
  "update:authMode": ["login" | "register"];
  submit: [{ name: string; handle: string; password: string }];
}>();

const name = ref("");
const handle = ref(props.defaultHandle);
const password = ref(props.defaultPassword);

watch(
  () => props.defaultHandle,
  (value) => {
    handle.value = value;
  },
);

watch(
  () => props.defaultPassword,
  (value) => {
    password.value = value;
  },
);

function submit() {
  emit("submit", {
    name: name.value,
    handle: handle.value,
    password: password.value,
  });
}
</script>

<template>
  <section class="auth-shell">
    <div class="auth-card panel">
      <div class="auth-copy">
        <h1>TarChat</h1>
        <p>Telegram-like desktop chat with Go, sqlite, local media storage, and realtime sync.</p>
        <small>Demo login: `jiahui` / `tar123456`</small>
      </div>

      <div class="auth-tabs">
        <button type="button" :class="{ active: authMode === 'login' }" @click="emit('update:authMode', 'login')">
          Sign in
        </button>
        <button type="button" :class="{ active: authMode === 'register' }" @click="emit('update:authMode', 'register')">
          Create account
        </button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <input v-if="authMode === 'register'" v-model="name" type="text" placeholder="Display name" />
        <input v-model="handle" type="text" placeholder="Handle" />
        <input v-model="password" type="password" placeholder="Password" />
        <button type="submit" class="cta">
          <font-awesome-icon :icon="authMode === 'login' ? 'comments' : 'user-plus'" />
          <span>{{ authMode === "login" ? "Enter workspace" : "Create and enter" }}</span>
        </button>
      </form>

      <p v-if="authError" class="error-text">{{ authError }}</p>
    </div>
  </section>
</template>
