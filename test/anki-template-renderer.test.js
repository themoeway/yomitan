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

import {describe} from 'vitest';
import {createAnkiTemplateRendererTest} from './fixtures/anki-template-renderer-test.js';

const test = await createAnkiTemplateRendererTest();

describe('AnkiTemplateRenderer', () => {
    /** @type {import('template-renderer').CompositeRenderData} */
    const data = {
        marker: 'test',
        commonData: {
            dictionaryEntry: {
                type: 'kanji',
                character: 'c',
                dictionary: 'dictionary',
                onyomi: [],
                kunyomi: [],
                tags: [],
                stats: {},
                definitions: [],
                frequencies: []
            },
            resultOutputMode: 'split',
            mode: 'test',
            glossaryLayoutMode: 'default',
            compactTags: false,
            context: {
                url: 'http://localhost/',
                documentTitle: 'documentTitle',
                query: 'query',
                fullQuery: 'query.full',
                sentence: {
                    text: 'sentence.query.full',
                    offset: 9
                }
            },
            media: void 0
        }
    };
    const testCases = [
        {
            name: 'regexMatch 1',
            template: '{{#regexMatch "test" "gu"}}this is a test of regexMatch{{/regexMatch}}',
            result: 'test'
        },
        {
            name: 'regexMatch 2',
            template: '{{regexMatch "test" "gu" "this is a test of regexMatch"}}',
            result: 'test'
        },
        {
            name: 'regexMatch 3',
            template: '{{#if (regexMatch "test" "gu" "this is a test of regexMatch")}}true{{else}}false{{/if}}',
            result: 'true'
        },
        {
            name: 'regexReplace 1',
            template: '{{#regexReplace "test" "TEST" "gu"}}this is a test of regexReplace{{/regexReplace}}',
            result: 'this is a TEST of regexReplace'
        },
        {
            name: 'regexReplace 2',
            template: '{{regexReplace "test" "TEST" "gu" "this is a test of regexReplace"}}',
            result: 'this is a TEST of regexReplace'
        },
        {
            name: 'regexReplace 3',
            template: '{{#if (regexReplace "test" "" "gu" "test")}}true{{else}}false{{/if}}',
            result: 'false'
        }
    ];
    describe.each(testCases)('$name', ({template, result: expectedResult}) => {
        test('Test', ({expect, ankiTemplateRenderer}) => {
            const {result} = ankiTemplateRenderer.templateRenderer.render(template, data, 'ankiNote');
            expect(result).toEqual(expectedResult);
        });
    });
});
