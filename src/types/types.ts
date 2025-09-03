export interface Material {
    name: string;
    quantity?: number;
}

export interface Output {
    name: string;
    quantity: number;
}

export interface Recipe {
    output: Output[];
    workstation: string;
    materials?: Material[];
    speed: number;
    cycles?: number;
    temperature?: number;
    note?: string;
}

export type RecipeMap = Map<string, Recipe[]>;

// --- ▼ 修正: 生産ラインごとの情報を保持 ---
export interface SourceRecipeInfo {
    recipe: Recipe;
    rate: number;
    machines: number;
    inputs: RequirementNode[]; // この生産ラインで必要な材料
}

export interface RequirementNode {
    name: string;
    rate: number;
    recipeOptions?: Recipe[];
    selectedRecipeIndices: number[];
    // --- ▼ 修正: `inputs` を削除し `sourceRecipes` で管理 ---
    sourceRecipes?: SourceRecipeInfo[];
    ancestry: Set<string>;
    // `machines` と `workstation` は SourceRecipeInfo に移動したため削除
}