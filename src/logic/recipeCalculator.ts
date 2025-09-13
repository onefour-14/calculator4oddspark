import { settings, sparkTypes } from './settings';
import recipeData from '../assets/recipe.json';
import { jaToEn } from './translations';
import type { Recipe, RequirementNode, RecipeMap, SourceRecipeInfo } from '../types/types';

const CALCULATION_THRESHOLD = 1e-9;

// --- データの前処理 (変更なし) ---
export const recipeMap: RecipeMap = new Map();
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

export const getFullTreeState = (node: RequirementNode | null, state: any = {}): any => {
    if (!node) return state;
    state[node.name] = { selectedRecipeIndices: [...node.selectedRecipeIndices] };
    if (node.sourceRecipes) {
        node.sourceRecipes.forEach(source => {
            source.inputs.forEach(child => getFullTreeState(child, state));
        });
    }
    return state;
};


export const calculateRequirements = (persistedState: any): Map<string, number> => {
    const requirements: Map<string, number> = new Map();
    const byproducts: Map<string, number> = new Map();
    const toProcess: Map<string, number> = new Map();

    const rootItemName = getCanonicalName(persistedState.root.name);
    toProcess.set(rootItemName, persistedState.root.rate);
    requirements.set(rootItemName, persistedState.root.rate);

    let iterations = 0;
    const MAX_ITERATIONS = 50; 

    while (toProcess.size > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        const processingQueue = new Map(toProcess);
        toProcess.clear();

        for (const [itemName, requiredRate] of processingQueue.entries()) {
            if (rawMaterials.has(itemName)) continue;

            const recipes = recipeMap.get(itemName);
            if (!recipes) continue;

            let selectedIndices: number[] = [];
            if (persistedState[itemName] && persistedState[itemName].selectedRecipeIndices) {
                selectedIndices = persistedState[itemName].selectedRecipeIndices;
            } else {
                selectedIndices = recipes.length === 1 ? [0] : [];
                persistedState[itemName] = { selectedIndices };
            }

            if (selectedIndices.length === 0) continue;
            
            const splitRate = requiredRate / selectedIndices.length;

            selectedIndices.forEach(index => {
                const recipe = recipes[index];
                const targetOutput = recipe.output.find(o => o.name === itemName);
                if (!targetOutput) return;

                const sparkCountMultiplier = settings.sparkCount;
                const sparkTypeMultiplier = sparkTypes[settings.sparkType as keyof typeof sparkTypes] || 1.0;
                const totalSpeedMultiplier = sparkCountMultiplier * sparkTypeMultiplier;
                const effectiveSpeed = recipe.speed / totalSpeedMultiplier;
                const timeInSeconds = effectiveSpeed * (recipe.cycles || 1);
                
                let recipeRateOfTargetOutput = targetOutput.quantity / timeInSeconds;
                if (recipe.workstation === 'Arboretum') {
                    recipeRateOfTargetOutput *= settings.arboretumFeederCount;
                }

                const machinesNeeded = recipeRateOfTargetOutput > 0 ? splitRate / recipeRateOfTargetOutput : 0;
                
                recipe.output.forEach(out => {
                    if (out.name !== itemName) {
                        const byproductRate = (out.quantity / timeInSeconds) * machinesNeeded;
                        byproducts.set(out.name, (byproducts.get(out.name) || 0) + byproductRate);
                    }
                });
                
                recipe.materials?.forEach(mat => {
                    const materialRate = (mat.quantity / timeInSeconds) * machinesNeeded;
                    const currentReq = requirements.get(mat.name) || 0;
                    requirements.set(mat.name, currentReq + materialRate);
                    toProcess.set(mat.name, (toProcess.get(mat.name) || 0) + materialRate);
                });
            });
        }
    }

    const netRequirements = new Map<string, number>();
    for (const [name, rate] of requirements.entries()) {
        const netRate = rate - (byproducts.get(name) || 0);
        if (netRate > CALCULATION_THRESHOLD) {
            netRequirements.set(name, netRate);
        }
    }
    return netRequirements;
}

export const buildFinalTree = (rootItemName: string, rootRate: number, netRequirements: Map<string, number>, persistedState: any): RequirementNode | null => {
    const buildNode = (itemName: string, requiredRate: number, ancestry: Set<string>): RequirementNode | null => {
        const canonicalItemName = getCanonicalName(itemName);
         if (requiredRate < CALCULATION_THRESHOLD) return null;

        if (ancestry.has(canonicalItemName)) {
            const netRate = netRequirements.get(canonicalItemName) || 0;
             if(netRate < CALCULATION_THRESHOLD) return null;
            return { name: canonicalItemName, rate: netRate, selectedRecipeIndices: [], ancestry, isCircular: true };
        }
        const newAncestry = new Set(ancestry);
        newAncestry.add(canonicalItemName);

        if (rawMaterials.has(canonicalItemName)) {
            return { name: canonicalItemName, rate: requiredRate, selectedRecipeIndices: [], ancestry: newAncestry };
        }

        const recipes = recipeMap.get(canonicalItemName);
        if (!recipes) {
            return { name: canonicalItemName, rate: requiredRate, selectedRecipeIndices: [], ancestry: newAncestry };
        }

        let selectedIndices: number[] = [];
        if(persistedState[canonicalItemName] && persistedState[canonicalItemName].selectedRecipeIndices){
            selectedIndices = persistedState[canonicalItemName].selectedRecipeIndices;
        } else if (recipes) {
            selectedIndices = recipes.length === 1 ? [0] : [];
        }
        
        const node: RequirementNode = {
            name: canonicalItemName,
            rate: requiredRate,
            recipeOptions: recipes,
            selectedRecipeIndices: selectedIndices,
            ancestry: newAncestry,
            sourceRecipes: []
        };

        if (selectedIndices.length > 0) {
            const splitRate = requiredRate / selectedIndices.length;
            
            selectedIndices.forEach(index => {
                 const recipe = recipes[index];
                 const targetOutput = recipe.output.find(o => o.name === canonicalItemName);
                 if (!targetOutput) return;

                const sparkCountMultiplier = settings.sparkCount;
                const sparkTypeMultiplier = sparkTypes[settings.sparkType as keyof typeof sparkTypes] || 1.0;
                const totalSpeedMultiplier = sparkCountMultiplier * sparkTypeMultiplier;
                const effectiveSpeed = recipe.speed / totalSpeedMultiplier;
                const timeInSeconds = effectiveSpeed * (recipe.cycles || 1);
                
                let recipeRateOfTargetOutput = targetOutput.quantity / timeInSeconds;
                if (recipe.workstation === 'Arboretum') {
                    recipeRateOfTargetOutput *= settings.arboretumFeederCount;
                }

                const machinesNeeded = recipeRateOfTargetOutput > 0 ? splitRate / recipeRateOfTargetOutput : 0;
                
                const inputs = recipe.materials?.map(mat => {
                     const totalProducedByRecipe = (mat.quantity! / timeInSeconds) * machinesNeeded;
                     return buildNode(mat.name, totalProducedByRecipe, newAncestry);

                }).filter((n): n is RequirementNode => n !== null);
                
                 node.sourceRecipes!.push({
                    recipe,
                    rate: splitRate,
                    machines: machinesNeeded,
                    inputs
                });
            });
        }

        return node;
    };

    const root = buildNode(rootItemName, rootRate, new Set());
    return root;
};


// --- ▼ 追加: 全ての生産可能なアイテムのリストをエクスポート ---
export const allCraftableItems: string[] = Array.from(recipeMap.keys()).sort();
