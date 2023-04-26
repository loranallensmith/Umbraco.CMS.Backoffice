import type { ManifestBase, ManifestWithConditions } from '.';

export interface ManifestWorkspaceViewCollection
	extends ManifestBase,
		ManifestWithConditions<ConditionsEditorViewCollection> {
	type: 'workspaceViewCollection';
	meta: MetaEditorViewCollection;
}
export interface MetaEditorViewCollection {
	pathname: string;
	label: string;
	icon: string;
	entityType: string;
	repositoryAlias: string;
}

export interface ConditionsEditorViewCollection {
	workspaces: string[];
}
