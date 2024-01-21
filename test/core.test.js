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

import {describe, expect, test} from 'vitest';
import {DynamicProperty} from '../ext/js/core/dynamic-property.js';
import {deepEqual} from '../ext/js/core/utilities.js';

/** */
function testDynamicProperty() {
    describe('DynamicProperty', () => {
        /** @type {import('test/core').DynamicPropertyTestData} */
        const data = [
            {
                initialValue: 0,
                operations: [
                    {
                        operation: null,
                        args: [0],
                        expectedDefaultValue: 0,
                        expectedValue: 0,
                        expectedOverrideCount: 0,
                        expectedEventOccurred: false
                    },
                    {
                        operation: 'set.defaultValue',
                        args: [1],
                        expectedDefaultValue: 1,
                        expectedValue: 1,
                        expectedOverrideCount: 0,
                        expectedEventOccurred: true
                    },
                    {
                        operation: 'set.defaultValue',
                        args: [1],
                        expectedDefaultValue: 1,
                        expectedValue: 1,
                        expectedOverrideCount: 0,
                        expectedEventOccurred: false
                    },
                    {
                        operation: 'set.defaultValue',
                        args: [0],
                        expectedDefaultValue: 0,
                        expectedValue: 0,
                        expectedOverrideCount: 0,
                        expectedEventOccurred: true
                    },
                    {
                        operation: 'setOverride',
                        args: [8],
                        expectedDefaultValue: 0,
                        expectedValue: 8,
                        expectedOverrideCount: 1,
                        expectedEventOccurred: true
                    },
                    {
                        operation: 'setOverride',
                        args: [16],
                        expectedDefaultValue: 0,
                        expectedValue: 8,
                        expectedOverrideCount: 2,
                        expectedEventOccurred: false
                    },
                    {
                        operation: 'setOverride',
                        args: [32, 1],
                        expectedDefaultValue: 0,
                        expectedValue: 32,
                        expectedOverrideCount: 3,
                        expectedEventOccurred: true
                    },
                    {
                        operation: 'setOverride',
                        args: [64, -1],
                        expectedDefaultValue: 0,
                        expectedValue: 32,
                        expectedOverrideCount: 4,
                        expectedEventOccurred: false
                    },
                    {
                        operation: 'clearOverride',
                        args: [-4],
                        expectedDefaultValue: 0,
                        expectedValue: 32,
                        expectedOverrideCount: 3,
                        expectedEventOccurred: false
                    },
                    {
                        operation: 'clearOverride',
                        args: [-3],
                        expectedDefaultValue: 0,
                        expectedValue: 32,
                        expectedOverrideCount: 2,
                        expectedEventOccurred: false
                    },
                    {
                        operation: 'clearOverride',
                        args: [-2],
                        expectedDefaultValue: 0,
                        expectedValue: 64,
                        expectedOverrideCount: 1,
                        expectedEventOccurred: true
                    },
                    {
                        operation: 'clearOverride',
                        args: [-1],
                        expectedDefaultValue: 0,
                        expectedValue: 0,
                        expectedOverrideCount: 0,
                        expectedEventOccurred: true
                    }
                ]
            }
        ];

        describe.each(data)('Test DynamicProperty($initialValue)', ({initialValue, operations}) => {
            test('works as expected', () => {
                const property = new DynamicProperty(initialValue);
                const overrideTokens = [];
                let eventOccurred = false;
                const onChange = () => { eventOccurred = true; };
                property.on('change', onChange);
                for (const {operation, args, expectedDefaultValue, expectedValue, expectedOverrideCount, expectedEventOccurred} of operations) {
                    eventOccurred = false;
                    switch (operation) {
                        case 'set.defaultValue': property.defaultValue = args[0]; break;
                        case 'setOverride': overrideTokens.push(property.setOverride(...args)); break;
                        case 'clearOverride': property.clearOverride(overrideTokens[overrideTokens.length + args[0]]); break;
                    }
                    expect(eventOccurred).toStrictEqual(expectedEventOccurred);
                    expect(property.defaultValue).toStrictEqual(expectedDefaultValue);
                    expect(property.value).toStrictEqual(expectedValue);
                    expect(property.overrideCount).toStrictEqual(expectedOverrideCount);
                }
                property.off('change', onChange);
            });
        });
    });
}

