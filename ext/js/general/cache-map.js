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


/**
 * @template [K=unknown]
 * @template [V=unknown]
 * Class which caches a map of values, keeping the most recently accessed values.
 */
export class CacheMap {
    /**
     * Creates a new CacheMap.
     * @param {number} maxSize The maximum number of entries able to be stored in the cache.
     */
    constructor(maxSize) {
        if (!(
            Number.isFinite(maxSize) &&
            maxSize >= 0 &&
            Math.floor(maxSize) === maxSize
        )) {
            throw new Error('Invalid maxCount');
        }

        /** @type {number} */
        this._maxSize = maxSize;
        /** @type {Map<K, import('cache-map').Node<K, V>>} */
        this._map = new Map();
        /** @type {import('cache-map').Node<K, V>} */
        this._listFirst = this._createNode(null, null);
        /** @type {import('cache-map').Node<K, V>} */
        this._listLast = this._createNode(null, null);
        this._resetEndNodes();
    }

    /**
     * Returns the number of items in the cache.
     * @type {number}
     */
    get size() {
        return this._map.size;
    }

    /**
     * Returns the maximum number of items that can be added to the cache.
     * @type {number}
     */
    get maxSize() {
        return this._maxSize;
    }

    /**
     * Returns whether or not an element exists at the given key.
     * @param {K} key The key of the element.
     * @returns {boolean} `true` if an element with the specified key exists, `false` otherwise.
     */
    has(key) {
        return this._map.has(key);
    }

    /**
     * Gets an element at the given key, if it exists. Otherwise, returns undefined.
     * @param {K} key The key of the element.
     * @returns {V|undefined} The existing value at the key, if any; `undefined` otherwise.
     */
    get(key) {
        const node = this._map.get(key);
        if (typeof node === 'undefined') { return void 0; }
        this._updateRecency(node);
        return /** @type {V} */ (node.value);
    }

    /**
     * Sets a value at a given key.
     * @param {K} key The key of the element.
     * @param {V} value The value to store in the cache.
     */
    set(key, value) {
        let node = this._map.get(key);
        if (typeof node !== 'undefined') {
            this._updateRecency(node);
            node.value = value;
        } else {
            if (this._maxSize <= 0) { return; }

            node = this._createNode(key, value);
            this._addNode(node, this._listFirst);
            this._map.set(key, node);

            // Remove
            for (let removeCount = this._map.size - this._maxSize; removeCount > 0; --removeCount) {
                node = /** @type {import('cache-map').Node<K, V>} */ (this._listLast.previous);
                this._removeNode(node);
                this._map.delete(/** @type {K} */ (node.key));
            }
        }
    }

    /**
     * Clears the cache.
     */
    clear() {
        this._map.clear();
        this._resetEndNodes();
    }

    // Private

    /**
     * @param {import('cache-map').Node<K, V>} node
     */
    _updateRecency(node) {
        this._removeNode(node);
        this._addNode(node, this._listFirst);
    }

    /**
     * @param {?K} key
     * @param {?V} value
     * @returns {import('cache-map').Node<K, V>}
     */
    _createNode(key, value) {
        return {key, value, previous: null, next: null};
    }

    /**
     * @param {import('cache-map').Node<K, V>} node
     * @param {import('cache-map').Node<K, V>} previous
     */
    _addNode(node, previous) {
        const next = previous.next;
        node.next = next;
        node.previous = previous;
        previous.next = node;
        /** @type {import('cache-map').Node<K, V>} */ (next).previous = node;
    }

    /**
     * @param {import('cache-map').Node<K, V>} node
     */
    _removeNode(node) {
        /** @type {import('cache-map').Node<K, V>} */ (node.next).previous = node.previous;
        /** @type {import('cache-map').Node<K, V>} */ (node.previous).next = node.next;
    }

    /**
     * @returns {void}
     */
    _resetEndNodes() {
        this._listFirst.next = this._listLast;
        this._listLast.previous = this._listFirst;
    }
}
