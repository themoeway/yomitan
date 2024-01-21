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

import {clone} from '../core/utilities.js';
import {CacheMap} from '../general/cache-map.js';

export class JsonSchemaError extends Error {
    /**
     * @param {string} message
     * @param {import('ext/json-schema').ValueStackItem[]} valueStack
     * @param {import('ext/json-schema').SchemaStackItem[]} schemaStack
     */
    constructor(message, valueStack, schemaStack) {
        super(message);
        /** @type {import('ext/json-schema').ValueStackItem[]} */
        this._valueStack = valueStack;
        /** @type {import('ext/json-schema').SchemaStackItem[]} */
        this._schemaStack = schemaStack;
    }

    /** @type {unknown|undefined} */
    get value() { return this._valueStack.length > 0 ? this._valueStack[this._valueStack.length - 1].value : void 0; }

    /** @type {import('ext/json-schema').Schema|import('ext/json-schema').Schema[]|undefined} */
    get schema() { return this._schemaStack.length > 0 ? this._schemaStack[this._schemaStack.length - 1].schema : void 0; }

    /** @type {import('ext/json-schema').ValueStackItem[]} */
    get valueStack() { return this._valueStack; }

    /** @type {import('ext/json-schema').SchemaStackItem[]} */
    get schemaStack() { return this._schemaStack; }
}

export class JsonSchema {
    /**
     * @param {import('ext/json-schema').Schema} schema
     * @param {import('ext/json-schema').Schema} [rootSchema]
     */
    constructor(schema, rootSchema) {
        /** @type {import('ext/json-schema').Schema} */
        this._startSchema = schema;
        /** @type {import('ext/json-schema').Schema} */
        this._rootSchema = typeof rootSchema !== 'undefined' ? rootSchema : schema;
        /** @type {?CacheMap<string, RegExp>} */
        this._regexCache = null;
        /** @type {?Map<string, {schema: import('ext/json-schema').Schema, stack: import('ext/json-schema').SchemaStackItem[]}>} */
        this._refCache = null;
        /** @type {import('ext/json-schema').ValueStackItem[]} */
        this._valueStack = [];
        /** @type {import('ext/json-schema').SchemaStackItem[]} */
        this._schemaStack = [];
        /** @type {?(jsonSchema: JsonSchema) => void} */
        this._progress = null;
        /** @type {number} */
        this._progressCounter = 0;
        /** @type {number} */
        this._progressInterval = 1;
    }

    /** @type {import('ext/json-schema').Schema} */
    get schema() {
        return this._startSchema;
    }

    /** @type {import('ext/json-schema').Schema} */
    get rootSchema() {
        return this._rootSchema;
    }

    /** @type {?(jsonSchema: JsonSchema) => void} */
    get progress() {
        return this._progress;
    }

    set progress(value) {
        this._progress = value;
    }

    /** @type {number} */
    get progressInterval() {
        return this._progressInterval;
    }

    set progressInterval(value) {
        this._progressInterval = value;
    }

    /**
     * @param {import('ext/json-schema').Value} value
     * @returns {import('ext/json-schema').Value}
     */
    createProxy(value) {
        return (
            typeof value === 'object' && value !== null ?
            new Proxy(value, new JsonSchemaProxyHandler(this)) :
            value
        );
    }

