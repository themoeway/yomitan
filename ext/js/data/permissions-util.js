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

import {AnkiUtil} from './anki-util.js';

export class PermissionsUtil {
    constructor() {
        /** @type {Set<string>} */
        this._ankiFieldMarkersRequiringClipboardPermission = new Set([
            'clipboard-image',
            'clipboard-text'
        ]);
    }

    /**
     * @param {chrome.permissions.Permissions} permissions
     * @returns {Promise<boolean>}
     */
    hasPermissions(permissions) {
        return new Promise((resolve, reject) => chrome.permissions.contains(permissions, (result) => {
            const e = chrome.runtime.lastError;
            if (e) {
                reject(new Error(e.message));
            } else {
                resolve(result);
            }
        }));
    }

    /**
     * @param {chrome.permissions.Permissions} permissions
     * @param {boolean} shouldHave
     * @returns {Promise<boolean>}
     */
    setPermissionsGranted(permissions, shouldHave) {
        return (
            shouldHave ?
            new Promise((resolve, reject) => chrome.permissions.request(permissions, (result) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve(result);
                }
            })) :
            new Promise((resolve, reject) => chrome.permissions.remove(permissions, (result) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve(!result);
                }
            }))
        );
    }

    /**
     * @returns {Promise<chrome.permissions.Permissions>}
     */
    getAllPermissions() {
        return new Promise((resolve, reject) => chrome.permissions.getAll((result) => {
            const e = chrome.runtime.lastError;
            if (e) {
                reject(new Error(e.message));
            } else {
                resolve(result);
            }
        }));
    }

    /**
     * @param {string} fieldValue
     * @returns {string[]}
     */
    getRequiredPermissionsForAnkiFieldValue(fieldValue) {
        const markers = AnkiUtil.getFieldMarkers(fieldValue);
        const markerPermissions = this._ankiFieldMarkersRequiringClipboardPermission;
        for (const marker of markers) {
            if (markerPermissions.has(marker)) {
                return ['clipboardRead'];
            }
        }
        return [];
    }

    /**
     * @param {chrome.permissions.Permissions} permissions
     * @param {import('settings').ProfileOptions} options
     * @returns {boolean}
     */
    hasRequiredPermissionsForOptions(permissions, options) {
        const permissionsSet = new Set(permissions.permissions);

        if (!permissionsSet.has('nativeMessaging')) {
            if (options.parsing.enableMecabParser) {
                return false;
            }
        }

        if (!permissionsSet.has('clipboardRead')) {
            if (options.clipboard.enableBackgroundMonitor || options.clipboard.enableSearchPageMonitor) {
                return false;
            }
            const fieldMarkersRequiringClipboardPermission = this._ankiFieldMarkersRequiringClipboardPermission;
            const fieldsList = [
                options.anki.terms.fields,
                options.anki.kanji.fields
            ];
            for (const fields of fieldsList) {
                for (const fieldValue of Object.values(fields)) {
                    const markers = AnkiUtil.getFieldMarkers(fieldValue);
                    for (const marker of markers) {
                        if (fieldMarkersRequiringClipboardPermission.has(marker)) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }
}
