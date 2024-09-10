import { UMB_HELP_MENU_ALIAS } from './constants.js';
import type { ManifestTypes, UmbBackofficeManifestKind } from '@umbraco-cms/backoffice/extension-registry';

export const manifests: Array<ManifestTypes | UmbBackofficeManifestKind> = [
	{
		type: 'menu',
		alias: UMB_HELP_MENU_ALIAS,
		name: 'Help Menu',
	},
	{
		type: 'menuItem',
		kind: 'link',
		alias: 'Umb.MenuItem.Help.LearningBase',
		name: 'Learning Base Help Menu Item',
		weight: 200,
		meta: {
			menus: [UMB_HELP_MENU_ALIAS],
			label: 'Umbraco Learning Base',
			icon: 'icon-movie-alt',
			href: 'https://learn.umbraco.com',
		},
	},
	{
		type: 'menuItem',
		kind: 'link',
		alias: 'Umb.MenuItem.Help.CommunityWebsite',
		name: 'Community Website Help Menu Item',
		weight: 100,
		meta: {
			menus: [UMB_HELP_MENU_ALIAS],
			label: 'Community Website',
			icon: 'icon-hearts',
			href: 'https://our.umbraco.com',
		},
	},
];
