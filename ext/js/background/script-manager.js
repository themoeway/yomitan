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

/**
 * Injects a stylesheet into a tab.
 * @param {'file'|'code'} type The type of content to inject; either 'file' or 'code'.
 * @param {string} content The content to inject.
 *   - If type is `'file'`, this argument should be a path to a file.
 *   - If type is `'code'`, this argument should be the CSS content.
 * @param {number} tabId The id of the tab to inject into.
 * @param {number|undefined} frameId The id of the frame to inject into.
 * @param {boolean} allFrames Whether or not the stylesheet should be injected into all frames.
 * @returns {Promise<void>}
 */
export function injectStylesheet(type, content, tabId, frameId, allFrames) {
    return new Promise((resolve, reject) => {
        /** @type {chrome.scripting.InjectionTarget} */
        const target = {
            tabId,
            allFrames
        };
        /** @type {chrome.scripting.CSSInjection} */
        const details = (
            type === 'file' ?
            {origin: 'AUTHOR', files: [content], target} :
            {origin: 'USER', css: content, target}
        );
        if (!allFrames && typeof frameId === 'number') {
            details.target.frameIds = [frameId];
        }
        chrome.scripting.insertCSS(details, () => {
            const e = chrome.runtime.lastError;
            if (e) {
                reject(new Error(e.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * Checks whether or not a content script is registered.
 * @param {string} id The identifier used with a call to `registerContentScript`.
 * @returns {Promise<boolean>} `true` if a script is registered, `false` otherwise.
 */
export async function isContentScriptRegistered(id) {
    const scripts = await new Promise((resolve, reject) => {
        chrome.scripting.getRegisteredContentScripts({ids: [id]}, (result) => {
            const e = chrome.runtime.lastError;
            if (e) {
                reject(new Error(e.message));
            } else {
                resolve(result);
            }
        });
    });
    for (const script of scripts) {
        if (script.id === id) {
            return true;
        }
    }
    return false;
}

/**
 * Registers a dynamic content script.
 * Note: if the fallback handler is used and the 'webNavigation' permission isn't granted,
 * there is a possibility that the script can be injected more than once due to the events used.
 * Therefore, a reentrant check may need to be performed by the content script.
 * @param {string} id A unique identifier for the registration.
 * @param {import('script-manager').RegistrationDetails} details The script registration details.
 * @throws An error is thrown if the id is already in use.
 */
export async function registerContentScript(id, details) {
    if (await isContentScriptRegistered(id)) {
        throw new Error('Registration already exists');
    }

    const details2 = createContentScriptRegistrationOptions(details, id);
    await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
        chrome.scripting.registerContentScripts([details2], () => {
            const e = chrome.runtime.lastError;
            if (e) {
                reject(new Error(e.message));
            } else {
                resolve();
            }
        });
    }));
}

/**
 * Unregisters a previously registered content script.
 * @param {string} id The identifier passed to a previous call to `registerContentScript`.
 * @returns {Promise<void>}
 */
export async function unregisterContentScript(id) {
    return new Promise((resolve, reject) => {
        chrome.scripting.unregisterContentScripts({ids: [id]}, () => {
            const e = chrome.runtime.lastError;
            if (e) {
                reject(new Error(e.message));
            } else {
                resolve();
            }
        });
    });
}

/**
 * @param {import('script-manager').RegistrationDetails} details
 * @param {string} id
 * @returns {chrome.scripting.RegisteredContentScript}
 */
function createContentScriptRegistrationOptions(details, id) {
    const {css, js, allFrames, matches, runAt, world} = details;
    /** @type {chrome.scripting.RegisteredContentScript} */
    const options = {
        id: id,
        persistAcrossSessions: true
    };
    if (Array.isArray(css)) {
        options.css = [...css];
    }
    if (Array.isArray(js)) {
        options.js = [...js];
    }
    if (typeof allFrames !== 'undefined') {
        options.allFrames = allFrames;
    }
    if (Array.isArray(matches)) {
        options.matches = [...matches];
    }
    if (typeof runAt !== 'undefined') {
        options.runAt = runAt;
    }
    if (typeof world !== 'undefined') {
        options.world = world;
    }
    return options;
}
