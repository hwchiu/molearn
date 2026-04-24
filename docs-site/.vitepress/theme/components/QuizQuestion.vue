<template>
  <div v-if="!answered" class="quiz-question">
    <p class="question-text">{{ question }}</p>
    <div class="options">
      <label
        v-for="(opt, i) in options"
        :key="i"
        class="option"
        :class="{ selected: selected === i }"
      >
        <input type="radio" :value="i" v-model="selected" />
        <span>{{ opt }}</span>
      </label>
    </div>
    <button class="confirm-btn" :disabled="selected === null" @click="submit">確認答案</button>
  </div>
  <div v-else class="quiz-result" :class="isCorrect ? 'correct' : 'wrong'">
    <p class="result-badge">{{ isCorrect ? '✅ 正確！' : '❌ 錯誤' }}</p>
    <p class="question-text">{{ question }}</p>
    <div class="options answered">
      <div
        v-for="(opt, i) in options"
        :key="i"
        class="option"
        :class="{
          'is-correct': i === answer,
          'is-wrong': selected === i && i !== answer
        }"
      >
        <span>{{ opt }}</span>
      </div>
    </div>
    <div class="explanation">
      <strong>解析：</strong> {{ explanation }}
    </div>
    <button class="reset-btn" @click="reset">重新作答</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  question: String,
  options: Array,
  answer: Number,
  explanation: String,
})

const selected = ref(null)
const answered = ref(false)
const isCorrect = computed(() => selected.value === props.answer)

function submit() {
  if (selected.value !== null) answered.value = true
}
function reset() {
  selected.value = null
  answered.value = false
}
</script>

<style scoped>
.quiz-question, .quiz-result {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  margin: 1.5rem 0;
  background: var(--vp-c-bg-soft);
}
.question-text { font-weight: 600; margin-bottom: 0.75rem; }
.options { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.option {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  cursor: pointer;
  background: var(--vp-c-bg);
}
.option.selected { border-color: var(--vp-c-brand); background: var(--vp-c-brand-soft); }
.option input { margin-top: 3px; }
.confirm-btn, .reset-btn {
  padding: 0.4rem 1.2rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  background: var(--vp-c-brand);
  color: #fff;
}
.confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.quiz-result.correct { border-color: #22c55e; }
.quiz-result.wrong { border-color: #ef4444; }
.result-badge { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
.option.is-correct { background: #dcfce7; border-color: #22c55e; }
.option.is-wrong { background: #fee2e2; border-color: #ef4444; }
.explanation { margin-top: 1rem; padding: 0.75rem; background: var(--vp-c-bg); border-radius: 6px; font-size: 0.92rem; }
</style>
