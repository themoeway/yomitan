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

import {generateId} from '../core/utilities.js';
import {ExtensionError} from '../core/extension-error.js';
import {toError} from '../core/to-error.js';
import {yomitan} from '../yomitan.js';

export class OptionToggleHotkeyHandler {
    /**
     * @param {import('./display.js').Display} display
     */
    constructor(display) {
        /** @type {import('./display.js').Display} */
        this._display = display;
        /** @type {?import('./display-notification.js').DisplayNotification} */
        this._notification = null;
        /** @type {?import('core').Timeout} */
        this._notificationHideTimer = null;
        /** @type {number} */
        this._notificationHideTimeout = 5000;
        /** @type {string} */
        this._source = `option-toggle-hotkey-handler-${generateId(16)}`;
    }

    /** @type {number} */
    get notificationHideTimeout() {
        return this._notificationHideTimeout;
    }

    set notificationHideTimeout(value) {
        this._notificationHideTimeout = value;
    }

    /** */
    prepare() {
        this._display.hotkeyHandler.registerActions([
            ['toggleOption', this._onHotkeyActionToggleOption.bind(this)]
        ]);
    }

    // Private

    /**
     * @param {unknown} argument
     */
    _onHotkeyActionToggleOption(argument) {
        if (typeof argument !== 'string') { return; }
        this._toggleOption(argument);
    }

    /**
     * @param {string} path
     */
    async _toggleOption(path) {
        let value;
        try {
            const optionsContext = this._display.getOptionsContext();

            const getSettingsResponse = (await yomitan.api.getSettings([{
                scope: 'profile',
                path,
                optionsContext
            }]))[0];
            const {error: getSettingsError} = getSettingsResponse;
            if (typeof getSettingsError !== 'undefined') {
                throw ExtensionError.deserialize(getSettingsError);
            }

            value = getSettingsResponse.result;
            if (typeof value !== 'boolean') {
                throw new Error(`Option value of type ${typeof value} cannot be toggled`);
            }

            value = !value;

            /** @type {import('settings-modifications').ScopedModificationSet} */
            const modification = {
                scope: 'profile',
                action: 'set',
                path,
                value,
                optionsContext
            };
            const modifySettingsResponse = (await yomitan.api.modifySettings([modification], this._source))[0];
            const {error: modifySettingsError} = modifySettingsResponse;
            if (typeof modifySettingsError !== 'undefined') {
                throw ExtensionError.deserialize(modifySettingsError);
            }

            this._showNotification(this._createSuccessMessage(path, value), true);
        } catch (e) {
            this._showNotification(this._createErrorMessage(path, e), false);
        }
    }

    /**
     * @param {string} path
     * @param {unknown} value
     * @returns {DocumentFragment}
     */
    _createSuccessMessage(path, value) {
        const fragment = document.createDocumentFragment();
        const n1 = document.createElement('em');
        n1.textContent = path;
        const n2 = document.createElement('strong');
        n2.textContent = `${value}`;
        fragment.appendChild(document.createTextNode('Option '));
        fragment.appendChild(n1);
        fragment.appendChild(document.createTextNode(' changed to '));
        fragment.appendChild(n2);
        return fragment;
    }

    /**
     * @param {string} path
     * @param {unknown} error
     * @returns {DocumentFragment}
     */
    _createErrorMessage(path, error) {
        const message = toError(error).message;
        const fragment = document.createDocumentFragment();
        const n1 = document.createElement('em');
        n1.textContent = path;
        const n2 = document.createElement('div');
        n2.textContent = message;
        n2.className = 'danger-text';
        fragment.appendChild(document.createTextNode('Failed to toggle option '));
        fragment.appendChild(n1);
        fragment.appendChild(document.createTextNode(': '));
        fragment.appendChild(n2);
        return fragment;
    }

    /**
     * @param {DocumentFragment} message
     * @param {boolean} autoClose
     */
    _showNotification(message, autoClose) {
        if (this._notification === null) {
            this._notification = this._display.createNotification(false);
            this._notification.node.addEventListener('click', this._onNotificationClick.bind(this), false);
        }

        this._notification.setContent(message);
        this._notification.open();

        this._stopHideNotificationTimer();
        if (autoClose) {
            this._notificationHideTimer = setTimeout(this._onNotificationHideTimeout.bind(this), this._notificationHideTimeout);
        }
    }

    /**
     * @param {boolean} animate
     */
    _hideNotification(animate) {
        if (this._notification === null) { return; }
        this._notification.close(animate);
        this._stopHideNotificationTimer();
    }

    /** */
    _stopHideNotificationTimer() {
        if (this._notificationHideTimer !== null) {
            clearTimeout(this._notificationHideTimer);
            this._notificationHideTimer = null;
        }
    }

    /** */
    _onNotificationHideTimeout() {
        this._notificationHideTimer = null;
        this._hideNotification(true);
    }

    /** */
    _onNotificationClick() {
        this._stopHideNotificationTimer();
    }
}
