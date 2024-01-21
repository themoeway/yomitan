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

import {ExtensionError} from '../core/extension-error.js';

export class API {
    /**
     * @param {import('../extension/web-extension.js').WebExtension} webExtension
     */
    constructor(webExtension) {
        /** @type {import('../extension/web-extension.js').WebExtension} */
        this._webExtension = webExtension;
    }

    /**
     * @param {import('api').ApiParam<'optionsGet', 'optionsContext'>} optionsContext
     * @returns {Promise<import('api').ApiReturn<'optionsGet'>>}
     */
    optionsGet(optionsContext) {
        return this._invoke('optionsGet', {optionsContext});
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'optionsGetFull'>>}
     */
    optionsGetFull() {
        return this._invoke('optionsGetFull', void 0);
    }

    /**
     * @param {import('api').ApiParam<'termsFind', 'text'>} text
     * @param {import('api').ApiParam<'termsFind', 'details'>} details
     * @param {import('api').ApiParam<'termsFind', 'optionsContext'>} optionsContext
     * @returns {Promise<import('api').ApiReturn<'termsFind'>>}
     */
    termsFind(text, details, optionsContext) {
        return this._invoke('termsFind', {text, details, optionsContext});
    }

    /**
     * @param {import('api').ApiParam<'parseText', 'text'>} text
     * @param {import('api').ApiParam<'parseText', 'optionsContext'>} optionsContext
     * @param {import('api').ApiParam<'parseText', 'scanLength'>} scanLength
     * @param {import('api').ApiParam<'parseText', 'useInternalParser'>} useInternalParser
     * @param {import('api').ApiParam<'parseText', 'useMecabParser'>} useMecabParser
     * @returns {Promise<import('api').ApiReturn<'parseText'>>}
     */
    parseText(text, optionsContext, scanLength, useInternalParser, useMecabParser) {
        return this._invoke('parseText', {text, optionsContext, scanLength, useInternalParser, useMecabParser});
    }

    /**
     * @param {import('api').ApiParam<'kanjiFind', 'text'>} text
     * @param {import('api').ApiParam<'kanjiFind', 'optionsContext'>} optionsContext
     * @returns {Promise<import('api').ApiReturn<'kanjiFind'>>}
     */
    kanjiFind(text, optionsContext) {
        return this._invoke('kanjiFind', {text, optionsContext});
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'isAnkiConnected'>>}
     */
    isAnkiConnected() {
        return this._invoke('isAnkiConnected', void 0);
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'getAnkiConnectVersion'>>}
     */
    getAnkiConnectVersion() {
        return this._invoke('getAnkiConnectVersion', void 0);
    }

    /**
     * @param {import('api').ApiParam<'addAnkiNote', 'note'>} note
     * @returns {Promise<import('api').ApiReturn<'addAnkiNote'>>}
     */
    addAnkiNote(note) {
        return this._invoke('addAnkiNote', {note});
    }

    /**
     * @param {import('api').ApiParam<'getAnkiNoteInfo', 'notes'>} notes
     * @param {import('api').ApiParam<'getAnkiNoteInfo', 'fetchAdditionalInfo'>} fetchAdditionalInfo
     * @returns {Promise<import('api').ApiReturn<'getAnkiNoteInfo'>>}
     */
    getAnkiNoteInfo(notes, fetchAdditionalInfo) {
        return this._invoke('getAnkiNoteInfo', {notes, fetchAdditionalInfo});
    }

    /**
     * @param {import('api').ApiParam<'injectAnkiNoteMedia', 'timestamp'>} timestamp
     * @param {import('api').ApiParam<'injectAnkiNoteMedia', 'definitionDetails'>} definitionDetails
     * @param {import('api').ApiParam<'injectAnkiNoteMedia', 'audioDetails'>} audioDetails
     * @param {import('api').ApiParam<'injectAnkiNoteMedia', 'screenshotDetails'>} screenshotDetails
     * @param {import('api').ApiParam<'injectAnkiNoteMedia', 'clipboardDetails'>} clipboardDetails
     * @param {import('api').ApiParam<'injectAnkiNoteMedia', 'dictionaryMediaDetails'>} dictionaryMediaDetails
     * @returns {Promise<import('api').ApiReturn<'injectAnkiNoteMedia'>>}
     */
    injectAnkiNoteMedia(timestamp, definitionDetails, audioDetails, screenshotDetails, clipboardDetails, dictionaryMediaDetails) {
        return this._invoke('injectAnkiNoteMedia', {timestamp, definitionDetails, audioDetails, screenshotDetails, clipboardDetails, dictionaryMediaDetails});
    }

