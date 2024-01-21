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

import {EventDispatcher} from '../../core/event-dispatcher.js';
import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {DocumentUtil} from '../../dom/document-util.js';
import {HotkeyUtil} from '../../input/hotkey-util.js';

/**
 * @augments EventDispatcher<import('keyboard-mouse-input-field').Events>
 */
export class KeyboardMouseInputField extends EventDispatcher {
    /**
     * @param {HTMLInputElement} inputNode
     * @param {?HTMLButtonElement} mouseButton
     * @param {?import('environment').OperatingSystem} os
     * @param {?(pointerType: string) => boolean} [isPointerTypeSupported]
     */
    constructor(inputNode, mouseButton, os, isPointerTypeSupported = null) {
        super();
        /** @type {HTMLInputElement} */
        this._inputNode = inputNode;
        /** @type {?HTMLButtonElement} */
        this._mouseButton = mouseButton;
        /** @type {?(pointerType: string) => boolean} */
        this._isPointerTypeSupported = isPointerTypeSupported;
        /** @type {HotkeyUtil} */
        this._hotkeyUtil = new HotkeyUtil(os);
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {?string} */
        this._key = null;
        /** @type {import('input').Modifier[]} */
        this._modifiers = [];
        /** @type {Set<number>} */
        this._penPointerIds = new Set();
        /** @type {boolean} */
        this._mouseModifiersSupported = false;
        /** @type {boolean} */
        this._keySupported = false;
    }

    /** @type {import('input').Modifier[]} */
    get modifiers() {
        return this._modifiers;
    }

    /**
     * @param {?string} key
     * @param {import('input').Modifier[]} modifiers
     * @param {boolean} [mouseModifiersSupported]
     * @param {boolean} [keySupported]
     */
    prepare(key, modifiers, mouseModifiersSupported = false, keySupported = false) {
        this.cleanup();

        this._mouseModifiersSupported = mouseModifiersSupported;
        this._keySupported = keySupported;
        this.setInput(key, modifiers);
        /** @type {import('event-listener-collection').AddEventListenerArgs[]} */
        const events = [
            [this._inputNode, 'keydown', this._onModifierKeyDown.bind(this), false],
            [this._inputNode, 'keyup', this._onModifierKeyUp.bind(this), false]
        ];
        if (mouseModifiersSupported && this._mouseButton !== null) {
            events.push(
                [this._mouseButton, 'mousedown', this._onMouseButtonMouseDown.bind(this), false],
                [this._mouseButton, 'pointerdown', this._onMouseButtonPointerDown.bind(this), false],
                [this._mouseButton, 'pointerover', this._onMouseButtonPointerOver.bind(this), false],
                [this._mouseButton, 'pointerout', this._onMouseButtonPointerOut.bind(this), false],
                [this._mouseButton, 'pointercancel', this._onMouseButtonPointerCancel.bind(this), false],
                [this._mouseButton, 'mouseup', this._onMouseButtonMouseUp.bind(this), false],
                [this._mouseButton, 'contextmenu', this._onMouseButtonContextMenu.bind(this), false]
            );
        }
        for (const args of events) {
            this._eventListeners.addEventListener(...args);
        }
    }

    /**
     * @param {?string} key
     * @param {import('input').Modifier[]} modifiers
     */
    setInput(key, modifiers) {
        this._key = key;
        this._modifiers = this._sortModifiers(modifiers);
        this._updateDisplayString();
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();
        this._modifiers = [];
        this._key = null;
        this._mouseModifiersSupported = false;
        this._keySupported = false;
        this._penPointerIds.clear();
    }

    /** */
    clearInputs() {
        this._updateModifiers([], null);
    }

    // Private

    /**
     * @param {import('input').Modifier[]} modifiers
     * @returns {import('input').Modifier[]}
     */
    _sortModifiers(modifiers) {
        return this._hotkeyUtil.sortModifiers(modifiers);
    }

    /** */
    _updateDisplayString() {
        const displayValue = this._hotkeyUtil.getInputDisplayValue(this._key, this._modifiers);
        this._inputNode.value = displayValue;
    }

    /**
     * @param {KeyboardEvent} e
     * @returns {Set<import('input').ModifierKey>}
     */
    _getModifierKeys(e) {
        const modifiers = new Set(DocumentUtil.getActiveModifiers(e));
        // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/metaKey
        // https://askubuntu.com/questions/567731/why-is-shift-alt-being-mapped-to-meta
        // It works with mouse events on some platforms, so try to determine if metaKey is pressed.
        // This is a hack and only works when both Shift and Alt are not pressed.
        if (
            !modifiers.has('meta') &&
            e.key === 'Meta' &&
            !(
                modifiers.size === 2 &&
                modifiers.has('shift') &&
                modifiers.has('alt')
            )
        ) {
            modifiers.add('meta');
        }
        return modifiers;
    }

