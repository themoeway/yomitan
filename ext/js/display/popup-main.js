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

import {log} from '../core/logger.js';
import {DocumentFocusController} from '../dom/document-focus-controller.js';
import {HotkeyHandler} from '../input/hotkey-handler.js';
import {JapaneseUtil} from '../language/sandbox/japanese-util.js';
import {yomitan} from '../yomitan.js';
import {DisplayAnki} from './display-anki.js';
import {DisplayAudio} from './display-audio.js';
import {DisplayProfileSelection} from './display-profile-selection.js';
import {DisplayResizer} from './display-resizer.js';
import {Display} from './display.js';

/** Entry point. */
async function main() {
    try {
        const documentFocusController = new DocumentFocusController();
        documentFocusController.prepare();

        await yomitan.prepare();

        const {tabId, frameId} = await yomitan.api.frameInformationGet();

        const japaneseUtil = new JapaneseUtil(null);

        const hotkeyHandler = new HotkeyHandler();
        hotkeyHandler.prepare();

        const display = new Display(tabId, frameId, 'popup', japaneseUtil, documentFocusController, hotkeyHandler);
        await display.prepare();

        const displayAudio = new DisplayAudio(display);
        displayAudio.prepare();

        const displayAnki = new DisplayAnki(display, displayAudio, japaneseUtil);
        displayAnki.prepare();

        const displayProfileSelection = new DisplayProfileSelection(display);
        displayProfileSelection.prepare();

        const displayResizer = new DisplayResizer(display);
        displayResizer.prepare();

        display.initializeState();

        document.documentElement.dataset.loaded = 'true';

        yomitan.ready();
    } catch (e) {
        log.error(e);
    }
}

await main();
