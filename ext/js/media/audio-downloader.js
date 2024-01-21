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

import {RequestBuilder} from '../background/request-builder.js';
import {ExtensionError} from '../core/extension-error.js';
import {readResponseJson} from '../core/json.js';
import {JsonSchema} from '../data/json-schema.js';
import {ArrayBufferUtil} from '../data/sandbox/array-buffer-util.js';
import {NativeSimpleDOMParser} from '../dom/native-simple-dom-parser.js';
import {SimpleDOMParser} from '../dom/simple-dom-parser.js';

export class AudioDownloader {
    /**
     * @param {{japaneseUtil: import('../language/sandbox/japanese-util.js').JapaneseUtil, requestBuilder: RequestBuilder}} details
     */
    constructor({japaneseUtil, requestBuilder}) {
        /** @type {import('../language/sandbox/japanese-util.js').JapaneseUtil} */
        this._japaneseUtil = japaneseUtil;
        /** @type {RequestBuilder} */
        this._requestBuilder = requestBuilder;
        /** @type {?JsonSchema} */
        this._customAudioListSchema = null;
        /** @type {Map<import('settings').AudioSourceType, import('audio-downloader').GetInfoHandler>} */
        this._getInfoHandlers = new Map(/** @type {[name: import('settings').AudioSourceType, handler: import('audio-downloader').GetInfoHandler][]} */ ([
            ['jpod101', this._getInfoJpod101.bind(this)],
            ['jpod101-alternate', this._getInfoJpod101Alternate.bind(this)],
            ['jisho', this._getInfoJisho.bind(this)],
            ['text-to-speech', this._getInfoTextToSpeech.bind(this)],
            ['text-to-speech-reading', this._getInfoTextToSpeechReading.bind(this)],
            ['custom', this._getInfoCustom.bind(this)],
            ['custom-json', this._getInfoCustomJson.bind(this)]
        ]));
    }

    /**
     * @param {import('audio').AudioSourceInfo} source
     * @param {string} term
     * @param {string} reading
     * @returns {Promise<import('audio-downloader').Info[]>}
     */
    async getTermAudioInfoList(source, term, reading) {
        const handler = this._getInfoHandlers.get(source.type);
        if (typeof handler === 'function') {
            try {
                return await handler(term, reading, source);
            } catch (e) {
                // NOP
            }
        }
        return [];
    }

    /**
     * @param {import('audio').AudioSourceInfo[]} sources
     * @param {?number} preferredAudioIndex
     * @param {string} term
     * @param {string} reading
     * @param {?number} idleTimeout
     * @returns {Promise<import('audio-downloader').AudioBinaryBase64>}
     */
    async downloadTermAudio(sources, preferredAudioIndex, term, reading, idleTimeout) {
        const errors = [];
        for (const source of sources) {
            let infoList = await this.getTermAudioInfoList(source, term, reading);
            if (typeof preferredAudioIndex === 'number') {
                infoList = (preferredAudioIndex >= 0 && preferredAudioIndex < infoList.length ? [infoList[preferredAudioIndex]] : []);
            }
            for (const info of infoList) {
                switch (info.type) {
                    case 'url':
                        try {
                            return await this._downloadAudioFromUrl(info.url, source.type, idleTimeout);
                        } catch (e) {
                            errors.push(e);
                        }
                        break;
                }
            }
        }

        const error = new ExtensionError('Could not download audio');
        error.data = {errors};
        throw error;
    }

    // Private

    /**
     * @param {string} url
     * @param {string} base
     * @returns {string}
     */
    _normalizeUrl(url, base) {
        return new URL(url, base).href;
    }

    /** @type {import('audio-downloader').GetInfoHandler} */
    async _getInfoJpod101(term, reading) {
        if (reading === term && this._japaneseUtil.isStringEntirelyKana(term)) {
            reading = term;
            term = '';
        }

        const params = new URLSearchParams();
        if (term.length > 0) {
            params.set('kanji', term);
        }
        if (reading.length > 0) {
            params.set('kana', reading);
        }

        const url = `https://assets.languagepod101.com/dictionary/japanese/audiomp3.php?${params.toString()}`;
        return [{type: 'url', url}];
    }

