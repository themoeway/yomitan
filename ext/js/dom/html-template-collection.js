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

export class HtmlTemplateCollection {
    constructor() {
        /** @type {Map<string, HTMLTemplateElement>} */
        this._templates = new Map();
    }

    /**
     * @param {string|Document} source
     */
    load(source) {
        const sourceNode = (
            typeof source === 'string' ?
            new DOMParser().parseFromString(source, 'text/html') :
            source
        );

        const pattern = /^([\w\W]+)-template$/;
        for (const template of sourceNode.querySelectorAll('template')) {
            const match = pattern.exec(template.id);
            if (match === null) { continue; }
            this._prepareTemplate(template);
            this._templates.set(match[1], template);
        }
    }

    /**
     * @template {Element} T
     * @param {string} name
     * @returns {T}
     * @throws {Error}
     */
    instantiate(name) {
        const template = this._templates.get(name);
        if (typeof template === 'undefined') { throw new Error(`Failed to find template: ${name}`); }
        const {firstElementChild} = template.content;
        if (firstElementChild === null) { throw new Error(`Failed to find template content element: ${name}`); }
        return /** @type {T} */ (document.importNode(firstElementChild, true));
    }

    /**
     * @param {string} name
     * @returns {DocumentFragment}
     * @throws {Error}
     */
    instantiateFragment(name) {
        const template = this._templates.get(name);
        if (typeof template === 'undefined') { throw new Error(`Failed to find template: ${name}`); }
        const {content} = template;
        return document.importNode(content, true);
    }

    /**
     * @returns {IterableIterator<HTMLTemplateElement>}
     */
    getAllTemplates() {
        return this._templates.values();
    }

    // Private

    /**
     * @param {HTMLTemplateElement} template
     */
    _prepareTemplate(template) {
        if (template.dataset.removeWhitespaceText === 'true') {
            this._removeWhitespaceText(template);
        }
    }

    /**
     * @param {HTMLTemplateElement} template
     */
    _removeWhitespaceText(template) {
        const {content} = template;
        const {TEXT_NODE} = Node;
        const iterator = document.createNodeIterator(content, NodeFilter.SHOW_TEXT);
        const removeNodes = [];
        while (true) {
            const node = iterator.nextNode();
            if (node === null) { break; }
            if (node.nodeType === TEXT_NODE && /** @type {string} */ (node.nodeValue).trim().length === 0) {
                removeNodes.push(node);
            }
        }
        for (const node of removeNodes) {
            const {parentNode} = node;
            if (parentNode !== null) {
                parentNode.removeChild(node);
            }
        }
    }
}
