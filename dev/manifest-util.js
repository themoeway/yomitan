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

import childProcess from 'child_process';
import fs from 'fs';
import {fileURLToPath} from 'node:url';
import path from 'path';
import {parseJson} from './json.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @template [T=unknown]
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
    return parseJson(JSON.stringify(value));
}


export class ManifestUtil {
    constructor() {
        const fileName = path.join(dirname, 'data', 'manifest-variants.json');
        const {manifest, variants, defaultVariant} = /** @type {import('dev/manifest').ManifestConfig} */ (parseJson(fs.readFileSync(fileName, {encoding: 'utf8'})));
        /** @type {import('dev/manifest').Manifest} */
        this._manifest = manifest;
        /** @type {import('dev/manifest').ManifestVariant[]} */
        this._variants = variants;
        /** @type {string} */
        this._defaultVariant = defaultVariant;
        /** @type {Map<string, import('dev/manifest').ManifestVariant>} */
        this._variantMap = new Map();
        for (const variant of variants) {
            this._variantMap.set(variant.name, variant);
        }
    }

    /**
     * @param {?string} [variantName]
     * @returns {import('dev/manifest').Manifest}
     */
    getManifest(variantName) {
        if (typeof variantName === 'string') {
            const variant = this._variantMap.get(variantName);
            if (typeof variant !== 'undefined') {
                return this._createVariantManifest(this._manifest, variant);
            }
        }

        if (typeof this._defaultVariant === 'string') {
            const variant = this._variantMap.get(this._defaultVariant);
            if (typeof variant !== 'undefined') {
                return this._createVariantManifest(this._manifest, variant);
            }
        }

        return clone(this._manifest);
    }

    /**
     * @returns {import('dev/manifest').ManifestVariant[]}
     */
    getVariants() {
        return [...this._variants];
    }

    /**
     * @param {string} name
     * @returns {import('dev/manifest').ManifestVariant|undefined}
     */
    getVariant(name) {
        return this._variantMap.get(name);
    }

    /**
     * @param {import('dev/manifest').Manifest} manifest
     * @returns {string}
     */
    static createManifestString(manifest) {
        return JSON.stringify(manifest, null, 4) + '\n';
    }

    // Private

    /**
     * @param {import('dev/manifest').Command} data
     * @returns {string}
     * @throws {Error}
     */
    _evaluateModificationCommand(data) {
        const {command, args, trim} = data;
        const {stdout, stderr, status} = childProcess.spawnSync(command, args, {
            cwd: dirname,
            stdio: 'pipe',
            shell: false
        });
        if (status !== 0) {
            const message = stderr.toString('utf8').trim();
            throw new Error(`Failed to execute ${command} ${args.join(' ')}\nstatus=${status}\n${message}`);
        }
        let result = stdout.toString('utf8');
        if (trim) { result = result.trim(); }
        return result;
    }

    /**
     * @param {import('dev/manifest').Manifest} manifest
     * @param {import('dev/manifest').Modification[]|undefined} modifications
     * @returns {import('dev/manifest').Manifest}
     */
    _applyModifications(manifest, modifications) {
        if (Array.isArray(modifications)) {
            for (const modification of modifications) {
                // Rename to path2 to avoid clashing with imported `node:path` module.
                const {action, path: path2} = modification;
                switch (action) {
                    case 'set':
                        {
                            let {value, before, after, command} = modification;
                            /** @type {import('core').UnknownObject} */
                            const object = this._getObjectProperties(manifest, path2, path2.length - 1);
                            const key = path2[path2.length - 1];

                            let {index} = modification;
                            if (typeof index !== 'number') {
                                index = -1;
                            }
                            if (typeof before === 'string') {
                                index = this._getObjectKeyIndex(object, before);
                            }
                            if (typeof after === 'string') {
                                index = this._getObjectKeyIndex(object, after);
                                if (index >= 0) { ++index; }
                            }
                            if (typeof command === 'object' && command !== null) {
                                value = this._evaluateModificationCommand(command);
                            }

                            this._setObjectKeyAtIndex(object, key, value, index);
                        }
                        break;
                    case 'replace':
                        {
                            const {pattern, patternFlags, replacement} = modification;
                            /** @type {import('core').UnknownObject} */
                            const value = this._getObjectProperties(manifest, path2, path2.length - 1);
                            const regex = new RegExp(pattern, patternFlags);
                            const last = path2[path2.length - 1];
                            let value2 = value[last];
                            value2 = `${value2}`.replace(regex, replacement);
                            value[last] = value2;
                        }
                        break;
                    case 'delete':
                        {
                            /** @type {import('core').UnknownObject} */
                            const value = this._getObjectProperties(manifest, path2, path2.length - 1);
                            const last = path2[path2.length - 1];
                            delete value[last];
                        }
                        break;
                    case 'remove':
                        {
                            const {item} = modification;
                            /** @type {unknown[]} */
                            const value = this._getObjectProperties(manifest, path2, path2.length);
                            const index = value.indexOf(item);
                            if (index >= 0) { value.splice(index, 1); }
                        }
                        break;
                    case 'splice':
                        {
                            const {start, deleteCount, items} = modification;
                            /** @type {unknown[]} */
                            const value = this._getObjectProperties(manifest, path2, path2.length);
                            const itemsNew = items.map((v) => clone(v));
                            value.splice(start, deleteCount, ...itemsNew);
                        }
                        break;
                    case 'copy':
                    case 'move':
                        {
                            const {newPath, before, after} = modification;
                            const oldKey = path2[path2.length - 1];
                            const newKey = newPath[newPath.length - 1];
                            /** @type {import('core').UnknownObject} */
                            const oldObject = this._getObjectProperties(manifest, path2, path2.length - 1);
                            /** @type {import('core').UnknownObject} */
                            const newObject = this._getObjectProperties(manifest, newPath, newPath.length - 1);
                            const oldObjectIsNewObject = this._arraysAreSame(path2, newPath, -1);
                            const value = oldObject[oldKey];

                            let {index} = modification;
                            if (typeof index !== 'number' || index < 0) {
                                index = (oldObjectIsNewObject && action !== 'copy') ? this._getObjectKeyIndex(oldObject, oldKey) : -1;
                            }
                            if (typeof before === 'string') {
                                index = this._getObjectKeyIndex(newObject, before);
                            }
                            if (typeof after === 'string') {
                                index = this._getObjectKeyIndex(newObject, after);
                                if (index >= 0) { ++index; }
                            }

                            this._setObjectKeyAtIndex(newObject, newKey, value, index);
                            if (action !== 'copy' && (!oldObjectIsNewObject || oldKey !== newKey)) {
                                delete oldObject[oldKey];
                            }
                        }
                        break;
                    case 'add':
                        {
                            const {items} = modification;
                            /** @type {unknown[]} */
                            const value = this._getObjectProperties(manifest, path2, path2.length);
                            const itemsNew = items.map((v) => clone(v));
                            value.push(...itemsNew);
                        }
                        break;
                }
            }
        }

        return manifest;
    }

