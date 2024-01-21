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
import {parseJson} from '../core/json.js';
import {AnkiUtil} from '../data/anki-util.js';

/**
 * This class controls communication with Anki via the AnkiConnect plugin.
 */
export class AnkiConnect {
    /**
     * Creates a new instance.
     */
    constructor() {
        /** @type {boolean} */
        this._enabled = false;
        /** @type {?string} */
        this._server = null;
        /** @type {number} */
        this._localVersion = 2;
        /** @type {number} */
        this._remoteVersion = 0;
        /** @type {?Promise<number>} */
        this._versionCheckPromise = null;
        /** @type {?string} */
        this._apiKey = null;
    }

    /**
     * Gets the URL of the AnkiConnect server.
     * @type {?string}
     */
    get server() {
        return this._server;
    }

    /**
     * Assigns the URL of the AnkiConnect server.
     * @param {string} value The new server URL to assign.
     */
    set server(value) {
        this._server = value;
    }

    /**
     * Gets whether or not server communication is enabled.
     * @type {boolean}
     */
    get enabled() {
        return this._enabled;
    }

    /**
     * Sets whether or not server communication is enabled.
     * @param {boolean} value The enabled state.
     */
    set enabled(value) {
        this._enabled = value;
    }

    /**
     * Gets the API key used when connecting to AnkiConnect.
     * The value will be `null` if no API key is used.
     * @type {?string}
     */
    get apiKey() {
        return this._apiKey;
    }

    /**
     * Sets the API key used when connecting to AnkiConnect.
     * @param {?string} value The API key to use, or `null` if no API key should be used.
     */
    set apiKey(value) {
        this._apiKey = value;
    }

