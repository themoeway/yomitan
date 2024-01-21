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

import {toError} from '../core/to-error.js';
import {DocumentUtil} from './document-util.js';
import {DOMTextScanner} from './dom-text-scanner.js';

/**
 * This class represents a text source that comes from text nodes in the document.
 * Sometimes a temporary "imposter" element is created and used to store the text.
 * This element is typically hidden from the page and removed after scanning has completed.
 */
export class TextSourceRange {
    /**
     * Creates a new instance of the class.
     * @param {Range} range The selection range.
     * @param {number} rangeStartOffset The `startOffset` of the range. This is somewhat redundant
     *   with the `range` parameter, but it is used when for when imposter elements are removed.
     * @param {string} content The `toString()` value of the range. This is somewhat redundant
     *   with the `range` parameter, but it is used when for when imposter elements are removed.
     * @param {?Element} imposterElement The temporary imposter element.
     * @param {?Element} imposterSourceElement The source element which the imposter is imitating.
     *   Must not be `null` if imposterElement is specified.
     * @param {?DOMRect[]} cachedRects A set of cached `DOMRect`s representing the rects of the text source,
     *   which can be used after the imposter element is removed from the page.
     *   Must not be `null` if imposterElement is specified.
     * @param {?DOMRect} cachedSourceRect A cached `DOMRect` representing the rect of the `imposterSourceElement`,
     *   which can be used after the imposter element is removed from the page.
     *   Must not be `null` if imposterElement is specified.
     */
    constructor(range, rangeStartOffset, content, imposterElement, imposterSourceElement, cachedRects, cachedSourceRect) {
        /** @type {Range} */
        this._range = range;
        /** @type {number} */
        this._rangeStartOffset = rangeStartOffset;
        /** @type {string} */
        this._content = content;
        /** @type {?Element} */
        this._imposterElement = imposterElement;
        /** @type {?Element} */
        this._imposterSourceElement = imposterSourceElement;
        /** @type {?DOMRect[]} */
        this._cachedRects = cachedRects;
        /** @type {?DOMRect} */
        this._cachedSourceRect = cachedSourceRect;
    }

    /**
     * Gets the type name of this instance.
     * @type {'range'}
     */
    get type() {
        return 'range';
    }

    /**
     * The internal range object.
     * @type {Range}
     */
    get range() {
        return this._range;
    }

    /**
     * The starting offset for the range.
     * @type {number}
     */
    get rangeStartOffset() {
        return this._rangeStartOffset;
    }

    /**
     * The source element that the imposter element is imitating, if present.
     * @type {?Element}
     */
    get imposterSourceElement() {
        return this._imposterSourceElement;
    }

    /**
     * Creates a clone of the instance.
     * @returns {TextSourceRange} The new clone.
     */
    clone() {
        return new TextSourceRange(
            this._range.cloneRange(),
            this._rangeStartOffset,
            this._content,
            this._imposterElement,
            this._imposterSourceElement,
            this._cachedRects,
            this._cachedSourceRect
        );
    }

    /**
     * Performs any cleanup that is necessary after the element has been used.
     */
    cleanup() {
        if (this._imposterElement !== null && this._imposterElement.parentNode !== null) {
            this._imposterElement.parentNode.removeChild(this._imposterElement);
        }
    }

    /**
     * Gets the selected text of element, which is the `toString()` version of the range.
     * @returns {string} The text content.
     */
    text() {
        return this._content;
    }

    /**
     * Moves the end offset of the text by a set amount of unicode codepoints.
     * @param {number} length The maximum number of codepoints to move by.
     * @param {boolean} fromEnd Whether to move the offset from the current end position (if `true`) or the start position (if `false`).
     * @param {boolean} layoutAwareScan Whether or not HTML layout information should be used to generate
     *   the string content when scanning.
     * @returns {number} The actual number of codepoints that were read.
     */
    setEndOffset(length, fromEnd, layoutAwareScan) {
        let node;
        let offset;
        if (fromEnd) {
            node = this._range.endContainer;
            offset = this._range.endOffset;
        } else {
            node = this._range.startContainer;
            offset = this._range.startOffset;
        }
        const state = new DOMTextScanner(node, offset, !layoutAwareScan, layoutAwareScan).seek(length);
        this._range.setEnd(state.node, state.offset);
        this._content = (fromEnd ? this._content + state.content : state.content);
        return length - state.remainder;
    }

    /**
     * Moves the start offset of the text by a set amount of unicode codepoints.
     * @param {number} length The maximum number of codepoints to move by.
     * @param {boolean} layoutAwareScan Whether or not HTML layout information should be used to generate
     *   the string content when scanning.
     * @returns {number} The actual number of codepoints that were read.
     */
    setStartOffset(length, layoutAwareScan) {
        const state = new DOMTextScanner(this._range.startContainer, this._range.startOffset, !layoutAwareScan, layoutAwareScan).seek(-length);
        this._range.setStart(state.node, state.offset);
        this._rangeStartOffset = this._range.startOffset;
        this._content = state.content + this._content;
        return length - state.remainder;
    }

