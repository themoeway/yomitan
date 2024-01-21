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

import {EventDispatcher} from '../core/event-dispatcher.js';
import {log} from '../core/logger.js';
import {querySelectorNotNull} from '../dom/query-selector.js';
import {TextScanner} from '../language/text-scanner.js';
import {yomitan} from '../yomitan.js';

/**
 * @augments EventDispatcher<import('query-parser').Events>
 */
export class QueryParser extends EventDispatcher {
    /**
     * @param {import('display').QueryParserConstructorDetails} details
     */
    constructor({getSearchContext, japaneseUtil}) {
        super();
        /** @type {import('display').GetSearchContextCallback} */
        this._getSearchContext = getSearchContext;
        /** @type {import('../language/sandbox/japanese-util.js').JapaneseUtil} */
        this._japaneseUtil = japaneseUtil;
        /** @type {string} */
        this._text = '';
        /** @type {?import('core').TokenObject} */
        this._setTextToken = null;
        /** @type {?string} */
        this._selectedParser = null;
        /** @type {import('settings').ParsingReadingMode} */
        this._readingMode = 'none';
        /** @type {number} */
        this._scanLength = 1;
        /** @type {boolean} */
        this._useInternalParser = true;
        /** @type {boolean} */
        this._useMecabParser = false;
        /** @type {import('api').ParseTextResultItem[]} */
        this._parseResults = [];
        /** @type {HTMLElement} */
        this._queryParser = querySelectorNotNull(document, '#query-parser-content');
        /** @type {HTMLElement} */
        this._queryParserModeContainer = querySelectorNotNull(document, '#query-parser-mode-container');
        /** @type {HTMLSelectElement} */
        this._queryParserModeSelect = querySelectorNotNull(document, '#query-parser-mode-select');
        /** @type {TextScanner} */
        this._textScanner = new TextScanner({
            node: this._queryParser,
            getSearchContext,
            searchTerms: true,
            searchKanji: false,
            searchOnClick: true
        });
    }

    /** @type {string} */
    get text() {
        return this._text;
    }

    /** */
    prepare() {
        this._textScanner.prepare();
        this._textScanner.on('clear', this._onTextScannerClear.bind(this));
        this._textScanner.on('searched', this._onSearched.bind(this));
        this._queryParserModeSelect.addEventListener('change', this._onParserChange.bind(this), false);
    }

    /**
     * @param {import('display').QueryParserOptions} display
     */
    setOptions({selectedParser, termSpacing, readingMode, useInternalParser, useMecabParser, scanning}) {
        let selectedParserChanged = false;
        if (selectedParser === null || typeof selectedParser === 'string') {
            selectedParserChanged = (this._selectedParser !== selectedParser);
            this._selectedParser = selectedParser;
        }
        if (typeof termSpacing === 'boolean') {
            this._queryParser.dataset.termSpacing = `${termSpacing}`;
        }
        if (typeof readingMode === 'string') {
            this._readingMode = readingMode;
        }
        if (typeof useInternalParser === 'boolean') {
            this._useInternalParser = useInternalParser;
        }
        if (typeof useMecabParser === 'boolean') {
            this._useMecabParser = useMecabParser;
        }
        if (scanning !== null && typeof scanning === 'object') {
            const {scanLength} = scanning;
            if (typeof scanLength === 'number') {
                this._scanLength = scanLength;
            }
            this._textScanner.setOptions(scanning);
        }
        this._textScanner.setEnabled(true);
        if (selectedParserChanged && this._parseResults.length > 0) {
            this._renderParseResult();
        }
    }

    /**
     * @param {string} text
     */
    async setText(text) {
        this._text = text;
        this._setPreview(text);

        /** @type {?import('core').TokenObject} */
        const token = {};
        this._setTextToken = token;
        this._parseResults = await yomitan.api.parseText(text, this._getOptionsContext(), this._scanLength, this._useInternalParser, this._useMecabParser);
        if (this._setTextToken !== token) { return; }

        this._refreshSelectedParser();

        this._renderParserSelect();
        this._renderParseResult();
    }

    // Private

    /** */
    _onTextScannerClear() {
        this._textScanner.clearSelection();
    }

    /**
     * @param {import('text-scanner').SearchedEventDetails} e
     */
    _onSearched(e) {
        const {error} = e;
        if (error !== null) {
            log.error(error);
            return;
        }

        const {
            textScanner,
            type,
            dictionaryEntries,
            sentence,
            inputInfo,
            textSource,
            optionsContext
        } = e;
        if (type === null || dictionaryEntries === null || sentence === null || optionsContext === null) { return; }

        this.trigger('searched', {
            textScanner,
            type,
            dictionaryEntries,
            sentence,
            inputInfo,
            textSource,
            optionsContext,
            sentenceOffset: this._getSentenceOffset(e.textSource)
        });
    }

    /**
     * @param {Event} e
     */
    _onParserChange(e) {
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        const value = element.value;
        this._setSelectedParser(value);
    }

    /**
     * @returns {import('settings').OptionsContext}
     */
    _getOptionsContext() {
        return this._getSearchContext().optionsContext;
    }

    /** */
    _refreshSelectedParser() {
        if (this._parseResults.length > 0 && !this._getParseResult()) {
            const value = this._parseResults[0].id;
            this._setSelectedParser(value);
        }
    }

    /**
     * @param {string} value
     */
    _setSelectedParser(value) {
        const optionsContext = this._getOptionsContext();
        /** @type {import('settings-modifications').ScopedModificationSet} */
        const modification = {
            action: 'set',
            path: 'parsing.selectedParser',
            value,
            scope: 'profile',
            optionsContext
        };
        yomitan.api.modifySettings([modification], 'search');
    }

