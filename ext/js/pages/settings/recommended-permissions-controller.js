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

import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {toError} from '../../core/to-error.js';

export class RecommendedPermissionsController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {?NodeListOf<HTMLInputElement>} */
        this._originToggleNodes = null;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {?HTMLElement} */
        this._errorContainer = null;
    }

    /** */
    async prepare() {
        this._originToggleNodes = document.querySelectorAll('.recommended-permissions-toggle');
        this._errorContainer = document.querySelector('#recommended-permissions-error');
        for (const node of this._originToggleNodes) {
            node.addEventListener('change', this._onOriginToggleChange.bind(this), false);
        }

        this._settingsController.on('permissionsChanged', this._onPermissionsChanged.bind(this));
        await this._updatePermissions();
    }

    // Private

    /**
     * @param {import('settings-controller').EventArgument<'permissionsChanged'>} details
     */
    _onPermissionsChanged({permissions}) {
        this._eventListeners.removeAllEventListeners();
        const originsSet = new Set(permissions.origins);
        if (this._originToggleNodes !== null) {
            for (const node of this._originToggleNodes) {
                const {origin} = node.dataset;
                node.checked = typeof origin === 'string' && originsSet.has(origin);
            }
        }
    }

    /**
     * @param {Event} e
     */
    _onOriginToggleChange(e) {
        const node = /** @type {HTMLInputElement} */ (e.currentTarget);
        const value = node.checked;
        node.checked = !value;

        const {origin} = node.dataset;
        if (typeof origin !== 'string') { return; }
        this._setOriginPermissionEnabled(origin, value);
    }

    /** */
    async _updatePermissions() {
        const permissions = await this._settingsController.permissionsUtil.getAllPermissions();
        this._onPermissionsChanged({permissions});
    }

    /**
     * @param {string} origin
     * @param {boolean} enabled
     * @returns {Promise<boolean>}
     */
    async _setOriginPermissionEnabled(origin, enabled) {
        let added = false;
        try {
            added = await this._settingsController.permissionsUtil.setPermissionsGranted({origins: [origin]}, enabled);
        } catch (e) {
            if (this._errorContainer !== null) {
                this._errorContainer.hidden = false;
                this._errorContainer.textContent = toError(e).message;
            }
        }
        if (!added) { return false; }
        await this._updatePermissions();
        return true;
    }
}
