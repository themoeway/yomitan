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

export class PronunciationGenerator {
    /**
     * @param {import('../../language/sandbox/japanese-util.js').JapaneseUtil} japaneseUtil
     */
    constructor(japaneseUtil) {
        /** @type {import('../../language/sandbox/japanese-util.js').JapaneseUtil} */
        this._japaneseUtil = japaneseUtil;
    }

    /**
     * @param {string[]} morae
     * @param {number} downstepPosition
     * @param {number[]} nasalPositions
     * @param {number[]} devoicePositions
     * @returns {HTMLSpanElement}
     */
    createPronunciationText(morae, downstepPosition, nasalPositions, devoicePositions) {
        const jp = this._japaneseUtil;
        const nasalPositionsSet = nasalPositions.length > 0 ? new Set(nasalPositions) : null;
        const devoicePositionsSet = devoicePositions.length > 0 ? new Set(devoicePositions) : null;
        const container = document.createElement('span');
        container.className = 'pronunciation-text';
        for (let i = 0, ii = morae.length; i < ii; ++i) {
            const i1 = i + 1;
            const mora = morae[i];
            const highPitch = jp.isMoraPitchHigh(i, downstepPosition);
            const highPitchNext = jp.isMoraPitchHigh(i1, downstepPosition);
            const nasal = nasalPositionsSet !== null && nasalPositionsSet.has(i1);
            const devoice = devoicePositionsSet !== null && devoicePositionsSet.has(i1);

            const n1 = document.createElement('span');
            n1.className = 'pronunciation-mora';
            n1.dataset.position = `${i}`;
            n1.dataset.pitch = highPitch ? 'high' : 'low';
            n1.dataset.pitchNext = highPitchNext ? 'high' : 'low';

            const characterNodes = [];
            for (const character of mora) {
                const n2 = document.createElement('span');
                n2.className = 'pronunciation-character';
                n2.textContent = character;
                n1.appendChild(n2);
                characterNodes.push(n2);
            }

            if (devoice) {
                n1.dataset.devoice = 'true';
                const n3 = document.createElement('span');
                n3.className = 'pronunciation-devoice-indicator';
                n1.appendChild(n3);
            }
            if (nasal && characterNodes.length > 0) {
                n1.dataset.nasal = 'true';

                const group = document.createElement('span');
                group.className = 'pronunciation-character-group';

                const n2 = characterNodes[0];
                const character = /** @type {string} */ (n2.textContent);

                const characterInfo = jp.getKanaDiacriticInfo(character);
                if (characterInfo !== null) {
                    n1.dataset.originalText = mora;
                    n2.dataset.originalText = character;
                    n2.textContent = characterInfo.character;
                }

                let n3 = document.createElement('span');
                n3.className = 'pronunciation-nasal-diacritic';
                n3.textContent = '\u309a'; // Combining handakuten
                group.appendChild(n3);

                n3 = document.createElement('span');
                n3.className = 'pronunciation-nasal-indicator';
                group.appendChild(n3);

                /** @type {ParentNode} */ (n2.parentNode).replaceChild(group, n2);
                group.insertBefore(n2, group.firstChild);
            }

            const line = document.createElement('span');
            line.className = 'pronunciation-mora-line';
            n1.appendChild(line);

            container.appendChild(n1);
        }
        return container;
    }

    /**
     * @param {string[]} morae
     * @param {number} downstepPosition
     * @returns {SVGSVGElement}
     */
    createPronunciationGraph(morae, downstepPosition) {
        const jp = this._japaneseUtil;
        const ii = morae.length;

        const svgns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgns, 'svg');
        svg.setAttribute('xmlns', svgns);
        svg.setAttribute('class', 'pronunciation-graph');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('viewBox', `0 0 ${50 * (ii + 1)} 100`);

        if (ii <= 0) { return svg; }

        const path1 = document.createElementNS(svgns, 'path');
        svg.appendChild(path1);