    /**
     * @returns {import('api').ParseTextResultItem|undefined}
     */
    _getParseResult() {
        const selectedParser = this._selectedParser;
        return this._parseResults.find((r) => r.id === selectedParser);
    }

    /**
     * @param {string} text
     */
    _setPreview(text) {
        const terms = [[{text, reading: ''}]];
        this._queryParser.textContent = '';
        this._queryParser.dataset.parsed = 'false';
        this._queryParser.appendChild(this._createParseResult(terms));
    }

    /** */
    _renderParserSelect() {
        const visible = (this._parseResults.length > 1);
        if (visible) {
            this._updateParserModeSelect(this._queryParserModeSelect, this._parseResults, this._selectedParser);
        }
        this._queryParserModeContainer.hidden = !visible;
    }

    /** */
    _renderParseResult() {
        const parseResult = this._getParseResult();
        this._queryParser.textContent = '';
        this._queryParser.dataset.parsed = 'true';
        if (!parseResult) { return; }
        this._queryParser.appendChild(this._createParseResult(parseResult.content));
    }

    /**
     * @param {HTMLSelectElement} select
     * @param {import('api').ParseTextResultItem[]} parseResults
     * @param {?string} selectedParser
     */
    _updateParserModeSelect(select, parseResults, selectedParser) {
        const fragment = document.createDocumentFragment();

        let index = 0;
        let selectedIndex = -1;
        for (const parseResult of parseResults) {
            const option = document.createElement('option');
            option.value = parseResult.id;
            switch (parseResult.source) {
                case 'scanning-parser':
                    option.textContent = 'Scanning parser';
                    break;
                case 'mecab':
                    option.textContent = `MeCab: ${parseResult.dictionary}`;
                    break;
                default:
                    option.textContent = `Unknown source: ${parseResult.source}`;
                    break;
            }
            fragment.appendChild(option);

            if (selectedParser === parseResult.id) {
                selectedIndex = index;
            }
            ++index;
        }

        select.textContent = '';
        select.appendChild(fragment);
        select.selectedIndex = selectedIndex;
    }

    /**
     * @param {import('api').ParseTextLine[]} data
     * @returns {DocumentFragment}
     */
    _createParseResult(data) {
        let offset = 0;
        const fragment = document.createDocumentFragment();
        for (const term of data) {
            const termNode = document.createElement('span');
            termNode.className = 'query-parser-term';
            termNode.dataset.offset = `${offset}`;
            for (const {text, reading} of term) {
                if (reading.length === 0) {
                    termNode.appendChild(document.createTextNode(text));
                } else {
                    const reading2 = this._convertReading(text, reading);
                    termNode.appendChild(this._createSegment(text, reading2, offset));
                }
                offset += text.length;
            }
            fragment.appendChild(termNode);
        }
        return fragment;
    }

    /**
     * @param {string} text
     * @param {string} reading
     * @param {number} offset
     * @returns {HTMLElement}
     */
    _createSegment(text, reading, offset) {
        const segmentNode = document.createElement('ruby');
        segmentNode.className = 'query-parser-segment';

        const textNode = document.createElement('span');
        textNode.className = 'query-parser-segment-text';
        textNode.dataset.offset = `${offset}`;

        const readingNode = document.createElement('rt');
        readingNode.className = 'query-parser-segment-reading';

        segmentNode.appendChild(textNode);
        segmentNode.appendChild(readingNode);

        textNode.textContent = text;
        readingNode.textContent = reading;

        return segmentNode;
    }

    /**
     * Convert _reading_ to hiragana, katakana, or romaji, or _term_ if it is entirely kana and _reading_ is an empty string,  based on _readingMode.
     * @param {string} term
     * @param {string} reading
     * @returns {string}
     */
    _convertReading(term, reading) {
        switch (this._readingMode) {
            case 'hiragana':
                return this._japaneseUtil.convertKatakanaToHiragana(reading);
            case 'katakana':
                return this._japaneseUtil.convertHiraganaToKatakana(reading);
            case 'romaji':
                if (this._japaneseUtil.convertToRomajiSupported()) {
                    if (reading.length > 0) {
                        return this._japaneseUtil.convertToRomaji(reading);
                    } else if (this._japaneseUtil.isStringEntirelyKana(term)) {
                        return this._japaneseUtil.convertToRomaji(term);
                    }
                }
                return reading;
            case 'none':
                return '';
            default:
                return reading;
        }
    }

    /**
     * @param {import('text-source').TextSource} textSource
     * @returns {?number}
     */
    _getSentenceOffset(textSource) {
        if (textSource.type === 'range') {
            const {range} = textSource;
            const node = this._getParentElement(range.startContainer);
            if (node !== null && node instanceof HTMLElement) {
                const {offset} = node.dataset;
                if (typeof offset === 'string') {
                    const value = Number.parseInt(offset, 10);
                    if (Number.isFinite(value)) {
                        return Math.max(0, value) + range.startOffset;
                    }
                }
            }
        }
        return null;
    }

    /**
     * @param {?Node} node
     * @returns {?Element}
     */
    _getParentElement(node) {
        const {ELEMENT_NODE} = Node;
        while (true) {
            if (node === null) { return null; }
            if (node.nodeType === ELEMENT_NODE) { return /** @type {Element} */ (node); }
            node = node.parentNode;
        }
    }
}
