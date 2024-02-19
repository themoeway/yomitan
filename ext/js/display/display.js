/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2017-2022  Yomichan Authors
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

import {ThemeController} from '../app/theme-controller.js';
import {FrameEndpoint} from '../comm/frame-endpoint.js';
import {extendApiMap, invokeApiMapHandler} from '../core/api-map.js';
import {DynamicProperty} from '../core/dynamic-property.js';
import {EventDispatcher} from '../core/event-dispatcher.js';
import {EventListenerCollection} from '../core/event-listener-collection.js';
import {ExtensionError} from '../core/extension-error.js';
import {log} from '../core/logger.js';
import {toError} from '../core/to-error.js';
import {clone, deepEqual, promiseTimeout} from '../core/utilities.js';
import {PopupMenu} from '../dom/popup-menu.js';
import {querySelectorNotNull} from '../dom/query-selector.js';
import {ScrollElement} from '../dom/scroll-element.js';
import {TextSourceGenerator} from '../dom/text-source-generator.js';
import {HotkeyHelpController} from '../input/hotkey-help-controller.js';
import {TextScanner} from '../language/text-scanner.js';
import {DisplayContentManager} from './display-content-manager.js';
import {DisplayGenerator} from './display-generator.js';
import {DisplayHistory} from './display-history.js';
import {DisplayNotification} from './display-notification.js';
import {ElementOverflowController} from './element-overflow-controller.js';
import {OptionToggleHotkeyHandler} from './option-toggle-hotkey-handler.js';
import {QueryParser} from './query-parser.js';

/**
 * @augments EventDispatcher<import('display').Events>
 */
export class Display extends EventDispatcher {
    /**
     * @param {import('../application.js').Application} application
     * @param {number|undefined} tabId
     * @param {number|undefined} frameId
     * @param {import('display').DisplayPageType} pageType
     * @param {import('../dom/document-focus-controller.js').DocumentFocusController} documentFocusController
     * @param {import('../input/hotkey-handler.js').HotkeyHandler} hotkeyHandler
     */
    constructor(application, tabId, frameId, pageType, documentFocusController, hotkeyHandler) {
        super();
        /** @type {import('../application.js').Application} */
        this._application = application;
        /** @type {number|undefined} */
        this._tabId = tabId;
        /** @type {number|undefined} */
        this._frameId = frameId;
        /** @type {import('display').DisplayPageType} */
        this._pageType = pageType;
        /** @type {import('../dom/document-focus-controller.js').DocumentFocusController} */
        this._documentFocusController = documentFocusController;
        /** @type {import('../input/hotkey-handler.js').HotkeyHandler} */
        this._hotkeyHandler = hotkeyHandler;
        /** @type {HTMLElement} */
        this._container = querySelectorNotNull(document, '#dictionary-entries');
        /** @type {import('dictionary').DictionaryEntry[]} */
        this._dictionaryEntries = [];
        /** @type {HTMLElement[]} */
        this._dictionaryEntryNodes = [];
        /** @type {import('settings').OptionsContext} */
        this._optionsContext = {depth: 0, url: window.location.href};
        /** @type {?import('settings').ProfileOptions} */
        this._options = null;
        /** @type {number} */
        this._index = 0;
        /** @type {?HTMLStyleElement} */
        this._styleNode = null;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {?import('core').TokenObject} */
        this._setContentToken = null;
        /** @type {DisplayContentManager} */
        this._contentManager = new DisplayContentManager(this);
        /** @type {HotkeyHelpController} */
        this._hotkeyHelpController = new HotkeyHelpController();
        /** @type {DisplayGenerator} */
        this._displayGenerator = new DisplayGenerator({
            contentManager: this._contentManager,
            hotkeyHelpController: this._hotkeyHelpController
        });
        /** @type {import('display').DirectApiMap} */
        this._directApiMap = new Map();
        /** @type {import('api-map').ApiMap<import('display').WindowApiSurface>} */ // import('display').WindowApiMap
        this._windowApiMap = new Map();
        /** @type {DisplayHistory} */
        this._history = new DisplayHistory({clearable: true, useBrowserHistory: false});
        /** @type {boolean} */
        this._historyChangeIgnore = false;
        /** @type {boolean} */
        this._historyHasChanged = false;
        /** @type {?Element} */
        this._navigationHeader = document.querySelector('#navigation-header');
        /** @type {import('display').PageType} */
        this._contentType = 'clear';
        /** @type {string} */
        this._defaultTitle = document.title;
        /** @type {number} */
        this._titleMaxLength = 1000;
        /** @type {string} */
        this._query = '';
        /** @type {string} */
        this._fullQuery = '';
        /** @type {number} */
        this._queryOffset = 0;
        /** @type {HTMLElement} */
        this._progressIndicator = querySelectorNotNull(document, '#progress-indicator');
        /** @type {?import('core').Timeout} */
        this._progressIndicatorTimer = null;
        /** @type {DynamicProperty<boolean>} */
        this._progressIndicatorVisible = new DynamicProperty(false);
        /** @type {boolean} */
        this._queryParserVisible = false;
        /** @type {?boolean} */
        this._queryParserVisibleOverride = null;
        /** @type {HTMLElement} */
        this._queryParserContainer = querySelectorNotNull(document, '#query-parser-container');
        /** @type {TextSourceGenerator} */
        this._textSourceGenerator = new TextSourceGenerator();
        /** @type {QueryParser} */
        this._queryParser = new QueryParser({
            api: application.api,
            getSearchContext: this._getSearchContext.bind(this),
            textSourceGenerator: this._textSourceGenerator
        });
        /** @type {HTMLElement} */
        this._contentScrollElement = querySelectorNotNull(document, '#content-scroll');
        /** @type {HTMLElement} */
        this._contentScrollBodyElement = querySelectorNotNull(document, '#content-body');
        /** @type {ScrollElement} */
        this._windowScroll = new ScrollElement(this._contentScrollElement);
        /** @type {?HTMLButtonElement} */
        this._closeButton = document.querySelector('#close-button');
        /** @type {?HTMLButtonElement} */
        this._navigationPreviousButton = document.querySelector('#navigate-previous-button');
        /** @type {?HTMLButtonElement} */
        this._navigationNextButton = document.querySelector('#navigate-next-button');
        /** @type {?import('../app/frontend.js').Frontend} */
        this._frontend = null;
        /** @type {?Promise<void>} */
        this._frontendSetupPromise = null;
        /** @type {number} */
        this._depth = 0;
        /** @type {?string} */
        this._parentPopupId = null;
        /** @type {?number} */
        this._parentFrameId = null;
        /** @type {number|undefined} */
        this._contentOriginTabId = tabId;
        /** @type {number|undefined} */
        this._contentOriginFrameId = frameId;
        /** @type {boolean} */
        this._childrenSupported = true;
        /** @type {?FrameEndpoint} */
        this._frameEndpoint = (pageType === 'popup' ? new FrameEndpoint(this._application.api) : null);
        /** @type {?import('environment').Browser} */
        this._browser = null;
        /** @type {?HTMLTextAreaElement} */
        this._copyTextarea = null;
        /** @type {?TextScanner} */
        this._contentTextScanner = null;
        /** @type {?import('./display-notification.js').DisplayNotification} */
        this._tagNotification = null;
        /** @type {HTMLElement} */
        this._footerNotificationContainer = querySelectorNotNull(document, '#content-footer');
        /** @type {OptionToggleHotkeyHandler} */
        this._optionToggleHotkeyHandler = new OptionToggleHotkeyHandler(this);
        /** @type {ElementOverflowController} */
        this._elementOverflowController = new ElementOverflowController();
        /** @type {boolean} */
        this._frameVisible = (pageType === 'search');
        /** @type {HTMLElement} */
        this._menuContainer = querySelectorNotNull(document, '#popup-menus');
        /** @type {(event: MouseEvent) => void} */
        this._onEntryClickBind = this._onEntryClick.bind(this);
        /** @type {(event: MouseEvent) => void} */
        this._onKanjiLookupBind = this._onKanjiLookup.bind(this);
        /** @type {(event: MouseEvent) => void} */
        this._onDebugLogClickBind = this._onDebugLogClick.bind(this);
        /** @type {(event: MouseEvent) => void} */
        this._onTagClickBind = this._onTagClick.bind(this);
        /** @type {(event: MouseEvent) => void} */
        this._onMenuButtonClickBind = this._onMenuButtonClick.bind(this);
        /** @type {(event: import('popup-menu').MenuCloseEvent) => void} */
        this._onMenuButtonMenuCloseBind = this._onMenuButtonMenuClose.bind(this);
        /** @type {ThemeController} */
        this._themeController = new ThemeController(document.documentElement);

        /* eslint-disable @stylistic/no-multi-spaces */
        this._hotkeyHandler.registerActions([
            ['close',             () => { this._onHotkeyClose(); }],
            ['nextEntry',         this._onHotkeyActionMoveRelative.bind(this, 1)],
            ['previousEntry',     this._onHotkeyActionMoveRelative.bind(this, -1)],
            ['lastEntry',         () => { this._focusEntry(this._dictionaryEntries.length - 1, 0, true); }],
            ['firstEntry',        () => { this._focusEntry(0, 0, true); }],
            ['historyBackward',   () => { this._sourceTermView(); }],
            ['historyForward',    () => { this._nextTermView(); }],
            ['copyHostSelection', () => this._copyHostSelection()],
            ['nextEntryDifferentDictionary',     () => { this._focusEntryWithDifferentDictionary(1, true); }],
            ['previousEntryDifferentDictionary', () => { this._focusEntryWithDifferentDictionary(-1, true); }]
        ]);
        this.registerDirectMessageHandlers([
            ['displaySetOptionsContext', this._onMessageSetOptionsContext.bind(this)],
            ['displaySetContent',        this._onMessageSetContent.bind(this)],
            ['displaySetCustomCss',      this._onMessageSetCustomCss.bind(this)],
            ['displaySetContentScale',   this._onMessageSetContentScale.bind(this)],
            ['displayConfigure',         this._onMessageConfigure.bind(this)],
            ['displayVisibilityChanged', this._onMessageVisibilityChanged.bind(this)]
        ]);
        this.registerWindowMessageHandlers([
            ['displayExtensionUnloaded', this._onMessageExtensionUnloaded.bind(this)]
        ]);
        /* eslint-enable @stylistic/no-multi-spaces */
    }

