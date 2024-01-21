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

import {expect, test} from 'vitest';
import {ObjectPropertyAccessor} from '../ext/js/general/object-property-accessor.js';

/**
 * @returns {import('core').UnknownObject}
 */
function createTestObject() {
    return {
        0: null,
        value1: {
            value2: {},
            value3: [],
            value4: null
        },
        value5: [
            {},
            [],
            null
        ]
    };
}


/** */
function testGet1() {
    test('Get1', () => {
        /** @type {[pathArray: (string|number)[], getExpected: (object: import('core').SafeAny) => unknown][]} */
        const data = [
            [[], (object) => object],
            [['0'], (object) => object['0']],
            [['value1'], (object) => object.value1],
            [['value1', 'value2'], (object) => object.value1.value2],
            [['value1', 'value3'], (object) => object.value1.value3],
            [['value1', 'value4'], (object) => object.value1.value4],
            [['value5'], (object) => object.value5],
            [['value5', 0], (object) => object.value5[0]],
            [['value5', 1], (object) => object.value5[1]],
            [['value5', 2], (object) => object.value5[2]]
        ];

        for (const [pathArray, getExpected] of data) {
            const object = createTestObject();
            const accessor = new ObjectPropertyAccessor(object);
            const expected = getExpected(object);

            expect(accessor.get(pathArray)).toStrictEqual(expected);
        }
    });
}

/** */
function testGet2() {
    test('Get2', () => {
        const object = createTestObject();
        const accessor = new ObjectPropertyAccessor(object);

        /** @type {[pathArray: (string|number)[], message: string][]} */
        const data = [
            [[0], 'Invalid path: [0]'],
            [['0', 'invalid'], 'Invalid path: ["0"].invalid'],
            [['invalid'], 'Invalid path: invalid'],
            [['value1', 'invalid'], 'Invalid path: value1.invalid'],
            [['value1', 'value2', 'invalid'], 'Invalid path: value1.value2.invalid'],
            [['value1', 'value2', 0], 'Invalid path: value1.value2[0]'],
            [['value1', 'value3', 'invalid'], 'Invalid path: value1.value3.invalid'],
            [['value1', 'value3', 0], 'Invalid path: value1.value3[0]'],
            [['value1', 'value4', 'invalid'], 'Invalid path: value1.value4.invalid'],
            [['value1', 'value4', 0], 'Invalid path: value1.value4[0]'],
            [['value5', 'length'], 'Invalid path: value5.length'],
            [['value5', 0, 'invalid'], 'Invalid path: value5[0].invalid'],
            [['value5', 0, 0], 'Invalid path: value5[0][0]'],
            [['value5', 1, 'invalid'], 'Invalid path: value5[1].invalid'],
            [['value5', 1, 0], 'Invalid path: value5[1][0]'],
            [['value5', 2, 'invalid'], 'Invalid path: value5[2].invalid'],
            [['value5', 2, 0], 'Invalid path: value5[2][0]'],
            [['value5', 2, 0, 'invalid'], 'Invalid path: value5[2][0]'],
            [['value5', 2.5], 'Invalid index']
        ];

        for (const [pathArray, message] of data) {
            expect(() => accessor.get(pathArray)).toThrow(message);
        }
    });
}


/** */
function testSet1() {
    test('Set1', () => {
        const testValue = {};
        /** @type {(string|number)[][]} */
        const data = [
            ['0'],
            ['value1', 'value2'],
            ['value1', 'value3'],
            ['value1', 'value4'],
            ['value1'],
            ['value5', 0],
            ['value5', 1],
            ['value5', 2],
            ['value5']
        ];

        for (const pathArray of data) {
            const object = createTestObject();
            const accessor = new ObjectPropertyAccessor(object);

            accessor.set(pathArray, testValue);
            expect(accessor.get(pathArray)).toStrictEqual(testValue);
        }
    });
}