        const path2 = document.createElementNS(svgns, 'path');
        svg.appendChild(path2);

        const pathPoints = [];
        for (let i = 0; i < ii; ++i) {
            const highPitch = jp.isMoraPitchHigh(i, downstepPosition);
            const highPitchNext = jp.isMoraPitchHigh(i + 1, downstepPosition);
            const x = i * 50 + 25;
            const y = highPitch ? 25 : 75;
            if (highPitch && !highPitchNext) {
                this._addGraphDotDownstep(svg, svgns, x, y);
            } else {
                this._addGraphDot(svg, svgns, x, y);
            }
            pathPoints.push(`${x} ${y}`);
        }

        path1.setAttribute('class', 'pronunciation-graph-line');
        path1.setAttribute('d', `M${pathPoints.join(' L')}`);

        pathPoints.splice(0, ii - 1);
        {
            const highPitch = jp.isMoraPitchHigh(ii, downstepPosition);
            const x = ii * 50 + 25;
            const y = highPitch ? 25 : 75;
            this._addGraphTriangle(svg, svgns, x, y);
            pathPoints.push(`${x} ${y}`);
        }

        path2.setAttribute('class', 'pronunciation-graph-line-tail');
        path2.setAttribute('d', `M${pathPoints.join(' L')}`);

        return svg;
    }

    /**
     * @param {number} downstepPosition
     * @returns {HTMLSpanElement}
     */
    createPronunciationDownstepPosition(downstepPosition) {
        const downstepPositionString = `${downstepPosition}`;

        const n1 = document.createElement('span');
        n1.className = 'pronunciation-downstep-notation';
        n1.dataset.downstepPosition = downstepPositionString;

        let n2 = document.createElement('span');
        n2.className = 'pronunciation-downstep-notation-prefix';
        n2.textContent = '[';
        n1.appendChild(n2);

        n2 = document.createElement('span');
        n2.className = 'pronunciation-downstep-notation-number';
        n2.textContent = downstepPositionString;
        n1.appendChild(n2);

        n2 = document.createElement('span');
        n2.className = 'pronunciation-downstep-notation-suffix';
        n2.textContent = ']';
        n1.appendChild(n2);

        return n1;
    }

    // Private

    /**
     * @param {Element} container
     * @param {string} svgns
     * @param {number} x
     * @param {number} y
     */
    _addGraphDot(container, svgns, x, y) {
        container.appendChild(this._createGraphCircle(svgns, 'pronunciation-graph-dot', x, y, '15'));
    }

    /**
     * @param {Element} container
     * @param {string} svgns
     * @param {number} x
     * @param {number} y
     */
    _addGraphDotDownstep(container, svgns, x, y) {
        container.appendChild(this._createGraphCircle(svgns, 'pronunciation-graph-dot-downstep1', x, y, '15'));
        container.appendChild(this._createGraphCircle(svgns, 'pronunciation-graph-dot-downstep2', x, y, '5'));
    }

    /**
     * @param {Element} container
     * @param {string} svgns
     * @param {number} x
     * @param {number} y
     */
    _addGraphTriangle(container, svgns, x, y) {
        const node = document.createElementNS(svgns, 'path');
        node.setAttribute('class', 'pronunciation-graph-triangle');
        node.setAttribute('d', 'M0 13 L15 -13 L-15 -13 Z');
        node.setAttribute('transform', `translate(${x},${y})`);
        container.appendChild(node);
    }

    /**
     * @param {string} svgns
     * @param {string} className
     * @param {number} x
     * @param {number} y
     * @param {string} radius
     * @returns {Element}
     */
    _createGraphCircle(svgns, className, x, y, radius) {
        const node = document.createElementNS(svgns, 'circle');
        node.setAttribute('class', className);
        node.setAttribute('cx', `${x}`);
        node.setAttribute('cy', `${y}`);
        node.setAttribute('r', radius);
        return node;
    }
}