    /** @type {import('../application.js').Application} */
    get application() {
        return this._application;
    }

    /** @type {DisplayGenerator} */
    get displayGenerator() {
        return this._displayGenerator;
    }

    /** @type {boolean} */
    get queryParserVisible() {
        return this._queryParserVisible;
    }

    set queryParserVisible(value) {
        this._queryParserVisible = value;
        this._updateQueryParser();
    }

    /** @type {number} */
    get depth() {
        return this._depth;
    }

    /** @type {import('../input/hotkey-handler.js').HotkeyHandler} */
    get hotkeyHandler() {
        return this._hotkeyHandler;
    }

    /** @type {import('dictionary').DictionaryEntry[]} */
    get dictionaryEntries() {
        return this._dictionaryEntries;
    }

    /** @type {HTMLElement[]} */
    get dictionaryEntryNodes() {
        return this._dictionaryEntryNodes;
    }

    /** @type {DynamicProperty<boolean>} */
    get progressIndicatorVisible() {
        return this._progressIndicatorVisible;
    }

    /** @type {?string} */
    get parentPopupId() {
        return this._parentPopupId;
    }

    /** @type {number} */
    get selectedIndex() {
        return this._index;
    }

    /** @type {DisplayHistory} */
    get history() {
        return this._history;
    }

    /** @type {string} */
    get query() {
        return this._query;
    }

    /** @type {string} */
    get fullQuery() {
        return this._fullQuery;
    }

    /** @type {number} */
    get queryOffset() {
        return this._queryOffset;
    }

    /** @type {boolean} */
    get frameVisible() {
        return this._frameVisible;
    }

    /** */
    async prepare() {
        // Theme
        this._themeController.siteTheme = 'light';
        this._themeController.prepare();

        // State setup
        const {documentElement} = document;
        const {browser} = await this._application.api.getEnvironmentInfo();
        this._browser = browser;

        if (documentElement !== null) {
            documentElement.dataset.browser = browser;
        }

        // Prepare
        await this._hotkeyHelpController.prepare(this._application.api);
        await this._displayGenerator.prepare(this._application.api);
        this._queryParser.prepare();
        this._history.prepare();
        this._optionToggleHotkeyHandler.prepare();

        // Event setup
        this._history.on('stateChanged', this._onStateChanged.bind(this));
        this._queryParser.on('searched', this._onQueryParserSearch.bind(this));
        this._progressIndicatorVisible.on('change', this._onProgressIndicatorVisibleChanged.bind(this));
        this._application.on('extensionUnloaded', this._onExtensionUnloaded.bind(this));
        this._application.crossFrame.registerHandlers([
            ['displayPopupMessage1', this._onDisplayPopupMessage1.bind(this)],
            ['displayPopupMessage2', this._onDisplayPopupMessage2.bind(this)]
        ]);
        window.addEventListener('message', this._onWindowMessage.bind(this), false);

        if (this._pageType === 'popup' && documentElement !== null) {
            documentElement.addEventListener('mouseup', this._onDocumentElementMouseUp.bind(this), false);
            documentElement.addEventListener('click', this._onDocumentElementClick.bind(this), false);
            documentElement.addEventListener('auxclick', this._onDocumentElementClick.bind(this), false);
        }

        document.addEventListener('wheel', this._onWheel.bind(this), {passive: false});
        if (this._closeButton !== null) {
            this._closeButton.addEventListener('click', this._onCloseButtonClick.bind(this), false);
        }
        if (this._navigationPreviousButton !== null) {
            this._navigationPreviousButton.addEventListener('click', this._onSourceTermView.bind(this), false);
        }
        if (this._navigationNextButton !== null) {
            this._navigationNextButton.addEventListener('click', this._onNextTermView.bind(this), false);
        }
    }

    /**
     * @returns {import('extension').ContentOrigin}
     */
    getContentOrigin() {
        return {
            tabId: this._contentOriginTabId,
            frameId: this._contentOriginFrameId
        };
    }

    /** */
    initializeState() {
        void this._onStateChanged();
        if (this._frameEndpoint !== null) {
            this._frameEndpoint.signal();
        }
    }

    /**
     * @param {{clearable?: boolean, useBrowserHistory?: boolean}} details
     */
    setHistorySettings({clearable, useBrowserHistory}) {
        if (typeof clearable !== 'undefined') {
            this._history.clearable = clearable;
        }
        if (typeof useBrowserHistory !== 'undefined') {
            this._history.useBrowserHistory = useBrowserHistory;
        }
    }

    /**
     * @param {Error} error
     */
    onError(error) {
        if (this._application.webExtension.unloaded) { return; }
        log.error(error);
    }

    /**
     * @returns {?import('settings').ProfileOptions}
     */
    getOptions() {
        return this._options;
    }

    /**
     * @returns {import('settings').OptionsContext}
     */
    getOptionsContext() {
        return this._optionsContext;
    }

    /**
     * @param {import('settings').OptionsContext} optionsContext
     */
    async setOptionsContext(optionsContext) {
        this._optionsContext = optionsContext;
        await this.updateOptions();
    }

    /** */
    async updateOptions() {
        const options = await this._application.api.optionsGet(this.getOptionsContext());
        const {scanning: scanningOptions, sentenceParsing: sentenceParsingOptions} = options;
        this._options = options;

        this._updateHotkeys(options);
        this._updateDocumentOptions(options);
        this._setTheme(options);
        this._hotkeyHelpController.setOptions(options);
        this._displayGenerator.updateHotkeys();
        this._hotkeyHelpController.setupNode(document.documentElement);
        this._elementOverflowController.setOptions(options);

        this._queryParser.setOptions({
            selectedParser: options.parsing.selectedParser,
            termSpacing: options.parsing.termSpacing,
            readingMode: options.parsing.readingMode,
            useInternalParser: options.parsing.enableScanningParser,
            useMecabParser: options.parsing.enableMecabParser,
            scanning: {
                inputs: scanningOptions.inputs,
                deepContentScan: scanningOptions.deepDomScan,
                normalizeCssZoom: scanningOptions.normalizeCssZoom,
                selectText: scanningOptions.selectText,
                delay: scanningOptions.delay,
                touchInputEnabled: scanningOptions.touchInputEnabled,
                pointerEventsEnabled: scanningOptions.pointerEventsEnabled,
                scanLength: scanningOptions.length,
                layoutAwareScan: scanningOptions.layoutAwareScan,
                preventMiddleMouse: scanningOptions.preventMiddleMouse.onSearchQuery,
                matchTypePrefix: false,
                sentenceParsingOptions
            }
        });

        void this._updateNestedFrontend(options);
        this._updateContentTextScanner(options);

        this.trigger('optionsUpdated', {options});
    }