/** */
function testSet2() {
    test('Set2', () => {
        const object = createTestObject();
        const accessor = new ObjectPropertyAccessor(object);

        const testValue = {};
        /** @type {[pathArray: (string|number)[], message: string][]} */
        const data = [
            [[], 'Invalid path'],
            [[0], 'Invalid path: [0]'],
            [['0', 'invalid'], 'Invalid path: ["0"].invalid'],
            [['value1', 'value2', 0], 'Invalid path: value1.value2[0]'],
            [['value1', 'value3', 'invalid'], 'Invalid path: value1.value3.invalid'],
            [['value1', 'value4', 'invalid'], 'Invalid path: value1.value4.invalid'],
            [['value1', 'value4', 0], 'Invalid path: value1.value4[0]'],
            [['value5', 1, 'invalid'], 'Invalid path: value5[1].invalid'],
            [['value5', 2, 'invalid'], 'Invalid path: value5[2].invalid'],
            [['value5', 2, 0], 'Invalid path: value5[2][0]'],
            [['value5', 2, 0, 'invalid'], 'Invalid path: value5[2][0]'],
            [['value5', 2.5], 'Invalid index']
        ];

        for (const [pathArray, message] of data) {
            expect(() => accessor.set(pathArray, testValue)).toThrow(message);
        }
    });
}


/** */
function testDelete1() {
    test('Delete1', () => {
        /**
         * @param {unknown} object
         * @param {string} property
         * @returns {boolean}
         */
        const hasOwn = (object, property) => Object.prototype.hasOwnProperty.call(object, property);

        /** @type {[pathArray: (string|number)[], validate: (object: import('core').SafeAny) => boolean][]} */
        const data = [
            [['0'], (object) => !hasOwn(object, '0')],
            [['value1', 'value2'], (object) => !hasOwn(object.value1, 'value2')],
            [['value1', 'value3'], (object) => !hasOwn(object.value1, 'value3')],
            [['value1', 'value4'], (object) => !hasOwn(object.value1, 'value4')],
            [['value1'], (object) => !hasOwn(object, 'value1')],
            [['value5'], (object) => !hasOwn(object, 'value5')]
        ];

        for (const [pathArray, validate] of data) {
            const object = createTestObject();
            const accessor = new ObjectPropertyAccessor(object);

            accessor.delete(pathArray);
            expect(validate(object)).toBe(true);
        }
    });
}

/** */
function testDelete2() {
    test('Delete2', () => {
        /** @type {[pathArray: (string|number)[], message: string][]} */
        const data = [
            [[], 'Invalid path'],
            [[0], 'Invalid path: [0]'],
            [['0', 'invalid'], 'Invalid path: ["0"].invalid'],
            [['value1', 'value2', 0], 'Invalid path: value1.value2[0]'],
            [['value1', 'value3', 'invalid'], 'Invalid path: value1.value3.invalid'],
            [['value1', 'value4', 'invalid'], 'Invalid path: value1.value4.invalid'],
            [['value1', 'value4', 0], 'Invalid path: value1.value4[0]'],
            [['value5', 1, 'invalid'], 'Invalid path: value5[1].invalid'],
            [['value5', 2, 'invalid'], 'Invalid path: value5[2].invalid'],
            [['value5', 2, 0], 'Invalid path: value5[2][0]'],
            [['value5', 2, 0, 'invalid'], 'Invalid path: value5[2][0]'],
            [['value5', 2.5], 'Invalid index'],
            [['value5', 0], 'Invalid type'],
            [['value5', 1], 'Invalid type'],
            [['value5', 2], 'Invalid type']
        ];

        for (const [pathArray, message] of data) {
            const object = createTestObject();
            const accessor = new ObjectPropertyAccessor(object);

            expect(() => accessor.delete(pathArray)).toThrow(message);
        }
    });
}


