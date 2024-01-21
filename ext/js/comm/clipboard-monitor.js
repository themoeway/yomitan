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

import {EventDispatcher} from '../core/event-dispatcher.js';

/**
 * @augments EventDispatcher<import('clipboard-monitor').Events>
 */
export class ClipboardMonitor extends EventDispatcher {
    /**
     * @param {{japaneseUtil: import('../language/sandbox/japanese-util.js').JapaneseUtil, clipboardReader: import('clipboard-monitor').ClipboardReaderLike}} details
     */
    constructor({japaneseUtil, clipboardReader}) {
        super();
        /** @type {import('../language/sandbox/japanese-util.js').JapaneseUtil} */
        this._japaneseUtil = japaneseUtil;
        /** @type {import('clipboard-monitor').ClipboardReaderLike} */
        this._clipboardReader = clipboardReader;
        /** @type {?import('core').Timeout} */
        this._timerId = null;
        /** @type {?import('core').TokenObject} */
        this._timerToken = null;
        /** @type {number} */
        this._interval = 250;
        /** @type {?string} */
        this._previousText = null;
    }

    /**
     * @returns {void}
     */
    start() {
        this.stop();

        let canChange = false;
        /**
         * This token is used as a unique identifier to ensure that a new clipboard monitor
         * hasn't been started during the await call. The check below the await call
         * will exit early if the reference has changed.
         * @type {?import('core').TokenObject}
         */
        const token = {};
        const intervalCallback = async () => {
            this._timerId = null;

            let text = null;
            try {
                text = await this._clipboardReader.getText(false);
            } catch (e) {
                // NOP
            }
            if (this._timerToken !== token) { return; }

            if (
                typeof text === 'string' &&
                (text = text.trim()).length > 0 &&
                text !== this._previousText
            ) {
                this._previousText = text;
                if (canChange && this._japaneseUtil.isStringPartiallyJapanese(text)) {
                    this.trigger('change', {text});
                }
            }

            canChange = true;
            this._timerId = setTimeout(intervalCallback, this._interval);
        };

        this._timerToken = token;

        intervalCallback();
    }

    /**
     * @returns {void}
     */
    stop() {
        this._timerToken = null;
        this._previousText = null;
        if (this._timerId !== null) {
            clearTimeout(this._timerId);
            this._timerId = null;
        }
    }

    /**
     * @param {?string} text
     */
    setPreviousText(text) {
        this._previousText = text;
    }
}
