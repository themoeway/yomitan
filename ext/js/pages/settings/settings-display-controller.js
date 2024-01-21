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

import {DocumentUtil} from '../../dom/document-util.js';
import {PopupMenu} from '../../dom/popup-menu.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {SelectorObserver} from '../../dom/selector-observer.js';

export class SettingsDisplayController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     * @param {import('./modal-controller.js').ModalController} modalController
     */
    constructor(settingsController, modalController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {import('./modal-controller.js').ModalController} */
        this._modalController = modalController;
        /** @type {HTMLElement} */
        this._contentNode = querySelectorNotNull(document, '.content');
        /** @type {HTMLElement} */
        this._menuContainer = querySelectorNotNull(document, '#popup-menus');
        /** @type {(event: MouseEvent) => void} */
        this._onMoreToggleClickBind = this._onMoreToggleClick.bind(this);
        /** @type {(event: MouseEvent) => void} */
        this._onMenuButtonClickBind = this._onMenuButtonClick.bind(this);
    }

    /** */
    prepare() {
        const onFabButtonClick = this._onFabButtonClick.bind(this);
        for (const fabButton of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.fab-button'))) {
            fabButton.addEventListener('click', onFabButtonClick, false);
        }

        const onModalAction = this._onModalAction.bind(this);
        for (const node of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-modal-action]'))) {
            node.addEventListener('click', onModalAction, false);
        }

        const onSelectOnClickElementClick = this._onSelectOnClickElementClick.bind(this);
        for (const node of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-select-on-click]'))) {
            node.addEventListener('click', onSelectOnClickElementClick, false);
        }

        const onInputTabActionKeyDown = this._onInputTabActionKeyDown.bind(this);
        for (const node of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-tab-action]'))) {
            node.addEventListener('keydown', onInputTabActionKeyDown, false);
        }

        for (const node of /** @type {NodeListOf<HTMLIFrameElement>} */ (document.querySelectorAll('.defer-load-iframe'))) {
            this._setupDeferLoadIframe(node);
        }

        const moreSelectorObserver = new SelectorObserver({
            selector: '.more-toggle',
            onAdded: this._onMoreSetup.bind(this),
            onRemoved: this._onMoreCleanup.bind(this)
        });
        moreSelectorObserver.observe(document.documentElement, false);

        const menuSelectorObserver = new SelectorObserver({
            selector: '[data-menu]',
            onAdded: this._onMenuSetup.bind(this),
            onRemoved: this._onMenuCleanup.bind(this)
        });
        menuSelectorObserver.observe(document.documentElement, false);

        window.addEventListener('keydown', this._onKeyDown.bind(this), false);
        window.addEventListener('popstate', this._onPopState.bind(this), false);
        this._updateScrollTarget();
    }

    // Private

    /**
     * @param {Element} element
     * @returns {null}
     */
    _onMoreSetup(element) {
        /** @type {HTMLElement} */ (element).addEventListener('click', this._onMoreToggleClickBind, false);
        return null;
    }

    /**
     * @param {Element} element
     */
    _onMoreCleanup(element) {
        /** @type {HTMLElement} */ (element).removeEventListener('click', this._onMoreToggleClickBind, false);
    }

    /**
     * @param {Element} element
     * @returns {null}
     */
    _onMenuSetup(element) {
        /** @type {HTMLElement} */ (element).addEventListener('click', this._onMenuButtonClickBind, false);
        return null;
    }

    /**
     * @param {Element} element
     */
    _onMenuCleanup(element) {
        /** @type {HTMLElement} */ (element).removeEventListener('click', this._onMenuButtonClickBind, false);
    }

    /**
     * @param {MouseEvent} e
     */
    _onMenuButtonClick(e) {
        const element = /** @type {HTMLElement} */ (e.currentTarget);
        const {menu} = element.dataset;
        if (typeof menu === 'undefined') { return; }
        this._showMenu(element, menu);
    }

    /**
     * @param {MouseEvent} e
     */
    _onFabButtonClick(e) {
        const element = /** @type {HTMLElement} */ (e.currentTarget);
        const action = element.dataset.action;
        switch (action) {
            case 'toggle-sidebar':
                document.body.classList.toggle('sidebar-visible');
                break;
            case 'toggle-preview-sidebar':
                document.body.classList.toggle('preview-sidebar-visible');
                break;
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onMoreToggleClick(e) {
        const node = /** @type {HTMLElement} */ (e.currentTarget);
        const container = this._getMoreContainer(node);
        if (container === null) { return; }

        /** @type {?HTMLElement} */
        const more = container.querySelector('.more');
        if (more === null) { return; }

        const moreVisible = more.hidden;
        more.hidden = !moreVisible;
        for (const moreToggle of /** @type {NodeListOf<HTMLElement>} */ (container.querySelectorAll('.more-toggle'))) {
            const container2 = this._getMoreContainer(moreToggle);
            if (container2 === null) { continue; }

            const more2 = container2.querySelector('.more');
            if (more2 === null || more2 !== more) { continue; }

            moreToggle.dataset.expanded = `${moreVisible}`;
        }

        e.preventDefault();
    }

    /** */
    _onPopState() {
        this._updateScrollTarget();
    }

    /**
     * @param {KeyboardEvent} e
     */
    _onKeyDown(e) {
        switch (e.code) {
            case 'Escape':
                if (!DocumentUtil.isInputElementFocused()) {
                    this._closeTopMenuOrModal();
                    e.preventDefault();
                }
                break;
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onModalAction(e) {
        const node = /** @type {HTMLElement} */ (e.currentTarget);
        const {modalAction} = node.dataset;
        if (typeof modalAction !== 'string') { return; }

        const modalActionArray = modalAction.split(',');
        const action = modalActionArray[0];
        /** @type {string|Element|undefined} */
        let target = modalActionArray[1];
        if (typeof target === 'undefined') {
            const currentModal = node.closest('.modal');
            if (currentModal === null) { return; }
            target = currentModal;
        }

        const modal = this._modalController.getModal(target);
        if (modal === null) { return; }

        switch (action) {
            case 'show':
                modal.setVisible(true);
                break;
            case 'hide':
                modal.setVisible(false);
                break;
            case 'toggle':
                modal.setVisible(!modal.isVisible());
                break;
        }

        e.preventDefault();
    }

    /**
     * @param {MouseEvent} e
     */
    _onSelectOnClickElementClick(e) {
        if (e.button !== 0) { return; }

        const node = /** @type {HTMLElement} */ (e.currentTarget);
        const range = document.createRange();
        range.selectNode(node);

        const selection = window.getSelection();
        if (selection !== null) {
            selection.removeAllRanges();
            selection.addRange(range);
        }

        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * @param {KeyboardEvent} e
     */
    _onInputTabActionKeyDown(e) {
        if (e.key !== 'Tab' || e.ctrlKey) { return; }

        const node = /** @type {HTMLElement} */ (e.currentTarget);
        const {tabAction} = node.dataset;
        if (typeof tabAction !== 'string') { return; }

        const args = tabAction.split(',');
        switch (args[0]) {
            case 'ignore':
                e.preventDefault();
                break;
            case 'indent':
                e.preventDefault();
                this._indentInput(e, node, args);
                break;
        }
    }

    /** */
    _updateScrollTarget() {
        const hash = window.location.hash;
        if (!hash.startsWith('#!')) { return; }

        const content = this._contentNode;
        const target = document.getElementById(hash.substring(2));
        if (content === null || target === null) { return; }

        const rect1 = content.getBoundingClientRect();
        const rect2 = target.getBoundingClientRect();
        content.scrollTop += rect2.top - rect1.top;
    }

    /**
     * @param {HTMLElement} link
     * @returns {?Element}
     */
    _getMoreContainer(link) {
        const v = link.dataset.parentDistance;
        const distance = v ? parseInt(v, 10) : 1;
        if (Number.isNaN(distance)) { return null; }

        /** @type {?Element} */
        let result = link;
        for (let i = 0; i < distance; ++i) {
            if (result === null) { break; }
            result = /** @type {?Element} */ (result.parentNode);
        }
        return result;
    }

    /** */
    _closeTopMenuOrModal() {
        for (const popupMenu of PopupMenu.openMenus) {
            popupMenu.close();
            return;
        }

        const modal = this._modalController.getTopVisibleModal();
        if (modal !== null) {
            modal.setVisible(false);
        }
    }

    /**
     * @param {HTMLElement} element
     * @param {string} menuName
     */
    _showMenu(element, menuName) {
        const menu = /** @type {HTMLElement} */ (this._settingsController.instantiateTemplate(menuName));

        /** @type {HTMLElement} */ (this._menuContainer).appendChild(menu);

        const popupMenu = new PopupMenu(element, menu);
        popupMenu.prepare();
    }

    /**
     * @param {KeyboardEvent} e
     * @param {HTMLElement} node
     * @param {string[]} args
     */
    _indentInput(e, node, args) {
        if (!(node instanceof HTMLTextAreaElement)) { return; }

        let indent = '\t';
        if (args.length > 1) {
            const count = parseInt(args[1], 10);
            indent = (Number.isFinite(count) && count >= 0 ? ' '.repeat(count) : args[1]);
        }

        const {selectionStart: start, selectionEnd: end, value} = node;
        const lineStart = value.substring(0, start).lastIndexOf('\n') + 1;
        const lineWhitespaceMatch = /^[ \t]*/.exec(value.substring(lineStart));
        const lineWhitespace = lineWhitespaceMatch !== null ? lineWhitespaceMatch[0] : '';

        if (e.shiftKey) {
            const whitespaceLength = Math.max(0, Math.floor((lineWhitespace.length - 1) / 4) * 4);
            const selectionStartNew = lineStart + whitespaceLength;
            const selectionEndNew = lineStart + lineWhitespace.length;
            const removeCount = selectionEndNew - selectionStartNew;
            if (removeCount > 0) {
                node.selectionStart = selectionStartNew;
                node.selectionEnd = selectionEndNew;
                document.execCommand('delete', false);
                node.selectionStart = Math.max(lineStart, start - removeCount);
                node.selectionEnd = Math.max(lineStart, end - removeCount);
            }
        } else {
            if (indent.length > 0) {
                const indentLength = (Math.ceil((start - lineStart + 1) / indent.length) * indent.length - (start - lineStart));
                document.execCommand('insertText', false, indent.substring(0, indentLength));
            }
        }
    }

    /**
     * @param {HTMLIFrameElement} element
     */
    _setupDeferLoadIframe(element) {
        const parent = this._getMoreContainer(element);
        if (parent === null) { return; }

        /** @type {?MutationObserver} */
        let mutationObserver = null;
        const callback = () => {
            if (!this._isElementVisible(element)) { return false; }

            const src = element.dataset.src;
            delete element.dataset.src;
            if (typeof src === 'string') {
                element.src = src;
            }

            if (mutationObserver === null) { return true; }

            mutationObserver.disconnect();
            mutationObserver = null;
            return true;
        };

        if (callback()) { return; }

        mutationObserver = new MutationObserver(callback);
        mutationObserver.observe(parent, {attributes: true});
    }

    /**
     * @param {HTMLElement} element
     * @returns {boolean}
     */
    _isElementVisible(element) {
        return (element.offsetParent !== null);
    }
}
