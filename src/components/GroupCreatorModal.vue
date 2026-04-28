<script setup lang="ts">
import type { ChatUser } from "../lib/chatApi";

defineProps<{
  open: boolean;
  title: string;
  description: string;
  memberIds: string[];
  users: ChatUser[];
  saving: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [];
  "update:title": [string];
  "update:description": [string];
  "update:memberIds": [string[]];
}>();
</script>

<template>
  <div v-if="open" class="media-modal" @click.self="emit('close')">
    <div class="group-modal panel">
      <h3>Create Group</h3>
      <input
        :value="title"
        type="text"
        placeholder="Group title"
        class="modal-input"
        @input="emit('update:title', ($event.target as HTMLInputElement).value)"
      />
      <textarea
        :value="description"
        class="announcement-input"
        placeholder="Short description"
        @input="emit('update:description', ($event.target as HTMLTextAreaElement).value)"
      />
      <div class="section-title">Invite People</div>
      <label v-for="user in users" :key="user.id" class="picker-row">
        <input
          :checked="memberIds.includes(user.id)"
          type="checkbox"
          @change="
            emit(
              'update:memberIds',
              ($event.target as HTMLInputElement).checked
                ? [...memberIds, user.id]
                : memberIds.filter((id) => id !== user.id),
            )
          "
        />
        <span>{{ user.name }} <small>{{ user.handle }}</small></span>
      </label>
      <div class="group-actions">
        <button type="button" class="cta compact-cta" @click="emit('submit')">
          {{ saving ? "Creating..." : "Create Group" }}
        </button>
        <button type="button" class="cta compact-cta" @click="emit('close')">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
