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

    for (const text of ['費用が高い。準備にも時間がかかる。', '費用が高い\n準備にも時間がかかる。']) {
        await search(page, id, text);
        // A positive result confirms that the new search has finished.
        await expect(page.getByText('Cost noun', {exact: true})).toHaveCount(2);
        await expect(page.getByText('Cost grammar pattern', {exact: true})).toHaveCount(0);
    }
    await search(page, id, '費用が思ったよりかかる。');
    await expect(page.getByText('Cost grammar pattern', {exact: true})).toHaveCount(2);
    await search(page, id, '決して「無理だ。諦めろ」とは言わない。');
    await expect(page.getByText('Quoted grammar pattern', {exact: true})).toHaveCount(2);

    // Long grammar clauses exceed the default 16-character scan length.
    await page.goto(settingsUrl);
    await expect(page.locator('html')).toHaveAttribute('data-loaded', 'true');
    await page.locator('[data-setting="scanning.length"]').fill('96');
    await page.locator('[data-setting="scanning.length"]').press('Tab');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-loaded', 'true');
    await expect(page.locator('[data-setting="scanning.length"]')).toHaveValue('96');

    for (const [matchedText, continuation, definition] of [
        ['いくら大声で騒いでも', '、内容をすぐには覚えられない。', 'Grammar pattern'],
        ['いくら毎晩仕事が終わってから図書館で難しい専門書を何時間も読んでも', '、内容をすぐには覚えられない。', 'Grammar pattern'],
        ['いくら仕事から帰って夕食の片付けを済ませた後で机に向かい分からない言葉を一つずつ辞書で調べながら先生に勧められた分厚い参考書を最初のページから最後のページまで繰り返し読んでも', '、翌朝になると大事な内容を忘れてしまう。', 'Grammar pattern'],
        ['決して「無理だ。諦めろ」とは言わない', '。', 'Quoted grammar pattern'],
        ['費用', 'が高い。準備にも時間がかかる。', 'Cost noun'],
        ['費用', 'が高い\n準備にも時間がかかる。', 'Cost noun'],
    ]) {
        await page.goto(pathToFileURL(path.join(root, 'test/data/html/popup-tests.html')).toString());
        const scanTarget = page.locator('.hovertarget .container-inner > div').first();
        await scanTarget.evaluate((element, text) => {
            element.textContent = text;
            if (text.includes('\n')) { element.style.whiteSpace = 'pre-wrap'; }
        }, matchedText + continuation);
        await scanTarget.scrollIntoViewIfNeeded();
        const box = await scanTarget.boundingBox();
        expect(box).not.toBeNull();
        if (box === null) { throw new Error('Scan target has no bounding box'); }
        const popupPromise = page.waitForEvent('frameattached', {timeout: 10000});
        await page.mouse.move(0, 0);
        await page.keyboard.down('Shift');
        await page.mouse.move(box.x + 5, box.y + 8);
        const popup = await popupPromise;
        await expect(popup.getByText(definition, {exact: true})).toHaveCount(2);
        if (definition === 'Cost noun') {
            await expect(popup.getByText('Cost grammar pattern', {exact: true})).toHaveCount(0);
        }
        await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(matchedText);
        await page.keyboard.up('Shift');
    }

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
