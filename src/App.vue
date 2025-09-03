<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { buildRequirementTree, recalculateNodeInputs, recursivelyRecalculate, buildTreeFromMachineCount } from './logic/recipeCalculator';
import { generateMermaidString } from './logic/graphGenerator';
import RecipeTree from './components/RecipeTree.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import GraphView from './components/GraphView.vue';
import type { RequirementNode } from './types/types';
import { settings } from './logic/settings';
import { enToJa } from './logic/translations'; // 翻訳データをインポート

const targetItem = ref('Stellar Ice');
const targetRate = ref(10);
const requirementsTree = ref<RequirementNode | null>(null);
const errorMessage = ref('');

type CalcMode = 'output' | 'machines';
const calculationMode = ref<CalcMode>('output');
const machineCount = ref(1);

const isGraphVisible = ref(false);
const graphMermaidCode = ref('');
const graphStartNodeName = ref('');

// --- ▼ 追加: 翻訳ヘルパー関数 ---
const t = (key: string): string => {
  if (settings.language === 'ja' && enToJa[key]) {
    return enToJa[key];
  }
  return key;
};

const calculate = () => {
  if (!targetItem.value) {
    errorMessage.value = settings.language === 'ja' ? 'アイテム名を入力してください。' : 'Please enter an item name.';
    requirementsTree.value = null;
    return;
  }
  
  try {
    errorMessage.value = '';
    if (calculationMode.value === 'output') {
      if (targetRate.value <= 0) {
        errorMessage.value = settings.language === 'ja' ? '有効な生産数を入力してください。' : 'Please enter a valid production rate.';
        requirementsTree.value = null;
        return;
      }
      const itemsPerSecond = targetRate.value / 60;
      requirementsTree.value = buildRequirementTree(targetItem.value, itemsPerSecond);
    } else {
      if (machineCount.value <= 0) {
        errorMessage.value = settings.language === 'ja' ? '有効な設備台数を入力してください。' : 'Please enter a valid machine count.';
        requirementsTree.value = null;
        return;
      }
      requirementsTree.value = buildTreeFromMachineCount(targetItem.value, machineCount.value);
    }
  } catch (error: any) {
    errorMessage.value = `${settings.language === 'ja' ? '計算エラー' : 'Calculation error'}: ${error.message}`;
    requirementsTree.value = null;
    console.error(error);
  }
};

const handleRecipeSelectionChange = (payload: { node: RequirementNode }) => {
  recalculateNodeInputs(payload.node);
};

watch(settings, () => {
  if (requirementsTree.value) {
    recursivelyRecalculate(requirementsTree.value);
  }
}, { deep: true }); // deep watchでネストされた変更も検知

const handleShowGraph = (node: RequirementNode) => {
  graphMermaidCode.value = generateMermaidString(node);
  graphStartNodeName.value = node.name;
  isGraphVisible.value = true;
};
</script>

<template>
  <div id="app">
    <GraphView 
      v-if="isGraphVisible" 
      :mermaid-code="graphMermaidCode"
      :start-node-name="graphStartNodeName"
      @close="isGraphVisible = false"
    />
    <header><h1>{{ t('Recipe Requirement Calculator') }}</h1></header>
    <main>
      <SettingsPanel />
      <div class="controls">
        <div class="mode-selector">
          <label>
            <input type="radio" v-model="calculationMode" value="output"> {{ t('Calculate from Output Rate') }}
          </label>
          <label>
            <input type="radio" v-model="calculationMode" value="machines"> {{ t('Calculate from Machine Count') }}
          </label>
        </div>
        <div class="input-group">
          <label for="item-name">{{ t('Base Item:') }}</label>
          <input id="item-name" type="text" v-model="targetItem" />
        </div>
        <div v-if="calculationMode === 'output'" class="input-group">
          <label for="item-rate">{{ t('Production Rate (items/min):') }}</label>
          <input id="item-rate" type="number" v-model.number="targetRate" />
        </div>
        <div v-if="calculationMode === 'machines'" class="input-group">
          <label for="machine-count">{{ t('Machine Count:') }}</label>
          <input id="machine-count" type="number" v-model.number="machineCount" />
        </div>
        <button @click="calculate">{{ t('Calculate') }}</button>
        <p v-if="calculationMode === 'machines'" class="note">
          {{ t('Note: For items with multiple recipes, the first recipe is used for calculation.') }}
        </p>
      </div>
      <div class="result-container">
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
        <RecipeTree 
          v-if="requirementsTree" 
          :node="requirementsTree" 
          @recipe-selection-changed="handleRecipeSelectionChange" 
          @show-graph="handleShowGraph"
        />
      </div>
    </main>
  </div>
</template>

<style>
:root { 
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif; 
  line-height: 1.5; 
  font-weight: 400; 
  color-scheme: light dark; 
  color: rgba(255, 255, 255, 0.87); 
  background-color: #242424; 
}
#app { 
  max-width: 800px; 
  margin: 0 auto; 
  padding: 2rem; 
}
header { 
  text-align: center; 
  margin-bottom: 2rem; 
}
.controls { 
  display: flex; 
  flex-direction: column; 
  align-items: stretch; 
  background: #2f2f2f; 
  padding: 1.5rem; 
  border-radius: 8px; 
  margin-bottom: 2rem; 
}
.input-group { 
  display: flex; 
  flex-direction: column;
  margin-bottom: 1rem;
}
label { 
  margin-bottom: 0.5rem; 
  font-size: 0.9em; 
}
input { 
  padding: 0.5rem; 
  border-radius: 4px; 
  border: 1px solid #555; 
  background: #3c3c3c; 
  color: white;
}
button { 
  padding: 0.5rem 1rem; 
  border-radius: 4px; 
  border: none; 
  background-color: #535bf2; 
  color: white; 
  cursor: pointer; 
  height: fit-content; 
  margin-top: 1rem; 
}
button:hover { 
  background-color: #747bff; 
}
.result-container { 
  background: #2f2f2f; 
  padding: 1.5rem; 
  border-radius: 8px; 
  min-height: 200px; 
}
.error { 
  color: #e74c3c; 
}
.mode-selector { 
  display: flex; 
  gap: 1.5rem; 
  margin-bottom: 1rem; 
  background: #242424; 
  padding: 0.5rem; 
  border-radius: 6px; 
}
.mode-selector label { 
  cursor: pointer; 
  padding: 0.25rem 0.5rem; 
  margin-bottom: 0;
}
.note { 
  font-size: 0.8em; 
  color: #888; 
  margin-top: 0.5rem; 
}
</style>
