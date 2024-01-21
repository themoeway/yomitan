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

import * as parse5 from '../../lib/parse5.js';

/**
 * @augments import('simple-dom-parser').ISimpleDomParser
 */
export class SimpleDOMParser {
    /**
     * @param {string} content
     */
    constructor(content) {
        /** @type {import('parse5')} */
        // @ts-expect-error - parse5 global is not defined in typescript declaration
        this._parse5Lib = /** @type {import('parse5')} */ (parse5);
        /** @type {import('parse5').TreeAdapter<import('parse5').DefaultTreeAdapterMap>} */
        this._treeAdapter = this._parse5Lib.defaultTreeAdapter;
        /** @type {import('simple-dom-parser').Parse5Document} */
        this._document = this._parse5Lib.parse(content, {
            treeAdapter: this._treeAdapter
        });
        /** @type {RegExp} */
        this._patternHtmlWhitespace = /[\t\r\n\f ]+/g;
    }

    /**
     * @param {string} id
     * @param {import('simple-dom-parser').Element} [root]
     * @returns {?import('simple-dom-parser').Element}
     */
    getElementById(id, root) {
        for (const node of this._allNodes(root)) {
            if (!this._treeAdapter.isElementNode(node) || this.getAttribute(node, 'id') !== id) { continue; }
            return node;
        }
        return null;
    }

    /**
     * @param {string} tagName
     * @param {import('simple-dom-parser').Element} [root]
     * @returns {?import('simple-dom-parser').Element}
     */
    getElementByTagName(tagName, root) {
        for (const node of this._allNodes(root)) {
            if (!this._treeAdapter.isElementNode(node) || node.tagName !== tagName) { continue; }
            return node;
        }
        return null;
    }

    /**
     * @param {string} tagName
     * @param {import('simple-dom-parser').Element} [root]
     * @returns {import('simple-dom-parser').Element[]}
     */
    getElementsByTagName(tagName, root) {
        const results = [];
        for (const node of this._allNodes(root)) {
            if (!this._treeAdapter.isElementNode(node) || node.tagName !== tagName) { continue; }
            results.push(node);
        }
        return results;
    }

    /**
     * @param {string} className
     * @param {import('simple-dom-parser').Element} [root]
     * @returns {import('simple-dom-parser').Element[]}
     */
    getElementsByClassName(className, root) {
        const results = [];
        for (const node of this._allNodes(root)) {
            if (!this._treeAdapter.isElementNode(node)) { continue; }
            const nodeClassName = this.getAttribute(node, 'class');
            if (nodeClassName !== null && this._hasToken(nodeClassName, className)) {
                results.push(node);
            }
        }
        return results;
    }

    /**
     * @param {import('simple-dom-parser').Element} element
     * @param {string} attribute
     * @returns {?string}
     */
    getAttribute(element, attribute) {
        for (const attr of /** @type {import('simple-dom-parser').Parse5Element} */ (element).attrs) {
            if (
                attr.name === attribute &&
                typeof attr.namespace === 'undefined'
            ) {
                return attr.value;
            }
        }
        return null;
    }

    /**
     * @param {import('simple-dom-parser').Element} element
     * @returns {string}
     */
    getTextContent(element) {
        let source = '';
        for (const node of this._allNodes(element)) {
            if (this._treeAdapter.isTextNode(node)) {
                source += node.value;
            }
        }
        return source;
    }

    /**
     * @returns {boolean}
     */
    static isSupported() {
        return typeof parse5 !== 'undefined';
    }

    // Private

    /**
     * @param {import('simple-dom-parser').Element|undefined} root
     * @returns {Generator<import('simple-dom-parser').Parse5ChildNode, void, unknown>}
     * @yields {import('simple-dom-parser').Parse5ChildNode}
     */
    *_allNodes(root) {
        // Depth-first pre-order traversal
        /** @type {import('simple-dom-parser').Parse5ChildNode[]} */
        const nodeQueue = [];
        if (typeof root !== 'undefined') {
            nodeQueue.push(/** @type {import('simple-dom-parser').Parse5Element} */ (root));
        } else {
            nodeQueue.push(...this._document.childNodes);
        }
        while (nodeQueue.length > 0) {
            const node = /** @type {import('simple-dom-parser').Parse5ChildNode} */ (nodeQueue.pop());
            yield node;
            if (this._treeAdapter.isElementNode(node)) {
                const {childNodes} = node;
                if (typeof childNodes !== 'undefined') {
                    for (let i = childNodes.length - 1; i >= 0; --i) {
                        nodeQueue.push(childNodes[i]);
                    }
                }
            }
        }
    }

    /**
     * @param {string} tokenListString
     * @param {string} token
     * @returns {boolean}
     */
    _hasToken(tokenListString, token) {
        let start = 0;
        const pattern = this._patternHtmlWhitespace;
        pattern.lastIndex = 0;
        while (true) {
            const match = pattern.exec(tokenListString);
            const end = match === null ? tokenListString.length : match.index;
            if (end > start && tokenListString.substring(start, end) === token) { return true; }
            if (match === null) { return false; }
            start = end + match[0].length;
        }
    }
}
