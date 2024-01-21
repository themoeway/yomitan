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

HtmlTestUtilities.runMain(() => {
    let totalCount = 0;
    const container = document.querySelector('#container');
    const counter = document.querySelector('#counter');

    /**
     * @param {number} count
     * @param {Event} event
     */
    function addElements(count, event) {
        event.preventDefault();

        if (container !== null) {
            for (let i = 0; i < count; ++i) {
                const element = document.createElement('div');
                element.textContent = 'ありがとう';
                container.appendChild(element);
            }
        }

        totalCount += count;
        if (counter !== null) {
            counter.textContent = `${totalCount}`;
        }
    }

    for (const element of document.querySelectorAll('.add-elements')) {
        if (!(element instanceof HTMLElement)) { continue; }
        const {count} = element.dataset;
        if (typeof count !== 'string') { continue; }
        const countValue = Number.parseInt(count, 10);
        if (!Number.isFinite(countValue)) { continue; }
        element.addEventListener('click', addElements.bind(null, countValue));
    }

    const shadowIframeContainer = document.querySelector('#shadow-iframe-container-open');
    if (shadowIframeContainer !== null) {
        const shadow = shadowIframeContainer.attachShadow({mode: 'open'});
        const templateElement = document.querySelector('#shadow-iframe-container-open-content-template');
        if (templateElement instanceof HTMLTemplateElement) {
            const template = templateElement.content;
            const content = document.importNode(template, true);
            shadow.appendChild(content);
        }
    }
});
