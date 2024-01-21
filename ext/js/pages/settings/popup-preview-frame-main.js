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

import {PopupFactory} from '../../app/popup-factory.js';
import {log} from '../../core/logger.js';
import {HotkeyHandler} from '../../input/hotkey-handler.js';
import {yomitan} from '../../yomitan.js';
import {PopupPreviewFrame} from './popup-preview-frame.js';

/** Entry point. */
async function main() {
    try {
        await yomitan.prepare();

        const {tabId, frameId} = await yomitan.api.frameInformationGet();
        if (typeof tabId === 'undefined') {
            throw new Error('Failed to get tabId');
        }
        if (typeof frameId === 'undefined') {
            throw new Error('Failed to get frameId');
        }

        const hotkeyHandler = new HotkeyHandler();
        hotkeyHandler.prepare();

        const popupFactory = new PopupFactory(frameId);
        popupFactory.prepare();

        const preview = new PopupPreviewFrame(tabId, frameId, popupFactory, hotkeyHandler);
        await preview.prepare();

        document.documentElement.dataset.loaded = 'true';
    } catch (e) {
        log.error(e);
    }
}

await main();
