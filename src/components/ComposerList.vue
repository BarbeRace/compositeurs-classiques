<template>
  <div class="composer-list" v-html="html"></div>
</template>

<script>
import MarkdownIt from 'markdown-it';

export default {
  name: 'ComposerList',
  props: { src: { type: String, required: true } },
  data() { return { html: '' }; },
  mounted() {
    fetch(this.src).then(r => r.text()).then(md => {
      const mdParser = new MarkdownIt({ html: true });
      this.html = mdParser.render(md);
    });
  }
};
</script>

<style scoped>
.composer-list { padding: 16px; max-width: 720px; color: #fff; background: rgba(255,255,255,0.03); border-radius: 8px; overflow:auto; }
.composer-list h1,h2,h3 { color: #ffd; }
.composer-list li { margin-bottom: 6px; }
</style>