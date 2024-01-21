/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2016-2022  Yomichan Authors
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

import {FrameClient} from '../comm/frame-client.js';
import {DynamicProperty} from '../core/dynamic-property.js';
import {EventDispatcher} from '../core/event-dispatcher.js';
import {EventListenerCollection} from '../core/event-listener-collection.js';
import {ExtensionError} from '../core/extension-error.js';
import {deepEqual} from '../core/utilities.js';
import {DocumentUtil} from '../dom/document-util.js';
import {loadStyle} from '../dom/style-util.js';
import {yomitan} from '../yomitan.js';
import {ThemeController} from './theme-controller.js';

/**
 * This class is the container which hosts the display of search results.
 * @augments EventDispatcher<import('popup').Events>
 */
export class Popup extends EventDispatcher {
    /**
     * Creates a new instance.
     * @param {import('popup').PopupConstructorDetails} details The details used to construct the new instance.
     */
    constructor({
        id,
        depth,
        frameId,
        childrenSupported
    }) {
        super();
        /** @type {string} */
        this._id = id;
        /** @type {number} */
        this._depth = depth;
        /** @type {number} */
        this._frameId = frameId;
        /** @type {boolean} */
        this._childrenSupported = childrenSupported;
        /** @type {?Popup} */
        this._parent = null;
        /** @type {?Popup} */
        this._child = null;
        /** @type {?Promise<boolean>} */
        this._injectPromise = null;
        /** @type {boolean} */
        this._injectPromiseComplete = false;
        /** @type {DynamicProperty<boolean>} */
        this._visible = new DynamicProperty(false);
        /** @type {boolean} */
        this._visibleValue = false;
        /** @type {?import('settings').OptionsContext} */
        this._optionsContext = null;
        /** @type {number} */
        this._contentScale = 1.0;
        /** @type {string} */
        this._targetOrigin = chrome.runtime.getURL('/').replace(/\/$/, '');

        /** @type {number} */
        this._initialWidth = 400;
        /** @type {number} */
        this._initialHeight = 250;
        /** @type {number} */
        this._horizontalOffset = 0;
        /** @type {number} */
        this._verticalOffset = 10;
        /** @type {number} */
        this._horizontalOffset2 = 10;
        /** @type {number} */
        this._verticalOffset2 = 0;
        /** @type {import('settings').PopupVerticalTextPosition} */
        this._verticalTextPosition = 'before';
        /** @type {boolean} */
        this._horizontalTextPositionBelow = true;
        /** @type {import('settings').PopupDisplayMode} */
        this._displayMode = 'default';
        /** @type {boolean} */
        this._displayModeIsFullWidth = false;
        /** @type {boolean} */
        this._scaleRelativeToVisualViewport = true;
        /** @type {boolean} */
        this._useSecureFrameUrl = true;
        /** @type {boolean} */
        this._useShadowDom = true;
        /** @type {string} */
        this._customOuterCss = '';

        /** @type {?number} */
        this._frameSizeContentScale = null;
        /** @type {?FrameClient} */
        this._frameClient = null;
        /** @type {HTMLIFrameElement} */
        this._frame = document.createElement('iframe');
        this._frame.className = 'yomitan-popup';
        this._frame.style.width = '0';
        this._frame.style.height = '0';
        /** @type {boolean} */
        this._frameConnected = false;

        /** @type {HTMLElement} */
        this._container = this._frame;
        /** @type {?ShadowRoot} */
        this._shadow = null;

        /** @type {ThemeController} */
        this._themeController = new ThemeController(this._frame);

        /** @type {EventListenerCollection} */
        this._fullscreenEventListeners = new EventListenerCollection();
    }

    /**
     * The ID of the popup.
     * @type {string}
     */
    get id() {
        return this._id;
    }

    /**
     * The parent of the popup.
     * @type {?Popup}
     */
    get parent() {
        return this._parent;
    }

    /**
     * Sets the parent popup.
     * @param {Popup} value The parent popup to assign.
     */
    set parent(value) {
        this._parent = value;
    }

    /**
     * The child of the popup.
     * @type {?Popup}
     */
    get child() {
        return this._child;
    }

    /**
     * Sets the child popup.
     * @param {Popup} value The child popup to assign.
     */
    set child(value) {
        this._child = value;
    }

    /**
     * The depth of the popup.
     * @type {number}
     */
    get depth() {
        return this._depth;
    }

