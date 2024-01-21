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

import {EventDispatcher} from '../core/event-dispatcher.js';
import {EventListenerCollection} from '../core/event-listener-collection.js';
import {querySelectorNotNull} from './query-selector.js';

/**
 * @augments EventDispatcher<import('popup-menu').Events>
 */
export class PopupMenu extends EventDispatcher {
    /**
     * @param {HTMLElement} sourceElement
     * @param {HTMLElement} containerNode
     */
    constructor(sourceElement, containerNode) {
        super();
        /** @type {HTMLElement} */
        this._sourceElement = sourceElement;
        /** @type {HTMLElement} */
        this._containerNode = containerNode;
        /** @type {HTMLElement} */
        this._node = querySelectorNotNull(containerNode, '.popup-menu');
        /** @type {HTMLElement} */
        this._bodyNode = querySelectorNotNull(containerNode, '.popup-menu-body');
        /** @type {boolean} */
        this._isClosed = false;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {EventListenerCollection} */
        this._itemEventListeners = new EventListenerCollection();
    }

    /** @type {HTMLElement} */
    get sourceElement() {
        return this._sourceElement;
    }

    /** @type {HTMLElement} */
    get containerNode() {
        return this._containerNode;
    }

    /** @type {HTMLElement} */
    get node() {
        return this._node;
    }

    /** @type {HTMLElement} */
    get bodyNode() {
        return this._bodyNode;
    }

    /** @type {boolean} */
    get isClosed() {
        return this._isClosed;
    }

    /** */
    prepare() {
        this._setPosition();
        this._containerNode.focus();

        this._eventListeners.addEventListener(window, 'resize', this._onWindowResize.bind(this), false);
        this._eventListeners.addEventListener(this._containerNode, 'click', this._onMenuContainerClick.bind(this), false);

        this.updateMenuItems();

        PopupMenu.openMenus.add(this);

        /** @type {import('popup-menu').MenuOpenEventDetails} */
        const detail = {menu: this};

        this._sourceElement.dispatchEvent(new CustomEvent('menuOpen', {
            bubbles: false,
            cancelable: false,
            detail
        }));
    }

    /**
     * @param {boolean} [cancelable]
     * @returns {boolean}
     */
    close(cancelable = true) {
        return this._close(null, 'close', cancelable, null);
    }

    /** */
    updateMenuItems() {
        this._itemEventListeners.removeAllEventListeners();
        const items = this._bodyNode.querySelectorAll('.popup-menu-item');
        const onMenuItemClick = this._onMenuItemClick.bind(this);
        for (const item of items) {
            this._itemEventListeners.addEventListener(item, 'click', onMenuItemClick, false);
        }
    }

    /** */
    updatePosition() {
        this._setPosition();
    }

    // Private

    /**
     * @param {MouseEvent} e
     */
    _onMenuContainerClick(e) {
        if (e.currentTarget !== e.target) { return; }
        if (this._close(null, 'outside', true, e)) {
            e.stopPropagation();
            e.preventDefault();
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onMenuItemClick(e) {
        const item = /** @type {HTMLButtonElement} */ (e.currentTarget);
        if (item.disabled) { return; }
        if (this._close(item, 'item', true, e)) {
            e.stopPropagation();
            e.preventDefault();
        }
    }

    /** */
    _onWindowResize() {
        this._close(null, 'resize', true, null);
    }

    /** */
    _setPosition() {
        // Get flags
        let horizontal = 1;
        let vertical = 1;
        let horizontalCover = 1;
        let verticalCover = 1;
        const positionInfo = this._sourceElement.dataset.menuPosition;
        if (typeof positionInfo === 'string') {
            const positionInfoSet = new Set(positionInfo.split(' '));

            if (positionInfoSet.has('left')) {
                horizontal = -1;
            } else if (positionInfoSet.has('right')) {
                horizontal = 1;
            } else if (positionInfoSet.has('h-center')) {
                horizontal = 0;
            }

            if (positionInfoSet.has('above')) {
                vertical = -1;
            } else if (positionInfoSet.has('below')) {
                vertical = 1;
            } else if (positionInfoSet.has('v-center')) {
                vertical = 0;
            }

            if (positionInfoSet.has('cover')) {
                horizontalCover = 1;
                verticalCover = 1;
            } else if (positionInfoSet.has('no-cover')) {
                horizontalCover = -1;
                verticalCover = -1;
            }

            if (positionInfoSet.has('h-cover')) {
                horizontalCover = 1;
            } else if (positionInfoSet.has('no-h-cover')) {
                horizontalCover = -1;
            }

            if (positionInfoSet.has('v-cover')) {
                verticalCover = 1;
            } else if (positionInfoSet.has('no-v-cover')) {
                verticalCover = -1;
            }
        }

        // Position
        const menu = this._node;
        const containerNodeRect = this._containerNode.getBoundingClientRect();
        const sourceElementRect = this._sourceElement.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        let top = menuRect.top;
        let bottom = menuRect.bottom;
        if (verticalCover === 1) {
            const bodyRect = this._bodyNode.getBoundingClientRect();
            top = bodyRect.top;
            bottom = bodyRect.bottom;
        }

        let x = (
            sourceElementRect.left +
            sourceElementRect.width * ((-horizontal * horizontalCover + 1) * 0.5) +
            menuRect.width * ((-horizontal + 1) * -0.5)
        );
        let y = (
            sourceElementRect.top +
            (menuRect.top - top) +
            sourceElementRect.height * ((-vertical * verticalCover + 1) * 0.5) +
            (bottom - top) * ((-vertical + 1) * -0.5)
        );

        x = Math.max(0.0, Math.min(containerNodeRect.width - menuRect.width, x));
        y = Math.max(0.0, Math.min(containerNodeRect.height - menuRect.height, y));

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
    }

    /**
     * @param {?HTMLElement} item
     * @param {import('popup-menu').CloseReason} cause
     * @param {boolean} cancelable
     * @param {?MouseEvent} originalEvent
     * @returns {boolean}
     */
    _close(item, cause, cancelable, originalEvent) {
        if (this._isClosed) { return true; }
        /** @type {?string} */
        let action = null;
        if (item !== null) {
            const {menuAction} = item.dataset;
            if (typeof menuAction === 'string') { action = menuAction; }
        }

        const {altKey, ctrlKey, metaKey, shiftKey} = (
            originalEvent !== null ?
            originalEvent :
            {altKey: false, ctrlKey: false, metaKey: false, shiftKey: false}
        );

        /** @type {import('popup-menu').EventArgument<'close'>} */
        const detail = {
            menu: this,
            item,
            action,
            cause,
            altKey,
            ctrlKey,
            metaKey,
            shiftKey
        };
        const result = this._sourceElement.dispatchEvent(new CustomEvent('menuClose', {bubbles: false, cancelable, detail}));
        if (cancelable && !result) { return false; }

        PopupMenu.openMenus.delete(this);

        this._isClosed = true;
        this._eventListeners.removeAllEventListeners();
        this._itemEventListeners.removeAllEventListeners();
        if (this._containerNode.parentNode !== null) {
            this._containerNode.parentNode.removeChild(this._containerNode);
        }

        this.trigger('close', detail);
        return true;
    }
}

Object.defineProperty(PopupMenu, 'openMenus', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: new Set()
});
