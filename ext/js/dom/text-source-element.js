/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2016-2022  Yomichan Authors
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

import {StringUtil} from '../data/sandbox/string-util.js';
import {DocumentUtil} from './document-util.js';

/**
 * This class represents a text source that is attached to a HTML element, such as an <img>
 * with alt text or a <button>.
 */
export class TextSourceElement {
    /**
     * Creates a new instance of the class.
     * @param {Element} element The source element.
     * @param {string} fullContent The string representing the element's full text value.
     * @param {number} startOffset The text start offset position within the full content.
     * @param {number} endOffset The text end offset position within the full content.
     */
    constructor(element, fullContent, startOffset, endOffset) {
        /** @type {Element} */
        this._element = element;
        /** @type {string} */
        this._fullContent = fullContent;
        /** @type {number} */
        this._startOffset = startOffset;
        /** @type {number} */
        this._endOffset = endOffset;
        /** @type {string} */
        this._content = this._fullContent.substring(this._startOffset, this._endOffset);
    }

    /**
     * Gets the type name of this instance.
     * @type {'element'}
     */
    get type() {
        return 'element';
    }

    /**
     * The source element.
     * @type {Element}
     */
    get element() {
        return this._element;
    }

    /**
     * The string representing the element's full text value.
     * @type {string}
     */
    get fullContent() {
        return this._fullContent;
    }

    /**
     * The text start offset position within the full content.
     * @type {number}
     */
    get startOffset() {
        return this._startOffset;
    }

    /**
     * The text end offset position within the full content.
     * @type {number}
     */
    get endOffset() {
        return this._endOffset;
    }

    /**
     * Creates a clone of the instance.
     * @returns {TextSourceElement} The new clone.
     */
    clone() {
        return new TextSourceElement(this._element, this._fullContent, this._startOffset, this._endOffset);
    }

    /**
     * Performs any cleanup that is necessary after the element has been used.
     */
    cleanup() {
        // NOP
    }

    /**
     * Gets the selected text of element, which is a substring of the full content
     * starting at `startOffset` and ending at `endOffset`.
     * @returns {string} The text content.
     */
    text() {
        return this._content;
    }

    /**
     * Moves the end offset of the text by a set amount of unicode codepoints.
     * @param {number} length The maximum number of codepoints to move by.
     * @param {boolean} fromEnd Whether to move the offset from the current end position (if `true`) or the start position (if `false`).
     * @returns {number} The actual number of characters (not codepoints) that were read.
     */
    setEndOffset(length, fromEnd) {
        const offset = fromEnd ? this._endOffset : this._startOffset;
        length = Math.min(this._fullContent.length - offset, length);
        if (length > 0) {
            length = StringUtil.readCodePointsForward(this._fullContent, offset, length).length;
        }
        this._endOffset = offset + length;
        this._content = this._fullContent.substring(this._startOffset, this._endOffset);
        return length;
    }

    /**
     * Moves the start offset of the text by a set amount of unicode codepoints.
     * @param {number} length The maximum number of codepoints to move by.
     * @returns {number} The actual number of characters (not codepoints) that were read.
     */
    setStartOffset(length) {
        length = Math.min(this._startOffset, length);
        if (length > 0) {
            length = StringUtil.readCodePointsBackward(this._fullContent, this._startOffset - 1, length).length;
        }
        this._startOffset -= length;
        this._content = this._fullContent.substring(this._startOffset, this._endOffset);
        return length;
    }

    /**
     * Gets the rects that represent the position and bounds of the text source.
     * @returns {DOMRect[]} The rects.
     */
    getRects() {
        return DocumentUtil.convertMultipleRectZoomCoordinates(this._element.getClientRects(), this._element);
    }

    /**
     * Gets writing mode that is used for this element.
     * See: https://developer.mozilla.org/en-US/docs/Web/CSS/writing-mode.
     * @returns {import('document-util').NormalizedWritingMode} The writing mode.
     */
    getWritingMode() {
        return 'horizontal-tb';
    }

    /**
     * Selects the text source in the document.
     */
    select() {
        // NOP
    }

    /**
     * Deselects the text source in the document.
     */
    deselect() {
        // NOP
    }

    /**
     * Checks whether another text source has the same starting point.
     * @param {import('text-source').TextSource} other The other source to test.
     * @returns {boolean} `true` if the starting points are equivalent, `false` otherwise.
     */
    hasSameStart(other) {
        return (
            typeof other === 'object' &&
            other !== null &&
            other instanceof TextSourceElement &&
            this._element === other.element &&
            this._fullContent === other.fullContent &&
            this._startOffset === other.startOffset
        );
    }

    /**
     * Gets a list of the nodes in this text source's range.
     * @returns {Node[]} The nodes in the range.
     */
    getNodesInRange() {
        return [this._element];
    }

    /**
     * Creates a new instance for a given element.
     * @param {Element} element The source element.
     * @returns {TextSourceElement} A new instance of the class corresponding to the element.
     */
    static create(element) {
        return new TextSourceElement(element, this._getElementContent(element), 0, 0);
    }

    /**
     * Gets the full content string for a given element.
     * @param {Element} element The element to get the full content of.
     * @returns {string} The content string.
     */
    static _getElementContent(element) {
        let content = '';
        switch (element.nodeName.toUpperCase()) {
            case 'BUTTON':
                {
                    const {textContent} = /** @type {HTMLButtonElement} */ (element);
                    if (textContent !== null) {
                        content = textContent;
                    }
                }
                break;
            case 'IMG':
                {
                    const alt = /** @type {HTMLImageElement} */ (element).getAttribute('alt');
                    if (typeof alt === 'string') {
                        content = alt;
                    }
                }
                break;
            case 'SELECT':
                {
                    const {selectedIndex, options} = /** @type {HTMLSelectElement} */ (element);
                    if (selectedIndex >= 0 && selectedIndex < options.length) {
                        const {textContent} = options[selectedIndex];
                        if (textContent !== null) {
                            content = textContent;
                        }
                    }
                }
                break;
            case 'INPUT':
                {
                    content = /** @type {HTMLInputElement} */ (element).value;
                }
                break;
        }

        // Remove zero-width space and zero-width non-joiner
        content = content.replace(/[\u200b\u200c]/g, '');

        return content;
    }
}
