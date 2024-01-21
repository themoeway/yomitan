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

/** Details about how to acquire the popup. */
export type GetOrCreatePopupDetails = {
    /** The ID of the frame that should host the popup. */
    frameId?: number | null;
    /** A specific ID used to find an existing popup, or to assign to the new popup. */
    id?: string | null;
    /** The ID of the parent popup. */
    parentPopupId?: string | null;
    /** A specific depth value to assign to the popup. */
    depth?: number | null;
    /** Whether or not a separate popup window should be used, rather than an iframe. */
    popupWindow?: boolean;
    /** Whether or not the popup is able to show child popups. */
    childrenSupported?: boolean;
};