/** */
function testSwap1() {
    test('Swap1', () => {
        /** @type {[pathArray: (string|number)[], compareValues: boolean][]} */
        const data = [
            [['0'], true],
            [['value1', 'value2'], true],
            [['value1', 'value3'], true],
            [['value1', 'value4'], true],
            [['value1'], false],
            [['value5', 0], true],
            [['value5', 1], true],
            [['value5', 2], true],
            [['value5'], false]
        ];

        for (const [pathArray1, compareValues1] of data) {
            for (const [pathArray2, compareValues2] of data) {
                const object = createTestObject();
                const accessor = new ObjectPropertyAccessor(object);

                const value1a = accessor.get(pathArray1);
                const value2a = accessor.get(pathArray2);

                accessor.swap(pathArray1, pathArray2);

                if (!compareValues1 || !compareValues2) { continue; }

                const value1b = accessor.get(pathArray1);
                const value2b = accessor.get(pathArray2);

                expect(value1a).toStrictEqual(value2b);
                expect(value2a).toStrictEqual(value1b);
            }
        }
    });
}

/** */
function testSwap2() {
    test('Swap2', () => {
        /** @type {[pathArray1: (string|number)[], pathArray2: (string|number)[], checkRevert: boolean, message: string][]} */
        const data = [
            [[], [], false, 'Invalid path 1'],
            [['0'], [], false, 'Invalid path 2'],
            [[], ['0'], false, 'Invalid path 1'],
            [[0], ['0'], false, 'Invalid path 1: [0]'],
            [['0'], [0], false, 'Invalid path 2: [0]']
        ];

        for (const [pathArray1, pathArray2, checkRevert, message] of data) {
            const object = createTestObject();
            const accessor = new ObjectPropertyAccessor(object);

            let value1a;
            let value2a;
            if (checkRevert) {
                try {
                    value1a = accessor.get(pathArray1);
                    value2a = accessor.get(pathArray2);
                } catch (e) {
                // NOP
                }
            }

            expect(() => accessor.swap(pathArray1, pathArray2)).toThrow(message);

            if (!checkRevert) { continue; }

            const value1b = accessor.get(pathArray1);
            const value2b = accessor.get(pathArray2);

            expect(value1a).toStrictEqual(value1b);
            expect(value2a).toStrictEqual(value2b);
        }
    });
}


/** */
function testGetPathString1() {
    test('GetPathString1', () => {
        /** @type {[pathArray: (string|number)[], expected: string][]} */
        const data = [
            [[], ''],
            [[0], '[0]'],
            [['escape\\'], '["escape\\\\"]'],
            [['\'quote\''], '["\'quote\'"]'],
            [['"quote"'], '["\\"quote\\""]'],
            [['part1', 'part2'], 'part1.part2'],
            [['part1', 'part2', 3], 'part1.part2[3]'],
            [['part1', 'part2', '3'], 'part1.part2["3"]'],
            [['part1', 'part2', '3part'], 'part1.part2["3part"]'],
            [['part1', 'part2', '3part', 'part4'], 'part1.part2["3part"].part4'],
            [['part1', 'part2', '3part', '4part'], 'part1.part2["3part"]["4part"]']
        ];

        for (const [pathArray, expected] of data) {
            expect(ObjectPropertyAccessor.getPathString(pathArray)).toStrictEqual(expected);
        }
    });
}

/** */
function testGetPathString2() {
    test('GetPathString2', () => {
        /** @type {[pathArray: unknown[], message: string][]} */
        const data = [
            [[1.5], 'Invalid index'],
            [[null], 'Invalid type: object']
        ];

        for (const [pathArray, message] of data) {
            // @ts-expect-error - Throwing is expected
            expect(() => ObjectPropertyAccessor.getPathString(pathArray)).toThrow(message);
        }
    });
}


