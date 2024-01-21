/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2020-2022  Yomichan Authors
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

import fs from 'fs';
import {test} from 'vitest';
import {builtinEnvironments} from 'vitest/environments';

/**
 * @param {import('jsdom').DOMWindow} window
 */
function prepareWindow(window) {
    const {document} = window;

    // Define innerText setter as an alias for textContent setter
    Object.defineProperty(window.HTMLDivElement.prototype, 'innerText', {
        set(value) { this.textContent = value; }
    });

    // Placeholder for feature detection
    document.caretRangeFromPoint = () => null;
}

/**
 *
 * @param {string} [htmlFilePath]
 * @returns {Promise<{window: import('jsdom').DOMWindow; teardown: (global: unknown) => import('vitest').Awaitable<void>}>}
 */
export async function setupDomTest(htmlFilePath) {
    const html = typeof htmlFilePath === 'string' ? fs.readFileSync(htmlFilePath, {encoding: 'utf8'}) : '<!DOCTYPE html>';
    const env = builtinEnvironments.jsdom;
    const {teardown} = await env.setup(global, {jsdom: {html}});
    const window = /** @type {import('jsdom').DOMWindow} */ (/** @type {unknown} */ (global.window));
    prepareWindow(window);
    return {window, teardown};
}

/**
 * @param {string} [htmlFilePath]
 * @returns {import('vitest').TestAPI<{window: import('jsdom').DOMWindow}>}
 */
export function createDomTest(htmlFilePath) {
    const html = typeof htmlFilePath === 'string' ? fs.readFileSync(htmlFilePath, {encoding: 'utf8'}) : '<!DOCTYPE html>';
    return test.extend({
        // eslint-disable-next-line no-empty-pattern
        window: async ({}, use) => {
            const env = builtinEnvironments.jsdom;
            const {teardown} = await env.setup(global, {jsdom: {html}});
            const window = /** @type {import('jsdom').DOMWindow} */ (/** @type {unknown} */ (global.window));
            prepareWindow(window);
            try {
                await use(window);
            } finally {
                teardown(global);
            }
        }
    });
}