    /**
     * @param {import('api').ApiParam<'noteView', 'noteId'>} noteId
     * @param {import('api').ApiParam<'noteView', 'mode'>} mode
     * @param {import('api').ApiParam<'noteView', 'allowFallback'>} allowFallback
     * @returns {Promise<import('api').ApiReturn<'noteView'>>}
     */
    noteView(noteId, mode, allowFallback) {
        return this._invoke('noteView', {noteId, mode, allowFallback});
    }

    /**
     * @param {import('api').ApiParam<'suspendAnkiCardsForNote', 'noteId'>} noteId
     * @returns {Promise<import('api').ApiReturn<'suspendAnkiCardsForNote'>>}
     */
    suspendAnkiCardsForNote(noteId) {
        return this._invoke('suspendAnkiCardsForNote', {noteId});
    }

    /**
     * @param {import('api').ApiParam<'getTermAudioInfoList', 'source'>} source
     * @param {import('api').ApiParam<'getTermAudioInfoList', 'term'>} term
     * @param {import('api').ApiParam<'getTermAudioInfoList', 'reading'>} reading
     * @returns {Promise<import('api').ApiReturn<'getTermAudioInfoList'>>}
     */
    getTermAudioInfoList(source, term, reading) {
        return this._invoke('getTermAudioInfoList', {source, term, reading});
    }

    /**
     * @param {import('api').ApiParam<'commandExec', 'command'>} command
     * @param {import('api').ApiParam<'commandExec', 'params'>} [params]
     * @returns {Promise<import('api').ApiReturn<'commandExec'>>}
     */
    commandExec(command, params) {
        return this._invoke('commandExec', {command, params});
    }

    /**
     * @param {import('api').ApiParam<'sendMessageToFrame', 'frameId'>} frameId
     * @param {import('api').ApiParam<'sendMessageToFrame', 'message'>} message
     * @returns {Promise<import('api').ApiReturn<'sendMessageToFrame'>>}
     */
    sendMessageToFrame(frameId, message) {
        return this._invoke('sendMessageToFrame', {frameId, message});
    }

    /**
     * @param {import('api').ApiParam<'broadcastTab', 'message'>} message
     * @returns {Promise<import('api').ApiReturn<'broadcastTab'>>}
     */
    broadcastTab(message) {
        return this._invoke('broadcastTab', {message});
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'frameInformationGet'>>}
     */
    frameInformationGet() {
        return this._invoke('frameInformationGet', void 0);
    }

    /**
     * @param {import('api').ApiParam<'injectStylesheet', 'type'>} type
     * @param {import('api').ApiParam<'injectStylesheet', 'value'>} value
     * @returns {Promise<import('api').ApiReturn<'injectStylesheet'>>}
     */
    injectStylesheet(type, value) {
        return this._invoke('injectStylesheet', {type, value});
    }

    /**
     * @param {import('api').ApiParam<'getStylesheetContent', 'url'>} url
     * @returns {Promise<import('api').ApiReturn<'getStylesheetContent'>>}
     */
    getStylesheetContent(url) {
        return this._invoke('getStylesheetContent', {url});
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'getEnvironmentInfo'>>}
     */
    getEnvironmentInfo() {
        return this._invoke('getEnvironmentInfo', void 0);
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'clipboardGet'>>}
     */
    clipboardGet() {
        return this._invoke('clipboardGet', void 0);
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'getDisplayTemplatesHtml'>>}
     */
    getDisplayTemplatesHtml() {
        return this._invoke('getDisplayTemplatesHtml', void 0);
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'getZoom'>>}
     */
    getZoom() {
        return this._invoke('getZoom', void 0);
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'getDefaultAnkiFieldTemplates'>>}
     */
    getDefaultAnkiFieldTemplates() {
        return this._invoke('getDefaultAnkiFieldTemplates', void 0);
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'getDictionaryInfo'>>}
     */
    getDictionaryInfo() {
        return this._invoke('getDictionaryInfo', void 0);
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'purgeDatabase'>>}
     */
    purgeDatabase() {
        return this._invoke('purgeDatabase', void 0);
    }

    /**
     * @param {import('api').ApiParam<'getMedia', 'targets'>} targets
     * @returns {Promise<import('api').ApiReturn<'getMedia'>>}
     */
    getMedia(targets) {
        return this._invoke('getMedia', {targets});
    }

    /**
     * @param {import('api').ApiParam<'log', 'error'>} error
     * @param {import('api').ApiParam<'log', 'level'>} level
     * @param {import('api').ApiParam<'log', 'context'>} context
     * @returns {Promise<import('api').ApiReturn<'log'>>}
     */
    log(error, level, context) {
        return this._invoke('log', {error, level, context});
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'logIndicatorClear'>>}
     */
    logIndicatorClear() {
        return this._invoke('logIndicatorClear', void 0);
    }

