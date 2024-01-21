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

export class TextToSpeechAudio {
    /**
     * @param {string} text
     * @param {SpeechSynthesisVoice} voice
     */
    constructor(text, voice) {
        /** @type {string} */
        this._text = text;
        /** @type {SpeechSynthesisVoice} */
        this._voice = voice;
        /** @type {?SpeechSynthesisUtterance} */
        this._utterance = null;
        /** @type {number} */
        this._volume = 1;
    }

    /** @type {number} */
    get currentTime() {
        return 0;
    }

    set currentTime(value) {
        // NOP
    }

    /** @type {number} */
    get volume() {
        return this._volume;
    }

    set volume(value) {
        this._volume = value;
        if (this._utterance !== null) {
            this._utterance.volume = value;
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async play() {
        try {
            if (this._utterance === null) {
                this._utterance = new SpeechSynthesisUtterance(typeof this._text === 'string' ? this._text : '');
                this._utterance.lang = 'ja-JP';
                this._utterance.volume = this._volume;
                this._utterance.voice = this._voice;
            }

            speechSynthesis.cancel();
            speechSynthesis.speak(this._utterance);
        } catch (e) {
            // NOP
        }
    }

    /**
     * @returns {void}
     */
    pause() {
        try {
            speechSynthesis.cancel();
        } catch (e) {
            // NOP
        }
    }
}
