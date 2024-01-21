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

import {Modal} from './modal.js';

export class ModalController {
    constructor() {
        /** @type {Modal[]} */
        this._modals = [];
        /** @type {Map<string|Element, Modal>} */
        this._modalMap = new Map();
    }

    /** */
    prepare() {
        const idSuffix = '-modal';
        for (const node of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.modal'))) {
            let {id} = node;
            if (typeof id !== 'string') { continue; }

            if (id.endsWith(idSuffix)) {
                id = id.substring(0, id.length - idSuffix.length);
            }

            const modal = new Modal(node);
            modal.prepare();
            this._modalMap.set(id, modal);
            this._modalMap.set(node, modal);
            this._modals.push(modal);
        }
    }

    /**
     * @param {string|Element} nameOrNode
     * @returns {?Modal}
     */
    getModal(nameOrNode) {
        const modal = this._modalMap.get(nameOrNode);
        return (typeof modal !== 'undefined' ? modal : null);
    }

    /**
     * @returns {?Modal}
     */
    getTopVisibleModal() {
        for (let i = this._modals.length - 1; i >= 0; --i) {
            const modal = this._modals[i];
            if (modal.isVisible()) {
                return modal;
            }
        }
        return null;
    }
}