/** */
function testDeepEqual() {
    describe('deepEqual', () => {
        /** @type {import('test/core').DeepEqualTestData} */
        const simpleTestsData = [
            {
                value1: 0,
                value2: 0,
                expected: true
            },
            {
                value1: null,
                value2: null,
                expected: true
            },
            {
                value1: 'test',
                value2: 'test',
                expected: true
            },
            {
                value1: true,
                value2: true,
                expected: true
            },
            {
                value1: 0,
                value2: 1,
                expected: false
            },
            {
                value1: null,
                value2: false,
                expected: false
            },
            {
                value1: 'test1',
                value2: 'test2',
                expected: false
            },
            {
                value1: true,
                value2: false,
                expected: false
            }
        ];
        /** @type {import('test/core').DeepEqualTestData} */
        const simpleObjectTestsData = [
            {
                value1: {},
                value2: {},
                expected: true
            },
            {
                value1: {},
                value2: [],
                expected: false
            },
            {
                value1: [],
                value2: [],
                expected: true
            },
            {
                value1: {},
                value2: null,
                expected: false
            }
        ];
        /** @type {import('test/core').DeepEqualTestData} */
        const complexObjectTestsData = [
            {
                value1: [1],
                value2: [],
                expected: false
            },
            {
                value1: [1],
                value2: [1],
                expected: true
            },
            {
                value1: [1],
                value2: [2],
                expected: false
            },

            {
                value1: {},
                value2: {test: 1},
                expected: false
            },
            {
                value1: {test: 1},
                value2: {test: 1},
                expected: true
            },
            {
                value1: {test: 1},
                value2: {test: {test2: false}},
                expected: false
            },
            {
                value1: {test: {test2: true}},
                value2: {test: {test2: false}},
                expected: false
            },
            {
                value1: {test: {test2: [true]}},
                value2: {test: {test2: [true]}},
                expected: true
            }
        ];
        /** @type {import('test/core').DeepEqualTestData} */
        const recursiveTestsData = [
            {
                value1: (() => { const x = {}; x.x = x; return x; })(),
                value2: (() => { const x = {}; x.x = x; return x; })(),
                expected: false
            }
        ];
        describe('simple tests', () => {
            test.each(simpleTestsData)('deepEqual($value1, $value2) -> $expected', ({value1, value2, expected}) => {
                const actual1 = deepEqual(value1, value2);
                expect(actual1).toStrictEqual(expected);

                const actual2 = deepEqual(value2, value1);
                expect(actual2).toStrictEqual(expected);
            });
        });

        describe('simple object tests', () => {
            test.each(simpleObjectTestsData)('deepEqual($value1, $value2) -> $expected', ({value1, value2, expected}) => {
                const actual1 = deepEqual(value1, value2);
                expect(actual1).toStrictEqual(expected);

                const actual2 = deepEqual(value2, value1);
                expect(actual2).toStrictEqual(expected);
            });
        });

        describe('complex object tests', () => {
            test.each(complexObjectTestsData)('deepEqual($value1, $value2) -> $expected', ({value1, value2, expected}) => {
                const actual1 = deepEqual(value1, value2);
                expect(actual1).toStrictEqual(expected);

                const actual2 = deepEqual(value2, value1);
                expect(actual2).toStrictEqual(expected);
            });
        });

        describe('recursive tests', () => {
            test.each(recursiveTestsData)('deepEqual($value1, $value2) -> $expected', ({value1, value2, expected}) => {
                const actual1 = deepEqual(value1, value2);
                expect(actual1).toStrictEqual(expected);

                const actual2 = deepEqual(value2, value1);
                expect(actual2).toStrictEqual(expected);
            });
        });
    });
}


/** */
function main() {
    testDynamicProperty();
    testDeepEqual();
}

main();
