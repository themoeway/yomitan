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
import {querySelectorNotNull} from '../../dom/query-selector.js';

export class PermissionsOriginController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {HTMLElement} */
        this._originContainer = querySelectorNotNull(document, '#permissions-origin-list');
        /** @type {HTMLElement} */
        this._originEmpty = querySelectorNotNull(document, '#permissions-origin-list-empty');
        /** @type {?NodeListOf<HTMLInputElement>} */
        this._originToggleNodes = null;
        /** @type {HTMLInputElement} */
        this._addOriginInput = querySelectorNotNull(document, '#permissions-origin-new-input');
        /** @type {HTMLElement} */
        this._errorContainer = querySelectorNotNull(document, '#permissions-origin-list-error');
        /** @type {ChildNode[]} */
        this._originContainerChildren = [];
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
    }

    /** */
    async prepare() {
        this._originToggleNodes = /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('.permissions-origin-toggle'));
        /** @type {HTMLButtonElement} */
        const addButton = querySelectorNotNull(document, '#permissions-origin-add');

        for (const node of this._originToggleNodes) {
            node.addEventListener('change', this._onOriginToggleChange.bind(this), false);
        }
        addButton.addEventListener('click', this._onAddButtonClick.bind(this), false);

        this._settingsController.on('permissionsChanged', this._onPermissionsChanged.bind(this));
        await this._updatePermissions();
    }

    // Private

    /**
     * @param {import('settings-controller').EventArgument<'permissionsChanged'>} details
     */
    _onPermissionsChanged({permissions}) {
        this._eventListeners.removeAllEventListeners();
        for (const node of this._originContainerChildren) {
            if (node.parentNode === null) { continue; }
            node.parentNode.removeChild(node);
        }
        this._originContainerChildren = [];

        /** @type {Set<string>} */
        const originsSet = new Set(permissions.origins);
        for (const node of /** @type {NodeListOf<HTMLInputElement>} */ (this._originToggleNodes)) {
            const {origin} = node.dataset;
            node.checked = typeof origin === 'string' && originsSet.has(origin);
        }

        let any = false;
        const excludeOrigins = new Set([
            '<all_urls>'
        ]);
        const fragment = document.createDocumentFragment();
        for (const origin of originsSet) {
            if (excludeOrigins.has(origin)) { continue; }
            const node = this._settingsController.instantiateTemplateFragment('permissions-origin');
            /** @type {HTMLInputElement} */
            const input = querySelectorNotNull(node, '.permissions-origin-input');
            /** @type {HTMLElement} */
            const menuButton = querySelectorNotNull(node, '.permissions-origin-button');
            input.value = origin;
            this._eventListeners.addEventListener(menuButton, 'menuClose', this._onOriginMenuClose.bind(this, origin), false);
            this._originContainerChildren.push(...node.childNodes);
            fragment.appendChild(node);
            any = true;
        }
        const container = /** @type {HTMLElement} */ (this._originContainer);
        container.insertBefore(fragment, container.firstChild);
        /** @type {HTMLElement} */ (this._originEmpty).hidden = any;

        /** @type {HTMLElement} */ (this._errorContainer).hidden = true;
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

    /**
     * @param {string} origin
     */
    _onOriginMenuClose(origin) {
        this._setOriginPermissionEnabled(origin, false);
    }

    /** */
    _onAddButtonClick() {
        this._addOrigin();
    }

    /** */
    async _addOrigin() {
        const input = /** @type {HTMLInputElement} */ (this._addOriginInput);
        const origin = input.value;
        const added = await this._setOriginPermissionEnabled(origin, true);
        if (added) {
            input.value = '';
        }
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
            const errorContainer = /** @type {HTMLElement} */ (this._errorContainer);
            errorContainer.hidden = false;
            errorContainer.textContent = toError(e).message;
        }
        if (!added) { return false; }
        await this._updatePermissions();
        return true;
    }
}