    /**
     * Updates the content of the display.
     * @param {import('display').ContentDetails} details Information about the content to show.
     */
    setContent(details) {
        const {focus, params, state, content} = details;
        const historyMode = this._historyHasChanged ? details.historyMode : 'clear';

        if (focus) {
            window.focus();
        }

        const urlSearchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (typeof value !== 'string') { continue; }
            urlSearchParams.append(key, value);
        }
        const url = `${location.protocol}//${location.host}${location.pathname}?${urlSearchParams.toString()}`;

        switch (historyMode) {
            case 'clear':
                this._history.clear();
                this._history.replaceState(state, content, url);
                break;
            case 'overwrite':
                this._history.replaceState(state, content, url);
                break;
            case 'new':
                this._updateHistoryState();
                this._history.pushState(state, content, url);
                break;
        }
    }

    /**
     * @param {string} css
     */
    setCustomCss(css) {
        if (this._styleNode === null) {
            if (css.length === 0) { return; }
            this._styleNode = document.createElement('style');
        }

        this._styleNode.textContent = css;

        const parent = document.head;
        if (this._styleNode.parentNode !== parent) {
            parent.appendChild(this._styleNode);
        }
    }

    /**
     * @param {import('display').DirectApiMapInit} handlers
     */
    registerDirectMessageHandlers(handlers) {
        extendApiMap(this._directApiMap, handlers);
    }

    /**
     * @param {import('display').WindowApiMapInit} handlers
     */
    registerWindowMessageHandlers(handlers) {
        extendApiMap(this._windowApiMap, handlers);
    }

    /** */
    close() {
        switch (this._pageType) {
            case 'popup':
                void this.invokeContentOrigin('frontendClosePopup', void 0);
                break;
            case 'search':
                void this._closeTab();
                break;
        }
    }

    /**
     * @param {HTMLElement} element
     */
    blurElement(element) {
        this._documentFocusController.blurElement(element);
    }

    /**
     * @param {boolean} updateOptionsContext
     */
    searchLast(updateOptionsContext) {
        const type = this._contentType;
        if (type === 'clear') { return; }
        const query = this._query;
        const {state} = this._history;
        const hasState = typeof state === 'object' && state !== null;
        /** @type {import('display').HistoryState} */
        const newState = (
            hasState ?
            clone(state) :
            {
                focusEntry: 0,
                optionsContext: void 0,
                url: window.location.href,
                sentence: {text: query, offset: 0},
                documentTitle: document.title
            }
        );
        if (!hasState || updateOptionsContext) {
            newState.optionsContext = clone(this._optionsContext);
        }
        /** @type {import('display').ContentDetails} */
        const details = {
            focus: false,
            historyMode: 'clear',
            params: this._createSearchParams(type, query, false, this._queryOffset),
            state: newState,
            content: {
                contentOrigin: this.getContentOrigin()
            }
        };
        this.setContent(details);
    }

    /**
     * @template {import('cross-frame-api').ApiNames} TName
     * @param {TName} action
     * @param {import('cross-frame-api').ApiParams<TName>} params
     * @returns {Promise<import('cross-frame-api').ApiReturn<TName>>}
     */
    async invokeContentOrigin(action, params) {
        if (this._contentOriginTabId === this._tabId && this._contentOriginFrameId === this._frameId) {
            throw new Error('Content origin is same page');
        }
        if (typeof this._contentOriginTabId !== 'number' || typeof this._contentOriginFrameId !== 'number') {
            throw new Error('No content origin is assigned');
        }
        return await this._application.crossFrame.invokeTab(this._contentOriginTabId, this._contentOriginFrameId, action, params);
    }

    /**
     * @template {import('cross-frame-api').ApiNames} TName
     * @param {TName} action
     * @param {import('cross-frame-api').ApiParams<TName>} params
     * @returns {Promise<import('cross-frame-api').ApiReturn<TName>>}
     */
    async invokeParentFrame(action, params) {
        if (this._parentFrameId === null || this._parentFrameId === this._frameId) {
            throw new Error('Invalid parent frame');
        }
        return await this._application.crossFrame.invoke(this._parentFrameId, action, params);
    }

    /**
     * @param {Element} element
     * @returns {number}
     */
    getElementDictionaryEntryIndex(element) {
        const node = /** @type {?HTMLElement} */ (element.closest('.entry'));
        if (node === null) { return -1; }
        const {index} = node.dataset;
        if (typeof index !== 'string') { return -1; }
        const indexNumber = Number.parseInt(index, 10);
        return Number.isFinite(indexNumber) ? indexNumber : -1;
    }

    /**
     * Creates a new notification.
     * @param {boolean} scannable Whether or not the notification should permit its content to be scanned.
     * @returns {DisplayNotification} A new notification instance.
     */
    createNotification(scannable) {
        const node = this._displayGenerator.createEmptyFooterNotification();
        if (scannable) {
            node.classList.add('click-scannable');
        }
        return new DisplayNotification(this._footerNotificationContainer, node);
    }

    // Message handlers

    /** @type {import('cross-frame-api').ApiHandler<'displayPopupMessage1'>} */
    async _onDisplayPopupMessage1(message) {
        /** @type {import('display').DirectApiMessageAny} */
        const messageInner = this._authenticateMessageData(message);
        return await this._onDisplayPopupMessage2(messageInner);
    }

    /** @type {import('cross-frame-api').ApiHandler<'displayPopupMessage2'>} */
    _onDisplayPopupMessage2(message) {
        return new Promise((resolve, reject) => {
            const {action, params} = message;
            invokeApiMapHandler(
                this._directApiMap,
                action,
                params,
                [],
                (result) => {
                    const {error} = result;
                    if (typeof error !== 'undefined') {
                        reject(ExtensionError.deserialize(error));
                    } else {
                        resolve(result.result);
                    }
                },
                () => {
                    reject(new Error(`Invalid action: ${action}`));
                }
            );
        });
    }

    /**
     * @param {MessageEvent<import('display').WindowApiFrameClientMessageAny>} details
     */
    _onWindowMessage({data}) {
        /** @type {import('display').WindowApiMessageAny} */
        let data2;
        try {
            data2 = this._authenticateMessageData(data);
        } catch (e) {
            return;
        }

        try {
            const {action, params} = data2;
            const callback = () => {}; // NOP
            invokeApiMapHandler(this._windowApiMap, action, params, [], callback);
        } catch (e) {
            // NOP
        }
    }

    /** @type {import('display').DirectApiHandler<'displaySetOptionsContext'>} */
    async _onMessageSetOptionsContext({optionsContext}) {
        await this.setOptionsContext(optionsContext);
        this.searchLast(true);
    }

    /** @type {import('display').DirectApiHandler<'displaySetContent'>} */
    _onMessageSetContent({details}) {
        this.setContent(details);
    }

    /** @type {import('display').DirectApiHandler<'displaySetCustomCss'>} */
    _onMessageSetCustomCss({css}) {
        this.setCustomCss(css);
    }

    /** @type {import('display').DirectApiHandler<'displaySetContentScale'>} */
    _onMessageSetContentScale({scale}) {
        this._setContentScale(scale);
    }

    /** @type {import('display').DirectApiHandler<'displayConfigure'>} */
    async _onMessageConfigure({depth, parentPopupId, parentFrameId, childrenSupported, scale, optionsContext}) {
        this._depth = depth;
        this._parentPopupId = parentPopupId;
        this._parentFrameId = parentFrameId;
        this._childrenSupported = childrenSupported;
        this._setContentScale(scale);
        await this.setOptionsContext(optionsContext);
    }

    /** @type {import('display').DirectApiHandler<'displayVisibilityChanged'>} */
    _onMessageVisibilityChanged({value}) {
        this._frameVisible = value;
        this.trigger('frameVisibilityChange', {value});
    }

    /** @type {import('display').WindowApiHandler<'displayExtensionUnloaded'>} */
    _onMessageExtensionUnloaded() {
        this._application.webExtension.triggerUnloaded();
    }

    // Private

    /**
     * @template [T=unknown]
     * @param {import('frame-client').Message<unknown>} message
     * @returns {T}
     * @throws {Error}
     */
    _authenticateMessageData(message) {
        if (this._frameEndpoint !== null && !this._frameEndpoint.authenticate(message)) {
            throw new Error('Invalid authentication');
        }
        return /** @type {import('frame-client').Message<T>} */ (message).data;
    }

    /** */
    async _onStateChanged() {
        if (this._historyChangeIgnore) { return; }

        performance.mark('display:onStateChanged:start');

        /** @type {?import('core').TokenObject} */
        const token = {}; // Unique identifier token
        this._setContentToken = token;
        try {
            // Clear
            performance.mark('display:clear:start');
            this._closePopups();
            this._closeAllPopupMenus();
            this._eventListeners.removeAllEventListeners();
            this._hideTagNotification(false);
            this._triggerContentClear();
            this._dictionaryEntries = [];
            this._dictionaryEntryNodes = [];
            this._elementOverflowController.clearElements();
            performance.mark('display:clear:end');
            performance.measure('display:clear', 'display:clear:start', 'display:clear:end');

            // Prepare
            performance.mark('display:prepare:start');
            const urlSearchParams = new URLSearchParams(location.search);
            let type = urlSearchParams.get('type');
            if (type === null && urlSearchParams.get('query') !== null) { type = 'terms'; }

            const fullVisible = urlSearchParams.get('full-visible');
            this._queryParserVisibleOverride = (fullVisible === null ? null : (fullVisible !== 'false'));

            this._historyHasChanged = true;
            performance.mark('display:prepare:end');
            performance.measure('display:prepare', 'display:prepare:start', 'display:prepare:end');

            performance.mark('display:setContent:start');
            // Set content
            switch (type) {
                case 'terms':
                case 'kanji':
                    this._contentType = type;
                    await this._setContentTermsOrKanji(type, urlSearchParams, token);
                    break;
                case 'unloaded':
                    this._contentType = type;
                    this._setContentExtensionUnloaded();
                    break;
                default:
                    this._contentType = 'clear';
                    this._clearContent();
                    break;
            }
            performance.mark('display:setContent:end');
            performance.measure('display:setContent', 'display:setContent:start', 'display:setContent:end');
        } catch (e) {
            this.onError(toError(e));
        }
        performance.mark('display:onStateChanged:end');
        performance.measure('display:onStateChanged', 'display:onStateChanged:start', 'display:onStateChanged:end');
    }

    /**
     * @param {import('query-parser').EventArgument<'searched'>} details
     */
    _onQueryParserSearch({type, dictionaryEntries, sentence, inputInfo: {eventType}, textSource, optionsContext, sentenceOffset}) {
        const query = textSource.text();
        const historyState = this._history.state;
        const historyMode = (
            eventType === 'click' ||
            !(typeof historyState === 'object' && historyState !== null) ||
            historyState.cause !== 'queryParser' ?
            'new' :
            'overwrite'
        );
        /** @type {import('display').ContentDetails} */
        const details = {
            focus: false,
            historyMode,
            params: this._createSearchParams(type, query, false, sentenceOffset),
            state: {
                sentence,
                optionsContext,
                cause: 'queryParser'
            },
            content: {
                dictionaryEntries,
                contentOrigin: this.getContentOrigin()
            }
        };
        this.setContent(details);
    }

    /** */
    _onExtensionUnloaded() {
        const type = 'unloaded';
        if (this._contentType === type) { return; }
        /** @type {import('display').ContentDetails} */
        const details = {
            focus: false,
            historyMode: 'clear',
            params: {type},
            state: {},
            content: {
                contentOrigin: {
                    tabId: this._tabId,
                    frameId: this._frameId
                }
            }
        };
        this.setContent(details);
    }

    /**
     * @param {MouseEvent} e
     */
    _onCloseButtonClick(e) {
        e.preventDefault();
        this.close();
    }

    /**
     * @param {MouseEvent} e
     */
    _onSourceTermView(e) {
        e.preventDefault();
        this._sourceTermView();
    }

    /**
     * @param {MouseEvent} e
     */
    _onNextTermView(e) {
        e.preventDefault();
        this._nextTermView();
    }

    /**
     * @param {import('dynamic-property').EventArgument<boolean, 'change'>} details
     */
    _onProgressIndicatorVisibleChanged({value}) {
        if (this._progressIndicatorTimer !== null) {
            clearTimeout(this._progressIndicatorTimer);
            this._progressIndicatorTimer = null;
        }

        if (value) {
            this._progressIndicator.hidden = false;
            getComputedStyle(this._progressIndicator).getPropertyValue('display'); // Force update of CSS display property, allowing animation
            this._progressIndicator.dataset.active = 'true';
        } else {
            this._progressIndicator.dataset.active = 'false';
            this._progressIndicatorTimer = setTimeout(() => {
                this._progressIndicator.hidden = true;
                this._progressIndicatorTimer = null;
            }, 250);
        }
    }

    /**
     * @param {MouseEvent} e
     */
    async _onKanjiLookup(e) {
        try {
            e.preventDefault();
            const {state} = this._history;
            if (!(typeof state === 'object' && state !== null)) { return; }

            let {sentence, url, documentTitle} = state;
            if (typeof url !== 'string') { url = window.location.href; }
            if (typeof documentTitle !== 'string') { documentTitle = document.title; }
            const optionsContext = this.getOptionsContext();
            const element = /** @type {Element} */ (e.currentTarget);
            let query = element.textContent;
            if (query === null) { query = ''; }
            const dictionaryEntries = await this._application.api.kanjiFind(query, optionsContext);
            /** @type {import('display').ContentDetails} */
            const details = {
                focus: false,
                historyMode: 'new',
                params: this._createSearchParams('kanji', query, false, null),
                state: {
                    focusEntry: 0,
                    optionsContext,
                    url,
                    sentence,
                    documentTitle
                },
                content: {
                    dictionaryEntries,
                    contentOrigin: this.getContentOrigin()
                }
            };
            this.setContent(details);
        } catch (error) {
            this.onError(toError(error));
        }
    }

    /**
     * @param {WheelEvent} e
     */
    _onWheel(e) {
        if (e.altKey) {
            if (e.deltaY !== 0) {
                this._focusEntry(this._index + (e.deltaY > 0 ? 1 : -1), 0, true);
                e.preventDefault();
            }
        } else if (e.shiftKey) {
            this._onHistoryWheel(e);
        }
    }

    /**
     * @param {WheelEvent} e
     */
    _onHistoryWheel(e) {
        if (e.altKey) { return; }
        const delta = -e.deltaX || e.deltaY;
        if (delta > 0) {
            this._sourceTermView();
            e.preventDefault();
            e.stopPropagation();
        } else if (delta < 0) {
            this._nextTermView();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onDebugLogClick(e) {
        const link = /** @type {HTMLElement} */ (e.currentTarget);
        const index = this.getElementDictionaryEntryIndex(link);
        void this._logDictionaryEntryData(index);
    }

    /**
     * @param {MouseEvent} e
     */
    _onDocumentElementMouseUp(e) {
        switch (e.button) {
            case 3: // Back
                if (this._history.hasPrevious()) {
                    e.preventDefault();
                }
                break;
            case 4: // Forward
                if (this._history.hasNext()) {
                    e.preventDefault();
                }
                break;
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onDocumentElementClick(e) {
        switch (e.button) {
            case 3: // Back
                if (this._history.hasPrevious()) {
                    e.preventDefault();
                    this._history.back();
                }
                break;
            case 4: // Forward
                if (this._history.hasNext()) {
                    e.preventDefault();
                    this._history.forward();
                }
                break;
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onEntryClick(e) {
        if (e.button !== 0) { return; }
        const node = /** @type {HTMLElement} */ (e.currentTarget);
        const {index} = node.dataset;
        if (typeof index !== 'string') { return; }
        const indexNumber = Number.parseInt(index, 10);
        if (!Number.isFinite(indexNumber)) { return; }
        this._entrySetCurrent(indexNumber);
    }

    /**
     * @param {MouseEvent} e
     */
    _onTagClick(e) {
        const node = /** @type {HTMLElement} */ (e.currentTarget);
        this._showTagNotification(node);
    }

    /**
     * @param {MouseEvent} e
     */
    _onMenuButtonClick(e) {
        const node = /** @type {HTMLElement} */ (e.currentTarget);

        const menuContainerNode = /** @type {HTMLElement} */ (this._displayGenerator.instantiateTemplate('dictionary-entry-popup-menu'));
        /** @type {HTMLElement} */
        const menuBodyNode = querySelectorNotNull(menuContainerNode, '.popup-menu-body');

        /**
         * @param {string} menuAction
         * @param {string} label
         */
        const addItem = (menuAction, label) => {
            const item = /** @type {HTMLElement} */ (this._displayGenerator.instantiateTemplate('dictionary-entry-popup-menu-item'));
            /** @type {HTMLElement} */
            const labelElement = querySelectorNotNull(item, '.popup-menu-item-label');
            labelElement.textContent = label;
            item.dataset.menuAction = menuAction;
            menuBodyNode.appendChild(item);
        };

        addItem('log-debug-info', 'Log debug info');

        this._menuContainer.appendChild(menuContainerNode);
        const popupMenu = new PopupMenu(node, menuContainerNode);
        popupMenu.prepare();
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onMenuButtonMenuClose(e) {
        const node = /** @type {HTMLElement} */ (e.currentTarget);
        const {action} = e.detail;
        switch (action) {
            case 'log-debug-info':
                void this._logDictionaryEntryData(this.getElementDictionaryEntryIndex(node));
                break;
        }
    }

    /**
     * @param {Element} tagNode
     */
    _showTagNotification(tagNode) {
        const parent = tagNode.parentNode;
        if (parent === null || !(parent instanceof HTMLElement)) { return; }

        if (this._tagNotification === null) {
            this._tagNotification = this.createNotification(true);
        }

        const index = this.getElementDictionaryEntryIndex(parent);
        const dictionaryEntry = (index >= 0 && index < this._dictionaryEntries.length ? this._dictionaryEntries[index] : null);

        const content = this._displayGenerator.createTagFooterNotificationDetails(parent, dictionaryEntry);
        this._tagNotification.setContent(content);
        this._tagNotification.open();
    }

    /**
     * @param {boolean} animate
     */
    _hideTagNotification(animate) {
        if (this._tagNotification === null) { return; }
        this._tagNotification.close(animate);
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    _updateDocumentOptions(options) {
        const data = document.documentElement.dataset;
        data.ankiEnabled = `${options.anki.enable}`;
        data.resultOutputMode = `${options.general.resultOutputMode}`;
        data.glossaryLayoutMode = `${options.general.glossaryLayoutMode}`;
        data.compactTags = `${options.general.compactTags}`;
        data.frequencyDisplayMode = `${options.general.frequencyDisplayMode}`;
        data.termDisplayMode = `${options.general.termDisplayMode}`;
        data.enableSearchTags = `${options.scanning.enableSearchTags}`;
        data.showPronunciationText = `${options.general.showPitchAccentDownstepNotation}`;
        data.showPronunciationDownstepPosition = `${options.general.showPitchAccentPositionNotation}`;
        data.showPronunciationGraph = `${options.general.showPitchAccentGraph}`;
        data.debug = `${options.general.debugInfo}`;
        data.popupDisplayMode = `${options.general.popupDisplayMode}`;
        data.popupCurrentIndicatorMode = `${options.general.popupCurrentIndicatorMode}`;
        data.popupActionBarVisibility = `${options.general.popupActionBarVisibility}`;
        data.popupActionBarLocation = `${options.general.popupActionBarLocation}`;
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    _setTheme(options) {
        const {general} = options;
        const {popupTheme} = general;
        this._themeController.theme = popupTheme;
        this._themeController.outerTheme = general.popupOuterTheme;
        this._themeController.updateTheme();
        this.setCustomCss(general.customPopupCss);
    }

    /**
     * @param {boolean} isKanji
     * @param {string} source
     * @param {boolean} wildcardsEnabled
     * @param {import('settings').OptionsContext} optionsContext
     * @returns {Promise<import('dictionary').DictionaryEntry[]>}
     */
    async _findDictionaryEntries(isKanji, source, wildcardsEnabled, optionsContext) {
        if (isKanji) {
            return await this._application.api.kanjiFind(source, optionsContext);
        } else {
            /** @type {import('api').FindTermsDetails} */
            const findDetails = {};
            if (wildcardsEnabled) {
                const match = /^([*\uff0a]*)([\w\W]*?)([*\uff0a]*)$/.exec(source);
                if (match !== null) {
                    if (match[1]) {
                        findDetails.matchType = 'suffix';
                        findDetails.deinflect = false;
                    } else if (match[3]) {
                        findDetails.matchType = 'prefix';
                        findDetails.deinflect = false;
                    }
                    source = match[2];
                }
            }

            const {dictionaryEntries} = await this._application.api.termsFind(source, findDetails, optionsContext);
            return dictionaryEntries;
        }
    }

    /**
     * @param {string} type
     * @param {URLSearchParams} urlSearchParams
     * @param {import('core').TokenObject} token
     */
    async _setContentTermsOrKanji(type, urlSearchParams, token) {
        const lookup = (urlSearchParams.get('lookup') !== 'false');
        const wildcardsEnabled = (urlSearchParams.get('wildcards') !== 'off');

        // Set query
        performance.mark('display:setQuery:start');
        let query = urlSearchParams.get('query');
        if (query === null) { query = ''; }
        let queryFull = urlSearchParams.get('full');
        queryFull = (queryFull !== null ? queryFull : query);
        const queryOffsetString = urlSearchParams.get('offset');
        let queryOffset = 0;
        if (queryOffsetString !== null) {
            queryOffset = Number.parseInt(queryOffsetString, 10);
            queryOffset = Number.isFinite(queryOffset) ? Math.max(0, Math.min(queryFull.length - query.length, queryOffset)) : 0;
        }
        this._setQuery(query, queryFull, queryOffset);
        performance.mark('display:setQuery:end');
        performance.measure('display:setQuery', 'display:setQuery:start', 'display:setQuery:end');

        let {state, content} = this._history;
        let changeHistory = false;
        if (!(typeof content === 'object' && content !== null)) {
            content = {};
            changeHistory = true;
        }
        if (!(typeof state === 'object' && state !== null)) {
            state = {};
            changeHistory = true;
        }

        let {focusEntry, scrollX, scrollY, optionsContext} = state;
        if (typeof focusEntry !== 'number') { focusEntry = 0; }
        if (!(typeof optionsContext === 'object' && optionsContext !== null)) {
            optionsContext = this.getOptionsContext();
            state.optionsContext = optionsContext;
            changeHistory = true;
        }

        let {dictionaryEntries} = content;
        if (!Array.isArray(dictionaryEntries)) {
            performance.mark('display:findDictionaryEntries:start');
            dictionaryEntries = lookup && query.length > 0 ? await this._findDictionaryEntries(type === 'kanji', query, wildcardsEnabled, optionsContext) : [];
            performance.mark('display:findDictionaryEntries:end');
            performance.measure('display:findDictionaryEntries', 'display:findDictionaryEntries:start', 'display:findDictionaryEntries:end');
            if (this._setContentToken !== token) { return; }
            content.dictionaryEntries = dictionaryEntries;
            changeHistory = true;
        }

        let contentOriginValid = false;
        const {contentOrigin} = content;
        if (typeof contentOrigin === 'object' && contentOrigin !== null) {
            const {tabId, frameId} = contentOrigin;
            if (typeof tabId === 'number' && typeof frameId === 'number') {
                this._contentOriginTabId = tabId;
                this._contentOriginFrameId = frameId;
                contentOriginValid = true;
            }
        }
        if (!contentOriginValid) {
            content.contentOrigin = this.getContentOrigin();
            changeHistory = true;
        }

        await this._setOptionsContextIfDifferent(optionsContext);
        if (this._setContentToken !== token) { return; }

        if (this._options === null) {
            await this.updateOptions();
            if (this._setContentToken !== token) { return; }
        }

        if (changeHistory) {
            this._replaceHistoryStateNoNavigate(state, content);
        }

        this._dictionaryEntries = dictionaryEntries;

        performance.mark('display:updateNavigationAuto:start');
        this._updateNavigationAuto();
        performance.mark('display:updateNavigationAuto:end');
        performance.measure('display:updateNavigationAuto', 'display:updateNavigationAuto:start', 'display:updateNavigationAuto:end');

        this._setNoContentVisible(dictionaryEntries.length === 0 && lookup);

        const container = this._container;
        container.textContent = '';

        performance.mark('display:contentUpdate:start');
        this._triggerContentUpdateStart();

        let i = 0;
        for (const dictionaryEntry of dictionaryEntries) {
            performance.mark('display:createEntry:start');

            if (i > 0) {
                await promiseTimeout(1);
                if (this._setContentToken !== token) { return; }
            }

            const entry = (
                dictionaryEntry.type === 'term' ?
                await this._displayGenerator.createTermEntry(dictionaryEntry) :
                await this._displayGenerator.createKanjiEntry(dictionaryEntry)
            );
            entry.dataset.index = `${i}`;
            this._dictionaryEntryNodes.push(entry);
            this._addEntryEventListeners(entry);
            this._triggerContentUpdateEntry(dictionaryEntry, entry, i);
            performance.mark('display:waitMedia:start');
            await this._contentManager.executeMediaRequests();
            performance.mark('display:waitMedia:end');
            performance.measure('display:waitMedia', 'display:waitMedia:start', 'display:waitMedia:end');
            container.appendChild(entry);

            if (focusEntry === i) {
                this._focusEntry(i, 0, false);
            }

            this._elementOverflowController.addElements(entry);

            performance.mark('display:createEntry:end');
            performance.measure('display:createEntry', 'display:createEntry:start', 'display:createEntry:end');

            ++i;
        }

        if (typeof scrollX === 'number' || typeof scrollY === 'number') {
            let {x, y} = this._windowScroll;
            if (typeof scrollX === 'number') { x = scrollX; }
            if (typeof scrollY === 'number') { y = scrollY; }
            this._windowScroll.stop();
            this._windowScroll.to(x, y);
        }

        this._triggerContentUpdateComplete();
        performance.mark('display:contentUpdate:end');
        performance.measure('display:contentUpdate', 'display:contentUpdate:start', 'display:contentUpdate:end');
    }

    /** */
    _setContentExtensionUnloaded() {
        /** @type {?HTMLElement} */
        const errorExtensionUnloaded = document.querySelector('#error-extension-unloaded');

        if (this._container !== null) {
            this._container.hidden = true;
        }

        if (errorExtensionUnloaded !== null) {
            errorExtensionUnloaded.hidden = false;
        }

        this._updateNavigation(false, false);
        this._setNoContentVisible(false);
        this._setQuery('', '', 0);

        this._triggerContentUpdateStart();
        this._triggerContentUpdateComplete();
    }

    /** */
    _clearContent() {
        this._container.textContent = '';
        this._updateNavigationAuto();
        this._setQuery('', '', 0);

        this._triggerContentUpdateStart();
        this._triggerContentUpdateComplete();
    }

    /**
     * @param {boolean} visible
     */
    _setNoContentVisible(visible) {
        /** @type {?HTMLElement} */
        const noResults = document.querySelector('#no-results');

        if (noResults !== null) {
            noResults.hidden = !visible;
        }
    }

    /**
     * @param {string} query
     * @param {string} fullQuery
     * @param {number} queryOffset
     */
    _setQuery(query, fullQuery, queryOffset) {
        this._query = query;
        this._fullQuery = fullQuery;
        this._queryOffset = queryOffset;
        this._updateQueryParser();
        this._setTitleText(query);
    }

    /** */
    _updateQueryParser() {
        const text = this._fullQuery;
        const visible = this._isQueryParserVisible();
        this._queryParserContainer.hidden = !visible || text.length === 0;
        if (visible && this._queryParser.text !== text) {
            void this._setQueryParserText(text);
        }
    }

    /**
     * @param {string} text
     */
    async _setQueryParserText(text) {
        const overrideToken = this._progressIndicatorVisible.setOverride(true);
        try {
            await this._queryParser.setText(text);
        } finally {
            this._progressIndicatorVisible.clearOverride(overrideToken);
        }
    }

    /**
     * @param {string} text
     */
    _setTitleText(text) {
        let title = this._defaultTitle;
        if (text.length > 0) {
            // Chrome limits title to 1024 characters
            const ellipsis = '...';
            const separator = ' - ';
            const maxLength = this._titleMaxLength - title.length - separator.length;
            if (text.length > maxLength) {
                text = `${text.substring(0, Math.max(0, maxLength - ellipsis.length))}${ellipsis}`;
            }

            title = `${text}${separator}${title}`;
        }
        document.title = title;
    }

    /** */
    _updateNavigationAuto() {
        this._updateNavigation(this._history.hasPrevious(), this._history.hasNext());
    }

    /**
     * @param {boolean} previous
     * @param {boolean} next
     */
    _updateNavigation(previous, next) {
        const {documentElement} = document;
        if (documentElement !== null) {
            documentElement.dataset.hasNavigationPrevious = `${previous}`;
            documentElement.dataset.hasNavigationNext = `${next}`;
        }
        if (this._navigationPreviousButton !== null) {
            this._navigationPreviousButton.disabled = !previous;
        }
        if (this._navigationNextButton !== null) {
            this._navigationNextButton.disabled = !next;
        }
    }

    /**
     * @param {number} index
     */
    _entrySetCurrent(index) {
        const entryPre = this._getEntry(this._index);
        if (entryPre !== null) {
            entryPre.classList.remove('entry-current');
        }

        const entry = this._getEntry(index);
        if (entry !== null) {
            entry.classList.add('entry-current');
        }

        this._index = index;
    }

    /**
     * @param {number} index
     * @param {number} definitionIndex
     * @param {boolean} smooth
     */
    _focusEntry(index, definitionIndex, smooth) {
        index = Math.max(Math.min(index, this._dictionaryEntries.length - 1), 0);

        this._entrySetCurrent(index);

        let node = (index >= 0 && index < this._dictionaryEntryNodes.length ? this._dictionaryEntryNodes[index] : null);
        if (definitionIndex > 0) {
            const definitionNodes = this._getDictionaryEntryDefinitionNodes(index);
            if (definitionIndex < definitionNodes.length) {
                node = definitionNodes[definitionIndex];
            }
        }
        let target = (index === 0 && definitionIndex <= 0) || node === null ? 0 : this._getElementTop(node);

        if (this._navigationHeader !== null) {
            target -= this._navigationHeader.getBoundingClientRect().height;
        }

        this._windowScroll.stop();
        if (smooth) {
            this._windowScroll.animate(this._windowScroll.x, target, 200);
        } else {
            this._windowScroll.toY(target);
        }
    }

    /**
     * @param {number} offset
     * @param {boolean} smooth
     * @returns {boolean}
     */
    _focusEntryWithDifferentDictionary(offset, smooth) {
        const sign = Math.sign(offset);
        if (sign === 0) { return false; }

        let index = this._index;
        const count = Math.min(this._dictionaryEntries.length, this._dictionaryEntryNodes.length);
        if (index < 0 || index >= count) { return false; }

        const dictionaryEntry = this._dictionaryEntries[index];
        const visibleDefinitionIndex = this._getDictionaryEntryVisibleDefinitionIndex(index, sign);
        if (visibleDefinitionIndex === null) { return false; }

        let focusDefinitionIndex = null;
        if (dictionaryEntry.type === 'term') {
            const {dictionary} = dictionaryEntry.definitions[visibleDefinitionIndex];
            for (let i = index; i >= 0 && i < count; i += sign) {
                const otherDictionaryEntry = this._dictionaryEntries[i];
                if (otherDictionaryEntry.type !== 'term') { continue; }
                const {definitions} = otherDictionaryEntry;
                const jj = definitions.length;
                let j = (i === index ? visibleDefinitionIndex + sign : (sign > 0 ? 0 : jj - 1));
                for (; j >= 0 && j < jj; j += sign) {
                    if (definitions[j].dictionary !== dictionary) {
                        focusDefinitionIndex = j;
                        index = i;
                        i = -2; // Terminate outer loop
                        break;
                    }
                }
            }
        }

        if (focusDefinitionIndex === null) { return false; }

        this._focusEntry(index, focusDefinitionIndex, smooth);
        return true;
    }

    /**
     * @param {number} index
     * @param {number} sign
     * @returns {?number}
     */
    _getDictionaryEntryVisibleDefinitionIndex(index, sign) {
        const {top: scrollTop, bottom: scrollBottom} = this._windowScroll.getRect();

        const {definitions} = this._dictionaryEntries[index];
        const nodes = this._getDictionaryEntryDefinitionNodes(index);
        const definitionCount = Math.min(definitions.length, nodes.length);
        if (definitionCount <= 0) { return null; }

        let visibleIndex = null;
        let visibleCoverage = 0;
        for (let i = (sign > 0 ? 0 : definitionCount - 1); i >= 0 && i < definitionCount; i += sign) {
            const {top, bottom} = nodes[i].getBoundingClientRect();
            if (bottom <= scrollTop || top >= scrollBottom) { continue; }
            const top2 = Math.max(scrollTop, Math.min(scrollBottom, top));
            const bottom2 = Math.max(scrollTop, Math.min(scrollBottom, bottom));
            const coverage = (bottom2 - top2) / (bottom - top);
            if (coverage >= visibleCoverage) {
                visibleCoverage = coverage;
                visibleIndex = i;
            }
        }

        return visibleIndex !== null ? visibleIndex : (sign > 0 ? definitionCount - 1 : 0);
    }

    /**
     * @param {number} index
     * @returns {NodeListOf<HTMLElement>}
     */
    _getDictionaryEntryDefinitionNodes(index) {
        return this._dictionaryEntryNodes[index].querySelectorAll('.definition-item');
    }

    /** */
    _sourceTermView() {
        this._relativeTermView(false);
    }

    /** */
    _nextTermView() {
        this._relativeTermView(true);
    }

    /**
     * @param {boolean} next
     * @returns {boolean}
     */
    _relativeTermView(next) {
        return (
            next ?
            this._history.hasNext() && this._history.forward() :
            this._history.hasPrevious() && this._history.back()
        );
    }

    /**
     * @param {number} index
     * @returns {?HTMLElement}
     */
    _getEntry(index) {
        const entries = this._dictionaryEntryNodes;
        return index >= 0 && index < entries.length ? entries[index] : null;
    }

    /**
     * @param {Element} element
     * @returns {number}
     */
    _getElementTop(element) {
        const elementRect = element.getBoundingClientRect();
        const documentRect = this._contentScrollBodyElement.getBoundingClientRect();
        return elementRect.top - documentRect.top;
    }

    /** */
    _updateHistoryState() {
        const {state, content} = this._history;
        if (!(typeof state === 'object' && state !== null)) { return; }

        state.focusEntry = this._index;
        state.scrollX = this._windowScroll.x;
        state.scrollY = this._windowScroll.y;
        this._replaceHistoryStateNoNavigate(state, content);
    }

    /**
     * @param {import('display-history').EntryState} state
     * @param {?import('display-history').EntryContent} content
     */
    _replaceHistoryStateNoNavigate(state, content) {
        const historyChangeIgnorePre = this._historyChangeIgnore;
        try {
            this._historyChangeIgnore = true;
            this._history.replaceState(state, content);
        } finally {
            this._historyChangeIgnore = historyChangeIgnorePre;
        }
    }

    /**
     * @param {import('display').PageType} type
     * @param {string} query
     * @param {boolean} wildcards
     * @param {?number} sentenceOffset
     * @returns {import('display').HistoryParams}
     */
    _createSearchParams(type, query, wildcards, sentenceOffset) {
        /** @type {import('display').HistoryParams} */
        const params = {};
        const fullQuery = this._fullQuery;
        const includeFull = (query.length < fullQuery.length);
        if (includeFull) {
            params.full = fullQuery;
        }
        params.query = query;
        if (includeFull && sentenceOffset !== null) {
            params.offset = `${sentenceOffset}`;
        }
        if (typeof type === 'string') {
            params.type = type;
        }
        if (!wildcards) {
            params.wildcards = 'off';
        }
        if (this._queryParserVisibleOverride !== null) {
            params['full-visible'] = `${this._queryParserVisibleOverride}`;
        }
        return params;
    }

    /**
     * @returns {boolean}
     */
    _isQueryParserVisible() {
        return (
            this._queryParserVisibleOverride !== null ?
            this._queryParserVisibleOverride :
            this._queryParserVisible
        );
    }

    /** */
    _closePopups() {
        this._application.triggerClosePopups();
    }

    /**
     * @param {import('settings').OptionsContext} optionsContext
     */
    async _setOptionsContextIfDifferent(optionsContext) {
        if (deepEqual(this._optionsContext, optionsContext)) { return; }
        await this.setOptionsContext(optionsContext);
    }

    /**
     * @param {number} scale
     */
    _setContentScale(scale) {
        const body = document.body;
        if (body === null) { return; }
        body.style.fontSize = `${scale}em`;
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    async _updateNestedFrontend(options) {
        if (typeof this._frameId !== 'number') { return; }

        const isSearchPage = (this._pageType === 'search');
        const isEnabled = (
            this._childrenSupported &&
            typeof this._tabId === 'number' &&
            (
                (isSearchPage) ?
                (options.scanning.enableOnSearchPage) :
                (this._depth < options.scanning.popupNestingMaxDepth)
            )
        );

        if (this._frontend === null) {
            if (!isEnabled) { return; }

            try {
                if (this._frontendSetupPromise === null) {
                    this._frontendSetupPromise = this._setupNestedFrontend();
                }
                await this._frontendSetupPromise;
            } catch (e) {
                log.error(e);
                return;
            } finally {
                this._frontendSetupPromise = null;
            }
        }

        /** @type {import('../app/frontend.js').Frontend} */ (this._frontend).setDisabledOverride(!isEnabled);
    }

    /** */
    async _setupNestedFrontend() {
        if (typeof this._frameId !== 'number') {
            throw new Error('No frameId assigned');
        }

        const useProxyPopup = this._parentFrameId !== null;
        const parentPopupId = this._parentPopupId;
        const parentFrameId = this._parentFrameId;

        const [{PopupFactory}, {Frontend}] = await Promise.all([
            import('../app/popup-factory.js'),
            import('../app/frontend.js')
        ]);

        const popupFactory = new PopupFactory(this._application, this._frameId);
        popupFactory.prepare();

        /** @type {import('frontend').ConstructorDetails} */
        const setupNestedPopupsOptions = {
            application: this._application,
            useProxyPopup,
            parentPopupId,
            parentFrameId,
            depth: this._depth + 1,
            tabId: this._tabId,
            frameId: this._frameId,
            popupFactory,
            pageType: this._pageType,
            allowRootFramePopupProxy: true,
            childrenSupported: this._childrenSupported,
            hotkeyHandler: this._hotkeyHandler
        };

        const frontend = new Frontend(setupNestedPopupsOptions);
        this._frontend = frontend;
        await frontend.prepare();
    }

    /**
     * @returns {boolean}
     */
    _copyHostSelection() {
        if (typeof this._contentOriginFrameId !== 'number') { return false; }
        const selection = window.getSelection();
        if (selection !== null && selection.toString().length > 0) { return false; }
        void this._copyHostSelectionSafe();
        return true;
    }

    /** */
    async _copyHostSelectionSafe() {
        try {
            await this._copyHostSelectionInner();
        } catch (e) {
            // NOP
        }
    }

    /** */
    async _copyHostSelectionInner() {
        switch (this._browser) {
            case 'firefox':
            case 'firefox-mobile':
                {
                    /** @type {string} */
                    let text;
                    try {
                        text = await this.invokeContentOrigin('frontendGetSelectionText', void 0);
                    } catch (e) {
                        break;
                    }
                    this._copyText(text);
                }
                break;
            default:
                await this.invokeContentOrigin('frontendCopySelection', void 0);
                break;
        }
    }

    /**
     * @param {string} text
     */
    _copyText(text) {
        const parent = document.body;
        if (parent === null) { return; }

        let textarea = this._copyTextarea;
        if (textarea === null) {
            textarea = document.createElement('textarea');
            this._copyTextarea = textarea;
        }

        textarea.value = text;
        parent.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        parent.removeChild(textarea);
    }

    /**
     * @param {HTMLElement} entry
     */
    _addEntryEventListeners(entry) {
        const eventListeners = this._eventListeners;
        eventListeners.addEventListener(entry, 'click', this._onEntryClickBind);
        for (const node of entry.querySelectorAll('.headword-kanji-link')) {
            eventListeners.addEventListener(node, 'click', this._onKanjiLookupBind);
        }
        for (const node of entry.querySelectorAll('.tag-label')) {
            eventListeners.addEventListener(node, 'click', this._onTagClickBind);
        }
        for (const node of entry.querySelectorAll('.action-button[data-action=menu]')) {
            eventListeners.addEventListener(node, 'click', this._onMenuButtonClickBind);
            eventListeners.addEventListener(node, 'menuClose', this._onMenuButtonMenuCloseBind);
        }
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    _updateContentTextScanner(options) {
        if (!options.scanning.enablePopupSearch) {
            if (this._contentTextScanner !== null) {
                this._contentTextScanner.setEnabled(false);
                this._contentTextScanner.clearSelection();
            }
            return;
        }

        if (this._contentTextScanner === null) {
            this._contentTextScanner = new TextScanner({
                api: this._application.api,
                node: window,
                getSearchContext: this._getSearchContext.bind(this),
                searchTerms: true,
                searchKanji: false,
                searchOnClick: true,
                searchOnClickOnly: true,
                textSourceGenerator: this._textSourceGenerator
            });
            this._contentTextScanner.includeSelector = '.click-scannable,.click-scannable *';
            this._contentTextScanner.excludeSelector = '.scan-disable,.scan-disable *';
            this._contentTextScanner.prepare();
            this._contentTextScanner.on('clear', this._onContentTextScannerClear.bind(this));
            this._contentTextScanner.on('searchSuccess', this._onContentTextScannerSearchSuccess.bind(this));
            this._contentTextScanner.on('searchError', this._onContentTextScannerSearchError.bind(this));
        }

        const {scanning: scanningOptions, sentenceParsing: sentenceParsingOptions} = options;
        this._contentTextScanner.setOptions({
            inputs: [{
                include: 'mouse0',
                exclude: '',
                types: {mouse: true, pen: false, touch: false},
                options: {
                    searchTerms: true,
                    searchKanji: true,
                    scanOnTouchMove: false,
                    scanOnTouchPress: false,
                    scanOnTouchRelease: false,
                    scanOnPenMove: false,
                    scanOnPenHover: false,
                    scanOnPenReleaseHover: false,
                    scanOnPenPress: false,
                    scanOnPenRelease: false,
                    preventTouchScrolling: false,
                    preventPenScrolling: false
                }
            }],
            deepContentScan: scanningOptions.deepDomScan,
            normalizeCssZoom: scanningOptions.normalizeCssZoom,
            selectText: false,
            delay: scanningOptions.delay,
            touchInputEnabled: false,
            pointerEventsEnabled: false,
            scanLength: scanningOptions.length,
            layoutAwareScan: scanningOptions.layoutAwareScan,
            preventMiddleMouse: false,
            sentenceParsingOptions
        });

        this._contentTextScanner.setEnabled(true);
    }

    /** */
    _onContentTextScannerClear() {
        /** @type {TextScanner} */ (this._contentTextScanner).clearSelection();
    }

    /**
     * @param {import('text-scanner').EventArgument<'searchSuccess'>} details
     */
    _onContentTextScannerSearchSuccess({type, dictionaryEntries, sentence, textSource, optionsContext}) {
        const query = textSource.text();
        const url = window.location.href;
        const documentTitle = document.title;
        /** @type {import('display').ContentDetails} */
        const details = {
            focus: false,
            historyMode: 'new',
            params: {
                type,
                query,
                wildcards: 'off'
            },
            state: {
                focusEntry: 0,
                optionsContext: optionsContext !== null ? optionsContext : void 0,
                url,
                sentence: sentence !== null ? sentence : void 0,
                documentTitle
            },
            content: {
                dictionaryEntries: dictionaryEntries !== null ? dictionaryEntries : void 0,
                contentOrigin: this.getContentOrigin()
            }
        };
        /** @type {TextScanner} */ (this._contentTextScanner).clearSelection();
        this.setContent(details);
    }

    /**
     * @param {import('text-scanner').EventArgument<'searchError'>} details
     */
    _onContentTextScannerSearchError({error}) {
        if (!this._application.webExtension.unloaded) {
            log.error(error);
        }
    }

    /**
     * @type {import('display').GetSearchContextCallback}
     */
    _getSearchContext() {
        return {
            optionsContext: this.getOptionsContext(),
            detail: {
                documentTitle: document.title
            }
        };
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    _updateHotkeys(options) {
        this._hotkeyHandler.setHotkeys(this._pageType, options.inputs.hotkeys);
    }

    /** */
    async _closeTab() {
        const tab = await new Promise((resolve, reject) => {
            chrome.tabs.getCurrent((result) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve(result);
                }
            });
        });
        const tabId = tab.id;
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
            chrome.tabs.remove(tabId, () => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve();
                }
            });
        }));
    }

    /** */
    _onHotkeyClose() {
        if (this._closeSinglePopupMenu()) { return; }
        this.close();
    }

    /**
     * @param {number} sign
     * @param {unknown} argument
     */
    _onHotkeyActionMoveRelative(sign, argument) {
        let count = typeof argument === 'number' ? argument : (typeof argument === 'string' ? Number.parseInt(argument, 10) : 0);
        if (!Number.isFinite(count)) { count = 1; }
        count = Math.max(0, Math.floor(count));
        this._focusEntry(this._index + count * sign, 0, true);
    }

    /** */
    _closeAllPopupMenus() {
        for (const popupMenu of PopupMenu.openMenus) {
            popupMenu.close();
        }
    }

    /**
     * @returns {boolean}
     */
    _closeSinglePopupMenu() {
        for (const popupMenu of PopupMenu.openMenus) {
            popupMenu.close();
            return true;
        }
        return false;
    }

    /**
     * @param {number} index
     */
    async _logDictionaryEntryData(index) {
        if (index < 0 || index >= this._dictionaryEntries.length) { return; }
        const dictionaryEntry = this._dictionaryEntries[index];
        const result = {dictionaryEntry};

        /** @type {Promise<unknown>[]} */
        const promises = [];
        this.trigger('logDictionaryEntryData', {dictionaryEntry, promises});
        if (promises.length > 0) {
            for (const result2 of await Promise.all(promises)) {
                Object.assign(result, result2);
            }
        }

        // eslint-disable-next-line no-console
        console.log(result);
    }

    /** */
    _triggerContentClear() {
        this.trigger('contentClear', {});
    }

    /** */
    _triggerContentUpdateStart() {
        this.trigger('contentUpdateStart', {type: this._contentType, query: this._query});
    }

    /**
     * @param {import('dictionary').DictionaryEntry} dictionaryEntry
     * @param {Element} element
     * @param {number} index
     */
    _triggerContentUpdateEntry(dictionaryEntry, element, index) {
        this.trigger('contentUpdateEntry', {dictionaryEntry, element, index});
    }

    /** */
    _triggerContentUpdateComplete() {
        this.trigger('contentUpdateComplete', {type: this._contentType});
    }
}
