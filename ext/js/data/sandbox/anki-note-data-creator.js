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

import {DictionaryDataUtil} from '../../dictionary/dictionary-data-util.js';

/**
 * This class is used to convert the internal dictionary entry format to the
 * format used by Anki, for backwards compatibility.
 */
export class AnkiNoteDataCreator {
    /**
     * Creates a new instance.
     * @param {import('../../language/sandbox/japanese-util.js').JapaneseUtil} japaneseUtil An instance of `JapaneseUtil`.
     */
    constructor(japaneseUtil) {
        /** @type {import('../../language/sandbox/japanese-util.js').JapaneseUtil} */
        this._japaneseUtil = japaneseUtil;
    }

    /**
     * Creates a compatibility representation of the specified data.
     * @param {string} marker The marker that is being used for template rendering.
     * @param {import('anki-templates-internal').CreateDetails} details Information which is used to generate the data.
     * @returns {import('anki-templates').NoteData} An object used for rendering Anki templates.
     */
    create(marker, {
        dictionaryEntry,
        resultOutputMode,
        mode,
        glossaryLayoutMode,
        compactTags,
        context,
        media
    }) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const definition = this.createCachedValue(this._getDefinition.bind(this, dictionaryEntry, context, resultOutputMode));
        const uniqueExpressions = this.createCachedValue(this._getUniqueExpressions.bind(this, dictionaryEntry));
        const uniqueReadings = this.createCachedValue(this._getUniqueReadings.bind(this, dictionaryEntry));
        const context2 = this.createCachedValue(this._getPublicContext.bind(this, context));
        const pitches = this.createCachedValue(this._getPitches.bind(this, dictionaryEntry));
        const pitchCount = this.createCachedValue(this._getPitchCount.bind(this, pitches));
        const phoneticTranscriptions = this.createCachedValue(this._getPhoneticTranscriptions.bind(this, dictionaryEntry));

