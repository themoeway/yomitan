/*
 * Copyright (C) 2023-2024  Yomitan Authors
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
import {createDictionaryArchive} from '../../dev/util';
import {
    expect,
    expectedAddNoteBody,
    mockAnkiRouteHandler,
    mockModelFieldNames,
    mockModelFieldsToAnkiValues,
    root,
    test,
    writeToClipboardFromPage
} from './playwright-util';

test.beforeEach(async ({context}) => {
    // Wait for the on-install welcome.html tab to load, which becomes the foreground tab
    const welcome = await context.waitForEvent('page');
    await welcome.close(); // close the welcome tab so our main tab becomes the foreground tab -- otherwise, the screenshot can hang
});

test('search clipboard', async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/search.html`);
    await page.locator('#search-option-clipboard-monitor-container > label').click();
    await page.waitForTimeout(200); // race

    await writeToClipboardFromPage(page, 'あ');
    await expect(page.locator('#search-textbox')).toHaveValue('あ');
});

test('anki add', async ({context, page, extensionId}) => {
    // Mock anki routes
    /** @type {?(value: unknown) => void} */
    let resolve = null;
    const addNotePromise = new Promise((res) => {
        resolve = res;
    });
    await context.route(/127.0.0.1:8765\/*/, (route) => {
        mockAnkiRouteHandler(route);
        const req = route.request();
        if (req.url().includes('127.0.0.1:8765') && req.postDataJSON().action === 'addNote') {
            /** @type {(value: unknown) => void} */ (resolve)(req.postDataJSON());
        }
    });

    // Open settings
    await page.goto(`chrome-extension://${extensionId}/settings.html`);

    // Load in test dictionary
    const dictionary = createDictionaryArchive(path.join(root, 'test/data/dictionaries/valid-dictionary1'), 'valid-dictionary1');
    const testDictionarySource = await dictionary.generateAsync({type: 'arraybuffer'});
    await page.locator('input[id="dictionary-import-file-input"]').setInputFiles({
        name: 'valid-dictionary1.zip',
        mimeType: 'application/x-zip',
        buffer: Buffer.from(testDictionarySource)
    });
    await expect(page.locator('id=dictionaries')).toHaveText('Dictionaries (1 installed, 1 enabled)', {timeout: 5 * 60 * 1000});

    // Connect to anki
    await page.locator('.toggle', {has: page.locator('[data-setting="anki.enable"]')}).click();
    await expect(page.locator('#anki-error-message')).toHaveText('Connected');

    // Prep anki deck
    await page.locator('[data-modal-action="show,anki-cards"]').click();
    await page.locator('select.anki-card-deck').selectOption('Mock Deck');
    await page.locator('select.anki-card-model').selectOption('Mock Model');
    for (const modelField of mockModelFieldNames) {
        await page.locator(`[data-setting="anki.terms.fields.${modelField}"]`).fill(/** @type {string} */ (mockModelFieldsToAnkiValues[modelField]));
    }
    await page.locator('#anki-cards-modal > div > div.modal-footer > button:nth-child(2)').click();
    await writeToClipboardFromPage(page, '読むの例文');

    // Add to anki deck
    await page.goto(`chrome-extension://${extensionId}/search.html`);
    await expect(async () => {
        await page.locator('#search-textbox').clear();
        await page.locator('#search-textbox').fill('読む');
        await expect(page.locator('#search-textbox')).toHaveValue('読む');
    }).toPass({timeout: 5000});
    await page.locator('#search-textbox').press('Enter');
    await page.locator('[data-mode="term-kanji"]').click();
    const addNoteReqBody = await addNotePromise;
    expect(addNoteReqBody).toMatchObject(expectedAddNoteBody);
});