    /**
     * Gets the content window of the frame, which can be `null`
     * depending on the current state of the frame.
     * @type {?Window}
     */
    get frameContentWindow() {
        return this._frame.contentWindow;
    }

    /**
     * Gets the DOM node that contains the frame.
     * @type {Element}
     */
    get container() {
        return this._container;
    }

    /**
     * Gets the ID of the frame.
     * @type {number}
     */
    get frameId() {
        return this._frameId;
    }

    /**
     * Prepares the popup for use.
     */
    prepare() {
        this._frame.addEventListener('mouseover', this._onFrameMouseOver.bind(this));
        this._frame.addEventListener('mouseout', this._onFrameMouseOut.bind(this));
        this._frame.addEventListener('mousedown', (e) => e.stopPropagation());
        this._frame.addEventListener('scroll', (e) => e.stopPropagation());
        this._frame.addEventListener('load', this._onFrameLoad.bind(this));
        this._visible.on('change', this._onVisibleChange.bind(this));
        yomitan.on('extensionUnloaded', this._onExtensionUnloaded.bind(this));
        this._onVisibleChange({value: this.isVisibleSync()});
        this._themeController.prepare();
    }

    /**
     * Sets the options context for the popup.
     * @param {import('settings').OptionsContext} optionsContext The options context object.
     */
    async setOptionsContext(optionsContext) {
        await this._setOptionsContext(optionsContext);
        if (this._frameConnected) {
            await this._invokeSafe('displaySetOptionsContext', {optionsContext});
        }
    }

    /**
     * Hides the popup.
     * @param {boolean} changeFocus Whether or not the parent popup or host frame should be focused.
     */
    hide(changeFocus) {
        if (!this.isVisibleSync()) {
            return;
        }

        this._setVisible(false);
        if (this._child !== null) {
            this._child.hide(false);
        }
        if (changeFocus) {
            this._focusParent();
        }
    }

    /**
     * Returns whether or not the popup is currently visible.
     * @returns {Promise<boolean>} `true` if the popup is visible, `false` otherwise.
     */
    async isVisible() {
        return this.isVisibleSync();
    }

    /**
     * Force assigns the visibility of the popup.
     * @param {boolean} value Whether or not the popup should be visible.
     * @param {number} priority The priority of the override.
     * @returns {Promise<?import('core').TokenString>} A token used which can be passed to `clearVisibleOverride`,
     *   or null if the override wasn't assigned.
     */
    async setVisibleOverride(value, priority) {
        return this._visible.setOverride(value, priority);
    }

    /**
     * Clears a visibility override that was generated by `setVisibleOverride`.
     * @param {import('core').TokenString} token The token returned from `setVisibleOverride`.
     * @returns {Promise<boolean>} `true` if the override existed and was removed, `false` otherwise.
     */
    async clearVisibleOverride(token) {
        return this._visible.clearOverride(token);
    }

