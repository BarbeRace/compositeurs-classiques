<template>
  <transition name="slide-fade">
    <aside class="card" v-if="composer">
      <button class="close" @click="$emit('close')">✕</button>
      <div class="card-body">
        <img v-if="composer.image" :src="composer.image" alt="" class="thumb" />
        <h2>{{ composer.label }}</h2>
        <p><strong>Époque</strong> : {{ composer.era }}</p>
        <p><strong>Mouvement</strong> : {{ composer.movement }}</p>
        <h3>Œuvres importantes</h3>
        <ul>
          <li v-for="w in composer.works" :key="w">{{ w }}</li>
        </ul>
      </div>
    </aside>
  </transition>
</template>

<script>
export default {
  props: { composer: { type: Object, default: null } }
};
</script>

<style scoped>
.card {
  width: 340px;
  position: absolute;
  right: 20px;
  top: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(2, 6, 23, 0.4);
  padding: 16px;
  z-index: 50;
}

.close {
  position: absolute;
  right: 8px;
  top: 8px;
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
}

.thumb {
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 12px;
}

.slide-fade-enter-active {
  transition: all 300ms cubic-bezier(.2, .8, .2, 1);
  transform-origin: right top;
}

.slide-fade-leave-active {
  transition: all 200ms ease;
}
</style>
