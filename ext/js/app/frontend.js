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

import {createApiMap, invokeApiMapHandler} from '../core/api-map.js';
import {EventListenerCollection} from '../core/event-listener-collection.js';
import {log} from '../core/logger.js';
import {promiseAnimationFrame} from '../core/utilities.js';
import {DocumentUtil} from '../dom/document-util.js';
import {TextSourceElement} from '../dom/text-source-element.js';
import {TextSourceRange} from '../dom/text-source-range.js';
import {TextScanner} from '../language/text-scanner.js';
import {yomitan} from '../yomitan.js';

/**
 * This is the main class responsible for scanning and handling webpage content.
 */
export class Frontend {
    /**
     * Creates a new instance.
     * @param {import('frontend').ConstructorDetails} details Details about how to set up the instance.
     */
    constructor({
        pageType,
        popupFactory,
        depth,
        tabId,
        frameId,
        parentPopupId,
        parentFrameId,
        useProxyPopup,
        canUseWindowPopup = true,
        allowRootFramePopupProxy,
        childrenSupported = true,
        hotkeyHandler
    }) {
        /** @type {import('frontend').PageType} */
        this._pageType = pageType;
        /** @type {import('./popup-factory.js').PopupFactory} */
        this._popupFactory = popupFactory;
        /** @type {number} */
        this._depth = depth;
        /** @type {number|undefined} */
        this._tabId = tabId;
        /** @type {number} */
        this._frameId = frameId;
        /** @type {?string} */
        this._parentPopupId = parentPopupId;
        /** @type {?number} */
        this._parentFrameId = parentFrameId;
        /** @type {boolean} */
        this._useProxyPopup = useProxyPopup;
        /** @type {boolean} */
        this._canUseWindowPopup = canUseWindowPopup;
        /** @type {boolean} */
        this._allowRootFramePopupProxy = allowRootFramePopupProxy;
        /** @type {boolean} */
        this._childrenSupported = childrenSupported;
        /** @type {import('../input/hotkey-handler.js').HotkeyHandler} */
        this._hotkeyHandler = hotkeyHandler;
        /** @type {?import('popup').PopupAny} */
        this._popup = null;
        /** @type {boolean} */
        this._disabledOverride = false;
        /** @type {?import('settings').ProfileOptions} */
        this._options = null;
        /** @type {number} */
        this._pageZoomFactor = 1.0;
        /** @type {number} */
        this._contentScale = 1.0;
        /** @type {Promise<void>} */
        this._lastShowPromise = Promise.resolve();
        /** @type {TextScanner} */
        this._textScanner = new TextScanner({
            node: window,
            ignoreElements: this._ignoreElements.bind(this),
            ignorePoint: this._ignorePoint.bind(this),
            getSearchContext: this._getSearchContext.bind(this),
            searchTerms: true,
            searchKanji: true
        });
        /** @type {boolean} */
        this._textScannerHasBeenEnabled = false;
        /** @type {Map<'default'|'window'|'iframe'|'proxy', Promise<?import('popup').PopupAny>>} */
        this._popupCache = new Map();
        /** @type {EventListenerCollection} */
        this._popupEventListeners = new EventListenerCollection();
        /** @type {?import('core').TokenObject} */
        this._updatePopupToken = null;
        /** @type {?import('core').Timeout} */
        this._clearSelectionTimer = null;
        /** @type {boolean} */
        this._isPointerOverPopup = false;
        /** @type {?import('settings').OptionsContext} */
        this._optionsContextOverride = null;

        /* eslint-disable no-multi-spaces */
        /** @type {import('application').ApiMap} */
        this._runtimeApiMap = createApiMap([
            ['frontendRequestReadyBroadcast',   this._onMessageRequestFrontendReadyBroadcast.bind(this)],
            ['frontendSetAllVisibleOverride',   this._onApiSetAllVisibleOverride.bind(this)],
            ['frontendClearAllVisibleOverride', this._onApiClearAllVisibleOverride.bind(this)]
        ]);

        this._hotkeyHandler.registerActions([
            ['scanSelectedText', this._onActionScanSelectedText.bind(this)],
            ['scanTextAtCaret',  this._onActionScanTextAtCaret.bind(this)]
        ]);
        /* eslint-enable no-multi-spaces */
    }