    /** @type {import('audio-downloader').GetInfoHandler} */
    async _getInfoJpod101Alternate(term, reading) {
        const fetchUrl = 'https://www.japanesepod101.com/learningcenter/reference/dictionary_post';
        const data = new URLSearchParams({
            post: 'dictionary_reference',
            match_type: 'exact',
            search_query: term,
            vulgar: 'true'
        });
        const response = await this._requestBuilder.fetchAnonymous(fetchUrl, {
            method: 'POST',
            mode: 'cors',
            cache: 'default',
            credentials: 'omit',
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: data
        });
        const responseText = await response.text();

        const dom = this._createSimpleDOMParser(responseText);
        for (const row of dom.getElementsByClassName('dc-result-row')) {
            try {
                const audio = dom.getElementByTagName('audio', row);
                if (audio === null) { continue; }

                const source = dom.getElementByTagName('source', audio);
                if (source === null) { continue; }

                let url = dom.getAttribute(source, 'src');
                if (url === null) { continue; }

                const htmlReadings = dom.getElementsByClassName('dc-vocab_kana');
                if (htmlReadings.length === 0) { continue; }

                const htmlReading = dom.getTextContent(htmlReadings[0]);
                if (htmlReading && (reading === term || reading === htmlReading)) {
                    url = this._normalizeUrl(url, response.url);
                    return [{type: 'url', url}];
                }
            } catch (e) {
                // NOP
            }
        }

        throw new Error('Failed to find audio URL');
    }

    /** @type {import('audio-downloader').GetInfoHandler} */
    async _getInfoJisho(term, reading) {
        const fetchUrl = `https://jisho.org/search/${term}`;
        const response = await this._requestBuilder.fetchAnonymous(fetchUrl, {
            method: 'GET',
            mode: 'cors',
            cache: 'default',
            credentials: 'omit',
            redirect: 'follow',
            referrerPolicy: 'no-referrer'
        });
        const responseText = await response.text();

        const dom = this._createSimpleDOMParser(responseText);
        try {
            const audio = dom.getElementById(`audio_${term}:${reading}`);
            if (audio !== null) {
                const source = dom.getElementByTagName('source', audio);
                if (source !== null) {
                    let url = dom.getAttribute(source, 'src');
                    if (url !== null) {
                        url = this._normalizeUrl(url, response.url);
                        return [{type: 'url', url}];
                    }
                }
            }
        } catch (e) {
            // NOP
        }

        throw new Error('Failed to find audio URL');
    }

    /** @type {import('audio-downloader').GetInfoHandler} */
    async _getInfoTextToSpeech(term, reading, details) {
        if (typeof details !== 'object' || details === null) {
            throw new Error('Invalid arguments');
        }
        const {voice} = details;
        if (typeof voice !== 'string') {
            throw new Error('Invalid voice');
        }
        return [{type: 'tts', text: term, voice: voice}];
    }

    /** @type {import('audio-downloader').GetInfoHandler} */
    async _getInfoTextToSpeechReading(term, reading, details) {
        if (typeof details !== 'object' || details === null) {
            throw new Error('Invalid arguments');
        }
        const {voice} = details;
        if (typeof voice !== 'string') {
            throw new Error('Invalid voice');
        }
        return [{type: 'tts', text: reading, voice: voice}];
    }

    /** @type {import('audio-downloader').GetInfoHandler} */
    async _getInfoCustom(term, reading, details) {
        if (typeof details !== 'object' || details === null) {
            throw new Error('Invalid arguments');
        }
        let {url} = details;
        if (typeof url !== 'string') {
            throw new Error('Invalid url');
        }
        url = this._getCustomUrl(term, reading, url);
        return [{type: 'url', url}];
    }

    /** @type {import('audio-downloader').GetInfoHandler} */
    async _getInfoCustomJson(term, reading, details) {
        if (typeof details !== 'object' || details === null) {
            throw new Error('Invalid arguments');
        }
        let {url} = details;
        if (typeof url !== 'string') {
            throw new Error('Invalid url');
        }
        url = this._getCustomUrl(term, reading, url);

        const response = await this._requestBuilder.fetchAnonymous(url, {
            method: 'GET',
            mode: 'cors',
            cache: 'default',
            credentials: 'omit',
            redirect: 'follow',
            referrerPolicy: 'no-referrer'
        });

        if (!response.ok) {
            throw new Error(`Invalid response: ${response.status}`);
        }

        /** @type {import('audio-downloader').CustomAudioList} */
        const responseJson = await readResponseJson(response);

        if (this._customAudioListSchema === null) {
            const schema = await this._getCustomAudioListSchema();
            this._customAudioListSchema = new JsonSchema(/** @type {import('ext/json-schema').Schema} */ (schema));
        }
        this._customAudioListSchema.validate(responseJson);

        /** @type {import('audio-downloader').Info[]} */
        const results = [];
        for (const {url: url2, name} of responseJson.audioSources) {
            /** @type {import('audio-downloader').Info1} */
            const info = {type: 'url', url: url2};
            if (typeof name === 'string') { info.name = name; }
            results.push(info);
        }
        return results;
    }

