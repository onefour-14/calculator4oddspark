import type { RequirementNode } from '../types/types';
import { settings } from '../logic/settings';
import { enToJa } from '../logic/translations';

// Translation helper
const t = (key: string): string => {
  if (settings.language === 'ja' && enToJa[key]) {
    return enToJa[key];
  }
  return key;
};

// MermaidのIDとして使えるように、文字列からスペースや記号を削除する関数
const sanitizeForId = (name: string): string => {
  return name.replace(/[\s!"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~]/g, '');
};

/**
 * RequirementNodeツリーからMermaid.js用のフローチャート定義文字列を生成する
 */
export const generateMermaidString = (rootNode: RequirementNode): string => {
  // ▼ 修正: グラフの向きを Left to Right (LR) に変更
  const lines: string[] = ['graph LR;']; 
  const processedEdges = new Set<string>();

  const traverse = (node: RequirementNode) => {
    if (node.sourceRecipes && node.sourceRecipes.length > 0) {
      node.sourceRecipes.forEach(source => {
        const workstation = source.recipe.workstation;
        source.inputs.forEach(input => {
          const parentId = sanitizeForId(node.name);
          const inputId = sanitizeForId(input.name);
          
          // ▼ 修正: 矢印の向きを反転 (input --> parent)
          const edge = `${inputId} --> ${parentId}`;
          if (!processedEdges.has(edge)) {
            // IDには英語名、表示ラベルには翻訳された名前を使用
            lines.push(`    ${inputId}["${t(input.name)}"] -->|"via ${t(workstation)}"| ${parentId}["${t(node.name)}"];`);
            processedEdges.add(edge);
          }
          traverse(input);
        });
      });
    }
  };

  traverse(rootNode);

  // Raw Materialのスタイル定義
  lines.push('    classDef raw fill:#222,stroke:#888,stroke-width:2px;');
  const rawMaterials = findRawMaterials(rootNode);
  if (rawMaterials.size > 0) {
    const sanitizedRaws = Array.from(rawMaterials).map(sanitizeForId);
    lines.push(`    class ${sanitizedRaws.join(',')} raw;`);
  }

  return lines.join('\n');
};

/**
 * ツリーの中から原材料（それ以上分解されないノード）を見つけ出すヘルパー関数
 */
const findRawMaterials = (rootNode: RequirementNode): Set<string> => {
  const raws = new Set<string>();
  const traverse = (node: RequirementNode) => {
    if (!node.sourceRecipes || node.sourceRecipes.length === 0) {
      if (!node.recipeOptions || node.selectedRecipeIndices.length > 0 || node.recipeOptions.length === 0) {
        raws.add(node.name);
      }
      return;
    }
    node.sourceRecipes.forEach(source => {
      source.inputs.forEach(traverse);
    });
  };
  traverse(rootNode);
  return raws;
};

