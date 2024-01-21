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

import {JsonSchema} from '../data/json-schema.js';

/**
 * Utility class to help processing profile conditions.
 */
export class ProfileConditionsUtil {
    /**
     * Creates a new instance.
     */
    constructor() {
        /** @type {RegExp} */
        this._splitPattern = /[,;\s]+/;
        /** @type {Map<string, {operators: Map<string, import('profile-conditions-util').CreateSchemaFunction>}>} */
        this._descriptors = new Map([
            [
                'popupLevel',
                {
                    operators: new Map(/** @type {import('profile-conditions-util').OperatorMapArray} */ ([
                        ['equal', this._createSchemaPopupLevelEqual.bind(this)],
                        ['notEqual', this._createSchemaPopupLevelNotEqual.bind(this)],
                        ['lessThan', this._createSchemaPopupLevelLessThan.bind(this)],
                        ['greaterThan', this._createSchemaPopupLevelGreaterThan.bind(this)],
                        ['lessThanOrEqual', this._createSchemaPopupLevelLessThanOrEqual.bind(this)],
                        ['greaterThanOrEqual', this._createSchemaPopupLevelGreaterThanOrEqual.bind(this)]
                    ]))
                }
            ],
            [
                'url',
                {
                    operators: new Map(/** @type {import('profile-conditions-util').OperatorMapArray} */ ([
                        ['matchDomain', this._createSchemaUrlMatchDomain.bind(this)],
                        ['matchRegExp', this._createSchemaUrlMatchRegExp.bind(this)]
                    ]))
                }
            ],
            [
                'modifierKeys',
                {
                    operators: new Map(/** @type {import('profile-conditions-util').OperatorMapArray} */ ([
                        ['are', this._createSchemaModifierKeysAre.bind(this)],
                        ['areNot', this._createSchemaModifierKeysAreNot.bind(this)],
                        ['include', this._createSchemaModifierKeysInclude.bind(this)],
                        ['notInclude', this._createSchemaModifierKeysNotInclude.bind(this)]
                    ]))
                }
            ],
            [
                'flags',
                {
                    operators: new Map(/** @type {import('profile-conditions-util').OperatorMapArray} */ ([
                        ['are', this._createSchemaFlagsAre.bind(this)],
                        ['areNot', this._createSchemaFlagsAreNot.bind(this)],
                        ['include', this._createSchemaFlagsInclude.bind(this)],
                        ['notInclude', this._createSchemaFlagsNotInclude.bind(this)]
                    ]))
                }
            ]
        ]);
    }

    /**
     * Creates a new JSON schema descriptor for the given set of condition groups.
     * @param {import('settings').ProfileConditionGroup[]} conditionGroups An array of condition groups.
     *   For a profile match, all of the items must return successfully in at least one of the groups.
     * @returns {JsonSchema} A new `JsonSchema` object.
     */
    createSchema(conditionGroups) {
        const anyOf = [];
        for (const {conditions} of conditionGroups) {
            const allOf = [];
            for (const {type, operator, value} of conditions) {
                const conditionDescriptor = this._descriptors.get(type);
                if (typeof conditionDescriptor === 'undefined') { continue; }

                const createSchema = conditionDescriptor.operators.get(operator);
                if (typeof createSchema === 'undefined') { continue; }

                const schema = createSchema(value);
                allOf.push(schema);
            }
            switch (allOf.length) {
                case 0: break;
                case 1: anyOf.push(allOf[0]); break;
                default: anyOf.push({allOf}); break;
            }
        }
        let schema;
        switch (anyOf.length) {
            case 0: schema = {}; break;
            case 1: schema = anyOf[0]; break;
            default: schema = {anyOf}; break;
        }
        return new JsonSchema(schema);
    }

    /**
     * Creates a normalized version of the context object to test,
     * assigning dependent fields as needed.
     * @param {import('settings').OptionsContext} context A context object which is used during schema validation.
     * @returns {import('profile-conditions-util').NormalizedOptionsContext} A normalized context object.
     */
    normalizeContext(context) {
        const normalizedContext = /** @type {import('profile-conditions-util').NormalizedOptionsContext} */ (Object.assign({}, context));
        const {url} = normalizedContext;
        if (typeof url === 'string') {
            try {
                normalizedContext.domain = new URL(url).hostname;
            } catch (e) {
                // NOP
            }
        }
        const {flags} = normalizedContext;
        if (!Array.isArray(flags)) {
            normalizedContext.flags = [];
        }
        return normalizedContext;
    }

