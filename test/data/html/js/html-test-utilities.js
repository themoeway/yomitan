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

class HtmlTestUtilities {
    /**
     * @param {Element} element
     */
    static requestFullscreen(element) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
            // @ts-expect-error - Browser compatibility
        } else if (element.mozRequestFullScreen) {
            // @ts-expect-error - Browser compatibility
            element.mozRequestFullScreen();
            // @ts-expect-error - Browser compatibility
        } else if (element.webkitRequestFullscreen) {
            // @ts-expect-error - Browser compatibility
            element.webkitRequestFullscreen();
            // @ts-expect-error - Browser compatibility
        } else if (element.msRequestFullscreen) {
            // @ts-expect-error - Browser compatibility
            element.msRequestFullscreen();
        }
    }

    /** */
    static exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            // @ts-expect-error - Browser compatibility
        } else if (document.mozCancelFullScreen) {
            // @ts-expect-error - Browser compatibility
            document.mozCancelFullScreen();
            // @ts-expect-error - Browser compatibility
        } else if (document.webkitExitFullscreen) {
            // @ts-expect-error - Browser compatibility
            document.webkitExitFullscreen();
            // @ts-expect-error - Browser compatibility
        } else if (document.msExitFullscreen) {
            // @ts-expect-error - Browser compatibility
            document.msExitFullscreen();
        }
    }

    /**
     * @returns {?Element}
     */
    static getFullscreenElement() {
        return (
            document.fullscreenElement ||
            // @ts-expect-error - Browser compatibility
            document.msFullscreenElement ||
            // @ts-expect-error - Browser compatibility
            document.mozFullScreenElement ||
            // @ts-expect-error - Browser compatibility
            document.webkitFullscreenElement ||
            null
        );
    }

    /**
     * @param {Element} element
     */
    static toggleFullscreen(element) {
        if (this.getFullscreenElement()) {
            this.exitFullscreen();
        } else {
            this.requestFullscreen(element);
        }
    }

    /**
     * @param {string} string
     * @returns {Uint8Array}
     */
    static stringToTypedArray(string) {
        const array = new Uint8Array(string.length);
        for (let i = 0; i < string.length; ++i) {
            array[i] = string.charCodeAt(i);
        }
        return array;
    }

    /**
     * @param {string} dataUrl
     * @returns {{content: string, type: string}}
     * @throws {Error}
     */
    static dataUrlToContent(dataUrl) {
        const match = /^data:([^;]*);(base64,)?([\w\W]*)$/.exec(dataUrl);
        if (match === null) { throw new Error('Invalid input'); }
        const [, type, isBase64, data] = match;
        const content = (
            isBase64 ?
                new TextDecoder().decode(this.stringToTypedArray(atob(data))) :
                data
        );
        return {content, type};
    }

    /**
     * @param {string} dataUrl
     * @returns {Blob}
     */
    static dataUrlToBlob(dataUrl) {
        const {content, type} = this.dataUrlToContent(dataUrl);
        return new Blob([content], {type});
    }

    /**
     * @param {?Element} element
     * @returns {string}
     * @throws {Error}
     */
    static getIframeSrc(element) {
        if (!(element instanceof HTMLIFrameElement)) {
            throw new Error('Element is not an iframe');
        }
        return element.src;
    }

    /**
     * @param {Element|DocumentFragment} container
     * @param {?Element} [fullscreenElement]
     */
    static setupTest(container, fullscreenElement = null) {
        const fullscreenLink = container.querySelector('.fullscreen-link');
        if (fullscreenLink !== null) {
            if (fullscreenElement === null) {
                fullscreenElement = container.querySelector('.fullscreen-element');
            }
            fullscreenLink.addEventListener('click', (e) => {
                if (fullscreenElement === null) { return; }
                this.toggleFullscreen(fullscreenElement);
                e.preventDefault();
                return false;
            }, false);
        }

        const template = container.querySelector('template');
        const templateContentContainer = container.querySelector('.template-content-container');
        if (template !== null && templateContentContainer !== null) {
            const mode = (container instanceof HTMLElement ? container.dataset.shadowMode : void 0);
            const shadow = templateContentContainer.attachShadow({
                mode: (mode === 'open' || mode === 'closed' ? mode : 'open')
            });

            const containerStyles = document.querySelector('#container-styles');
            if (containerStyles !== null) {
                shadow.appendChild(containerStyles.cloneNode(true));
            }

            const content = document.importNode(template.content, true);
            this.setupTest(content);
            shadow.appendChild(content);
        }
    }

    /**
     * @param {() => void} main
     */
    static runMain(main) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => { main(); });
        } else {
            main();
        }
    }
}
