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

import {EventDispatcher} from '../core/event-dispatcher.js';
import {EventListenerCollection} from '../core/event-listener-collection.js';
import {DocumentUtil} from '../dom/document-util.js';
import {yomitan} from '../yomitan.js';

/**
 * Class which handles hotkey events and actions.
 * @augments EventDispatcher<import('hotkey-handler').Events>
 */
export class HotkeyHandler extends EventDispatcher {
    /**
     * Creates a new instance of the class.
     */
    constructor() {
        super();
        /** @type {Map<string, (argument: unknown) => (boolean|void)>} */
        this._actions = new Map();
        /** @type {Map<string, import('hotkey-handler').HotkeyHandlers>} */
        this._hotkeys = new Map();
        /** @type {Map<import('settings').InputsHotkeyScope, import('settings').InputsHotkeyOptions[]>} */
        this._hotkeyRegistrations = new Map();
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {boolean} */
        this._isPrepared = false;
        /** @type {boolean} */
        this._hasEventListeners = false;
    }

    /**
     * Begins listening to key press events in order to detect hotkeys.
     */
    prepare() {
        this._isPrepared = true;
        this._updateEventHandlers();
        yomitan.crossFrame.registerHandlers([
            ['hotkeyHandlerForwardHotkey', this._onMessageForwardHotkey.bind(this)]
        ]);
    }

    /**
     * Registers a set of actions that this hotkey handler supports.
     * @param {[name: string, handler: (argument: unknown) => (boolean|void)][]} actions An array of `[name, handler]` entries, where `name` is a string and `handler` is a function.
     */
    registerActions(actions) {
        for (const [name, handler] of actions) {
            this._actions.set(name, handler);
        }
    }

    /**
     * Registers a set of hotkeys for a given scope.
     * @param {import('settings').InputsHotkeyScope} scope The scope that the hotkey definitions must be for in order to be activated.
     * @param {import('settings').InputsHotkeyOptions[]} hotkeys An array of hotkey definitions.
     */
    registerHotkeys(scope, hotkeys) {
        let registrations = this._hotkeyRegistrations.get(scope);
        if (typeof registrations === 'undefined') {
            registrations = [];
            this._hotkeyRegistrations.set(scope, registrations);
        }
        registrations.push(...hotkeys);
        this._updateHotkeyRegistrations();
    }

    /**
     * Removes all registered hotkeys for a given scope.
     * @param {import('settings').InputsHotkeyScope} scope The scope that the hotkey definitions were registered in.
     */
    clearHotkeys(scope) {
        const registrations = this._hotkeyRegistrations.get(scope);
        if (typeof registrations !== 'undefined') {
            registrations.length = 0;
        }
        this._updateHotkeyRegistrations();
    }

    /**
     * Assigns a set of hotkeys for a given scope. This is an optimized shorthand for calling
     * `clearHotkeys`, then calling `registerHotkeys`.
     * @param {import('settings').InputsHotkeyScope} scope The scope that the hotkey definitions must be for in order to be activated.
     * @param {import('settings').InputsHotkeyOptions[]} hotkeys An array of hotkey definitions.
     */
    setHotkeys(scope, hotkeys) {
        let registrations = this._hotkeyRegistrations.get(scope);
        if (typeof registrations === 'undefined') {
            registrations = [];
            this._hotkeyRegistrations.set(scope, registrations);
        } else {
            registrations.length = 0;
        }
        for (const {action, argument, key, modifiers, scopes, enabled} of hotkeys) {
            registrations.push({
                action,
                argument,
                key,
                modifiers: [...modifiers],
                scopes: [...scopes],
                enabled
            });
        }
        this._updateHotkeyRegistrations();
    }

    /**
     * @template {import('core').EventNames<import('hotkey-handler').Events>} TName
     * @param {TName} eventName
     * @param {(details: import('core').EventArgument<import('hotkey-handler').Events, TName>) => void} callback
     */
    on(eventName, callback) {
        super.on(eventName, callback);
        this._updateHasEventListeners();
        this._updateEventHandlers();
    }

    /**
     * @template {import('core').EventNames<import('hotkey-handler').Events>} TName
     * @param {TName} eventName
     * @param {(details: import('core').EventArgument<import('hotkey-handler').Events, TName>) => void} callback
     * @returns {boolean}
     */
    off(eventName, callback) {
        const result = super.off(eventName, callback);
        this._updateHasEventListeners();
        this._updateEventHandlers();
        return result;
    }