    /**
     * Get whether or not the text selection can be cleared.
     * @type {boolean}
     */
    get canClearSelection() {
        return this._textScanner.canClearSelection;
    }

    /**
     * Set whether or not the text selection can be cleared.
     * @param {boolean} value The new value to assign.
     */
    set canClearSelection(value) {
        this._textScanner.canClearSelection = value;
    }

    /**
     * Gets the popup instance.
     * @type {?import('popup').PopupAny}
     */
    get popup() {
        return this._popup;
    }

    /**
     * Prepares the instance for use.
     */
    async prepare() {
        await this.updateOptions();
        try {
            const {zoomFactor} = await yomitan.api.getZoom();
            this._pageZoomFactor = zoomFactor;
        } catch (e) {
            // Ignore exceptions which may occur due to being on an unsupported page (e.g. about:blank)
        }

        this._textScanner.prepare();

        window.addEventListener('resize', this._onResize.bind(this), false);
        DocumentUtil.addFullscreenChangeEventListener(this._updatePopup.bind(this));

        const {visualViewport} = window;
        if (typeof visualViewport !== 'undefined' && visualViewport !== null) {
            visualViewport.addEventListener('scroll', this._onVisualViewportScroll.bind(this));
            visualViewport.addEventListener('resize', this._onVisualViewportResize.bind(this));
        }

        yomitan.on('optionsUpdated', this.updateOptions.bind(this));
        yomitan.on('zoomChanged', this._onZoomChanged.bind(this));
        yomitan.on('closePopups', this._onClosePopups.bind(this));
        chrome.runtime.onMessage.addListener(this._onRuntimeMessage.bind(this));

        this._textScanner.on('clear', this._onTextScannerClear.bind(this));
        this._textScanner.on('searched', this._onSearched.bind(this));

        /* eslint-disable no-multi-spaces */
        yomitan.crossFrame.registerHandlers([
            ['frontendClosePopup',       this._onApiClosePopup.bind(this)],
            ['frontendCopySelection',    this._onApiCopySelection.bind(this)],
            ['frontendGetSelectionText', this._onApiGetSelectionText.bind(this)],
            ['frontendGetPopupInfo',     this._onApiGetPopupInfo.bind(this)],
            ['frontendGetPageInfo',      this._onApiGetPageInfo.bind(this)]
        ]);
        /* eslint-enable no-multi-spaces */

        this._prepareSiteSpecific();
        this._updateContentScale();
        this._signalFrontendReady(null);
    }

    /**
     * Set whether or not the instance is disabled.
     * @param {boolean} disabled Whether or not the instance is disabled.
     */
    setDisabledOverride(disabled) {
        this._disabledOverride = disabled;
        this._updateTextScannerEnabled();
    }

    /**
     * Set or clear an override options context object.
     * @param {?import('settings').OptionsContext} optionsContext An options context object to use as the override, or `null` to clear the override.
     */
    setOptionsContextOverride(optionsContext) {
        this._optionsContextOverride = optionsContext;
    }

    /**
     * Performs a new search on a specific source.
     * @param {import('text-source').TextSource} textSource The text source to search.
     */
    async setTextSource(textSource) {
        this._textScanner.setCurrentTextSource(null);
        await this._textScanner.search(textSource);
    }

    /**
     * Updates the internal options representation.
     */
    async updateOptions() {
        try {
            await this._updateOptionsInternal();
        } catch (e) {
            if (!yomitan.webExtension.unloaded) {
                throw e;
            }
        }
    }

    /**
     * Waits for the previous `showContent` call to be completed.
     * @returns {Promise<void>} A promise which is resolved when the previous `showContent` call has completed.
     */
    showContentCompleted() {
        return this._lastShowPromise;
    }

    // Message handlers

    /** @type {import('application').ApiHandler<'frontendRequestReadyBroadcast'>} */
    _onMessageRequestFrontendReadyBroadcast({frameId}) {
        this._signalFrontendReady(frameId);
    }

    // Action handlers

    /**
     * @returns {void}
     */
    _onActionScanSelectedText() {
        this._scanSelectedText(false);
    }

