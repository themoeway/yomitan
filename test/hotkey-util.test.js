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
import {HotkeyUtil} from '../ext/js/input/hotkey-util.js';

/** */
function testCommandConversions() {
    describe('CommandConversions', () => {
        /** @type {{os: import('environment').OperatingSystem, command: string, expectedCommand: string, expectedInput: {key: string, modifiers: import('input').Modifier[]}}[]} */
        const data = [
            {os: 'win', command: 'Alt+F', expectedCommand: 'Alt+F', expectedInput: {key: 'KeyF', modifiers: ['alt']}},
            {os: 'win', command: 'F1',    expectedCommand: 'F1',    expectedInput: {key: 'F1', modifiers: []}},

            {os: 'win', command: 'Ctrl+Alt+Shift+F1',    expectedCommand: 'Ctrl+Alt+Shift+F1',    expectedInput: {key: 'F1', modifiers: ['ctrl', 'alt', 'shift']}},
            {os: 'win', command: 'MacCtrl+Alt+Shift+F1', expectedCommand: 'Ctrl+Alt+Shift+F1',    expectedInput: {key: 'F1', modifiers: ['ctrl', 'alt', 'shift']}},
            {os: 'win', command: 'Command+Alt+Shift+F1', expectedCommand: 'Command+Alt+Shift+F1', expectedInput: {key: 'F1', modifiers: ['meta', 'alt', 'shift']}},

            {os: 'mac', command: 'Ctrl+Alt+Shift+F1',    expectedCommand: 'Command+Alt+Shift+F1', expectedInput: {key: 'F1', modifiers: ['meta', 'alt', 'shift']}},
            {os: 'mac', command: 'MacCtrl+Alt+Shift+F1', expectedCommand: 'MacCtrl+Alt+Shift+F1', expectedInput: {key: 'F1', modifiers: ['ctrl', 'alt', 'shift']}},
            {os: 'mac', command: 'Command+Alt+Shift+F1', expectedCommand: 'Command+Alt+Shift+F1', expectedInput: {key: 'F1', modifiers: ['meta', 'alt', 'shift']}},

            {os: 'linux', command: 'Ctrl+Alt+Shift+F1',    expectedCommand: 'Ctrl+Alt+Shift+F1',    expectedInput: {key: 'F1', modifiers: ['ctrl', 'alt', 'shift']}},
            {os: 'linux', command: 'MacCtrl+Alt+Shift+F1', expectedCommand: 'Ctrl+Alt+Shift+F1',    expectedInput: {key: 'F1', modifiers: ['ctrl', 'alt', 'shift']}},
            {os: 'linux', command: 'Command+Alt+Shift+F1', expectedCommand: 'Command+Alt+Shift+F1', expectedInput: {key: 'F1', modifiers: ['meta', 'alt', 'shift']}}
        ];

        const hotkeyUtil = new HotkeyUtil();
        for (const {command, os, expectedInput, expectedCommand} of data) {
            test(`${command} on ${os} -> ${JSON.stringify(expectedInput)}`, () => {
                hotkeyUtil.os = os;
                const input = structuredClone(hotkeyUtil.convertCommandToInput(command));
                expect(input).toStrictEqual(expectedInput);
                const command2 = hotkeyUtil.convertInputToCommand(input.key, input.modifiers);
                expect(command2).toStrictEqual(expectedCommand);
            });
        }
    });
}

