/*
 * Copyright (C) 2023  Yomitan Authors
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

import * as wanakana from '../../lib/wanakana.js';
import {AccessibilityController} from '../accessibility/accessibility-controller.js';
import {AnkiConnect} from '../comm/anki-connect.js';
import {ClipboardMonitor} from '../comm/clipboard-monitor.js';
import {ClipboardReader} from '../comm/clipboard-reader.js';
import {Mecab} from '../comm/mecab.js';
import {clone, deferPromise, generateId, invokeMessageHandler, isObject, log, promiseTimeout} from '../core.js';
import {ExtensionError} from '../core/extension-error.js';
import {parseJson, readResponseJson} from '../core/json.js';
import {AnkiUtil} from '../data/anki-util.js';
import {OptionsUtil} from '../data/options-util.js';
import {PermissionsUtil} from '../data/permissions-util.js';
import {ArrayBufferUtil} from '../data/sandbox/array-buffer-util.js';
import {Environment} from '../extension/environment.js';
import {ObjectPropertyAccessor} from '../general/object-property-accessor.js';
import {DictionaryDatabase} from '../language/dictionary-database.js';
import {JapaneseUtil} from '../language/sandbox/japanese-util.js';
import {Translator} from '../language/translator.js';
import {AudioDownloader} from '../media/audio-downloader.js';
import {MediaUtil} from '../media/media-util.js';
import {yomitan} from '../yomitan.js';
import {ClipboardReaderProxy, DictionaryDatabaseProxy, OffscreenProxy, TranslatorProxy} from './offscreen-proxy.js';
import {ProfileConditionsUtil} from './profile-conditions-util.js';
import {RequestBuilder} from './request-builder.js';
import {ScriptManager} from './script-manager.js';

/**
 * This class controls the core logic of the extension, including API calls
 * and various forms of communication between browser tabs and external applications.
 */
export class Backend {
    /**
     * Creates a new instance.
     */
    constructor() {
        /** @type {JapaneseUtil} */
        this._japaneseUtil = new JapaneseUtil(wanakana);
        /** @type {Environment} */
        this._environment = new Environment();
        /** @type {AnkiConnect} */
        this._anki = new AnkiConnect();
        /** @type {Mecab} */
        this._mecab = new Mecab();

        if (!chrome.offscreen) {
            /** @type {?OffscreenProxy} */
            this._offscreen = null;
            /** @type {DictionaryDatabase|DictionaryDatabaseProxy} */
            this._dictionaryDatabase = new DictionaryDatabase();
            /** @type {Translator|TranslatorProxy} */
            this._translator = new Translator({
                japaneseUtil: this._japaneseUtil,
                database: this._dictionaryDatabase
            });
            /** @type {ClipboardReader|ClipboardReaderProxy} */
            this._clipboardReader = new ClipboardReader({
                // eslint-disable-next-line no-undef
                document: (typeof document === 'object' && document !== null ? document : null),
                pasteTargetSelector: '#clipboard-paste-target',
                richContentPasteTargetSelector: '#clipboard-rich-content-paste-target'
            });
        } else {
            /** @type {?OffscreenProxy} */
            this._offscreen = new OffscreenProxy();
            /** @type {DictionaryDatabase|DictionaryDatabaseProxy} */
            this._dictionaryDatabase = new DictionaryDatabaseProxy(this._offscreen);
            /** @type {Translator|TranslatorProxy} */
            this._translator = new TranslatorProxy(this._offscreen);
            /** @type {ClipboardReader|ClipboardReaderProxy} */
            this._clipboardReader = new ClipboardReaderProxy(this._offscreen);
        }

        /** @type {ClipboardMonitor} */
        this._clipboardMonitor = new ClipboardMonitor({
            japaneseUtil: this._japaneseUtil,
            clipboardReader: this._clipboardReader
        });
        /** @type {?import('settings').Options} */
        this._options = null;
        /** @type {import('../data/json-schema.js').JsonSchema[]} */
        this._profileConditionsSchemaCache = [];
        /** @type {ProfileConditionsUtil} */
        this._profileConditionsUtil = new ProfileConditionsUtil();
        /** @type {?string} */
        this._defaultAnkiFieldTemplates = null;
        /** @type {RequestBuilder} */
        this._requestBuilder = new RequestBuilder();
        /** @type {AudioDownloader} */
        this._audioDownloader = new AudioDownloader({
            japaneseUtil: this._japaneseUtil,
            requestBuilder: this._requestBuilder
        });
        /** @type {OptionsUtil} */
        this._optionsUtil = new OptionsUtil();
        /** @type {ScriptManager} */
        this._scriptManager = new ScriptManager();
        /** @type {AccessibilityController} */
        this._accessibilityController = new AccessibilityController(this._scriptManager);

        /** @type {?number} */
        this._searchPopupTabId = null;
        /** @type {?Promise<{tab: chrome.tabs.Tab, created: boolean}>} */
        this._searchPopupTabCreatePromise = null;

        /** @type {boolean} */
        this._isPrepared = false;
        /** @type {boolean} */
        this._prepareError = false;
        /** @type {?Promise<void>} */
        this._preparePromise = null;
        /** @type {import('core').DeferredPromiseDetails<void>} */
        const {promise, resolve, reject} = deferPromise();
        /** @type {Promise<void>} */
        this._prepareCompletePromise = promise;
        /** @type {() => void} */
        this._prepareCompleteResolve = resolve;
        /** @type {(reason?: unknown) => void} */
        this._prepareCompleteReject = reject;

        /** @type {?string} */
        this._defaultBrowserActionTitle = null;
        /** @type {?import('core').Timeout} */
        this._badgePrepareDelayTimer = null;
        /** @type {?import('log').LogLevel} */
        this._logErrorLevel = null;
        /** @type {?chrome.permissions.Permissions} */
        this._permissions = null;
        /** @type {PermissionsUtil} */
        this._permissionsUtil = new PermissionsUtil();

        /* eslint-disable no-multi-spaces */
        /** @type {import('core').MessageHandlerMap} */
        this._messageHandlers = new Map(/** @type {import('core').MessageHandlerMapInit} */ ([
            ['requestBackendReadySignal',    this._onApiRequestBackendReadySignal.bind(this)],
            ['optionsGet',                   this._onApiOptionsGet.bind(this)],
            ['optionsGetFull',               this._onApiOptionsGetFull.bind(this)],
            ['kanjiFind',                    this._onApiKanjiFind.bind(this)],
            ['termsFind',                    this._onApiTermsFind.bind(this)],
            ['parseText',                    this._onApiParseText.bind(this)],
            ['getAnkiConnectVersion',        this._onApiGetAnkiConnectVersion.bind(this)],
            ['isAnkiConnected',              this._onApiIsAnkiConnected.bind(this)],
            ['addAnkiNote',                  this._onApiAddAnkiNote.bind(this)],
            ['getAnkiNoteInfo',              this._onApiGetAnkiNoteInfo.bind(this)],
            ['injectAnkiNoteMedia',          this._onApiInjectAnkiNoteMedia.bind(this)],
            ['noteView',                     this._onApiNoteView.bind(this)],
            ['suspendAnkiCardsForNote',      this._onApiSuspendAnkiCardsForNote.bind(this)],
            ['commandExec',                  this._onApiCommandExec.bind(this)],
            ['getTermAudioInfoList',         this._onApiGetTermAudioInfoList.bind(this)],
            ['sendMessageToFrame',           this._onApiSendMessageToFrame.bind(this)],
            ['broadcastTab',                 this._onApiBroadcastTab.bind(this)],
            ['frameInformationGet',          this._onApiFrameInformationGet.bind(this)],
            ['injectStylesheet',             this._onApiInjectStylesheet.bind(this)],
            ['getStylesheetContent',         this._onApiGetStylesheetContent.bind(this)],
            ['getEnvironmentInfo',           this._onApiGetEnvironmentInfo.bind(this)],
            ['clipboardGet',                 this._onApiClipboardGet.bind(this)],
            ['getDisplayTemplatesHtml',      this._onApiGetDisplayTemplatesHtml.bind(this)],
            ['getZoom',                      this._onApiGetZoom.bind(this)],
            ['getDefaultAnkiFieldTemplates', this._onApiGetDefaultAnkiFieldTemplates.bind(this)],
            ['getDictionaryInfo',            this._onApiGetDictionaryInfo.bind(this)],
            ['purgeDatabase',                this._onApiPurgeDatabase.bind(this)],
            ['getMedia',                     this._onApiGetMedia.bind(this)],
            ['log',                          this._onApiLog.bind(this)],
            ['logIndicatorClear',            this._onApiLogIndicatorClear.bind(this)],
            ['createActionPort',             this._onApiCreateActionPort.bind(this)],
            ['modifySettings',               this._onApiModifySettings.bind(this)],
            ['getSettings',                  this._onApiGetSettings.bind(this)],
            ['setAllSettings',               this._onApiSetAllSettings.bind(this)],
            ['getOrCreateSearchPopup',       this._onApiGetOrCreateSearchPopup.bind(this)],
            ['isTabSearchPopup',             this._onApiIsTabSearchPopup.bind(this)],
            ['triggerDatabaseUpdated',       this._onApiTriggerDatabaseUpdated.bind(this)],
            ['testMecab',                    this._onApiTestMecab.bind(this)],
            ['textHasJapaneseCharacters',    this._onApiTextHasJapaneseCharacters.bind(this)],
            ['getTermFrequencies',           this._onApiGetTermFrequencies.bind(this)],
            ['findAnkiNotes',                this._onApiFindAnkiNotes.bind(this)],
            ['loadExtensionScripts',         this._onApiLoadExtensionScripts.bind(this)],
            ['openCrossFramePort',           this._onApiOpenCrossFramePort.bind(this)]
        ]));
        /* eslint-enable no-multi-spaces */
        /** @type {import('backend').MessageHandlerWithProgressMap} */
        this._messageHandlersWithProgress = new Map(/** @type {import('backend').MessageHandlerWithProgressMapInit} */ ([
            // Empty
        ]));

        /** @type {Map<string, (params?: import('core').SerializableObject) => void>} */
        this._commandHandlers = new Map(/** @type {[name: string, handler: (params?: import('core').SerializableObject) => void][]} */ ([
            ['toggleTextScanning', this._onCommandToggleTextScanning.bind(this)],
            ['openInfoPage', this._onCommandOpenInfoPage.bind(this)],
            ['openSettingsPage', this._onCommandOpenSettingsPage.bind(this)],
            ['openSearchPage', this._onCommandOpenSearchPage.bind(this)],
            ['openPopupWindow', this._onCommandOpenPopupWindow.bind(this)]
        ]));
    }

    /**
     * Initializes the instance.
     * @returns {Promise<void>} A promise which is resolved when initialization completes.
     */
    prepare() {
        if (this._preparePromise === null) {
            const promise = this._prepareInternal();
            promise.then(
                () => {
                    this._isPrepared = true;
                    this._prepareCompleteResolve();
                },
                (error) => {
                    this._prepareError = true;
                    this._prepareCompleteReject(error);
                }
            );
            promise.finally(() => this._updateBadge());
            this._preparePromise = promise;
        }
        return this._prepareCompletePromise;
    }

    // Private

    /**
     * @returns {void}
     */
    _prepareInternalSync() {
        if (isObject(chrome.commands) && isObject(chrome.commands.onCommand)) {
            const onCommand = this._onWebExtensionEventWrapper(this._onCommand.bind(this));
            chrome.commands.onCommand.addListener(onCommand);
        }

        if (isObject(chrome.tabs) && isObject(chrome.tabs.onZoomChange)) {
            const onZoomChange = this._onWebExtensionEventWrapper(this._onZoomChange.bind(this));
            chrome.tabs.onZoomChange.addListener(onZoomChange);
        }

        const onMessage = this._onMessageWrapper.bind(this);
        chrome.runtime.onMessage.addListener(onMessage);

        if (this._canObservePermissionsChanges()) {
            const onPermissionsChanged = this._onWebExtensionEventWrapper(this._onPermissionsChanged.bind(this));
            chrome.permissions.onAdded.addListener(onPermissionsChanged);
            chrome.permissions.onRemoved.addListener(onPermissionsChanged);
        }

        chrome.runtime.onInstalled.addListener(this._onInstalled.bind(this));
    }

