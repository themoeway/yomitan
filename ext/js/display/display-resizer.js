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

import {EventListenerCollection} from '../core/event-listener-collection.js';

export class DisplayResizer {
    /**
     * @param {import('./display.js').Display} display
     */
    constructor(display) {
        /** @type {import('./display.js').Display} */
        this._display = display;
        /** @type {?import('core').TokenObject} */
        this._token = null;
        /** @type {?HTMLElement} */
        this._handle = null;
        /** @type {?number} */
        this._touchIdentifier = null;
        /** @type {?{width: number, height: number}} */
        this._startSize = null;
        /** @type {?{x: number, y: number}} */
        this._startOffset = null;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
    }

    /** */
    prepare() {
        this._handle = document.querySelector('#frame-resizer-handle');
        if (this._handle === null) { return; }

        this._handle.addEventListener('mousedown', this._onFrameResizerMouseDown.bind(this), false);
        this._handle.addEventListener('touchstart', this._onFrameResizerTouchStart.bind(this), {passive: false, capture: false});
    }

    // Private

    /**
     * @param {MouseEvent} e
     */
    _onFrameResizerMouseDown(e) {
        if (e.button !== 0) { return; }
        // Don't do e.preventDefault() here; this allows mousemove events to be processed
        // if the pointer moves out of the frame.
        this._startFrameResize(e);
    }

    /**
     * @param {TouchEvent} e
     */
    _onFrameResizerTouchStart(e) {
        e.preventDefault();
        this._startFrameResizeTouch(e);
    }

    /** */
    _onFrameResizerMouseUp() {
        this._stopFrameResize();
    }

    /** */
    _onFrameResizerWindowBlur() {
        this._stopFrameResize();
    }

    /**
     * @param {MouseEvent} e
     */
    _onFrameResizerMouseMove(e) {
        if ((e.buttons & 0x1) === 0x0) {
            this._stopFrameResize();
        } else {
            if (this._startSize === null) { return; }
            const {clientX: x, clientY: y} = e;
            this._updateFrameSize(x, y);
        }
    }

    /**
     * @param {TouchEvent} e
     */
    _onFrameResizerTouchEnd(e) {
        if (this._getTouch(e.changedTouches, this._touchIdentifier) === null) { return; }
        this._stopFrameResize();
    }

    /**
     * @param {TouchEvent} e
     */
    _onFrameResizerTouchCancel(e) {
        if (this._getTouch(e.changedTouches, this._touchIdentifier) === null) { return; }
        this._stopFrameResize();
    }

    /**
     * @param {TouchEvent} e
     */
    _onFrameResizerTouchMove(e) {
        if (this._startSize === null) { return; }
        const primaryTouch = this._getTouch(e.changedTouches, this._touchIdentifier);
        if (primaryTouch === null) { return; }
        const {clientX: x, clientY: y} = primaryTouch;
        this._updateFrameSize(x, y);
    }

    /**
     * @param {MouseEvent} e
     */
    _startFrameResize(e) {
        if (this._token !== null) { return; }

        const {clientX: x, clientY: y} = e;
        /** @type {?import('core').TokenObject} */
        const token = {};
        this._token = token;
        this._startOffset = {x, y};
        this._eventListeners.addEventListener(window, 'mouseup', this._onFrameResizerMouseUp.bind(this), false);
        this._eventListeners.addEventListener(window, 'blur', this._onFrameResizerWindowBlur.bind(this), false);
        this._eventListeners.addEventListener(window, 'mousemove', this._onFrameResizerMouseMove.bind(this), false);

        const {documentElement} = document;
        if (documentElement !== null) {
            documentElement.dataset.isResizing = 'true';
        }

        this._initializeFrameResize(token);
    }

    /**
     * @param {TouchEvent} e
     */
    _startFrameResizeTouch(e) {
        if (this._token !== null) { return; }

        const {clientX: x, clientY: y, identifier} = e.changedTouches[0];
        /** @type {?import('core').TokenObject} */
        const token = {};
        this._token = token;
        this._startOffset = {x, y};
        this._touchIdentifier = identifier;
        this._eventListeners.addEventListener(window, 'touchend', this._onFrameResizerTouchEnd.bind(this), false);
        this._eventListeners.addEventListener(window, 'touchcancel', this._onFrameResizerTouchCancel.bind(this), false);
        this._eventListeners.addEventListener(window, 'blur', this._onFrameResizerWindowBlur.bind(this), false);
        this._eventListeners.addEventListener(window, 'touchmove', this._onFrameResizerTouchMove.bind(this), false);

        const {documentElement} = document;
        if (documentElement !== null) {
            documentElement.dataset.isResizing = 'true';
        }

        this._initializeFrameResize(token);
    }

    /**
     * @param {import('core').TokenObject} token
     */
    async _initializeFrameResize(token) {
        const {parentPopupId} = this._display;
        if (parentPopupId === null) { return; }

        /** @type {import('popup').ValidSize} */
        const size = await this._display.invokeParentFrame('popupFactoryGetFrameSize', {id: parentPopupId});
        if (this._token !== token) { return; }
        const {width, height} = size;
        this._startSize = {width, height};
    }

    /** */
    _stopFrameResize() {
        if (this._token === null) { return; }

        this._eventListeners.removeAllEventListeners();
        this._startSize = null;
        this._startOffset = null;
        this._touchIdentifier = null;
        this._token = null;

        const {documentElement} = document;
        if (documentElement !== null) {
            delete documentElement.dataset.isResizing;
        }
    }

    /**
     * @param {number} x
     * @param {number} y
     */
    async _updateFrameSize(x, y) {
        const {parentPopupId} = this._display;
        if (parentPopupId === null || this._handle === null || this._startOffset === null || this._startSize === null) { return; }

        const handleSize = this._handle.getBoundingClientRect();
        let {width, height} = this._startSize;
        width += x - this._startOffset.x;
        height += y - this._startOffset.y;
        width = Math.max(Math.max(0, handleSize.width), width);
        height = Math.max(Math.max(0, handleSize.height), height);
        await this._display.invokeParentFrame('popupFactorySetFrameSize', {id: parentPopupId, width, height});
    }

    /**
     * @param {TouchList} touchList
     * @param {?number} identifier
     * @returns {?Touch}
     */
    _getTouch(touchList, identifier) {
        for (const touch of touchList) {
            if (touch.identifier === identifier) {
                return touch;
            }
        }
        return null;
    }
}