        if (typeof media !== 'object' || media === null || Array.isArray(media)) {
            media = {
                audio: void 0,
                screenshot: void 0,
                clipboardImage: void 0,
                clipboardText: void 0,
                selectionText: void 0,
                textFurigana: [],
                dictionaryMedia: {}
            };
        }
        /** @type {import('anki-templates').NoteData} */
        const result = {
            marker,
            get definition() { return self.getCachedValue(definition); },
            glossaryLayoutMode,
            compactTags,
            group: (resultOutputMode === 'group'),
            merge: (resultOutputMode === 'merge'),
            modeTermKanji: (mode === 'term-kanji'),
            modeTermKana: (mode === 'term-kana'),
            modeKanji: (mode === 'kanji'),
            compactGlossaries: (glossaryLayoutMode === 'compact'),
            get uniqueExpressions() { return self.getCachedValue(uniqueExpressions); },
            get uniqueReadings() { return self.getCachedValue(uniqueReadings); },
            get pitches() { return self.getCachedValue(pitches); },
            get pitchCount() { return self.getCachedValue(pitchCount); },
            get phoneticTranscriptions() { return self.getCachedValue(phoneticTranscriptions); },
            get context() { return self.getCachedValue(context2); },
            media,
            dictionaryEntry
        };
        Object.defineProperty(result, 'dictionaryEntry', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: dictionaryEntry
        });
        return result;
    }

    /**
     * Creates a deferred-evaluation value.
     * @template [T=unknown]
     * @param {() => T} getter The function to invoke to get the return value.
     * @returns {import('anki-templates-internal').CachedValue<T>} An object which can be passed into `getCachedValue`.
     */
    createCachedValue(getter) {
        return {getter, hasValue: false, value: void 0};
    }

    /**
     * Gets the value of a cached object.
     * @template [T=unknown]
     * @param {import('anki-templates-internal').CachedValue<T>} item An object that was returned from `createCachedValue`.
     * @returns {T} The result of evaluating the getter, which is cached after the first invocation.
     */
    getCachedValue(item) {
        if (item.hasValue) { return /** @type {T} */ (item.value); }
        const value = item.getter();
        item.value = value;
        item.hasValue = true;
        return value;
    }

    // Private

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {?import('dictionary').TermSource}
     */
    _getPrimarySource(dictionaryEntry) {
        for (const headword of dictionaryEntry.headwords) {
            for (const source of headword.sources) {
                if (source.isPrimary) { return source; }
            }
        }
        return null;
    }

    /**
     * @param {import('dictionary').DictionaryEntry} dictionaryEntry
     * @returns {string[]}
     */
    _getUniqueExpressions(dictionaryEntry) {
        if (dictionaryEntry.type === 'term') {
            const results = new Set();
            for (const {term} of dictionaryEntry.headwords) {
                results.add(term);
            }
            return [...results];
        } else {
            return [];
        }
    }

    /**
     * @param {import('dictionary').DictionaryEntry} dictionaryEntry
     * @returns {string[]}
     */
    _getUniqueReadings(dictionaryEntry) {
        if (dictionaryEntry.type === 'term') {
            const results = new Set();
            for (const {reading} of dictionaryEntry.headwords) {
                results.add(reading);
            }
            return [...results];
        } else {
            return [];
        }
    }

    /**
     * @param {import('anki-templates-internal').Context} context
     * @returns {import('anki-templates').Context}
     */
    _getPublicContext(context) {
        let {documentTitle, query, fullQuery} = context;
        if (typeof documentTitle !== 'string') { documentTitle = ''; }
        return {
            query,
            fullQuery,
            document: {
                title: documentTitle
            }
        };
    }

    /**
     * @param {import('dictionary').DictionaryEntry} dictionaryEntry
     * @returns {import('anki-templates').PitchGroup[]}
     */
    _getPitches(dictionaryEntry) {
        /** @type {import('anki-templates').PitchGroup[]} */
        const results = [];
        if (dictionaryEntry.type === 'term') {
            for (const {dictionary, pronunciations} of DictionaryDataUtil.getGroupedPronunciations(dictionaryEntry)) {
                /** @type {import('anki-templates').Pitch[]} */
                const pitches = [];
                for (const groupedPronunciation of pronunciations) {
                    const {pronunciation} = groupedPronunciation;
                    if (pronunciation.type !== 'pitch-accent') { continue; }
                    const {position, nasalPositions, devoicePositions, tags} = pronunciation;
                    const {terms, reading, exclusiveTerms, exclusiveReadings} = groupedPronunciation;
                    pitches.push({
                        expressions: terms,
                        reading,
                        position,
                        nasalPositions,
                        devoicePositions,
                        tags: this._convertPitchTags(tags),
                        exclusiveExpressions: exclusiveTerms,
                        exclusiveReadings
                    });
                }
                results.push({dictionary, pitches});
            }
        }
        return results;
    }

    /**
     * @param {import('dictionary').DictionaryEntry} dictionaryEntry
     * @returns {import('anki-templates').TranscriptionGroup[]}
     */
    _getPhoneticTranscriptions(dictionaryEntry) {
        const results = [];
        if (dictionaryEntry.type === 'term') {
            for (const {dictionary, pronunciations} of DictionaryDataUtil.getGroupedPronunciations(dictionaryEntry)) {
                const phoneticTranscriptions = [];
                for (const groupedPronunciation of pronunciations) {
                    const {pronunciation} = groupedPronunciation;
                    if (pronunciation.type !== 'phonetic-transcription') { continue; }
                    const {ipa, tags} = pronunciation;
                    const {terms, reading, exclusiveTerms, exclusiveReadings} = groupedPronunciation;
                    phoneticTranscriptions.push({
                        expressions: terms,
                        reading,
                        ipa,
                        tags,
                        exclusiveExpressions: exclusiveTerms,
                        exclusiveReadings
                    });
                }
                results.push({dictionary, phoneticTranscriptions});
            }
        }
        return results;
    }

    /**
     * @param {import('anki-templates-internal').CachedValue<import('anki-templates').PitchGroup[]>} cachedPitches
     * @returns {number}
     */
    _getPitchCount(cachedPitches) {
        const pitches = this.getCachedValue(cachedPitches);
        return pitches.reduce((i, v) => i + v.pitches.length, 0);
    }

    /**
     * @param {import('dictionary').DictionaryEntry} dictionaryEntry
     * @param {import('anki-templates-internal').Context} context
     * @param {import('settings').ResultOutputMode} resultOutputMode
     * @returns {import('anki-templates').DictionaryEntry}
     */
    _getDefinition(dictionaryEntry, context, resultOutputMode) {
        switch (dictionaryEntry.type) {
            case 'term':
                return this._getTermDefinition(dictionaryEntry, context, resultOutputMode);
            case 'kanji':
                return this._getKanjiDefinition(dictionaryEntry, context);
            default:
                return /** @type {import('anki-templates').UnknownDictionaryEntry} */ ({});
        }
    }

    /**
     * @param {import('dictionary').KanjiDictionaryEntry} dictionaryEntry
     * @param {import('anki-templates-internal').Context} context
     * @returns {import('anki-templates').KanjiDictionaryEntry}
     */
    _getKanjiDefinition(dictionaryEntry, context) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        const {character, dictionary, onyomi, kunyomi, definitions} = dictionaryEntry;

        let {url} = context;
        if (typeof url !== 'string') { url = ''; }

        const stats = this.createCachedValue(this._getKanjiStats.bind(this, dictionaryEntry));
        const tags = this.createCachedValue(this._convertTags.bind(this, dictionaryEntry.tags));
        const frequencies = this.createCachedValue(this._getKanjiFrequencies.bind(this, dictionaryEntry));
        const cloze = this.createCachedValue(this._getCloze.bind(this, dictionaryEntry, context));

        return {
            type: 'kanji',
            character,
            dictionary,
            onyomi,
            kunyomi,
            glossary: definitions,
            get tags() { return self.getCachedValue(tags); },
            get stats() { return self.getCachedValue(stats); },
            get frequencies() { return self.getCachedValue(frequencies); },
            url,
            get cloze() { return self.getCachedValue(cloze); }
        };
    }

    /**
     * @param {import('dictionary').KanjiDictionaryEntry} dictionaryEntry
     * @returns {import('anki-templates').KanjiStatGroups}
     */
    _getKanjiStats(dictionaryEntry) {
        /** @type {import('anki-templates').KanjiStatGroups} */
        const results = {};
        const convertKanjiStatBind = this._convertKanjiStat.bind(this);
        for (const [key, value] of Object.entries(dictionaryEntry.stats)) {
            results[key] = value.map(convertKanjiStatBind);
        }
        return results;
    }

    /**
     * @param {import('dictionary').KanjiStat} kanjiStat
     * @returns {import('anki-templates').KanjiStat}
     */
    _convertKanjiStat({name, category, content, order, score, dictionary, value}) {
        return {
            name,
            category,
            notes: content,
            order,
            score,
            dictionary,
            value
        };
    }

    /**
     * @param {import('dictionary').KanjiDictionaryEntry} dictionaryEntry
     * @returns {import('anki-templates').KanjiFrequency[]}
     */
    _getKanjiFrequencies(dictionaryEntry) {
        /** @type {import('anki-templates').KanjiFrequency[]} */
        const results = [];
        for (const {index, dictionary, dictionaryIndex, dictionaryPriority, character, frequency, displayValue} of dictionaryEntry.frequencies) {
            results.push({
                index,
                dictionary,
                dictionaryOrder: {
                    index: dictionaryIndex,
                    priority: dictionaryPriority
                },
                character,
                frequency: displayValue !== null ? displayValue : frequency
            });
        }
        return results;
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @param {import('anki-templates-internal').Context} context
     * @param {import('settings').ResultOutputMode} resultOutputMode
     * @returns {import('anki-templates').TermDictionaryEntry}
     */
    _getTermDefinition(dictionaryEntry, context, resultOutputMode) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        /** @type {import('anki-templates').TermDictionaryEntryType} */
        let type = 'term';
        switch (resultOutputMode) {
            case 'group': type = 'termGrouped'; break;
            case 'merge': type = 'termMerged'; break;
        }

        const {inflectionRuleChainCandidates, score, dictionaryIndex, dictionaryPriority, sourceTermExactMatchCount, definitions} = dictionaryEntry;

        let {url} = context;
        if (typeof url !== 'string') { url = ''; }

        const primarySource = this._getPrimarySource(dictionaryEntry);

        const dictionaryNames = this.createCachedValue(this._getTermDictionaryNames.bind(this, dictionaryEntry));
        const commonInfo = this.createCachedValue(this._getTermDictionaryEntryCommonInfo.bind(this, dictionaryEntry, type));
        const termTags = this.createCachedValue(this._getTermTags.bind(this, dictionaryEntry, type));
        const expressions = this.createCachedValue(this._getTermExpressions.bind(this, dictionaryEntry));
        const frequencies = this.createCachedValue(this._getTermFrequencies.bind(this, dictionaryEntry));
        const pitches = this.createCachedValue(this._getTermPitches.bind(this, dictionaryEntry));
        const phoneticTranscriptions = this.createCachedValue(this._getTermPhoneticTranscriptions.bind(this, dictionaryEntry));
        const glossary = this.createCachedValue(this._getTermGlossaryArray.bind(this, dictionaryEntry, type));
        const cloze = this.createCachedValue(this._getCloze.bind(this, dictionaryEntry, context));
        const furiganaSegments = this.createCachedValue(this._getTermFuriganaSegments.bind(this, dictionaryEntry, type));
        const sequence = this.createCachedValue(this._getTermDictionaryEntrySequence.bind(this, dictionaryEntry));

        return {
            type,
            id: (type === 'term' && definitions.length > 0 ? definitions[0].id : void 0),
            source: (primarySource !== null ? primarySource.transformedText : null),
            rawSource: (primarySource !== null ? primarySource.originalText : null),
            sourceTerm: (type !== 'termMerged' ? (primarySource !== null ? primarySource.deinflectedText : null) : void 0),
            inflectionRuleChainCandidates,
            score,
            isPrimary: (type === 'term' ? dictionaryEntry.isPrimary : void 0),
            get sequence() { return self.getCachedValue(sequence); },
            get dictionary() { return self.getCachedValue(dictionaryNames)[0]; },
            dictionaryOrder: {
                index: dictionaryIndex,
                priority: dictionaryPriority
            },
            get dictionaryNames() { return self.getCachedValue(dictionaryNames); },
            get expression() {
                const {uniqueTerms} = self.getCachedValue(commonInfo);
                return (type === 'term' || type === 'termGrouped' ? uniqueTerms[0] : uniqueTerms);
            },
            get reading() {
                const {uniqueReadings} = self.getCachedValue(commonInfo);
                return (type === 'term' || type === 'termGrouped' ? uniqueReadings[0] : uniqueReadings);
            },
            get expressions() { return self.getCachedValue(expressions); },
            get glossary() { return self.getCachedValue(glossary); },
            get definitionTags() { return type === 'term' ? self.getCachedValue(commonInfo).definitionTags : void 0; },
            get termTags() { return self.getCachedValue(termTags); },
            get definitions() { return self.getCachedValue(commonInfo).definitions; },
            get frequencies() { return self.getCachedValue(frequencies); },
            get pitches() { return self.getCachedValue(pitches); },
            get phoneticTranscriptions() { return self.getCachedValue(phoneticTranscriptions); },
            sourceTermExactMatchCount,
            url,
            get cloze() { return self.getCachedValue(cloze); },
            get furiganaSegments() { return self.getCachedValue(furiganaSegments); }
        };
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {string[]}
     */
    _getTermDictionaryNames(dictionaryEntry) {
        const dictionaryNames = new Set();
        for (const {dictionary} of dictionaryEntry.definitions) {
            dictionaryNames.add(dictionary);
        }
        return [...dictionaryNames];
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @param {import('anki-templates').TermDictionaryEntryType} type
     * @returns {import('anki-templates').TermDictionaryEntryCommonInfo}
     */
    _getTermDictionaryEntryCommonInfo(dictionaryEntry, type) {
        const merged = (type === 'termMerged');
        const hasDefinitions = (type !== 'term');

        /** @type {Set<string>} */
        const allTermsSet = new Set();
        /** @type {Set<string>} */
        const allReadingsSet = new Set();
        for (const {term, reading} of dictionaryEntry.headwords) {
            allTermsSet.add(term);
            allReadingsSet.add(reading);
        }
        const uniqueTerms = [...allTermsSet];
        const uniqueReadings = [...allReadingsSet];

        /** @type {import('anki-templates').TermDefinition[]} */
        const definitions = [];
        /** @type {import('anki-templates').Tag[]} */
        const definitionTags = [];
        for (const {tags, headwordIndices, entries, dictionary, sequences} of dictionaryEntry.definitions) {
            const definitionTags2 = [];
            for (const tag of tags) {
                definitionTags.push(this._convertTag(tag));
                definitionTags2.push(this._convertTag(tag));
            }
            if (!hasDefinitions) { continue; }
            const only = merged ? DictionaryDataUtil.getDisambiguations(dictionaryEntry.headwords, headwordIndices, allTermsSet, allReadingsSet) : void 0;
            definitions.push({
                sequence: sequences[0],
                dictionary,
                glossary: entries,
                definitionTags: definitionTags2,
                only
            });
        }

        return {
            uniqueTerms,
            uniqueReadings,
            definitionTags,
            definitions: hasDefinitions ? definitions : void 0
        };
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {import('anki-templates').TermFrequency[]}
     */
    _getTermFrequencies(dictionaryEntry) {
        const results = [];
        const {headwords} = dictionaryEntry;
        for (const {headwordIndex, dictionary, dictionaryIndex, dictionaryPriority, hasReading, frequency, displayValue} of dictionaryEntry.frequencies) {
            const {term, reading} = headwords[headwordIndex];
            results.push({
                index: results.length,
                expressionIndex: headwordIndex,
                dictionary,
                dictionaryOrder: {
                    index: dictionaryIndex,
                    priority: dictionaryPriority
                },
                expression: term,
                reading,
                hasReading,
                frequency: displayValue !== null ? displayValue : frequency
            });
        }
        return results;
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {import('anki-templates').TermPitchAccent[]}
     */
    _getTermPitches(dictionaryEntry) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const results = [];
        const {headwords} = dictionaryEntry;
        for (const {headwordIndex, dictionary, dictionaryIndex, dictionaryPriority, pronunciations} of dictionaryEntry.pronunciations) {
            const {term, reading} = headwords[headwordIndex];
            const pitches = DictionaryDataUtil.getPronunciationsOfType(pronunciations, 'pitch-accent');
            const cachedPitches = this.createCachedValue(this._getTermPitchesInner.bind(this, pitches));
            results.push({
                index: results.length,
                expressionIndex: headwordIndex,
                dictionary,
                dictionaryOrder: {
                    index: dictionaryIndex,
                    priority: dictionaryPriority
                },
                expression: term,
                reading,
                get pitches() { return self.getCachedValue(cachedPitches); }
            });
        }
        return results;
    }

    /**
     * @param {import('dictionary').PitchAccent[]} pitches
     * @returns {import('anki-templates').PitchAccent[]}
     */
    _getTermPitchesInner(pitches) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const results = [];
        for (const {position, tags} of pitches) {
            const cachedTags = this.createCachedValue(this._convertTags.bind(this, tags));
            results.push({
                position,
                get tags() { return self.getCachedValue(cachedTags); }
            });
        }
        return results;
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {import('anki-templates').TermPhoneticTranscription[]}
     */
    _getTermPhoneticTranscriptions(dictionaryEntry) {
        const results = [];
        const {headwords} = dictionaryEntry;
        for (const {headwordIndex, dictionary, dictionaryIndex, dictionaryPriority, pronunciations} of dictionaryEntry.pronunciations) {
            const {term, reading} = headwords[headwordIndex];
            const phoneticTranscriptions = DictionaryDataUtil.getPronunciationsOfType(pronunciations, 'phonetic-transcription');
            const termPhoneticTranscriptions = this._getTermPhoneticTranscriptionsInner(phoneticTranscriptions);
            results.push({
                index: results.length,
                expressionIndex: headwordIndex,
                dictionary,
                dictionaryOrder: {
                    index: dictionaryIndex,
                    priority: dictionaryPriority
                },
                expression: term,
                reading,
                get phoneticTranscriptions() { return termPhoneticTranscriptions; }
            });
        }

        return results;
    }

    /**
     * @param {import('dictionary').PhoneticTranscription[]} phoneticTranscriptions
     * @returns {import('anki-templates').PhoneticTranscription[]}
     */
    _getTermPhoneticTranscriptionsInner(phoneticTranscriptions) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const results = [];
        for (const {ipa, tags} of phoneticTranscriptions) {
            const cachedTags = this.createCachedValue(this._convertTags.bind(this, tags));
            results.push({
                ipa,
                get tags() { return self.getCachedValue(cachedTags); }
            });
        }
        return results;
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {import('anki-templates').TermHeadword[]}
     */
    _getTermExpressions(dictionaryEntry) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const results = [];
        const {headwords} = dictionaryEntry;
        for (let i = 0, ii = headwords.length; i < ii; ++i) {
            const {term, reading, tags, sources: [{deinflectedText}], wordClasses} = headwords[i];
            const termTags = this.createCachedValue(this._convertTags.bind(this, tags));
            const frequencies = this.createCachedValue(this._getTermExpressionFrequencies.bind(this, dictionaryEntry, i));
            const pitches = this.createCachedValue(this._getTermExpressionPitches.bind(this, dictionaryEntry, i));
            const termFrequency = this.createCachedValue(this._getTermExpressionTermFrequency.bind(this, termTags));
            const furiganaSegments = this.createCachedValue(this._getTermHeadwordFuriganaSegments.bind(this, term, reading));
            const item = {
                sourceTerm: deinflectedText,
                expression: term,
                reading,
                get termTags() { return self.getCachedValue(termTags); },
                get frequencies() { return self.getCachedValue(frequencies); },
                get pitches() { return self.getCachedValue(pitches); },
                get furiganaSegments() { return self.getCachedValue(furiganaSegments); },
                get termFrequency() { return self.getCachedValue(termFrequency); },
                wordClasses
            };
            results.push(item);
        }
        return results;
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @param {number} i
     * @returns {import('anki-templates').TermFrequency[]}
     */
    _getTermExpressionFrequencies(dictionaryEntry, i) {
        const results = [];
        const {headwords, frequencies} = dictionaryEntry;
        for (const {headwordIndex, dictionary, dictionaryIndex, dictionaryPriority, hasReading, frequency, displayValue} of frequencies) {
            if (headwordIndex !== i) { continue; }
            const {term, reading} = headwords[headwordIndex];
            results.push({
                index: results.length,
                expressionIndex: headwordIndex,
                dictionary,
                dictionaryOrder: {
                    index: dictionaryIndex,
                    priority: dictionaryPriority
                },
                expression: term,
                reading,
                hasReading,
                frequency: displayValue !== null ? displayValue : frequency
            });
        }
        return results;
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @param {number} i
     * @returns {import('anki-templates').TermPitchAccent[]}
     */
    _getTermExpressionPitches(dictionaryEntry, i) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const results = [];
        const {headwords, pronunciations: termPronunciations} = dictionaryEntry;
        for (const {headwordIndex, dictionary, dictionaryIndex, dictionaryPriority, pronunciations} of termPronunciations) {
            if (headwordIndex !== i) { continue; }
            const {term, reading} = headwords[headwordIndex];
            const pitches = DictionaryDataUtil.getPronunciationsOfType(pronunciations, 'pitch-accent');
            const cachedPitches = this.createCachedValue(this._getTermPitchesInner.bind(this, pitches));
            results.push({
                index: results.length,
                expressionIndex: headwordIndex,
                dictionary,
                dictionaryOrder: {
                    index: dictionaryIndex,
                    priority: dictionaryPriority
                },
                expression: term,
                reading,
                get pitches() { return self.getCachedValue(cachedPitches); }
            });
        }
        return results;
    }

    /**
     * @param {import('anki-templates-internal').CachedValue<import('anki-templates').Tag[]>} cachedTermTags
     * @returns {import('anki-templates').TermFrequencyType}
     */
    _getTermExpressionTermFrequency(cachedTermTags) {
        const termTags = this.getCachedValue(cachedTermTags);
        return DictionaryDataUtil.getTermFrequency(termTags);
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @param {import('anki-templates').TermDictionaryEntryType} type
     * @returns {import('dictionary-data').TermGlossary[]|undefined}
     */
    _getTermGlossaryArray(dictionaryEntry, type) {
        if (type === 'term') {
            const results = [];
            for (const {entries} of dictionaryEntry.definitions) {
                results.push(...entries);
            }
            return results;
        }
        return void 0;
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @param {import('anki-templates').TermDictionaryEntryType} type
     * @returns {import('anki-templates').Tag[]|undefined}
     */
    _getTermTags(dictionaryEntry, type) {
        if (type !== 'termMerged') {
            const results = [];
            for (const {tag} of DictionaryDataUtil.groupTermTags(dictionaryEntry)) {
                results.push(this._convertTag(tag));
            }
            return results;
        }
        return void 0;
    }

    /**
     * @param {import('dictionary').Tag[]} tags
     * @returns {import('anki-templates').Tag[]}
     */
    _convertTags(tags) {
        const results = [];
        for (const tag of tags) {
            results.push(this._convertTag(tag));
        }
        return results;
    }

    /**
     * @param {import('dictionary').Tag} tag
     * @returns {import('anki-templates').Tag}
     */
    _convertTag({name, category, content, order, score, dictionaries, redundant}) {
        return {
            name,
            category,
            notes: (content.length > 0 ? content[0] : ''),
            order,
            score,
            dictionary: (dictionaries.length > 0 ? dictionaries[0] : ''),
            redundant
        };
    }

    /**
     * @param {import('dictionary').Tag[]} tags
     * @returns {import('anki-templates').PitchTag[]}
     */
    _convertPitchTags(tags) {
        const results = [];
        for (const tag of tags) {
            results.push(this._convertPitchTag(tag));
        }
        return results;
    }

    /**
     * @param {import('dictionary').Tag} tag
     * @returns {import('anki-templates').PitchTag}
     */
    _convertPitchTag({name, category, content, order, score, dictionaries, redundant}) {
        return {
            name,
            category,
            order,
            score,
            content: [...content],
            dictionaries: [...dictionaries],
            redundant
        };
    }

    /**
     * @param {import('dictionary').DictionaryEntry} dictionaryEntry
     * @param {import('anki-templates-internal').Context} context
     * @returns {import('anki-templates').Cloze}
     */
    _getCloze(dictionaryEntry, context) {
        let originalText = '';
        switch (dictionaryEntry.type) {
            case 'term':
                {
                    const primarySource = this._getPrimarySource(dictionaryEntry);
                    if (primarySource !== null) { originalText = primarySource.originalText; }
                }
                break;
            case 'kanji':
                originalText = dictionaryEntry.character;
                break;
        }

        const {sentence} = context;
        let text;
        let offset;
        if (typeof sentence === 'object' && sentence !== null) {
            ({text, offset} = sentence);
        }
        if (typeof text !== 'string') { text = ''; }
        if (typeof offset !== 'number') { offset = 0; }

        return {
            sentence: text,
            prefix: text.substring(0, offset),
            body: text.substring(offset, offset + originalText.length),
            suffix: text.substring(offset + originalText.length)
        };
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @param {import('anki-templates').TermDictionaryEntryType} type
     * @returns {import('anki-templates').FuriganaSegment[]|undefined}
     */
    _getTermFuriganaSegments(dictionaryEntry, type) {
        if (type === 'term') {
            for (const {term, reading} of dictionaryEntry.headwords) {
                return this._getTermHeadwordFuriganaSegments(term, reading);
            }
        }
        return void 0;
    }

    /**
     * @param {string} term
     * @param {string} reading
     * @returns {import('anki-templates').FuriganaSegment[]}
     */
    _getTermHeadwordFuriganaSegments(term, reading) {
        /** @type {import('anki-templates').FuriganaSegment[]} */
        const result = [];
        for (const {text, reading: reading2} of this._japaneseUtil.distributeFurigana(term, reading)) {
            result.push({text, furigana: reading2});
        }
        return result;
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {number}
     */
    _getTermDictionaryEntrySequence(dictionaryEntry) {
        let hasSequence = false;
        let mainSequence = -1;
        if (!dictionaryEntry.isPrimary) { return mainSequence; }
        for (const {sequences} of dictionaryEntry.definitions) {
            const sequence = sequences[0];
            if (!hasSequence) {
                mainSequence = sequence;
                hasSequence = true;
                if (mainSequence === -1) { break; }
            } else if (mainSequence !== sequence) {
                mainSequence = -1;
                break;
            }
        }
        return mainSequence;
    }
}