    /**
     * @template [T=unknown]
     * @param {T[]} array1
     * @param {T[]} array2
     * @param {number} lengthOffset
     * @returns {boolean}
     */
    _arraysAreSame(array1, array2, lengthOffset) {
        let ii = array1.length;
        if (ii !== array2.length) { return false; }
        ii += lengthOffset;
        for (let i = 0; i < ii; ++i) {
            if (array1[i] !== array2[i]) { return false; }
        }
        return true;
    }

    /**
     * @param {import('core').UnknownObject} object
     * @param {string|number} key
     * @returns {number}
     */
    _getObjectKeyIndex(object, key) {
        return Object.keys(object).indexOf(typeof key === 'string' ? key : `${key}`);
    }

    /**
     * @param {import('core').UnknownObject} object
     * @param {string|number} key
     * @param {unknown} value
     * @param {number} index
     */
    _setObjectKeyAtIndex(object, key, value, index) {
        if (index < 0 || typeof key === 'number' || Object.prototype.hasOwnProperty.call(object, key)) {
            object[key] = value;
            return;
        }

        const entries = Object.entries(object);
        index = Math.min(index, entries.length);
        for (let i = index, ii = entries.length; i < ii; ++i) {
            const [key2] = entries[i];
            delete object[key2];
        }
        entries.splice(index, 0, [key, value]);
        for (let i = index, ii = entries.length; i < ii; ++i) {
            const [key2, value2] = entries[i];
            object[key2] = value2;
        }
    }

    /**
     * @template [TReturn=unknown]
     * @param {unknown} object
     * @param {import('dev/manifest').PropertyPath} path2
     * @param {number} count
     * @returns {TReturn}
     */
    _getObjectProperties(object, path2, count) {
        for (let i = 0; i < count; ++i) {
            object = /** @type {import('core').UnknownObject} */ (object)[path2[i]];
        }
        return /** @type {TReturn} */ (object);
    }

    /**
     * @param {import('dev/manifest').ManifestVariant} variant
     * @returns {import('dev/manifest').ManifestVariant[]}
     */
    _getInheritanceChain(variant) {
        const visited = new Set();
        const inheritance = [];
        while (true) {
            const {name, inherit} = variant;
            if (visited.has(name)) { break; }

            visited.add(name);
            inheritance.unshift(variant);

            if (typeof inherit !== 'string') { break; }

            const nextVariant = this._variantMap.get(inherit);
            if (typeof nextVariant === 'undefined') { break; }

            variant = nextVariant;
        }
        return inheritance;
    }

    /**
     * @param {import('dev/manifest').Manifest} manifest
     * @param {import('dev/manifest').ManifestVariant} variant
     * @returns {import('dev/manifest').Manifest}
     */
    _createVariantManifest(manifest, variant) {
        let modifiedManifest = clone(manifest);
        for (const {modifications} of this._getInheritanceChain(variant)) {
            modifiedManifest = this._applyModifications(modifiedManifest, modifications);
        }
        return modifiedManifest;
    }
}

