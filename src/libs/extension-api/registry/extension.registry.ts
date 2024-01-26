import type { ManifestBase, ManifestKind } from '../types/index.js';
import type { ManifestTypeMap, SpecificManifestTypeOrManifestBase } from '../types/map.types.js';
import { UmbBasicState } from '@umbraco-cms/backoffice/observable-api';
import type { Observable } from '@umbraco-cms/backoffice/external/rxjs';
import { map, distinctUntilChanged, combineLatest, of, switchMap } from '@umbraco-cms/backoffice/external/rxjs';

function extensionArrayMemoization<T extends Pick<ManifestBase, 'alias'>>(
	previousValue: Array<T>,
	currentValue: Array<T>,
): boolean {
	// If length is different, data is different:
	if (previousValue.length !== currentValue.length) {
		return false;
	}
	// previousValue has an alias that is not present in currentValue:
	if (previousValue.find((p) => !currentValue.find((c) => c.alias === p.alias))) {
		return false;
	}
	return true;
}

function extensionAndKindMatchArrayMemoization<
	T extends Pick<ManifestBase, 'alias'> & { __isMatchedWithKind?: boolean },
>(previousValue: Array<T>, currentValue: Array<T>): boolean {
	// If length is different, data is different:
	if (previousValue.length !== currentValue.length) {
		return false;
	}
	// previousValue has an alias that is not present in currentValue:
	/* !! This is covered by the test below:
	if (previousValue.find((p) => !currentValue.find((c) => c.alias === p.alias))) {
		return false;
	}*/
	// if previousValue has different meta values:
	if (
		currentValue.find((newValue: T) => {
			const oldValue = previousValue.find((c) => c.alias === newValue.alias);
			// First check if we found a previous value, matching this alias.
			// Then checking __isMatchedWithKind, as this is much more performant than checking the whole object. (I assume the only change happening to an extension is the match with a kind, we do not want to watch for other changes)
			return oldValue === undefined || newValue.__isMatchedWithKind !== oldValue.__isMatchedWithKind;
		})
	) {
		return false;
	}
	return true;
}

function extensionSingleMemoization<T extends Pick<ManifestBase, 'alias'>>(
	previousValue: T | undefined,
	currentValue: T | undefined,
): boolean {
	if (previousValue && currentValue) {
		return previousValue.alias === currentValue.alias;
	}
	return previousValue === currentValue;
}

function extensionAndKindMatchSingleMemoization<
	T extends Pick<ManifestBase, 'alias'> & { __isMatchedWithKind?: boolean },
>(previousValue: T | undefined, currentValue: T | undefined): boolean {
	if (previousValue && currentValue) {
		return (
			previousValue.alias === currentValue.alias &&
			previousValue.__isMatchedWithKind === currentValue.__isMatchedWithKind
		);
	}
	return previousValue === currentValue;
}

const sortExtensions = (a: ManifestBase, b: ManifestBase) => (b.weight || 0) - (a.weight || 0);

export class UmbExtensionRegistry<
	IncomingManifestTypes extends ManifestBase,
	ManifestTypes extends ManifestBase = IncomingManifestTypes | ManifestBase,
