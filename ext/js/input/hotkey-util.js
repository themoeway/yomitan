/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2021-2022  Yomichan Authors
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

/**
 * Utility class to help display hotkeys and convert to/from commands.
 */
export class HotkeyUtil {
    /**
     * Creates a new instance.
     * @param {?import('environment').OperatingSystem} os The operating system for this instance.
     */
    constructor(os = null) {
        /** @type {?import('environment').OperatingSystem} */
        this._os = os;
        /** @type {string} */
        this._inputSeparator = ' + ';
        /** @type {Map<import('input').Modifier, string>} */
        this._modifierKeyNames = new Map();
        /** @type {RegExp} */
        this._mouseInputNamePattern = /^mouse(\d+)$/;
        /** @type {Map<import('input').Modifier, number>} */
        this._modifierPriorities = new Map([
            ['meta', -4],
            ['ctrl', -3],
            ['alt', -2],
            ['shift', -1]
        ]);
        /** @type {Intl.Collator} */
        this._stringComparer = new Intl.Collator('en-US'); // Invariant locale

        this._updateModifierKeyNames();
    }

    /**
     * Gets the operating system for this instance.
     * The operating system is used to display system-localized modifier key names.
     * @type {?import('environment').OperatingSystem}
     */
    get os() {
        return this._os;
    }

    /**
     * Sets the operating system for this instance.
     * @param {?import('environment').OperatingSystem} value The value to assign.
     *   Valid values are: win, mac, linux, openbsd, cros, android.
     */
    set os(value) {
        if (this._os === value) { return; }
        this._os = value;
        this._updateModifierKeyNames();
    }

    /**
     * Gets a display string for a key and a set of modifiers.
     * @param {?string} key The key code string, or `null` for no key.
     * @param {import('input').Modifier[]} modifiers An array of modifiers.
     *   Valid values are: ctrl, alt, shift, meta, or mouseN, where N is an integer.
     * @returns {string} A user-friendly string for the combination of key and modifiers.
     */
    getInputDisplayValue(key, modifiers) {
        const separator = this._inputSeparator;
        let displayValue = '';
        let first = true;
        for (const modifier of modifiers) {
            if (first) {
                first = false;
            } else {
                displayValue += separator;
            }
            displayValue += this.getModifierDisplayValue(modifier);
        }
        if (typeof key === 'string') {
            if (!first) { displayValue += separator; }
            displayValue += this.getKeyDisplayValue(key);
        }
        return displayValue;
    }

    /**
     * Gets a display string for a single modifier.
     * @param {import('input').Modifier} modifier A string representing a modifier.
     *   Valid values are: ctrl, alt, shift, meta, or mouseN, where N is an integer.
     * @returns {string} A user-friendly string for the modifier.
     */
    getModifierDisplayValue(modifier) {
        const match = this._mouseInputNamePattern.exec(modifier);
        if (match !== null) {
            return `Mouse ${match[1]}`;
        }

        const name = this._modifierKeyNames.get(modifier);
        return (typeof name !== 'undefined' ? name : modifier);
    }

    /**
     * Gets a display string for a key.
     * @param {?string} key The key code string, or `null` for no key.
     * @returns {?string} A user-friendly string for the combination of key and modifiers, or `null` if key was already `null`.
     */
    getKeyDisplayValue(key) {
        if (typeof key === 'string' && key.length === 4 && key.startsWith('Key')) {
            key = key.substring(3);
        }
        return key;
    }

    /**
     * Gets a display string for a single modifier.
     * @param {import('input').Modifier} modifier A string representing a modifier.
     *   Valid values are: ctrl, alt, shift, meta, or mouseN, where N is an integer.
     * @returns {import('input').ModifierType} `'mouse'` if the modifier represents a mouse button, `'key'` otherwise.
     */
    getModifierType(modifier) {
        return (this._mouseInputNamePattern.test(modifier) ? 'mouse' : 'key');
    }

    /**
     * Converts an extension command string into a standard input.
     * @param {string|undefined} command An extension command string.
     * @returns {{key: ?string, modifiers: import('input').ModifierKey[]}} An object `{key, modifiers}`, where key is a string (or `null`) representing the key, and modifiers is an array of modifier keys.
     */
    convertCommandToInput(command) {
        let key = null;
        /** @type {Set<import('input').ModifierKey>} */
        const modifiers = new Set();
        if (typeof command === 'string' && command.length > 0) {
            const parts = command.split('+');
            const ii = parts.length - 1;
            key = this._convertCommandKeyToInputKey(parts[ii]);
            for (let i = 0; i < ii; ++i) {
                const modifier = this._convertCommandModifierToInputModifier(parts[i]);
                if (modifier !== null) {
                    modifiers.add(modifier);
                }
            }
        }
        return {key, modifiers: this.sortModifiers([...modifiers])};
    }

