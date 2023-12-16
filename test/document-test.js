/*
 * Copyright (C) 2023  Yomitan Authors
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
import {JSDOM} from 'jsdom';
import {test} from 'vitest';
import {populateGlobal} from 'vitest/environments';

/**
 * @param {string} fileName
 * @returns {import('jsdom').JSDOM}
 */
function createJSDOM(fileName) {
    const domSource = fs.readFileSync(fileName, {encoding: 'utf8'});
    const dom = new JSDOM(domSource);
    const document = dom.window.document;
    const window = dom.window;

    // Define innerText setter as an alias for textContent setter
    Object.defineProperty(window.HTMLDivElement.prototype, 'innerText', {
        set(value) { this.textContent = value; }
    });

    // Placeholder for feature detection
    document.caretRangeFromPoint = () => null;

    return dom;
}

/**
 * @param {string} htmlFilePath
 * @returns {import('vitest').TestAPI<{dom: import('jsdom').JSDOM}>}
 */
export function domTest(htmlFilePath) {
    return test.extend({
        // eslint-disable-next-line no-empty-pattern
        dom: async ({}, use) => {
            const g = /** @type {{[key: (string|symbol)]: unknown}} */ (global);
            const dom = createJSDOM(htmlFilePath);
            const {window} = dom;
            const {keys, originals} = populateGlobal(g, window, {bindFunctions: true});
            try {
                await use(dom);
            } finally {
                window.close();
                for (const key of keys) { delete g[key]; }
                for (const [key, value] of originals) { g[key] = value; }
            }
        }
    });
}