    /**
     * @param {import('api').ApiParam<'modifySettings', 'targets'>} targets
     * @param {import('api').ApiParam<'modifySettings', 'source'>} source
     * @returns {Promise<import('api').ApiReturn<'modifySettings'>>}
     */
    modifySettings(targets, source) {
        return this._invoke('modifySettings', {targets, source});
    }

    /**
     * @param {import('api').ApiParam<'getSettings', 'targets'>} targets
     * @returns {Promise<import('api').ApiReturn<'getSettings'>>}
     */
    getSettings(targets) {
        return this._invoke('getSettings', {targets});
    }

    /**
     * @param {import('api').ApiParam<'setAllSettings', 'value'>} value
     * @param {import('api').ApiParam<'setAllSettings', 'source'>} source
     * @returns {Promise<import('api').ApiReturn<'setAllSettings'>>}
     */
    setAllSettings(value, source) {
        return this._invoke('setAllSettings', {value, source});
    }

    /**
     * @param {import('api').ApiParams<'getOrCreateSearchPopup'>} details
     * @returns {Promise<import('api').ApiReturn<'getOrCreateSearchPopup'>>}
     */
    getOrCreateSearchPopup(details) {
        return this._invoke('getOrCreateSearchPopup', details);
    }

    /**
     * @param {import('api').ApiParam<'isTabSearchPopup', 'tabId'>} tabId
     * @returns {Promise<import('api').ApiReturn<'isTabSearchPopup'>>}
     */
    isTabSearchPopup(tabId) {
        return this._invoke('isTabSearchPopup', {tabId});
    }

    /**
     * @param {import('api').ApiParam<'triggerDatabaseUpdated', 'type'>} type
     * @param {import('api').ApiParam<'triggerDatabaseUpdated', 'cause'>} cause
     * @returns {Promise<import('api').ApiReturn<'triggerDatabaseUpdated'>>}
     */
    triggerDatabaseUpdated(type, cause) {
        return this._invoke('triggerDatabaseUpdated', {type, cause});
    }

    /**
     * @returns {Promise<import('api').ApiReturn<'testMecab'>>}
     */
    testMecab() {
        return this._invoke('testMecab', void 0);
    }

    /**
     * @param {import('api').ApiParam<'textHasJapaneseCharacters', 'text'>} text
     * @returns {Promise<import('api').ApiReturn<'textHasJapaneseCharacters'>>}
     */
    textHasJapaneseCharacters(text) {
        return this._invoke('textHasJapaneseCharacters', {text});
    }

    /**
     * @param {import('api').ApiParam<'getTermFrequencies', 'termReadingList'>} termReadingList
     * @param {import('api').ApiParam<'getTermFrequencies', 'dictionaries'>} dictionaries
     * @returns {Promise<import('api').ApiReturn<'getTermFrequencies'>>}
     */
    getTermFrequencies(termReadingList, dictionaries) {
        return this._invoke('getTermFrequencies', {termReadingList, dictionaries});
    }

    /**
     * @param {import('api').ApiParam<'findAnkiNotes', 'query'>} query
     * @returns {Promise<import('api').ApiReturn<'findAnkiNotes'>>}
     */
    findAnkiNotes(query) {
        return this._invoke('findAnkiNotes', {query});
    }

    /**
     * @param {import('api').ApiParam<'openCrossFramePort', 'targetTabId'>} targetTabId
     * @param {import('api').ApiParam<'openCrossFramePort', 'targetFrameId'>} targetFrameId
     * @returns {Promise<import('api').ApiReturn<'openCrossFramePort'>>}
     */
    openCrossFramePort(targetTabId, targetFrameId) {
        return this._invoke('openCrossFramePort', {targetTabId, targetFrameId});
    }

    // Utilities

    /**
     * @template {import('api').ApiNames} TAction
     * @template {import('api').ApiParams<TAction>} TParams
     * @param {TAction} action
     * @param {TParams} params
     * @returns {Promise<import('api').ApiReturn<TAction>>}
     */
    _invoke(action, params) {
        /** @type {import('api').ApiMessage<TAction>} */
        const data = {action, params};
        return new Promise((resolve, reject) => {
            try {
                this._webExtension.sendMessage(data, (response) => {
                    this._webExtension.getLastError();
                    if (response !== null && typeof response === 'object') {
                        const {error} = /** @type {import('core').UnknownObject} */ (response);
                        if (typeof error !== 'undefined') {
                            reject(ExtensionError.deserialize(/** @type {import('core').SerializedError} */ (error)));
                        } else {
                            const {result} = /** @type {import('core').UnknownObject} */ (response);
                            resolve(/** @type {import('api').ApiReturn<TAction>} */ (result));
                        }
                    } else {
                        const message = response === null ? 'Unexpected null response' : `Unexpected response of type ${typeof response}`;
                        reject(new Error(`${message} (${JSON.stringify(data)})`));
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}