    /**
     * Gets a command string for a specified input.
     * @param {?string} key The key code string, or `null` for no key.
     * @param {import('input').Modifier[]} modifiers An array of modifier keys.
     *   Valid values are: ctrl, alt, shift, meta.
     * @returns {string} An extension command string representing the input.
     */
    convertInputToCommand(key, modifiers) {
        const separator = '+';
        let command = '';
        let first = true;
        for (const modifier of modifiers) {
            if (first) {
                first = false;
            } else {
                command += separator;
            }
            command += this._convertInputModifierToCommandModifier(modifier);
        }
        if (typeof key === 'string') {
            if (!first) { command += separator; }
            command += this._convertInputKeyToCommandKey(key);
        }
        return command;
    }

    /**
     * @template {import('input').Modifier} TModifier
     * Sorts an array of modifiers.
     * @param {TModifier[]} modifiers An array of modifiers.
     *   Valid values are: ctrl, alt, shift, meta.
     * @returns {TModifier[]} A sorted array of modifiers. The array instance is the same as the input array.
     */
    sortModifiers(modifiers) {
        const pattern = this._mouseInputNamePattern;
        const keyPriorities = this._modifierPriorities;
        const stringComparer = this._stringComparer;

        const count = modifiers.length;
        /** @type {[modifier: TModifier, isMouse: 0|1, priority: number, index: number][]} */
        const modifierInfos = [];
        for (let i = 0; i < count; ++i) {
            const modifier = modifiers[i];
            const match = pattern.exec(modifier);
            /** @type {[modifier: TModifier, isMouse: 0|1, priority: number, index: number]} */
            let info;
            if (match !== null) {
                info = [modifier, 1, Number.parseInt(match[1], 10), i];
            } else {
                let priority = keyPriorities.get(modifier);
                if (typeof priority === 'undefined') { priority = 0; }
                info = [modifier, 0, priority, i];
            }
            modifierInfos.push(info);
        }

        modifierInfos.sort((a, b) => {
            let i = a[1] - b[1];
            if (i !== 0) { return i; }

            i = a[2] - b[2];
            if (i !== 0) { return i; }

            i = stringComparer.compare(a[0], b[0]);
            if (i !== 0) { return i; }

            i = a[3] - b[3];
            return i;
        });

        for (let i = 0; i < count; ++i) {
            modifiers[i] = modifierInfos[i][0];
        }

        return modifiers;
    }

    // Private

    /**
     * @param {?import('environment').OperatingSystem} os
     * @returns {[modifier: import('input').ModifierKey, label: string][]}
     */
    _getModifierKeyNames(os) {
        switch (os) {
            case 'win':
                return [
                    ['alt', 'Alt'],
                    ['ctrl', 'Ctrl'],
                    ['shift', 'Shift'],
                    ['meta', 'Windows']
                ];
            case 'mac':
                return [
                    ['alt', 'Opt'],
                    ['ctrl', 'Ctrl'],
                    ['shift', 'Shift'],
                    ['meta', 'Cmd']
                ];
            case 'linux':
            case 'openbsd':
            case 'cros':
            case 'android':
                return [
                    ['alt', 'Alt'],
                    ['ctrl', 'Ctrl'],
                    ['shift', 'Shift'],
                    ['meta', 'Super']
                ];
            default: // 'unknown', etc
                return [
                    ['alt', 'Alt'],
                    ['ctrl', 'Ctrl'],
                    ['shift', 'Shift'],
                    ['meta', 'Meta']
                ];
        }
    }

    /**
     * @returns {void}
     */
    _updateModifierKeyNames() {
        const map = this._modifierKeyNames;
        map.clear();
        for (const [key, value] of this._getModifierKeyNames(this._os)) {
            map.set(key, value);
        }
    }

    /**
     * @param {string} key
     * @returns {string}
     */
    _convertCommandKeyToInputKey(key) {
        if (key.length === 1) {
            key = `Key${key}`;
        }
        return key;
    }

    /**
     * @param {string} modifier
     * @returns {?import('input').ModifierKey}
     */
    _convertCommandModifierToInputModifier(modifier) {
        switch (modifier) {
            case 'Ctrl': return (this._os === 'mac' ? 'meta' : 'ctrl');
            case 'Alt': return 'alt';
            case 'Shift': return 'shift';
            case 'MacCtrl': return 'ctrl';
            case 'Command': return 'meta';
            default: return null;
        }
    }

    /**
     * @param {string} key
     * @returns {string}
     */
    _convertInputKeyToCommandKey(key) {
        if (key.length === 4 && key.startsWith('Key')) {
            key = key.substring(3);
        }
        return key;
    }

    /**
     * @param {import('input').Modifier} modifier
     * @returns {string}
     */
    _convertInputModifierToCommandModifier(modifier) {
        switch (modifier) {
            case 'ctrl': return (this._os === 'mac' ? 'MacCtrl' : 'Ctrl');
            case 'alt': return 'Alt';
            case 'shift': return 'Shift';
            case 'meta': return 'Command';
            default: return modifier;
        }
    }
}
