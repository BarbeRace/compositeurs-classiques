<template>
  <div id="app">
    <header class="topbar">
      <h1>Mindmap Compositeurs</h1>
      <div class="controls">
        <select v-model="filterEra" @change="applyFilter">
          <option value="">Toutes les époques</option>
          <option v-for="e in eras" :key="e" :value="e">{{ e }}</option>
        </select>
      </div>
    </header>

    <main class="main">
      <ComposerGraph
        :data-url="dataUrl"
        :filter-era="filterEra"
        @open-card="openCard"
      />
      <ComposerCard
        v-if="selected"
        :composer="selected"
        @close="selected = null"
      />
    </main>
  </div>
</template>

<script>
import ComposerGraph from './components/ComposerGraph.vue';
import ComposerCard from './components/ComposerCard.vue';
import composers from './data/composers.json';

export default {
  components: { ComposerGraph, ComposerCard },
  data() {
    return {
      dataUrl: '/src/data/composers.json',
      selected: null,
      filterEra: '',
      eras: [...new Set(composers.nodes.map(n => n.era))].sort()
    };
  },
  methods: {
    openCard(composer) {
      this.selected = composer;
    },
    applyFilter() {
      // ComposerGraph reçoit prop filter-era et se réarrange
    }
  }
};
</script>

<style>
/* minimal layout */
html,body,#app { height:100%; margin:0; font-family:Inter,system-ui,Arial; }
.topbar { height:64px; display:flex; align-items:center; justify-content:space-between; padding:0 20px; background:#0b1220; color:#fff; }
.main { height:calc(100% - 64px); display:flex; position:relative; }
</style>