    /**
     * @returns {Promise<void>}
     */
    async _prepareInternal() {
        try {
            this._prepareInternalSync();

            this._permissions = await this._permissionsUtil.getAllPermissions();
            this._defaultBrowserActionTitle = await this._getBrowserIconTitle();
            this._badgePrepareDelayTimer = setTimeout(() => {
                this._badgePrepareDelayTimer = null;
                this._updateBadge();
            }, 1000);
            this._updateBadge();

            log.on('log', this._onLog.bind(this));

            await this._requestBuilder.prepare();
            await this._environment.prepare();
            if (this._offscreen !== null) {
                await this._offscreen.prepare();
            }
            this._clipboardReader.browser = this._environment.getInfo().browser;

            try {
                await this._dictionaryDatabase.prepare();
            } catch (e) {
                log.error(e);
            }

            /** @type {import('deinflector').ReasonsRaw} */
            const deinflectionReasons = await this._fetchJson('/data/deinflect.json');
            this._translator.prepare(deinflectionReasons);

            await this._optionsUtil.prepare();
            this._defaultAnkiFieldTemplates = (await this._fetchText('/data/templates/default-anki-field-templates.handlebars')).trim();
            this._options = await this._optionsUtil.load();

            this._applyOptions('background');

            const options = this._getProfileOptions({current: true}, false);
            if (options.general.showGuide) {
                this._openWelcomeGuidePageOnce();
            }

            this._clipboardMonitor.on('change', this._onClipboardTextChange.bind(this));

            this._sendMessageAllTabsIgnoreResponse('Yomitan.backendReady', {});
            this._sendMessageIgnoreResponse({action: 'Yomitan.backendReady', params: {}});
        } catch (e) {
            log.error(e);
            throw e;
        } finally {
            if (this._badgePrepareDelayTimer !== null) {
                clearTimeout(this._badgePrepareDelayTimer);
                this._badgePrepareDelayTimer = null;
            }
        }
    }

    // Event handlers

    /**
     * @param {{text: string}} params
     */
    async _onClipboardTextChange({text}) {
        const {clipboard: {maximumSearchLength}} = this._getProfileOptions({current: true}, false);
        if (text.length > maximumSearchLength) {
            text = text.substring(0, maximumSearchLength);
        }
        try {
            const {tab, created} = await this._getOrCreateSearchPopupWrapper();
            const {id} = tab;
            if (typeof id !== 'number') {
                throw new Error('Tab does not have an id');
            }
            await this._focusTab(tab);
            await this._updateSearchQuery(id, text, !created);
        } catch (e) {
            // NOP
        }
    }

    /**
     * @param {{level: import('log').LogLevel}} params
     */
    _onLog({level}) {
        const levelValue = this._getErrorLevelValue(level);
        if (levelValue <= this._getErrorLevelValue(this._logErrorLevel)) { return; }

        this._logErrorLevel = level;
        this._updateBadge();
    }

    // WebExtension event handlers (with prepared checks)

    /**
     * @template {(...args: import('core').SafeAny[]) => void} T
     * @param {T} handler
     * @returns {T}
     */
    _onWebExtensionEventWrapper(handler) {
        return /** @type {T} */ ((...args) => {
            if (this._isPrepared) {
                handler(...args);
                return;
            }

            this._prepareCompletePromise.then(
                () => { handler(...args); },
                () => {} // NOP
            );
        });
    }

    /** @type {import('extension').ChromeRuntimeOnMessageCallback} */
    _onMessageWrapper(message, sender, sendResponse) {
        if (this._isPrepared) {
            return this._onMessage(message, sender, sendResponse);
        }

        this._prepareCompletePromise.then(
            () => { this._onMessage(message, sender, sendResponse); },
            () => { sendResponse(); }
        );
        return true;
    }

    // WebExtension event handlers

    /**
     * @param {string} command
     */
    _onCommand(command) {
        this._runCommand(command, void 0);
    }

    /**
     * @param {{action: string, params?: import('core').SerializableObject}} message
     * @param {chrome.runtime.MessageSender} sender
     * @param {(response?: unknown) => void} callback
     * @returns {boolean}
     */
    _onMessage({action, params}, sender, callback) {
        const messageHandler = this._messageHandlers.get(action);
        if (typeof messageHandler === 'undefined') { return false; }
        return invokeMessageHandler(messageHandler, params, callback, sender);
    }

    /**
     * @param {chrome.tabs.ZoomChangeInfo} event
     */
    _onZoomChange({tabId, oldZoomFactor, newZoomFactor}) {
        this._sendMessageTabIgnoreResponse(tabId, {action: 'Yomitan.zoomChanged', params: {oldZoomFactor, newZoomFactor}}, {});
    }

    /**
     * @returns {void}
     */
    _onPermissionsChanged() {
        this._checkPermissions();
    }

    /**
     * @param {chrome.runtime.InstalledDetails} event
     */
    _onInstalled({reason}) {
        if (reason !== 'install') { return; }
        this._requestPersistentStorage();
    }

    // Message handlers

    /** @type {import('api').Handler<import('api').RequestBackendReadySignalDetails, import('api').RequestBackendReadySignalResult, true>} */
    _onApiRequestBackendReadySignal(_params, sender) {
        // tab ID isn't set in background (e.g. browser_action)
        const data = {action: 'Yomitan.backendReady', params: {}};
        if (typeof sender.tab === 'undefined') {
            this._sendMessageIgnoreResponse(data);
            return false;
        } else {
            const {id} = sender.tab;
            if (typeof id === 'number') {
                this._sendMessageTabIgnoreResponse(id, data, {});
            }
            return true;
        }
    }

    /** @type {import('api').Handler<import('api').OptionsGetDetails, import('api').OptionsGetResult>} */
    _onApiOptionsGet({optionsContext}) {
        return this._getProfileOptions(optionsContext, false);
    }

    /** @type {import('api').Handler<import('api').OptionsGetFullDetails, import('api').OptionsGetFullResult>} */
    _onApiOptionsGetFull() {
        return this._getOptionsFull(false);
    }

    /** @type {import('api').Handler<import('api').KanjiFindDetails, import('api').KanjiFindResult>} */
    async _onApiKanjiFind({text, optionsContext}) {
        const options = this._getProfileOptions(optionsContext, false);
        const {general: {maxResults}} = options;
        const findKanjiOptions = this._getTranslatorFindKanjiOptions(options);
        const dictionaryEntries = await this._translator.findKanji(text, findKanjiOptions);
        dictionaryEntries.splice(maxResults);
        return dictionaryEntries;
    }

    /** @type {import('api').Handler<import('api').TermsFindDetails, import('api').TermsFindResult>} */
    async _onApiTermsFind({text, details, optionsContext}) {
        const options = this._getProfileOptions(optionsContext, false);
        const {general: {resultOutputMode: mode, maxResults}} = options;
        const findTermsOptions = this._getTranslatorFindTermsOptions(mode, details, options);
        const {dictionaryEntries, originalTextLength} = await this._translator.findTerms(mode, text, findTermsOptions);
        dictionaryEntries.splice(maxResults);
        return {dictionaryEntries, originalTextLength};
    }

    /** @type {import('api').Handler<import('api').ParseTextDetails, import('api').ParseTextResult>} */
    async _onApiParseText({text, optionsContext, scanLength, useInternalParser, useMecabParser}) {
        const [internalResults, mecabResults] = await Promise.all([
            (useInternalParser ? this._textParseScanning(text, scanLength, optionsContext) : null),
            (useMecabParser ? this._textParseMecab(text) : null)
        ]);

        /** @type {import('api').ParseTextResultItem[]} */
        const results = [];

        if (internalResults !== null) {
            results.push({
                id: 'scan',
                source: 'scanning-parser',
                dictionary: null,
                content: internalResults
            });
        }

        if (mecabResults !== null) {
            for (const [dictionary, content] of mecabResults) {
                results.push({
                    id: `mecab-${dictionary}`,
                    source: 'mecab',
                    dictionary,
                    content
                });
            }
        }

        return results;
    }

    /** @type {import('api').Handler<import('api').GetAnkiConnectVersionDetails, import('api').GetAnkiConnectVersionResult>} */
    async _onApiGetAnkiConnectVersion() {
        return await this._anki.getVersion();
    }

    /** @type {import('api').Handler<import('api').IsAnkiConnectedDetails, import('api').IsAnkiConnectedResult>} */
    async _onApiIsAnkiConnected() {
        return await this._anki.isConnected();
    }

    /** @type {import('api').Handler<import('api').AddAnkiNoteDetails, import('api').AddAnkiNoteResult>} */
    async _onApiAddAnkiNote({note}) {
        return await this._anki.addNote(note);
    }

    /** @type {import('api').Handler<import('api').GetAnkiNoteInfoDetails, import('api').GetAnkiNoteInfoResult>} */
    async _onApiGetAnkiNoteInfo({notes, fetchAdditionalInfo}) {
        /** @type {import('anki').NoteInfoWrapper[]} */
        const results = [];
        /** @type {{note: import('anki').Note, info: import('anki').NoteInfoWrapper}[]} */
        const cannotAdd = [];
        const canAddArray = await this._anki.canAddNotes(notes);

        for (let i = 0; i < notes.length; ++i) {
            const note = notes[i];
            let canAdd = canAddArray[i];
            const valid = AnkiUtil.isNoteDataValid(note);
            if (!valid) { canAdd = false; }
            const info = {canAdd, valid, noteIds: null};
            results.push(info);
            if (!canAdd && valid) {
                cannotAdd.push({note, info});
            }
        }

        if (cannotAdd.length > 0) {
            const cannotAddNotes = cannotAdd.map(({note}) => note);
            const noteIdsArray = await this._anki.findNoteIds(cannotAddNotes);
            for (let i = 0, ii = Math.min(cannotAdd.length, noteIdsArray.length); i < ii; ++i) {
                const noteIds = noteIdsArray[i];
                if (noteIds.length > 0) {
                    cannotAdd[i].info.noteIds = noteIds;
                    if (fetchAdditionalInfo) {
                        cannotAdd[i].info.noteInfos = await this._anki.notesInfo(noteIds);
                    }
                }
            }
        }

        return results;
    }

    /** @type {import('api').Handler<import('api').InjectAnkiNoteMediaDetails, import('api').InjectAnkiNoteMediaResult>} */
    async _onApiInjectAnkiNoteMedia({timestamp, definitionDetails, audioDetails, screenshotDetails, clipboardDetails, dictionaryMediaDetails}) {
        return await this._injectAnkNoteMedia(
            this._anki,
            timestamp,
            definitionDetails,
            audioDetails,
            screenshotDetails,
            clipboardDetails,
            dictionaryMediaDetails
        );
    }

    /** @type {import('api').Handler<import('api').NoteViewDetails, import('api').NoteViewResult>} */
    async _onApiNoteView({noteId, mode, allowFallback}) {
        if (mode === 'edit') {
            try {
                await this._anki.guiEditNote(noteId);
                return 'edit';
            } catch (e) {
                if (!(e instanceof Error && this._anki.isErrorUnsupportedAction(e))) {
                    throw e;
                } else if (!allowFallback) {
                    throw new Error('Mode not supported');
                }
            }
        }
        // Fallback
        await this._anki.guiBrowseNote(noteId);
        return 'browse';
    }

