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

import {ObjectPropertyAccessor} from '../../general/object-property-accessor.js';

export class PermissionsToggleController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     */
    constructor(settingsController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {?NodeListOf<HTMLInputElement>} */
        this._toggles = null;
    }

    /** */
    async prepare() {
        this._toggles = document.querySelectorAll('.permissions-toggle');

        for (const toggle of this._toggles) {
            toggle.addEventListener('change', this._onPermissionsToggleChange.bind(this), false);
        }
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));
        this._settingsController.on('permissionsChanged', this._onPermissionsChanged.bind(this));

        const options = await this._settingsController.getOptions();
        const optionsContext = this._settingsController.getOptionsContext();
        this._onOptionsChanged({options, optionsContext});
    }

    // Private

    /**
     * @param {import('settings-controller').EventArgument<'optionsChanged'>} details
     */
    _onOptionsChanged({options}) {
        let accessor = null;
        for (const toggle of /** @type {NodeListOf<HTMLInputElement>} */ (this._toggles)) {
            const {permissionsSetting} = toggle.dataset;
            if (typeof permissionsSetting !== 'string') { continue; }

            if (accessor === null) {
                accessor = new ObjectPropertyAccessor(options);
            }

            const path = ObjectPropertyAccessor.getPathArray(permissionsSetting);
            let value;
            try {
                value = accessor.get(path, path.length);
            } catch (e) {
                continue;
            }
            toggle.checked = !!value;
        }
        this._updateValidity();
    }

    /**
     * @param {Event} e
     */
    async _onPermissionsToggleChange(e) {
        const toggle = /** @type {HTMLInputElement} */ (e.currentTarget);
        let value = toggle.checked;
        const valuePre = !value;
        const {permissionsSetting} = toggle.dataset;
        const hasPermissionsSetting = typeof permissionsSetting === 'string';

        if (value || !hasPermissionsSetting) {
            toggle.checked = valuePre;
            const permissions = this._getRequiredPermissions(toggle);
            try {
                value = await this._settingsController.permissionsUtil.setPermissionsGranted({permissions}, value);
            } catch (error) {
                value = valuePre;
                try {
                    value = await this._settingsController.permissionsUtil.hasPermissions({permissions});
                } catch (error2) {
                    // NOP
                }
            }
            toggle.checked = value;
        }

        if (hasPermissionsSetting) {
            this._setToggleValid(toggle, true);
            await this._settingsController.setProfileSetting(permissionsSetting, value);
        }
    }

    /**
     * @param {import('settings-controller').EventArgument<'permissionsChanged'>} details
     */
    _onPermissionsChanged({permissions}) {
        const permissions2 = permissions.permissions;
        const permissionsSet = new Set(typeof permissions2 !== 'undefined' ? permissions2 : []);
        for (const toggle of /** @type {NodeListOf<HTMLInputElement>} */ (this._toggles)) {
            const {permissionsSetting} = toggle.dataset;
            const hasPermissions = this._hasAll(permissionsSet, this._getRequiredPermissions(toggle));

            if (typeof permissionsSetting === 'string') {
                const valid = !toggle.checked || hasPermissions;
                this._setToggleValid(toggle, valid);
            } else {
                toggle.checked = hasPermissions;
            }
        }
    }

    /**
     * @param {HTMLInputElement} toggle
     * @param {boolean} valid
     */
    _setToggleValid(toggle, valid) {
        const relative = /** @type {?HTMLElement} */ (toggle.closest('.settings-item'));
        if (relative === null) { return; }
        relative.dataset.invalid = `${!valid}`;
    }

    /** */
    async _updateValidity() {
        const permissions = await this._settingsController.permissionsUtil.getAllPermissions();
        this._onPermissionsChanged({permissions});
    }

    /**
     * @param {Set<string>} set
     * @param {string[]} values
     * @returns {boolean}
     */
    _hasAll(set, values) {
        for (const value of values) {
            if (!set.has(value)) { return false; }
        }
        return true;
    }

    /**
     * @param {HTMLInputElement} toggle
     * @returns {string[]}
     */
    _getRequiredPermissions(toggle) {
        const requiredPermissions = toggle.dataset.requiredPermissions;
        return (typeof requiredPermissions === 'string' && requiredPermissions.length > 0 ? requiredPermissions.split(' ') : []);
    }
}
