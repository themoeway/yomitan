/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2019-2022  Yomichan Authors
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

import {EventDispatcher} from './event-dispatcher.js';
import {generateId} from './utilities.js';

/**
 * Class representing a generic value with an override stack.
 * Changes can be observed by listening to the 'change' event.
 * @template [T=unknown]
 * @augments EventDispatcher<import('dynamic-property').Events<T>>
 */
export class DynamicProperty extends EventDispatcher {
    /**
     * Creates a new instance with the specified value.
     * @param {T} value The value to assign.
     */
    constructor(value) {
        super();
        /** @type {T} */
        this._value = value;
        /** @type {T} */
        this._defaultValue = value;
        /** @type {{value: T, priority: number, token: string}[]} */
        this._overrides = [];
    }

    /**
     * Gets the default value for the property, which is assigned to the
     * public value property when no overrides are present.
     * @type {T}
     */
    get defaultValue() {
        return this._defaultValue;
    }

    /**
     * Assigns the default value for the property. If no overrides are present
     * and if the value is different than the current default value,
     * the 'change' event will be triggered.
     * @param {T} value The value to assign.
     */
    set defaultValue(value) {
        this._defaultValue = value;
        if (this._overrides.length === 0) { this._updateValue(); }
    }

    /**
     * Gets the current value for the property, taking any overrides into account.
     * @type {T}
     */
    get value() {
        return this._value;
    }

    /**
     * Gets the number of overrides added to the property.
     * @type {number}
     */
    get overrideCount() {
        return this._overrides.length;
    }

    /**
     * Adds an override value with the specified priority to the override stack.
     * Values with higher priority will take precedence over those with lower.
     * For tie breaks, the override value added first will take precedence.
     * If the newly added override has the highest priority of all overrides
     * and if the override value is different from the current value,
     * the 'change' event will be fired.
     * @param {T} value The override value to assign.
     * @param {number} [priority] The priority value to use, as a number.
     * @returns {import('core').TokenString} A string token which can be passed to the clearOverride function
     *   to remove the override.
     */
    setOverride(value, priority = 0) {
        const overridesCount = this._overrides.length;
        let i = 0;
        for (; i < overridesCount; ++i) {
            if (priority > this._overrides[i].priority) { break; }
        }
        const token = generateId(16);
        this._overrides.splice(i, 0, {value, priority, token});
        if (i === 0) { this._updateValue(); }
        return token;
    }

    /**
     * Removes a specific override value. If the removed override
     * had the highest priority, and the new value is different from
     * the previous value, the 'change' event will be fired.
     * @param {import('core').TokenString} token The token for the corresponding override which is to be removed.
     * @returns {boolean} `true` if an override was returned, `false` otherwise.
     */
    clearOverride(token) {
        for (let i = 0, ii = this._overrides.length; i < ii; ++i) {
            if (this._overrides[i].token === token) {
                this._overrides.splice(i, 1);
                if (i === 0) { this._updateValue(); }
                return true;
            }
        }
        return false;
    }

    /**
     * Updates the current value using the current overrides and default value.
     * If the new value differs from the previous value, the 'change' event will be fired.
     */
    _updateValue() {
        const value = this._overrides.length > 0 ? this._overrides[0].value : this._defaultValue;
        if (this._value === value) { return; }
        this._value = value;
        this.trigger('change', {value});
    }
}
