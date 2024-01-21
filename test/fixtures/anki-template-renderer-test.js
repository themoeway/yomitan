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

import {vi} from 'vitest';
import {AnkiTemplateRenderer} from '../../ext/js/templates/sandbox/anki-template-renderer.js';
import {fetch} from '../mocks/common.js';
import {createDomTest} from './dom-test.js';

vi.stubGlobal('fetch', fetch);

/**
 * @returns {Promise<import('vitest').TestAPI<{window: import('jsdom').DOMWindow, ankiTemplateRenderer: AnkiTemplateRenderer}>>}
 */
export async function createAnkiTemplateRendererTest() {
    const test = createDomTest(void 0);
    const ankiTemplateRenderer = new AnkiTemplateRenderer();
    await ankiTemplateRenderer.prepare();
    /** @type {import('vitest').TestAPI<{window: import('jsdom').DOMWindow, ankiTemplateRenderer: AnkiTemplateRenderer}>} */
    const result = test.extend({
        window: async ({window}, use) => { await use(window); },
        // eslint-disable-next-line no-empty-pattern
        ankiTemplateRenderer: async ({window}, use) => {
            // The window property needs to be referenced for it to be initialized.
            // It is needed for DOM access for structured content.
            void window;
            await use(ankiTemplateRenderer);
        }
    });
    return result;
}
