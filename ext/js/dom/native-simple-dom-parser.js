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

export class NativeSimpleDOMParser {
    /**
     * @param {string} content
     */
    constructor(content) {
        /** @type {Document} */
        this._document = new DOMParser().parseFromString(content, 'text/html');
    }

    /**
     * @param {string} id
     * @param {import('simple-dom-parser').Element} [root]
     * @returns {?import('simple-dom-parser').Element}
     */
    getElementById(id, root) {
        return this._convertElementOrDocument(root).querySelector(`[id='${id}']`);
    }

    /**
     * @param {string} tagName
     * @param {import('simple-dom-parser').Element} [root]
     * @returns {?import('simple-dom-parser').Element}
     */
    getElementByTagName(tagName, root) {
        return this._convertElementOrDocument(root).querySelector(tagName);
    }

    /**
     * @param {string} tagName
     * @param {import('simple-dom-parser').Element} [root]
     * @returns {import('simple-dom-parser').Element[]}
     */
    getElementsByTagName(tagName, root) {
        return [...this._convertElementOrDocument(root).querySelectorAll(tagName)];
    }

    /**
     * @param {string} className
     * @param {import('simple-dom-parser').Element} [root]
     * @returns {import('simple-dom-parser').Element[]}
     */
    getElementsByClassName(className, root) {
        return [...this._convertElementOrDocument(root).querySelectorAll(`.${className}`)];
    }

    /**
     * @param {import('simple-dom-parser').Element} element
     * @param {string} attribute
     * @returns {?string}
     */
    getAttribute(element, attribute) {
        const element2 = this._convertElement(element);
        return element2.hasAttribute(attribute) ? element2.getAttribute(attribute) : null;
    }

    /**
     * @param {import('simple-dom-parser').Element} element
     * @returns {string}
     */
    getTextContent(element) {
        const {textContent} = this._convertElement(element);
        return typeof textContent === 'string' ? textContent : '';
    }

    /**
     * @returns {boolean}
     */
    static isSupported() {
        return typeof DOMParser !== 'undefined';
    }

    /**
     * @param {import('simple-dom-parser').Element} element
     * @returns {Element}
     */
    _convertElement(element) {
        return /** @type {Element} */ (element);
    }

    /**
     * @param {import('simple-dom-parser').Element|undefined} element
     * @returns {Element|Document}
     */
    _convertElementOrDocument(element) {
        return typeof element !== 'undefined' ? /** @type {Element} */ (element) : this._document;
    }
}