    /**
     * @returns {void}
     */
    _onActionScanTextAtCaret() {
        this._scanSelectedText(true);
    }

    // API message handlers

    /** @type {import('cross-frame-api').ApiHandler<'frontendClosePopup'>} */
    _onApiClosePopup() {
        this._clearSelection(false);
    }

    /** @type {import('cross-frame-api').ApiHandler<'frontendCopySelection'>} */
    _onApiCopySelection() {
        // This will not work on Firefox if a popup has focus, which is usually the case when this function is called.
        document.execCommand('copy');
    }

    /** @type {import('cross-frame-api').ApiHandler<'frontendGetSelectionText'>} */
    _onApiGetSelectionText() {
        const selection = document.getSelection();
        return selection !== null ? selection.toString() : '';
    }

    /** @type {import('cross-frame-api').ApiHandler<'frontendGetPopupInfo'>} */
    _onApiGetPopupInfo() {
        return {
            popupId: (this._popup !== null ? this._popup.id : null)
        };
    }

    /** @type {import('cross-frame-api').ApiHandler<'frontendGetPageInfo'>} */
    _onApiGetPageInfo() {
        return {
            url: window.location.href,
            documentTitle: document.title
        };
    }

    /** @type {import('application').ApiHandler<'frontendSetAllVisibleOverride'>} */
    async _onApiSetAllVisibleOverride({value, priority, awaitFrame}) {
        const result = await this._popupFactory.setAllVisibleOverride(value, priority);
        if (awaitFrame) {
            await promiseAnimationFrame(100);
        }
        return result;
    }

    /** @type {import('application').ApiHandler<'frontendClearAllVisibleOverride'>} */
    async _onApiClearAllVisibleOverride({token}) {
        return await this._popupFactory.clearAllVisibleOverride(token);
    }

    // Private

    /**
     * @returns {void}
     */
    _onResize() {
        this._updatePopupPosition();
    }

    /** @type {import('extension').ChromeRuntimeOnMessageCallback<import('application').ApiMessageAny>} */
    _onRuntimeMessage({action, params}, _sender, callback) {
        return invokeApiMapHandler(this._runtimeApiMap, action, params, [], callback);
    }

    /**
     * @param {{newZoomFactor: number}} params
     */
    _onZoomChanged({newZoomFactor}) {
        this._pageZoomFactor = newZoomFactor;
        this._updateContentScale();
    }

    /**
     * @returns {void}
     */
    _onClosePopups() {
        this._clearSelection(true);
    }

    /**
     * @returns {void}
     */
    _onVisualViewportScroll() {
        this._updatePopupPosition();
    }

    /**
     * @returns {void}
     */
    _onVisualViewportResize() {
        this._updateContentScale();
    }

    /**
     * @returns {void}
     */
    _onTextScannerClear() {
        this._clearSelection(false);
    }

    /**
     * @param {import('text-scanner').SearchedEventDetails} details
     */
    _onSearched({type, dictionaryEntries, sentence, inputInfo: {eventType, passive, detail: inputInfoDetail}, textSource, optionsContext, detail, error}) {
        const scanningOptions = /** @type {import('settings').ProfileOptions} */ (this._options).scanning;

        if (error !== null) {
            if (yomitan.webExtension.unloaded) {
                if (textSource !== null && !passive) {
                    this._showExtensionUnloaded(textSource);
                }
            } else {
                log.error(error);
            }
        } if (type !== null && optionsContext !== null) {
            this._stopClearSelectionDelayed();
            let focus = (eventType === 'mouseMove');
            if (typeof inputInfoDetail === 'object' && inputInfoDetail !== null) {
                const focus2 = inputInfoDetail.focus;
                if (typeof focus2 === 'boolean') { focus = focus2; }
            }
            this._showContent(textSource, focus, dictionaryEntries, type, sentence, detail !== null ? detail.documentTitle : null, optionsContext);
        } else {
            if (scanningOptions.autoHideResults) {
                this._clearSelectionDelayed(scanningOptions.hideDelay, false, false);
            }
        }
    }

    /**
     * @returns {void}
     */
    _onPopupFramePointerOver() {
        this._isPointerOverPopup = true;
        this._stopClearSelectionDelayed();
    }

