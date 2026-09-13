/*
 * Copyright (C) 2026  Yomitan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import path from 'path';
import {pathToFileURL} from 'url';
import {createDictionaryArchiveData} from '../../dev/dictionary-archive-util.js';
import {expect, root, test} from './playwright-util.js';

test.beforeEach(async ({context}) => {
    const welcome = await context.waitForEvent('page');
    await welcome.close();
});

/**
 * @param {import('playwright').Page} page
 * @param {string} extensionId
 * @param {string} text
 */
async function search(page, extensionId, text) {
    await page.goto(`chrome-extension://${extensionId}/search.html`);
    await expect(async () => {
        await page.locator('#search-textbox').fill(text);
        await expect(page.locator('#search-textbox')).toHaveValue(text);
    }).toPass();
    await page.locator('#search-textbox').press('Enter');
}

test('grammar wildcards are optional and apply to all enabled dictionaries', async ({page, extensionId}) => {
    const id = String(extensionId);
    const settingsUrl = `chrome-extension://${extensionId}/settings.html`;
    await page.goto(settingsUrl);
    await expect(page.locator('html')).toHaveAttribute('data-loaded', 'true');
    await expect(page.locator('#dictionaries')).toBeVisible();
    await page.locator('#advanced-checkbox').evaluate((/** @type {HTMLInputElement} */ element) => element.click());
    const toggle = page.locator('[data-setting="translation.enableGrammarWildcards"]');
    await expect(toggle).not.toBeChecked();

    for (const [index, name] of ['Grammar One', 'Grammar Two'].entries()) {
        const dictionary = await createDictionaryArchiveData(path.join(root, 'test/data/dictionaries/grammar-wildcards'), name);
        await page.locator('#dictionary-import-file-input').setInputFiles({
            name: `${name}.zip`, mimeType: 'application/x-zip', buffer: Buffer.from(dictionary),
        });
        await expect(page.locator('#dictionaries')).toHaveText(`Dictionaries (${index + 1} installed, ${index + 1} enabled)`);
    }

    await search(page, id, 'いくら騒いでも');
    await expect(page.getByText('Ordinary term', {exact: true})).toHaveCount(2);
    await expect(page.getByText('Grammar pattern', {exact: true})).toHaveCount(0);
    await search(page, id, 'いくら～でも');
    await expect(page.getByText('Grammar pattern', {exact: true})).toHaveCount(2);

    await page.goto(settingsUrl);
    await expect(page.locator('html')).toHaveAttribute('data-loaded', 'true');
    await toggle.evaluate((/** @type {HTMLInputElement} */ element) => element.click());
    await expect(toggle).toBeChecked();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-loaded', 'true');
    await expect(toggle).toBeChecked();
    await search(page, id, 'いくら騒いでも');
    await expect(page.getByText('Grammar pattern', {exact: true})).toHaveCount(2);
    await expect(page.getByText('Reading pattern', {exact: true})).toHaveCount(2);
    await expect(page.getByText('Ordinary term', {exact: true})).toHaveCount(2);
    await search(page, id, 'どんなに走っても間に合わない');
    await expect(page.getByText('Two gaps', {exact: true})).toHaveCount(2);

    await page.goto(pathToFileURL(path.join(root, 'test/data/html/popup-tests.html')).toString());
    const scanTarget = page.locator('.hovertarget .container-inner > div').first();
    await scanTarget.evaluate((element) => { element.textContent = 'いくら大声で騒いでも後続'; });
    await scanTarget.scrollIntoViewIfNeeded();
    const box = await scanTarget.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) { throw new Error('Scan target has no bounding box'); }
    const popupPromise = page.waitForEvent('frameattached');
    await page.keyboard.down('Shift');
    await page.mouse.move(box.x + 5, box.y + box.height / 2);
    const popup = await popupPromise;
    await expect(popup.getByText('Grammar pattern', {exact: true})).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('いくら大声で騒いでも');
    await page.keyboard.up('Shift');

    await page.goto(settingsUrl);
    await expect(page.locator('html')).toHaveAttribute('data-loaded', 'true');
    await page.locator('.settings-item[data-modal-action="show,dictionaries"]').click();
    await page.locator('.dictionary-enabled').last().evaluate((/** @type {HTMLInputElement} */ element) => element.click());
    await expect(page.locator('#dictionaries')).toHaveText('Dictionaries (2 installed, 1 enabled)');
    await search(page, id, 'いくら騒いでも');
    await expect(page.getByText('Grammar pattern', {exact: true})).toHaveCount(1);

    await page.goto(settingsUrl);
    await expect(page.locator('html')).toHaveAttribute('data-loaded', 'true');
    await toggle.evaluate((/** @type {HTMLInputElement} */ element) => element.click());
    await expect(toggle).not.toBeChecked();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-loaded', 'true');
    await expect(toggle).not.toBeChecked();
    await search(page, id, 'いくら騒いでも');
    await expect(page.getByText('Ordinary term', {exact: true})).toHaveCount(1);
    await expect(page.getByText('Grammar pattern', {exact: true})).toHaveCount(0);
});
