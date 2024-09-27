import { UmbSubmitWorkspaceAction } from '@umbraco-cms/backoffice/workspace';
import { UMB_DATA_TYPE_FOLDER_ENTITY_TYPE } from '../../../entity.js';
import { UMB_DATA_TYPE_FOLDER_WORKSPACE_ALIAS } from './constants.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'workspace',
		kind: 'routable',
		alias: UMB_DATA_TYPE_FOLDER_WORKSPACE_ALIAS,
		name: 'Data Type Folder Workspace',
		api: () => import('./data-type-folder-workspace.context.js'),
		meta: {
			entityType: UMB_DATA_TYPE_FOLDER_ENTITY_TYPE,
		},
	},
	{
		type: 'workspaceAction',
		kind: 'default',
		alias: 'Umb.WorkspaceAction.MediaType.Folder.Submit',
		name: 'Save Media Type Folder Workspace Action',
		api: UmbSubmitWorkspaceAction,
		meta: {
			label: '#buttons_save',
			look: 'primary',
			color: 'positive',
		},
		conditions: [
			{
				alias: 'Umb.Condition.WorkspaceAlias',
				match: UMB_DATA_TYPE_FOLDER_WORKSPACE_ALIAS,
			},
		],
	},
];
