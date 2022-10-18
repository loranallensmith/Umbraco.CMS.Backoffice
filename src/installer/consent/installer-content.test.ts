import { expect, fixture, html } from '@open-wc/testing';

import { defaultA11yConfig } from '../../core/test-utils/chai';
import { UmbInstallerConsentElement } from './installer-consent.element';

// TODO: Write tests
describe('UmbInstallerConsentElement', () => {
	let element: UmbInstallerConsentElement;

	beforeEach(async () => {
		element = await fixture(html`<umb-installer-consent></umb-installer-consent>`);
	});

	it('is defined with its own instance', () => {
		expect(element).to.be.instanceOf(UmbInstallerConsentElement);
	});

	it('passes the a11y audit', async () => {
		await expect(element).to.be.accessible(defaultA11yConfig);
	});
});
