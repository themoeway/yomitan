/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2019-2022  Yomichan Authors
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

import {querySelectorNotNull} from '../../dom/query-selector.js';
import {yomitan} from '../../yomitan.js';

export class StorageController {
    /**
     * @param {import('./persistent-storage-controller.js').PersistentStorageController} persistentStorageController
     */
    constructor(persistentStorageController) {
    /** @type {import('./persistent-storage-controller.js').PersistentStorageController} */
        this._persistentStorageController = persistentStorageController;
        /** @type {?StorageEstimate} */
        this._mostRecentStorageEstimate = null;
        /** @type {boolean} */
        this._storageEstimateFailed = false;
        /** @type {boolean} */
        this._isUpdating = false;
        /** @type {?NodeListOf<HTMLElement>} */
        this._storageUsageNodes = null;
        /** @type {?NodeListOf<HTMLElement>} */
        this._storageQuotaNodes = null;
        /** @type {?NodeListOf<HTMLElement>} */
        this._storageUseFiniteNodes = null;
        /** @type {?NodeListOf<HTMLElement>} */
        this._storageUseExhaustWarnNodes = null;
        /** @type {?NodeListOf<HTMLElement>} */
        this._storageUseInfiniteNodes = null;
        /** @type {?NodeListOf<HTMLElement>} */
        this._storageUseValidNodes = null;
        /** @type {?NodeListOf<HTMLElement>} */
        this._storageUseInvalidNodes = null;
    }

    /** */
    prepare() {
        this._storageUsageNodes = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.storage-usage'));
        this._storageQuotaNodes = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.storage-quota'));
        this._storageUseFiniteNodes = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.storage-use-finite'));
        this._storageUseExhaustWarnNodes = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.storage-exhaustion-alert'));
        this._storageUseInfiniteNodes = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.storage-use-infinite'));
        this._storageUseValidNodes = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.storage-use-valid'));
        this._storageUseInvalidNodes = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.storage-use-invalid'));
        /** @type {HTMLButtonElement} */
        const storageRefreshButton = querySelectorNotNull(document, '#storage-refresh');

        storageRefreshButton.addEventListener('click', this._onStorageRefreshButtonClick.bind(this), false);
        yomitan.on('storageChanged', this._onStorageChanged.bind(this));

        this._updateStats();
    }

    // Private

    /** */
    _onStorageRefreshButtonClick() {
        this._updateStats();
    }

    /** */
    _onStorageChanged() {
        this._updateStats();
    }

    /** */
    async _updateStats() {
        if (this._isUpdating) { return; }

        try {
            this._isUpdating = true;

            const estimate = await this._storageEstimate();
            const valid = (estimate !== null);
            let storageIsLow = false;

            // Firefox reports usage as 0 when persistent storage is enabled.
            const finite = valid && ((typeof estimate.usage === 'number' && estimate.usage > 0) || !(await this._persistentStorageController.isStoragePeristent()));
            if (finite) {
                let {usage, quota} = estimate;

                if (typeof usage !== 'number') { usage = 0; }
                if (typeof quota !== 'number') {
                    quota = 0;
                } else {
                    storageIsLow = quota <= (3 * 1000000000);
                }
                const usageString = this._bytesToLabeledString(usage);
                const quotaString = this._bytesToLabeledString(quota);
                for (const node of /** @type {NodeListOf<HTMLElement>} */ (this._storageUsageNodes)) {
                    node.textContent = usageString;
                }
                for (const node of /** @type {NodeListOf<HTMLElement>} */ (this._storageQuotaNodes)) {
                    node.textContent = quotaString;
                }
            }

            this._setElementsVisible(this._storageUseFiniteNodes, valid && finite);
            this._setElementsVisible(this._storageUseInfiniteNodes, valid && !finite);
            this._setElementsVisible(this._storageUseValidNodes, valid);
            this._setElementsVisible(this._storageUseInvalidNodes, !valid);
            this._setElementsVisible(this._storageUseExhaustWarnNodes, storageIsLow);
        } finally {
            this._isUpdating = false;
        }
    }

    // Private

    /**
     * @returns {Promise<?StorageEstimate>}
     */
    async _storageEstimate() {
        if (this._storageEstimateFailed && this._mostRecentStorageEstimate === null) {
            return null;
        }
        try {
            const value = await navigator.storage.estimate();
            this._mostRecentStorageEstimate = value;
            return value;
        } catch (e) {
            this._storageEstimateFailed = true;
        }
        return null;
    }

    /**
     * @param {number} size
     * @returns {string}
     */
    _bytesToLabeledString(size) {
        const base = 1000;
        const labels = [' bytes', 'KB', 'MB', 'GB', 'TB'];
        const maxLabelIndex = labels.length - 1;
        let labelIndex = 0;
        while (size >= base && labelIndex < maxLabelIndex) {
            size /= base;
            ++labelIndex;
        }
        const label = labelIndex === 0 ? `${size}` : size.toFixed(1);
        return `${label}${labels[labelIndex]}`;
    }

    /**
     * @param {?NodeListOf<HTMLElement>} elements
     * @param {boolean} visible
     */
    _setElementsVisible(elements, visible) {
        if (elements === null) { return; }
        visible = !visible;
        for (const element of elements) {
            element.hidden = visible;
        }
    }
}
