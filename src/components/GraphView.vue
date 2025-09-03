<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import mermaid from 'mermaid';

const props = defineProps<{
  mermaidCode: string,
  startNodeName: string,
}>();

const emit = defineEmits(['close']);

const mermaidContainer = ref<HTMLDivElement | null>(null);

const renderGraph = async () => {
  if (mermaidContainer.value && props.mermaidCode) {
    try {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      const { svg } = await mermaid.render(`mermaid-svg-${Date.now()}`, props.mermaidCode);
      mermaidContainer.value.innerHTML = svg;
    } catch (e) {
      mermaidContainer.value.innerHTML = 'グラフの描画に失敗しました。';
      console.error(e);
    }
  }
};

onMounted(renderGraph);
watch(() => props.mermaidCode, renderGraph);
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ startNodeName }} の依存関係グラフ</h3>
        <button @click="emit('close')" class="close-button">&times;</button>
      </div>
      <div class="graph-container" ref="mermaidContainer">
        <p>グラフを生成中...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: #2f2f2f;
  border: 1px solid #555;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 1000px;
  height: 80%;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #555;
  padding-bottom: 10px;
  margin-bottom: 10px;
}
.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  cursor: pointer;
}
.graph-container {
  flex-grow: 1;
  overflow: auto;
  text-align: center;
}
</style>