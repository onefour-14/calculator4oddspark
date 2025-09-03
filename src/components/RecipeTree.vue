<script setup lang="ts">
import type { PropType } from 'vue';
import type { RequirementNode, Recipe } from '../types/types';
import { settings } from '../logic/settings';
import { enToJa } from '../logic/translations';

const props = defineProps({
  node: {
    type: Object as PropType<RequirementNode>,
    required: true,
  },
});

const emit = defineEmits(['recipeSelectionChanged', 'showGraph']);

// Translation helper
const t = (key: string): string => {
  if (settings.language === 'ja' && enToJa[key]) {
    return enToJa[key];
  }
  return key;
};

const onSelectionChange = () => {
  emit('recipeSelectionChanged', { node: props.node });
};

const showGraphForNode = () => {
  emit('showGraph', props.node);
};

const recipeDescription = (recipe: Recipe) => {
  const workstation = t(recipe.workstation);
  const materials = recipe.materials?.map(m => `${t(m.name)} x${m.quantity || 1}`).join(', ') || t('None');
  return `${workstation} (${t('Materials')}: ${materials})`;
};
</script>

<template>
  <div class="recipe-node">
    <div class="node-content">
      <div class="node-main-line">
        <button @click="showGraphForNode" class="graph-button" :title="t('Show dependency graph')">📊</button>
        <strong class="item-name">{{ t(node.name) }}</strong>
        <span class="rate">{{ (node.rate * 60).toFixed(3) }} {{ t('items/min') }}</span>
      </div>
    </div>
    
    <div v-if="node.recipeOptions && node.recipeOptions.length > 1" class="recipe-selector">
      <div v-for="(recipe, index) in node.recipeOptions" :key="index" class="checkbox-wrapper">
        <input 
          type="checkbox" 
          :id="`${node.name}-${index}`" 
          :value="index"
          v-model="node.selectedRecipeIndices"
          @change="onSelectionChange"
        >
        <label :for="`${node.name}-${index}`">{{ recipeDescription(recipe) }}</label>
      </div>
    </div>

    <div v-if="node.sourceRecipes && node.sourceRecipes.length > 0" class="source-list">
      <div v-for="(source, index) in node.sourceRecipes" :key="index" class="source-branch">
        <div class="branch-info">
          <span class="branch-line">↳</span>
          <div class="branch-details">
            <span class="workstation">{{ t(source.recipe.workstation) }}</span>
            <span class="machines">(🏭 {{ source.machines.toFixed(3) }} {{ t('units') }})</span>
            <span class="rate-split">{{ t('produces') }} {{ (source.rate * 60).toFixed(3) }} {{ t('items/min') }}{{ t('担当') }}</span>
          </div>
        </div>
        
        <ul v-if="source.inputs && source.inputs.length > 0" class="children-list">
          <li v-for="(child, childIndex) in source.inputs" :key="childIndex">
            <RecipeTree 
              :node="child" 
              @recipe-selection-changed="(payload) => emit('recipeSelectionChanged', payload)" 
              @show-graph="(payload) => emit('showGraph', payload)" 
            />
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recipe-node {
  padding: 5px 0;
  position: relative;
}
ul {
  list-style-type: none;
  padding-left: 0;
  margin: 0;
}
.source-list {
  position: relative;
  padding-left: 25px;
}
.source-branch {
  position: relative;
}
.source-branch::before {
  content: '';
  position: absolute;
  top: 15px;
  left: -25px;
  width: 25px;
  height: 1px;
  background-color: #444;
}
.source-list::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 100%;
  background-color: #444;
}
.source-list > .source-branch:last-child::after {
  content: '';
  position: absolute;
  top: 16px;
  left: -25px;
  width: 1px;
  height: 100%;
  background-color: #2f2f2f;
}
.node-main-line {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1em;
}
.item-name { color: #e0e0e0; }
.rate { color: #3498db; font-weight: bold; }
.recipe-selector {
  margin: 10px 0;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #444;
}
.checkbox-wrapper { display: flex; align-items: center; margin-bottom: 5px; font-size: 0.9em; }
input[type="checkbox"] { margin-right: 10px; cursor: pointer; }
label { cursor: pointer; }
.branch-info {
  display: flex;
  align-items: baseline;
  padding: 4px 0;
}
.branch-line {
  color: #666;
  margin-right: 8px;
}
.branch-details {
  font-size: 0.95em;
  color: #aaa;
  padding: 4px 8px;
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.workstation { color: #9b59b6; font-weight: bold; }
.machines { color: #e67e22; font-style: italic; }
.children-list {
  position: relative;
  margin-top: 5px;
  padding-left: 25px;
  border-left: 1px solid #444;
}
.children-list > li {
  position: relative;
}
.children-list > li::before {
  content: '';
  position: absolute;
  top: 15px;
  left: -25px;
  width: 25px;
  height: 1px;
  background-color: #444;
}
.children-list > li:last-child {
  padding-bottom: 5px;
}
.children-list > li:last-child::after {
  content: '';
  position: absolute;
  top: 16px;
  left: -25px;
  width: 1px;
  height: calc(100% - 15px);
  background-color: #2f2f2f;
}
.graph-button {
  background: none;
  border: 1px solid #555;
  color: white;
  padding: 2px 5px;
  border-radius: 4px;
  cursor: pointer;
}
.graph-button:hover {
  background: #555;
}
</style>