    // Private

    /**
     * @param {string} value
     * @returns {string[]}
     */
    _split(value) {
        return value.split(this._splitPattern);
    }

    /**
     * @param {string} value
     * @returns {number}
     */
    _stringToNumber(value) {
        const number = Number.parseFloat(value);
        return Number.isFinite(number) ? number : 0;
    }

    // popupLevel schema creation functions

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaPopupLevelEqual(value) {
        const number = this._stringToNumber(value);
        return {
            required: ['depth'],
            properties: {
                depth: {const: number}
            }
        };
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaPopupLevelNotEqual(value) {
        return {
            not: {
                anyOf: [this._createSchemaPopupLevelEqual(value)]
            }
        };
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaPopupLevelLessThan(value) {
        const number = this._stringToNumber(value);
        return {
            required: ['depth'],
            properties: {
                depth: {type: 'number', exclusiveMaximum: number}
            }
        };
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaPopupLevelGreaterThan(value) {
        const number = this._stringToNumber(value);
        return {
            required: ['depth'],
            properties: {
                depth: {type: 'number', exclusiveMinimum: number}
            }
        };
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaPopupLevelLessThanOrEqual(value) {
        const number = this._stringToNumber(value);
        return {
            required: ['depth'],
            properties: {
                depth: {type: 'number', maximum: number}
            }
        };
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaPopupLevelGreaterThanOrEqual(value) {
        const number = this._stringToNumber(value);
        return {
            required: ['depth'],
            properties: {
                depth: {type: 'number', minimum: number}
            }
        };
    }

    // url schema creation functions

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaUrlMatchDomain(value) {
        const oneOf = [];
        for (let domain of this._split(value)) {
            if (domain.length === 0) { continue; }
            domain = domain.toLowerCase();
            oneOf.push({const: domain});
        }
        return {
            required: ['domain'],
            properties: {
                domain: {oneOf}
            }
        };
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaUrlMatchRegExp(value) {
        return {
            required: ['url'],
            properties: {
                url: {type: 'string', pattern: value, patternFlags: 'i'}
            }
        };
    }

    // modifierKeys schema creation functions

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaModifierKeysAre(value) {
        return this._createSchemaArrayCheck('modifierKeys', value, true, false);
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaModifierKeysAreNot(value) {
        return {
            not: {
                anyOf: [this._createSchemaArrayCheck('modifierKeys', value, true, false)]
            }
        };
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaModifierKeysInclude(value) {
        return this._createSchemaArrayCheck('modifierKeys', value, false, false);
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaModifierKeysNotInclude(value) {
        return this._createSchemaArrayCheck('modifierKeys', value, false, true);
    }

    // modifierKeys schema creation functions

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaFlagsAre(value) {
        return this._createSchemaArrayCheck('flags', value, true, false);
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaFlagsAreNot(value) {
        return {
            not: {
                anyOf: [this._createSchemaArrayCheck('flags', value, true, false)]
            }
        };
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaFlagsInclude(value) {
        return this._createSchemaArrayCheck('flags', value, false, false);
    }

    /**
     * @param {string} value
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaFlagsNotInclude(value) {
        return this._createSchemaArrayCheck('flags', value, false, true);
    }

    // Generic

    /**
     * @param {string} key
     * @param {string} value
     * @param {boolean} exact
     * @param {boolean} none
     * @returns {import('ext/json-schema').Schema}
     */
    _createSchemaArrayCheck(key, value, exact, none) {
        /** @type {import('ext/json-schema').Schema[]} */
        const containsList = [];
        for (const item of this._split(value)) {
            if (item.length === 0) { continue; }
            containsList.push({
                contains: {
                    const: item
                }
            });
        }
        const containsListCount = containsList.length;
        /** @type {import('ext/json-schema').Schema} */
        const schema = {
            type: 'array'
        };
        if (exact) {
            schema.maxItems = containsListCount;
        }
        if (none) {
            if (containsListCount > 0) {
                schema.not = {anyOf: containsList};
            }
        } else {
            schema.minItems = containsListCount;
            if (containsListCount > 0) {
                schema.allOf = containsList;
            }
        }
        return {
            required: [key],
            properties: {
                [key]: schema
            }
        };
    }
}
