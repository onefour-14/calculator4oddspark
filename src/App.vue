<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { calculateRequirements, buildFinalTree, getFullTreeState, allCraftableItems, recipeMap } from './logic/recipeCalculator';
import { generateMermaidString } from './logic/graphGenerator';
import RecipeTree from './components/RecipeTree.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import GraphView from './components/GraphView.vue';
import type { RequirementNode } from './types/types';
import { settings, sparkTypes } from './logic/settings';
import { enToJa } from './logic/translations';

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

const t = (key: string): string => {
  if (settings.language === 'ja' && enToJa[key]) {
    return enToJa[key];
  }
  return key;
};

const translatedCraftableItems = computed(() => {
    return allCraftableItems.map(item => ({
        value: item,
        text: t(item)
    })).sort((a, b) => a.text.localeCompare(b.text, 'ja'));
});


const calculate = (persistedState: any = null) => {
  if (!targetItem.value) {
    errorMessage.value = t('Please enter an item name.');
    requirementsTree.value = null;
    return;
  }
  try {
    errorMessage.value = '';
    let newTree;
    let rootRate = 0;
    const rootItemName = targetItem.value;

    let state = persistedState;
    if (!state) {
        state = { root: { name: rootItemName, rate: 0 } };
    }
    state.root.name = rootItemName;

    if (calculationMode.value === 'output') {
        if (targetRate.value <= 0) {
            errorMessage.value = t('Please enter a valid production rate.');
            requirementsTree.value = null;
            return;
        }
        rootRate = targetRate.value / 60;
    } else {
          if (machineCount.value <= 0) {
            errorMessage.value = t('Please enter a valid machine count.');
            requirementsTree.value = null;
            return;
        }
          const recipes = recipeMap.get(rootItemName);
        if (!recipes || recipes.length === 0) throw new Error(`Recipe not found for item: ${rootItemName}`);

        let recipeIndex = 0;
        if (state[rootItemName] && state[rootItemName].selectedRecipeIndices.length > 0) {
            recipeIndex = state[rootItemName].selectedRecipeIndices[0];
        } else {
            state[rootItemName] = { selectedRecipeIndices: [0] };
        }
          const recipe = recipes[recipeIndex];
          const mainOutput = recipe.output.find(o => o.name === rootItemName) || recipe.output[0];

        const sparkCountMultiplier = settings.sparkCount;
        const sparkTypeMultiplier = sparkTypes[settings.sparkType as keyof typeof sparkTypes] || 1.0;
        const totalSpeedMultiplier = sparkCountMultiplier * sparkTypeMultiplier;
        const effectiveSpeed = recipe.speed / totalSpeedMultiplier;
        const timeInSeconds = effectiveSpeed * (recipe.cycles || 1);
        let recipeRatePerMachine = mainOutput.quantity / timeInSeconds;
        if (recipe.workstation === 'Arboretum') {
            recipeRatePerMachine *= settings.arboretumFeederCount;
        }
        rootRate = recipeRatePerMachine * machineCount.value;
    }
    
    state.root.rate = rootRate;
    
    const netRequirements = calculateRequirements(state);
    newTree = buildFinalTree(rootItemName, rootRate, netRequirements, state);

    requirementsTree.value = newTree;

  } catch (error: any) {
    errorMessage.value = `${t('Calculation error')}: ${error.message}`;
    requirementsTree.value = null;
    console.error(error);
  }
};

const handleRecipeSelectionChange = (payload: { node: RequirementNode, newIndices: number[] }) => {
  const currentState = getFullTreeState(requirementsTree.value);
  currentState[payload.node.name].selectedRecipeIndices = payload.newIndices;
  currentState.root = { name: requirementsTree.value!.name, rate: requirementsTree.value!.rate };
  calculate(currentState);
};

watch(()=> [settings.sparkCount, settings.sparkType, settings.arboretumFeederCount, settings.language], () => {
    if (requirementsTree.value) {
          const currentState = getFullTreeState(requirementsTree.value);
          currentState.root = { name: requirementsTree.value.name, rate: requirementsTree.value.rate };
          calculate(currentState);
    }
}, { deep: true });

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
          <select id="item-name" v-model="targetItem">
              <option v-for="item in translatedCraftableItems" :key="item.value" :value="item.value">
                  {{ item.text }}
              </option>
          </select>
        </div>
        <div v-if="calculationMode === 'output'" class="input-group">
          <label for="item-rate">{{ t('Production Rate (items/min):') }}</label>
          <input id="item-rate" type="number" v-model.number="targetRate" />
        </div>
        <div v-if="calculationMode === 'machines'" class="input-group">
          <label for="machine-count">{{ t('Machine Count:') }}</label>
          <input id="machine-count" type="number" v-model.number="machineCount" />
        </div>
        <button @click="calculate()">{{ t('Calculate') }}</button>
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
input, select { 
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

