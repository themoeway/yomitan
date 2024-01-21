/*
 * Copyright (C) 2023-2024  Yomitan Authors
 * Copyright (C) 2016-2022  Yomichan Authors
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

import {RegexUtil} from '../general/regex-util.js';
import {TextSourceMap} from '../general/text-source-map.js';
import {Deinflector} from './deinflector.js';

/**
 * Class which finds term and kanji dictionary entries for text.
 */
export class Translator {
    /**
     * Creates a new Translator instance.
     * @param {import('translator').ConstructorDetails} details The details for the class.
     */
    constructor({japaneseUtil, database}) {
        /** @type {import('./sandbox/japanese-util.js').JapaneseUtil} */
        this._japaneseUtil = japaneseUtil;
        /** @type {import('../dictionary/dictionary-database.js').DictionaryDatabase} */
        this._database = database;
        /** @type {?Deinflector} */
        this._deinflector = null;
        /** @type {import('translator').DictionaryTagCache} */
        this._tagCache = new Map();
        /** @type {Intl.Collator} */
        this._stringComparer = new Intl.Collator('en-US'); // Invariant locale
        /** @type {RegExp} */
        this._numberRegex = /[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/;
    }

    /**
     * Initializes the instance for use. The public API should not be used until
     * this function has been called.
     * @param {import('deinflector').ReasonsRaw} deinflectionReasons The raw deinflections reasons data that the Deinflector uses.
     */
    prepare(deinflectionReasons) {
        this._deinflector = new Deinflector(deinflectionReasons);
    }

    /**
     * Clears the database tag cache. This should be executed if the database is changed.
     */
    clearDatabaseCaches() {
        this._tagCache.clear();
    }

    /**
     * Finds term definitions for the given text.
     * @param {import('translator').FindTermsMode} mode The mode to use for finding terms, which determines the format of the resulting array.
     *   One of: 'group', 'merge', 'split', 'simple'
     * @param {string} text The text to find terms for.
     * @param {import('translation').FindTermsOptions} options A object describing settings about the lookup.
     * @returns {Promise<{dictionaryEntries: import('dictionary').TermDictionaryEntry[], originalTextLength: number}>} An object containing dictionary entries and the length of the original source text.
     */
    async findTerms(mode, text, options) {
        const {enabledDictionaryMap, excludeDictionaryDefinitions, sortFrequencyDictionary, sortFrequencyDictionaryOrder} = options;
        const tagAggregator = new TranslatorTagAggregator();
        let {dictionaryEntries, originalTextLength} = await this._findTermsInternal(text, enabledDictionaryMap, options, tagAggregator);

        switch (mode) {
            case 'group':
                dictionaryEntries = this._groupDictionaryEntriesByHeadword(dictionaryEntries, tagAggregator);
                break;
            case 'merge':
                dictionaryEntries = await this._getRelatedDictionaryEntries(dictionaryEntries, options.mainDictionary, enabledDictionaryMap, tagAggregator);
                break;
        }

        if (excludeDictionaryDefinitions !== null) {
            this._removeExcludedDefinitions(dictionaryEntries, excludeDictionaryDefinitions);
        }

        if (mode !== 'simple') {
            await this._addTermMeta(dictionaryEntries, enabledDictionaryMap, tagAggregator);
            await this._expandTagGroupsAndGroup(tagAggregator.getTagExpansionTargets());
        } else {
            if (sortFrequencyDictionary !== null) {
                /** @type {import('translation').TermEnabledDictionaryMap} */
                const sortDictionaryMap = new Map();
                const value = enabledDictionaryMap.get(sortFrequencyDictionary);
                if (typeof value !== 'undefined') {
                    sortDictionaryMap.set(sortFrequencyDictionary, value);
                }
                await this._addTermMeta(dictionaryEntries, sortDictionaryMap, tagAggregator);
            }
        }

        if (sortFrequencyDictionary !== null) {
            this._updateSortFrequencies(dictionaryEntries, sortFrequencyDictionary, sortFrequencyDictionaryOrder === 'ascending');
        }
        if (dictionaryEntries.length > 1) {
            this._sortTermDictionaryEntries(dictionaryEntries);
        }
        for (const {definitions, frequencies, pronunciations} of dictionaryEntries) {
            this._flagRedundantDefinitionTags(definitions);
            if (definitions.length > 1) { this._sortTermDictionaryEntryDefinitions(definitions); }
            if (frequencies.length > 1) { this._sortTermDictionaryEntrySimpleData(frequencies); }
            if (pronunciations.length > 1) { this._sortTermDictionaryEntrySimpleData(pronunciations); }
        }

        return {dictionaryEntries, originalTextLength};
    }

    /**
     * Finds kanji definitions for the given text.
     * @param {string} text The text to find kanji definitions for. This string can be of any length,
     *   but is typically just one character, which is a single kanji. If the string is multiple
     *   characters long, each character will be searched in the database.
     * @param {import('translation').FindKanjiOptions} options A object describing settings about the lookup.
     * @returns {Promise<import('dictionary').KanjiDictionaryEntry[]>} An array of definitions. See the _createKanjiDefinition() function for structure details.
     */
    async findKanji(text, options) {
        if (options.removeNonJapaneseCharacters) {
            text = this._getJapaneseOnlyText(text);
        }
        const {enabledDictionaryMap} = options;
        const kanjiUnique = new Set();
        for (const c of text) {
            kanjiUnique.add(c);
        }

        const databaseEntries = await this._database.findKanjiBulk([...kanjiUnique], enabledDictionaryMap);
        if (databaseEntries.length === 0) { return []; }

        this._sortDatabaseEntriesByIndex(databaseEntries);

        /** @type {import('dictionary').KanjiDictionaryEntry[]} */
        const dictionaryEntries = [];
        const tagAggregator = new TranslatorTagAggregator();
        for (const {character, onyomi, kunyomi, tags, definitions, stats, dictionary} of databaseEntries) {
            const expandedStats = await this._expandKanjiStats(stats, dictionary);
            const dictionaryEntry = this._createKanjiDictionaryEntry(character, dictionary, onyomi, kunyomi, expandedStats, definitions);
            dictionaryEntries.push(dictionaryEntry);
            tagAggregator.addTags(dictionaryEntry.tags, dictionary, tags);
        }

        await this._addKanjiMeta(dictionaryEntries, enabledDictionaryMap);
        await this._expandTagGroupsAndGroup(tagAggregator.getTagExpansionTargets());

        this._sortKanjiDictionaryEntryData(dictionaryEntries);

        return dictionaryEntries;
    }

    /**
     * Gets a list of frequency information for a given list of term-reading pairs
     * and a list of dictionaries.
     * @param {import('translator').TermReadingList} termReadingList An array of `{term, reading}` pairs. If reading is null,
     *   the reading won't be compared.
     * @param {string[]} dictionaries An array of dictionary names.
     * @returns {Promise<import('translator').TermFrequencySimple[]>} An array of term frequencies.
     */
    async getTermFrequencies(termReadingList, dictionaries) {
        const dictionarySet = new Set();
        for (const dictionary of dictionaries) {
            dictionarySet.add(dictionary);
        }

        const termList = termReadingList.map(({term}) => term);
        const metas = await this._database.findTermMetaBulk(termList, dictionarySet);

        /** @type {import('translator').TermFrequencySimple[]} */
        const results = [];
        for (const {mode, data, dictionary, index} of metas) {
            if (mode !== 'freq') { continue; }
            let {term, reading} = termReadingList[index];
            const hasReading = (data !== null && typeof data === 'object' && typeof data.reading === 'string');
            if (hasReading && data.reading !== reading) {
                if (reading !== null) { continue; }
                reading = data.reading;
            }
            const frequency = hasReading ? data.frequency : /** @type {import('dictionary-data').GenericFrequencyData} */ (data);
            const {frequency: frequencyValue, displayValue, displayValueParsed} = this._getFrequencyInfo(frequency);
            results.push({
                term,
                reading,
                dictionary,
                hasReading,
                frequency: frequencyValue,
                displayValue,
                displayValueParsed
            });
        }
        return results;
    }

    // Find terms internal implementation

    /**
     * @param {string} text
     * @param {Map<string, import('translation').FindTermDictionary>} enabledDictionaryMap
     * @param {import('translation').FindTermsOptions} options
     * @param {TranslatorTagAggregator} tagAggregator
     * @returns {Promise<import('translator').FindTermsResult>}
     */
    async _findTermsInternal(text, enabledDictionaryMap, options, tagAggregator) {
        if (options.removeNonJapaneseCharacters) {
            text = this._getJapaneseOnlyText(text);
        }
        if (text.length === 0) {
            return {dictionaryEntries: [], originalTextLength: 0};
        }

        const deinflections = await this._getDeinflections(text, enabledDictionaryMap, options);

        let originalTextLength = 0;
        /** @type {import('dictionary').TermDictionaryEntry[]} */
        const dictionaryEntries = [];
        const ids = new Set();
        for (const {databaseEntries, originalText, transformedText, deinflectedText, inflectionRuleChainCandidates} of deinflections) {
            if (databaseEntries.length === 0) { continue; }
            originalTextLength = Math.max(originalTextLength, originalText.length);
            for (const databaseEntry of databaseEntries) {
                const {id} = databaseEntry;
                if (ids.has(id)) {
                    const existingEntry = dictionaryEntries.find((entry) => {
                        return entry.definitions.some((definition) => definition.id === id);
                    });

                    if (existingEntry && transformedText.length >= existingEntry.headwords[0].sources[0].transformedText.length) {
                        this._mergeInflectionRuleChains(existingEntry, inflectionRuleChainCandidates);
                    }

                    continue;
                }

                const dictionaryEntry = this._createTermDictionaryEntryFromDatabaseEntry(databaseEntry, originalText, transformedText, deinflectedText, inflectionRuleChainCandidates, true, enabledDictionaryMap, tagAggregator);
                dictionaryEntries.push(dictionaryEntry);
                ids.add(id);
            }
        }

        return {dictionaryEntries, originalTextLength};
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} existingEntry
     * @param {import('dictionary').InflectionRuleChainCandidate[]} inflectionRuleChainCandidates
     */
    _mergeInflectionRuleChains(existingEntry, inflectionRuleChainCandidates) {
        const existingChains = existingEntry.inflectionRuleChainCandidates;

        for (const {source, inflectionRules} of inflectionRuleChainCandidates) {
            const duplicate = existingChains.find((existingChain) => this._areArraysEqualIgnoreOrder(existingChain.inflectionRules, inflectionRules));
            if (!duplicate) {
                existingEntry.inflectionRuleChainCandidates.push({source, inflectionRules});
            } else if (duplicate.source !== source) {
                duplicate.source = 'both';
            }
        }
    }

    /**
     * @param {string[]} array1
     * @param {string[]} array2
     * @returns {boolean}
     */
    _areArraysEqualIgnoreOrder(array1, array2) {
        if (array1.length !== array2.length) {
            return false;
        }

        const frequencyCounter = new Map();

        for (const element of array1) {
            frequencyCounter.set(element, (frequencyCounter.get(element) || 0) + 1);
        }

        for (const element of array2) {
            const frequency = frequencyCounter.get(element);
            if (!frequency) {
                return false;
            }
            frequencyCounter.set(element, frequency - 1);
        }

        return true;
    }


    /**
     * @param {string} text
     * @param {Map<string, import('translation').FindTermDictionary>} enabledDictionaryMap
     * @param {import('translation').FindTermsOptions} options
     * @returns {Promise<import('translation-internal').DatabaseDeinflection[]>}
     */
    async _getDeinflections(text, enabledDictionaryMap, options) {
        let deinflections = (
            options.deinflect ?
            this._getAlgorithmDeinflections(text, options) :
            [this._createDeinflection(text, text, text, 0, [])]
        );
        if (deinflections.length === 0) { return []; }

        const {matchType} = options;

        await this._addEntriesToDeinflections(deinflections, enabledDictionaryMap, matchType);

        const dictionaryDeinflections = await this._getDictionaryDeinflections(deinflections, enabledDictionaryMap, matchType);
        deinflections.push(...dictionaryDeinflections);

        for (const deinflection of deinflections) {
            for (const entry of deinflection.databaseEntries) {
                entry.definitions = entry.definitions.filter((definition) => !Array.isArray(definition));
            }
            deinflection.databaseEntries = deinflection.databaseEntries.filter((entry) => entry.definitions.length);
        }
        deinflections = deinflections.filter((deinflection) => deinflection.databaseEntries.length);

        return deinflections;
    }

    /**
     * @param {import('translation-internal').DatabaseDeinflection[]} deinflections
     * @param {Map<string, import('translation').FindTermDictionary>} enabledDictionaryMap
     * @param {import('dictionary').TermSourceMatchType} matchType
     * @returns {Promise<import('translation-internal').DatabaseDeinflection[]>}
     */
    async _getDictionaryDeinflections(deinflections, enabledDictionaryMap, matchType) {
        /** @type {import('translation-internal').DatabaseDeinflection[]} */
        const dictionaryDeinflections = [];
        for (const deinflection of deinflections) {
            const {originalText, transformedText, inflectionRuleChainCandidates: algorithmChains, databaseEntries} = deinflection;
            for (const entry of databaseEntries) {
                const {dictionary, definitions} = entry;
                const entryDictionary = enabledDictionaryMap.get(dictionary);
                const useDeinflections = entryDictionary?.useDeinflections ?? true;
                if (!useDeinflections) { continue; }
                for (const definition of definitions) {
                    if (Array.isArray(definition)) {
                        const [formOf, inflectionRules] = definition;
                        if (!formOf) { continue; }

                        const inflectionRuleChainCandidates = algorithmChains.map(({inflectionRules: algInflections}) => {
                            return {
                                source: /** @type {import('dictionary').InflectionSource} */ (algInflections.length === 0 ? 'dictionary' : 'both'),
                                inflectionRules: [...algInflections, ...inflectionRules]
                            };
                        });

                        const dictionaryDeinflection = this._createDeinflection(originalText, transformedText, formOf, 0, inflectionRuleChainCandidates);
                        dictionaryDeinflections.push(dictionaryDeinflection);
                    }
                }
            }
        }

        await this._addEntriesToDeinflections(dictionaryDeinflections, enabledDictionaryMap, matchType);

        return dictionaryDeinflections;
    }

    /**
     * @param {import('translation-internal').DatabaseDeinflection[]} deinflections
     * @param {Map<string, import('translation').FindTermDictionary>} enabledDictionaryMap
     * @param {import('dictionary').TermSourceMatchType} matchType
     */
    async _addEntriesToDeinflections(deinflections, enabledDictionaryMap, matchType) {
        const uniqueDeinflectionsMap = this._groupDeinflectionsByTerm(deinflections);
        const uniqueDeinflectionArrays = [...uniqueDeinflectionsMap.values()];
        const uniqueDeinflectionTerms = [...uniqueDeinflectionsMap.keys()];

        const databaseEntries = await this._database.findTermsBulk(uniqueDeinflectionTerms, enabledDictionaryMap, matchType);
        this._matchEntriesToDeinflections(databaseEntries, uniqueDeinflectionArrays, enabledDictionaryMap);
    }

    /**
     * @param {import('translation-internal').DatabaseDeinflection[]} deinflections
     * @returns {Map<string, import('translation-internal').DatabaseDeinflection[]>}
     */
    _groupDeinflectionsByTerm(deinflections) {
        const result = new Map();
        for (const deinflection of deinflections) {
            const {deinflectedText} = deinflection;
            let deinflectionArray = result.get(deinflectedText);
            if (typeof deinflectionArray === 'undefined') {
                deinflectionArray = [];
                result.set(deinflectedText, deinflectionArray);
            }
            deinflectionArray.push(deinflection);
        }
        return result;
    }

    /**
     * @param {import('dictionary-database').TermEntry[]} databaseEntries
     * @param {import('translation-internal').DatabaseDeinflection[][]} uniqueDeinflectionArrays
     * @param {Map<string, import('translation').FindTermDictionary>} enabledDictionaryMap
     */
    _matchEntriesToDeinflections(databaseEntries, uniqueDeinflectionArrays, enabledDictionaryMap) {
        for (const databaseEntry of databaseEntries) {
            const entryDictionary = /** @type {import('translation').FindTermDictionary} */ (enabledDictionaryMap.get(databaseEntry.dictionary));
            const {partsOfSpeechFilter} = entryDictionary;

            const definitionRules = Deinflector.rulesToRuleFlags(databaseEntry.rules);
            for (const deinflection of uniqueDeinflectionArrays[databaseEntry.index]) {
                const deinflectionRules = deinflection.rules;
                if (!partsOfSpeechFilter || Deinflector.rulesMatch(deinflectionRules, definitionRules)) {
                    deinflection.databaseEntries.push(databaseEntry);
                }
            }
        }
    }

    // Deinflections and text transformations

    /**
     * @param {string} text
     * @param {import('translation').FindTermsOptions} options
     * @returns {import('translation-internal').DatabaseDeinflection[]}
     */
    _getAlgorithmDeinflections(text, options) {
        /** @type {import('translation-internal').TextDeinflectionOptionsArrays} */
        const textOptionVariantArray = [
            this._getTextReplacementsVariants(options),
            this._getTextOptionEntryVariants(options.convertHalfWidthCharacters),
            this._getTextOptionEntryVariants(options.convertNumericCharacters),
            this._getTextOptionEntryVariants(options.convertAlphabeticCharacters),
            this._getTextOptionEntryVariants(options.convertHiraganaToKatakana),
            this._getTextOptionEntryVariants(options.convertKatakanaToHiragana),
            this._getCollapseEmphaticOptions(options)
        ];

        const jp = this._japaneseUtil;
        /** @type {import('translation-internal').DatabaseDeinflection[]} */
        const deinflections = [];
        const used = new Set();
        for (const [textReplacements, halfWidth, numeric, alphabetic, katakana, hiragana, [collapseEmphatic, collapseEmphaticFull]] of /** @type {Generator<import('translation-internal').TextDeinflectionOptions, void, unknown>} */ (this._getArrayVariants(textOptionVariantArray))) {
            let text2 = text;
            const sourceMap = new TextSourceMap(text2);
            if (textReplacements !== null) {
                text2 = this._applyTextReplacements(text2, sourceMap, textReplacements);
            }
            if (halfWidth) {
                text2 = jp.convertHalfWidthKanaToFullWidth(text2, sourceMap);
            }
            if (numeric) {
                text2 = jp.convertNumericToFullWidth(text2);
            }
            if (alphabetic) {
                text2 = jp.convertAlphabeticToKana(text2, sourceMap);
            }
            if (katakana) {
                text2 = jp.convertHiraganaToKatakana(text2);
            }
            if (hiragana) {
                text2 = jp.convertKatakanaToHiragana(text2);
            }
            if (collapseEmphatic) {
                text2 = jp.collapseEmphaticSequences(text2, collapseEmphaticFull, sourceMap);
            }

            for (
                let source = text2, i = text2.length;
                i > 0;
                i = this._getNextSubstringLength(options.searchResolution, i, source)
            ) {
                source = text2.substring(0, i);
                if (used.has(source)) { break; }
                used.add(source);
                const rawSource = sourceMap.source.substring(0, sourceMap.getSourceLength(i));
                for (const {term, rules, reasons} of /** @type {Deinflector} */ (this._deinflector).deinflect(source)) {
                    /** @type {import('dictionary').InflectionRuleChainCandidate} */
                    const inflectionRuleChainCandidate = {
                        source: 'algorithm',
                        inflectionRules: reasons
                    };
                    deinflections.push(this._createDeinflection(rawSource, source, term, rules, [inflectionRuleChainCandidate]));
                }
            }
        }
        return deinflections;
    }

    /**
     * @param {string} searchResolution
     * @param {number} currentLength
     * @param {string} source
     * @returns {number}
     */
    _getNextSubstringLength(searchResolution, currentLength, source) {
        if (searchResolution === 'word') {
            return source.search(/[^\p{Letter}][\p{Letter}\p{Number}]*$/u);
        } else {
            return currentLength - 1;
        }
    }

    /**
     * @param {string} text
     * @param {TextSourceMap} sourceMap
     * @param {import('translation').FindTermsTextReplacement[]} replacements
     * @returns {string}
     */
    _applyTextReplacements(text, sourceMap, replacements) {
        for (const {pattern, replacement} of replacements) {
            text = RegexUtil.applyTextReplacement(text, sourceMap, pattern, replacement);
        }
        return text;
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    _getJapaneseOnlyText(text) {
        const jp = this._japaneseUtil;
        let length = 0;
        for (const c of text) {
            if (!jp.isCodePointJapanese(/** @type {number} */ (c.codePointAt(0)))) {
                return text.substring(0, length);
            }
            length += c.length;
        }
        return text;
    }

    /**
     * @param {import('translation').FindTermsVariantMode} value
     * @returns {boolean[]}
     */
    _getTextOptionEntryVariants(value) {
        switch (value) {
            case 'true': return [true];
            case 'variant': return [false, true];
            default: return [false];
        }
    }

    /**
     * @param {import('translation').FindTermsOptions} options
     * @returns {[collapseEmphatic: boolean, collapseEmphaticFull: boolean][]}
     */
    _getCollapseEmphaticOptions(options) {
        /** @type {[collapseEmphatic: boolean, collapseEmphaticFull: boolean][]} */
        const collapseEmphaticOptions = [[false, false]];
        switch (options.collapseEmphaticSequences) {
            case 'true':
                collapseEmphaticOptions.push([true, false]);
                break;
            case 'full':
                collapseEmphaticOptions.push([true, false], [true, true]);
                break;
        }
        return collapseEmphaticOptions;
    }

    /**
     * @param {import('translation').FindTermsOptions} options
     * @returns {(import('translation').FindTermsTextReplacement[] | null)[]}
     */
    _getTextReplacementsVariants(options) {
        return options.textReplacements;
    }

    /**
     * @param {string} originalText
     * @param {string} transformedText
     * @param {string} deinflectedText
     * @param {import('translation-internal').DeinflectionRuleFlags} rules
     * @param {import('dictionary').InflectionRuleChainCandidate[]} inflectionRuleChainCandidates
     * @returns {import('translation-internal').DatabaseDeinflection}
     */
    _createDeinflection(originalText, transformedText, deinflectedText, rules, inflectionRuleChainCandidates) {
        return {originalText, transformedText, deinflectedText, rules, inflectionRuleChainCandidates, databaseEntries: []};
    }

    // Term dictionary entry grouping

    /**
     * @param {import('dictionary').TermDictionaryEntry[]} dictionaryEntries
     * @param {string} mainDictionary
     * @param {import('translation').TermEnabledDictionaryMap} enabledDictionaryMap
     * @param {TranslatorTagAggregator} tagAggregator
     * @returns {Promise<import('dictionary').TermDictionaryEntry[]>}
     */
    async _getRelatedDictionaryEntries(dictionaryEntries, mainDictionary, enabledDictionaryMap, tagAggregator) {
        /** @type {import('translator').SequenceQuery[]} */
        const sequenceList = [];
        /** @type {import('translator').DictionaryEntryGroup[]} */
        const groupedDictionaryEntries = [];
        /** @type {Map<number, import('translator').DictionaryEntryGroup>} */
        const groupedDictionaryEntriesMap = new Map();
        /** @type {Map<number, import('dictionary').TermDictionaryEntry>} */
        const ungroupedDictionaryEntriesMap = new Map();
        for (const dictionaryEntry of dictionaryEntries) {
            const {definitions: [{id, dictionary, sequences: [sequence]}]} = dictionaryEntry;
            if (mainDictionary === dictionary && sequence >= 0) {
                let group = groupedDictionaryEntriesMap.get(sequence);
                if (typeof group === 'undefined') {
                    group = {
                        ids: new Set(),
                        dictionaryEntries: []
                    };
                    sequenceList.push({query: sequence, dictionary});
                    groupedDictionaryEntries.push(group);
                    groupedDictionaryEntriesMap.set(sequence, group);
                }
                group.dictionaryEntries.push(dictionaryEntry);
                group.ids.add(id);
            } else {
                ungroupedDictionaryEntriesMap.set(id, dictionaryEntry);
            }
        }

        if (sequenceList.length > 0) {
            const secondarySearchDictionaryMap = this._getSecondarySearchDictionaryMap(enabledDictionaryMap);
            await this._addRelatedDictionaryEntries(groupedDictionaryEntries, ungroupedDictionaryEntriesMap, sequenceList, enabledDictionaryMap, tagAggregator);
            for (const group of groupedDictionaryEntries) {
                this._sortTermDictionaryEntriesById(group.dictionaryEntries);
            }
            if (ungroupedDictionaryEntriesMap.size !== 0 || secondarySearchDictionaryMap.size !== 0) {
                await this._addSecondaryRelatedDictionaryEntries(groupedDictionaryEntries, ungroupedDictionaryEntriesMap, enabledDictionaryMap, secondarySearchDictionaryMap, tagAggregator);
            }
        }

        const newDictionaryEntries = [];
        for (const group of groupedDictionaryEntries) {
            newDictionaryEntries.push(this._createGroupedDictionaryEntry(group.dictionaryEntries, true, tagAggregator));
        }
        newDictionaryEntries.push(...this._groupDictionaryEntriesByHeadword(ungroupedDictionaryEntriesMap.values(), tagAggregator));
        return newDictionaryEntries;
    }

    /**
     * @param {import('translator').DictionaryEntryGroup[]} groupedDictionaryEntries
     * @param {Map<number, import('dictionary').TermDictionaryEntry>} ungroupedDictionaryEntriesMap
     * @param {import('translator').SequenceQuery[]} sequenceList
     * @param {import('translation').TermEnabledDictionaryMap} enabledDictionaryMap
     * @param {TranslatorTagAggregator} tagAggregator
     */
    async _addRelatedDictionaryEntries(groupedDictionaryEntries, ungroupedDictionaryEntriesMap, sequenceList, enabledDictionaryMap, tagAggregator) {
        const databaseEntries = await this._database.findTermsBySequenceBulk(sequenceList);
        for (const databaseEntry of databaseEntries) {
            const {dictionaryEntries, ids} = groupedDictionaryEntries[databaseEntry.index];
            const {id} = databaseEntry;
            if (ids.has(id)) { continue; }

            const {term} = databaseEntry;
            const dictionaryEntry = this._createTermDictionaryEntryFromDatabaseEntry(databaseEntry, term, term, term, [], false, enabledDictionaryMap, tagAggregator);
            dictionaryEntries.push(dictionaryEntry);
            ids.add(id);
            ungroupedDictionaryEntriesMap.delete(id);
        }
    }

    /**
     * @param {import('translator').DictionaryEntryGroup[]} groupedDictionaryEntries
     * @param {Map<number, import('dictionary').TermDictionaryEntry>} ungroupedDictionaryEntriesMap
     * @param {import('translation').TermEnabledDictionaryMap} enabledDictionaryMap
     * @param {import('translation').TermEnabledDictionaryMap} secondarySearchDictionaryMap
     * @param {TranslatorTagAggregator} tagAggregator
     */
    async _addSecondaryRelatedDictionaryEntries(groupedDictionaryEntries, ungroupedDictionaryEntriesMap, enabledDictionaryMap, secondarySearchDictionaryMap, tagAggregator) {
        // Prepare grouping info
        /** @type {import('dictionary-database').TermExactRequest[]} */
        const termList = [];
        const targetList = [];
        const targetMap = new Map();

        for (const group of groupedDictionaryEntries) {
            const {dictionaryEntries} = group;
            for (const dictionaryEntry of dictionaryEntries) {
                const {term, reading} = dictionaryEntry.headwords[0];
                const key = this._createMapKey([term, reading]);
                let target = targetMap.get(key);
                if (typeof target === 'undefined') {
                    target = {
                        groups: []
                    };
                    targetMap.set(key, target);
                    termList.push({term, reading});
                    targetList.push(target);
                }
                target.groups.push(group);
            }
        }

        // Group unsequenced dictionary entries with sequenced entries that have a matching [term, reading].
        for (const [id, dictionaryEntry] of ungroupedDictionaryEntriesMap.entries()) {
            const {term, reading} = dictionaryEntry.headwords[0];
            const key = this._createMapKey([term, reading]);
            const target = targetMap.get(key);
            if (typeof target === 'undefined') { continue; }

            for (const {ids, dictionaryEntries} of target.groups) {
                if (ids.has(id)) { continue; }
                dictionaryEntries.push(dictionaryEntry);
                ids.add(id);
            }
            ungroupedDictionaryEntriesMap.delete(id);
        }

        // Search database for additional secondary terms
        if (termList.length === 0 || secondarySearchDictionaryMap.size === 0) { return; }

        const databaseEntries = await this._database.findTermsExactBulk(termList, secondarySearchDictionaryMap);
        this._sortDatabaseEntriesByIndex(databaseEntries);

        for (const databaseEntry of databaseEntries) {
            const {index, id} = databaseEntry;
            const sourceText = termList[index].term;
            const target = targetList[index];
            for (const {ids, dictionaryEntries} of target.groups) {
                if (ids.has(id)) { continue; }

                const dictionaryEntry = this._createTermDictionaryEntryFromDatabaseEntry(databaseEntry, sourceText, sourceText, sourceText, [], false, enabledDictionaryMap, tagAggregator);
                dictionaryEntries.push(dictionaryEntry);
                ids.add(id);
                ungroupedDictionaryEntriesMap.delete(id);
            }
        }
    }

    /**
     * @param {Iterable<import('dictionary').TermDictionaryEntry>} dictionaryEntries
     * @param {TranslatorTagAggregator} tagAggregator
     * @returns {import('dictionary').TermDictionaryEntry[]}
     */
    _groupDictionaryEntriesByHeadword(dictionaryEntries, tagAggregator) {
        const groups = new Map();
        for (const dictionaryEntry of dictionaryEntries) {
            const {inflectionRuleChainCandidates, headwords: [{term, reading}]} = dictionaryEntry;
            const key = this._createMapKey([term, reading, ...inflectionRuleChainCandidates]);
            let groupDictionaryEntries = groups.get(key);
            if (typeof groupDictionaryEntries === 'undefined') {
                groupDictionaryEntries = [];
                groups.set(key, groupDictionaryEntries);
            }
            groupDictionaryEntries.push(dictionaryEntry);
        }

        const newDictionaryEntries = [];
        for (const groupDictionaryEntries of groups.values()) {
            newDictionaryEntries.push(this._createGroupedDictionaryEntry(groupDictionaryEntries, false, tagAggregator));
        }
        return newDictionaryEntries;
    }

    // Removing data

    /**
     * @param {import('dictionary').TermDictionaryEntry[]} dictionaryEntries
     * @param {Set<string>} excludeDictionaryDefinitions
     */
    _removeExcludedDefinitions(dictionaryEntries, excludeDictionaryDefinitions) {
        for (let i = dictionaryEntries.length - 1; i >= 0; --i) {
            const dictionaryEntry = dictionaryEntries[i];
            const {definitions, pronunciations, frequencies, headwords} = dictionaryEntry;
            const definitionsChanged = this._removeArrayItemsWithDictionary(definitions, excludeDictionaryDefinitions);
            this._removeArrayItemsWithDictionary(pronunciations, excludeDictionaryDefinitions);
            this._removeArrayItemsWithDictionary(frequencies, excludeDictionaryDefinitions);
            this._removeTagGroupsWithDictionary(definitions, excludeDictionaryDefinitions);
            this._removeTagGroupsWithDictionary(headwords, excludeDictionaryDefinitions);

            if (!definitionsChanged) { continue; }

            if (definitions.length === 0) {
                dictionaryEntries.splice(i, 1);
            } else {
                this._removeUnusedHeadwords(dictionaryEntry);
            }
        }
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     */
    _removeUnusedHeadwords(dictionaryEntry) {
        const {definitions, pronunciations, frequencies, headwords} = dictionaryEntry;
        const removeHeadwordIndices = new Set();
        for (let i = 0, ii = headwords.length; i < ii; ++i) {
            removeHeadwordIndices.add(i);
        }
        for (const {headwordIndices} of definitions) {
            for (const headwordIndex of headwordIndices) {
                removeHeadwordIndices.delete(headwordIndex);
            }
        }

        if (removeHeadwordIndices.size === 0) { return; }

        /** @type {Map<number, number>} */
        const indexRemap = new Map();
        let oldIndex = 0;
        for (let i = 0, ii = headwords.length; i < ii; ++i) {
            if (removeHeadwordIndices.has(oldIndex)) {
                headwords.splice(i, 1);
                --i;
                --ii;
            } else {
                indexRemap.set(oldIndex, indexRemap.size);
            }
            ++oldIndex;
        }

        this._updateDefinitionHeadwordIndices(definitions, indexRemap);
        this._updateArrayItemsHeadwordIndex(pronunciations, indexRemap);
        this._updateArrayItemsHeadwordIndex(frequencies, indexRemap);
    }

    /**
     * @param {import('dictionary').TermDefinition[]} definitions
     * @param {Map<number, number>} indexRemap
     */
    _updateDefinitionHeadwordIndices(definitions, indexRemap) {
        for (const {headwordIndices} of definitions) {
            for (let i = headwordIndices.length - 1; i >= 0; --i) {
                const newHeadwordIndex = indexRemap.get(headwordIndices[i]);
                if (typeof newHeadwordIndex === 'undefined') {
                    headwordIndices.splice(i, 1);
                } else {
                    headwordIndices[i] = newHeadwordIndex;
                }
            }
        }
    }

    /**
     * @param {import('dictionary').TermPronunciation[]|import('dictionary').TermFrequency[]} array
     * @param {Map<number, number>} indexRemap
     */
    _updateArrayItemsHeadwordIndex(array, indexRemap) {
        for (let i = array.length - 1; i >= 0; --i) {
            const item = array[i];
            const {headwordIndex} = item;
            const newHeadwordIndex = indexRemap.get(headwordIndex);
            if (typeof newHeadwordIndex === 'undefined') {
                array.splice(i, 1);
            } else {
                item.headwordIndex = newHeadwordIndex;
            }
        }
    }

    /**
     * @param {import('dictionary').TermPronunciation[]|import('dictionary').TermFrequency[]|import('dictionary').TermDefinition[]} array
     * @param {Set<string>} excludeDictionaryDefinitions
     * @returns {boolean}
     */
    _removeArrayItemsWithDictionary(array, excludeDictionaryDefinitions) {
        let changed = false;
        for (let j = array.length - 1; j >= 0; --j) {
            const {dictionary} = array[j];
            if (!excludeDictionaryDefinitions.has(dictionary)) { continue; }
            array.splice(j, 1);
            changed = true;
        }
        return changed;
    }

    /**
     * @param {import('dictionary').Tag[]} array
     * @param {Set<string>} excludeDictionaryDefinitions
     * @returns {boolean}
     */
    _removeArrayItemsWithDictionary2(array, excludeDictionaryDefinitions) {
        let changed = false;
        for (let j = array.length - 1; j >= 0; --j) {
            const {dictionaries} = array[j];
            if (this._hasAny(excludeDictionaryDefinitions, dictionaries)) { continue; }
            array.splice(j, 1);
            changed = true;
        }
        return changed;
    }

    /**
     * @param {import('dictionary').TermDefinition[]|import('dictionary').TermHeadword[]} array
     * @param {Set<string>} excludeDictionaryDefinitions
     */
    _removeTagGroupsWithDictionary(array, excludeDictionaryDefinitions) {
        for (const {tags} of array) {
            this._removeArrayItemsWithDictionary2(tags, excludeDictionaryDefinitions);
        }
    }

    // Tags

    /**
     * @param {import('translator').TagExpansionTarget[]} tagExpansionTargets
     */
    async _expandTagGroupsAndGroup(tagExpansionTargets) {
        await this._expandTagGroups(tagExpansionTargets);
        this._groupTags(tagExpansionTargets);
    }

    /**
     * @param {import('translator').TagExpansionTarget[]} tagTargets
     */
    async _expandTagGroups(tagTargets) {
        const allItems = [];
        /** @type {import('translator').TagTargetMap} */
        const targetMap = new Map();
        for (const {tagGroups, tags} of tagTargets) {
            for (const {dictionary, tagNames} of tagGroups) {
                let dictionaryItems = targetMap.get(dictionary);
                if (typeof dictionaryItems === 'undefined') {
                    dictionaryItems = new Map();
                    targetMap.set(dictionary, dictionaryItems);
                }
                for (const tagName of tagNames) {
                    let item = dictionaryItems.get(tagName);
                    if (typeof item === 'undefined') {
                        const query = this._getNameBase(tagName);
                        item = {query, dictionary, tagName, cache: null, databaseTag: null, targets: []};
                        dictionaryItems.set(tagName, item);
                        allItems.push(item);
                    }
                    item.targets.push(tags);
                }
            }
        }

        const nonCachedItems = [];
        const tagCache = this._tagCache;
        for (const [dictionary, dictionaryItems] of targetMap.entries()) {
            let cache = tagCache.get(dictionary);
            if (typeof cache === 'undefined') {
                cache = new Map();
                tagCache.set(dictionary, cache);
            }
            for (const item of dictionaryItems.values()) {
                const databaseTag = cache.get(item.query);
                if (typeof databaseTag !== 'undefined') {
                    item.databaseTag = databaseTag;
                } else {
                    item.cache = cache;
                    nonCachedItems.push(item);
                }
            }
        }

        const nonCachedItemCount = nonCachedItems.length;
        if (nonCachedItemCount > 0) {
            const databaseTags = await this._database.findTagMetaBulk(nonCachedItems);
            for (let i = 0; i < nonCachedItemCount; ++i) {
                const item = nonCachedItems[i];
                const databaseTag = databaseTags[i];
                const databaseTag2 = typeof databaseTag !== 'undefined' ? databaseTag : null;
                item.databaseTag = databaseTag2;
                if (item.cache !== null) {
                    item.cache.set(item.query, databaseTag2);
                }
            }
        }

        for (const {dictionary, tagName, databaseTag, targets} of allItems) {
            for (const tags of targets) {
                tags.push(this._createTag(databaseTag, tagName, dictionary));
            }
        }
    }

    /**
     * @param {import('translator').TagExpansionTarget[]} tagTargets
     */
    _groupTags(tagTargets) {
        const stringComparer = this._stringComparer;
        /**
         * @param {import('dictionary').Tag} v1
         * @param {import('dictionary').Tag} v2
         * @returns {number}
         */
        const compare = (v1, v2) => {
            const i = v1.order - v2.order;
            return i !== 0 ? i : stringComparer.compare(v1.name, v2.name);
        };

        for (const {tags} of tagTargets) {
            if (tags.length <= 1) { continue; }
            this._mergeSimilarTags(tags);
            tags.sort(compare);
        }
    }

    /**
     * @param {import('dictionary').Tag[]} tags
     */
    _mergeSimilarTags(tags) {
        let tagCount = tags.length;
        for (let i = 0; i < tagCount; ++i) {
            const tag1 = tags[i];
            const {category, name} = tag1;
            for (let j = i + 1; j < tagCount; ++j) {
                const tag2 = tags[j];
                if (tag2.name !== name || tag2.category !== category) { continue; }
                // Merge tag
                tag1.order = Math.min(tag1.order, tag2.order);
                tag1.score = Math.max(tag1.score, tag2.score);
                tag1.dictionaries.push(...tag2.dictionaries);
                this._addUniqueSimple(tag1.content, tag2.content);
                tags.splice(j, 1);
                --tagCount;
                --j;
            }
        }
    }

    /**
     * @param {import('dictionary').Tag[]} tags
     * @param {string} category
     * @returns {string[]}
     */
    _getTagNamesWithCategory(tags, category) {
        const results = [];
        for (const tag of tags) {
            if (tag.category !== category) { continue; }
            results.push(tag.name);
        }
        results.sort();
        return results;
    }

    /**
     * @param {import('dictionary').TermDefinition[]} definitions
     */
    _flagRedundantDefinitionTags(definitions) {
        if (definitions.length === 0) { return; }

        let lastDictionary = null;
        let lastPartOfSpeech = '';
        const removeCategoriesSet = new Set();

        for (const {dictionary, tags} of definitions) {
            const partOfSpeech = this._createMapKey(this._getTagNamesWithCategory(tags, 'partOfSpeech'));

            if (lastDictionary !== dictionary) {
                lastDictionary = dictionary;
                lastPartOfSpeech = '';
            }

            if (lastPartOfSpeech === partOfSpeech) {
                removeCategoriesSet.add('partOfSpeech');
            } else {
                lastPartOfSpeech = partOfSpeech;
            }

            if (removeCategoriesSet.size > 0) {
                for (const tag of tags) {
                    if (removeCategoriesSet.has(tag.category)) {
                        tag.redundant = true;
                    }
                }
                removeCategoriesSet.clear();
            }
        }
    }

    // Metadata

    /**
     * @param {import('dictionary').TermDictionaryEntry[]} dictionaryEntries
     * @param {import('translation').TermEnabledDictionaryMap} enabledDictionaryMap
     * @param {TranslatorTagAggregator} tagAggregator
     */
    async _addTermMeta(dictionaryEntries, enabledDictionaryMap, tagAggregator) {
        const headwordMap = new Map();
        const headwordMapKeys = [];
        const headwordReadingMaps = [];

        for (const {headwords, pronunciations, frequencies} of dictionaryEntries) {
            for (let i = 0, ii = headwords.length; i < ii; ++i) {
                const {term, reading} = headwords[i];
                let readingMap = headwordMap.get(term);
                if (typeof readingMap === 'undefined') {
                    readingMap = new Map();
                    headwordMap.set(term, readingMap);
                    headwordMapKeys.push(term);
                    headwordReadingMaps.push(readingMap);
                }
                let targets = readingMap.get(reading);
                if (typeof targets === 'undefined') {
                    targets = [];
                    readingMap.set(reading, targets);
                }
                targets.push({headwordIndex: i, pronunciations, frequencies});
            }
        }

        const metas = await this._database.findTermMetaBulk(headwordMapKeys, enabledDictionaryMap);
        for (const {mode, data, dictionary, index} of metas) {
            const {index: dictionaryIndex, priority: dictionaryPriority} = this._getDictionaryOrder(dictionary, enabledDictionaryMap);
            const map2 = headwordReadingMaps[index];
            for (const [reading, targets] of map2.entries()) {
                switch (mode) {
                    case 'freq':
                        {
                            const hasReading = (data !== null && typeof data === 'object' && typeof data.reading === 'string');
                            if (hasReading && data.reading !== reading) { continue; }
                            const frequency = hasReading ? data.frequency : /** @type {import('dictionary-data').GenericFrequencyData} */ (data);
                            for (const {frequencies, headwordIndex} of targets) {
                                const {frequency: frequencyValue, displayValue, displayValueParsed} = this._getFrequencyInfo(frequency);
                                frequencies.push(this._createTermFrequency(
                                    frequencies.length,
                                    headwordIndex,
                                    dictionary,
                                    dictionaryIndex,
                                    dictionaryPriority,
                                    hasReading,
                                    frequencyValue,
                                    displayValue,
                                    displayValueParsed
                                ));
                            }
                        }
                        break;
                    case 'pitch':
                        {
                            if (data.reading !== reading) { continue; }
                            /** @type {import('dictionary').PitchAccent[]} */
                            const pitches = [];
                            for (const {position, tags, nasal, devoice} of data.pitches) {
                                /** @type {import('dictionary').Tag[]} */
                                const tags2 = [];
                                if (Array.isArray(tags)) {
                                    tagAggregator.addTags(tags2, dictionary, tags);
                                }
                                const nasalPositions = this._toNumberArray(nasal);
                                const devoicePositions = this._toNumberArray(devoice);
                                pitches.push({
                                    type: 'pitch-accent',
                                    position,
                                    nasalPositions,
                                    devoicePositions,
                                    tags: tags2
                                });
                            }
                            for (const {pronunciations, headwordIndex} of targets) {
                                pronunciations.push(this._createTermPronunciation(
                                    pronunciations.length,
                                    headwordIndex,
                                    dictionary,
                                    dictionaryIndex,
                                    dictionaryPriority,
                                    pitches
                                ));
                            }
                        }
                        break;
                    case 'ipa':
                    {
                        if (data.reading !== reading) { continue; }
                        /** @type {import('dictionary').PhoneticTranscription[]} */
                        const phoneticTranscriptions = [];
                        for (const {ipa, tags} of data.transcriptions) {
                            /** @type {import('dictionary').Tag[]} */
                            const tags2 = [];
                            if (Array.isArray(tags)) {
                                tagAggregator.addTags(tags2, dictionary, tags);
                            }
                            phoneticTranscriptions.push({
                                type: 'phonetic-transcription',
                                ipa,
                                tags: tags2
                            });
                        }
                        for (const {pronunciations, headwordIndex} of targets) {
                            pronunciations.push(this._createTermPronunciation(
                                pronunciations.length,
                                headwordIndex,
                                dictionary,
                                dictionaryIndex,
                                dictionaryPriority,
                                phoneticTranscriptions
                            ));
                        }
                    }
                }
            }
        }
    }

    /**
     * @param {import('dictionary').KanjiDictionaryEntry[]} dictionaryEntries
     * @param {import('translation').KanjiEnabledDictionaryMap} enabledDictionaryMap
     */
    async _addKanjiMeta(dictionaryEntries, enabledDictionaryMap) {
        const kanjiList = [];
        for (const {character} of dictionaryEntries) {
            kanjiList.push(character);
        }

        const metas = await this._database.findKanjiMetaBulk(kanjiList, enabledDictionaryMap);
        for (const {character, mode, data, dictionary, index} of metas) {
            const {index: dictionaryIndex, priority: dictionaryPriority} = this._getDictionaryOrder(dictionary, enabledDictionaryMap);
            switch (mode) {
                case 'freq':
                    {
                        const {frequencies} = dictionaryEntries[index];
                        const {frequency, displayValue, displayValueParsed} = this._getFrequencyInfo(data);
                        frequencies.push(this._createKanjiFrequency(
                            frequencies.length,
                            dictionary,
                            dictionaryIndex,
                            dictionaryPriority,
                            character,
                            frequency,
                            displayValue,
                            displayValueParsed
                        ));
                    }
                    break;
            }
        }
    }

    /**
     * @param {{[key: string]: (string|number)}} stats
     * @param {string} dictionary
     * @returns {Promise<import('dictionary').KanjiStatGroups>}
     */
    async _expandKanjiStats(stats, dictionary) {
        const statsEntries = Object.entries(stats);
        const items = [];
        for (const [name] of statsEntries) {
            const query = this._getNameBase(name);
            items.push({query, dictionary});
        }

        const databaseInfos = await this._database.findTagMetaBulk(items);

        /** @type {Map<string, import('dictionary').KanjiStat[]>} */
        const statsGroups = new Map();
        for (let i = 0, ii = statsEntries.length; i < ii; ++i) {
            const databaseInfo = databaseInfos[i];
            if (typeof databaseInfo === 'undefined') { continue; }

            const [name, value] = statsEntries[i];
            const {category} = databaseInfo;
            let group = statsGroups.get(category);
            if (typeof group === 'undefined') {
                group = [];
                statsGroups.set(category, group);
            }

            group.push(this._createKanjiStat(name, value, databaseInfo, dictionary));
        }

        /** @type {import('dictionary').KanjiStatGroups} */
        const groupedStats = {};
        for (const [category, group] of statsGroups.entries()) {
            this._sortKanjiStats(group);
            groupedStats[category] = group;
        }
        return groupedStats;
    }

    /**
     * @param {import('dictionary').KanjiStat[]} stats
     */
    _sortKanjiStats(stats) {
        if (stats.length <= 1) { return; }
        const stringComparer = this._stringComparer;
        stats.sort((v1, v2) => {
            const i = v1.order - v2.order;
            return (i !== 0) ? i : stringComparer.compare(v1.content, v2.content);
        });
    }

    /**
     * @param {string} value
     * @returns {number}
     */
    _convertStringToNumber(value) {
        const match = this._numberRegex.exec(value);
        if (match === null) { return 0; }
        const result = Number.parseFloat(match[0]);
        return Number.isFinite(result) ? result : 0;
    }

    /**
     * @param {import('dictionary-data').GenericFrequencyData} frequency
     * @returns {{frequency: number, displayValue: ?string, displayValueParsed: boolean}}
     */
    _getFrequencyInfo(frequency) {
        let frequencyValue = 0;
        let displayValue = null;
        let displayValueParsed = false;
        if (typeof frequency === 'object' && frequency !== null) {
            const {value: frequencyValue2, displayValue: displayValue2} = frequency;
            if (typeof frequencyValue2 === 'number') { frequencyValue = frequencyValue2; }
            if (typeof displayValue2 === 'string') { displayValue = displayValue2; }
        } else {
            switch (typeof frequency) {
                case 'number':
                    frequencyValue = frequency;
                    break;
                case 'string':
                    displayValue = frequency;
                    displayValueParsed = true;
                    frequencyValue = this._convertStringToNumber(frequency);
                    break;
            }
        }
        return {frequency: frequencyValue, displayValue, displayValueParsed};
    }

    // Helpers

    /**
     * @param {string} name
     * @returns {string}
     */
    _getNameBase(name) {
        const pos = name.indexOf(':');
        return (pos >= 0 ? name.substring(0, pos) : name);
    }

    /**
     * @param {import('translation').TermEnabledDictionaryMap} enabledDictionaryMap
     * @returns {import('translation').TermEnabledDictionaryMap}
     */
    _getSecondarySearchDictionaryMap(enabledDictionaryMap) {
        const secondarySearchDictionaryMap = new Map();
        for (const [dictionary, details] of enabledDictionaryMap.entries()) {
            if (!details.allowSecondarySearches) { continue; }
            secondarySearchDictionaryMap.set(dictionary, details);
        }
        return secondarySearchDictionaryMap;
    }

    /**
     * @param {string} dictionary
     * @param {import('translation').TermEnabledDictionaryMap|import('translation').KanjiEnabledDictionaryMap} enabledDictionaryMap
     * @returns {{index: number, priority: number}}
     */
    _getDictionaryOrder(dictionary, enabledDictionaryMap) {
        const info = enabledDictionaryMap.get(dictionary);
        const {index, priority} = typeof info !== 'undefined' ? info : {index: enabledDictionaryMap.size, priority: 0};
        return {index, priority};
    }

    /**
     * @param {[...args: unknown[][]]} arrayVariants
     * @yields {[...args: unknown[]]}
     * @returns {Generator<unknown[], void, unknown>}
     */
    *_getArrayVariants(arrayVariants) {
        const ii = arrayVariants.length;

        let total = 1;
        for (let i = 0; i < ii; ++i) {
            total *= arrayVariants[i].length;
        }

        for (let a = 0; a < total; ++a) {
            const variant = [];
            let index = a;
            for (let i = 0; i < ii; ++i) {
                const entryVariants = arrayVariants[i];
                variant.push(entryVariants[index % entryVariants.length]);
                index = Math.floor(index / entryVariants.length);
            }
            yield variant;
        }
    }

    /**
     * @param {unknown[]} array
     * @returns {string}
     */
    _createMapKey(array) {
        return JSON.stringify(array);
    }

    /**
     * @param {number|number[]|undefined} value
     * @returns {number[]}
     */
    _toNumberArray(value) {
        return Array.isArray(value) ? value : (typeof value === 'number' ? [value] : []);
    }

    // Kanji data

    /**
     * @param {string} name
     * @param {string|number} value
     * @param {import('dictionary-database').Tag} databaseInfo
     * @param {string} dictionary
     * @returns {import('dictionary').KanjiStat}
     */
    _createKanjiStat(name, value, databaseInfo, dictionary) {
        const {category, notes, order, score} = databaseInfo;
        return {
            name,
            category: (typeof category === 'string' && category.length > 0 ? category : 'default'),
            content: (typeof notes === 'string' ? notes : ''),
            order: (typeof order === 'number' ? order : 0),
            score: (typeof score === 'number' ? score : 0),
            dictionary,
            value
        };
    }

    /**
     * @param {number} index
     * @param {string} dictionary
     * @param {number} dictionaryIndex
     * @param {number} dictionaryPriority
     * @param {string} character
     * @param {number} frequency
     * @param {?string} displayValue
     * @param {boolean} displayValueParsed
     * @returns {import('dictionary').KanjiFrequency}
     */
    _createKanjiFrequency(index, dictionary, dictionaryIndex, dictionaryPriority, character, frequency, displayValue, displayValueParsed) {
        return {index, dictionary, dictionaryIndex, dictionaryPriority, character, frequency, displayValue, displayValueParsed};
    }

    /**
     * @param {string} character
     * @param {string} dictionary
     * @param {string[]} onyomi
     * @param {string[]} kunyomi
     * @param {import('dictionary').KanjiStatGroups} stats
     * @param {string[]} definitions
     * @returns {import('dictionary').KanjiDictionaryEntry}
     */
    _createKanjiDictionaryEntry(character, dictionary, onyomi, kunyomi, stats, definitions) {
        return {
            type: 'kanji',
            character,
            dictionary,
            onyomi,
            kunyomi,
            tags: [],
            stats,
            definitions,
            frequencies: []
        };
    }

    // Term data

    /**
     * @param {?import('dictionary-database').Tag} databaseTag
     * @param {string} name
     * @param {string} dictionary
     * @returns {import('dictionary').Tag}
     */
    _createTag(databaseTag, name, dictionary) {
        let category, notes, order, score;
        if (typeof databaseTag === 'object' && databaseTag !== null) {
            ({category, notes, order, score} = databaseTag);
        }
        return {
            name,
            category: (typeof category === 'string' && category.length > 0 ? category : 'default'),
            order: (typeof order === 'number' ? order : 0),
            score: (typeof score === 'number' ? score : 0),
            content: (typeof notes === 'string' && notes.length > 0 ? [notes] : []),
            dictionaries: [dictionary],
            redundant: false
        };
    }

    /**
     * @param {string} originalText
     * @param {string} transformedText
     * @param {string} deinflectedText
     * @param {import('dictionary').TermSourceMatchType} matchType
     * @param {import('dictionary').TermSourceMatchSource} matchSource
     * @param {boolean} isPrimary
     * @returns {import('dictionary').TermSource}
     */
    _createSource(originalText, transformedText, deinflectedText, matchType, matchSource, isPrimary) {
        return {originalText, transformedText, deinflectedText, matchType, matchSource, isPrimary};
    }

    /**
     * @param {number} index
     * @param {string} term
     * @param {string} reading
     * @param {import('dictionary').TermSource[]} sources
     * @param {import('dictionary').Tag[]} tags
     * @param {string[]} wordClasses
     * @returns {import('dictionary').TermHeadword}
     */
    _createTermHeadword(index, term, reading, sources, tags, wordClasses) {
        return {index, term, reading, sources, tags, wordClasses};
    }

    /**
     * @param {number} index
     * @param {number[]} headwordIndices
     * @param {string} dictionary
     * @param {number} dictionaryIndex
     * @param {number} dictionaryPriority
     * @param {number} id
     * @param {number} score
     * @param {number[]} sequences
     * @param {boolean} isPrimary
     * @param {import('dictionary').Tag[]} tags
     * @param {import('dictionary-data').TermGlossaryContent[]} entries
     * @returns {import('dictionary').TermDefinition}
     */
    _createTermDefinition(index, headwordIndices, dictionary, dictionaryIndex, dictionaryPriority, id, score, sequences, isPrimary, tags, entries) {
        return {
            index,
            headwordIndices,
            dictionary,
            dictionaryIndex,
            dictionaryPriority,
            id,
            score,
            frequencyOrder: 0,
            sequences,
            isPrimary,
            tags,
            entries
        };
    }

    /**
     * @param {number} index
     * @param {number} headwordIndex
     * @param {string} dictionary
     * @param {number} dictionaryIndex
     * @param {number} dictionaryPriority
     * @param {import('dictionary').Pronunciation[]} pronunciations
     * @returns {import('dictionary').TermPronunciation}
     */
    _createTermPronunciation(index, headwordIndex, dictionary, dictionaryIndex, dictionaryPriority, pronunciations) {
        return {index, headwordIndex, dictionary, dictionaryIndex, dictionaryPriority, pronunciations};
    }

    /**
     * @param {number} index
     * @param {number} headwordIndex
     * @param {string} dictionary
     * @param {number} dictionaryIndex
     * @param {number} dictionaryPriority
     * @param {boolean} hasReading
     * @param {number} frequency
     * @param {?string} displayValue
     * @param {boolean} displayValueParsed
     * @returns {import('dictionary').TermFrequency}
     */
    _createTermFrequency(index, headwordIndex, dictionary, dictionaryIndex, dictionaryPriority, hasReading, frequency, displayValue, displayValueParsed) {
        return {index, headwordIndex, dictionary, dictionaryIndex, dictionaryPriority, hasReading, frequency, displayValue, displayValueParsed};
    }

    /**
     * @param {boolean} isPrimary
     * @param {import('dictionary').InflectionRuleChainCandidate[]} inflectionRuleChainCandidates
     * @param {number} score
     * @param {number} dictionaryIndex
     * @param {number} dictionaryPriority
     * @param {number} sourceTermExactMatchCount
     * @param {number} maxTransformedTextLength
     * @param {import('dictionary').TermHeadword[]} headwords
     * @param {import('dictionary').TermDefinition[]} definitions
     * @returns {import('dictionary').TermDictionaryEntry}
     */
    _createTermDictionaryEntry(isPrimary, inflectionRuleChainCandidates, score, dictionaryIndex, dictionaryPriority, sourceTermExactMatchCount, maxTransformedTextLength, headwords, definitions) {
        return {
            type: 'term',
            isPrimary,
            inflectionRuleChainCandidates,
            score,
            frequencyOrder: 0,
            dictionaryIndex,
            dictionaryPriority,
            sourceTermExactMatchCount,
            maxTransformedTextLength,
            headwords,
            definitions,
            pronunciations: [],
            frequencies: []
        };
    }

    /**
     * @param {import('dictionary-database').TermEntry} databaseEntry
     * @param {string} originalText
     * @param {string} transformedText
     * @param {string} deinflectedText
     * @param {import('dictionary').InflectionRuleChainCandidate[]} inflectionRuleChainCandidates
     * @param {boolean} isPrimary
     * @param {Map<string, import('translation').FindTermDictionary>} enabledDictionaryMap
     * @param {TranslatorTagAggregator} tagAggregator
     * @returns {import('dictionary').TermDictionaryEntry}
     */
    _createTermDictionaryEntryFromDatabaseEntry(databaseEntry, originalText, transformedText, deinflectedText, inflectionRuleChainCandidates, isPrimary, enabledDictionaryMap, tagAggregator) {
        const {
            matchType,
            matchSource,
            term,
            reading: rawReading,
            definitionTags,
            termTags,
            definitions,
            score,
            dictionary,
            id,
            sequence: rawSequence,
            rules
        } = databaseEntry;
        // cast is safe because getDeinflections filters out deinflection definitions
        const contentDefinitions = /** @type {import('dictionary-data').TermGlossaryContent[]} */ (definitions);
        const reading = (rawReading.length > 0 ? rawReading : term);
        const {index: dictionaryIndex, priority: dictionaryPriority} = this._getDictionaryOrder(dictionary, enabledDictionaryMap);
        const sourceTermExactMatchCount = (isPrimary && deinflectedText === term ? 1 : 0);
        const source = this._createSource(originalText, transformedText, deinflectedText, matchType, matchSource, isPrimary);
        const maxTransformedTextLength = transformedText.length;
        const hasSequence = (rawSequence >= 0);
        const sequence = hasSequence ? rawSequence : -1;

        /** @type {import('dictionary').Tag[]} */
        const headwordTagGroups = [];
        /** @type {import('dictionary').Tag[]} */
        const definitionTagGroups = [];
        tagAggregator.addTags(headwordTagGroups, dictionary, termTags);
        tagAggregator.addTags(definitionTagGroups, dictionary, definitionTags);

        return this._createTermDictionaryEntry(
            isPrimary,
            inflectionRuleChainCandidates,
            score,
            dictionaryIndex,
            dictionaryPriority,
            sourceTermExactMatchCount,
            maxTransformedTextLength,
            [this._createTermHeadword(0, term, reading, [source], headwordTagGroups, rules)],
            [this._createTermDefinition(0, [0], dictionary, dictionaryIndex, dictionaryPriority, id, score, [sequence], isPrimary, definitionTagGroups, contentDefinitions)]
        );
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry[]} dictionaryEntries
     * @param {boolean} checkDuplicateDefinitions
     * @param {TranslatorTagAggregator} tagAggregator
     * @returns {import('dictionary').TermDictionaryEntry}
     */
    _createGroupedDictionaryEntry(dictionaryEntries, checkDuplicateDefinitions, tagAggregator) {
        // Headwords are generated before sorting, so that the order of dictionaryEntries can be maintained
        const definitionEntries = [];
        /** @type {Map<string, import('dictionary').TermHeadword>} */
        const headwords = new Map();
        for (const dictionaryEntry of dictionaryEntries) {
            const headwordIndexMap = this._addTermHeadwords(headwords, dictionaryEntry.headwords, tagAggregator);
            definitionEntries.push({index: definitionEntries.length, dictionaryEntry, headwordIndexMap});
        }

        // Sort
        if (definitionEntries.length <= 1) {
            checkDuplicateDefinitions = false;
        }

        // Merge dictionary entry data
        let score = Number.MIN_SAFE_INTEGER;
        let dictionaryIndex = Number.MAX_SAFE_INTEGER;
        let dictionaryPriority = Number.MIN_SAFE_INTEGER;
        let maxTransformedTextLength = 0;
        let isPrimary = false;
        /** @type {import('dictionary').TermDefinition[]} */
        const definitions = [];
        /** @type {?Map<string, import('dictionary').TermDefinition>} */
        const definitionsMap = checkDuplicateDefinitions ? new Map() : null;
        let inflections = null;

        for (const {dictionaryEntry, headwordIndexMap} of definitionEntries) {
            score = Math.max(score, dictionaryEntry.score);
            dictionaryIndex = Math.min(dictionaryIndex, dictionaryEntry.dictionaryIndex);
            dictionaryPriority = Math.max(dictionaryPriority, dictionaryEntry.dictionaryPriority);
            if (dictionaryEntry.isPrimary) {
                isPrimary = true;
                maxTransformedTextLength = Math.max(maxTransformedTextLength, dictionaryEntry.maxTransformedTextLength);
                const dictionaryEntryInflections = dictionaryEntry.inflectionRuleChainCandidates;
                if (inflections === null || dictionaryEntryInflections.length < inflections.length) {
                    inflections = dictionaryEntryInflections;
                }
            }
            if (definitionsMap !== null) {
                this._addTermDefinitions(definitions, definitionsMap, dictionaryEntry.definitions, headwordIndexMap, tagAggregator);
            } else {
                this._addTermDefinitionsFast(definitions, dictionaryEntry.definitions, headwordIndexMap);
            }
        }

        const headwordsArray = [...headwords.values()];

        let sourceTermExactMatchCount = 0;
        for (const {sources} of headwordsArray) {
            for (const source of sources) {
                if (source.isPrimary && source.matchSource === 'term') {
                    ++sourceTermExactMatchCount;
                    break;
                }
            }
        }

        return this._createTermDictionaryEntry(
            isPrimary,
            inflections !== null ? inflections : [],
            score,
            dictionaryIndex,
            dictionaryPriority,
            sourceTermExactMatchCount,
            maxTransformedTextLength,
            headwordsArray,
            definitions
        );
    }

    // Data collection addition functions

    /**
     * @template [T=unknown]
     * @param {T[]} list
     * @param {T[]} newItems
     */
    _addUniqueSimple(list, newItems) {
        for (const item of newItems) {
            if (!list.includes(item)) {
                list.push(item);
            }
        }
    }

    /**
     * @param {import('dictionary').TermSource[]} sources
     * @param {import('dictionary').TermSource[]} newSources
     */
    _addUniqueSources(sources, newSources) {
        if (newSources.length === 0) { return; }
        if (sources.length === 0) {
            sources.push(...newSources);
            return;
        }
        for (const newSource of newSources) {
            const {originalText, transformedText, deinflectedText, matchType, matchSource, isPrimary} = newSource;
            let has = false;
            for (const source of sources) {
                if (
                    source.deinflectedText === deinflectedText &&
                    source.transformedText === transformedText &&
                    source.originalText === originalText &&
                    source.matchType === matchType &&
                    source.matchSource === matchSource
                ) {
                    if (isPrimary) { source.isPrimary = true; }
                    has = true;
                    break;
                }
            }
            if (!has) {
                sources.push(newSource);
            }
        }
    }

    /**
     * @param {Map<string, import('dictionary').TermHeadword>} headwordsMap
     * @param {import('dictionary').TermHeadword[]} headwords
     * @param {TranslatorTagAggregator} tagAggregator
     * @returns {number[]}
     */
    _addTermHeadwords(headwordsMap, headwords, tagAggregator) {
        /** @type {number[]} */
        const headwordIndexMap = [];
        for (const {term, reading, sources, tags, wordClasses} of headwords) {
            const key = this._createMapKey([term, reading]);
            let headword = headwordsMap.get(key);
            if (typeof headword === 'undefined') {
                headword = this._createTermHeadword(headwordsMap.size, term, reading, [], [], []);
                headwordsMap.set(key, headword);
            }
            this._addUniqueSources(headword.sources, sources);
            this._addUniqueSimple(headword.wordClasses, wordClasses);
            tagAggregator.mergeTags(headword.tags, tags);
            headwordIndexMap.push(headword.index);
        }
        return headwordIndexMap;
    }

    /**
     * @param {number[]} headwordIndices
     * @param {number} headwordIndex
     */
    _addUniqueTermHeadwordIndex(headwordIndices, headwordIndex) {
        let end = headwordIndices.length;
        if (end === 0) {
            headwordIndices.push(headwordIndex);
            return;
        }

        let start = 0;
        while (start < end) {
            const mid = Math.floor((start + end) / 2);
            const value = headwordIndices[mid];
            if (headwordIndex === value) { return; }
            if (headwordIndex > value) {
                start = mid + 1;
            } else {
                end = mid;
            }
        }

        if (headwordIndex === headwordIndices[start]) { return; }
        headwordIndices.splice(start, 0, headwordIndex);
    }

    /**
     * @param {import('dictionary').TermDefinition[]} definitions
     * @param {import('dictionary').TermDefinition[]} newDefinitions
     * @param {number[]} headwordIndexMap
     */
    _addTermDefinitionsFast(definitions, newDefinitions, headwordIndexMap) {
        for (const {headwordIndices, dictionary, dictionaryIndex, dictionaryPriority, sequences, id, score, isPrimary, tags, entries} of newDefinitions) {
            const headwordIndicesNew = [];
            for (const headwordIndex of headwordIndices) {
                headwordIndicesNew.push(headwordIndexMap[headwordIndex]);
            }
            definitions.push(this._createTermDefinition(definitions.length, headwordIndicesNew, dictionary, dictionaryIndex, dictionaryPriority, id, score, sequences, isPrimary, tags, entries));
        }
    }

    /**
     * @param {import('dictionary').TermDefinition[]} definitions
     * @param {Map<string, import('dictionary').TermDefinition>} definitionsMap
     * @param {import('dictionary').TermDefinition[]} newDefinitions
     * @param {number[]} headwordIndexMap
     * @param {TranslatorTagAggregator} tagAggregator
     */
    _addTermDefinitions(definitions, definitionsMap, newDefinitions, headwordIndexMap, tagAggregator) {
        for (const {headwordIndices, dictionary, dictionaryIndex, dictionaryPriority, sequences, id, score, isPrimary, tags, entries} of newDefinitions) {
            const key = this._createMapKey([dictionary, ...entries]);
            let definition = definitionsMap.get(key);
            if (typeof definition === 'undefined') {
                definition = this._createTermDefinition(definitions.length, [], dictionary, dictionaryIndex, dictionaryPriority, id, score, [...sequences], isPrimary, [], [...entries]);
                definitions.push(definition);
                definitionsMap.set(key, definition);
            } else {
                if (isPrimary) {
                    definition.isPrimary = true;
                }
                this._addUniqueSimple(definition.sequences, sequences);
            }

            const newHeadwordIndices = definition.headwordIndices;
            for (const headwordIndex of headwordIndices) {
                this._addUniqueTermHeadwordIndex(newHeadwordIndices, headwordIndexMap[headwordIndex]);
            }
            tagAggregator.mergeTags(definition.tags, tags);
        }
    }

    // Sorting functions

    /**
     * @param {import('dictionary-database').TermEntry[]|import('dictionary-database').KanjiEntry[]} databaseEntries
     */
    _sortDatabaseEntriesByIndex(databaseEntries) {
        if (databaseEntries.length <= 1) { return; }
        /**
         * @param {import('dictionary-database').TermEntry|import('dictionary-database').KanjiEntry} v1
         * @param {import('dictionary-database').TermEntry|import('dictionary-database').KanjiEntry} v2
         * @returns {number}
         */
        const compareFunction = (v1, v2) => v1.index - v2.index;
        databaseEntries.sort(compareFunction);
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry[]} dictionaryEntries
     */
    _sortTermDictionaryEntries(dictionaryEntries) {
        const stringComparer = this._stringComparer;
        /**
         * @param {import('dictionary').TermDictionaryEntry} v1
         * @param {import('dictionary').TermDictionaryEntry} v2
         * @returns {number}
         */
        const compareFunction = (v1, v2) => {
            // Sort by length of source term
            let i = v2.maxTransformedTextLength - v1.maxTransformedTextLength;
            if (i !== 0) { return i; }

            // Sort by the number of inflection reasons
            i = v1.inflectionRuleChainCandidates.length - v2.inflectionRuleChainCandidates.length;
            if (i !== 0) { return i; }

            // Sort by how many terms exactly match the source (e.g. for exact kana prioritization)
            i = v2.sourceTermExactMatchCount - v1.sourceTermExactMatchCount;
            if (i !== 0) { return i; }

            // Sort by frequency order
            i = v1.frequencyOrder - v2.frequencyOrder;
            if (i !== 0) { return i; }

            // Sort by dictionary priority
            i = v2.dictionaryPriority - v1.dictionaryPriority;
            if (i !== 0) { return i; }

            // Sort by term score
            i = v2.score - v1.score;
            if (i !== 0) { return i; }

            // Sort by headword term text
            const headwords1 = v1.headwords;
            const headwords2 = v2.headwords;
            for (let j = 0, jj = Math.min(headwords1.length, headwords2.length); j < jj; ++j) {
                const term1 = headwords1[j].term;
                const term2 = headwords2[j].term;

                i = term2.length - term1.length;
                if (i !== 0) { return i; }

                i = stringComparer.compare(term1, term2);
                if (i !== 0) { return i; }
            }

            // Sort by definition count
            i = v2.definitions.length - v1.definitions.length;
            if (i !== 0) { return i; }

            // Sort by dictionary order
            i = v1.dictionaryIndex - v2.dictionaryIndex;
            return i;
        };
        dictionaryEntries.sort(compareFunction);
    }

    /**
     * @param {import('dictionary').TermDefinition[]} definitions
     */
    _sortTermDictionaryEntryDefinitions(definitions) {
        /**
         * @param {import('dictionary').TermDefinition} v1
         * @param {import('dictionary').TermDefinition} v2
         * @returns {number}
         */
        const compareFunction = (v1, v2) => {
            // Sort by frequency order
            let i = v1.frequencyOrder - v2.frequencyOrder;
            if (i !== 0) { return i; }

            // Sort by dictionary priority
            i = v2.dictionaryPriority - v1.dictionaryPriority;
            if (i !== 0) { return i; }

            // Sort by term score
            i = v2.score - v1.score;
            if (i !== 0) { return i; }

            // Sort by definition headword index
            const headwordIndices1 = v1.headwordIndices;
            const headwordIndices2 = v2.headwordIndices;
            const jj = headwordIndices1.length;
            i = headwordIndices2.length - jj;
            if (i !== 0) { return i; }
            for (let j = 0; j < jj; ++j) {
                i = headwordIndices1[j] - headwordIndices2[j];
                if (i !== 0) { return i; }
            }

            // Sort by dictionary order
            i = v1.dictionaryIndex - v2.dictionaryIndex;
            if (i !== 0) { return i; }

            // Sort by original order
            i = v1.index - v2.index;
            return i;
        };
        definitions.sort(compareFunction);
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry[]} dictionaryEntries
     */
    _sortTermDictionaryEntriesById(dictionaryEntries) {
        if (dictionaryEntries.length <= 1) { return; }
        dictionaryEntries.sort((a, b) => a.definitions[0].id - b.definitions[0].id);
    }

    /**
     * @param {import('dictionary').TermFrequency[]|import('dictionary').TermPronunciation[]} dataList
     */
    _sortTermDictionaryEntrySimpleData(dataList) {
        /**
         * @param {import('dictionary').TermFrequency|import('dictionary').TermPronunciation} v1
         * @param {import('dictionary').TermFrequency|import('dictionary').TermPronunciation} v2
         * @returns {number}
         */
        const compare = (v1, v2) => {
            // Sort by dictionary priority
            let i = v2.dictionaryPriority - v1.dictionaryPriority;
            if (i !== 0) { return i; }

            // Sory by headword order
            i = v1.headwordIndex - v2.headwordIndex;
            if (i !== 0) { return i; }

            // Sort by dictionary order
            i = v1.dictionaryIndex - v2.dictionaryIndex;
            if (i !== 0) { return i; }

            // Default order
            i = v1.index - v2.index;
            return i;
        };
        dataList.sort(compare);
    }

    /**
     * @param {import('dictionary').KanjiDictionaryEntry[]} dictionaryEntries
     */
    _sortKanjiDictionaryEntryData(dictionaryEntries) {
        /**
         * @param {import('dictionary').KanjiFrequency} v1
         * @param {import('dictionary').KanjiFrequency} v2
         * @returns {number}
         */
        const compare = (v1, v2) => {
            // Sort by dictionary priority
            let i = v2.dictionaryPriority - v1.dictionaryPriority;
            if (i !== 0) { return i; }

            // Sort by dictionary order
            i = v1.dictionaryIndex - v2.dictionaryIndex;
            if (i !== 0) { return i; }

            // Default order
            i = v1.index - v2.index;
            return i;
        };

        for (const {frequencies} of dictionaryEntries) {
            frequencies.sort(compare);
        }
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry[]} dictionaryEntries
     * @param {string} dictionary
     * @param {boolean} ascending
     */
    _updateSortFrequencies(dictionaryEntries, dictionary, ascending) {
        const frequencyMap = new Map();
        for (const dictionaryEntry of dictionaryEntries) {
            const {definitions, frequencies} = dictionaryEntry;
            let frequencyMin = Number.MAX_SAFE_INTEGER;
            let frequencyMax = Number.MIN_SAFE_INTEGER;
            for (const item of frequencies) {
                if (item.dictionary !== dictionary) { continue; }
                const {headwordIndex, frequency} = item;
                if (typeof frequency !== 'number') { continue; }
                frequencyMap.set(headwordIndex, frequency);
                frequencyMin = Math.min(frequencyMin, frequency);
                frequencyMax = Math.max(frequencyMax, frequency);
            }
            dictionaryEntry.frequencyOrder = (
                frequencyMin <= frequencyMax ?
                (ascending ? frequencyMin : -frequencyMax) :
                (ascending ? Number.MAX_SAFE_INTEGER : 0)
            );
            for (const definition of definitions) {
                frequencyMin = Number.MAX_SAFE_INTEGER;
                frequencyMax = Number.MIN_SAFE_INTEGER;
                const {headwordIndices} = definition;
                for (const headwordIndex of headwordIndices) {
                    const frequency = frequencyMap.get(headwordIndex);
                    if (typeof frequency !== 'number') { continue; }
                    frequencyMin = Math.min(frequencyMin, frequency);
                    frequencyMax = Math.max(frequencyMax, frequency);
                }
                definition.frequencyOrder = (
                    frequencyMin <= frequencyMax ?
                    (ascending ? frequencyMin : -frequencyMax) :
                    (ascending ? Number.MAX_SAFE_INTEGER : 0)
                );
            }
            frequencyMap.clear();
        }
    }

    // Miscellaneous

    /**
     * @template [T=unknown]
     * @param {Set<T>} set
     * @param {T[]} values
     * @returns {boolean}
     */
    _hasAny(set, values) {
        for (const value of values) {
            if (set.has(value)) { return true; }
        }
        return false;
    }
}

class TranslatorTagAggregator {
    constructor() {
        /** @type {Map<import('dictionary').Tag[], import('translator').TagGroup[]>} */
        this._tagExpansionTargetMap = new Map();
    }

    /**
     * @param {import('dictionary').Tag[]} tags
     * @param {string} dictionary
     * @param {string[]} tagNames
     */
    addTags(tags, dictionary, tagNames) {
        if (tagNames.length === 0) { return; }
        const tagGroups = this._getOrCreateTagGroups(tags);
        const tagGroup = this._getOrCreateTagGroup(tagGroups, dictionary);
        this._addUniqueTags(tagGroup, tagNames);
    }

    /**
     * @returns {import('translator').TagExpansionTarget[]}
     */
    getTagExpansionTargets() {
        const results = [];
        for (const [tags, tagGroups] of this._tagExpansionTargetMap) {
            results.push({tags, tagGroups});
        }
        return results;
    }

    /**
     * @param {import('dictionary').Tag[]} tags
     * @param {import('dictionary').Tag[]} newTags
     */
    mergeTags(tags, newTags) {
        const newTagGroups = this._tagExpansionTargetMap.get(newTags);
        if (typeof newTagGroups === 'undefined') { return; }
        const tagGroups = this._getOrCreateTagGroups(tags);
        for (const {dictionary, tagNames} of newTagGroups) {
            const tagGroup = this._getOrCreateTagGroup(tagGroups, dictionary);
            this._addUniqueTags(tagGroup, tagNames);
        }
    }

    /**
     * @param {import('dictionary').Tag[]} tags
     * @returns {import('translator').TagGroup[]}
     */
    _getOrCreateTagGroups(tags) {
        let tagGroups = this._tagExpansionTargetMap.get(tags);
        if (typeof tagGroups === 'undefined') {
            tagGroups = [];
            this._tagExpansionTargetMap.set(tags, tagGroups);
        }
        return tagGroups;
    }

    /**
     * @param {import('translator').TagGroup[]} tagGroups
     * @param {string} dictionary
     * @returns {import('translator').TagGroup}
     */
    _getOrCreateTagGroup(tagGroups, dictionary) {
        for (const tagGroup of tagGroups) {
            if (tagGroup.dictionary === dictionary) { return tagGroup; }
        }
        const newTagGroup = {dictionary, tagNames: []};
        tagGroups.push(newTagGroup);
        return newTagGroup;
    }

    /**
     * @param {import('translator').TagGroup} tagGroup
     * @param {string[]} newTagNames
     */
    _addUniqueTags(tagGroup, newTagNames) {
        const {tagNames} = tagGroup;
        for (const tagName of newTagNames) {
            if (tagNames.includes(tagName)) { continue; }
            tagNames.push(tagName);
        }
    }
}