    /**
     * Gets the rects that represent the position and bounds of the text source.
     * @returns {DOMRect[]} The rects.
     */
    getRects() {
        if (this._isImposterDisconnected()) { return this._getCachedRects(); }
        return DocumentUtil.convertMultipleRectZoomCoordinates(this._range.getClientRects(), this._range.startContainer);
    }

    /**
     * Gets writing mode that is used for this element.
     * See: https://developer.mozilla.org/en-US/docs/Web/CSS/writing-mode.
     * @returns {import('document-util').NormalizedWritingMode} The writing mode.
     */
    getWritingMode() {
        let node = this._isImposterDisconnected() ? this._imposterSourceElement : this._range.startContainer;
        if (node !== null && node.nodeType !== Node.ELEMENT_NODE) { node = node.parentElement; }
        return DocumentUtil.getElementWritingMode(/** @type {?Element} */ (node));
    }

    /**
     * Selects the text source in the document.
     */
    select() {
        if (this._imposterElement !== null) { return; }
        const selection = window.getSelection();
        if (selection === null) { return; }
        selection.removeAllRanges();
        selection.addRange(this._range);
    }

    /**
     * Deselects the text source in the document.
     */
    deselect() {
        if (this._imposterElement !== null) { return; }
        const selection = window.getSelection();
        if (selection === null) { return; }
        selection.removeAllRanges();
    }

    /**
     * Checks whether another text source has the same starting point.
     * @param {import('text-source').TextSource} other The other source to test.
     * @returns {boolean} `true` if the starting points are equivalent, `false` otherwise.
     * @throws {Error} An exception can be thrown if `Range.compareBoundaryPoints` fails,
     *   which shouldn't happen, but the handler is kept in case of unexpected errors.
     */
    hasSameStart(other) {
        if (!(
            typeof other === 'object' &&
            other !== null &&
            other instanceof TextSourceRange
        )) {
            return false;
        }
        if (this._imposterSourceElement !== null) {
            return (
                this._imposterSourceElement === other.imposterSourceElement &&
                this._rangeStartOffset === other.rangeStartOffset
            );
        } else {
            try {
                return this._range.compareBoundaryPoints(Range.START_TO_START, other.range) === 0;
            } catch (e) {
                if (toError(e).name === 'WrongDocumentError') {
                    // This can happen with shadow DOMs if the ranges are in different documents.
                    return false;
                }
                throw e;
            }
        }
    }

    /**
     * Gets a list of the nodes in this text source's range.
     * @returns {Node[]} The nodes in the range.
     */
    getNodesInRange() {
        return DocumentUtil.getNodesInRange(this._range);
    }

    /**
     * Creates a new instance for a given range.
     * @param {Range} range The source range.
     * @returns {TextSourceRange} A new instance of the class corresponding to the range.
     */
    static create(range) {
        return new TextSourceRange(range, range.startOffset, range.toString(), null, null, null, null);
    }

    /**
     * Creates a new instance for a given range using an imposter element.
     * @param {Range} range The source range.
     * @param {Element} imposterElement The temporary imposter element.
     * @param {Element} imposterSourceElement The source element which the imposter is imitating.
     * @returns {TextSourceRange} A new instance of the class corresponding to the range.
     */
    static createFromImposter(range, imposterElement, imposterSourceElement) {
        const cachedRects = DocumentUtil.convertMultipleRectZoomCoordinates(range.getClientRects(), range.startContainer);
        const cachedSourceRect = DocumentUtil.convertRectZoomCoordinates(imposterSourceElement.getBoundingClientRect(), imposterSourceElement);
        return new TextSourceRange(range, range.startOffset, range.toString(), imposterElement, imposterSourceElement, cachedRects, cachedSourceRect);
    }

    /**
     * Checks whether the imposter element has been removed, if the instance is using one.
     * @returns {boolean} `true` if the instance has an imposter and it's no longer connected to the document, `false` otherwise.
     */
    _isImposterDisconnected() {
        return this._imposterElement !== null && !this._imposterElement.isConnected;
    }

    /**
     * Gets the cached rects for a disconnected imposter element.
     * @returns {DOMRect[]} The rects for the element.
     * @throws {Error}
     */
    _getCachedRects() {
        if (
            this._cachedRects === null ||
            this._cachedSourceRect === null ||
            this._imposterSourceElement === null
        ) {
            throw new Error('Cached rects not valid for this instance');
        }
        const sourceRect = DocumentUtil.convertRectZoomCoordinates(this._imposterSourceElement.getBoundingClientRect(), this._imposterSourceElement);
        return DocumentUtil.offsetDOMRects(
            this._cachedRects,
            sourceRect.left - this._cachedSourceRect.left,
            sourceRect.top - this._cachedSourceRect.top
        );
    }
}
