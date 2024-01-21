/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2021-2022  Yomichan Authors
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

export class SearchActionPopupController {
    /**
     * @param {import('./search-persistent-state-controller.js').SearchPersistentStateController} searchPersistentStateController
     */
    constructor(searchPersistentStateController) {
        /** @type {import('./search-persistent-state-controller.js').SearchPersistentStateController} */
        this._searchPersistentStateController = searchPersistentStateController;
    }

    /** */
    prepare() {
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.get('action-popup') !== 'true') { return; }

        searchParams.delete('action-popup');
        let search = searchParams.toString();
        if (search.length > 0) { search = `?${search}`; }
        const url = `${location.protocol}//${location.host}${location.pathname}${search}${location.hash}`;
        history.replaceState(history.state, '', url);

        this._searchPersistentStateController.mode = 'action-popup';
    }
}
