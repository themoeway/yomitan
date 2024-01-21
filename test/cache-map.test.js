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

/* eslint-disable no-multi-spaces */

import {describe, expect, test} from 'vitest';
import {CacheMap} from '../ext/js/general/cache-map.js';

/** */
function testConstructor() {
    describe('constructor', () => {
        const shouldThrow = [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY];
        const shouldNotThrow = [0, 1, Number.MAX_VALUE];

        test.each(shouldNotThrow)('`() => new CacheMap(%d)` should not throw', (param) => {
            expect(() => new CacheMap(param)).not.toThrowError();
        });
        test.each(shouldThrow)('`() => new CacheMap(%d)` should throw', (param) => {
            expect(() => new CacheMap(param)).toThrowError();
        });
    });
}

/** */
function testApi() {
    describe('api', () => {
        const data = [
            {
                maxSize: 1,
                expectedSize: 0,
                calls: []
            },
            {
                maxSize: 10,
                expectedSize: 1,
                calls: [
                    {func: 'get', args: ['a1-b-c'],     returnValue: void 0},
                    {func: 'has', args: ['a1-b-c'],     returnValue: false},
                    {func: 'set', args: ['a1-b-c', 32], returnValue: void 0},
                    {func: 'get', args: ['a1-b-c'],     returnValue: 32},
                    {func: 'has', args: ['a1-b-c'],     returnValue: true}
                ]
            },
            {
                maxSize: 10,
                expectedSize: 2,
                calls: [
                    {func: 'set', args: ['a1-b-c', 32], returnValue: void 0},
                    {func: 'get', args: ['a1-b-c'],     returnValue: 32},
                    {func: 'set', args: ['a1-b-c', 64], returnValue: void 0},
                    {func: 'get', args: ['a1-b-c'],     returnValue: 64},
                    {func: 'set', args: ['a2-b-c', 96], returnValue: void 0},
                    {func: 'get', args: ['a2-b-c'],     returnValue: 96}
                ]
            },
            {
                maxSize: 2,
                expectedSize: 2,
                calls: [
                    {func: 'has', args: ['a1-b-c'],    returnValue: false},
                    {func: 'has', args: ['a2-b-c'],    returnValue: false},
                    {func: 'has', args: ['a3-b-c'],    returnValue: false},
                    {func: 'set', args: ['a1-b-c', 1], returnValue: void 0},
                    {func: 'has', args: ['a1-b-c'],    returnValue: true},
                    {func: 'has', args: ['a2-b-c'],    returnValue: false},
                    {func: 'has', args: ['a3-b-c'],    returnValue: false},
                    {func: 'set', args: ['a2-b-c', 2], returnValue: void 0},
                    {func: 'has', args: ['a1-b-c'],    returnValue: true},
                    {func: 'has', args: ['a2-b-c'],    returnValue: true},
                    {func: 'has', args: ['a3-b-c'],    returnValue: false},
                    {func: 'set', args: ['a3-b-c', 3], returnValue: void 0},
                    {func: 'has', args: ['a1-b-c'],    returnValue: false},
                    {func: 'has', args: ['a2-b-c'],    returnValue: true},
                    {func: 'has', args: ['a3-b-c'],    returnValue: true}
                ]
            }
        ];

        test.each(data)('api-test-%#', ({maxSize, expectedSize, calls}) => {
            const cache = new CacheMap(maxSize);
            expect(cache.maxSize).toStrictEqual(maxSize);
            for (const call of calls) {
                const {func, args} = call;
                let returnValue;
                switch (func) {
                    case 'get': returnValue = cache.get(args[0]); break;
                    case 'set': returnValue = cache.set(args[0], args[1]); break;
                    case 'has': returnValue = cache.has(args[0]); break;
                    case 'clear': returnValue = cache.clear(); break;
                }
                if (Object.prototype.hasOwnProperty.call(call, 'returnValue')) {
                    const {returnValue: expectedReturnValue} = call;
                    expect(returnValue).toStrictEqual(expectedReturnValue);
                }
            }
            expect(cache.size).toStrictEqual(expectedSize);
        });
    });
}


/** */
function main() {
    testConstructor();
    testApi();
}


main();