    /**
     * @param {unknown} value
     * @returns {boolean}
     */
    isValid(value) {
        try {
            this.validate(value);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * @param {unknown} value
     */
    validate(value) {
        const schema = this._startSchema;
        this._schemaPush(schema, null);
        this._valuePush(value, null);
        try {
            this._validate(schema, value);
        } finally {
            this._valuePop();
            this._schemaPop();
        }
    }

    /**
     * @param {unknown} [value]
     * @returns {import('ext/json-schema').Value}
     */
    getValidValueOrDefault(value) {
        const schema = this._startSchema;
        return this._getValidValueOrDefault(schema, null, value, [{schema, path: null}]);
    }

    /**
     * @param {string} property
     * @returns {?JsonSchema}
     */
    getObjectPropertySchema(property) {
        const schema = this._startSchema;
        const {schema: schema2, stack} = this._getResolvedSchemaInfo(schema, [{schema, path: null}]);
        this._schemaPushMultiple(stack);
        try {
            const {schema: propertySchema} = this._getObjectPropertySchemaInfo(schema2, property);
            return propertySchema !== false ? new JsonSchema(propertySchema, this._rootSchema) : null;
        } finally {
            this._schemaPopMultiple(stack.length);
        }
    }

    /**
     * @param {number} index
     * @returns {?JsonSchema}
     */
    getArrayItemSchema(index) {
        const schema = this._startSchema;
        const {schema: schema2, stack} = this._getResolvedSchemaInfo(schema, [{schema, path: null}]);
        this._schemaPushMultiple(stack);
        try {
            const {schema: itemSchema} = this._getArrayItemSchemaInfo(schema2, index);
            return itemSchema !== false ? new JsonSchema(itemSchema, this._rootSchema) : null;
        } finally {
            this._schemaPopMultiple(stack.length);
        }
    }

    /**
     * @param {string} property
     * @returns {boolean}
     */
    isObjectPropertyRequired(property) {
        const schema = this._startSchema;
        if (typeof schema === 'boolean') { return false; }
        const {required} = schema;
        return Array.isArray(required) && required.includes(property);
    }

    // Internal state functions for error construction and progress callback

    /**
     * @returns {import('ext/json-schema').ValueStackItem[]}
     */
    getValueStack() {
        const result = [];
        for (const {value, path} of this._valueStack) {
            result.push({value, path});
        }
        return result;
    }

    /**
     * @returns {import('ext/json-schema').SchemaStackItem[]}
     */
    getSchemaStack() {
        const result = [];
        for (const {schema, path} of this._schemaStack) {
            result.push({schema, path});
        }
        return result;
    }

    /**
     * @returns {number}
     */
    getValueStackLength() {
        return this._valueStack.length - 1;
    }

    /**
     * @param {number} index
     * @returns {import('ext/json-schema').ValueStackItem}
     */
    getValueStackItem(index) {
        const {value, path} = this._valueStack[index + 1];
        return {value, path};
    }

    /**
     * @returns {number}
     */
    getSchemaStackLength() {
        return this._schemaStack.length - 1;
    }

    /**
     * @param {number} index
     * @returns {import('ext/json-schema').SchemaStackItem}
     */
    getSchemaStackItem(index) {
        const {schema, path} = this._schemaStack[index + 1];
        return {schema, path};
    }

    /**
     * @template [T=unknown]
     * @param {T} value
     * @returns {T}
     */
    static clone(value) {
        return clone(value);
    }

    // Stack

    /**
     * @param {unknown} value
     * @param {string|number|null} path
     */
    _valuePush(value, path) {
        this._valueStack.push({value, path});
    }

    /**
     * @returns {void}
     */
    _valuePop() {
        this._valueStack.pop();
    }

    /**
     * @param {import('ext/json-schema').Schema|import('ext/json-schema').Schema[]} schema
     * @param {string|number|null} path
     */
    _schemaPush(schema, path) {
        this._schemaStack.push({schema, path});
    }

    /**
     * @param {import('ext/json-schema').SchemaStackItem[]} items
     */
    _schemaPushMultiple(items) {
        this._schemaStack.push(...items);
    }

    /**
     * @returns {void}
     */
    _schemaPop() {
        this._schemaStack.pop();
    }

    /**
     * @param {number} count
     */
    _schemaPopMultiple(count) {
        for (let i = 0; i < count; ++i) {
            this._schemaStack.pop();
        }
    }

    // Private

    /**
     * @param {string} message
     * @returns {JsonSchemaError}
     */
    _createError(message) {
        const valueStack = this.getValueStack();
        const schemaStack = this.getSchemaStack();
        return new JsonSchemaError(message, valueStack, schemaStack);
    }

    /**
     * @param {string} pattern
     * @param {string} flags
     * @returns {RegExp}
     */
    _getRegex(pattern, flags) {
        if (this._regexCache === null) {
            this._regexCache = new CacheMap(100);
        }

        const key = `${flags}:${pattern}`;
        let regex = this._regexCache.get(key);
        if (typeof regex === 'undefined') {
            regex = new RegExp(pattern, flags);
            this._regexCache.set(key, regex);
        }
        return regex;
    }

    /**
     * @param {import('ext/json-schema').Schema} schema
     * @param {string} property
     * @returns {{schema: import('ext/json-schema').Schema, stack: import('ext/json-schema').SchemaStackItem[]}}
     */
    _getObjectPropertySchemaInfo(schema, property) {
        if (typeof schema === 'boolean') {
            return {schema, stack: [{schema, path: null}]};
        }
        const {properties} = schema;
        if (typeof properties !== 'undefined' && Object.prototype.hasOwnProperty.call(properties, property)) {
            const propertySchema = properties[property];
            if (typeof propertySchema !== 'undefined') {
                return {
                    schema: propertySchema,
                    stack: [
                        {schema: properties, path: 'properties'},
                        {schema: propertySchema, path: property}
                    ]
                };
            }
        }
        return this._getOptionalSchemaInfo(schema.additionalProperties, 'additionalProperties');
    }

    /**
     * @param {import('ext/json-schema').Schema} schema
     * @param {number} index
     * @returns {{schema: import('ext/json-schema').Schema, stack: import('ext/json-schema').SchemaStackItem[]}}
     */
    _getArrayItemSchemaInfo(schema, index) {
        if (typeof schema === 'boolean') {
            return {schema, stack: [{schema, path: null}]};
        }
        const {prefixItems} = schema;
        if (typeof prefixItems !== 'undefined') {
            if (index >= 0 && index < prefixItems.length) {
                const itemSchema = prefixItems[index];
                if (typeof itemSchema !== 'undefined') {
                    return {
                        schema: itemSchema,
                        stack: [
                            {schema: prefixItems, path: 'prefixItems'},
                            {schema: itemSchema, path: index}
                        ]
                    };
                }
            }
        }
        const {items} = schema;
        if (typeof items !== 'undefined') {
            if (Array.isArray(items)) { // Legacy schema format
                if (index >= 0 && index < items.length) {
                    const itemSchema = items[index];
                    if (typeof itemSchema !== 'undefined') {
                        return {
                            schema: itemSchema,
                            stack: [
                                {schema: items, path: 'items'},
                                {schema: itemSchema, path: index}
                            ]
                        };
                    }
                }
            } else {
                return {
                    schema: items,
                    stack: [{schema: items, path: 'items'}]
                };
            }
        }
        return this._getOptionalSchemaInfo(schema.additionalItems, 'additionalItems');
    }

    /**
     * @param {import('ext/json-schema').Schema|undefined} schema
     * @param {string|number|null} path
     * @returns {{schema: import('ext/json-schema').Schema, stack: import('ext/json-schema').SchemaStackItem[]}}
     */
    _getOptionalSchemaInfo(schema, path) {
        switch (typeof schema) {
            case 'boolean':
            case 'object':
                break;
            default:
                schema = true;
                path = null;
                break;
        }
        return {schema, stack: [{schema, path}]};
    }

    /**
     * @param {unknown} value
     * @returns {?import('ext/json-schema').Type}
     * @throws {Error}
     */
    _getValueType(value) {
        const type = typeof value;
        switch (type) {
            case 'object':
                if (value === null) { return 'null'; }
                if (Array.isArray(value)) { return 'array'; }
                return 'object';
            case 'string':
            case 'number':
            case 'boolean':
                return type;
            default:
                return null;
        }
    }

    /**
     * @param {unknown} value
     * @param {?import('ext/json-schema').Type} type
     * @param {import('ext/json-schema').Type|import('ext/json-schema').Type[]|undefined} schemaTypes
     * @returns {boolean}
     */
    _isValueTypeAny(value, type, schemaTypes) {
        if (typeof schemaTypes === 'string') {
            return this._isValueType(value, type, schemaTypes);
        } else if (Array.isArray(schemaTypes)) {
            for (const schemaType of schemaTypes) {
                if (this._isValueType(value, type, schemaType)) {
                    return true;
                }
            }
            return false;
        }
        return true;
    }

    /**
     * @param {unknown} value
     * @param {?import('ext/json-schema').Type} type
     * @param {import('ext/json-schema').Type} schemaType
     * @returns {boolean}
     */
    _isValueType(value, type, schemaType) {
        return (
            type === schemaType ||
            (schemaType === 'integer' && typeof value === 'number' && Math.floor(value) === value)
        );
    }

    /**
     * @param {unknown} value1
     * @param {import('ext/json-schema').Value[]} valueList
     * @returns {boolean}
     */
    _valuesAreEqualAny(value1, valueList) {
        for (const value2 of valueList) {
            if (this._valuesAreEqual(value1, value2)) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param {unknown} value1
     * @param {import('ext/json-schema').Value} value2
     * @returns {boolean}
     */
    _valuesAreEqual(value1, value2) {
        return value1 === value2;
    }

    /**
     * @param {import('ext/json-schema').Schema} schema
     * @param {import('ext/json-schema').SchemaStackItem[]} stack
     * @returns {{schema: import('ext/json-schema').Schema, stack: import('ext/json-schema').SchemaStackItem[]}}
     */
    _getResolvedSchemaInfo(schema, stack) {
        if (typeof schema !== 'boolean') {
            const ref = schema.$ref;
            if (typeof ref === 'string') {
                const {schema: schema2, stack: stack2} = this._getReference(ref);
                return {
                    schema: schema2,
                    stack: [...stack, ...stack2]
                };
            }
        }
        return {schema, stack};
    }

    /**
     * @param {string} ref
     * @returns {{schema: import('ext/json-schema').Schema, stack: import('ext/json-schema').SchemaStackItem[]}}
     * @throws {Error}
     */
    _getReference(ref) {
        if (!ref.startsWith('#/')) {
            throw this._createError(`Unsupported reference path: ${ref}`);
        }

        /** @type {{schema: import('ext/json-schema').Schema, stack: import('ext/json-schema').SchemaStackItem[]}|undefined} */
        let info;
        if (this._refCache !== null) {
            info = this._refCache.get(ref);
        } else {
            this._refCache = new Map();
        }

        if (typeof info === 'undefined') {
            info = this._getReferenceUncached(ref);
            this._refCache.set(ref, info);
        }

        info.stack = this._copySchemaStack(info.stack);
        return info;
    }

    /**
     * @param {string} ref
     * @returns {{schema: import('ext/json-schema').Schema, stack: import('ext/json-schema').SchemaStackItem[]}}
     * @throws {Error}
     */
    _getReferenceUncached(ref) {
        /** @type {Set<string>} */
        const visited = new Set();
        /** @type {import('ext/json-schema').SchemaStackItem[]} */
        const stack = [];
        while (true) {
            if (visited.has(ref)) {
                throw this._createError(`Recursive reference: ${ref}`);
            }
            visited.add(ref);

            const pathParts = ref.substring(2).split('/');
            let schema = this._rootSchema;
            stack.push({schema, path: null});
            for (const pathPart of pathParts) {
                if (!(typeof schema === 'object' && schema !== null && Object.prototype.hasOwnProperty.call(schema, pathPart))) {
                    throw this._createError(`Invalid reference: ${ref}`);
                }
                const schemaNext = /** @type {import('core').UnknownObject} */ (schema)[pathPart];
                if (!(typeof schemaNext === 'boolean' || (typeof schemaNext === 'object' && schemaNext !== null))) {
                    throw this._createError(`Invalid reference: ${ref}`);
                }
                schema = schemaNext;
                stack.push({schema, path: pathPart});
            }
            if (Array.isArray(schema)) {
                throw this._createError(`Invalid reference: ${ref}`);
            }

            const refNext = typeof schema === 'object' && schema !== null ? schema.$ref : void 0;
            if (typeof refNext !== 'string') {
                return {schema, stack};
            }
            ref = refNext;
        }
    }

    /**
     * @param {import('ext/json-schema').SchemaStackItem[]} schemaStack
     * @returns {import('ext/json-schema').SchemaStackItem[]}
     */
    _copySchemaStack(schemaStack) {
        /** @type {import('ext/json-schema').SchemaStackItem[]} */
        const results = [];
        for (const {schema, path} of schemaStack) {
            results.push({schema, path});
        }
        return results;
    }

    // Validation

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {unknown} value
     * @returns {boolean}
     */
    _isValidCurrent(schema, value) {
        try {
            this._validate(schema, value);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * @param {import('ext/json-schema').Schema} schema
     * @param {unknown} value
     */
    _validate(schema, value) {
        if (this._progress !== null) {
            const counter = (this._progressCounter + 1) % this._progressInterval;
            this._progressCounter = counter;
            if (counter === 0) { this._progress(this); }
        }

        const {schema: schema2, stack} = this._getResolvedSchemaInfo(schema, []);
        this._schemaPushMultiple(stack);
        try {
            this._validateInner(schema2, value);
        } finally {
            this._schemaPopMultiple(stack.length);
        }
    }

    /**
     * @param {import('ext/json-schema').Schema} schema
     * @param {unknown} value
     * @throws {Error}
     */
    _validateInner(schema, value) {
        if (schema === true) { return; }
        if (schema === false) { throw this._createError('False schema'); }
        this._validateSingleSchema(schema, value);
        this._validateConditional(schema, value);
        this._validateAllOf(schema, value);
        this._validateAnyOf(schema, value);
        this._validateOneOf(schema, value);
        this._validateNot(schema, value);
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {unknown} value
     */
    _validateConditional(schema, value) {
        const ifSchema = schema.if;
        if (typeof ifSchema === 'undefined') { return; }

        let okay = true;
        this._schemaPush(ifSchema, 'if');
        try {
            this._validate(ifSchema, value);
        } catch (e) {
            okay = false;
        } finally {
            this._schemaPop();
        }

        const nextSchema = okay ? schema.then : schema.else;
        if (typeof nextSchema === 'undefined') { return; }

        this._schemaPush(nextSchema, okay ? 'then' : 'else');
        try {
            this._validate(nextSchema, value);
        } finally {
            this._schemaPop();
        }
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {unknown} value
     */
    _validateAllOf(schema, value) {
        const subSchemas = schema.allOf;
        if (!Array.isArray(subSchemas)) { return; }

        this._schemaPush(subSchemas, 'allOf');
        try {
            for (let i = 0, ii = subSchemas.length; i < ii; ++i) {
                const subSchema = subSchemas[i];
                this._schemaPush(subSchema, i);
                try {
                    this._validate(subSchema, value);
                } finally {
                    this._schemaPop();
                }
            }
        } finally {
            this._schemaPop();
        }
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {unknown} value
     */
    _validateAnyOf(schema, value) {
        const subSchemas = schema.anyOf;
        if (!Array.isArray(subSchemas)) { return; }

        this._schemaPush(subSchemas, 'anyOf');
        try {
            for (let i = 0, ii = subSchemas.length; i < ii; ++i) {
                const subSchema = subSchemas[i];
                this._schemaPush(subSchema, i);
                try {
                    this._validate(subSchema, value);
                    return;
                } catch (e) {
                    // NOP
                } finally {
                    this._schemaPop();
                }
            }

            throw this._createError('0 anyOf schemas matched');
        } finally {
            this._schemaPop();
        }
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {unknown} value
     */
    _validateOneOf(schema, value) {
        const subSchemas = schema.oneOf;
        if (!Array.isArray(subSchemas)) { return; }

        this._schemaPush(subSchemas, 'oneOf');
        try {
            let count = 0;
            for (let i = 0, ii = subSchemas.length; i < ii; ++i) {
                const subSchema = subSchemas[i];
                this._schemaPush(subSchema, i);
                try {
                    this._validate(subSchema, value);
                    ++count;
                } catch (e) {
                    // NOP
                } finally {
                    this._schemaPop();
                }
            }

            if (count !== 1) {
                throw this._createError(`${count} oneOf schemas matched`);
            }
        } finally {
            this._schemaPop();
        }
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {unknown} value
     * @throws {Error}
     */
    _validateNot(schema, value) {
        const notSchema = schema.not;
        if (typeof notSchema === 'undefined') { return; }

        if (Array.isArray(notSchema)) {
            throw this._createError('not schema is an array');
        }

        this._schemaPush(notSchema, 'not');
        try {
            this._validate(notSchema, value);
        } catch (e) {
            return;
        } finally {
            this._schemaPop();
        }
        throw this._createError('not schema matched');
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {unknown} value
     * @throws {Error}
     */
    _validateSingleSchema(schema, value) {
        const {type: schemaType, const: schemaConst, enum: schemaEnum} = schema;
        const type = this._getValueType(value);
        if (!this._isValueTypeAny(value, type, schemaType)) {
            throw this._createError(`Value type ${type} does not match schema type ${schemaType}`);
        }

        if (typeof schemaConst !== 'undefined' && !this._valuesAreEqual(value, schemaConst)) {
            throw this._createError('Invalid constant value');
        }

        if (Array.isArray(schemaEnum) && !this._valuesAreEqualAny(value, schemaEnum)) {
            throw this._createError('Invalid enum value');
        }

        switch (type) {
            case 'number':
                this._validateNumber(schema, /** @type {number} */ (value));
                break;
            case 'string':
                this._validateString(schema, /** @type {string} */ (value));
                break;
            case 'array':
                this._validateArray(schema, /** @type {import('ext/json-schema').Value[]} */ (value));
                break;
            case 'object':
                this._validateObject(schema, /** @type {import('ext/json-schema').ValueObject} */ (value));
                break;
        }
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {number} value
     * @throws {Error}
     */
    _validateNumber(schema, value) {
        const {multipleOf, minimum, exclusiveMinimum, maximum, exclusiveMaximum} = schema;
        if (typeof multipleOf === 'number' && Math.floor(value / multipleOf) * multipleOf !== value) {
            throw this._createError(`Number is not a multiple of ${multipleOf}`);
        }

        if (typeof minimum === 'number' && value < minimum) {
            throw this._createError(`Number is less than ${minimum}`);
        }

        if (typeof exclusiveMinimum === 'number' && value <= exclusiveMinimum) {
            throw this._createError(`Number is less than or equal to ${exclusiveMinimum}`);
        }

        if (typeof maximum === 'number' && value > maximum) {
            throw this._createError(`Number is greater than ${maximum}`);
        }

        if (typeof exclusiveMaximum === 'number' && value >= exclusiveMaximum) {
            throw this._createError(`Number is greater than or equal to ${exclusiveMaximum}`);
        }
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {string} value
     * @throws {Error}
     */
    _validateString(schema, value) {
        const {minLength, maxLength, pattern} = schema;
        if (typeof minLength === 'number' && value.length < minLength) {
            throw this._createError('String length too short');
        }

        if (typeof maxLength === 'number' && value.length > maxLength) {
            throw this._createError('String length too long');
        }

        if (typeof pattern === 'string') {
            let {patternFlags} = schema;
            if (typeof patternFlags !== 'string') { patternFlags = ''; }

            let regex;
            try {
                regex = this._getRegex(pattern, patternFlags);
            } catch (e) {
                throw this._createError(`Pattern is invalid (${e instanceof Error ? e.message : `${e}`})`);
            }

            if (!regex.test(value)) {
                throw this._createError('Pattern match failed');
            }
        }
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {unknown[]} value
     * @throws {Error}
     */
    _validateArray(schema, value) {
        const {minItems, maxItems} = schema;
        const {length} = value;

        if (typeof minItems === 'number' && length < minItems) {
            throw this._createError('Array length too short');
        }

        if (typeof maxItems === 'number' && length > maxItems) {
            throw this._createError('Array length too long');
        }

        this._validateArrayContains(schema, value);

        for (let i = 0; i < length; ++i) {
            const {schema: itemSchema, stack} = this._getArrayItemSchemaInfo(schema, i);
            if (itemSchema === false) {
                throw this._createError(`No schema found for array[${i}]`);
            }

            const propertyValue = value[i];

            this._schemaPushMultiple(stack);
            this._valuePush(propertyValue, i);
            try {
                this._validate(itemSchema, propertyValue);
            } finally {
                this._valuePop();
                this._schemaPopMultiple(stack.length);
            }
        }
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {unknown[]} value
     * @throws {Error}
     */
    _validateArrayContains(schema, value) {
        const containsSchema = schema.contains;
        if (typeof containsSchema === 'undefined') { return; }

        this._schemaPush(containsSchema, 'contains');
        try {
            for (let i = 0, ii = value.length; i < ii; ++i) {
                const propertyValue = value[i];
                this._valuePush(propertyValue, i);
                try {
                    this._validate(containsSchema, propertyValue);
                    return;
                } catch (e) {
                    // NOP
                } finally {
                    this._valuePop();
                }
            }
            throw this._createError('contains schema didn\'t match');
        } finally {
            this._schemaPop();
        }
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {import('ext/json-schema').ValueObject} value
     * @throws {Error}
     */
    _validateObject(schema, value) {
        const {required, minProperties, maxProperties} = schema;
        const properties = Object.getOwnPropertyNames(value);
        const {length} = properties;

        if (Array.isArray(required)) {
            for (const property of required) {
                if (!Object.prototype.hasOwnProperty.call(value, property)) {
                    throw this._createError(`Missing property ${property}`);
                }
            }
        }

        if (typeof minProperties === 'number' && length < minProperties) {
            throw this._createError('Not enough object properties');
        }

        if (typeof maxProperties === 'number' && length > maxProperties) {
            throw this._createError('Too many object properties');
        }

        for (let i = 0; i < length; ++i) {
            const property = properties[i];
            const {schema: propertySchema, stack} = this._getObjectPropertySchemaInfo(schema, property);
            if (propertySchema === false) {
                throw this._createError(`No schema found for ${property}`);
            }

            const propertyValue = value[property];

            this._schemaPushMultiple(stack);
            this._valuePush(propertyValue, property);
            try {
                this._validate(propertySchema, propertyValue);
            } finally {
                this._valuePop();
                this._schemaPopMultiple(stack.length);
            }
        }
    }

    // Creation

    /**
     * @param {import('ext/json-schema').Type|import('ext/json-schema').Type[]|undefined} type
     * @returns {import('ext/json-schema').Value}
     */
    _getDefaultTypeValue(type) {
        if (Array.isArray(type)) { type = type[0]; }
        if (typeof type === 'string') {
            switch (type) {
                case 'null':
                    return null;
                case 'boolean':
                    return false;
                case 'number':
                case 'integer':
                    return 0;
                case 'string':
                    return '';
                case 'array':
                    return [];
                case 'object':
                    return {};
            }
        }
        return null;
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @returns {import('ext/json-schema').Value}
     */
    _getDefaultSchemaValue(schema) {
        const {type: schemaType, default: schemaDefault} = schema;
        return (
            typeof schemaDefault !== 'undefined' &&
            this._isValueTypeAny(schemaDefault, this._getValueType(schemaDefault), schemaType) ?
            JsonSchema.clone(schemaDefault) :
            this._getDefaultTypeValue(schemaType)
        );
    }

    /**
     * @param {import('ext/json-schema').Schema} schema
     * @param {string|number|null} path
     * @param {unknown} value
     * @param {import('ext/json-schema').SchemaStackItem[]} stack
     * @returns {import('ext/json-schema').Value}
     */
    _getValidValueOrDefault(schema, path, value, stack) {
        ({schema, stack} = this._getResolvedSchemaInfo(schema, stack));
        this._schemaPushMultiple(stack);
        this._valuePush(value, path);
        try {
            return this._getValidValueOrDefaultInner(schema, value);
        } finally {
            this._valuePop();
            this._schemaPopMultiple(stack.length);
        }
    }

    /**
     * @param {import('ext/json-schema').Schema} schema
     * @param {unknown} value
     * @returns {import('ext/json-schema').Value}
     */
    _getValidValueOrDefaultInner(schema, value) {
        let type = this._getValueType(value);
        if (typeof schema === 'boolean') {
            return type !== null ? /** @type {import('ext/json-schema').ValueObject} */ (value) : null;
        }
        if (typeof value === 'undefined' || !this._isValueTypeAny(value, type, schema.type)) {
            value = this._getDefaultSchemaValue(schema);
            type = this._getValueType(value);
        }

        switch (type) {
            case 'object':
                return this._populateObjectDefaults(schema, /** @type {import('ext/json-schema').ValueObject} */ (value));
            case 'array':
                return this._populateArrayDefaults(schema, /** @type {import('ext/json-schema').Value[]} */ (value));
            default:
                if (!this._isValidCurrent(schema, value)) {
                    const schemaDefault = this._getDefaultSchemaValue(schema);
                    if (this._isValidCurrent(schema, schemaDefault)) {
                        return schemaDefault;
                    }
                }
                break;
        }

        return /** @type {import('ext/json-schema').ValueObject} */ (value);
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {import('ext/json-schema').ValueObject} value
     * @returns {import('ext/json-schema').ValueObject}
     */
    _populateObjectDefaults(schema, value) {
        const properties = new Set(Object.getOwnPropertyNames(value));

        const {required} = schema;
        if (Array.isArray(required)) {
            for (const property of required) {
                properties.delete(property);
                const {schema: propertySchema, stack} = this._getObjectPropertySchemaInfo(schema, property);
                if (propertySchema === false) { continue; }
                const propertyValue = Object.prototype.hasOwnProperty.call(value, property) ? value[property] : void 0;
                value[property] = this._getValidValueOrDefault(propertySchema, property, propertyValue, stack);
            }
        }

        for (const property of properties) {
            const {schema: propertySchema, stack} = this._getObjectPropertySchemaInfo(schema, property);
            if (propertySchema === false) {
                Reflect.deleteProperty(value, property);
            } else {
                value[property] = this._getValidValueOrDefault(propertySchema, property, value[property], stack);
            }
        }

        return value;
    }

    /**
     * @param {import('ext/json-schema').SchemaObject} schema
     * @param {import('ext/json-schema').Value[]} value
     * @returns {import('ext/json-schema').Value[]}
     */
    _populateArrayDefaults(schema, value) {
        for (let i = 0, ii = value.length; i < ii; ++i) {
            const {schema: itemSchema, stack} = this._getArrayItemSchemaInfo(schema, i);
            if (itemSchema === false) { continue; }
            const propertyValue = value[i];
            value[i] = this._getValidValueOrDefault(itemSchema, i, propertyValue, stack);
        }

        const {minItems, maxItems} = schema;
        if (typeof minItems === 'number' && value.length < minItems) {
            for (let i = value.length; i < minItems; ++i) {
                const {schema: itemSchema, stack} = this._getArrayItemSchemaInfo(schema, i);
                if (itemSchema === false) { break; }
                const item = this._getValidValueOrDefault(itemSchema, i, void 0, stack);
                value.push(item);
            }
        }

        if (typeof maxItems === 'number' && value.length > maxItems) {
            value.splice(maxItems, value.length - maxItems);
        }

        return value;
    }
}

/**
 * @implements {ProxyHandler<import('ext/json-schema').ValueObjectOrArray>}
 */
class JsonSchemaProxyHandler {
    /**
     * @param {JsonSchema} schemaValidator
     */
    constructor(schemaValidator) {
        /** @type {JsonSchema} */
        this._schemaValidator = schemaValidator;
        /** @type {RegExp} */
        this._numberPattern = /^(?:0|[1-9]\d*)$/;
    }

    /**
     * @param {import('ext/json-schema').ValueObjectOrArray} target
     * @returns {?import('core').UnknownObject}
     */
    getPrototypeOf(target) {
        return Object.getPrototypeOf(target);
    }

    /**
     * @type {(target: import('ext/json-schema').ValueObjectOrArray, newPrototype: ?unknown) => boolean}
     */
    setPrototypeOf() {
        throw new Error('setPrototypeOf not supported');
    }

    /**
     * @param {import('ext/json-schema').ValueObjectOrArray} target
     * @returns {boolean}
     */
    isExtensible(target) {
        return Object.isExtensible(target);
    }

    /**
     * @param {import('ext/json-schema').ValueObjectOrArray} target
     * @returns {boolean}
     */
    preventExtensions(target) {
        Object.preventExtensions(target);
        return true;
    }

    /**
     * @param {import('ext/json-schema').ValueObjectOrArray} target
     * @param {string|symbol} property
     * @returns {PropertyDescriptor|undefined}
     */
    getOwnPropertyDescriptor(target, property) {
        return Object.getOwnPropertyDescriptor(target, property);
    }

    /**
     * @type {(target: import('ext/json-schema').ValueObjectOrArray, property: string|symbol, attributes: PropertyDescriptor) => boolean}
     */
    defineProperty() {
        throw new Error('defineProperty not supported');
    }

    /**
     * @param {import('ext/json-schema').ValueObjectOrArray} target
     * @param {string|symbol} property
     * @returns {boolean}
     */
    has(target, property) {
        return property in target;
    }

    /**
     * @param {import('ext/json-schema').ValueObjectOrArray} target
     * @param {string|symbol} property
     * @param {import('core').SafeAny} _receiver
     * @returns {import('core').SafeAny}
     */
    get(target, property, _receiver) {
        if (typeof property === 'symbol') { return /** @type {import('core').UnknownObject} */ (target)[property]; }

        let propertySchema;
        if (Array.isArray(target)) {
            const index = this._getArrayIndex(property);
            if (index === null) {
                // Note: this does not currently wrap mutating functions like push, pop, shift, unshift, splice
                return /** @type {import('core').SafeAny} */ (target)[property];
            }
            property = `${index}`;
            propertySchema = this._schemaValidator.getArrayItemSchema(index);
        } else {
            propertySchema = this._schemaValidator.getObjectPropertySchema(property);
        }

        if (propertySchema === null) { return void 0; }

        const value = /** @type {import('core').UnknownObject} */ (target)[property];
        return value !== null && typeof value === 'object' ? propertySchema.createProxy(/** @type {import('ext/json-schema').Value} */ (value)) : value;
    }

    /**
     * @param {import('ext/json-schema').ValueObjectOrArray} target
     * @param {string|number|symbol} property
     * @param {import('core').SafeAny} value
     * @returns {boolean}
     * @throws {Error}
     */
    set(target, property, value) {
        if (typeof property === 'symbol') { throw new Error(`Cannot assign symbol property ${typeof property === 'symbol' ? '<symbol>' : property}`); }

        let propertySchema;
        if (Array.isArray(target)) {
            const index = this._getArrayIndex(property);
            if (index === null) {
                /** @type {import('core').SafeAny} */ (target)[property] = value;
                return true;
            }
            if (index > target.length) { throw new Error('Array index out of range'); }
            property = index;
            propertySchema = this._schemaValidator.getArrayItemSchema(property);
        } else {
            if (typeof property !== 'string') {
                property = `${property}`;
            }
            propertySchema = this._schemaValidator.getObjectPropertySchema(property);
        }

        if (propertySchema === null) { throw new Error(`Property ${property} not supported`); }

        value = JsonSchema.clone(value);
        propertySchema.validate(value);

        /** @type {import('core').UnknownObject} */ (target)[property] = value;
        return true;
    }

    /**
     * @param {import('ext/json-schema').ValueObjectOrArray} target
     * @param {string|symbol} property
     * @returns {boolean}
     * @throws {Error}
     */
    deleteProperty(target, property) {
        const required = (
            (typeof target === 'object' && target !== null) ?
            (!Array.isArray(target) && typeof property === 'string' && this._schemaValidator.isObjectPropertyRequired(property)) :
            true
        );
        if (required) {
            throw new Error(`${typeof property === 'symbol' ? '<symbol>' : property} cannot be deleted`);
        }
        return Reflect.deleteProperty(target, property);
    }

    /**
     * @param {import('ext/json-schema').ValueObjectOrArray} target
     * @returns {ArrayLike<string|symbol>}
     */
    ownKeys(target) {
        return Reflect.ownKeys(target);
    }

    /**
     * @type {(target: import('ext/json-schema').ValueObjectOrArray, thisArg: import('core').SafeAny, argArray: import('core').SafeAny[]) => import('core').SafeAny}
     */
    apply() {
        throw new Error('apply not supported');
    }

    /**
     * @type {(target: import('ext/json-schema').ValueObjectOrArray, argArray: import('core').SafeAny[], newTarget: import('core').SafeFunction) => import('ext/json-schema').ValueObjectOrArray}
     */
    construct() {
        throw new Error('construct not supported');
    }

    // Private

    /**
     * @param {string|symbol|number} property
     * @returns {?number}
     */
    _getArrayIndex(property) {
        switch (typeof property) {
            case 'string':
                if (this._numberPattern.test(property)) {
                    return Number.parseInt(property, 10);
                }
                break;
            case 'number':
                if (Math.floor(property) === property && property >= 0) {
                    return property;
                }
                break;
        }
        return null;
    }
}