    /**
     * @returns {void}
     */
    _onPopupFramePointerOut() {
        this._isPointerOverPopup = false;
        const scanningOptions = /** @type {import('settings').ProfileOptions} */ (this._options).scanning;
        if (scanningOptions.hidePopupOnCursorExit) {
            this._clearSelectionDelayed(scanningOptions.hidePopupOnCursorExitDelay, false, false);
        }
    }

    /**
     * @param {boolean} passive
     */
    _clearSelection(passive) {
        this._stopClearSelectionDelayed();
        if (this._popup !== null) {
            this._popup.clearAutoPlayTimer();
            this._popup.hide(!passive);
            this._isPointerOverPopup = false;
        }
        this._textScanner.clearSelection();
    }

    /**
     * @param {number} delay
     * @param {boolean} restart
     * @param {boolean} passive
     */
    _clearSelectionDelayed(delay, restart, passive) {
        if (!this._textScanner.hasSelection()) { return; }
        if (delay > 0) {
            if (this._clearSelectionTimer !== null && !restart) { return; } // Already running
            this._stopClearSelectionDelayed();
            this._clearSelectionTimer = setTimeout(() => {
                this._clearSelectionTimer = null;
                if (this._isPointerOverPopup) { return; }
                this._clearSelection(passive);
            }, delay);
        } else {
            this._clearSelection(passive);
        }
    }

