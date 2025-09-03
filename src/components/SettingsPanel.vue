<script setup lang="ts">
import { settings, sparkTypes, Language } from '../logic/settings';
import { enToJa } from '../logic/translations';

// Translation helper
const t = (key: string): string => {
  if (settings.language === 'ja' && enToJa[key]) {
    return enToJa[key];
  }
  return key;
};
</script>

<template>
  <div class="settings-panel">
    <h2>⚙️ {{ t('Equipment Settings') }}</h2>
    <div class="settings-controls">
      <!-- Language Selector -->
      <div class="input-group">
        <label for="language-select">Language:</label>
        <select id="language-select" v-model="settings.language">
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </div>

      <!-- Spark Count -->
      <div class="input-group">
        <label for="spark-count">{{ t('Number of Sparks:') }}</label>
        <select id="spark-count" v-model.number="settings.sparkCount">
          <option :value="1">{{ t('1 Spark') }}</option>
          <option :value="2">{{ t('2 Sparks') }}</option>
        </select>
      </div>

      <!-- Spark Type -->
      <div class="input-group">
        <label for="spark-type">{{ t('Spark Type:') }}</label>
        <select id="spark-type" v-model="settings.sparkType">
          <option v-for="(multiplier, type) in sparkTypes" :key="type" :value="type">
            {{ t(type) }} ({{ multiplier * 100 }}%)
          </option>
        </select>
      </div>
      
      <!-- Arboretum Feeder Count -->
      <div class="input-group">
        <label for="feeder-count">{{ t('Number of Arboretum Feeders:') }}</label>
        <input 
          id="feeder-count" 
          type="number" 
          v-model.number="settings.arboretumFeederCount" 
          min="1" 
          step="1" 
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  background: #2f2f2f;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}
h2 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.2em;
  border-bottom: 1px solid #444;
  padding-bottom: 0.5rem;
}
.settings-controls {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}
.input-group {
  display: flex;
  flex-direction: column;
}
label {
  margin-bottom: 0.5rem;
  font-size: 0.9em;
  color: #ccc;
}
select, input {
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #555;
  background: #3c3c3c;
  color: white;
  min-width: 150px;
}
</style>
