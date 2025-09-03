import { settings, sparkTypes } from './settings';
import recipeData from '../assets/recipe.json';
import { jaToEn } from './translations';
import type { Recipe, RequirementNode, RecipeMap, SourceRecipeInfo } from '../types/types';

const CALCULATION_THRESHOLD = 1e-6;

// --- データの前処理 (変更なし) ---
const recipeMap: RecipeMap = new Map();
const rawMaterials = new Set<string>(recipeData.drops.map(d => d.name));
const workstations = recipeData.recipes[0];
for (const stationName in workstations) {
  const recipes = workstations[stationName as keyof typeof workstations] as any[];
  recipes.forEach(recipe => {
    if (recipe.spped) { recipe.speed = recipe.spped; delete recipe.spped; }
    if (!recipe.output && recipe.name && typeof recipe.quantity !== 'undefined') {
      recipe.output = [{ name: recipe.name, quantity: recipe.quantity }];
    }
    if (recipe.output && recipe.output.length > 0) {
      recipe.output.forEach(out => {
        if (!recipeMap.has(out.name)) { recipeMap.set(out.name, []); }
        recipeMap.get(out.name)!.push(recipe);
      });
    }
  });
}
recipeMap.forEach(recipeArray => {
  recipeArray.forEach(recipe => {
    recipe.materials?.forEach(mat => {
      if (!recipeMap.has(mat.name) && !rawMaterials.has(mat.name)) {
        rawMaterials.add(mat.name);
      }
    });
  });
});

const getCanonicalName = (name: string): string => {
  if (jaToEn.has(name)) {
    return jaToEn.get(name)!;
  }
  return name;
};

// --- ノード再計算関数 (変更なし) ---
export const recalculateNodeInputs = (node: RequirementNode): void => {
  if (node.selectedRecipeIndices.length === 0) {
    node.sourceRecipes = [];
    return;
  }
  const sparkCountMultiplier = settings.sparkCount;
  const sparkTypeMultiplier = sparkTypes[settings.sparkType as keyof typeof sparkTypes] || 1.0;
  const totalSpeedMultiplier = sparkCountMultiplier * sparkTypeMultiplier;
  const splitRate = node.rate / node.selectedRecipeIndices.length;
  const sourceRecipes: SourceRecipeInfo[] = [];
  node.selectedRecipeIndices.forEach(index => {
    const recipe = node.recipeOptions![index];
    const mainOutput = recipe.output[0];
    const effectiveSpeed = recipe.speed / totalSpeedMultiplier;
    const timeInSeconds = effectiveSpeed * (recipe.cycles || 1);
    let recipeRate = mainOutput.quantity / timeInSeconds;
    if (recipe.workstation === 'Arboretum') {
      recipeRate *= settings.arboretumFeederCount;
    }
    const machinesNeeded = splitRate / recipeRate;
    const inputs = recipe.materials?.map(material => {
      const materialQty = material.quantity || 1;
      let requiredRate: number;
      if (recipe.cycles) {
        let cyclesPerSecond = machinesNeeded * (recipe.cycles / timeInSeconds);
        if (recipe.workstation === 'Arboretum') {
          cyclesPerSecond *= settings.arboretumFeederCount;
        }
        requiredRate = materialQty * cyclesPerSecond;
      } else {
        requiredRate = materialQty * machinesNeeded;
      }
      return buildRequirementTree(material.name, requiredRate, node.ancestry);
    }) || [];
    sourceRecipes.push({ recipe, rate: splitRate, machines: machinesNeeded, inputs });
  });
  node.sourceRecipes = sourceRecipes;
};

// --- ツリー初期構築関数 (変更なし) ---
export const buildRequirementTree = (
  itemName: string,
  itemsPerSecond: number,
  ancestry: Set<string> = new Set()
): RequirementNode => {
  const canonicalItemName = getCanonicalName(itemName);
  if (itemsPerSecond < CALCULATION_THRESHOLD || ancestry.has(canonicalItemName)) {
    return { name: canonicalItemName, rate: itemsPerSecond, selectedRecipeIndices: [], ancestry };
  }
  const newAncestry = new Set(ancestry);
  newAncestry.add(canonicalItemName);
  if (rawMaterials.has(canonicalItemName)) {
    return { name: canonicalItemName, rate: itemsPerSecond, selectedRecipeIndices: [], ancestry: newAncestry };
  }
  const recipes = recipeMap.get(canonicalItemName);
  if (!recipes || recipes.length === 0) {
    return { name: canonicalItemName, rate: itemsPerSecond, selectedRecipeIndices: [], ancestry: newAncestry };
  }
  const initialSelection = recipes.length === 1 ? [0] : [];
  const node: RequirementNode = {
    name: canonicalItemName,
    rate: itemsPerSecond,
    recipeOptions: recipes,
    selectedRecipeIndices: initialSelection,
    ancestry: newAncestry,
    sourceRecipes: []
  };
  if (initialSelection.length > 0) {
    recalculateNodeInputs(node);
  }
  return node;
};

// --- 設備台数から逆算する関数 (変更なし) ---
export const buildTreeFromMachineCount = (
  itemName: string,
  machineCount: number
): RequirementNode => {
  const canonicalItemName = getCanonicalName(itemName);
  const recipes = recipeMap.get(canonicalItemName);
  if (!recipes || recipes.length === 0) {
    throw new Error(`Recipe not found for item: ${canonicalItemName}`);
  }
  const recipe = recipes[0];
  const mainOutput = recipe.output[0];
  const sparkCountMultiplier = settings.sparkCount;
  const sparkTypeMultiplier = sparkTypes[settings.sparkType as keyof typeof sparkTypes] || 1.0;
  const totalSpeedMultiplier = sparkCountMultiplier * sparkTypeMultiplier;
  const effectiveSpeed = recipe.speed / totalSpeedMultiplier;
  const timeInSeconds = effectiveSpeed * (recipe.cycles || 1);
  let recipeRatePerMachine = mainOutput.quantity / timeInSeconds;
  if (recipe.workstation === 'Arboretum') {
    recipeRatePerMachine *= settings.arboretumFeederCount;
  }
  const totalOutputRate = recipeRatePerMachine * machineCount;
  return buildRequirementTree(canonicalItemName, totalOutputRate);
};

// --- 既存の関数 (変更なし) ---
export const recursivelyRecalculate = (node: RequirementNode): void => {
  recalculateNodeInputs(node);
  if (node.sourceRecipes) {
    node.sourceRecipes.forEach(source => {
      source.inputs.forEach(childNode => {
        recursivelyRecalculate(childNode);
      });
    });
  }
};

// --- ▼ 追加: 全ての生産可能なアイテムのリストをエクスポート ---
export const allCraftableItems: string[] = Array.from(recipeMap.keys()).sort();

