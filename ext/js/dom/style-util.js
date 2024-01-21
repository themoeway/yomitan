/*
 * Copyright (C) 2023-2024  Yomitan Authors
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

import {yomitan} from '../yomitan.js';

/** @type {Map<string, ?HTMLStyleElement|HTMLLinkElement>} */
const injectedStylesheets = new Map();
/** @type {WeakMap<Node, Map<string, ?HTMLStyleElement|HTMLLinkElement>>} */
const injectedStylesheetsWithParent = new WeakMap();

/**
 * @param {string} id
 * @param {?Node} parentNode
 * @returns {?HTMLStyleElement|HTMLLinkElement|undefined}
 */
function getInjectedStylesheet(id, parentNode) {
    if (parentNode === null) {
        return injectedStylesheets.get(id);
    }
    const map = injectedStylesheetsWithParent.get(parentNode);
    return typeof map !== 'undefined' ? map.get(id) : void 0;
}

/**
 * @param {string} id
 * @param {?Node} parentNode
 * @param {?HTMLStyleElement|HTMLLinkElement} value
 */
function setInjectedStylesheet(id, parentNode, value) {
    if (parentNode === null) {
        injectedStylesheets.set(id, value);
        return;
    }
    let map = injectedStylesheetsWithParent.get(parentNode);
    if (typeof map === 'undefined') {
        map = new Map();
        injectedStylesheetsWithParent.set(parentNode, map);
    }
    map.set(id, value);
}

/**
 * @param {string} id
 * @param {'code'|'file'|'file-content'} type
 * @param {string} value
 * @param {boolean} [useWebExtensionApi]
 * @param {?Node} [parentNode]
 * @returns {Promise<?HTMLStyleElement|HTMLLinkElement>}
 * @throws {Error}
 */
export async function loadStyle(id, type, value, useWebExtensionApi = false, parentNode = null) {
    if (useWebExtensionApi && yomitan.isExtensionUrl(window.location.href)) {
        // Permissions error will occur if trying to use the WebExtension API to inject into an extension page
        useWebExtensionApi = false;
    }

    let styleNode = getInjectedStylesheet(id, parentNode);
    if (typeof styleNode !== 'undefined') {
        if (styleNode === null) {
            // Previously injected via WebExtension API
            throw new Error(`Stylesheet with id ${id} has already been injected using the WebExtension API`);
        }
    } else {
        styleNode = null;
    }

    if (type === 'file-content') {
        value = await yomitan.api.getStylesheetContent(value);
        type = 'code';
        useWebExtensionApi = false;
    }

    if (useWebExtensionApi) {
        // Inject via WebExtension API
        if (styleNode !== null && styleNode.parentNode !== null) {
            styleNode.parentNode.removeChild(styleNode);
        }

        setInjectedStylesheet(id, parentNode, null);
        await yomitan.api.injectStylesheet(type, value);
        return null;
    }

    // Create node in document
    let parentNode2 = parentNode;
    if (parentNode2 === null) {
        parentNode2 = document.head;
        if (parentNode2 === null) {
            throw new Error('No parent node');
        }
    }

    // Create or reuse node
    const isFile = (type === 'file');
    const tagName = isFile ? 'link' : 'style';
    if (styleNode === null || styleNode.nodeName.toLowerCase() !== tagName) {
        if (styleNode !== null && styleNode.parentNode !== null) {
            styleNode.parentNode.removeChild(styleNode);
        }
        styleNode = document.createElement(tagName);
    }

    // Update node style
    if (isFile) {
        /** @type {HTMLLinkElement} */ (styleNode).rel = 'stylesheet';
        /** @type {HTMLLinkElement} */ (styleNode).href = value;
    } else {
        styleNode.textContent = value;
    }

    // Update parent
    if (styleNode.parentNode !== parentNode2) {
        parentNode2.appendChild(styleNode);
    }

    // Add to map
    setInjectedStylesheet(id, parentNode, styleNode);
    return styleNode;
}
