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

import {isContentScriptRegistered, registerContentScript, unregisterContentScript} from '../background/script-manager.js';
import {log} from '../core/logger.js';

/**
 * This class controls the registration of accessibility handlers.
 */
export class AccessibilityController {
    constructor() {
        /** @type {?import('core').TokenObject} */
        this._updateGoogleDocsAccessibilityToken = null;
        /** @type {?Promise<void>} */
        this._updateGoogleDocsAccessibilityPromise = null;
        /** @type {boolean} */
        this._forceGoogleDocsHtmlRenderingAny = false;
    }

    /**
     * Updates the accessibility handlers.
     * @param {import('settings').Options} fullOptions The full options object from the `Backend` instance.
     *   The value is treated as read-only and is not modified.
     */
    async update(fullOptions) {
        let forceGoogleDocsHtmlRenderingAny = false;
        for (const {options} of fullOptions.profiles) {
            if (options.accessibility.forceGoogleDocsHtmlRendering) {
                forceGoogleDocsHtmlRenderingAny = true;
                break;
            }
        }

        await this._updateGoogleDocsAccessibility(forceGoogleDocsHtmlRenderingAny);
    }

    // Private

    /**
     * @param {boolean} forceGoogleDocsHtmlRenderingAny
     */
    async _updateGoogleDocsAccessibility(forceGoogleDocsHtmlRenderingAny) {
        // Reentrant token
        /** @type {?import('core').TokenObject} */
        const token = {};
        this._updateGoogleDocsAccessibilityToken = token;

        // Wait for previous
        let promise = this._updateGoogleDocsAccessibilityPromise;
        if (promise !== null) { await promise; }

        // Reentrant check
        if (this._updateGoogleDocsAccessibilityToken !== token) { return; }

        // Update
        promise = this._updateGoogleDocsAccessibilityInner(forceGoogleDocsHtmlRenderingAny);
        this._updateGoogleDocsAccessibilityPromise = promise;
        await promise;
        this._updateGoogleDocsAccessibilityPromise = null;
    }

    /**
     * @param {boolean} forceGoogleDocsHtmlRenderingAny
     */
    async _updateGoogleDocsAccessibilityInner(forceGoogleDocsHtmlRenderingAny) {
        if (this._forceGoogleDocsHtmlRenderingAny === forceGoogleDocsHtmlRenderingAny) { return; }

        this._forceGoogleDocsHtmlRenderingAny = forceGoogleDocsHtmlRenderingAny;

        const id = 'googleDocsAccessibility';
        try {
            if (forceGoogleDocsHtmlRenderingAny) {
                if (await isContentScriptRegistered(id)) { return; }
                try {
                    await this._registerGoogleDocsContentScript(id, false);
                } catch (e) {
                    // Firefox doesn't support `world` field and will throw an error.
                    // In this case, use the xray vision version.
                    await this._registerGoogleDocsContentScript(id, true);
                }
            } else {
                await unregisterContentScript(id);
            }
        } catch (e) {
            log.error(e);
        }
    }

    /**
     * @param {string} id
     * @param {boolean} xray
     * @returns {Promise<void>}
     */
    _registerGoogleDocsContentScript(id, xray) {
        /** @type {import('script-manager').RegistrationDetails} */
        const details = {
            allFrames: true,
            matches: ['*://docs.google.com/*'],
            runAt: 'document_start',
            js: [
                xray ?
                'js/accessibility/google-docs-xray.js' :
                'js/accessibility/google-docs.js'
            ]
        };
        if (!xray) { details.world = 'MAIN'; }
        return registerContentScript(id, details);
    }
}
