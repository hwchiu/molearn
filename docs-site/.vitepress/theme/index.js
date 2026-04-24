import DefaultTheme from 'vitepress/theme'
import QuizQuestion from './components/QuizQuestion.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('QuizQuestion', QuizQuestion)
  },
}
