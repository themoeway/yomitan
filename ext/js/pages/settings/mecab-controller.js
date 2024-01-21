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

import {toError} from '../../core/to-error.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {yomitan} from '../../yomitan.js';

export class MecabController {
    constructor() {
        /** @type {HTMLButtonElement} */
        this._testButton = querySelectorNotNull(document, '#test-mecab-button');
        /** @type {HTMLElement} */
        this._resultsContainer = querySelectorNotNull(document, '#test-mecab-results');
        /** @type {boolean} */
        this._testActive = false;
    }

    /** */
    prepare() {
        this._testButton.addEventListener('click', this._onTestButtonClick.bind(this), false);
    }

    // Private

    /**
     * @param {MouseEvent} e
     */
    _onTestButtonClick(e) {
        e.preventDefault();
        this._testMecab();
    }

    /** */
    async _testMecab() {
        if (this._testActive) { return; }

        try {
            this._testActive = true;
            const resultsContainer = /** @type {HTMLElement} */ (this._resultsContainer);
            /** @type {HTMLButtonElement} */ (this._testButton).disabled = true;
            resultsContainer.textContent = '';
            resultsContainer.hidden = true;
            await yomitan.api.testMecab();
            this._setStatus('Connection was successful', false);
        } catch (e) {
            this._setStatus(toError(e).message, true);
        } finally {
            this._testActive = false;
            /** @type {HTMLButtonElement} */ (this._testButton).disabled = false;
        }
    }

    /**
     * @param {string} message
     * @param {boolean} isError
     */
    _setStatus(message, isError) {
        const resultsContainer = /** @type {HTMLElement} */ (this._resultsContainer);
        resultsContainer.textContent = message;
        resultsContainer.hidden = false;
        resultsContainer.classList.toggle('danger-text', isError);
    }
}
