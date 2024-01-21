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

import {PanelElement} from '../../dom/panel-element.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';

export class StatusFooter extends PanelElement {
    /**
     * @param {HTMLElement} node
     */
    constructor(node) {
        super({
            node,
            closingAnimationDuration: 375 // Milliseconds; includes buffer
        });
        /** @type {HTMLElement} */
        this._body = querySelectorNotNull(node, '.status-footer');
    }

    /** */
    prepare() {
        /** @type {HTMLElement} */
        const closeButton = querySelectorNotNull(this._body, '.status-footer-header-close');
        this.on('closeCompleted', this._onCloseCompleted.bind(this));
        closeButton.addEventListener('click', this._onCloseClick.bind(this), false);
    }

    /**
     * @param {string} selector
     * @returns {?HTMLElement}
     */
    getTaskContainer(selector) {
        return this._body.querySelector(selector);
    }

    /**
     * @param {string} selector
     * @returns {boolean}
     */
    isTaskActive(selector) {
        const target = this.getTaskContainer(selector);
        return (target !== null && !!target.dataset.active);
    }

    /**
     * @param {string} selector
     * @param {boolean} active
     */
    setTaskActive(selector, active) {
        const target = this.getTaskContainer(selector);
        if (target === null) { return; }

        const activeElements = new Set();
        for (const element of /** @type {NodeListOf<HTMLElement>} */ (this._body.querySelectorAll('.status-footer-item'))) {
            if (element.dataset.active) {
                activeElements.add(element);
            }
        }

        if (active) {
            target.dataset.active = 'true';
            if (!this.isVisible()) {
                this.setVisible(true);
            }
            target.hidden = false;
        } else {
            delete target.dataset.active;
            if (activeElements.size <= 1) {
                this.setVisible(false);
            }
        }
    }

    // Private

    /**
     * @param {MouseEvent} e
     */
    _onCloseClick(e) {
        e.preventDefault();
        this.setVisible(false);
    }

    /** */
    _onCloseCompleted() {
        for (const element of /** @type {NodeListOf<HTMLElement>} */ (this._body.querySelectorAll('.status-footer-item'))) {
            if (!element.dataset.active) {
                element.hidden = true;
            }
        }
    }
}
