import { css, html } from 'lit';
import { UUITextStyles } from '@umbraco-ui/uui-css/lib';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { UmbWorkspacePropertyStructureHelper } from '../../../../../shared/components/workspace/workspace-context/workspace-property-structure-helper.class';
import { PropertyContainerTypes } from '../../../../../shared/components/workspace/workspace-context/workspace-structure-manager.class';
import { UmbLitElement } from '@umbraco-cms/internal/lit-element';
import { DocumentTypePropertyTypeResponseModel } from '@umbraco-cms/backoffice/backend-api';
import { UMB_MODAL_CONTEXT_TOKEN, UMB_PROPERTY_SETTINGS_MODAL } from '@umbraco-cms/backoffice/modal';
import './document-type-workspace-view-edit-property.element';

@customElement('umb-document-type-workspace-view-edit-properties')
export class UmbDocumentTypeWorkspaceViewEditPropertiesElement extends UmbLitElement {
	private _containerKey: string | undefined;

	public get containerKey(): string | undefined {
		return this._containerKey;
	}
	public set containerKey(value: string | undefined) {
		if (value === this._containerKey) return;
		const oldValue = this._containerKey;
		this._containerKey = value;
		this.requestUpdate('containerKey', oldValue);
	}

	@property({ type: String, attribute: 'container-name', reflect: false })
	public get containerName(): string | undefined {
		return this._propertyStructureHelper.getContainerName();
	}
	public set containerName(value: string | undefined) {
		this._propertyStructureHelper.setContainerName(value);
	}

	@property({ type: String, attribute: 'container-type', reflect: false })
	public get containerType(): PropertyContainerTypes | undefined {
		return this._propertyStructureHelper.getContainerType();
	}
	public set containerType(value: PropertyContainerTypes | undefined) {
		this._propertyStructureHelper.setContainerType(value);
	}

	_propertyStructureHelper = new UmbWorkspacePropertyStructureHelper(this);

	@state()
	_propertyStructure: Array<DocumentTypePropertyTypeResponseModel> = [];

	#modalContext?: typeof UMB_MODAL_CONTEXT_TOKEN.TYPE;

	constructor() {
		super();

		this.consumeContext(UMB_MODAL_CONTEXT_TOKEN, (instance) => (this.#modalContext = instance));
		this.observe(this._propertyStructureHelper.propertyStructure, (propertyStructure) => {
			this._propertyStructure = propertyStructure;
		});
	}

	async #onAddProperty() {
		const property = await this._propertyStructureHelper.addProperty(this._containerKey);
		if (!property) return;

		// Take key and parse to modal:
		console.log('property key:', property.id!);

		const modalHandler = this.#modalContext?.open(UMB_PROPERTY_SETTINGS_MODAL);

		modalHandler?.onSubmit().then((result) => {
			console.log(result);
		});
	}

	render() {
		return html`${repeat(
				this._propertyStructure,
				(property) => property.alias,
				(property) =>
					html`<document-type-workspace-view-edit-property
						.property=${property}
						@partial-property-update=${(event: CustomEvent) => {
							this._propertyStructureHelper.partialUpdateProperty(property.key, event.detail);
						}}></document-type-workspace-view-edit-property>`
			)}<uui-button id="add" look="placeholder" @click=${this.#onAddProperty}> Add property </uui-button>`;
	}

	static styles = [
		UUITextStyles,
		css`
			.property:first-of-type {
				padding-top: 0;
			}
			.property {
				border-bottom: 1px solid var(--uui-color-divider);
			}
			.property:last-child {
				border-bottom: 0;
			}

			.property {
				display: grid;
				grid-template-columns: 200px auto;
				column-gap: var(--uui-size-layout-2);
				border-bottom: 1px solid var(--uui-color-divider);
				padding: var(--uui-size-layout-1) 0;
				container-type: inline-size;
			}

			.property > div {
				grid-column: span 2;
			}

			@container (width > 600px) {
				.property:not([orientation='vertical']) > div {
					grid-column: span 1;
				}
			}

			#add {
				width: 100%;
			}
		`,
	];
}

export default UmbDocumentTypeWorkspaceViewEditPropertiesElement;

declare global {
	interface HTMLElementTagNameMap {
		'umb-document-type-workspace-view-edit-properties': UmbDocumentTypeWorkspaceViewEditPropertiesElement;
	}
}