    /**
     * Checks whether a connection to AnkiConnect can be established.
     * @returns {Promise<boolean>} `true` if the connection was made, `false` otherwise.
     */
    async isConnected() {
        try {
            await this._getVersion();
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Gets the AnkiConnect API version number.
     * @returns {Promise<?number>} The version number
     */
    async getVersion() {
        if (!this._enabled) { return null; }
        await this._checkVersion();
        return await this._getVersion();
    }

    /**
     * @param {import('anki').Note} note
     * @returns {Promise<?import('anki').NoteId>}
     */
    async addNote(note) {
        if (!this._enabled) { return null; }
        await this._checkVersion();
        const result = await this._invoke('addNote', {note});
        if (result !== null && typeof result !== 'number') {
            throw this._createUnexpectedResultError('number|null', result);
        }
        return result;
    }

    /**
     * @param {import('anki').Note[]} notes
     * @returns {Promise<boolean[]>}
     */
    async canAddNotes(notes) {
        if (!this._enabled) { return []; }
        await this._checkVersion();
        const result = await this._invoke('canAddNotes', {notes});
        return this._normalizeArray(result, notes.length, 'boolean');
    }

    /**
     * @param {import('anki').NoteId[]} noteIds
     * @returns {Promise<(?import('anki').NoteInfo)[]>}
     */
    async notesInfo(noteIds) {
        if (!this._enabled) { return []; }
        await this._checkVersion();
        const result = await this._invoke('notesInfo', {notes: noteIds});
        return this._normalizeNoteInfoArray(result);
    }

    /**
     * @returns {Promise<string[]>}
     */
    async getDeckNames() {
        if (!this._enabled) { return []; }
        await this._checkVersion();
        const result = await this._invoke('deckNames', {});
        return this._normalizeArray(result, -1, 'string');
    }

    /**
     * @returns {Promise<string[]>}
     */
    async getModelNames() {
        if (!this._enabled) { return []; }
        await this._checkVersion();
        const result = await this._invoke('modelNames', {});
        return this._normalizeArray(result, -1, 'string');
    }

    /**
     * @param {string} modelName
     * @returns {Promise<string[]>}
     */
    async getModelFieldNames(modelName) {
        if (!this._enabled) { return []; }
        await this._checkVersion();
        const result = await this._invoke('modelFieldNames', {modelName});
        return this._normalizeArray(result, -1, 'string');
    }

    /**
     * @param {string} query
     * @returns {Promise<import('anki').CardId[]>}
     */
    async guiBrowse(query) {
        if (!this._enabled) { return []; }
        await this._checkVersion();
        const result = await this._invoke('guiBrowse', {query});
        return this._normalizeArray(result, -1, 'number');
    }

    /**
     * @param {import('anki').NoteId} noteId
     * @returns {Promise<import('anki').CardId[]>}
     */
    async guiBrowseNote(noteId) {
        return await this.guiBrowse(`nid:${noteId}`);
    }

    /**
     * Opens the note editor GUI.
     * @param {import('anki').NoteId} noteId The ID of the note.
     * @returns {Promise<void>} Nothing is returned.
     */
    async guiEditNote(noteId) {
        await this._invoke('guiEditNote', {note: noteId});
    }

    /**
     * Stores a file with the specified base64-encoded content inside Anki's media folder.
     * @param {string} fileName The name of the file.
     * @param {string} content The base64-encoded content of the file.
     * @returns {Promise<?string>} The actual file name used to store the file, which may be different; or `null` if the file was not stored.
     * @throws {Error} An error is thrown is this object is not enabled.
     */
    async storeMediaFile(fileName, content) {
        if (!this._enabled) {
            throw new Error('AnkiConnect not enabled');
        }
        await this._checkVersion();
        const result = await this._invoke('storeMediaFile', {filename: fileName, data: content});
        if (result !== null && typeof result !== 'string') {
            throw this._createUnexpectedResultError('string|null', result);
        }
        return result;
    }

    /**
     * Finds notes matching a query.
     * @param {string} query Searches for notes matching a query.
     * @returns {Promise<import('anki').NoteId[]>} An array of note IDs.
     * @see https://docs.ankiweb.net/searching.html
     */
    async findNotes(query) {
        if (!this._enabled) { return []; }
        await this._checkVersion();
        const result = await this._invoke('findNotes', {query});
        return this._normalizeArray(result, -1, 'number');
    }

    /**
     * @param {import('anki').Note[]} notes
     * @returns {Promise<import('anki').NoteId[][]>}
     */
    async findNoteIds(notes) {
        if (!this._enabled) { return []; }
        await this._checkVersion();

        const actions = [];
        const actionsTargetsList = [];
        /** @type {Map<string, import('anki').NoteId[][]>} */
        const actionsTargetsMap = new Map();
        /** @type {import('anki').NoteId[][]} */
        const allNoteIds = [];

        for (const note of notes) {
            const query = this._getNoteQuery(note);
            let actionsTargets = actionsTargetsMap.get(query);
            if (typeof actionsTargets === 'undefined') {
                actionsTargets = [];
                actionsTargetsList.push(actionsTargets);
                actionsTargetsMap.set(query, actionsTargets);
                actions.push({action: 'findNotes', params: {query}});
            }
            /** @type {import('anki').NoteId[]} */
            const noteIds = [];
            allNoteIds.push(noteIds);
            actionsTargets.push(noteIds);
        }

        const result = await this._invokeMulti(actions);
        for (let i = 0, ii = Math.min(result.length, actionsTargetsList.length); i < ii; ++i) {
            const noteIds = /** @type {number[]} */ (this._normalizeArray(result[i], -1, 'number'));
            for (const actionsTargets of actionsTargetsList[i]) {
                for (const noteId of noteIds) {
                    actionsTargets.push(noteId);
                }
            }
        }
        return allNoteIds;
    }

    /**
     * @param {import('anki').CardId[]} cardIds
     * @returns {Promise<boolean>}
     */
    async suspendCards(cardIds) {
        if (!this._enabled) { return false; }
        await this._checkVersion();
        const result = await this._invoke('suspend', {cards: cardIds});
        return typeof result === 'boolean' && result;
    }

    /**
     * @param {string} query
     * @returns {Promise<import('anki').CardId[]>}
     */
    async findCards(query) {
        if (!this._enabled) { return []; }
        await this._checkVersion();
        const result = await this._invoke('findCards', {query});
        return this._normalizeArray(result, -1, 'number');
    }

    /**
     * @param {import('anki').NoteId} noteId
     * @returns {Promise<import('anki').CardId[]>}
     */
    async findCardsForNote(noteId) {
        return await this.findCards(`nid:${noteId}`);
    }

    /**
     * Gets information about the AnkiConnect APIs available.
     * @param {string[]} scopes A list of scopes to get information about.
     * @param {?string[]} actions A list of actions to check for
     * @returns {Promise<import('anki').ApiReflectResult>} Information about the APIs.
     */
    async apiReflect(scopes, actions = null) {
        const result = await this._invoke('apiReflect', {scopes, actions});
        if (!(typeof result === 'object' && result !== null)) {
            throw this._createUnexpectedResultError('object', result);
        }
        const {scopes: resultScopes, actions: resultActions} = /** @type {import('core').SerializableObject} */ (result);
        const resultScopes2 = /** @type {string[]} */ (this._normalizeArray(resultScopes, -1, 'string', ', field scopes'));
        const resultActions2 = /** @type {string[]} */ (this._normalizeArray(resultActions, -1, 'string', ', field scopes'));
        return {
            scopes: resultScopes2,
            actions: resultActions2
        };
    }

    /**
     * Checks whether a specific API action exists.
     * @param {string} action The action to check for.
     * @returns {Promise<boolean>} Whether or not the action exists.
     */
    async apiExists(action) {
        const {actions} = await this.apiReflect(['actions'], [action]);
        return actions.includes(action);
    }

    /**
     * Checks if a specific error object corresponds to an unsupported action.
     * @param {Error} error An error object generated by an API call.
     * @returns {boolean} Whether or not the error indicates the action is not supported.
     */
    isErrorUnsupportedAction(error) {
        if (error instanceof ExtensionError) {
            const {data} = error;
            if (typeof data === 'object' && data !== null && /** @type {import('core').SerializableObject} */ (data).apiError === 'unsupported action') {
                return true;
            }
        }
        return false;
    }

    // Private

    /**
     * @returns {Promise<void>}
     */
    async _checkVersion() {
        if (this._remoteVersion < this._localVersion) {
            if (this._versionCheckPromise === null) {
                const promise = this._getVersion();
                promise
                    .catch(() => {})
                    .finally(() => { this._versionCheckPromise = null; });
                this._versionCheckPromise = promise;
            }
            this._remoteVersion = await this._versionCheckPromise;
            if (this._remoteVersion < this._localVersion) {
                throw new Error('Extension and plugin versions incompatible');
            }
        }
    }

    /**
     * @param {string} action
     * @param {import('core').SerializableObject} params
     * @returns {Promise<unknown>}
     */
    async _invoke(action, params) {
        /** @type {import('anki').MessageBody} */
        const body = {action, params, version: this._localVersion};
        if (this._apiKey !== null) { body.key = this._apiKey; }
        let response;
        try {
            if (this._server === null) { throw new Error('Server URL is null'); }
            response = await fetch(this._server, {
                method: 'POST',
                mode: 'cors',
                cache: 'default',
                credentials: 'omit',
                headers: {
                    'Content-Type': 'application/json'
                },
                redirect: 'follow',
                referrerPolicy: 'no-referrer',
                body: JSON.stringify(body)
            });
        } catch (e) {
            const error = new ExtensionError('Anki connection failure');
            error.data = {action, params, originalError: e};
            throw error;
        }

        if (!response.ok) {
            const error = new ExtensionError(`Anki connection error: ${response.status}`);
            error.data = {action, params, status: response.status};
            throw error;
        }

        let responseText = null;
        /** @type {unknown} */
        let result;
        try {
            responseText = await response.text();
            result = parseJson(responseText);
        } catch (e) {
            const error = new ExtensionError('Invalid Anki response');
            error.data = {action, params, status: response.status, responseText, originalError: e};
            throw error;
        }

        if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
            const apiError = /** @type {import('core').SerializableObject} */ (result).error;
            if (typeof apiError !== 'undefined') {
                const error = new ExtensionError(`Anki error: ${apiError}`);
                error.data = {action, params, status: response.status, apiError: typeof apiError === 'string' ? apiError : `${apiError}`};
                throw error;
            }
        }

        return result;
    }

    /**
     * @param {{action: string, params: import('core').SerializableObject}[]} actions
     * @returns {Promise<unknown[]>}
     */
    async _invokeMulti(actions) {
        const result = await this._invoke('multi', {actions});
        if (!Array.isArray(result)) {
            throw this._createUnexpectedResultError('array', result);
        }
        return result;
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    _escapeQuery(text) {
        return text.replace(/"/g, '');
    }

    /**
     * @param {import('anki').NoteFields} fields
     * @returns {string}
     */
    _fieldsToQuery(fields) {
        const fieldNames = Object.keys(fields);
        if (fieldNames.length === 0) {
            return '';
        }

        const key = fieldNames[0];
        return `"${key.toLowerCase()}:${this._escapeQuery(fields[key])}"`;
    }

    /**
     * @param {import('anki').Note} note
     * @returns {?('collection'|'deck'|'deck-root')}
     */
    _getDuplicateScopeFromNote(note) {
        const {options} = note;
        if (typeof options === 'object' && options !== null) {
            const {duplicateScope} = options;
            if (typeof duplicateScope !== 'undefined') {
                return duplicateScope;
            }
        }
        return null;
    }

    /**
     * @param {import('anki').Note} note
     * @returns {string}
     */
    _getNoteQuery(note) {
        let query = '';
        switch (this._getDuplicateScopeFromNote(note)) {
            case 'deck':
                query = `"deck:${this._escapeQuery(note.deckName)}" `;
                break;
            case 'deck-root':
                query = `"deck:${this._escapeQuery(AnkiUtil.getRootDeckName(note.deckName))}" `;
                break;
        }
        query += this._fieldsToQuery(note.fields);
        return query;
    }

    /**
     * @returns {Promise<number>}
     */
    async _getVersion() {
        const version = await this._invoke('version', {});
        return typeof version === 'number' ? version : 0;
    }

    /**
     * @param {string} message
     * @param {unknown} data
     * @returns {ExtensionError}
     */
    _createError(message, data) {
        const error = new ExtensionError(message);
        error.data = data;
        return error;
    }

    /**
     * @param {string} expectedType
     * @param {unknown} result
     * @param {string} [context]
     * @returns {ExtensionError}
     */
    _createUnexpectedResultError(expectedType, result, context) {
        return this._createError(`Unexpected type${typeof context === 'string' ? context : ''}: expected ${expectedType}, received ${this._getTypeName(result)}`, result);
    }

    /**
     * @param {unknown} value
     * @returns {string}
     */
    _getTypeName(value) {
        if (value === null) { return 'null'; }
        return Array.isArray(value) ? 'array' : typeof value;
    }

    /**
     * @template [T=unknown]
     * @param {unknown} result
     * @param {number} expectedCount
     * @param {'boolean'|'string'|'number'} type
     * @param {string} [context]
     * @returns {T[]}
     * @throws {Error}
     */
    _normalizeArray(result, expectedCount, type, context) {
        if (!Array.isArray(result)) {
            throw this._createUnexpectedResultError(`${type}[]`, result, context);
        }
        if (expectedCount < 0) {
            expectedCount = result.length;
        } else if (expectedCount !== result.length) {
            throw this._createError(`Unexpected result array size${context}: expected ${expectedCount}, received ${result.length}`, result);
        }
        for (let i = 0; i < expectedCount; ++i) {
            const item = /** @type {unknown} */ (result[i]);
            if (typeof item !== type) {
                throw this._createError(`Unexpected result type at index ${i}${context}: expected ${type}, received ${this._getTypeName(item)}`, result);
            }
        }
        return /** @type {T[]} */ (result);
    }

    /**
     * @param {unknown} result
     * @returns {(?import('anki').NoteInfo)[]}
     * @throws {Error}
     */
    _normalizeNoteInfoArray(result) {
        if (!Array.isArray(result)) {
            throw this._createUnexpectedResultError('array', result, '');
        }
        /** @type {(?import('anki').NoteInfo)[]} */
        const result2 = [];
        for (let i = 0, ii = result.length; i < ii; ++i) {
            const item = /** @type {unknown} */ (result[i]);
            if (item === null || typeof item !== 'object') {
                throw this._createError(`Unexpected result type at index ${i}: expected Notes.NoteInfo, received ${this._getTypeName(item)}`, result);
            }
            const {noteId} = /** @type {{[key: string]: unknown}} */ (item);
            if (typeof noteId !== 'number') {
                result2.push(null);
                continue;
            }

            const {tags, fields, modelName, cards} = /** @type {{[key: string]: unknown}} */ (item);
            if (typeof modelName !== 'string') {
                throw this._createError(`Unexpected result type at index ${i}, field modelName: expected string, received ${this._getTypeName(modelName)}`, result);
            }
            if (typeof fields !== 'object' || fields === null) {
                throw this._createError(`Unexpected result type at index ${i}, field fields: expected string, received ${this._getTypeName(fields)}`, result);
            }
            const tags2 = /** @type {string[]} */ (this._normalizeArray(tags, -1, 'string', ', field tags'));
            const cards2 = /** @type {number[]} */ (this._normalizeArray(cards, -1, 'number', ', field cards'));
            /** @type {{[key: string]: import('anki').NoteFieldInfo}} */
            const fields2 = {};
            for (const [key, fieldInfo] of Object.entries(fields)) {
                if (typeof fieldInfo !== 'object' || fieldInfo === null) { continue; }
                const {value, order} = fieldInfo;
                if (typeof value !== 'string' || typeof order !== 'number') { continue; }
                fields2[key] = {value, order};
            }
            /** @type {import('anki').NoteInfo} */
            const item2 = {
                noteId,
                tags: tags2,
                fields: fields2,
                modelName,
                cards: cards2
            };
            result2.push(item2);
        }
        return result2;
    }
}