    /**
     * Checks whether a point is contained within the popup's rect.
     * @param {number} x The x coordinate.
     * @param {number} y The y coordinate.
     * @returns {Promise<boolean>} `true` if the point is contained within the popup's rect, `false` otherwise.
     */
    async containsPoint(x, y) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        for (let popup = /** @type {?Popup} */ (this); popup !== null && popup.isVisibleSync(); popup = popup.child) {
            const rect = popup.getFrameRect();
            if (rect.valid && x >= rect.left && y >= rect.top && x < rect.right && y < rect.bottom) {
                return true;
            }
        }
        return false;
    }

    /**
     * Shows and updates the positioning and content of the popup.
     * @param {import('popup').ContentDetails} details Settings for the outer popup.
     * @param {?import('display').ContentDetails} displayDetails The details parameter passed to `Display.setContent`.
     * @returns {Promise<void>}
     */
    async showContent(details, displayDetails) {
        if (this._optionsContext === null) { throw new Error('Options not assigned'); }

        const {optionsContext, sourceRects, writingMode} = details;
        if (optionsContext !== null) {
            await this._setOptionsContextIfDifferent(optionsContext);
        }

        await this._show(sourceRects, writingMode);

        if (displayDetails !== null) {
            this._invokeSafe('displaySetContent', {details: displayDetails});
        }
    }

    /**
     * Sets the custom styles for the popup content.
     * @param {string} css The CSS rules.
     */
    async setCustomCss(css) {
        await this._invokeSafe('displaySetCustomCss', {css});
    }

    /**
     * Stops the audio auto-play timer, if one has started.
     */
    async clearAutoPlayTimer() {
        if (this._frameConnected) {
            await this._invokeSafe('displayAudioClearAutoPlayTimer', void 0);
        }
    }

    /**
     * Sets the scaling factor of the popup content.
     * @param {number} scale The scaling factor.
     */
    async setContentScale(scale) {
        this._contentScale = scale;
        this._frame.style.fontSize = `${scale}px`;
        await this._invokeSafe('displaySetContentScale', {scale});
    }

    /**
     * Returns whether or not the popup is currently visible, synchronously.
     * @returns {boolean} `true` if the popup is visible, `false` otherwise.
     */
    isVisibleSync() {
        return this._visible.value;
    }

    /**
     * Updates the outer theme of the popup.
     * @returns {Promise<void>}
     */
    async updateTheme() {
        this._themeController.updateTheme();
    }

    /**
     * Sets the custom styles for the outer popup container.
     * @param {string} css The CSS rules.
     * @param {boolean} useWebExtensionApi Whether or not web extension APIs should be used to inject the rules.
     *   When web extension APIs are used, a DOM node is not generated, making it harder to detect the changes.
     */
    async setCustomOuterCss(css, useWebExtensionApi) {
        let parentNode = null;
        const inShadow = (this._shadow !== null);
        if (inShadow) {
            useWebExtensionApi = false;
            parentNode = this._shadow;
        }
        const node = await loadStyle('yomitan-popup-outer-user-stylesheet', 'code', css, useWebExtensionApi, parentNode);
        this.trigger('customOuterCssChanged', {node, useWebExtensionApi, inShadow});
    }

    /**
     * Gets the rectangle of the DOM frame, synchronously.
     * @returns {import('popup').ValidRect} The rect.
     *   `valid` is `false` for `PopupProxy`, since the DOM node is hosted in a different frame.
     */
    getFrameRect() {
        const {left, top, right, bottom} = this._getFrameBoundingClientRect();
        return {left, top, right, bottom, valid: true};
    }

    /**
     * Gets the size of the DOM frame.
     * @returns {Promise<import('popup').ValidSize>} The size and whether or not it is valid.
     */
    async getFrameSize() {
        const {width, height} = this._getFrameBoundingClientRect();
        return {width, height, valid: true};
    }

    /**
     * Sets the size of the DOM frame.
     * @param {number} width The desired width of the popup.
     * @param {number} height The desired height of the popup.
     * @returns {Promise<boolean>} `true` if the size assignment was successful, `false` otherwise.
     */
    async setFrameSize(width, height) {
        this._setFrameSize(width, height);
        return true;
    }

    // Private functions

    /**
     * @returns {void}
     */
    _onFrameMouseOver() {
        this.trigger('framePointerOver', {});
    }

    /**
     * @returns {void}
     */
    _onFrameMouseOut() {
        this.trigger('framePointerOut', {});
    }

    /**
     * @returns {Promise<boolean>}
     */
    _inject() {
        let injectPromise = this._injectPromise;
        if (injectPromise === null) {
            injectPromise = this._injectInnerWrapper();
            this._injectPromise = injectPromise;
            injectPromise.then(
                () => {
                    if (injectPromise !== this._injectPromise) { return; }
                    this._injectPromiseComplete = true;
                },
                () => {}
            );
        }
        return injectPromise;
    }

    /**
     * @returns {Promise<boolean>}
     */
    async _injectInnerWrapper() {
        try {
            await this._injectInner();
            return true;
        } catch (e) {
            this._resetFrame();
            if (e instanceof PopupError && e.source === this) { return false; } // Passive error
            throw e;
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async _injectInner() {
        if (this._optionsContext === null) {
            throw new Error('Options not initialized');
        }

        const useSecurePopupFrameUrl = this._useSecureFrameUrl;

        await this._setUpContainer(this._useShadowDom);

        /** @type {import('frame-client').SetupFrameFunction} */
        const setupFrame = (frame) => {
            frame.removeAttribute('src');
            frame.removeAttribute('srcdoc');
            this._observeFullscreen(true);
            this._onFullscreenChanged();
            const {contentDocument} = frame;
            if (contentDocument === null) {
                // This can occur when running inside a sandboxed frame without "allow-same-origin"
                // Custom error is used to detect a passive error which should be ignored
                throw new PopupError('Popup not supported in this context', this);
            }
            const url = chrome.runtime.getURL('/popup.html');
            if (useSecurePopupFrameUrl) {
                contentDocument.location.href = url;
            } else {
                frame.setAttribute('src', url);
            }
        };

        const frameClient = new FrameClient();
        this._frameClient = frameClient;
        await frameClient.connect(this._frame, this._targetOrigin, this._frameId, setupFrame);
        this._frameConnected = true;

        // Configure
        /** @type {import('display').DirectApiParams<'displayConfigure'>} */
        const configureParams = {
            depth: this._depth,
            parentPopupId: this._id,
            parentFrameId: this._frameId,
            childrenSupported: this._childrenSupported,
            scale: this._contentScale,
            optionsContext: this._optionsContext
        };
        await this._invokeSafe('displayConfigure', configureParams);
    }

    /**
     * @returns {void}
     */
    _onFrameLoad() {
        if (!this._injectPromiseComplete) { return; }
        this._resetFrame();
    }

    /**
     * @returns {void}
     */
    _resetFrame() {
        const parent = this._container.parentNode;
        if (parent !== null) {
            parent.removeChild(this._container);
        }
        this._frame.removeAttribute('src');
        this._frame.removeAttribute('srcdoc');

        this._frameClient = null;
        this._frameConnected = false;
        this._injectPromise = null;
        this._injectPromiseComplete = false;
    }

    /**
     * @param {boolean} usePopupShadowDom
     */
    async _setUpContainer(usePopupShadowDom) {
        if (usePopupShadowDom && typeof this._frame.attachShadow === 'function') {
            const container = document.createElement('div');
            container.style.setProperty('all', 'initial', 'important');
            const shadow = container.attachShadow({mode: 'closed', delegatesFocus: true});
            shadow.appendChild(this._frame);

            this._container = container;
            this._shadow = shadow;
        } else {
            const frameParentNode = this._frame.parentNode;
            if (frameParentNode !== null) {
                frameParentNode.removeChild(this._frame);
            }

            this._container = this._frame;
            this._shadow = null;
        }

        await this._injectStyles();
    }

    /**
     * @returns {Promise<void>}
     */
    async _injectStyles() {
        try {
            await this._injectPopupOuterStylesheet();
        } catch (e) {
            // NOP
        }

        try {
            await this.setCustomOuterCss(this._customOuterCss, true);
        } catch (e) {
            // NOP
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async _injectPopupOuterStylesheet() {
        /** @type {'code'|'file'|'file-content'} */
        let fileType = 'file';
        let useWebExtensionApi = true;
        let parentNode = null;
        if (this._shadow !== null) {
            fileType = 'file-content';
            useWebExtensionApi = false;
            parentNode = this._shadow;
        }
        await loadStyle('yomitan-popup-outer-stylesheet', fileType, '/css/popup-outer.css', useWebExtensionApi, parentNode);
    }

    /**
     * @param {boolean} observe
     */
    _observeFullscreen(observe) {
        if (!observe) {
            this._fullscreenEventListeners.removeAllEventListeners();
            return;
        }

        if (this._fullscreenEventListeners.size > 0) {
            // Already observing
            return;
        }

        DocumentUtil.addFullscreenChangeEventListener(this._onFullscreenChanged.bind(this), this._fullscreenEventListeners);
    }

    /**
     * @returns {void}
     */
    _onFullscreenChanged() {
        const parent = this._getFrameParentElement();
        if (parent !== null && this._container.parentNode !== parent) {
            parent.appendChild(this._container);
        }
    }

    /**
     * @param {import('popup').Rect[]} sourceRects
     * @param {import('document-util').NormalizedWritingMode} writingMode
     */
    async _show(sourceRects, writingMode) {
        const injected = await this._inject();
        if (!injected) { return; }

        const viewport = this._getViewport(this._scaleRelativeToVisualViewport);
        let {left, top, width, height, after, below} = this._getPosition(sourceRects, writingMode, viewport);

        if (this._displayModeIsFullWidth) {
            left = viewport.left;
            top = below ? viewport.bottom - height : viewport.top;
            width = viewport.right - viewport.left;
        }

        const frame = this._frame;
        frame.dataset.popupDisplayMode = this._displayMode;
        frame.dataset.after = `${after}`;
        frame.dataset.below = `${below}`;
        frame.style.left = `${left}px`;
        frame.style.top = `${top}px`;
        this._setFrameSize(width, height);

        this._setVisible(true);
        if (this._child !== null) {
            this._child.hide(true);
        }
    }

    /**
     * @param {number} width
     * @param {number} height
     */
    _setFrameSize(width, height) {
        const {style} = this._frame;
        style.width = `${width}px`;
        style.height = `${height}px`;
    }

    /**
     * @param {boolean} visible
     */
    _setVisible(visible) {
        this._visible.defaultValue = visible;
    }

    /**
     * @param {import('dynamic-property').EventArgument<boolean, 'change'>} event
     */
    _onVisibleChange({value}) {
        if (this._visibleValue === value) { return; }
        this._visibleValue = value;
        this._frame.style.setProperty('visibility', value ? 'visible' : 'hidden', 'important');
        this._invokeSafe('displayVisibilityChanged', {value});
    }

    /**
     * @returns {void}
     */
    _focusParent() {
        if (this._parent !== null) {
            // Chrome doesn't like focusing iframe without contentWindow.
            const contentWindow = this._parent.frameContentWindow;
            if (contentWindow !== null) {
                contentWindow.focus();
            }
        } else {
            // Firefox doesn't like focusing window without first blurring the iframe.
            // this._frame.contentWindow.blur() doesn't work on Firefox for some reason.
            this._frame.blur();
            // This is needed for Chrome.
            window.focus();
        }
    }

    /**
     * @template {import('display').DirectApiNames} TName
     * @param {TName} action
     * @param {import('display').DirectApiParams<TName>} params
     * @returns {Promise<import('display').DirectApiReturn<TName>>}
     */
    async _invoke(action, params) {
        const contentWindow = this._frame.contentWindow;
        if (this._frameClient === null || !this._frameClient.isConnected() || contentWindow === null) {
            throw new Error(`Failed to invoke action ${action}: frame state invalid`);
        }

        /** @type {import('display').DirectApiMessage<TName>} */
        const message = {action, params};
        const wrappedMessage = this._frameClient.createMessage(message);
        return /** @type {import('display').DirectApiReturn<TName>} */ (await yomitan.crossFrame.invoke(
            this._frameClient.frameId,
            'displayPopupMessage1',
            /** @type {import('display').DirectApiFrameClientMessageAny} */ (wrappedMessage)
        ));
    }

    /**
     * @template {import('display').DirectApiNames} TName
     * @param {TName} action
     * @param {import('display').DirectApiParams<TName>} params
     * @returns {Promise<import('display').DirectApiReturn<TName>|undefined>}
     */
    async _invokeSafe(action, params) {
        try {
            return await this._invoke(action, params);
        } catch (e) {
            if (!yomitan.webExtension.unloaded) { throw e; }
            return void 0;
        }
    }

    /**
     * @param {string} action
     * @param {import('core').SerializableObject} params
     */
    _invokeWindow(action, params = {}) {
        const contentWindow = this._frame.contentWindow;
        if (this._frameClient === null || !this._frameClient.isConnected() || contentWindow === null) { return; }

        const message = this._frameClient.createMessage({action, params});
        contentWindow.postMessage(message, this._targetOrigin);
    }

    /**
     * @returns {void}
     */
    _onExtensionUnloaded() {
        this._invokeWindow('displayExtensionUnloaded');
    }

    /**
     * @returns {Element}
     */
    _getFrameParentElement() {
        let defaultParent = document.body;
        if (defaultParent !== null && defaultParent.tagName.toLowerCase() === 'frameset') {
            defaultParent = document.documentElement;
        }
        const fullscreenElement = DocumentUtil.getFullscreenElement();
        if (
            fullscreenElement === null ||
            fullscreenElement.shadowRoot ||
            // @ts-expect-error - openOrClosedShadowRoot is available to Firefox 63+ for WebExtensions
            fullscreenElement.openOrClosedShadowRoot
        ) {
            return defaultParent;
        }

        switch (fullscreenElement.nodeName.toUpperCase()) {
            case 'IFRAME':
            case 'FRAME':
                return defaultParent;
        }

        return fullscreenElement;
    }

    /**
     * Computes the position where the popup should be placed relative to the source content.
     * @param {import('popup').Rect[]} sourceRects The rectangles of the source content.
     * @param {import('document-util').NormalizedWritingMode} writingMode The CSS writing mode of the source text.
     * @param {import('popup').Rect} viewport The viewport that the popup can be placed within.
     * @returns {import('popup').SizeRect} The calculated rectangle for where to position the popup.
     */
    _getPosition(sourceRects, writingMode, viewport) {
        sourceRects = this._convertSourceRectsCoordinateSpace(sourceRects);
        const contentScale = this._contentScale;
        const scaleRatio = this._frameSizeContentScale === null ? 1.0 : contentScale / this._frameSizeContentScale;
        this._frameSizeContentScale = contentScale;
        const frameRect = this._frame.getBoundingClientRect();
        const frameWidth = Math.max(frameRect.width * scaleRatio, this._initialWidth * contentScale);
        const frameHeight = Math.max(frameRect.height * scaleRatio, this._initialHeight * contentScale);

        const horizontal = (writingMode === 'horizontal-tb' || this._verticalTextPosition === 'default');
        let preferAfter;
        let horizontalOffset;
        let verticalOffset;
        if (horizontal) {
            preferAfter = this._horizontalTextPositionBelow;
            horizontalOffset = this._horizontalOffset;
            verticalOffset = this._verticalOffset;
        } else {
            preferAfter = this._isVerticalTextPopupOnRight(this._verticalTextPosition, writingMode);
            horizontalOffset = this._horizontalOffset2;
            verticalOffset = this._verticalOffset2;
        }
        horizontalOffset *= contentScale;
        verticalOffset *= contentScale;

        /** @type {?import('popup').SizeRect} */
        let best = null;
        const sourceRectsLength = sourceRects.length;
        for (let i = 0, ii = (sourceRectsLength > 1 ? sourceRectsLength : 0); i <= ii; ++i) {
            const sourceRect = i < sourceRectsLength ? sourceRects[i] : this._getBoundingSourceRect(sourceRects);
            const result = (
                horizontal ?
                this._getPositionForHorizontalText(sourceRect, frameWidth, frameHeight, viewport, horizontalOffset, verticalOffset, preferAfter) :
                this._getPositionForVerticalText(sourceRect, frameWidth, frameHeight, viewport, horizontalOffset, verticalOffset, preferAfter)
            );
            if (i < ii && this._isOverlapping(result, sourceRects, i)) { continue; }
            if (best === null || result.height > best.height) {
                best = result;
                if (result.height >= frameHeight) { break; }
            }
        }
        // Given the loop conditions, this is guaranteed to be non-null
        return /** @type {import('popup').SizeRect} */ (best);
    }

    /**
     * Computes the position where the popup should be placed for horizontal text.
     * @param {import('popup').Rect} sourceRect The rectangle of the source content.
     * @param {number} frameWidth The preferred width of the frame.
     * @param {number} frameHeight The preferred height of the frame.
     * @param {import('popup').Rect} viewport The viewport that the frame can be placed within.
     * @param {number} horizontalOffset The horizontal offset from the source rect that the popup will be placed.
     * @param {number} verticalOffset The vertical offset from the source rect that the popup will be placed.
     * @param {boolean} preferBelow Whether or not the popup is preferred to be placed below the source content.
     * @returns {import('popup').SizeRect} The calculated rectangle for where to position the popup.
     */
    _getPositionForHorizontalText(sourceRect, frameWidth, frameHeight, viewport, horizontalOffset, verticalOffset, preferBelow) {
        const [left, width, after] = this._getConstrainedPosition(
            sourceRect.right - horizontalOffset,
            sourceRect.left + horizontalOffset,
            frameWidth,
            viewport.left,
            viewport.right,
            true
        );
        const [top, height, below] = this._getConstrainedPositionBinary(
            sourceRect.top - verticalOffset,
            sourceRect.bottom + verticalOffset,
            frameHeight,
            viewport.top,
            viewport.bottom,
            preferBelow
        );
        return {left, top, width, height, after, below};
    }

    /**
     * Computes the position where the popup should be placed for vertical text.
     * @param {import('popup').Rect} sourceRect The rectangle of the source content.
     * @param {number} frameWidth The preferred width of the frame.
     * @param {number} frameHeight The preferred height of the frame.
     * @param {import('popup').Rect} viewport The viewport that the frame can be placed within.
     * @param {number} horizontalOffset The horizontal offset from the source rect that the popup will be placed.
     * @param {number} verticalOffset The vertical offset from the source rect that the popup will be placed.
     * @param {boolean} preferRight Whether or not the popup is preferred to be placed to the right of the source content.
     * @returns {import('popup').SizeRect} The calculated rectangle for where to position the popup.
     */
    _getPositionForVerticalText(sourceRect, frameWidth, frameHeight, viewport, horizontalOffset, verticalOffset, preferRight) {
        const [left, width, after] = this._getConstrainedPositionBinary(
            sourceRect.left - horizontalOffset,
            sourceRect.right + horizontalOffset,
            frameWidth,
            viewport.left,
            viewport.right,
            preferRight
        );
        const [top, height, below] = this._getConstrainedPosition(
            sourceRect.bottom - verticalOffset,
            sourceRect.top + verticalOffset,
            frameHeight,
            viewport.top,
            viewport.bottom,
            true
        );
        return {left, top, width, height, after, below};
    }

    /**
     * @param {import('settings').PopupVerticalTextPosition} positionPreference
     * @param {import('document-util').NormalizedWritingMode} writingMode
     * @returns {boolean}
     */
    _isVerticalTextPopupOnRight(positionPreference, writingMode) {
        switch (positionPreference) {
            case 'before':
                return !this._isWritingModeLeftToRight(writingMode);
            case 'after':
                return this._isWritingModeLeftToRight(writingMode);
            case 'right':
                return true;
            // case 'left':
            default:
                return false;
        }
    }

    /**
     * @param {import('document-util').NormalizedWritingMode} writingMode
     * @returns {boolean}
     */
    _isWritingModeLeftToRight(writingMode) {
        switch (writingMode) {
            case 'vertical-lr':
            case 'sideways-lr':
                return true;
            default:
                return false;
        }
    }

    /**
     * @param {number} positionBefore
     * @param {number} positionAfter
     * @param {number} size
     * @param {number} minLimit
     * @param {number} maxLimit
     * @param {boolean} after
     * @returns {[position: number, size: number, after: boolean]}
     */
    _getConstrainedPosition(positionBefore, positionAfter, size, minLimit, maxLimit, after) {
        size = Math.min(size, maxLimit - minLimit);

        let position;
        if (after) {
            position = Math.max(minLimit, positionAfter);
            position = position - Math.max(0, (position + size) - maxLimit);
        } else {
            position = Math.min(maxLimit, positionBefore) - size;
            position = position + Math.max(0, minLimit - position);
        }

        return [position, size, after];
    }

    /**
     * @param {number} positionBefore
     * @param {number} positionAfter
     * @param {number} size
     * @param {number} minLimit
     * @param {number} maxLimit
     * @param {boolean} after
     * @returns {[position: number, size: number, after: boolean]}
     */
    _getConstrainedPositionBinary(positionBefore, positionAfter, size, minLimit, maxLimit, after) {
        const overflowBefore = minLimit - (positionBefore - size);
        const overflowAfter = (positionAfter + size) - maxLimit;

        if (overflowAfter > 0 || overflowBefore > 0) {
            after = (overflowAfter < overflowBefore);
        }

        let position;
        if (after) {
            size -= Math.max(0, overflowAfter);
            position = Math.max(minLimit, positionAfter);
        } else {
            size -= Math.max(0, overflowBefore);
            position = Math.min(maxLimit, positionBefore) - size;
        }

        return [position, size, after];
    }

    /**
     * Gets the visual viewport.
     * @param {boolean} useVisualViewport Whether or not the `window.visualViewport` should be used.
     * @returns {import('popup').Rect} The rectangle of the visual viewport.
     */
    _getViewport(useVisualViewport) {
        const {visualViewport} = window;
        if (typeof visualViewport !== 'undefined' && visualViewport !== null) {
            const left = visualViewport.offsetLeft;
            const top = visualViewport.offsetTop;
            const width = visualViewport.width;
            const height = visualViewport.height;
            if (useVisualViewport) {
                return {
                    left,
                    top,
                    right: left + width,
                    bottom: top + height
                };
            } else {
                const scale = visualViewport.scale;
                return {
                    left: 0,
                    top: 0,
                    right: Math.max(left + width, width * scale),
                    bottom: Math.max(top + height, height * scale)
                };
            }
        }

        return {
            left: 0,
            top: 0,
            right: window.innerWidth,
            bottom: window.innerHeight
        };
    }

    /**
     * @param {import('settings').OptionsContext} optionsContext
     */
    async _setOptionsContext(optionsContext) {
        this._optionsContext = optionsContext;
        const options = await yomitan.api.optionsGet(optionsContext);
        const {general} = options;
        this._themeController.theme = general.popupTheme;
        this._themeController.outerTheme = general.popupOuterTheme;
        this._initialWidth = general.popupWidth;
        this._initialHeight = general.popupHeight;
        this._horizontalOffset = general.popupHorizontalOffset;
        this._verticalOffset = general.popupVerticalOffset;
        this._horizontalOffset2 = general.popupHorizontalOffset2;
        this._verticalOffset2 = general.popupVerticalOffset2;
        this._verticalTextPosition = general.popupVerticalTextPosition;
        this._horizontalTextPositionBelow = (general.popupHorizontalTextPosition === 'below');
        this._displayMode = general.popupDisplayMode;
        this._displayModeIsFullWidth = (this._displayMode === 'full-width');
        this._scaleRelativeToVisualViewport = general.popupScaleRelativeToVisualViewport;
        this._useSecureFrameUrl = general.useSecurePopupFrameUrl;
        this._useShadowDom = general.usePopupShadowDom;
        this._customOuterCss = general.customPopupOuterCss;
        this.updateTheme();
    }

    /**
     * @param {import('settings').OptionsContext} optionsContext
     */
    async _setOptionsContextIfDifferent(optionsContext) {
        if (deepEqual(this._optionsContext, optionsContext)) { return; }
        await this._setOptionsContext(optionsContext);
    }

    /**
     * Computes the bounding rectangle for a set of rectangles.
     * @param {import('popup').Rect[]} sourceRects An array of rectangles.
     * @returns {import('popup').Rect} The bounding rectangle for all of the source rectangles.
     */
    _getBoundingSourceRect(sourceRects) {
        switch (sourceRects.length) {
            case 0: return {left: 0, top: 0, right: 0, bottom: 0};
            case 1: return sourceRects[0];
        }
        let {left, top, right, bottom} = sourceRects[0];
        for (let i = 1, ii = sourceRects.length; i < ii; ++i) {
            const sourceRect = sourceRects[i];
            left = Math.min(left, sourceRect.left);
            top = Math.min(top, sourceRect.top);
            right = Math.max(right, sourceRect.right);
            bottom = Math.max(bottom, sourceRect.bottom);
        }
        return {left, top, right, bottom};
    }

    /**
     * Checks whether or not a rectangle is overlapping any other rectangles.
     * @param {import('popup').SizeRect} sizeRect The rectangles to check for overlaps.
     * @param {import('popup').Rect[]} sourceRects The list of rectangles to compare against.
     * @param {number} ignoreIndex The index of an item in `sourceRects` to ignore.
     * @returns {boolean} `true` if `sizeRect` overlaps any one of `sourceRects`, excluding `sourceRects[ignoreIndex]`; `false` otherwise.
     */
    _isOverlapping(sizeRect, sourceRects, ignoreIndex) {
        const {left, top} = sizeRect;
        const right = left + sizeRect.width;
        const bottom = top + sizeRect.height;
        for (let i = 0, ii = sourceRects.length; i < ii; ++i) {
            if (i === ignoreIndex) { continue; }
            const sourceRect = sourceRects[i];
            if (
                left < sourceRect.right &&
                right > sourceRect.left &&
                top < sourceRect.bottom &&
                bottom > sourceRect.top
            ) {
                return true;
            }
        }
        return false;
    }

    /**
     * Gets the bounding client rect for the frame element, with a coordinate conversion applied.
     * @returns {DOMRect} The rectangle of the frame.
     */
    _getFrameBoundingClientRect() {
        return DocumentUtil.convertRectZoomCoordinates(this._frame.getBoundingClientRect(), this._container);
    }

    /**
     * Converts the coordinate space of source rectangles.
     * @param {import('popup').Rect[]} sourceRects The list of rectangles to convert.
     * @returns {import('popup').Rect[]} Either an updated list of rectangles, or `sourceRects` if no change is required.
     */
    _convertSourceRectsCoordinateSpace(sourceRects) {
        let scale = DocumentUtil.computeZoomScale(this._container);
        if (scale === 1) { return sourceRects; }
        scale = 1 / scale;
        const sourceRects2 = [];
        for (const rect of sourceRects) {
            sourceRects2.push(this._createScaledRect(rect, scale));
        }
        return sourceRects2;
    }

    /**
     * Creates a scaled rectangle.
     * @param {import('popup').Rect} rect The rectangle to scale.
     * @param {number} scale The scale factor.
     * @returns {import('popup').Rect} A new rectangle which has been scaled.
     */
    _createScaledRect(rect, scale) {
        return {
            left: rect.left * scale,
            top: rect.top * scale,
            right: rect.right * scale,
            bottom: rect.bottom * scale
        };
    }
}

class PopupError extends ExtensionError {
    /**
     * @param {string} message
     * @param {Popup} source
     */
    constructor(message, source) {
        super(message);
        /** @type {Popup} */
        this._source = source;
    }

    /** @type {Popup} */
    get source() { return this._source; }
}