/** */
function testDisplayNames() {
    describe('DisplayNames', () => {
        /** @type {{os: import('environment').OperatingSystem, key: ?string, modifiers: import('input').Modifier[], expected: string}[]} */
        const data = [
            {os: 'win', key: null,   modifiers: [], expected: ''},
            {os: 'win', key: 'KeyF', modifiers: [], expected: 'F'},
            {os: 'win', key: 'F1',   modifiers: [], expected: 'F1'},
            {os: 'win', key: null,   modifiers: ['ctrl'], expected: 'Ctrl'},
            {os: 'win', key: 'KeyF', modifiers: ['ctrl'], expected: 'Ctrl + F'},
            {os: 'win', key: 'F1',   modifiers: ['ctrl'], expected: 'Ctrl + F1'},
            {os: 'win', key: null,   modifiers: ['alt'], expected: 'Alt'},
            {os: 'win', key: 'KeyF', modifiers: ['alt'], expected: 'Alt + F'},
            {os: 'win', key: 'F1',   modifiers: ['alt'], expected: 'Alt + F1'},
            {os: 'win', key: null,   modifiers: ['shift'], expected: 'Shift'},
            {os: 'win', key: 'KeyF', modifiers: ['shift'], expected: 'Shift + F'},
            {os: 'win', key: 'F1',   modifiers: ['shift'], expected: 'Shift + F1'},
            {os: 'win', key: null,   modifiers: ['meta'], expected: 'Windows'},
            {os: 'win', key: 'KeyF', modifiers: ['meta'], expected: 'Windows + F'},
            {os: 'win', key: 'F1',   modifiers: ['meta'], expected: 'Windows + F1'},
            {os: 'win', key: null,   modifiers: ['mouse1'], expected: 'Mouse 1'},
            {os: 'win', key: 'KeyF', modifiers: ['mouse1'], expected: 'Mouse 1 + F'},
            {os: 'win', key: 'F1',   modifiers: ['mouse1'], expected: 'Mouse 1 + F1'},

            {os: 'mac', key: null,   modifiers: [], expected: ''},
            {os: 'mac', key: 'KeyF', modifiers: [], expected: 'F'},
            {os: 'mac', key: 'F1',   modifiers: [], expected: 'F1'},
            {os: 'mac', key: null,   modifiers: ['ctrl'], expected: 'Ctrl'},
            {os: 'mac', key: 'KeyF', modifiers: ['ctrl'], expected: 'Ctrl + F'},
            {os: 'mac', key: 'F1',   modifiers: ['ctrl'], expected: 'Ctrl + F1'},
            {os: 'mac', key: null,   modifiers: ['alt'], expected: 'Opt'},
            {os: 'mac', key: 'KeyF', modifiers: ['alt'], expected: 'Opt + F'},
            {os: 'mac', key: 'F1',   modifiers: ['alt'], expected: 'Opt + F1'},
            {os: 'mac', key: null,   modifiers: ['shift'], expected: 'Shift'},
            {os: 'mac', key: 'KeyF', modifiers: ['shift'], expected: 'Shift + F'},
            {os: 'mac', key: 'F1',   modifiers: ['shift'], expected: 'Shift + F1'},
            {os: 'mac', key: null,   modifiers: ['meta'], expected: 'Cmd'},
            {os: 'mac', key: 'KeyF', modifiers: ['meta'], expected: 'Cmd + F'},
            {os: 'mac', key: 'F1',   modifiers: ['meta'], expected: 'Cmd + F1'},
            {os: 'mac', key: null,   modifiers: ['mouse1'], expected: 'Mouse 1'},
            {os: 'mac', key: 'KeyF', modifiers: ['mouse1'], expected: 'Mouse 1 + F'},
            {os: 'mac', key: 'F1',   modifiers: ['mouse1'], expected: 'Mouse 1 + F1'},

            {os: 'linux', key: null,   modifiers: [], expected: ''},
            {os: 'linux', key: 'KeyF', modifiers: [], expected: 'F'},
            {os: 'linux', key: 'F1',   modifiers: [], expected: 'F1'},
            {os: 'linux', key: null,   modifiers: ['ctrl'], expected: 'Ctrl'},
            {os: 'linux', key: 'KeyF', modifiers: ['ctrl'], expected: 'Ctrl + F'},
            {os: 'linux', key: 'F1',   modifiers: ['ctrl'], expected: 'Ctrl + F1'},
            {os: 'linux', key: null,   modifiers: ['alt'], expected: 'Alt'},
            {os: 'linux', key: 'KeyF', modifiers: ['alt'], expected: 'Alt + F'},
            {os: 'linux', key: 'F1',   modifiers: ['alt'], expected: 'Alt + F1'},
            {os: 'linux', key: null,   modifiers: ['shift'], expected: 'Shift'},
            {os: 'linux', key: 'KeyF', modifiers: ['shift'], expected: 'Shift + F'},
            {os: 'linux', key: 'F1',   modifiers: ['shift'], expected: 'Shift + F1'},
            {os: 'linux', key: null,   modifiers: ['meta'], expected: 'Super'},
            {os: 'linux', key: 'KeyF', modifiers: ['meta'], expected: 'Super + F'},
            {os: 'linux', key: 'F1',   modifiers: ['meta'], expected: 'Super + F1'},
            {os: 'linux', key: null,   modifiers: ['mouse1'], expected: 'Mouse 1'},
            {os: 'linux', key: 'KeyF', modifiers: ['mouse1'], expected: 'Mouse 1 + F'},
            {os: 'linux', key: 'F1',   modifiers: ['mouse1'], expected: 'Mouse 1 + F1'},

            {os: 'unknown', key: null,   modifiers: [], expected: ''},
            {os: 'unknown', key: 'KeyF', modifiers: [], expected: 'F'},
            {os: 'unknown', key: 'F1',   modifiers: [], expected: 'F1'},
            {os: 'unknown', key: null,   modifiers: ['ctrl'], expected: 'Ctrl'},
            {os: 'unknown', key: 'KeyF', modifiers: ['ctrl'], expected: 'Ctrl + F'},
            {os: 'unknown', key: 'F1',   modifiers: ['ctrl'], expected: 'Ctrl + F1'},
            {os: 'unknown', key: null,   modifiers: ['alt'], expected: 'Alt'},
            {os: 'unknown', key: 'KeyF', modifiers: ['alt'], expected: 'Alt + F'},
            {os: 'unknown', key: 'F1',   modifiers: ['alt'], expected: 'Alt + F1'},
            {os: 'unknown', key: null,   modifiers: ['shift'], expected: 'Shift'},
            {os: 'unknown', key: 'KeyF', modifiers: ['shift'], expected: 'Shift + F'},
            {os: 'unknown', key: 'F1',   modifiers: ['shift'], expected: 'Shift + F1'},
            {os: 'unknown', key: null,   modifiers: ['meta'], expected: 'Meta'},
            {os: 'unknown', key: 'KeyF', modifiers: ['meta'], expected: 'Meta + F'},
            {os: 'unknown', key: 'F1',   modifiers: ['meta'], expected: 'Meta + F1'},
            {os: 'unknown', key: null,   modifiers: ['mouse1'], expected: 'Mouse 1'},
            {os: 'unknown', key: 'KeyF', modifiers: ['mouse1'], expected: 'Mouse 1 + F'},
            {os: 'unknown', key: 'F1',   modifiers: ['mouse1'], expected: 'Mouse 1 + F1'}
        ];

        const hotkeyUtil = new HotkeyUtil();

        test.each(data)('$key with $modifiers on $os -> display value $expected', ({os, key, modifiers, expected}) => {
            hotkeyUtil.os = os;
            const displayName = hotkeyUtil.getInputDisplayValue(key, modifiers);
            expect(displayName).toStrictEqual(expected);
        });
    });
}

/** */
function testSortModifiers() {
    describe('SortModifiers', () => {
        /** @type {{modifiers: import('input').Modifier[], expected: import('input').Modifier[]}[]} */
        const data = [
            {modifiers: [], expected: []},
            {modifiers: ['shift', 'alt', 'ctrl', 'mouse4', 'meta', 'mouse1', 'mouse0'], expected: ['meta', 'ctrl', 'alt', 'shift', 'mouse0', 'mouse1', 'mouse4']}
        ];

        const hotkeyUtil = new HotkeyUtil();
        for (const {modifiers, expected} of data) {
            test(`[${modifiers}] -> [${expected}]`, () => {
                const modifiers2 = hotkeyUtil.sortModifiers(modifiers);
                expect(modifiers2).toStrictEqual(modifiers);
                expect(modifiers2).toStrictEqual(expected);
            });
        }
    });
}


/** */
function main() {
    testCommandConversions();
    testDisplayNames();
    testSortModifiers();
}

main();