    /**
     * @param {string} term
     * @param {string} reading
     * @param {string} url
     * @returns {string}
     * @throws {Error}
     */
    _getCustomUrl(term, reading, url) {
        if (typeof url !== 'string') {
            throw new Error('No custom URL defined');
        }
        const data = {term, reading};
        return url.replace(/\{([^}]*)\}/g, (m0, m1) => (Object.prototype.hasOwnProperty.call(data, m1) ? `${data[/** @type {'term'|'reading'} */ (m1)]}` : m0));
    }

    /**
     * @param {string} url
     * @param {import('settings').AudioSourceType} sourceType
     * @param {?number} idleTimeout
     * @returns {Promise<import('audio-downloader').AudioBinaryBase64>}
     */
    async _downloadAudioFromUrl(url, sourceType, idleTimeout) {
        let signal;
        /** @type {?import('request-builder.js').ProgressCallback} */
        let onProgress = null;
        /** @type {?import('core').Timeout} */
        let idleTimer = null;
        if (typeof idleTimeout === 'number') {
            const abortController = new AbortController();
            ({signal} = abortController);
            const onIdleTimeout = () => {
                abortController.abort('Idle timeout');
            };
            onProgress = (done) => {
                if (idleTimer !== null) {
                    clearTimeout(idleTimer);
                }
                idleTimer = done ? null : setTimeout(onIdleTimeout, idleTimeout);
            };
            idleTimer = setTimeout(onIdleTimeout, idleTimeout);
        }

        const response = await this._requestBuilder.fetchAnonymous(url, {
            method: 'GET',
            mode: 'cors',
            cache: 'default',
            credentials: 'omit',
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            signal
        });

        if (!response.ok) {
            throw new Error(`Invalid response: ${response.status}`);
        }

        const arrayBuffer = await RequestBuilder.readFetchResponseArrayBuffer(response, onProgress);

        if (idleTimer !== null) {
            clearTimeout(idleTimer);
        }

        if (!await this._isAudioBinaryValid(arrayBuffer, sourceType)) {
            throw new Error('Could not retrieve audio');
        }

        const data = ArrayBufferUtil.arrayBufferToBase64(arrayBuffer);
        const contentType = response.headers.get('Content-Type');
        return {data, contentType};
    }

    /**
     * @param {ArrayBuffer} arrayBuffer
     * @param {import('settings').AudioSourceType} sourceType
     * @returns {Promise<boolean>}
     */
    async _isAudioBinaryValid(arrayBuffer, sourceType) {
        switch (sourceType) {
            case 'jpod101':
            {
                const digest = await this._arrayBufferDigest(arrayBuffer);
                switch (digest) {
                    case 'ae6398b5a27bc8c0a771df6c907ade794be15518174773c58c7c7ddd17098906': // Invalid audio
                        return false;
                    default:
                        return true;
                }
            }
            default:
                return true;
        }
    }

    /**
     * @param {ArrayBuffer} arrayBuffer
     * @returns {Promise<string>}
     */
    async _arrayBufferDigest(arrayBuffer) {
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(arrayBuffer)));
        let digest = '';
        for (const byte of hash) {
            digest += byte.toString(16).padStart(2, '0');
        }
        return digest;
    }

    /**
     * @param {string} content
     * @returns {import('simple-dom-parser').ISimpleDomParser}
     * @throws {Error}
     */
    _createSimpleDOMParser(content) {
        if (typeof NativeSimpleDOMParser !== 'undefined' && NativeSimpleDOMParser.isSupported()) {
            return new NativeSimpleDOMParser(content);
        } else if (typeof SimpleDOMParser !== 'undefined' && SimpleDOMParser.isSupported()) {
            return new SimpleDOMParser(content);
        } else {
            throw new Error('DOM parsing not supported');
        }
    }

    /**
     * @returns {Promise<unknown>}
     */
    async _getCustomAudioListSchema() {
        const url = chrome.runtime.getURL('/data/schemas/custom-audio-list-schema.json');
        const response = await fetch(url, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'default',
            credentials: 'omit',
            redirect: 'follow',
            referrerPolicy: 'no-referrer'
        });
        return await readResponseJson(response);
    }
}