    /**
     * Attempts to simulate an action for a given combination of key and modifiers.
     * @param {string} key A keyboard key code indicating which key needs to be pressed.
     * @param {import('input').ModifierKey[]} modifiers An array of keyboard modifiers which also need to be pressed. Supports: `'alt', 'ctrl', 'shift', 'meta'`.
     * @returns {boolean} `true` if an action was performed, `false` otherwise.
     */
    simulate(key, modifiers) {
        const hotkeyInfo = this._hotkeys.get(key);
        return (
            typeof hotkeyInfo !== 'undefined' &&
            this._invokeHandlers(modifiers, hotkeyInfo, key)
        );
    }

    // Message handlers

    /** @type {import('cross-frame-api').ApiHandler<'hotkeyHandlerForwardHotkey'>} */
    _onMessageForwardHotkey({key, modifiers}) {
        return this.simulate(key, modifiers);
    }

    // Private

    /**
     * @param {KeyboardEvent} event
     */
    _onKeyDown(event) {
        const hotkeyInfo = this._hotkeys.get(event.code);
        if (typeof hotkeyInfo !== 'undefined') {
            const eventModifiers = DocumentUtil.getActiveModifiers(event);
            if (this._invokeHandlers(eventModifiers, hotkeyInfo, event.key)) {
                event.preventDefault();
                return;
            }
        }
        this.trigger('keydownNonHotkey', event);
    }

    /**
     * @param {import('input').ModifierKey[]} modifiers
     * @param {import('hotkey-handler').HotkeyHandlers} hotkeyInfo
     * @param {string} key
     * @returns {boolean}
     */
    _invokeHandlers(modifiers, hotkeyInfo, key) {
        for (const {modifiers: handlerModifiers, action, argument} of hotkeyInfo.handlers) {
            if (!this._areSame(handlerModifiers, modifiers) || !this._isHotkeyPermitted(modifiers, key)) { continue; }

            const actionHandler = this._actions.get(action);
            if (typeof actionHandler !== 'undefined') {
                const result = actionHandler(argument);
                if (result !== false) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @param {Set<unknown>} set
     * @param {unknown[]} array
     * @returns {boolean}
     */
    _areSame(set, array) {
        if (set.size !== array.length) { return false; }
        for (const value of array) {
            if (!set.has(value)) {
                return false;
            }
        }
        return true;
    }

    /**
     * @returns {void}
     */
    _updateHotkeyRegistrations() {
        if (this._hotkeys.size === 0 && this._hotkeyRegistrations.size === 0) { return; }

        this._hotkeys.clear();
        for (const [scope, registrations] of this._hotkeyRegistrations.entries()) {
            for (const {action, argument, key, modifiers, scopes, enabled} of registrations) {
                if (!(enabled && key !== null && action !== '' && scopes.includes(scope))) { continue; }

                let hotkeyInfo = this._hotkeys.get(key);
                if (typeof hotkeyInfo === 'undefined') {
                    hotkeyInfo = {handlers: []};
                    this._hotkeys.set(key, hotkeyInfo);
                }

                hotkeyInfo.handlers.push({modifiers: new Set(modifiers), action, argument});
            }
        }
        this._updateEventHandlers();
    }

    /**
     * @returns {void}
     */
    _updateHasEventListeners() {
        this._hasEventListeners = this.hasListeners('keydownNonHotkey');
    }

    /**
     * @returns {void}
     */
    _updateEventHandlers() {
        if (this._isPrepared && (this._hotkeys.size > 0 || this._hasEventListeners)) {
            if (this._eventListeners.size !== 0) { return; }
            this._eventListeners.addEventListener(document, 'keydown', this._onKeyDown.bind(this), false);
        } else {
            this._eventListeners.removeAllEventListeners();
        }
    }

    /**
     * @param {import('input').ModifierKey[]} modifiers
     * @param {string} key
     * @returns {boolean}
     */
    _isHotkeyPermitted(modifiers, key) {
        return !(
            (modifiers.length === 0 || (modifiers.length === 1 && modifiers[0] === 'shift')) &&
            DocumentUtil.isInputElementFocused() &&
            this._isKeyCharacterInput(key)
        );
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    _isKeyCharacterInput(key) {
        return key.length === 1;
    }
}