/** */
function testGetPathArray1() {
    test('GetPathArray1', () => {
        /** @type {[pathString: string, pathArray: (string|number)[]][]} */
        const data = [
            ['', []],
            ['[0]', [0]],
            ['["escape\\\\"]', ['escape\\']],
            ['["\'quote\'"]', ['\'quote\'']],
            ['["\\"quote\\""]', ['"quote"']],
            ['part1.part2', ['part1', 'part2']],
            ['part1.part2[3]', ['part1', 'part2', 3]],
            ['part1.part2["3"]', ['part1', 'part2', '3']],
            ['part1.part2[\'3\']', ['part1', 'part2', '3']],
            ['part1.part2["3part"]', ['part1', 'part2', '3part']],
            ['part1.part2[\'3part\']', ['part1', 'part2', '3part']],
            ['part1.part2["3part"].part4', ['part1', 'part2', '3part', 'part4']],
            ['part1.part2[\'3part\'].part4', ['part1', 'part2', '3part', 'part4']],
            ['part1.part2["3part"]["4part"]', ['part1', 'part2', '3part', '4part']],
            ['part1.part2[\'3part\'][\'4part\']', ['part1', 'part2', '3part', '4part']]
        ];

        for (const [pathString, expected] of data) {
            expect(ObjectPropertyAccessor.getPathArray(pathString)).toStrictEqual(expected);
        }
    });
}

/** */
function testGetPathArray2() {
    test('GetPathArray2', () => {
        /** @type {[pathString: string, message: string][]} */
        const data = [
            ['?', 'Unexpected character: ?'],
            ['.', 'Unexpected character: .'],
            ['0', 'Unexpected character: 0'],
            ['part1.[0]', 'Unexpected character: ['],
            ['part1?', 'Unexpected character: ?'],
            ['[part1]', 'Unexpected character: p'],
            ['[0a]', 'Unexpected character: a'],
            ['["part1"x]', 'Unexpected character: x'],
            ['[\'part1\'x]', 'Unexpected character: x'],
            ['["part1"]x', 'Unexpected character: x'],
            ['[\'part1\']x', 'Unexpected character: x'],
            ['part1..part2', 'Unexpected character: .'],

            ['[', 'Path not terminated correctly'],
            ['part1.', 'Path not terminated correctly'],
            ['part1[', 'Path not terminated correctly'],
            ['part1["', 'Path not terminated correctly'],
            ['part1[\'', 'Path not terminated correctly'],
            ['part1[""', 'Path not terminated correctly'],
            ['part1[\'\'', 'Path not terminated correctly'],
            ['part1[0', 'Path not terminated correctly'],
            ['part1[0].', 'Path not terminated correctly']
        ];

        for (const [pathString, message] of data) {
            expect(() => ObjectPropertyAccessor.getPathArray(pathString)).toThrow(message);
        }
    });
}


/** */
function testHasProperty() {
    test('HasProperty', () => {
        /** @type {[object: unknown, property: unknown, expected: boolean][]} */
        const data = [
            [{}, 'invalid', false],
            [{}, 0, false],
            [{valid: 0}, 'valid', true],
            [{null: 0}, null, false],
            [[], 'invalid', false],
            [[], 0, false],
            [[0], 0, true],
            [[0], null, false],
            ['string', 0, false],
            ['string', 'length', false],
            ['string', null, false]
        ];

        for (const [object, property, expected] of data) {
            // @ts-expect-error - Ignore potentially property types
            expect(ObjectPropertyAccessor.hasProperty(object, property)).toStrictEqual(expected);
        }
    });
}

/** */
function testIsValidPropertyType() {
    test('IsValidPropertyType', () => {
        /** @type {[object: unknown, property: unknown, expected: boolean][]} */
        const data = [
            [{}, 'invalid', true],
            [{}, 0, false],
            [{valid: 0}, 'valid', true],
            [{null: 0}, null, false],
            [[], 'invalid', false],
            [[], 0, true],
            [[0], 0, true],
            [[0], null, false],
            ['string', 0, false],
            ['string', 'length', false],
            ['string', null, false]
        ];

        for (const [object, property, expected] of data) {
            // @ts-expect-error - Ignore potentially property types
            expect(ObjectPropertyAccessor.isValidPropertyType(object, property)).toStrictEqual(expected);
        }
    });
}


/** */
function main() {
    testGet1();
    testGet2();
    testSet1();
    testSet2();
    testDelete1();
    testDelete2();
    testSwap1();
    testSwap2();
    testGetPathString1();
    testGetPathString2();
    testGetPathArray1();
    testGetPathArray2();
    testHasProperty();
    testIsValidPropertyType();
}


main();