    /** @type {import('api').Handler<import('api').SuspendAnkiCardsForNoteDetails, import('api').SuspendAnkiCardsForNoteResult>} */
    async _onApiSuspendAnkiCardsForNote({noteId}) {
        const cardIds = await this._anki.findCardsForNote(noteId);
        const count = cardIds.length;
        if (count > 0) {
            const okay = await this._anki.suspendCards(cardIds);
            if (!okay) { return 0; }
        }
        return count;
    }

    /** @type {import('api').Handler<import('api').CommandExecDetails, import('api').CommandExecResult>} */
    _onApiCommandExec({command, params}) {
        return this._runCommand(command, params);
    }

    /** @type {import('api').Handler<import('api').GetTermAudioInfoListDetails, import('api').GetTermAudioInfoListResult>} */
    async _onApiGetTermAudioInfoList({source, term, reading}) {
        return await this._audioDownloader.getTermAudioInfoList(source, term, reading);
    }

    /** @type {import('api').Handler<import('api').SendMessageToFrameDetails, import('api').SendMessageToFrameResult, true>} */
    _onApiSendMessageToFrame({frameId: targetFrameId, action, params}, sender) {
        if (!sender) { return false; }
        const {tab} = sender;
        if (!tab) { return false; }
        const {id} = tab;
        if (typeof id !== 'number') { return false; }
        const frameId = sender.frameId;
        /** @type {import('extension').ChromeRuntimeMessageWithFrameId} */
        const message = {action, params, frameId};
        this._sendMessageTabIgnoreResponse(id, message, {frameId: targetFrameId});
        return true;
    }

    /** @type {import('api').Handler<import('api').BroadcastTabDetails, import('api').BroadcastTabResult, true>} */
    _onApiBroadcastTab({action, params}, sender) {
        if (!sender) { return false; }
        const {tab} = sender;
        if (!tab) { return false; }
        const {id} = tab;
        if (typeof id !== 'number') { return false; }
        const frameId = sender.frameId;
        /** @type {import('extension').ChromeRuntimeMessageWithFrameId} */
        const message = {action, params, frameId};
        this._sendMessageTabIgnoreResponse(id, message, {});
        return true;
    }

    /** @type {import('api').Handler<import('api').FrameInformationGetDetails, import('api').FrameInformationGetResult, true>} */
    _onApiFrameInformationGet(_params, sender) {
        const tab = sender.tab;
        const tabId = tab ? tab.id : void 0;
        const frameId = sender.frameId;
        return Promise.resolve({tabId, frameId});
    }

    /** @type {import('api').Handler<import('api').InjectStylesheetDetails, import('api').InjectStylesheetResult, true>} */
    async _onApiInjectStylesheet({type, value}, sender) {
        const {frameId, tab} = sender;
        if (typeof tab !== 'object' || tab === null || typeof tab.id !== 'number') { throw new Error('Invalid tab'); }
        return await this._scriptManager.injectStylesheet(type, value, tab.id, frameId, false);
    }

    /** @type {import('api').Handler<import('api').GetStylesheetContentDetails, import('api').GetStylesheetContentResult>} */
    async _onApiGetStylesheetContent({url}) {
        if (!url.startsWith('/') || url.startsWith('//') || !url.endsWith('.css')) {
            throw new Error('Invalid URL');
        }
        return await this._fetchText(url);
    }

    /** @type {import('api').Handler<import('api').GetEnvironmentInfoDetails, import('api').GetEnvironmentInfoResult>} */
    _onApiGetEnvironmentInfo() {
        return this._environment.getInfo();
    }

    /** @type {import('api').Handler<import('api').ClipboardGetDetails, import('api').ClipboardGetResult>} */
    async _onApiClipboardGet() {
        return this._clipboardReader.getText(false);
    }

    /** @type {import('api').Handler<import('api').GetDisplayTemplatesHtmlDetails, import('api').GetDisplayTemplatesHtmlResult>} */
    async _onApiGetDisplayTemplatesHtml() {
        return await this._fetchText('/display-templates.html');
    }