    /**
     * @returns {void}
     */
    _stopClearSelectionDelayed() {
        if (this._clearSelectionTimer !== null) {
            clearTimeout(this._clearSelectionTimer);
            this._clearSelectionTimer = null;
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async _updateOptionsInternal() {
        const optionsContext = await this._getOptionsContext();
        const options = await yomitan.api.optionsGet(optionsContext);
        const {scanning: scanningOptions, sentenceParsing: sentenceParsingOptions} = options;
        this._options = options;

        this._hotkeyHandler.setHotkeys('web', options.inputs.hotkeys);

        await this._updatePopup();

        const preventMiddleMouse = this._getPreventMiddleMouseValueForPageType(scanningOptions.preventMiddleMouse);
        this._textScanner.setOptions({
            inputs: scanningOptions.inputs,
            deepContentScan: scanningOptions.deepDomScan,
            normalizeCssZoom: scanningOptions.normalizeCssZoom,
            selectText: scanningOptions.selectText,
            delay: scanningOptions.delay,
            touchInputEnabled: scanningOptions.touchInputEnabled,
            pointerEventsEnabled: scanningOptions.pointerEventsEnabled,
            scanLength: scanningOptions.length,
            layoutAwareScan: scanningOptions.layoutAwareScan,
            matchTypePrefix: scanningOptions.matchTypePrefix,
            preventMiddleMouse,
            sentenceParsingOptions
        });
        this._updateTextScannerEnabled();

        if (this._pageType !== 'web') {
            const excludeSelectors = ['.scan-disable', '.scan-disable *'];
            if (!scanningOptions.enableOnPopupExpressions) {
                excludeSelectors.push('.source-text', '.source-text *');
            }
            this._textScanner.excludeSelector = excludeSelectors.join(',');
        }

        this._updateContentScale();

        await this._textScanner.searchLast();
    }

    /**
     * @returns {Promise<void>}
     */
    async _updatePopup() {
        const {usePopupWindow, showIframePopupsInRootFrame} = /** @type {import('settings').ProfileOptions} */ (this._options).general;
        const isIframe = !this._useProxyPopup && (window !== window.parent);

        const currentPopup = this._popup;

        /** @type {Promise<?import('popup').PopupAny>|undefined} */
        let popupPromise;
        if (usePopupWindow && this._canUseWindowPopup) {
            popupPromise = this._popupCache.get('window');
            if (typeof popupPromise === 'undefined') {
                popupPromise = this._getPopupWindow();
                this._popupCache.set('window', popupPromise);
            }
        } else if (
            isIframe &&
            showIframePopupsInRootFrame &&
            DocumentUtil.getFullscreenElement() === null &&
            this._allowRootFramePopupProxy
        ) {
            popupPromise = this._popupCache.get('iframe');
            if (typeof popupPromise === 'undefined') {
                popupPromise = this._getIframeProxyPopup();
                this._popupCache.set('iframe', popupPromise);
            }
        } else if (this._useProxyPopup) {
            popupPromise = this._popupCache.get('proxy');
            if (typeof popupPromise === 'undefined') {
                popupPromise = this._getProxyPopup();
                this._popupCache.set('proxy', popupPromise);
            }
        } else {
            popupPromise = this._popupCache.get('default');
            if (typeof popupPromise === 'undefined') {
                popupPromise = this._getDefaultPopup();
                this._popupCache.set('default', popupPromise);
            }
        }

        /**
         * The token below is used as a unique identifier to ensure that a new _updatePopup call
         * hasn't been started during the await.
         * @type {?import('core').TokenObject}
         */
        const token = {};
        this._updatePopupToken = token;
        const popup = await popupPromise;
        const optionsContext = await this._getOptionsContext();
        if (this._updatePopupToken !== token) { return; }
        if (popup !== null) {
            await popup.setOptionsContext(optionsContext);
        }
        if (this._updatePopupToken !== token) { return; }

        if (popup !== currentPopup) {
            this._clearSelection(true);
        }

        this._popupEventListeners.removeAllEventListeners();
        this._popup = popup;
        if (popup !== null) {
            this._popupEventListeners.on(popup, 'framePointerOver', this._onPopupFramePointerOver.bind(this));
            this._popupEventListeners.on(popup, 'framePointerOut', this._onPopupFramePointerOut.bind(this));
        }
        this._isPointerOverPopup = false;
    }

    /**
     * @returns {Promise<?import('popup').PopupAny>}
     */
    async _getDefaultPopup() {
        const isXmlDocument = (typeof XMLDocument !== 'undefined' && document instanceof XMLDocument);
        if (isXmlDocument) {
            return null;
        }

        return await this._popupFactory.getOrCreatePopup({
            frameId: this._frameId,
            depth: this._depth,
            childrenSupported: this._childrenSupported
        });
    }

    /**
     * @returns {Promise<import('popup').PopupAny>}
     */
    async _getProxyPopup() {
        return await this._popupFactory.getOrCreatePopup({
            frameId: this._parentFrameId,
            depth: this._depth,
            parentPopupId: this._parentPopupId,
            childrenSupported: this._childrenSupported
        });
    }

    /**
     * @returns {Promise<?import('popup').PopupAny>}
     */
    async _getIframeProxyPopup() {
        const targetFrameId = 0; // Root frameId
        try {
            await this._waitForFrontendReady(targetFrameId, 10000);
        } catch (e) {
            // Root frame not available
            return await this._getDefaultPopup();
        }

        const {popupId} = await yomitan.crossFrame.invoke(targetFrameId, 'frontendGetPopupInfo', void 0);
        if (popupId === null) {
            return null;
        }

        const popup = await this._popupFactory.getOrCreatePopup({
            frameId: targetFrameId,
            id: popupId,
            childrenSupported: this._childrenSupported
        });
        popup.on('offsetNotFound', () => {
            this._allowRootFramePopupProxy = false;
            this._updatePopup();
        });
        return popup;
    }

    /**
     * @returns {Promise<import('popup').PopupAny>}
     */
    async _getPopupWindow() {
        return await this._popupFactory.getOrCreatePopup({
            depth: this._depth,
            popupWindow: true,
            childrenSupported: this._childrenSupported
        });
    }

    /**
     * @returns {Element[]}
     */
    _ignoreElements() {
        if (this._popup !== null) {
            const container = this._popup.container;
            if (container !== null) {
                return [container];
            }
        }
        return [];
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {Promise<boolean>}
     */
    async _ignorePoint(x, y) {
        try {
            return this._popup !== null && await this._popup.containsPoint(x, y);
        } catch (e) {
            if (!yomitan.webExtension.unloaded) {
                throw e;
            }
            return false;
        }
    }

    /**
     * @param {import('text-source').TextSource} textSource
     */
    _showExtensionUnloaded(textSource) {
        this._showPopupContent(textSource, null, null);
    }

    /**
     * @param {import('text-source').TextSource} textSource
     * @param {boolean} focus
     * @param {?import('dictionary').DictionaryEntry[]} dictionaryEntries
     * @param {import('display').PageType} type
     * @param {?import('display').HistoryStateSentence} sentence
     * @param {?string} documentTitle
     * @param {import('settings').OptionsContext} optionsContext
     */
    _showContent(textSource, focus, dictionaryEntries, type, sentence, documentTitle, optionsContext) {
        const query = textSource.text();
        const {url} = optionsContext;
        /** @type {import('display').HistoryState} */
        const detailsState = {
            focusEntry: 0,
            optionsContext,
            url
        };
        if (sentence !== null) { detailsState.sentence = sentence; }
        if (documentTitle !== null) { detailsState.documentTitle = documentTitle; }
        /** @type {import('display').HistoryContent} */
        const detailsContent = {
            contentOrigin: {
                tabId: this._tabId,
                frameId: this._frameId
            }
        };
        if (dictionaryEntries !== null) {
            detailsContent.dictionaryEntries = dictionaryEntries;
        }
        /** @type {import('display').ContentDetails} */
        const details = {
            focus,
            historyMode: 'clear',
            params: {
                type,
                query,
                wildcards: 'off'
            },
            state: detailsState,
            content: detailsContent
        };
        if (textSource instanceof TextSourceElement && textSource.fullContent !== query) {
            details.params.full = textSource.fullContent;
            details.params['full-visible'] = 'true';
        }
        this._showPopupContent(textSource, optionsContext, details);
    }

    /**
     * @param {import('text-source').TextSource} textSource
     * @param {?import('settings').OptionsContext} optionsContext
     * @param {?import('display').ContentDetails} details
     * @returns {Promise<void>}
     */
    _showPopupContent(textSource, optionsContext, details) {
        const sourceRects = [];
        for (const {left, top, right, bottom} of textSource.getRects()) {
            sourceRects.push({left, top, right, bottom});
        }
        this._lastShowPromise = (
            this._popup !== null ?
            this._popup.showContent(
                {
                    optionsContext,
                    sourceRects,
                    writingMode: textSource.getWritingMode()
                },
                details
            ) :
            Promise.resolve()
        );
        this._lastShowPromise.catch((error) => {
            if (yomitan.webExtension.unloaded) { return; }
            log.error(error);
        });
        return this._lastShowPromise;
    }

    /**
     * @returns {void}
     */
    _updateTextScannerEnabled() {
        const enabled = (this._options !== null && this._options.general.enable && !this._disabledOverride);
        if (enabled === this._textScanner.isEnabled()) { return; }
        this._textScanner.setEnabled(enabled);
        if (this._textScannerHasBeenEnabled) {
            this._clearSelection(true);
        }
        if (enabled) {
            this._textScannerHasBeenEnabled = true;
        }
    }

    /**
     * @returns {void}
     */
    _updateContentScale() {
        const {popupScalingFactor, popupScaleRelativeToPageZoom, popupScaleRelativeToVisualViewport} = /** @type {import('settings').ProfileOptions} */ (this._options).general;
        let contentScale = popupScalingFactor;
        if (popupScaleRelativeToPageZoom) {
            contentScale /= this._pageZoomFactor;
        }
        if (popupScaleRelativeToVisualViewport) {
            const {visualViewport} = window;
            const visualViewportScale = (typeof visualViewport !== 'undefined' && visualViewport !== null ? visualViewport.scale : 1.0);
            contentScale /= visualViewportScale;
        }
        if (contentScale === this._contentScale) { return; }

        this._contentScale = contentScale;
        if (this._popup !== null) {
            this._popup.setContentScale(this._contentScale);
        }
        this._updatePopupPosition();
    }

    /**
     * @returns {Promise<void>}
     */
    async _updatePopupPosition() {
        const textSource = this._textScanner.getCurrentTextSource();
        if (
            textSource !== null &&
            this._popup !== null &&
            await this._popup.isVisible()
        ) {
            this._showPopupContent(textSource, null, null);
        }
    }

    /**
     * @param {?number} targetFrameId
     */
    _signalFrontendReady(targetFrameId) {
        /** @type {import('application').ApiMessageNoFrameId<'frontendReady'>} */
        const message = {action: 'frontendReady', params: {frameId: this._frameId}};
        if (targetFrameId === null) {
            yomitan.api.broadcastTab(message);
        } else {
            yomitan.api.sendMessageToFrame(targetFrameId, message);
        }
    }

    /**
     * @param {number} frameId
     * @param {?number} timeout
     * @returns {Promise<void>}
     */
    async _waitForFrontendReady(frameId, timeout) {
        return new Promise((resolve, reject) => {
            /** @type {?import('core').Timeout} */
            let timeoutId = null;

            const cleanup = () => {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                chrome.runtime.onMessage.removeListener(onMessage);
            };
            /** @type {import('extension').ChromeRuntimeOnMessageCallback<import('application').ApiMessageAny>} */
            const onMessage = (message, _sender, sendResponse) => {
                try {
                    const {action} = message;
                    if (action === 'frontendReady' && message.params.frameId === frameId) {
                        cleanup();
                        resolve();
                        sendResponse();
                    }
                } catch (e) {
                    // NOP
                }
            };

            if (timeout !== null) {
                timeoutId = setTimeout(() => {
                    timeoutId = null;
                    cleanup();
                    reject(new Error(`Wait for frontend ready timed out after ${timeout}ms`));
                }, timeout);
            }

            chrome.runtime.onMessage.addListener(onMessage);
            yomitan.api.broadcastTab({action: 'frontendRequestReadyBroadcast', params: {frameId: this._frameId}});
        });
    }

    /**
     * @param {import('settings').PreventMiddleMouseOptions} preventMiddleMouseOptions
     * @returns {boolean}
     */
    _getPreventMiddleMouseValueForPageType(preventMiddleMouseOptions) {
        switch (this._pageType) {
            case 'web': return preventMiddleMouseOptions.onWebPages;
            case 'popup': return preventMiddleMouseOptions.onPopupPages;
            case 'search': return preventMiddleMouseOptions.onSearchPages;
        }
    }

    /**
     * @returns {Promise<import('settings').OptionsContext>}
     */
    async _getOptionsContext() {
        let optionsContext = this._optionsContextOverride;
        if (optionsContext === null) {
            optionsContext = (await this._getSearchContext()).optionsContext;
        }
        return optionsContext;
    }

    /**
     * @returns {Promise<{optionsContext: import('settings').OptionsContext, detail?: import('text-scanner').SearchResultDetail}>}
     */
    async _getSearchContext() {
        let url = window.location.href;
        let documentTitle = document.title;
        if (this._useProxyPopup && this._parentFrameId !== null) {
            try {
                ({url, documentTitle} = await yomitan.crossFrame.invoke(this._parentFrameId, 'frontendGetPageInfo', void 0));
            } catch (e) {
                // NOP
            }
        }

        let optionsContext = this._optionsContextOverride;
        if (optionsContext === null) {
            optionsContext = {depth: this._depth, url};
        }

        return {
            optionsContext,
            detail: {documentTitle}
        };
    }

    /**
     * @param {boolean} allowEmptyRange
     * @returns {Promise<boolean>}
     */
    async _scanSelectedText(allowEmptyRange) {
        const range = this._getFirstSelectionRange(allowEmptyRange);
        if (range === null) { return false; }
        const source = TextSourceRange.create(range);
        await this._textScanner.search(source, {focus: true, restoreSelection: true});
        return true;
    }

    /**
     * @param {boolean} allowEmptyRange
     * @returns {?Range}
     */
    _getFirstSelectionRange(allowEmptyRange) {
        const selection = window.getSelection();
        if (selection === null) { return null; }
        for (let i = 0, ii = selection.rangeCount; i < ii; ++i) {
            const range = selection.getRangeAt(i);
            if (range.toString().length > 0 || allowEmptyRange) {
                return range;
            }
        }
        return null;
    }

    /**
     * @returns {void}
     */
    _prepareSiteSpecific() {
        switch (location.hostname.toLowerCase()) {
            case 'docs.google.com':
                this._prepareGoogleDocs();
                break;
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async _prepareGoogleDocs() {
        const {GoogleDocsUtil} = await import('../accessibility/google-docs-util.js');
        DocumentUtil.registerGetRangeFromPointHandler(GoogleDocsUtil.getRangeFromPoint.bind(GoogleDocsUtil));
    }
}
