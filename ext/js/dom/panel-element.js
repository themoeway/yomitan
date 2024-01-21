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

/**
 * @augments EventDispatcher<import('panel-element').Events>
 */
export class PanelElement extends EventDispatcher {
    /**
     * @param {import('panel-element').ConstructorDetails} details
     */
    constructor({node, closingAnimationDuration}) {
        super();
        /** @type {HTMLElement} */
        this._node = node;
        /** @type {number} */
        this._closingAnimationDuration = closingAnimationDuration;
        /** @type {string} */
        this._hiddenAnimatingClass = 'hidden-animating';
        /** @type {?MutationObserver} */
        this._mutationObserver = null;
        /** @type {boolean} */
        this._visible = false;
        /** @type {?import('core').Timeout} */
        this._closeTimer = null;
    }

    /** @type {HTMLElement} */
    get node() {
        return this._node;
    }

    /**
     * @returns {boolean}
     */
    isVisible() {
        return !this._node.hidden;
    }

    /**
     * @param {boolean} value
     * @param {boolean} [animate]
     */
    setVisible(value, animate = true) {
        value = !!value;
        if (this.isVisible() === value) { return; }

        if (this._closeTimer !== null) {
            clearTimeout(this._closeTimer);
            this._completeClose(true);
        }

        const node = this._node;
        const {classList} = node;
        if (value) {
            if (animate) { classList.add(this._hiddenAnimatingClass); }
            getComputedStyle(node).getPropertyValue('display'); // Force update of CSS display property, allowing animation
            classList.remove(this._hiddenAnimatingClass);
            node.hidden = false;
            node.focus();
        } else {
            if (animate) { classList.add(this._hiddenAnimatingClass); }
            node.hidden = true;
            if (animate) {
                this._closeTimer = setTimeout(() => this._completeClose(false), this._closingAnimationDuration);
            }
        }
    }

    /**
     * @template {import('core').EventNames<import('panel-element').Events>} TName
     * @param {TName} eventName
     * @param {(details: import('core').EventArgument<import('panel-element').Events, TName>) => void} callback
     */
    on(eventName, callback) {
        if (eventName === 'visibilityChanged') {
            if (this._mutationObserver === null) {
                this._visible = this.isVisible();
                this._mutationObserver = new MutationObserver(this._onMutation.bind(this));
                this._mutationObserver.observe(this._node, {
                    attributes: true,
                    attributeFilter: ['hidden'],
                    attributeOldValue: true
                });
            }
        }
        super.on(eventName, callback);
    }

    /**
     * @template {import('core').EventNames<import('panel-element').Events>} TName
     * @param {TName} eventName
     * @param {(details: import('core').EventArgument<import('panel-element').Events, TName>) => void} callback
     * @returns {boolean}
     */
    off(eventName, callback) {
        const result = super.off(eventName, callback);
        if (eventName === 'visibilityChanged' && !this.hasListeners(eventName)) {
            if (this._mutationObserver !== null) {
                this._mutationObserver.disconnect();
                this._mutationObserver = null;
            }
        }
        return result;
    }

    // Private

    /** */
    _onMutation() {
        const visible = this.isVisible();
        if (this._visible === visible) { return; }
        this._visible = visible;
        this.trigger('visibilityChanged', {visible});
    }

    /**
     * @param {boolean} reopening
     */
    _completeClose(reopening) {
        this._closeTimer = null;
        this._node.classList.remove(this._hiddenAnimatingClass);
        this.trigger('closeCompleted', {reopening});
    }
}
