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

import {ClipboardReader} from '../comm/clipboard-reader.js';
import {createApiMap, invokeApiMapHandler} from '../core/api-map.js';
import {arrayBufferToBase64} from '../data/sandbox/array-buffer-util.js';
import {DictionaryDatabase} from '../dictionary/dictionary-database.js';
import {Translator} from '../language/translator.js';

/**
 * This class controls the core logic of the extension, including API calls
 * and various forms of communication between browser tabs and external applications.
 */
export class Offscreen {
    /**
     * Creates a new instance.
     */
    constructor() {
        /** @type {DictionaryDatabase} */
        this._dictionaryDatabase = new DictionaryDatabase();
        /** @type {Translator} */
        this._translator = new Translator({
            database: this._dictionaryDatabase
        });
        /** @type {ClipboardReader} */
        this._clipboardReader = new ClipboardReader({
            document: (typeof document === 'object' && document !== null ? document : null),
            pasteTargetSelector: '#clipboard-paste-target',
            richContentPasteTargetSelector: '#clipboard-rich-content-paste-target'
        });


        /* eslint-disable @stylistic/no-multi-spaces */
        /** @type {import('offscreen').ApiMap} */
        this._apiMap = createApiMap([
            ['clipboardGetTextOffscreen',        this._getTextHandler.bind(this)],
            ['clipboardGetImageOffscreen',       this._getImageHandler.bind(this)],
            ['clipboardSetBrowserOffscreen',     this._setClipboardBrowser.bind(this)],
            ['databasePrepareOffscreen',         this._prepareDatabaseHandler.bind(this)],
            ['getDictionaryInfoOffscreen',       this._getDictionaryInfoHandler.bind(this)],
            ['databasePurgeOffscreen',           this._purgeDatabaseHandler.bind(this)],
            ['databaseGetMediaOffscreen',        this._getMediaHandler.bind(this)],
            ['databaseGetMediaObjectsOffscreen', this._getMediaObjectsHandler.bind(this)],
            ['translatorPrepareOffscreen',       this._prepareTranslatorHandler.bind(this)],
            ['findKanjiOffscreen',               this._findKanjiHandler.bind(this)],
            ['findTermsOffscreen',               this._findTermsHandler.bind(this)],
            ['getTermFrequenciesOffscreen',      this._getTermFrequenciesHandler.bind(this)],
            ['clearDatabaseCachesOffscreen',     this._clearDatabaseCachesHandler.bind(this)]
        ]);
        /* eslint-enable @stylistic/no-multi-spaces */

        /** @type {?Promise<void>} */
        this._prepareDatabasePromise = null;
    }

    /** */
    prepare() {
        chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    }

    /** @type {import('offscreen').ApiHandler<'clipboardGetTextOffscreen'>} */
    async _getTextHandler({useRichText}) {
        return await this._clipboardReader.getText(useRichText);
    }

    /** @type {import('offscreen').ApiHandler<'clipboardGetImageOffscreen'>} */
    async _getImageHandler() {
        return await this._clipboardReader.getImage();
    }

    /** @type {import('offscreen').ApiHandler<'clipboardSetBrowserOffscreen'>} */
    _setClipboardBrowser({value}) {
        this._clipboardReader.browser = value;
    }

    /** @type {import('offscreen').ApiHandler<'databasePrepareOffscreen'>} */
    _prepareDatabaseHandler() {
        if (this._prepareDatabasePromise !== null) {
            return this._prepareDatabasePromise;
        }
        this._prepareDatabasePromise = this._dictionaryDatabase.prepare();
        return this._prepareDatabasePromise;
    }

    /** @type {import('offscreen').ApiHandler<'getDictionaryInfoOffscreen'>} */
    async _getDictionaryInfoHandler() {
        return await this._dictionaryDatabase.getDictionaryInfo();
    }

    /** @type {import('offscreen').ApiHandler<'databasePurgeOffscreen'>} */
    async _purgeDatabaseHandler() {
        return await this._dictionaryDatabase.purge();
    }

    /** @type {import('offscreen').ApiHandler<'databaseGetMediaOffscreen'>} */
    async _getMediaHandler({targets}) {
        const media = await this._dictionaryDatabase.getMedia(targets);
        return media.map((m) => ({...m, content: arrayBufferToBase64(m.content)}));
    }

    /** @type {import('offscreen').ApiHandler<'databaseGetMediaObjectsOffscreen'>} */
    async _getMediaObjectsHandler({targets}) {
        return await this._dictionaryDatabase.getMediaObjects(targets);
    }

    /** @type {import('offscreen').ApiHandler<'translatorPrepareOffscreen'>} */
    _prepareTranslatorHandler({descriptor}) {
        this._translator.prepare(descriptor);
    }

    /** @type {import('offscreen').ApiHandler<'findKanjiOffscreen'>} */
    async _findKanjiHandler({text, options}) {
        /** @type {import('translation').FindKanjiOptions} */
        const modifiedOptions = {
            ...options,
            enabledDictionaryMap: new Map(options.enabledDictionaryMap)
        };
        return await this._translator.findKanji(text, modifiedOptions);
    }

    /** @type {import('offscreen').ApiHandler<'findTermsOffscreen'>} */
    async _findTermsHandler({mode, text, options}) {
        const enabledDictionaryMap = new Map(options.enabledDictionaryMap);
        const excludeDictionaryDefinitions = (
            options.excludeDictionaryDefinitions !== null ?
            new Set(options.excludeDictionaryDefinitions) :
            null
        );
        const textReplacements = options.textReplacements.map((group) => {
            if (group === null) { return null; }
            return group.map((opt) => {
                // https://stackoverflow.com/a/33642463
                const match = opt.pattern.match(/\/(.*?)\/([a-z]*)?$/i);
                const [, pattern, flags] = match !== null ? match : ['', '', ''];
                return {...opt, pattern: new RegExp(pattern, flags ?? '')};
            });
        });
        /** @type {import('translation').FindTermsOptions} */
        const modifiedOptions = {
            ...options,
            enabledDictionaryMap,
            excludeDictionaryDefinitions,
            textReplacements
        };
        return this._translator.findTerms(mode, text, modifiedOptions);
    }

    /** @type {import('offscreen').ApiHandler<'getTermFrequenciesOffscreen'>} */
    _getTermFrequenciesHandler({termReadingList, dictionaries}) {
        return this._translator.getTermFrequencies(termReadingList, dictionaries);
    }

    /** @type {import('offscreen').ApiHandler<'clearDatabaseCachesOffscreen'>} */
    _clearDatabaseCachesHandler() {
        this._translator.clearDatabaseCaches();
    }

    /** @type {import('extension').ChromeRuntimeOnMessageCallback<import('offscreen').ApiMessageAny>} */
    _onMessage({action, params}, _sender, callback) {
        return invokeApiMapHandler(this._apiMap, action, params, [], callback);
    }
}