> {
	readonly MANIFEST_TYPES: ManifestTypes = undefined as never;

	private _extensions = new UmbBasicState<Array<ManifestTypes>>([]);
	public readonly extensions = this._extensions.asObservable();

	private _kinds = new UmbBasicState<Array<ManifestKind<ManifestTypes>>>([]);
	public readonly kinds = this._kinds.asObservable();

	defineKind(kind: ManifestKind<ManifestTypes>) {
		const extensionsValues = this._extensions.getValue();
		const extension = extensionsValues.find(
			(extension) => extension.alias === (kind as ManifestKind<ManifestTypes>).alias,
		);

		if (extension) {
			console.error(`Extension Kind with alias ${(kind as ManifestKind<ManifestTypes>).alias} is already registered`);
			return;
		}

		const nextData = this._kinds
			.getValue()
			.filter(
				(k) =>
					!(
						k.matchType === (kind as ManifestKind<ManifestTypes>).matchType &&
						k.matchKind === (kind as ManifestKind<ManifestTypes>).matchKind
					),
			);
		nextData.push(kind as ManifestKind<ManifestTypes>);
		this._kinds.setValue(nextData);
	}

	register(manifest: ManifestTypes | ManifestKind<ManifestTypes>): void {
		const isValid = this.#checkExtension(manifest);
		if (!isValid) {
			return;
		}

		this._extensions.setValue([...this._extensions.getValue(), manifest as ManifestTypes]);
	}

	registerMany(manifests: Array<ManifestTypes | ManifestKind<ManifestTypes>>): void {
		// we have to register extensions individually, so we ensure a manifest is valid before continuing to the next one
		manifests.forEach((manifest) => this.register(manifest));
	}

	unregisterMany(aliases: Array<string>): void {
		aliases.forEach((alias) => this.unregister(alias));
	}

	unregister(alias: string): void {
		const newKindsValues = this._kinds.getValue().filter((kind) => kind.alias !== alias);
		const newExtensionsValues = this._extensions.getValue().filter((extension) => extension.alias !== alias);

		this._kinds.setValue(newKindsValues);
		this._extensions.setValue(newExtensionsValues);
	}

	isRegistered(alias: string): boolean {
		if (this._extensions.getValue().find((ext) => ext.alias === alias)) {
			return true;
		}

		if (this._kinds.getValue().find((ext) => ext.alias === alias)) {
			return true;
		}

		return false;
	}

	#checkExtension(manifest: ManifestTypes | ManifestKind<ManifestTypes>): boolean {
		if (!manifest.type) {
			console.error(`Extension is missing type`, manifest);
			return false;
		}

		if (!manifest.alias) {
			console.error(`Extension is missing alias`, manifest);
			return false;
		}

		if (manifest.type === 'kind') {
			this.defineKind(manifest as ManifestKind<ManifestTypes>);
			return false;
		}

		const extensionsValues = this._extensions.getValue();
		const extension = extensionsValues.find((extension) => extension.alias === (manifest as ManifestTypes).alias);

		if (extension) {
			console.error(`Extension with alias ${(manifest as ManifestTypes).alias} is already registered`);
			return false;
		}

		return true;
	}

	#kindsOfType<Key extends keyof ManifestTypeMap<ManifestTypes> | string>(type: Key) {
		return this.kinds.pipe(
			map((kinds) => kinds.filter((kind) => kind.matchType === type)),
			distinctUntilChanged(extensionArrayMemoization),
		);
	}
	#extensionsOfType<Key extends keyof ManifestTypeMap<ManifestTypes> | string>(type: Key) {
		return this.extensions.pipe(
			map((exts) => exts.filter((ext) => ext.type === type)),
			distinctUntilChanged(extensionArrayMemoization),
		);
	}
	#kindsOfTypes(types: string[]) {
		return this.kinds.pipe(
			map((kinds) => kinds.filter((kind) => types.indexOf(kind.matchType) !== -1)),
			distinctUntilChanged(extensionArrayMemoization),
		);
	}

	// TODO: can we get rid of as unknown here
	#extensionsOfTypes<ExtensionType extends ManifestBase = ManifestBase>(
		types: Array<ExtensionType['type']>,
	): Observable<Array<ExtensionType>> {
		return this.extensions.pipe(
			map((exts) => exts.filter((ext) => types.indexOf(ext.type) !== -1)),
			distinctUntilChanged(extensionArrayMemoization),
		) as unknown as Observable<Array<ExtensionType>>;
	}

	// TODO: get rid of the name get
	getByAlias<T extends ManifestBase = ManifestBase>(alias: string) {
		return this.extensions.pipe(
			map((exts) => exts.find((ext) => ext.alias === alias)),
			distinctUntilChanged(extensionSingleMemoization),
			switchMap((ext) => {
				if (ext?.kind) {
					return this.#kindsOfType(ext.type).pipe(
						map((kinds) => {
							// Specific Extension Meta merge (does not merge conditions)
							if (ext) {
								// Since we dont have the type up front in this request, we will just get all kinds here and find the matching one:
								const baseManifest = kinds.find((kind) => kind.matchKind === ext.kind)?.manifest;
								// TODO: This check can go away when making a find kind based on type and kind.
								if (baseManifest) {
									const merged = { __isMatchedWithKind: true, ...baseManifest, ...ext } as any;
									if ((baseManifest as any).meta) {
										merged.meta = { ...(baseManifest as any).meta, ...(ext as any).meta };
									}
									return merged;
								}
							}
							return ext;
						}),
					);
				}
				return of(ext);
			}),

			distinctUntilChanged(extensionAndKindMatchSingleMemoization),
		) as Observable<T | undefined>;
	}

	// TODO: get rid of the name get
	byTypeAndAlias<
		Key extends keyof ManifestTypeMap<ManifestTypes> | string,
		T extends ManifestBase = SpecificManifestTypeOrManifestBase<ManifestTypes, Key>,
	>(type: Key, alias: string) {
		return combineLatest([
			this.extensions.pipe(
				map((exts) => exts.find((ext) => ext.type === type && ext.alias === alias)),
				distinctUntilChanged(extensionSingleMemoization),
			),
			this.#kindsOfType(type),
		]).pipe(
			map(([ext, kinds]) => {
				// TODO: share one merge function between the different methods of this class:
				// Specific Extension Meta merge (does not merge conditions)
				if (ext) {
					const baseManifest = kinds.find((kind) => kind.matchKind === ext.kind)?.manifest;
					if (baseManifest) {
						const merged = { __isMatchedWithKind: true, ...baseManifest, ...ext } as any;
						if ((baseManifest as any).meta) {
							merged.meta = { ...(baseManifest as any).meta, ...(ext as any).meta };
						}
						return merged;
					}
				}
				return ext;
			}),
			distinctUntilChanged(extensionAndKindMatchSingleMemoization),
		) as Observable<T | undefined>;
	}
	/**
	 * @deprecated Use `byTypeAndAlias` instead.
	 */
	getByTypeAndAlias = this.byTypeAndAlias.bind(this);

	byTypeAndAliases<
		Key extends keyof ManifestTypeMap<ManifestTypes> | string,
		T extends ManifestBase = SpecificManifestTypeOrManifestBase<ManifestTypes, Key>,
	>(type: Key, aliases: Array<string>) {
		return combineLatest([
			this.extensions.pipe(
				map((exts) => exts.filter((ext) => ext.type === type && aliases.indexOf(ext.alias) !== -1)),
				distinctUntilChanged(extensionArrayMemoization),
			),
			this.#kindsOfType(type),
		]).pipe(
			map(([exts, kinds]) =>
				exts
					.map((ext) => {
						// Specific Extension Meta merge (does not merge conditions)
						const baseManifest = kinds.find((kind) => kind.matchKind === ext.kind)?.manifest;
						if (baseManifest) {
							const merged = { __isMatchedWithKind: true, ...baseManifest, ...ext } as any;
							if ((baseManifest as any).meta) {
								merged.meta = { ...(baseManifest as any).meta, ...(ext as any).meta };
							}
							return merged;
						}
						return ext;
					})
					.sort(sortExtensions),
			),
			distinctUntilChanged(extensionAndKindMatchArrayMemoization),
		) as Observable<Array<T>>;
	}
	/**
	 * @deprecated Use `byTypeAndAliases` instead.
	 */
	getByTypeAndAliases = this.byTypeAndAliases.bind(this);

	/**
	 * Get an observable of an extension by type and a given filter method.
	 * This will return the all extensions that matches the type and which filter method returns true.
	 * The filter method will be called for each extension manifest of the given type, and the first argument to it is the extension manifest.
	 * @param type {string} - The type of the extension to get
	 * @param filter {(ext: T): void} - The filter method to use to filter the extensions
	 * @returns {Observable<T | undefined>} - An observable of the extensions that matches the type and filter method
	 */
	byTypeAndFilter<
		Key extends keyof ManifestTypeMap<ManifestTypes> | string,
		T extends ManifestBase = SpecificManifestTypeOrManifestBase<ManifestTypes, Key>,
	>(type: Key, filter: (ext: T) => boolean) {
		return combineLatest([
			this.extensions.pipe(
				map((exts) => exts.find((ext) => ext.type === type && filter(ext as unknown as T))),
				distinctUntilChanged(extensionSingleMemoization),
			),
			this.#kindsOfType(type),
		]).pipe(
			map(([ext, kinds]) => {
				// TODO: share one merge function between the different methods of this class:
				// Specific Extension Meta merge (does not merge conditions)
				if (ext) {
					const baseManifest = kinds.find((kind) => kind.matchKind === ext.kind)?.manifest;
					if (baseManifest) {
						const merged = { __isMatchedWithKind: true, ...baseManifest, ...ext } as any;
						if ((baseManifest as any).meta) {
							merged.meta = { ...(baseManifest as any).meta, ...(ext as any).meta };
						}
						return merged;
					}
				}
				return ext;
			}),
			distinctUntilChanged(extensionAndKindMatchSingleMemoization),
		) as Observable<T | undefined>;
	}

	/**
	 * Get an observable that provides extensions matching the given type.
	 * @param type {string} - The type of the extensions to get.
	 * @returns {Observable<T | undefined>} - An observable of the extensions that matches the type.
	 */
	byType<
		Key extends keyof ManifestTypeMap<ManifestTypes> | string,
		T extends ManifestBase = SpecificManifestTypeOrManifestBase<ManifestTypes, Key>,
	>(type: Key) {
		return combineLatest([this.#extensionsOfType(type), this.#kindsOfType(type)]).pipe(
			map(([exts, kinds]) =>
				exts
					.map((ext) => {
						// Specific Extension Meta merge (does not merge conditions)
						const baseManifest = kinds.find((kind) => kind.matchKind === ext.kind)?.manifest;
						if (baseManifest) {
							const merged = { __isMatchedWithKind: true, ...baseManifest, ...ext } as any;
							if ((baseManifest as any).meta) {
								merged.meta = { ...(baseManifest as any).meta, ...(ext as any).meta };
							}
							return merged;
						}
						return ext;
					})
					.sort(sortExtensions),
			),
			distinctUntilChanged(extensionAndKindMatchArrayMemoization),
		) as Observable<Array<T>>;
	}
	/**
	 * @deprecated Use `byType` instead.
	 */
	extensionsOfType = this.byType.bind(this);

	/**
	 * Get an observable that provides extensions matching given types.
	 * @param type {Array<string>} - The types of the extensions to get.
	 * @returns {Observable<T | undefined>} - An observable of the extensions that matches the types.
	 */
	byTypes<ExtensionTypes extends ManifestBase = ManifestBase>(types: string[]): Observable<Array<ExtensionTypes>> {
		return combineLatest([this.#extensionsOfTypes(types), this.#kindsOfTypes(types)]).pipe(
			map(([exts, kinds]) =>
				exts
					.map((ext) => {
						// Specific Extension Meta merge (does not merge conditions)
						if (ext) {
							const baseManifest = kinds.find((kind) => kind.matchKind === ext.kind)?.manifest;
							if (baseManifest) {
								const merged = { __isMatchedWithKind: true, ...baseManifest, ...ext } as any;
								if ((baseManifest as any).meta) {
									merged.meta = { ...(baseManifest as any).meta, ...(ext as any).meta };
								}
								return merged;
							}
						}
						return ext;
					})
					.sort(sortExtensions),
			),
			distinctUntilChanged(extensionAndKindMatchArrayMemoization),
		) as Observable<Array<ExtensionTypes>>;
	}

	/**
	 * @deprecated Use `byTypes` instead.
	 */
	extensionsOfTypes = this.byTypes.bind(this);
}
