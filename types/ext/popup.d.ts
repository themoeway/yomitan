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

import type {Popup} from '../../ext/js/app/popup';
import type {PopupProxy} from '../../ext/js/app/popup-proxy';
import type {PopupWindow} from '../../ext/js/app/popup-window';
import type {FrameOffsetForwarder} from '../../ext/js/comm/frame-offset-forwarder';
import type * as DocumentUtil from './document-util';
import type * as Settings from './settings';
import type {EventNames, EventArgument as BaseEventArgument} from './core';

export type PopupAny = Popup | PopupWindow | PopupProxy;

/**
 * Information about how popup content should be shown, specifically related to the outer popup frame.
 */
export type ContentDetails = {
    /** The options context for the content to show. */
    optionsContext: Settings.OptionsContext | null;
    /** The rectangles of the source content. */
    sourceRects: Rect[];
    /** The normalized CSS writing-mode value of the source content. */
    writingMode: DocumentUtil.NormalizedWritingMode;
};

/**
 * A rectangle representing a DOM region, similar to DOMRect.
 */
export type Rect = {
    /** The left position of the rectangle. */
    left: number;
    /** The top position of the rectangle. */
    top: number;
    /** The right position of the rectangle. */
    right: number;
    /** The bottom position of the rectangle. */
    bottom: number;
};

/**
 * A rectangle representing a DOM region, similar to DOMRect but with a `valid` property.
 */
export type ValidRect = {
    /** The left position of the rectangle. */
    left: number;
    /** The top position of the rectangle. */
    top: number;
    /** The right position of the rectangle. */
    right: number;
    /** The bottom position of the rectangle. */
    bottom: number;
    /** Whether or not the rectangle is valid. */
    valid: boolean;
};

/**
 * A rectangle representing a DOM region for placing the popup frame.
 */
export type SizeRect = {
    /** The left position of the rectangle. */
    left: number;
    /** The top position of the rectangle. */
    top: number;
    /** The width of the rectangle. */
    width: number;
    /** The height of the rectangle. */
    height: number;
    /** Whether or not the rectangle is positioned to the right of the source rectangle. */
    after: boolean;
    /** Whether or not the rectangle is positioned below the source rectangle. */
    below: boolean;
};

export type ValidSize = {
    width: number;
    height: number;
    valid: boolean;
};

export type PopupConstructorDetails = {
    /** The ID of the popup. */
    id: string;
    /** The depth of the popup. */
    depth: number;
    /** The ID of the host frame. */
    frameId: number;
    /** Whether or not the popup is able to show child popups. */
    childrenSupported: boolean;
};

export type PopupWindowConstructorDetails = {
    /** The ID of the popup. */
    id: string;
    /** The depth of the popup. */
    depth: number;
    /** The ID of the host frame. */
    frameId: number;
};

export type PopupProxyConstructorDetails = {
    /** The ID of the popup. */
    id: string;
    /** The depth of the popup. */
    depth: number;
    /** The ID of the host frame. */
    frameId: number;
    /** A `FrameOffsetForwarder` instance which is used to determine frame positioning. */
    frameOffsetForwarder: FrameOffsetForwarder | null;
};

export type Events = {
    customOuterCssChanged: {
        node: HTMLStyleElement | HTMLLinkElement | null;
        useWebExtensionApi: boolean;
        inShadow: boolean;
    };
    framePointerOver: Record<string, never>;
    framePointerOut: Record<string, never>;
    offsetNotFound: Record<string, never>;
};

export type EventArgument<TName extends EventNames<Events>> = BaseEventArgument<Events, TName>;