    /** @type {import('api').Handler<import('api').GetZoomDetails, import('api').GetZoomResult, true>} */
    _onApiGetZoom(_params, sender) {
        return new Promise((resolve, reject) => {
            if (!sender || !sender.tab) {
                reject(new Error('Invalid tab'));
                return;
            }

            const tabId = sender.tab.id;
            if (!(
                typeof tabId === 'number' &&
                chrome.tabs !== null &&
                typeof chrome.tabs === 'object' &&
                typeof chrome.tabs.getZoom === 'function'
            )) {
                // Not supported
                resolve({zoomFactor: 1.0});
                return;
            }
            chrome.tabs.getZoom(tabId, (zoomFactor) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve({zoomFactor});
                }
            });
        });
    }

    /** @type {import('api').Handler<import('api').GetDefaultAnkiFieldTemplatesDetails, import('api').GetDefaultAnkiFieldTemplatesResult>} */
    _onApiGetDefaultAnkiFieldTemplates() {
        return /** @type {string} */ (this._defaultAnkiFieldTemplates);
    }

    /** @type {import('api').Handler<import('api').GetDictionaryInfoDetails, import('api').GetDictionaryInfoResult>} */
    async _onApiGetDictionaryInfo() {
        return await this._dictionaryDatabase.getDictionaryInfo();
    }

    /** @type {import('api').Handler<import('api').PurgeDatabaseDetails, import('api').PurgeDatabaseResult>} */
    async _onApiPurgeDatabase() {
        await this._dictionaryDatabase.purge();
        this._triggerDatabaseUpdated('dictionary', 'purge');
    }

    /** @type {import('api').Handler<import('api').GetMediaDetails, import('api').GetMediaResult>} */
    async _onApiGetMedia({targets}) {
        return await this._getNormalizedDictionaryDatabaseMedia(targets);
    }

    /** @type {import('api').Handler<import('api').LogDetails, import('api').LogResult>} */
    _onApiLog({error, level, context}) {
        log.log(ExtensionError.deserialize(error), level, context);
    }

    /** @type {import('api').Handler<import('api').LogIndicatorClearDetails, import('api').LogIndicatorClearResult>} */
    _onApiLogIndicatorClear() {
        if (this._logErrorLevel === null) { return; }
        this._logErrorLevel = null;
        this._updateBadge();
    }

    /** @type {import('api').Handler<import('api').CreateActionPortDetails, import('api').CreateActionPortResult, true>} */
    _onApiCreateActionPort(_params, sender) {
        if (!sender || !sender.tab) { throw new Error('Invalid sender'); }
        const tabId = sender.tab.id;
        if (typeof tabId !== 'number') { throw new Error('Sender has invalid tab ID'); }

        const frameId = sender.frameId;
        const id = generateId(16);
        /** @type {import('cross-frame-api').ActionPortDetails} */
        const details = {
            name: 'action-port',
            id
        };

        const port = chrome.tabs.connect(tabId, {name: JSON.stringify(details), frameId});
        try {
            this._createActionListenerPort(port, sender, this._messageHandlersWithProgress);
        } catch (e) {
            port.disconnect();
            throw e;
        }

        return details;
    }

    /** @type {import('api').Handler<import('api').ModifySettingsDetails, import('api').ModifySettingsResult>} */
    _onApiModifySettings({targets, source}) {
        return this._modifySettings(targets, source);
    }

    /** @type {import('api').Handler<import('api').GetSettingsDetails, import('api').GetSettingsResult>} */
    _onApiGetSettings({targets}) {
        const results = [];
        for (const target of targets) {
            try {
                const result = this._getSetting(target);
                results.push({result: clone(result)});
            } catch (e) {
                results.push({error: ExtensionError.serialize(e)});
            }
        }
        return results;
    }

    /** @type {import('api').Handler<import('api').SetAllSettingsDetails, import('api').SetAllSettingsResult>} */
    async _onApiSetAllSettings({value, source}) {
        this._optionsUtil.validate(value);
        this._options = clone(value);
        await this._saveOptions(source);
    }

    /** @type {import('api').Handler<import('api').GetOrCreateSearchPopupDetails, import('api').GetOrCreateSearchPopupResult>} */
    async _onApiGetOrCreateSearchPopup({focus = false, text}) {
        const {tab, created} = await this._getOrCreateSearchPopupWrapper();
        if (focus === true || (focus === 'ifCreated' && created)) {
            await this._focusTab(tab);
        }
        if (typeof text === 'string') {
            const {id} = tab;
            if (typeof id === 'number') {
                await this._updateSearchQuery(id, text, !created);
            }
        }
        const {id} = tab;
        return {tabId: typeof id === 'number' ? id : null, windowId: tab.windowId};
    }

    /** @type {import('api').Handler<import('api').IsTabSearchPopupDetails, import('api').IsTabSearchPopupResult>} */
    async _onApiIsTabSearchPopup({tabId}) {
        const baseUrl = chrome.runtime.getURL('/search.html');
        const tab = typeof tabId === 'number' ? await this._checkTabUrl(tabId, (url) => url !== null && url.startsWith(baseUrl)) : null;
        return (tab !== null);
    }

    /** @type {import('api').Handler<import('api').TriggerDatabaseUpdatedDetails, import('api').TriggerDatabaseUpdatedResult>} */
    _onApiTriggerDatabaseUpdated({type, cause}) {
        this._triggerDatabaseUpdated(type, cause);
    }

    /** @type {import('api').Handler<import('api').TestMecabDetails, import('api').TestMecabResult>} */
    async _onApiTestMecab() {
        if (!this._mecab.isEnabled()) {
            throw new Error('MeCab not enabled');
        }

        let permissionsOkay = false;
        try {
            permissionsOkay = await this._permissionsUtil.hasPermissions({permissions: ['nativeMessaging']});
        } catch (e) {
            // NOP
        }
        if (!permissionsOkay) {
            throw new Error('Insufficient permissions');
        }

        const disconnect = !this._mecab.isConnected();
        try {
            const version = await this._mecab.getVersion();
            if (version === null) {
                throw new Error('Could not connect to native MeCab component');
            }

            const localVersion = this._mecab.getLocalVersion();
            if (version !== localVersion) {
                throw new Error(`MeCab component version not supported: ${version}`);
            }
        } finally {
            // Disconnect if the connection was previously disconnected
            if (disconnect && this._mecab.isEnabled() && this._mecab.isActive()) {
                this._mecab.disconnect();
            }
        }

        return true;
    }

    /** @type {import('api').Handler<import('api').TextHasJapaneseCharactersDetails, import('api').TextHasJapaneseCharactersResult>} */
    _onApiTextHasJapaneseCharacters({text}) {
        return this._japaneseUtil.isStringPartiallyJapanese(text);
    }

    /** @type {import('api').Handler<import('api').GetTermFrequenciesDetails, import('api').GetTermFrequenciesResult>} */
    async _onApiGetTermFrequencies({termReadingList, dictionaries}) {
        return await this._translator.getTermFrequencies(termReadingList, dictionaries);
    }

    /** @type {import('api').Handler<import('api').FindAnkiNotesDetails, import('api').FindAnkiNotesResult>} */
    async _onApiFindAnkiNotes({query}) {
        return await this._anki.findNotes(query);
    }

    /** @type {import('api').Handler<import('api').LoadExtensionScriptsDetails, import('api').LoadExtensionScriptsResult, true>} */
    async _onApiLoadExtensionScripts({files}, sender) {
        if (!sender || !sender.tab) { throw new Error('Invalid sender'); }
        const tabId = sender.tab.id;
        if (typeof tabId !== 'number') { throw new Error('Sender has invalid tab ID'); }
        const {frameId} = sender;
        for (const file of files) {
            await this._scriptManager.injectScript(file, tabId, frameId, false);
        }
    }

    /** @type {import('api').Handler<import('api').OpenCrossFramePortDetails, import('api').OpenCrossFramePortResult, true>} */
    _onApiOpenCrossFramePort({targetTabId, targetFrameId}, sender) {
        const sourceTabId = (sender && sender.tab ? sender.tab.id : null);
        if (typeof sourceTabId !== 'number') {
            throw new Error('Port does not have an associated tab ID');
        }
        const sourceFrameId = sender.frameId;
        if (typeof sourceFrameId !== 'number') {
            throw new Error('Port does not have an associated frame ID');
        }

        /** @type {import('cross-frame-api').CrossFrameCommunicationPortDetails} */
        const sourceDetails = {
            name: 'cross-frame-communication-port',
            otherTabId: targetTabId,
            otherFrameId: targetFrameId
        };
        /** @type {import('cross-frame-api').CrossFrameCommunicationPortDetails} */
        const targetDetails = {
            name: 'cross-frame-communication-port',
            otherTabId: sourceTabId,
            otherFrameId: sourceFrameId
        };
        /** @type {?chrome.runtime.Port} */
        let sourcePort = chrome.tabs.connect(sourceTabId, {frameId: sourceFrameId, name: JSON.stringify(sourceDetails)});
        /** @type {?chrome.runtime.Port} */
        let targetPort = chrome.tabs.connect(targetTabId, {frameId: targetFrameId, name: JSON.stringify(targetDetails)});

        const cleanup = () => {
            this._checkLastError(chrome.runtime.lastError);
            if (targetPort !== null) {
                targetPort.disconnect();
                targetPort = null;
            }
            if (sourcePort !== null) {
                sourcePort.disconnect();
                sourcePort = null;
            }
        };

        sourcePort.onMessage.addListener((message) => {
            if (targetPort !== null) { targetPort.postMessage(message); }
        });
        targetPort.onMessage.addListener((message) => {
            if (sourcePort !== null) { sourcePort.postMessage(message); }
        });
        sourcePort.onDisconnect.addListener(cleanup);
        targetPort.onDisconnect.addListener(cleanup);

        return {targetTabId, targetFrameId};
    }

    // Command handlers

    /**
     * @param {undefined|{mode: 'existingOrNewTab'|'newTab', query?: string}} params
     */
    async _onCommandOpenSearchPage(params) {
        /** @type {'existingOrNewTab'|'newTab'} */
        let mode = 'existingOrNewTab';
        let query = '';
        if (typeof params === 'object' && params !== null) {
            mode = this._normalizeOpenSettingsPageMode(params.mode, mode);
            const paramsQuery = params.query;
            if (typeof paramsQuery === 'string') { query = paramsQuery; }
        }

        const baseUrl = chrome.runtime.getURL('/search.html');
        /** @type {{[key: string]: string}} */
        const queryParams = {};
        if (query.length > 0) { queryParams.query = query; }
        const queryString = new URLSearchParams(queryParams).toString();
        let queryUrl = baseUrl;
        if (queryString.length > 0) {
            queryUrl += `?${queryString}`;
        }

        /** @type {import('backend').FindTabsPredicate} */
        const predicate = ({url}) => {
            if (url === null || !url.startsWith(baseUrl)) { return false; }
            const parsedUrl = new URL(url);
            const parsedBaseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
            const parsedMode = parsedUrl.searchParams.get('mode');
            return parsedBaseUrl === baseUrl && (parsedMode === mode || (!parsedMode && mode === 'existingOrNewTab'));
        };

        const openInTab = async () => {
            const tabInfo = /** @type {?import('backend').TabInfo} */ (await this._findTabs(1000, false, predicate, false));
            if (tabInfo !== null) {
                const {tab} = tabInfo;
                const {id} = tab;
                if (typeof id === 'number') {
                    await this._focusTab(tab);
                    if (queryParams.query) {
                        await this._updateSearchQuery(id, queryParams.query, true);
                    }
                    return true;
                }
            }
            return false;
        };

        switch (mode) {
            case 'existingOrNewTab':
                try {
                    if (await openInTab()) { return; }
                } catch (e) {
                    // NOP
                }
                await this._createTab(queryUrl);
                return;
            case 'newTab':
                await this._createTab(queryUrl);
                return;
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async _onCommandOpenInfoPage() {
        await this._openInfoPage();
    }

    /**
     * @param {undefined|{mode: 'existingOrNewTab'|'newTab'}} params
     */
    async _onCommandOpenSettingsPage(params) {
        /** @type {'existingOrNewTab'|'newTab'} */
        let mode = 'existingOrNewTab';
        if (typeof params === 'object' && params !== null) {
            mode = this._normalizeOpenSettingsPageMode(params.mode, mode);
        }
        await this._openSettingsPage(mode);
    }

    /**
     * @returns {Promise<void>}
     */
    async _onCommandToggleTextScanning() {
        const options = this._getProfileOptions({current: true}, false);
        /** @type {import('settings-modifications').ScopedModificationSet} */
        const modification = {
            action: 'set',
            path: 'general.enable',
            value: !options.general.enable,
            scope: 'profile',
            optionsContext: {current: true}
        };
        await this._modifySettings([modification], 'backend');
    }

    /**
     * @returns {Promise<void>}
     */
    async _onCommandOpenPopupWindow() {
        await this._onApiGetOrCreateSearchPopup({focus: true});
    }

    // Utilities

    /**
     * @param {import('settings-modifications').ScopedModification[]} targets
     * @param {string} source
     * @returns {Promise<import('core').Response<import('settings-modifications').ModificationResult>[]>}
     */
    async _modifySettings(targets, source) {
        /** @type {import('core').Response<import('settings-modifications').ModificationResult>[]} */
        const results = [];
        for (const target of targets) {
            try {
                const result = this._modifySetting(target);
                results.push({result: clone(result)});
            } catch (e) {
                results.push({error: ExtensionError.serialize(e)});
            }
        }
        await this._saveOptions(source);
        return results;
    }

    /**
     * @returns {Promise<{tab: chrome.tabs.Tab, created: boolean}>}
     */
    _getOrCreateSearchPopupWrapper() {
        if (this._searchPopupTabCreatePromise === null) {
            const promise = this._getOrCreateSearchPopup();
            this._searchPopupTabCreatePromise = promise;
            promise.then(() => { this._searchPopupTabCreatePromise = null; });
        }
        return this._searchPopupTabCreatePromise;
    }

    /**
     * @returns {Promise<{tab: chrome.tabs.Tab, created: boolean}>}
     */
    async _getOrCreateSearchPopup() {
        // Use existing tab
        const baseUrl = chrome.runtime.getURL('/search.html');
        /**
         * @param {?string} url
         * @returns {boolean}
         */
        const urlPredicate = (url) => url !== null && url.startsWith(baseUrl);
        if (this._searchPopupTabId !== null) {
            const tab = await this._checkTabUrl(this._searchPopupTabId, urlPredicate);
            if (tab !== null) {
                return {tab, created: false};
            }
            this._searchPopupTabId = null;
        }

        // Find existing tab
        const existingTabInfo = await this._findSearchPopupTab(urlPredicate);
        if (existingTabInfo !== null) {
            const existingTab = existingTabInfo.tab;
            const {id} = existingTab;
            if (typeof id === 'number') {
                this._searchPopupTabId = id;
                return {tab: existingTab, created: false};
            }
        }

        // chrome.windows not supported (e.g. on Firefox mobile)
        if (!isObject(chrome.windows)) {
            throw new Error('Window creation not supported');
        }

        // Create a new window
        const options = this._getProfileOptions({current: true}, false);
        const createData = this._getSearchPopupWindowCreateData(baseUrl, options);
        const {popupWindow: {windowState}} = options;
        const popupWindow = await this._createWindow(createData);
        if (windowState !== 'normal' && typeof popupWindow.id === 'number') {
            await this._updateWindow(popupWindow.id, {state: windowState});
        }

        const {tabs} = popupWindow;
        if (!Array.isArray(tabs) || tabs.length === 0) {
            throw new Error('Created window did not contain a tab');
        }

        const tab = tabs[0];
        const {id} = tab;
        if (typeof id !== 'number') {
            throw new Error('Tab does not have an id');
        }
        await this._waitUntilTabFrameIsReady(id, 0, 2000);

        await this._sendMessageTabPromise(
            id,
            {action: 'SearchDisplayController.setMode', params: {mode: 'popup'}},
            {frameId: 0}
        );

        this._searchPopupTabId = id;
        return {tab, created: true};
    }

    /**
     * @param {(url: ?string) => boolean} urlPredicate
     * @returns {Promise<?import('backend').TabInfo>}
     */
    async _findSearchPopupTab(urlPredicate) {
        /** @type {import('backend').FindTabsPredicate} */
        const predicate = async ({url, tab}) => {
            const {id} = tab;
            if (typeof id === 'undefined' || !urlPredicate(url)) { return false; }
            try {
                const mode = await this._sendMessageTabPromise(
                    id,
                    {action: 'SearchDisplayController.getMode', params: {}},
                    {frameId: 0}
                );
                return mode === 'popup';
            } catch (e) {
                return false;
            }
        };
        return /** @type {?import('backend').TabInfo} */ (await this._findTabs(1000, false, predicate, true));
    }

    /**
     * @param {string} url
     * @param {import('settings').ProfileOptions} options
     * @returns {chrome.windows.CreateData}
     */
    _getSearchPopupWindowCreateData(url, options) {
        const {popupWindow: {width, height, left, top, useLeft, useTop, windowType}} = options;
        return {
            url,
            width,
            height,
            left: useLeft ? left : void 0,
            top: useTop ? top : void 0,
            type: windowType,
            state: 'normal'
        };
    }

    /**
     * @param {chrome.windows.CreateData} createData
     * @returns {Promise<chrome.windows.Window>}
     */
    _createWindow(createData) {
        return new Promise((resolve, reject) => {
            chrome.windows.create(
                createData,
                (result) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(new Error(error.message));
                    } else {
                        resolve(/** @type {chrome.windows.Window} */ (result));
                    }
                }
            );
        });
    }

    /**
     * @param {number} windowId
     * @param {chrome.windows.UpdateInfo} updateInfo
     * @returns {Promise<chrome.windows.Window>}
     */
    _updateWindow(windowId, updateInfo) {
        return new Promise((resolve, reject) => {
            chrome.windows.update(
                windowId,
                updateInfo,
                (result) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(new Error(error.message));
                    } else {
                        resolve(result);
                    }
                }
            );
        });
    }

    /**
     * @param {number} tabId
     * @param {string} text
     * @param {boolean} animate
     * @returns {Promise<void>}
     */
    async _updateSearchQuery(tabId, text, animate) {
        await this._sendMessageTabPromise(
            tabId,
            {action: 'SearchDisplayController.updateSearchQuery', params: {text, animate}},
            {frameId: 0}
        );
    }

    /**
     * @param {string} source
     */
    _applyOptions(source) {
        const options = this._getProfileOptions({current: true}, false);
        this._updateBadge();

        const enabled = options.general.enable;

        /** @type {?string} */
        let apiKey = options.anki.apiKey;
        if (apiKey === '') { apiKey = null; }
        this._anki.server = options.anki.server;
        this._anki.enabled = options.anki.enable && enabled;
        this._anki.apiKey = apiKey;

        this._mecab.setEnabled(options.parsing.enableMecabParser && enabled);

        if (options.clipboard.enableBackgroundMonitor && enabled) {
            this._clipboardMonitor.start();
        } else {
            this._clipboardMonitor.stop();
        }

        this._accessibilityController.update(this._getOptionsFull(false));

        this._sendMessageAllTabsIgnoreResponse('Yomitan.optionsUpdated', {source});
    }

    /**
     * @param {boolean} useSchema
     * @returns {import('settings').Options}
     * @throws {Error}
     */
    _getOptionsFull(useSchema) {
        const options = this._options;
        if (options === null) { throw new Error('Options is null'); }
        return useSchema ? /** @type {import('settings').Options} */ (this._optionsUtil.createValidatingProxy(options)) : options;
    }

    /**
     * @param {import('settings').OptionsContext} optionsContext
     * @param {boolean} useSchema
     * @returns {import('settings').ProfileOptions}
     */
    _getProfileOptions(optionsContext, useSchema) {
        return this._getProfile(optionsContext, useSchema).options;
    }

    /**
     * @param {import('settings').OptionsContext} optionsContext
     * @param {boolean} useSchema
     * @returns {import('settings').Profile}
     * @throws {Error}
     */
    _getProfile(optionsContext, useSchema) {
        const options = this._getOptionsFull(useSchema);
        const profiles = options.profiles;
        if (!optionsContext.current) {
            // Specific index
            const {index} = optionsContext;
            if (typeof index === 'number') {
                if (index < 0 || index >= profiles.length) {
                    throw this._createDataError(`Invalid profile index: ${index}`, optionsContext);
                }
                return profiles[index];
            }
            // From context
            const profile = this._getProfileFromContext(options, optionsContext);
            if (profile !== null) {
                return profile;
            }
        }
        // Default
        const {profileCurrent} = options;
        if (profileCurrent < 0 || profileCurrent >= profiles.length) {
            throw this._createDataError(`Invalid current profile index: ${profileCurrent}`, optionsContext);
        }
        return profiles[profileCurrent];
    }

    /**
     * @param {import('settings').Options} options
     * @param {import('settings').OptionsContext} optionsContext
     * @returns {?import('settings').Profile}
     */
    _getProfileFromContext(options, optionsContext) {
        const normalizedOptionsContext = this._profileConditionsUtil.normalizeContext(optionsContext);

        let index = 0;
        for (const profile of options.profiles) {
            const conditionGroups = profile.conditionGroups;

            let schema;
            if (index < this._profileConditionsSchemaCache.length) {
                schema = this._profileConditionsSchemaCache[index];
            } else {
                schema = this._profileConditionsUtil.createSchema(conditionGroups);
                this._profileConditionsSchemaCache.push(schema);
            }

            if (conditionGroups.length > 0 && schema.isValid(normalizedOptionsContext)) {
                return profile;
            }
            ++index;
        }

        return null;
    }

    /**
     * @param {string} message
     * @param {unknown} data
     * @returns {ExtensionError}
     */
    _createDataError(message, data) {
        const error = new ExtensionError(message);
        error.data = data;
        return error;
    }

    /**
     * @returns {void}
     */
    _clearProfileConditionsSchemaCache() {
        this._profileConditionsSchemaCache = [];
    }

    /**
     * @param {unknown} _ignore
     */
    _checkLastError(_ignore) {
        // NOP
    }

    /**
     * @param {string} command
     * @param {import('core').SerializableObject|undefined} params
     * @returns {boolean}
     */
    _runCommand(command, params) {
        const handler = this._commandHandlers.get(command);
        if (typeof handler !== 'function') { return false; }

        handler(params);
        return true;
    }

    /**
     * @param {string} text
     * @param {number} scanLength
     * @param {import('settings').OptionsContext} optionsContext
     * @returns {Promise<import('api').ParseTextLine[]>}
     */
    async _textParseScanning(text, scanLength, optionsContext) {
        const jp = this._japaneseUtil;
        /** @type {import('translator').FindTermsMode} */
        const mode = 'simple';
        const options = this._getProfileOptions(optionsContext, false);
        const details = {matchType: /** @type {import('translation').FindTermsMatchType} */ ('exact'), deinflect: true};
        const findTermsOptions = this._getTranslatorFindTermsOptions(mode, details, options);
        /** @type {import('api').ParseTextLine[]} */
        const results = [];
        let previousUngroupedSegment = null;
        let i = 0;
        const ii = text.length;
        while (i < ii) {
            const {dictionaryEntries, originalTextLength} = await this._translator.findTerms(
                mode,
                text.substring(i, i + scanLength),
                findTermsOptions
            );
            const codePoint = /** @type {number} */ (text.codePointAt(i));
            const character = String.fromCodePoint(codePoint);
            if (
                dictionaryEntries.length > 0 &&
                originalTextLength > 0 &&
                (originalTextLength !== character.length || jp.isCodePointJapanese(codePoint))
            ) {
                previousUngroupedSegment = null;
                const {headwords: [{term, reading}]} = dictionaryEntries[0];
                const source = text.substring(i, i + originalTextLength);
                const textSegments = [];
                for (const {text: text2, reading: reading2} of jp.distributeFuriganaInflected(term, reading, source)) {
                    textSegments.push({text: text2, reading: reading2});
                }
                results.push(textSegments);
                i += originalTextLength;
            } else {
                if (previousUngroupedSegment === null) {
                    previousUngroupedSegment = {text: character, reading: ''};
                    results.push([previousUngroupedSegment]);
                } else {
                    previousUngroupedSegment.text += character;
                }
                i += character.length;
            }
        }
        return results;
    }

    /**
     * @param {string} text
     * @returns {Promise<import('backend').MecabParseResults>}
     */
    async _textParseMecab(text) {
        const jp = this._japaneseUtil;

        let parseTextResults;
        try {
            parseTextResults = await this._mecab.parseText(text);
        } catch (e) {
            return [];
        }

        /** @type {import('backend').MecabParseResults} */
        const results = [];
        for (const {name, lines} of parseTextResults) {
            /** @type {import('api').ParseTextLine[]} */
            const result = [];
            for (const line of lines) {
                for (const {term, reading, source} of line) {
                    const termParts = [];
                    for (const {text: text2, reading: reading2} of jp.distributeFuriganaInflected(
                        term.length > 0 ? term : source,
                        jp.convertKatakanaToHiragana(reading),
                        source
                    )) {
                        termParts.push({text: text2, reading: reading2});
                    }
                    result.push(termParts);
                }
                result.push([{text: '\n', reading: ''}]);
            }
            results.push([name, result]);
        }
        return results;
    }

    /**
     * @param {chrome.runtime.Port} port
     * @param {chrome.runtime.MessageSender} sender
     * @param {import('backend').MessageHandlerWithProgressMap} handlers
     */
    _createActionListenerPort(port, sender, handlers) {
        let done = false;
        let hasStarted = false;
        /** @type {?string} */
        let messageString = '';

        /**
         * @param {...unknown} data
         */
        const onProgress = (...data) => {
            try {
                if (done) { return; }
                port.postMessage(/** @type {import('backend').InvokeWithProgressResponseProgressMessage} */ ({type: 'progress', data}));
            } catch (e) {
                // NOP
            }
        };

        /**
         * @param {import('backend').InvokeWithProgressRequestMessage} message
         */
        const onMessage = (message) => {
            if (hasStarted) { return; }

            try {
                const {action} = message;
                switch (action) {
                    case 'fragment':
                        messageString += message.data;
                        break;
                    case 'invoke':
                        if (messageString !== null) {
                            hasStarted = true;
                            port.onMessage.removeListener(onMessage);

                            /** @type {{action: string, params?: import('core').SerializableObject}} */
                            const messageData = parseJson(messageString);
                            messageString = null;
                            onMessageComplete(messageData);
                        }
                        break;
                }
            } catch (e) {
                cleanup(e);
            }
        };

        /**
         * @param {{action: string, params?: import('core').SerializableObject}} message
         */
        const onMessageComplete = async (message) => {
            try {
                const {action, params} = message;
                port.postMessage(/** @type {import('backend').InvokeWithProgressResponseAcknowledgeMessage} */ ({type: 'ack'}));

                const messageHandler = handlers.get(action);
                if (typeof messageHandler === 'undefined') {
                    throw new Error('Invalid action');
                }
                const {handler, async, contentScript} = messageHandler;

                if (!contentScript) {
                    this._validatePrivilegedMessageSender(sender);
                }

                const promiseOrResult = handler(params, sender, onProgress);
                const result = async ? await promiseOrResult : promiseOrResult;
                port.postMessage(/** @type {import('backend').InvokeWithProgressResponseCompleteMessage} */ ({type: 'complete', data: result}));
            } catch (e) {
                cleanup(e);
            }
        };

        const onDisconnect = () => {
            cleanup(null);
        };

        /**
         * @param {unknown} error
         */
        const cleanup = (error) => {
            if (done) { return; }
            if (error !== null) {
                port.postMessage(/** @type {import('backend').InvokeWithProgressResponseErrorMessage} */ ({type: 'error', data: ExtensionError.serialize(error)}));
            }
            if (!hasStarted) {
                port.onMessage.removeListener(onMessage);
            }
            port.onDisconnect.removeListener(onDisconnect);
            done = true;
        };

        port.onMessage.addListener(onMessage);
        port.onDisconnect.addListener(onDisconnect);
    }

    /**
     * @param {?import('log').LogLevel} errorLevel
     * @returns {number}
     */
    _getErrorLevelValue(errorLevel) {
        switch (errorLevel) {
            case 'info': return 0;
            case 'debug': return 0;
            case 'warn': return 1;
            case 'error': return 2;
            default: return 0;
        }
    }

    /**
     * @param {import('settings-modifications').OptionsScope} target
     * @returns {import('settings').Options|import('settings').ProfileOptions}
     * @throws {Error}
     */
    _getModifySettingObject(target) {
        const scope = target.scope;
        switch (scope) {
            case 'profile':
            {
                const {optionsContext} = target;
                if (typeof optionsContext !== 'object' || optionsContext === null) { throw new Error('Invalid optionsContext'); }
                return /** @type {import('settings').ProfileOptions} */ (this._getProfileOptions(optionsContext, true));
            }
            case 'global':
                return /** @type {import('settings').Options} */ (this._getOptionsFull(true));
            default:
                throw new Error(`Invalid scope: ${scope}`);
        }
    }

    /**
     * @param {import('settings-modifications').OptionsScope&import('settings-modifications').Read} target
     * @returns {unknown}
     * @throws {Error}
     */
    _getSetting(target) {
        const options = this._getModifySettingObject(target);
        const accessor = new ObjectPropertyAccessor(options);
        const {path} = target;
        if (typeof path !== 'string') { throw new Error('Invalid path'); }
        return accessor.get(ObjectPropertyAccessor.getPathArray(path));
    }

    /**
     * @param {import('settings-modifications').ScopedModification} target
     * @returns {import('settings-modifications').ModificationResult}
     * @throws {Error}
     */
    _modifySetting(target) {
        const options = this._getModifySettingObject(target);
        const accessor = new ObjectPropertyAccessor(options);
        const action = target.action;
        switch (action) {
            case 'set':
            {
                const {path, value} = target;
                if (typeof path !== 'string') { throw new Error('Invalid path'); }
                const pathArray = ObjectPropertyAccessor.getPathArray(path);
                accessor.set(pathArray, value);
                return accessor.get(pathArray);
            }
            case 'delete':
            {
                const {path} = target;
                if (typeof path !== 'string') { throw new Error('Invalid path'); }
                accessor.delete(ObjectPropertyAccessor.getPathArray(path));
                return true;
            }
            case 'swap':
            {
                const {path1, path2} = target;
                if (typeof path1 !== 'string') { throw new Error('Invalid path1'); }
                if (typeof path2 !== 'string') { throw new Error('Invalid path2'); }
                accessor.swap(ObjectPropertyAccessor.getPathArray(path1), ObjectPropertyAccessor.getPathArray(path2));
                return true;
            }
            case 'splice':
            {
                const {path, start, deleteCount, items} = target;
                if (typeof path !== 'string') { throw new Error('Invalid path'); }
                if (typeof start !== 'number' || Math.floor(start) !== start) { throw new Error('Invalid start'); }
                if (typeof deleteCount !== 'number' || Math.floor(deleteCount) !== deleteCount) { throw new Error('Invalid deleteCount'); }
                if (!Array.isArray(items)) { throw new Error('Invalid items'); }
                const array = accessor.get(ObjectPropertyAccessor.getPathArray(path));
                if (!Array.isArray(array)) { throw new Error('Invalid target type'); }
                return array.splice(start, deleteCount, ...items);
            }
            case 'push':
            {
                const {path, items} = target;
                if (typeof path !== 'string') { throw new Error('Invalid path'); }
                if (!Array.isArray(items)) { throw new Error('Invalid items'); }
                const array = accessor.get(ObjectPropertyAccessor.getPathArray(path));
                if (!Array.isArray(array)) { throw new Error('Invalid target type'); }
                const start = array.length;
                array.push(...items);
                return start;
            }
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    /**
     * @param {chrome.runtime.MessageSender} sender
     * @throws {Error}
     */
    _validatePrivilegedMessageSender(sender) {
        let {url} = sender;
        if (typeof url === 'string' && yomitan.isExtensionUrl(url)) { return; }
        const {tab} = sender;
        if (typeof tab === 'object' && tab !== null) {
            ({url} = tab);
            if (typeof url === 'string' && yomitan.isExtensionUrl(url)) { return; }
        }
        throw new Error('Invalid message sender');
    }

    /**
     * @returns {Promise<string>}
     */
    _getBrowserIconTitle() {
        return (
            isObject(chrome.action) &&
            typeof chrome.action.getTitle === 'function' ?
                new Promise((resolve) => chrome.action.getTitle({}, resolve)) :
                Promise.resolve('')
        );
    }

    /**
     * @returns {void}
     */
    _updateBadge() {
        let title = this._defaultBrowserActionTitle;
        if (title === null || !isObject(chrome.action)) {
            // Not ready or invalid
            return;
        }

        let text = '';
        let color = null;
        let status = null;

        if (this._logErrorLevel !== null) {
            switch (this._logErrorLevel) {
                case 'error':
                    text = '!!';
                    color = '#f04e4e';
                    status = 'Error';
                    break;
                default: // 'warn'
                    text = '!';
                    color = '#f0ad4e';
                    status = 'Warning';
                    break;
            }
        } else if (!this._isPrepared) {
            if (this._prepareError) {
                text = '!!';
                color = '#f04e4e';
                status = 'Error';
            } else if (this._badgePrepareDelayTimer === null) {
                text = '...';
                color = '#f0ad4e';
                status = 'Loading';
            }
        } else {
            const options = this._getProfileOptions({current: true}, false);
            if (!options.general.enable) {
                text = 'off';
                color = '#555555';
                status = 'Disabled';
            } else if (!this._hasRequiredPermissionsForSettings(options)) {
                text = '!';
                color = '#f0ad4e';
                status = 'Some settings require additional permissions';
            } else if (!this._isAnyDictionaryEnabled(options)) {
                text = '!';
                color = '#f0ad4e';
                status = 'No dictionaries installed';
            }
        }

        if (color !== null && typeof chrome.action.setBadgeBackgroundColor === 'function') {
            chrome.action.setBadgeBackgroundColor({color});
        }
        if (text !== null && typeof chrome.action.setBadgeText === 'function') {
            chrome.action.setBadgeText({text});
        }
        if (typeof chrome.action.setTitle === 'function') {
            if (status !== null) {
                title = `${title} - ${status}`;
            }
            chrome.action.setTitle({title});
        }
    }

    /**
     * @param {import('settings').ProfileOptions} options
     * @returns {boolean}
     */
    _isAnyDictionaryEnabled(options) {
        for (const {enabled} of options.dictionaries) {
            if (enabled) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param {number} tabId
     * @returns {Promise<?string>}
     */
    async _getTabUrl(tabId) {
        try {
            const response = await this._sendMessageTabPromise(
                tabId,
                {action: 'Yomitan.getUrl', params: {}},
                {frameId: 0}
            );
            const url = typeof response === 'object' && response !== null ? /** @type {import('core').SerializableObject} */ (response).url : void 0;
            if (typeof url === 'string') {
                return url;
            }
        } catch (e) {
            // NOP
        }
        return null;
    }

    /**
     * @returns {Promise<chrome.tabs.Tab[]>}
     */
    _getAllTabs() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({}, (tabs) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve(tabs);
                }
            });
        });
    }

    /**
     * @param {number} timeout
     * @param {boolean} multiple
     * @param {import('backend').FindTabsPredicate} predicate
     * @param {boolean} predicateIsAsync
     * @returns {Promise<import('backend').TabInfo[]|(?import('backend').TabInfo)>}
     */
    async _findTabs(timeout, multiple, predicate, predicateIsAsync) {
        // This function works around the need to have the "tabs" permission to access tab.url.
        const tabs = await this._getAllTabs();

        let done = false;
        /**
         * @param {chrome.tabs.Tab} tab
         * @param {(tabInfo: import('backend').TabInfo) => boolean} add
         */
        const checkTab = async (tab, add) => {
            const {id} = tab;
            const url = typeof id === 'number' ? await this._getTabUrl(id) : null;

            if (done) { return; }

            let okay = false;
            const item = {tab, url};
            try {
                const okayOrPromise = predicate(item);
                okay = predicateIsAsync ? await okayOrPromise : /** @type {boolean} */ (okayOrPromise);
            } catch (e) {
                // NOP
            }

            if (okay && !done) {
                if (add(item)) {
                    done = true;
                }
            }
        };

        if (multiple) {
            /** @type {import('backend').TabInfo[]} */
            const results = [];
            /**
             * @param {import('backend').TabInfo} value
             * @returns {boolean}
             */
            const add = (value) => {
                results.push(value);
                return false;
            };
            const checkTabPromises = tabs.map((tab) => checkTab(tab, add));
            await Promise.race([
                Promise.all(checkTabPromises),
                promiseTimeout(timeout)
            ]);
            return results;
        } else {
            const {promise, resolve} = /** @type {import('core').DeferredPromiseDetails<void>} */ (deferPromise());
            /** @type {?import('backend').TabInfo} */
            let result = null;
            /**
             * @param {import('backend').TabInfo} value
             * @returns {boolean}
             */
            const add = (value) => {
                result = value;
                resolve();
                return true;
            };
            const checkTabPromises = tabs.map((tab) => checkTab(tab, add));
            await Promise.race([
                promise,
                Promise.all(checkTabPromises),
                promiseTimeout(timeout)
            ]);
            resolve();
            return result;
        }
    }

    /**
     * @param {chrome.tabs.Tab} tab
     */
    async _focusTab(tab) {
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
            const {id} = tab;
            if (typeof id !== 'number') {
                reject(new Error('Cannot focus a tab without an id'));
                return;
            }
            chrome.tabs.update(id, {active: true}, () => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve();
                }
            });
        }));

        if (!(typeof chrome.windows === 'object' && chrome.windows !== null)) {
            // Windows not supported (e.g. on Firefox mobile)
            return;
        }

        try {
            const tabWindow = await new Promise((resolve, reject) => {
                chrome.windows.get(tab.windowId, {}, (value) => {
                    const e = chrome.runtime.lastError;
                    if (e) {
                        reject(new Error(e.message));
                    } else {
                        resolve(value);
                    }
                });
            });
            if (!tabWindow.focused) {
                await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
                    chrome.windows.update(tab.windowId, {focused: true}, () => {
                        const e = chrome.runtime.lastError;
                        if (e) {
                            reject(new Error(e.message));
                        } else {
                            resolve();
                        }
                    });
                }));
            }
        } catch (e) {
            // Edge throws exception for no reason here.
        }
    }

    /**
     * @param {number} tabId
     * @param {number} frameId
     * @param {?number} [timeout=null]
     * @returns {Promise<void>}
     */
    _waitUntilTabFrameIsReady(tabId, frameId, timeout = null) {
        return new Promise((resolve, reject) => {
            /** @type {?import('core').Timeout} */
            let timer = null;
            /** @type {?import('extension').ChromeRuntimeOnMessageCallback} */
            let onMessage = (message, sender) => {
                if (
                    !sender.tab ||
                    sender.tab.id !== tabId ||
                    sender.frameId !== frameId ||
                    !(typeof message === 'object' && message !== null) ||
                    /** @type {import('core').SerializableObject} */ (message).action !== 'yomitanReady'
                ) {
                    return;
                }

                cleanup();
                resolve();
            };
            const cleanup = () => {
                if (timer !== null) {
                    clearTimeout(timer);
                    timer = null;
                }
                if (onMessage !== null) {
                    chrome.runtime.onMessage.removeListener(onMessage);
                    onMessage = null;
                }
            };

            chrome.runtime.onMessage.addListener(onMessage);

            this._sendMessageTabPromise(tabId, {action: 'Yomitan.isReady'}, {frameId})
                .then(
                    (value) => {
                        if (!value) { return; }
                        cleanup();
                        resolve();
                    },
                    () => {} // NOP
                );

            if (timeout !== null) {
                timer = setTimeout(() => {
                    timer = null;
                    cleanup();
                    reject(new Error('Timeout'));
                }, timeout);
            }
        });
    }

    /**
     * @param {string} url
     * @returns {Promise<Response>}
     */
    async _fetchAsset(url) {
        const response = await fetch(chrome.runtime.getURL(url), {
            method: 'GET',
            mode: 'no-cors',
            cache: 'default',
            credentials: 'omit',
            redirect: 'follow',
            referrerPolicy: 'no-referrer'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }
        return response;
    }

    /**
     * @param {string} url
     * @returns {Promise<string>}
     */
    async _fetchText(url) {
        const response = await this._fetchAsset(url);
        return await response.text();
    }

    /**
     * @template [T=unknown]
     * @param {string} url
     * @returns {Promise<T>}
     */
    async _fetchJson(url) {
        const response = await this._fetchAsset(url);
        return await readResponseJson(response);
    }

    /**
     * @param {{action: string, params: import('core').SerializableObject}} message
     */
    _sendMessageIgnoreResponse(message) {
        const callback = () => this._checkLastError(chrome.runtime.lastError);
        chrome.runtime.sendMessage(message, callback);
    }

    /**
     * @param {number} tabId
     * @param {{action: string, params?: import('core').SerializableObject, frameId?: number}} message
     * @param {chrome.tabs.MessageSendOptions} options
     */
    _sendMessageTabIgnoreResponse(tabId, message, options) {
        const callback = () => this._checkLastError(chrome.runtime.lastError);
        chrome.tabs.sendMessage(tabId, message, options, callback);
    }

    /**
     * @param {string} action
     * @param {import('core').SerializableObject} params
     */
    _sendMessageAllTabsIgnoreResponse(action, params) {
        const callback = () => this._checkLastError(chrome.runtime.lastError);
        chrome.tabs.query({}, (tabs) => {
            for (const tab of tabs) {
                const {id} = tab;
                if (typeof id !== 'number') { continue; }
                chrome.tabs.sendMessage(id, {action, params}, callback);
            }
        });
    }

    /**
     * @param {number} tabId
     * @param {{action: string, params?: import('core').SerializableObject}} message
     * @param {chrome.tabs.MessageSendOptions} options
     * @returns {Promise<unknown>}
     */
    _sendMessageTabPromise(tabId, message, options) {
        return new Promise((resolve, reject) => {
            /**
             * @param {unknown} response
             */
            const callback = (response) => {
                try {
                    resolve(this._getMessageResponseResult(response));
                } catch (error) {
                    reject(error);
                }
            };

            chrome.tabs.sendMessage(tabId, message, options, callback);
        });
    }

    /**
     * @param {unknown} response
     * @returns {unknown}
     * @throws {Error}
     */
    _getMessageResponseResult(response) {
        const error = chrome.runtime.lastError;
        if (error) {
            throw new Error(error.message);
        }
        if (typeof response !== 'object' || response === null) {
            throw new Error('Tab did not respond');
        }
        const responseError = /** @type {import('core').SerializedError|undefined} */ (/** @type {import('core').SerializableObject} */ (response).error);
        if (typeof responseError === 'object' && responseError !== null) {
            throw ExtensionError.deserialize(responseError);
        }
        return /** @type {import('core').SerializableObject} */ (response).result;
    }

    /**
     * @param {number} tabId
     * @param {(url: ?string) => boolean} urlPredicate
     * @returns {Promise<?chrome.tabs.Tab>}
     */
    async _checkTabUrl(tabId, urlPredicate) {
        let tab;
        try {
            tab = await this._getTabById(tabId);
        } catch (e) {
            return null;
        }

        const url = await this._getTabUrl(tabId);
        const isValidTab = urlPredicate(url);
        return isValidTab ? tab : null;
    }

    /**
     * @param {number} tabId
     * @param {number} frameId
     * @param {'jpeg'|'png'} format
     * @param {number} quality
     * @returns {Promise<string>}
     */
    async _getScreenshot(tabId, frameId, format, quality) {
        const tab = await this._getTabById(tabId);
        const {windowId} = tab;

        let token = null;
        try {
            if (typeof tabId === 'number' && typeof frameId === 'number') {
                const action = 'Frontend.setAllVisibleOverride';
                const params = {value: false, priority: 0, awaitFrame: true};
                token = await this._sendMessageTabPromise(tabId, {action, params}, {frameId});
            }

            return await new Promise((resolve, reject) => {
                chrome.tabs.captureVisibleTab(windowId, {format, quality}, (result) => {
                    const e = chrome.runtime.lastError;
                    if (e) {
                        reject(new Error(e.message));
                    } else {
                        resolve(result);
                    }
                });
            });
        } finally {
            if (token !== null) {
                const action = 'Frontend.clearAllVisibleOverride';
                const params = {token};
                try {
                    await this._sendMessageTabPromise(tabId, {action, params}, {frameId});
                } catch (e) {
                    // NOP
                }
            }
        }
    }

    /**
     * @param {AnkiConnect} ankiConnect
     * @param {number} timestamp
     * @param {import('api').InjectAnkiNoteMediaDefinitionDetails} definitionDetails
     * @param {?import('api').InjectAnkiNoteMediaAudioDetails} audioDetails
     * @param {?import('api').InjectAnkiNoteMediaScreenshotDetails} screenshotDetails
     * @param {?import('api').InjectAnkiNoteMediaClipboardDetails} clipboardDetails
     * @param {import('api').InjectAnkiNoteMediaDictionaryMediaDetails[]} dictionaryMediaDetails
     * @returns {Promise<import('api').InjectAnkiNoteMediaResult>}
     */
    async _injectAnkNoteMedia(ankiConnect, timestamp, definitionDetails, audioDetails, screenshotDetails, clipboardDetails, dictionaryMediaDetails) {
        let screenshotFileName = null;
        let clipboardImageFileName = null;
        let clipboardText = null;
        let audioFileName = null;
        const errors = [];

        try {
            if (screenshotDetails !== null) {
                screenshotFileName = await this._injectAnkiNoteScreenshot(ankiConnect, timestamp, definitionDetails, screenshotDetails);
            }
        } catch (e) {
            errors.push(ExtensionError.serialize(e));
        }

        try {
            if (clipboardDetails !== null && clipboardDetails.image) {
                clipboardImageFileName = await this._injectAnkiNoteClipboardImage(ankiConnect, timestamp, definitionDetails);
            }
        } catch (e) {
            errors.push(ExtensionError.serialize(e));
        }

        try {
            if (clipboardDetails !== null && clipboardDetails.text) {
                clipboardText = await this._clipboardReader.getText(false);
            }
        } catch (e) {
            errors.push(ExtensionError.serialize(e));
        }

        try {
            if (audioDetails !== null) {
                audioFileName = await this._injectAnkiNoteAudio(ankiConnect, timestamp, definitionDetails, audioDetails);
            }
        } catch (e) {
            errors.push(ExtensionError.serialize(e));
        }

        /** @type {import('api').InjectAnkiNoteDictionaryMediaResult[]} */
        let dictionaryMedia;
        try {
            let errors2;
            ({results: dictionaryMedia, errors: errors2} = await this._injectAnkiNoteDictionaryMedia(ankiConnect, timestamp, definitionDetails, dictionaryMediaDetails));
            for (const error of errors2) {
                errors.push(ExtensionError.serialize(error));
            }
        } catch (e) {
            dictionaryMedia = [];
            errors.push(ExtensionError.serialize(e));
        }

        return {
            screenshotFileName,
            clipboardImageFileName,
            clipboardText,
            audioFileName,
            dictionaryMedia,
            errors: errors
        };
    }

    /**
     * @param {AnkiConnect} ankiConnect
     * @param {number} timestamp
     * @param {import('api').InjectAnkiNoteMediaDefinitionDetails} definitionDetails
     * @param {import('api').InjectAnkiNoteMediaAudioDetails} details
     * @returns {Promise<?string>}
     */
    async _injectAnkiNoteAudio(ankiConnect, timestamp, definitionDetails, details) {
        if (definitionDetails.type !== 'term') { return null; }
        const {term, reading} = definitionDetails;
        if (term.length === 0 && reading.length === 0) { return null; }

        const {sources, preferredAudioIndex, idleTimeout} = details;
        let data;
        let contentType;
        try {
            ({data, contentType} = await this._audioDownloader.downloadTermAudio(
                sources,
                preferredAudioIndex,
                term,
                reading,
                idleTimeout
            ));
        } catch (e) {
            const error = this._getAudioDownloadError(e);
            if (error !== null) { throw error; }
            // No audio
            return null;
        }

        let extension = contentType !== null ? MediaUtil.getFileExtensionFromAudioMediaType(contentType) : null;
        if (extension === null) { extension = '.mp3'; }
        let fileName = this._generateAnkiNoteMediaFileName('yomitan_audio', extension, timestamp, definitionDetails);
        fileName = fileName.replace(/\]/g, '');
        return await ankiConnect.storeMediaFile(fileName, data);
    }

    /**
     * @param {AnkiConnect} ankiConnect
     * @param {number} timestamp
     * @param {import('api').InjectAnkiNoteMediaDefinitionDetails} definitionDetails
     * @param {import('api').InjectAnkiNoteMediaScreenshotDetails} details
     * @returns {Promise<?string>}
     */
    async _injectAnkiNoteScreenshot(ankiConnect, timestamp, definitionDetails, details) {
        const {tabId, frameId, format, quality} = details;
        const dataUrl = await this._getScreenshot(tabId, frameId, format, quality);

        const {mediaType, data} = this._getDataUrlInfo(dataUrl);
        const extension = MediaUtil.getFileExtensionFromImageMediaType(mediaType);
        if (extension === null) {
            throw new Error('Unknown media type for screenshot image');
        }

        const fileName = this._generateAnkiNoteMediaFileName('yomitan_browser_screenshot', extension, timestamp, definitionDetails);
        return await ankiConnect.storeMediaFile(fileName, data);
    }

    /**
     * @param {AnkiConnect} ankiConnect
     * @param {number} timestamp
     * @param {import('api').InjectAnkiNoteMediaDefinitionDetails} definitionDetails
     * @returns {Promise<?string>}
     */
    async _injectAnkiNoteClipboardImage(ankiConnect, timestamp, definitionDetails) {
        const dataUrl = await this._clipboardReader.getImage();
        if (dataUrl === null) {
            return null;
        }

        const {mediaType, data} = this._getDataUrlInfo(dataUrl);
        const extension = MediaUtil.getFileExtensionFromImageMediaType(mediaType);
        if (extension === null) {
            throw new Error('Unknown media type for clipboard image');
        }

        const fileName = this._generateAnkiNoteMediaFileName('yomitan_clipboard_image', extension, timestamp, definitionDetails);
        return await ankiConnect.storeMediaFile(fileName, data);
    }

    /**
     * @param {AnkiConnect} ankiConnect
     * @param {number} timestamp
     * @param {import('api').InjectAnkiNoteMediaDefinitionDetails} definitionDetails
     * @param {import('api').InjectAnkiNoteMediaDictionaryMediaDetails[]} dictionaryMediaDetails
     * @returns {Promise<{results: import('api').InjectAnkiNoteDictionaryMediaResult[], errors: unknown[]}>}
     */
    async _injectAnkiNoteDictionaryMedia(ankiConnect, timestamp, definitionDetails, dictionaryMediaDetails) {
        const targets = [];
        const detailsList = [];
        const detailsMap = new Map();
        for (const {dictionary, path} of dictionaryMediaDetails) {
            const target = {dictionary, path};
            const details = {dictionary, path, media: null};
            const key = JSON.stringify(target);
            targets.push(target);
            detailsList.push(details);
            detailsMap.set(key, details);
        }
        const mediaList = await this._getNormalizedDictionaryDatabaseMedia(targets);

        for (const media of mediaList) {
            const {dictionary, path} = media;
            const key = JSON.stringify({dictionary, path});
            const details = detailsMap.get(key);
            if (typeof details === 'undefined' || details.media !== null) { continue; }
            details.media = media;
        }

        const errors = [];
        /** @type {import('api').InjectAnkiNoteDictionaryMediaResult[]} */
        const results = [];
        for (let i = 0, ii = detailsList.length; i < ii; ++i) {
            const {dictionary, path, media} = detailsList[i];
            let fileName = null;
            if (media !== null) {
                const {content, mediaType} = media;
                const extension = MediaUtil.getFileExtensionFromImageMediaType(mediaType);
                fileName = this._generateAnkiNoteMediaFileName(
                    `yomitan_dictionary_media_${i + 1}`,
                    extension !== null ? extension : '',
                    timestamp,
                    definitionDetails
                );
                try {
                    fileName = await ankiConnect.storeMediaFile(fileName, content);
                } catch (e) {
                    errors.push(e);
                    fileName = null;
                }
            }
            results.push({dictionary, path, fileName});
        }

        return {results, errors};
    }

    /**
     * @param {unknown} error
     * @returns {?ExtensionError}
     */
    _getAudioDownloadError(error) {
        if (error instanceof ExtensionError && typeof error.data === 'object' && error.data !== null) {
            const {errors} = /** @type {import('core').SerializableObject} */ (error.data);
            if (Array.isArray(errors)) {
                for (const errorDetail of errors) {
                    if (!(errorDetail instanceof Error)) { continue; }
                    if (errorDetail.name === 'AbortError') {
                        return this._createAudioDownloadError('Audio download was cancelled due to an idle timeout', 'audio-download-idle-timeout', errors);
                    }
                    if (!(errorDetail instanceof ExtensionError)) { continue; }
                    const {data} = errorDetail;
                    if (!(typeof data === 'object' && data !== null)) { continue; }
                    const {details} = /** @type {import('core').SerializableObject} */ (data);
                    if (!(typeof details === 'object' && details !== null)) { continue; }
                    const error3 = /** @type {import('core').SerializableObject} */ (details).error;
                    if (typeof error3 !== 'string') { continue; }
                    switch (error3) {
                        case 'net::ERR_FAILED':
                            // This is potentially an error due to the extension not having enough URL privileges.
                            // The message logged to the console looks like this:
                            //  Access to fetch at '<URL>' from origin 'chrome-extension://<ID>' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource. If an opaque response serves your needs, set the request's mode to 'no-cors' to fetch the resource with CORS disabled.
                            return this._createAudioDownloadError('Audio download failed due to possible extension permissions error', 'audio-download-failed-permissions-error', errors);
                        case 'net::ERR_CERT_DATE_INVALID': // Chrome
                        case 'Peer’s Certificate has expired.': // Firefox
                            // This error occurs when a server certificate expires.
                            return this._createAudioDownloadError('Audio download failed due to an expired server certificate', 'audio-download-failed-expired-server-certificate', errors);
                    }
                }
            }
        }
        return null;
    }

    /**
     * @param {string} message
     * @param {?string} issueId
     * @param {?(Error[])} errors
     * @returns {ExtensionError}
     */
    _createAudioDownloadError(message, issueId, errors) {
        const error = new ExtensionError(message);
        const hasErrors = Array.isArray(errors);
        const hasIssueId = (typeof issueId === 'string');
        if (hasErrors || hasIssueId) {
            /** @type {{errors?: import('core').SerializedError[], referenceUrl?: string}} */
            const data = {};
            error.data = {};
            if (hasErrors) {
                // Errors need to be serialized since they are passed to other frames
                data.errors = errors.map((e) => ExtensionError.serialize(e));
            }
            if (hasIssueId) {
                data.referenceUrl = `/issues.html#${issueId}`;
            }
        }
        return error;
    }

    /**
     * @param {string} prefix
     * @param {string} extension
     * @param {number} timestamp
     * @param {import('api').InjectAnkiNoteMediaDefinitionDetails} definitionDetails
     * @returns {string}
     */
    _generateAnkiNoteMediaFileName(prefix, extension, timestamp, definitionDetails) {
        let fileName = prefix;

        switch (definitionDetails.type) {
            case 'kanji':
                {
                    const {character} = definitionDetails;
                    if (character) { fileName += `_${character}`; }
                }
                break;
            default:
                {
                    const {reading, term} = definitionDetails;
                    if (reading) { fileName += `_${reading}`; }
                    if (term) { fileName += `_${term}`; }
                }
                break;
        }

        fileName += `_${this._ankNoteDateToString(new Date(timestamp))}`;
        fileName += extension;

        fileName = this._replaceInvalidFileNameCharacters(fileName);

        return fileName;
    }

    /**
     * @param {string} fileName
     * @returns {string}
     */
    _replaceInvalidFileNameCharacters(fileName) {
        // eslint-disable-next-line no-control-regex
        return fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
    }

    /**
     * @param {Date} date
     * @returns {string}
     */
    _ankNoteDateToString(date) {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth().toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        const seconds = date.getUTCSeconds().toString().padStart(2, '0');
        return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
    }

    /**
     * @param {string} dataUrl
     * @returns {{mediaType: string, data: string}}
     * @throws {Error}
     */
    _getDataUrlInfo(dataUrl) {
        const match = /^data:([^,]*?)(;base64)?,/.exec(dataUrl);
        if (match === null) {
            throw new Error('Invalid data URL');
        }

        let mediaType = match[1];
        if (mediaType.length === 0) { mediaType = 'text/plain'; }

        let data = dataUrl.substring(match[0].length);
        if (typeof match[2] === 'undefined') { data = btoa(data); }

        return {mediaType, data};
    }

    /**
     * @param {import('backend').DatabaseUpdateType} type
     * @param {import('backend').DatabaseUpdateCause} cause
     */
    _triggerDatabaseUpdated(type, cause) {
        this._translator.clearDatabaseCaches();
        this._sendMessageAllTabsIgnoreResponse('Yomitan.databaseUpdated', {type, cause});
    }

    /**
     * @param {string} source
     */
    async _saveOptions(source) {
        this._clearProfileConditionsSchemaCache();
        const options = this._getOptionsFull(false);
        await this._optionsUtil.save(options);
        this._applyOptions(source);
    }

    /**
     * Creates an options object for use with `Translator.findTerms`.
     * @param {import('translator').FindTermsMode} mode The display mode for the dictionary entries.
     * @param {import('api').FindTermsDetails} details Custom info for finding terms.
     * @param {import('settings').ProfileOptions} options The options.
     * @returns {import('translation').FindTermsOptions} An options object.
     */
    _getTranslatorFindTermsOptions(mode, details, options) {
        let {matchType, deinflect} = details;
        if (typeof matchType !== 'string') { matchType = /** @type {import('translation').FindTermsMatchType} */ ('exact'); }
        if (typeof deinflect !== 'boolean') { deinflect = true; }
        const enabledDictionaryMap = this._getTranslatorEnabledDictionaryMap(options);
        const {
            general: {mainDictionary, sortFrequencyDictionary, sortFrequencyDictionaryOrder},
            scanning: {alphanumeric},
            translation: {
                convertHalfWidthCharacters,
                convertNumericCharacters,
                convertAlphabeticCharacters,
                convertHiraganaToKatakana,
                convertKatakanaToHiragana,
                collapseEmphaticSequences,
                textReplacements: textReplacementsOptions
            }
        } = options;
        const textReplacements = this._getTranslatorTextReplacements(textReplacementsOptions);
        let excludeDictionaryDefinitions = null;
        if (mode === 'merge' && !enabledDictionaryMap.has(mainDictionary)) {
            enabledDictionaryMap.set(mainDictionary, {
                index: enabledDictionaryMap.size,
                priority: 0,
                allowSecondarySearches: false
            });
            excludeDictionaryDefinitions = new Set();
            excludeDictionaryDefinitions.add(mainDictionary);
        }
        return {
            matchType,
            deinflect,
            mainDictionary,
            sortFrequencyDictionary,
            sortFrequencyDictionaryOrder,
            removeNonJapaneseCharacters: !alphanumeric,
            convertHalfWidthCharacters,
            convertNumericCharacters,
            convertAlphabeticCharacters,
            convertHiraganaToKatakana,
            convertKatakanaToHiragana,
            collapseEmphaticSequences,
            textReplacements,
            enabledDictionaryMap,
            excludeDictionaryDefinitions
        };
    }

    /**
     * Creates an options object for use with `Translator.findKanji`.
     * @param {import('settings').ProfileOptions} options The options.
     * @returns {import('translation').FindKanjiOptions} An options object.
     */
    _getTranslatorFindKanjiOptions(options) {
        const enabledDictionaryMap = this._getTranslatorEnabledDictionaryMap(options);
        return {
            enabledDictionaryMap,
            removeNonJapaneseCharacters: !options.scanning.alphanumeric
        };
    }

    /**
     * @param {import('settings').ProfileOptions} options
     * @returns {Map<string, import('translation').FindTermDictionary>}
     */
    _getTranslatorEnabledDictionaryMap(options) {
        const enabledDictionaryMap = new Map();
        for (const dictionary of options.dictionaries) {
            if (!dictionary.enabled) { continue; }
            enabledDictionaryMap.set(dictionary.name, {
                index: enabledDictionaryMap.size,
                priority: dictionary.priority,
                allowSecondarySearches: dictionary.allowSecondarySearches
            });
        }
        return enabledDictionaryMap;
    }

    /**
     * @param {import('settings').TranslationTextReplacementOptions} textReplacementsOptions
     * @returns {(?(import('translation').FindTermsTextReplacement[]))[]}
     */
    _getTranslatorTextReplacements(textReplacementsOptions) {
        /** @type {(?(import('translation').FindTermsTextReplacement[]))[]} */
        const textReplacements = [];
        for (const group of textReplacementsOptions.groups) {
            /** @type {import('translation').FindTermsTextReplacement[]} */
            const textReplacementsEntries = [];
            for (const {pattern, ignoreCase, replacement} of group) {
                let patternRegExp;
                try {
                    patternRegExp = new RegExp(pattern, ignoreCase ? 'gi' : 'g');
                } catch (e) {
                    // Invalid pattern
                    continue;
                }
                textReplacementsEntries.push({pattern: patternRegExp, replacement});
            }
            if (textReplacementsEntries.length > 0) {
                textReplacements.push(textReplacementsEntries);
            }
        }
        if (textReplacements.length === 0 || textReplacementsOptions.searchOriginal) {
            textReplacements.unshift(null);
        }
        return textReplacements;
    }

    /**
     * @returns {Promise<void>}
     */
    async _openWelcomeGuidePageOnce() {
        chrome.storage.session.get(['openedWelcomePage']).then((result) => {
            if (!result.openedWelcomePage) {
                this._openWelcomeGuidePage();
                chrome.storage.session.set({'openedWelcomePage': true});
            }
        });
    }

    /**
     * @returns {Promise<void>}
     */
    async _openWelcomeGuidePage() {
        await this._createTab(chrome.runtime.getURL('/welcome.html'));
    }

    /**
     * @returns {Promise<void>}
     */
    async _openInfoPage() {
        await this._createTab(chrome.runtime.getURL('/info.html'));
    }

    /**
     * @param {'existingOrNewTab'|'newTab'} mode
     */
    async _openSettingsPage(mode) {
        const manifest = chrome.runtime.getManifest();
        const optionsUI = manifest.options_ui;
        if (typeof optionsUI === 'undefined') { throw new Error('Failed to find options_ui'); }
        const {page} = optionsUI;
        if (typeof page === 'undefined') { throw new Error('Failed to find options_ui.page'); }
        const url = chrome.runtime.getURL(page);
        switch (mode) {
            case 'existingOrNewTab':
                await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
                    chrome.runtime.openOptionsPage(() => {
                        const e = chrome.runtime.lastError;
                        if (e) {
                            reject(new Error(e.message));
                        } else {
                            resolve();
                        }
                    });
                }));
                break;
            case 'newTab':
                await this._createTab(url);
                break;
        }
    }

    /**
     * @param {string} url
     * @returns {Promise<chrome.tabs.Tab>}
     */
    _createTab(url) {
        return new Promise((resolve, reject) => {
            chrome.tabs.create({url}, (tab) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve(tab);
                }
            });
        });
    }

    /**
     * @param {number} tabId
     * @returns {Promise<chrome.tabs.Tab>}
     */
    _getTabById(tabId) {
        return new Promise((resolve, reject) => {
            chrome.tabs.get(
                tabId,
                (result) => {
                    const e = chrome.runtime.lastError;
                    if (e) {
                        reject(new Error(e.message));
                    } else {
                        resolve(result);
                    }
                }
            );
        });
    }

    /**
     * @returns {Promise<void>}
     */
    async _checkPermissions() {
        this._permissions = await this._permissionsUtil.getAllPermissions();
        this._updateBadge();
    }

    /**
     * @returns {boolean}
     */
    _canObservePermissionsChanges() {
        return isObject(chrome.permissions) && isObject(chrome.permissions.onAdded) && isObject(chrome.permissions.onRemoved);
    }

    /**
     * @param {import('settings').ProfileOptions} options
     * @returns {boolean}
     */
    _hasRequiredPermissionsForSettings(options) {
        if (!this._canObservePermissionsChanges()) { return true; }
        return this._permissions === null || this._permissionsUtil.hasRequiredPermissionsForOptions(this._permissions, options);
    }

    /**
     * @returns {Promise<void>}
     */
    async _requestPersistentStorage() {
        try {
            if (await navigator.storage.persisted()) { return; }

            // Only request this permission for Firefox versions >= 77.
            // https://bugzilla.mozilla.org/show_bug.cgi?id=1630413
            const {vendor, version} = await browser.runtime.getBrowserInfo();
            if (vendor !== 'Mozilla') { return; }

            const match = /^\d+/.exec(version);
            if (match === null) { return; }

            const versionNumber = Number.parseInt(match[0]);
            if (!(Number.isFinite(versionNumber) && versionNumber >= 77)) { return; }

            await navigator.storage.persist();
        } catch (e) {
            // NOP
        }
    }

    /**
     * @param {{path: string, dictionary: string}[]} targets
     * @returns {Promise<import('dictionary-database').MediaDataStringContent[]>}
     */
    async _getNormalizedDictionaryDatabaseMedia(targets) {
        const results = [];
        for (const item of await this._dictionaryDatabase.getMedia(targets)) {
            const {content, dictionary, height, mediaType, path, width} = item;
            const content2 = ArrayBufferUtil.arrayBufferToBase64(content);
            results.push({content: content2, dictionary, height, mediaType, path, width});
        }
        return results;
    }

    /**
     * @param {unknown} mode
     * @param {'existingOrNewTab'|'newTab'} defaultValue
     * @returns {'existingOrNewTab'|'newTab'}
     */
    _normalizeOpenSettingsPageMode(mode, defaultValue) {
        switch (mode) {
            case 'existingOrNewTab':
            case 'newTab':
                return mode;
            default:
                return defaultValue;
        }
    }
}
