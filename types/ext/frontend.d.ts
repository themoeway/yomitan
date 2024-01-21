/*
 * Copyright (C) 2023-2024  Yomitan Authors
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

import type {PopupFactory} from '../../ext/js/app/popup-factory';
import type {HotkeyHandler} from '../../ext/js/input/hotkey-handler';

/** Details about how to set up the instance. */
export type ConstructorDetails = {
    /** The type of page, one of 'web', 'popup', or 'search'. */
    pageType: PageType;
    /** A PopupFactory instance to use for generating popups. */
    popupFactory: PopupFactory;
    /** The nesting depth value of the popup. */
    depth: number;
    /** The tab ID of the host tab. */
    tabId: number | undefined;
    /** The frame ID of the host frame. */
    frameId: number;
    /** The popup ID of the parent popup if one exists, otherwise null. */
    parentPopupId: string | null;
    /** The frame ID of the parent popup if one exists, otherwise null. */
    parentFrameId: number | null;
    /** Whether or not proxy popups should be used. */
    useProxyPopup: boolean;
    /** Whether or not window popups can be used. */
    canUseWindowPopup?: boolean;
    /** Whether or not popups can be hosted in the root frame. */
    allowRootFramePopupProxy: boolean;
    /** Whether popups can create child popups or not. */
    childrenSupported?: boolean;
    /** A HotkeyHandler instance. */
    hotkeyHandler: HotkeyHandler;
};

export type PageType = 'web' | 'popup' | 'search';
