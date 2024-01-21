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

export class ScrollElement {
    /**
     * @param {Element} node
     */
    constructor(node) {
        /** @type {Element} */
        this._node = node;
        /** @type {?number} */
        this._animationRequestId = null;
        /** @type {number} */
        this._animationStartTime = 0;
        /** @type {number} */
        this._animationStartX = 0;
        /** @type {number} */
        this._animationStartY = 0;
        /** @type {number} */
        this._animationEndTime = 0;
        /** @type {number} */
        this._animationEndX = 0;
        /** @type {number} */
        this._animationEndY = 0;
        /** @type {(time: number) => void} */
        this._requestAnimationFrameCallback = this._onAnimationFrame.bind(this);
    }

    /** @type {number} */
    get x() {
        return this._node !== null ? this._node.scrollLeft : window.scrollX || window.pageXOffset;
    }

    /** @type {number} */
    get y() {
        return this._node !== null ? this._node.scrollTop : window.scrollY || window.pageYOffset;
    }

    /**
     * @param {number} y
     */
    toY(y) {
        this.to(this.x, y);
    }

    /**
     * @param {number} x
     */
    toX(x) {
        this.to(x, this.y);
    }

    /**
     * @param {number} x
     * @param {number} y
     */
    to(x, y) {
        this.stop();
        this._scroll(x, y);
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} time
     */
    animate(x, y, time) {
        this._animationStartX = this.x;
        this._animationStartY = this.y;
        this._animationStartTime = window.performance.now();
        this._animationEndX = x;
        this._animationEndY = y;
        this._animationEndTime = this._animationStartTime + time;
        this._animationRequestId = window.requestAnimationFrame(this._requestAnimationFrameCallback);
    }

    /** */
    stop() {
        if (this._animationRequestId === null) {
            return;
        }

        window.cancelAnimationFrame(this._animationRequestId);
        this._animationRequestId = null;
    }

    /**
     * @returns {DOMRect}
     */
    getRect() {
        return this._node.getBoundingClientRect();
    }

    // Private

    /**
     * @param {number} time
     */
    _onAnimationFrame(time) {
        if (time >= this._animationEndTime) {
            this._scroll(this._animationEndX, this._animationEndY);
            this._animationRequestId = null;
            return;
        }

        const t = this._easeInOutCubic((time - this._animationStartTime) / (this._animationEndTime - this._animationStartTime));
        this._scroll(
            this._lerp(this._animationStartX, this._animationEndX, t),
            this._lerp(this._animationStartY, this._animationEndY, t)
        );

        this._animationRequestId = window.requestAnimationFrame(this._requestAnimationFrameCallback);
    }

    /**
     * @param {number} t
     * @returns {number}
     */
    _easeInOutCubic(t) {
        if (t < 0.5) {
            return (4.0 * t * t * t);
        } else {
            t = 1.0 - t;
            return 1.0 - (4.0 * t * t * t);
        }
    }

    /**
     * @param {number} start
     * @param {number} end
     * @param {number} percent
     * @returns {number}
     */
    _lerp(start, end, percent) {
        return (end - start) * percent + start;
    }

    /**
     * @param {number} x
     * @param {number} y
     */
    _scroll(x, y) {
        if (this._node !== null) {
            this._node.scrollLeft = x;
            this._node.scrollTop = y;
        } else {
            window.scroll(x, y);
        }
    }
}
