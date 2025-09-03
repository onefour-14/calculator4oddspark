import { reactive } from 'vue';

export type Language = 'ja' | 'en';

export const sparkTypes = {
  'ノーマル': 1.0,
  'Crafty Spark': 1.5,
  'Handy Spark': 2.5,
};

export const settings = reactive({
  sparkCount: 1,
  sparkType: 'ノーマル',
  arboretumFeederCount: 1,
  language: 'ja' as Language, // ⬅️ 追加
});