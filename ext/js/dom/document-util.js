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

import {DOMTextScanner} from './dom-text-scanner.js';
import {TextSourceElement} from './text-source-element.js';
import {TextSourceRange} from './text-source-range.js';

/**
 * This class contains utility functions related to the HTML document.
 */
export class DocumentUtil {
    /** @type {RegExp} @readonly */
    static _transparentColorPattern = /rgba\s*\([^)]*,\s*0(?:\.0+)?\s*\)/;
    /** @type {?boolean} */
    static _cssZoomSupported = null;
    /** @type {import('document-util').GetRangeFromPointHandler[]} @readonly */
    static _getRangeFromPointHandlers = [];

    /**
     * Scans the document for text or elements with text information at the given coordinate.
     * Coordinates are provided in [client space](https://developer.mozilla.org/en-US/docs/Web/CSS/CSSOM_View/Coordinate_systems).
     * @param {number} x The x coordinate to search at.
     * @param {number} y The y coordinate to search at.
     * @param {import('document-util').GetRangeFromPointOptions} options Options to configure how element detection is performed.
     * @returns {?TextSourceRange|TextSourceElement} A range for the hovered text or element, or `null` if no applicable content was found.
     */
    static getRangeFromPoint(x, y, options) {
        for (const handler of this._getRangeFromPointHandlers) {
            const r = handler(x, y, options);
            if (r !== null) { return r; }
        }

        const {deepContentScan, normalizeCssZoom} = options;

        const elements = this._getElementsFromPoint(x, y, deepContentScan);
        /** @type {?HTMLDivElement} */
        let imposter = null;
        /** @type {?HTMLDivElement} */
        let imposterContainer = null;
        /** @type {?Element} */
        let imposterSourceElement = null;
        if (elements.length > 0) {
            const element = elements[0];
            switch (element.nodeName.toUpperCase()) {
                case 'IMG':
                case 'BUTTON':
                case 'SELECT':
                    return TextSourceElement.create(element);
                case 'INPUT':
                    if (/** @type {HTMLInputElement} */ (element).type === 'text') {
                        imposterSourceElement = element;
                        [imposter, imposterContainer] = this._createImposter(/** @type {HTMLInputElement} */ (element), false);
                    }
                    break;
                case 'TEXTAREA':
                    imposterSourceElement = element;
                    [imposter, imposterContainer] = this._createImposter(/** @type {HTMLTextAreaElement} */ (element), true);
                    break;
            }
        }

        const range = this._caretRangeFromPointExt(x, y, deepContentScan ? elements : [], normalizeCssZoom);
        if (range !== null) {
            if (imposter !== null) {
                this._setImposterStyle(/** @type {HTMLDivElement} */ (imposterContainer).style, 'z-index', '-2147483646');
                this._setImposterStyle(imposter.style, 'pointer-events', 'none');
                return TextSourceRange.createFromImposter(range, /** @type {HTMLDivElement} */ (imposterContainer), /** @type {HTMLElement} */ (imposterSourceElement));
            }
            return TextSourceRange.create(range);
        } else {
            if (imposterContainer !== null) {
                const {parentNode} = imposterContainer;
                if (parentNode !== null) {
                    parentNode.removeChild(imposterContainer);
                }
            }
            return null;
        }
    }

    /**
     * Registers a custom handler for scanning for text or elements at the input position.
     * @param {import('document-util').GetRangeFromPointHandler} handler The handler callback which will be invoked when calling `getRangeFromPoint`.
     */
    static registerGetRangeFromPointHandler(handler) {
        this._getRangeFromPointHandlers.push(handler);
    }

    /**
     * Extract a sentence from a document.
     * @param {TextSourceRange|TextSourceElement} source The text source object, either `TextSourceRange` or `TextSourceElement`.
     * @param {boolean} layoutAwareScan Whether or not layout-aware scan mode should be used.
     * @param {number} extent The length of the sentence to extract.
     * @param {boolean} terminateAtNewlines Whether or not a sentence should be terminated at newline characters.
     * @param {import('text-scanner').SentenceTerminatorMap} terminatorMap A mapping of characters that terminate a sentence.
     * @param {import('text-scanner').SentenceForwardQuoteMap} forwardQuoteMap A mapping of quote characters that delimit a sentence.
     * @param {import('text-scanner').SentenceBackwardQuoteMap} backwardQuoteMap A mapping of quote characters that delimit a sentence, which is the inverse of forwardQuoteMap.
     * @returns {{text: string, offset: number}} The sentence and the offset to the original source.
     */
    static extractSentence(source, layoutAwareScan, extent, terminateAtNewlines, terminatorMap, forwardQuoteMap, backwardQuoteMap) {
        // Scan text
        source = source.clone();
        const startLength = source.setStartOffset(extent, layoutAwareScan);
        const endLength = source.setEndOffset(extent * 2 - startLength, true, layoutAwareScan);
        const text = source.text();
        const textLength = text.length;
        const textEndAnchor = textLength - endLength;

        /** Relative start position of the sentence (inclusive). */
        let cursorStart = startLength;
        /** Relative end position of the sentence (exclusive). */
        let cursorEnd = textEndAnchor;

        // Move backward
        let quoteStack = [];
        for (; cursorStart > 0; --cursorStart) {
            // Check if the previous character should be included.
            let c = text[cursorStart - 1];
            if (c === '\n' && terminateAtNewlines) { break; }

            if (quoteStack.length === 0) {
                let terminatorInfo = terminatorMap.get(c);
                if (typeof terminatorInfo !== 'undefined') {
                    // Include the previous character while it is a terminator character and is included at start.
                    while (terminatorInfo[0] && cursorStart > 0) {
                        --cursorStart;
                        if (cursorStart === 0) { break; }
                        c = text[cursorStart - 1];
                        terminatorInfo = terminatorMap.get(c);
                        if (typeof terminatorInfo === 'undefined') { break; }
                    }
                    break;
                }
            }

            let quoteInfo = forwardQuoteMap.get(c);
            if (typeof quoteInfo !== 'undefined') {
                if (quoteStack.length === 0) {
                    // Include the previous character while it is a quote character and is included at start.
                    while (quoteInfo[1] && cursorStart > 0) {
                        --cursorStart;
                        if (cursorStart === 0) { break; }
                        c = text[cursorStart - 1];
                        quoteInfo = forwardQuoteMap.get(c);
                        if (typeof quoteInfo === 'undefined') { break; }
                    }
                    break;
                } else if (quoteStack[0] === c) {
                    quoteStack.pop();
                    continue;
                }
            }

            quoteInfo = backwardQuoteMap.get(c);
            if (typeof quoteInfo !== 'undefined') {
                quoteStack.unshift(quoteInfo[0]);
            }
        }

        // Move forward
        quoteStack = [];
        for (; cursorEnd < textLength; ++cursorEnd) {
            // Check if the following character should be included.
            let c = text[cursorEnd];
            if (c === '\n' && terminateAtNewlines) { break; }

            if (quoteStack.length === 0) {
                let terminatorInfo = terminatorMap.get(c);
                if (typeof terminatorInfo !== 'undefined') {
                    // Include the following character while it is a terminator character and is included at end.
                    while (terminatorInfo[1] && cursorEnd < textLength) {
                        ++cursorEnd;
                        if (cursorEnd === textLength) { break; }
                        c = text[cursorEnd];
                        terminatorInfo = terminatorMap.get(c);
                        if (typeof terminatorInfo === 'undefined') { break; }
                    }
                    break;
                }
            }

            let quoteInfo = backwardQuoteMap.get(c);
            if (typeof quoteInfo !== 'undefined') {
                if (quoteStack.length === 0) {
                    // Include the following character while it is a quote character and is included at end.
                    while (quoteInfo[1] && cursorEnd < textLength) {
                        ++cursorEnd;
                        if (cursorEnd === textLength) { break; }
                        c = text[cursorEnd];
                        quoteInfo = forwardQuoteMap.get(c);
                        if (typeof quoteInfo === 'undefined') { break; }
                    }
                    break;
                } else if (quoteStack[0] === c) {
                    quoteStack.pop();
                    continue;
                }
            }

            quoteInfo = forwardQuoteMap.get(c);
            if (typeof quoteInfo !== 'undefined') {
                quoteStack.unshift(quoteInfo[0]);
            }
        }

        // Trim whitespace
        for (; cursorStart < startLength && this._isWhitespace(text[cursorStart]); ++cursorStart) { /* NOP */ }
        for (; cursorEnd > textEndAnchor && this._isWhitespace(text[cursorEnd - 1]); --cursorEnd) { /* NOP */ }

        // Result
        return {
            text: text.substring(cursorStart, cursorEnd),
            offset: startLength - cursorStart
        };
    }

    /**
     * Computes the scaling adjustment that is necessary for client space coordinates based on the
     * CSS zoom level.
     * @param {?Node} node A node in the document.
     * @returns {number} The scaling factor.
     */
    static computeZoomScale(node) {
        if (this._cssZoomSupported === null) {
            this._cssZoomSupported = this._computeCssZoomSupported();
        }
        if (!this._cssZoomSupported) { return 1; }
        // documentElement must be excluded because the computer style of its zoom property is inconsistent.
        // * If CSS `:root{zoom:X;}` is specified, the computed zoom will always report `X`.
        // * If CSS `:root{zoom:X;}` is not specified, the computed zoom report the browser's zoom level.
        // Therefor, if CSS root zoom is specified as a value other than 1, the adjusted {x, y} values
        // would be incorrect, which is not new behaviour.
        let scale = 1;
        const {ELEMENT_NODE, DOCUMENT_FRAGMENT_NODE} = Node;
        const {documentElement} = document;
        for (; node !== null && node !== documentElement; node = node.parentNode) {
            const {nodeType} = node;
            if (nodeType === DOCUMENT_FRAGMENT_NODE) {
                const {host} = /** @type {ShadowRoot} */ (node);
                if (typeof host !== 'undefined') {
                    node = host;
                }
                continue;
            } else if (nodeType !== ELEMENT_NODE) {
                continue;
            }
            const zoomString = getComputedStyle(/** @type {HTMLElement} */ (node)).getPropertyValue('zoom');
            if (typeof zoomString !== 'string' || zoomString.length === 0) { continue; }
            const zoom = Number.parseFloat(zoomString);
            if (!Number.isFinite(zoom) || zoom === 0) { continue; }
            scale *= zoom;
        }
        return scale;
    }

    /**
     * Converts a rect based on the CSS zoom scaling for a given node.
     * @param {DOMRect} rect The rect to convert.
     * @param {Node} node The node to compute the zoom from.
     * @returns {DOMRect} The updated rect, or the same rect if no change is needed.
     */
    static convertRectZoomCoordinates(rect, node) {
        const scale = this.computeZoomScale(node);
        return (scale === 1 ? rect : new DOMRect(rect.left * scale, rect.top * scale, rect.width * scale, rect.height * scale));
    }

    /**
     * Converts multiple rects based on the CSS zoom scaling for a given node.
     * @param {DOMRect[]|DOMRectList} rects The rects to convert.
     * @param {Node} node The node to compute the zoom from.
     * @returns {DOMRect[]} The updated rects, or the same rects array if no change is needed.
     */
    static convertMultipleRectZoomCoordinates(rects, node) {
        const scale = this.computeZoomScale(node);
        if (scale === 1) { return [...rects]; }
        const results = [];
        for (const rect of rects) {
            results.push(new DOMRect(rect.left * scale, rect.top * scale, rect.width * scale, rect.height * scale));
        }
        return results;
    }

    /**
     * Checks whether a given point is contained within a rect.
     * @param {number} x The horizontal coordinate.
     * @param {number} y The vertical coordinate.
     * @param {DOMRect} rect The rect to check.
     * @returns {boolean} `true` if the point is inside the rect, `false` otherwise.
     */
    static isPointInRect(x, y, rect) {
        return (
            x >= rect.left && x < rect.right &&
            y >= rect.top && y < rect.bottom
        );
    }

    /**
     * Checks whether a given point is contained within any rect in a list.
     * @param {number} x The horizontal coordinate.
     * @param {number} y The vertical coordinate.
     * @param {DOMRect[]|DOMRectList} rects The rect to check.
     * @returns {boolean} `true` if the point is inside any of the rects, `false` otherwise.
     */
    static isPointInAnyRect(x, y, rects) {
        for (const rect of rects) {
            if (this.isPointInRect(x, y, rect)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks whether a given point is contained within a selection range.
     * @param {number} x The horizontal coordinate.
     * @param {number} y The vertical coordinate.
     * @param {Selection} selection The selection to check.
     * @returns {boolean} `true` if the point is inside the selection, `false` otherwise.
     */
    static isPointInSelection(x, y, selection) {
        for (let i = 0; i < selection.rangeCount; ++i) {
            const range = selection.getRangeAt(i);
            if (this.isPointInAnyRect(x, y, range.getClientRects())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Gets an array of the active modifier keys.
     * @param {KeyboardEvent|MouseEvent|TouchEvent} event The event to check.
     * @returns {import('input').ModifierKey[]} An array of modifiers.
     */
    static getActiveModifiers(event) {
        /** @type {import('input').ModifierKey[]} */
        const modifiers = [];
        if (event.altKey) { modifiers.push('alt'); }
        if (event.ctrlKey) { modifiers.push('ctrl'); }
        if (event.metaKey) { modifiers.push('meta'); }
        if (event.shiftKey) { modifiers.push('shift'); }
        return modifiers;
    }

    /**
     * Gets an array of the active modifier keys and buttons.
     * @param {KeyboardEvent|MouseEvent|TouchEvent} event The event to check.
     * @returns {import('input').Modifier[]} An array of modifiers and buttons.
     */
    static getActiveModifiersAndButtons(event) {
        /** @type {import('input').Modifier[]} */
        const modifiers = this.getActiveModifiers(event);
        if (event instanceof MouseEvent) {
            this._getActiveButtons(event, modifiers);
        }
        return modifiers;
    }

    /**
     * Gets an array of the active buttons.
     * @param {MouseEvent} event The event to check.
     * @returns {import('input').ModifierMouseButton[]} An array of modifiers and buttons.
     */
    static getActiveButtons(event) {
        /** @type {import('input').ModifierMouseButton[]} */
        const buttons = [];
        this._getActiveButtons(event, buttons);
        return buttons;
    }

    /**
     * Adds a fullscreen change event listener. This function handles all of the browser-specific variants.
     * @param {EventListener} onFullscreenChanged The event callback.
     * @param {?import('../core/event-listener-collection.js').EventListenerCollection} eventListenerCollection An optional `EventListenerCollection` to add the registration to.
     */
    static addFullscreenChangeEventListener(onFullscreenChanged, eventListenerCollection = null) {
        const target = document;
        const options = false;
        const fullscreenEventNames = [
            'fullscreenchange',
            'MSFullscreenChange',
            'mozfullscreenchange',
            'webkitfullscreenchange'
        ];
        for (const eventName of fullscreenEventNames) {
            if (eventListenerCollection === null) {
                target.addEventListener(eventName, onFullscreenChanged, options);
            } else {
                eventListenerCollection.addEventListener(target, eventName, onFullscreenChanged, options);
            }
        }
    }

    /**
     * Returns the current fullscreen element. This function handles all of the browser-specific variants.
     * @returns {?Element} The current fullscreen element, or `null` if the window is not fullscreen.
     */
    static getFullscreenElement() {
        return (
            document.fullscreenElement ||
            // @ts-expect-error - vendor prefix
            document.msFullscreenElement ||
            // @ts-expect-error - vendor prefix
            document.mozFullScreenElement ||
            // @ts-expect-error - vendor prefix
            document.webkitFullscreenElement ||
            null
        );
    }

    /**
     * Gets all of the nodes within a `Range`.
     * @param {Range} range The range to check.
     * @returns {Node[]} The list of nodes.
     */
    static getNodesInRange(range) {
        const end = range.endContainer;
        const nodes = [];
        for (let node = /** @type {?Node} */ (range.startContainer); node !== null; node = this.getNextNode(node)) {
            nodes.push(node);
            if (node === end) { break; }
        }
        return nodes;
    }

    /**
     * Gets the next node after a specified node. This traverses the DOM in its logical order.
     * @param {Node} node The node to start at.
     * @returns {?Node} The next node, or `null` if there is no next node.
     */
    static getNextNode(node) {
        let next = /** @type {?Node} */ (node.firstChild);
        if (next === null) {
            while (true) {
                next = node.nextSibling;
                if (next !== null) { break; }

                next = node.parentNode;
                if (next === null) { break; }

                node = next;
            }
        }
        return next;
    }

    /**
     * Checks whether any node in a list of nodes matches a selector.
     * @param {Node[]} nodes The list of ndoes to check.
     * @param {string} selector The selector to test.
     * @returns {boolean} `true` if any element node matches the selector, `false` otherwise.
     */
    static anyNodeMatchesSelector(nodes, selector) {
        const ELEMENT_NODE = Node.ELEMENT_NODE;
        // This is a rather ugly way of getting the "node" variable to be a nullable
        for (let node of /** @type {(?Node)[]} */ (nodes)) {
            while (node !== null) {
                if (node.nodeType !== ELEMENT_NODE) {
                    node = node.parentNode;
                    continue;
                }
                if (/** @type {HTMLElement} */ (node).matches(selector)) { return true; }
                break;
            }
        }
        return false;
    }

    /**
     * Checks whether every node in a list of nodes matches a selector.
     * @param {Node[]} nodes The list of ndoes to check.
     * @param {string} selector The selector to test.
     * @returns {boolean} `true` if every element node matches the selector, `false` otherwise.
     */
    static everyNodeMatchesSelector(nodes, selector) {
        const ELEMENT_NODE = Node.ELEMENT_NODE;
        // This is a rather ugly way of getting the "node" variable to be a nullable
        for (let node of /** @type {(?Node)[]} */ (nodes)) {
            while (true) {
                if (node === null) { return false; }
                if (node.nodeType === ELEMENT_NODE && /** @type {HTMLElement} */ (node).matches(selector)) { break; }
                node = node.parentNode;
            }
        }
        return true;
    }

    /**
     * Checks whether the meta key is supported in the browser on the specified operating system.
     * @param {string} os The operating system to check.
     * @param {string} browser The browser to check.
     * @returns {boolean} `true` if supported, `false` otherwise.
     */
    static isMetaKeySupported(os, browser) {
        return !(browser === 'firefox' || browser === 'firefox-mobile') || os === 'mac';
    }

    /**
     * Checks whether an element on the page that can accept input is focused.
     * @returns {boolean} `true` if an input element is focused, `false` otherwise.
     */
    static isInputElementFocused() {
        const element = document.activeElement;
        if (element === null) { return false; }
        const type = element.nodeName.toUpperCase();
        switch (type) {
            case 'INPUT':
            case 'TEXTAREA':
            case 'SELECT':
                return true;
            default:
                return element instanceof HTMLElement && element.isContentEditable;
        }
    }

    /**
     * Offsets an array of DOMRects by a given amount.
     * @param {DOMRect[]} rects The DOMRects to offset.
     * @param {number} x The horizontal offset amount.
     * @param {number} y The vertical offset amount.
     * @returns {DOMRect[]} The DOMRects with the offset applied.
     */
    static offsetDOMRects(rects, x, y) {
        const results = [];
        for (const rect of rects) {
            results.push(new DOMRect(rect.left + x, rect.top + y, rect.width, rect.height));
        }
        return results;
    }

    /**
     * Gets the parent writing mode of an element.
     * See: https://developer.mozilla.org/en-US/docs/Web/CSS/writing-mode.
     * @param {?Element} element The HTML element to check.
     * @returns {import('document-util').NormalizedWritingMode} The writing mode.
     */
    static getElementWritingMode(element) {
        if (element !== null) {
            const {writingMode} = getComputedStyle(element);
            if (typeof writingMode === 'string') {
                return this.normalizeWritingMode(writingMode);
            }
        }
        return 'horizontal-tb';
    }

    /**
     * Normalizes a CSS writing mode value by converting non-standard and deprecated values
     * into their corresponding standard vaules.
     * @param {string} writingMode The writing mode to normalize.
     * @returns {import('document-util').NormalizedWritingMode} The normalized writing mode.
     */
    static normalizeWritingMode(writingMode) {
        switch (writingMode) {
            case 'tb':
                return 'vertical-lr';
            case 'tb-rl':
                return 'vertical-rl';
            case 'horizontal-tb':
            case 'vertical-rl':
            case 'vertical-lr':
            case 'sideways-rl':
            case 'sideways-lr':
                return writingMode;
            default: // 'lr', 'lr-tb', 'rl'
                return 'horizontal-tb';
        }
    }

    /**
     * Converts a value from an element to a number.
     * @param {string} valueString A string representation of a number.
     * @param {import('document-util').ToNumberConstraints} constraints An object which might contain `min`, `max`, and `step` fields which are used to constrain the value.
     * @returns {number} The parsed and constrained number.
     */
    static convertElementValueToNumber(valueString, constraints) {
        let value = Number.parseFloat(valueString);
        if (!Number.isFinite(value)) { value = 0; }

        const min = this._convertToNumberOrNull(constraints.min);
        const max = this._convertToNumberOrNull(constraints.max);
        const step = this._convertToNumberOrNull(constraints.step);
        if (typeof min === 'number') { value = Math.max(value, min); }
        if (typeof max === 'number') { value = Math.min(value, max); }
        if (typeof step === 'number' && step !== 0) { value = Math.round(value / step) * step; }
        return value;
    }

    /**
     * @param {string} value
     * @returns {?import('input').Modifier}
     */
    static normalizeModifier(value) {
        switch (value) {
            case 'alt':
            case 'ctrl':
            case 'meta':
            case 'shift':
            case 'mouse0':
            case 'mouse1':
            case 'mouse2':
            case 'mouse3':
            case 'mouse4':
            case 'mouse5':
                return value;
            default:
                return null;
        }
    }

    /**
     * @param {string} value
     * @returns {?import('input').ModifierKey}
     */
    static normalizeModifierKey(value) {
        switch (value) {
            case 'alt':
            case 'ctrl':
            case 'meta':
            case 'shift':
                return value;
            default:
                return null;
        }
    }

    // Private

    /**
     * @param {MouseEvent} event The event to check.
     * @param {import('input').ModifierMouseButton[]|import('input').Modifier[]} array
     */
    static _getActiveButtons(event, array) {
        let {buttons} = event;
        if (typeof buttons === 'number' && buttons > 0) {
            for (let i = 0; i < 6; ++i) {
                const buttonFlag = (1 << i);
                if ((buttons & buttonFlag) !== 0) {
                    array.push(/** @type {import('input').ModifierMouseButton} */ (`mouse${i}`));
                    buttons &= ~buttonFlag;
                    if (buttons === 0) { break; }
                }
            }
        }
    }

    /**
     * @param {CSSStyleDeclaration} style
     * @param {string} propertyName
     * @param {string} value
     */
    static _setImposterStyle(style, propertyName, value) {
        style.setProperty(propertyName, value, 'important');
    }

    /**
     * @param {HTMLInputElement|HTMLTextAreaElement} element
     * @param {boolean} isTextarea
     * @returns {[imposter: ?HTMLDivElement, container: ?HTMLDivElement]}
     */
    static _createImposter(element, isTextarea) {
        const body = document.body;
        if (body === null) { return [null, null]; }

        const elementStyle = window.getComputedStyle(element);
        const elementRect = element.getBoundingClientRect();
        const documentRect = document.documentElement.getBoundingClientRect();
        let left = elementRect.left - documentRect.left;
        let top = elementRect.top - documentRect.top;

        // Container
        const container = document.createElement('div');
        const containerStyle = container.style;
        this._setImposterStyle(containerStyle, 'all', 'initial');
        this._setImposterStyle(containerStyle, 'position', 'absolute');
        this._setImposterStyle(containerStyle, 'left', '0');
        this._setImposterStyle(containerStyle, 'top', '0');
        this._setImposterStyle(containerStyle, 'width', `${documentRect.width}px`);
        this._setImposterStyle(containerStyle, 'height', `${documentRect.height}px`);
        this._setImposterStyle(containerStyle, 'overflow', 'hidden');
        this._setImposterStyle(containerStyle, 'opacity', '0');
        this._setImposterStyle(containerStyle, 'pointer-events', 'none');
        this._setImposterStyle(containerStyle, 'z-index', '2147483646');

        // Imposter
        const imposter = document.createElement('div');
        const imposterStyle = imposter.style;

        let value = element.value;
        if (value.endsWith('\n')) { value += '\n'; }
        imposter.textContent = value;

        for (let i = 0, ii = elementStyle.length; i < ii; ++i) {
            const property = elementStyle[i];
            this._setImposterStyle(imposterStyle, property, elementStyle.getPropertyValue(property));
        }
        this._setImposterStyle(imposterStyle, 'position', 'absolute');
        this._setImposterStyle(imposterStyle, 'top', `${top}px`);
        this._setImposterStyle(imposterStyle, 'left', `${left}px`);
        this._setImposterStyle(imposterStyle, 'margin', '0');
        this._setImposterStyle(imposterStyle, 'pointer-events', 'auto');

        if (isTextarea) {
            if (elementStyle.overflow === 'visible') {
                this._setImposterStyle(imposterStyle, 'overflow', 'auto');
            }
        } else {
            this._setImposterStyle(imposterStyle, 'overflow', 'hidden');
            this._setImposterStyle(imposterStyle, 'white-space', 'nowrap');
            this._setImposterStyle(imposterStyle, 'line-height', elementStyle.height);
        }

        container.appendChild(imposter);
        body.appendChild(container);

        // Adjust size
        const imposterRect = imposter.getBoundingClientRect();
        if (imposterRect.width !== elementRect.width || imposterRect.height !== elementRect.height) {
            const width = parseFloat(elementStyle.width) + (elementRect.width - imposterRect.width);
            const height = parseFloat(elementStyle.height) + (elementRect.height - imposterRect.height);
            this._setImposterStyle(imposterStyle, 'width', `${width}px`);
            this._setImposterStyle(imposterStyle, 'height', `${height}px`);
        }
        if (imposterRect.left !== elementRect.left || imposterRect.top !== elementRect.top) {
            left += (elementRect.left - imposterRect.left);
            top += (elementRect.top - imposterRect.top);
            this._setImposterStyle(imposterStyle, 'left', `${left}px`);
            this._setImposterStyle(imposterStyle, 'top', `${top}px`);
        }

        imposter.scrollTop = element.scrollTop;
        imposter.scrollLeft = element.scrollLeft;

        return [imposter, container];
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {boolean} all
     * @returns {Element[]}
     */
    static _getElementsFromPoint(x, y, all) {
        if (all) {
            // document.elementsFromPoint can return duplicates which must be removed.
            const elements = document.elementsFromPoint(x, y);
            return elements.filter((e, i) => elements.indexOf(e) === i);
        }

        const e = document.elementFromPoint(x, y);
        return e !== null ? [e] : [];
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {Range} range
     * @param {boolean} normalizeCssZoom
     * @returns {boolean}
     */
    static _isPointInRange(x, y, range, normalizeCssZoom) {
        // Require a text node to start
        const {startContainer} = range;
        if (startContainer.nodeType !== Node.TEXT_NODE) {
            return false;
        }

        // Convert CSS zoom coordinates
        if (normalizeCssZoom) {
            const scale = this.computeZoomScale(startContainer);
            x /= scale;
            y /= scale;
        }

        // Scan forward
        const nodePre = range.endContainer;
        const offsetPre = range.endOffset;
        try {
            const {node, offset, content} = new DOMTextScanner(nodePre, offsetPre, true, false).seek(1);
            range.setEnd(node, offset);

            if (!this._isWhitespace(content) && this.isPointInAnyRect(x, y, range.getClientRects())) {
                return true;
            }
        } finally {
            range.setEnd(nodePre, offsetPre);
        }

        // Scan backward
        const {node, offset, content} = new DOMTextScanner(startContainer, range.startOffset, true, false).seek(-1);
        range.setStart(node, offset);

        if (!this._isWhitespace(content) && this.isPointInAnyRect(x, y, range.getClientRects())) {
            // This purposefully leaves the starting offset as modified and sets the range length to 0.
            range.setEnd(node, offset);
            return true;
        }

        // No match
        return false;
    }

    /**
     * @param {string} string
     * @returns {boolean}
     */
    static _isWhitespace(string) {
        return string.trim().length === 0;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {?Range}
     */
    static _caretRangeFromPoint(x, y) {
        if (typeof document.caretRangeFromPoint === 'function') {
            // Chrome, Edge
            return document.caretRangeFromPoint(x, y);
        }

        // @ts-expect-error - caretPositionFromPoint is non-standard
        if (typeof document.caretPositionFromPoint === 'function') {
            // Firefox
            return this._caretPositionFromPoint(x, y);
        }

        // No support
        return null;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {?Range}
     */
    static _caretPositionFromPoint(x, y) {
        // @ts-expect-error - caretPositionFromPoint is non-standard
        const position = /** @type {(x: number, y: number) => ?{offsetNode: Node, offset: number}} */ (document.caretPositionFromPoint)(x, y);
        if (position === null) {
            return null;
        }
        const node = position.offsetNode;
        if (node === null) {
            return null;
        }

        let offset = 0;
        const {nodeType} = node;
        switch (nodeType) {
            case Node.TEXT_NODE:
                offset = position.offset;
                break;
            case Node.ELEMENT_NODE:
                // Elements with user-select: all will return the element
                // instead of a text point inside the element.
                if (this._isElementUserSelectAll(/** @type {Element} */ (node))) {
                    return this._caretPositionFromPointNormalizeStyles(x, y, /** @type {Element} */ (node));
                }
                break;
        }

        try {
            const range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset);
            return range;
        } catch (e) {
            // Firefox throws new DOMException("The operation is insecure.")
            // when trying to select a node from within a ShadowRoot.
            return null;
        }
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {Element} nextElement
     * @returns {?Range}
     */
    static _caretPositionFromPointNormalizeStyles(x, y, nextElement) {
        const previousStyles = new Map();
        try {
            while (true) {
                if (nextElement instanceof HTMLElement) {
                    this._recordPreviousStyle(previousStyles, nextElement);
                    nextElement.style.setProperty('user-select', 'text', 'important');
                }

                // @ts-expect-error - caretPositionFromPoint is non-standard
                const position = /** @type {(x: number, y: number) => ?{offsetNode: Node, offset: number}} */ (document.caretPositionFromPoint)(x, y);
                if (position === null) {
                    return null;
                }
                const node = position.offsetNode;
                if (node === null) {
                    return null;
                }

                let offset = 0;
                const {nodeType} = node;
                switch (nodeType) {
                    case Node.TEXT_NODE:
                        offset = position.offset;
                        break;
                    case Node.ELEMENT_NODE:
                        // Elements with user-select: all will return the element
                        // instead of a text point inside the element.
                        if (this._isElementUserSelectAll(/** @type {Element} */ (node))) {
                            if (previousStyles.has(node)) {
                                // Recursive
                                return null;
                            }
                            nextElement = /** @type {Element} */ (node);
                            continue;
                        }
                        break;
                }

                try {
                    const range = document.createRange();
                    range.setStart(node, offset);
                    range.setEnd(node, offset);
                    return range;
                } catch (e) {
                    // Firefox throws new DOMException("The operation is insecure.")
                    // when trying to select a node from within a ShadowRoot.
                    return null;
                }
            }
        } finally {
            this._revertStyles(previousStyles);
        }
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {Element[]} elements
     * @param {boolean} normalizeCssZoom
     * @returns {?Range}
     */
    static _caretRangeFromPointExt(x, y, elements, normalizeCssZoom) {
        let previousStyles = null;
        try {
            let i = 0;
            let startContinerPre = null;
            while (true) {
                const range = this._caretRangeFromPoint(x, y);
                if (range === null) {
                    return null;
                }

                const startContainer = range.startContainer;
                if (startContinerPre !== startContainer) {
                    if (this._isPointInRange(x, y, range, normalizeCssZoom)) {
                        return range;
                    }
                    startContinerPre = startContainer;
                }

                if (previousStyles === null) { previousStyles = new Map(); }
                i = this._disableTransparentElement(elements, i, previousStyles);
                if (i < 0) {
                    return null;
                }
            }
        } finally {
            if (previousStyles !== null && previousStyles.size > 0) {
                this._revertStyles(previousStyles);
            }
        }
    }

    /**
     * @param {Element[]} elements
     * @param {number} i
     * @param {Map<Element, ?string>} previousStyles
     * @returns {number}
     */
    static _disableTransparentElement(elements, i, previousStyles) {
        while (true) {
            if (i >= elements.length) {
                return -1;
            }

            const element = elements[i++];
            if (this._isElementTransparent(element)) {
                if (element instanceof HTMLElement) {
                    this._recordPreviousStyle(previousStyles, element);
                    element.style.setProperty('pointer-events', 'none', 'important');
                }
                return i;
            }
        }
    }

    /**
     * @param {Map<Element, ?string>} previousStyles
     * @param {Element} element
     */
    static _recordPreviousStyle(previousStyles, element) {
        if (previousStyles.has(element)) { return; }
        const style = element.hasAttribute('style') ? element.getAttribute('style') : null;
        previousStyles.set(element, style);
    }

    /**
     * @param {Map<Element, ?string>} previousStyles
     */
    static _revertStyles(previousStyles) {
        for (const [element, style] of previousStyles.entries()) {
            if (style === null) {
                element.removeAttribute('style');
            } else {
                element.setAttribute('style', style);
            }
        }
    }

    /**
     * @param {Element} element
     * @returns {boolean}
     */
    static _isElementTransparent(element) {
        if (
            element === document.body ||
            element === document.documentElement
        ) {
            return false;
        }
        const style = window.getComputedStyle(element);
        return (
            parseFloat(style.opacity) <= 0 ||
            style.visibility === 'hidden' ||
            (style.backgroundImage === 'none' && this._isColorTransparent(style.backgroundColor))
        );
    }

    /**
     * @param {string} cssColor
     * @returns {boolean}
     */
    static _isColorTransparent(cssColor) {
        return this._transparentColorPattern.test(cssColor);
    }

    /**
     * @param {Element} element
     * @returns {boolean}
     */
    static _isElementUserSelectAll(element) {
        return getComputedStyle(element).userSelect === 'all';
    }

    /**
     * @param {string|number|undefined} value
     * @returns {?number}
     */
    static _convertToNumberOrNull(value) {
        if (typeof value !== 'number') {
            if (typeof value !== 'string' || value.length === 0) {
                return null;
            }
            value = parseFloat(value);
        }
        return !Number.isNaN(value) ? value : null;
    }

    /**
     * Computes whether or not this browser and document supports CSS zoom, which is primarily a legacy Chromium feature.
     * @returns {boolean}
     */
    static _computeCssZoomSupported() {
        // 'style' can be undefined in certain contexts, such as when document is an SVG document.
        const {style} = document.createElement('div');
        // @ts-expect-error - zoom is a non-standard property.
        return (typeof style === 'object' && style !== null && typeof style.zoom === 'string');
    }
}
