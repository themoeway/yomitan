/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2019-2022  Yomichan Authors
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

import {EventDispatcher} from '../core/event-dispatcher.js';
import {TextToSpeechAudio} from './text-to-speech-audio.js';

/**
 * @augments EventDispatcher<import('audio-system').Events>
 */
export class AudioSystem extends EventDispatcher {
    constructor() {
        super();
        /** @type {?HTMLAudioElement} */
        this._fallbackAudio = null;
    }

    /**
     * @returns {void}
     */
    prepare() {
        // speechSynthesis.getVoices() will not be populated unless some API call is made.
        if (
            typeof speechSynthesis !== 'undefined' &&
            typeof speechSynthesis.addEventListener === 'function'
        ) {
            speechSynthesis.addEventListener('voiceschanged', this._onVoicesChanged.bind(this), false);
        }
    }

    /**
     * @returns {HTMLAudioElement}
     */
    getFallbackAudio() {
        if (this._fallbackAudio === null) {
            this._fallbackAudio = new Audio('/data/audio/button.mp3');
        }
        return this._fallbackAudio;
    }

    /**
     * @param {string} url
     * @param {import('settings').AudioSourceType} sourceType
     * @returns {Promise<HTMLAudioElement>}
     */
    async createAudio(url, sourceType) {
        const audio = new Audio(url);
        await this._waitForData(audio);
        if (!this._isAudioValid(audio, sourceType)) {
            throw new Error('Could not retrieve audio');
        }
        return audio;
    }

    /**
     * @param {string} text
     * @param {string} voiceUri
     * @returns {TextToSpeechAudio}
     * @throws {Error}
     */
    createTextToSpeechAudio(text, voiceUri) {
        const voice = this._getTextToSpeechVoiceFromVoiceUri(voiceUri);
        if (voice === null) {
            throw new Error('Invalid text-to-speech voice');
        }
        return new TextToSpeechAudio(text, voice);
    }

    // Private

    /**
     * @param {Event} event
     */
    _onVoicesChanged(event) {
        this.trigger('voiceschanged', event);
    }

    /**
     * @param {HTMLAudioElement} audio
     * @returns {Promise<void>}
     */
    _waitForData(audio) {
        return new Promise((resolve, reject) => {
            audio.addEventListener('loadeddata', () => resolve());
            audio.addEventListener('error', () => reject(audio.error));
        });
    }

    /**
     * @param {HTMLAudioElement} audio
     * @param {import('settings').AudioSourceType} sourceType
     * @returns {boolean}
     */
    _isAudioValid(audio, sourceType) {
        switch (sourceType) {
            case 'jpod101':
            {
                const duration = audio.duration;
                return (
                    duration !== 5.694694 && // Invalid audio (Chrome)
                    duration !== 5.651111 // Invalid audio (Firefox)
                );
            }
            default:
                return true;
        }
    }

    /**
     * @param {string} voiceUri
     * @returns {?SpeechSynthesisVoice}
     */
    _getTextToSpeechVoiceFromVoiceUri(voiceUri) {
        try {
            for (const voice of speechSynthesis.getVoices()) {
                if (voice.voiceURI === voiceUri) {
                    return voice;
                }
            }
        } catch (e) {
            // NOP
        }
        return null;
    }
}