    /**
     * @param {string|undefined} keyName
     * @returns {boolean}
     */
    _isModifierKey(keyName) {
        switch (keyName) {
            case 'AltLeft':
            case 'AltRight':
            case 'ControlLeft':
            case 'ControlRight':
            case 'MetaLeft':
            case 'MetaRight':
            case 'ShiftLeft':
            case 'ShiftRight':
            case 'OSLeft':
            case 'OSRight':
                return true;
            default:
                return false;
        }
    }

    /**
     * @param {KeyboardEvent} e
     */
    _onModifierKeyDown(e) {
        e.preventDefault();

        /** @type {string|undefined} */
        let key = e.code;
        if (key === 'Unidentified' || key === '') { key = void 0; }
        if (this._keySupported) {
            this._updateModifiers([...this._getModifierKeys(e)], this._isModifierKey(key) ? void 0 : key);
        } else {
            switch (key) {
                case 'Escape':
                case 'Backspace':
                    this.clearInputs();
                    break;
                default:
                    this._addModifiers(this._getModifierKeys(e));
                    break;
            }
        }
    }

    /**
     * @param {KeyboardEvent} e
     */
    _onModifierKeyUp(e) {
        e.preventDefault();
    }

    /**
     * @param {MouseEvent} e
     */
    _onMouseButtonMouseDown(e) {
        e.preventDefault();
        this._addModifiers(DocumentUtil.getActiveButtons(e));
    }

    /**
     * @param {PointerEvent} e
     */
    _onMouseButtonPointerDown(e) {
        if (!e.isPrimary) { return; }

        let {pointerType, pointerId} = e;
        // Workaround for Firefox bug not detecting certain 'touch' events as 'pen' events.
        if (this._penPointerIds.has(pointerId)) { pointerType = 'pen'; }

        if (
            typeof this._isPointerTypeSupported !== 'function' ||
            !this._isPointerTypeSupported(pointerType)
        ) {
            return;
        }
        e.preventDefault();
        this._addModifiers(DocumentUtil.getActiveButtons(e));
    }

    /**
     * @param {PointerEvent} e
     */
    _onMouseButtonPointerOver(e) {
        const {pointerType, pointerId} = e;
        if (pointerType === 'pen') {
            this._penPointerIds.add(pointerId);
        }
    }

    /**
     * @param {PointerEvent} e
     */
    _onMouseButtonPointerOut(e) {
        const {pointerId} = e;
        this._penPointerIds.delete(pointerId);
    }

    /**
     * @param {PointerEvent} e
     */
    _onMouseButtonPointerCancel(e) {
        this._onMouseButtonPointerOut(e);
    }

    /**
     * @param {MouseEvent} e
     */
    _onMouseButtonMouseUp(e) {
        e.preventDefault();
    }

    /**
     * @param {MouseEvent} e
     */
    _onMouseButtonContextMenu(e) {
        e.preventDefault();
    }

    /**
     * @param {Iterable<import('input').Modifier>} newModifiers
     * @param {?string} [newKey]
     */
    _addModifiers(newModifiers, newKey) {
        const modifiers = new Set(this._modifiers);
        for (const modifier of newModifiers) {
            modifiers.add(modifier);
        }
        this._updateModifiers([...modifiers], newKey);
    }

    /**
     * @param {import('input').Modifier[]} modifiers
     * @param {?string} [newKey]
     */
    _updateModifiers(modifiers, newKey) {
        modifiers = this._sortModifiers(modifiers);

        let changed = false;
        if (typeof newKey !== 'undefined' && this._key !== newKey) {
            this._key = newKey;
            changed = true;
        }
        if (!this._areArraysEqual(this._modifiers, modifiers)) {
            this._modifiers = modifiers;
            changed = true;
        }

        this._updateDisplayString();
        if (changed) {
            this.trigger('change', {modifiers: this._modifiers, key: this._key});
        }
    }

    /**
     * @template [T=unknown]
     * @param {T[]} array1
     * @param {T[]} array2
     * @returns {boolean}
     */
    _areArraysEqual(array1, array2) {
        const length = array1.length;
        if (length !== array2.length) { return false; }

        for (let i = 0; i < length; ++i) {
            if (array1[i] !== array2[i]) { return false; }
        }

        return true;
    }
}
