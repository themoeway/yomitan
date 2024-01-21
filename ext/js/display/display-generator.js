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

import {isObject} from '../core/utilities.js';
import {ExtensionError} from '../core/extension-error.js';
import {DictionaryDataUtil} from '../dictionary/dictionary-data-util.js';
import {HtmlTemplateCollection} from '../dom/html-template-collection.js';
import {yomitan} from '../yomitan.js';
import {PronunciationGenerator} from './sandbox/pronunciation-generator.js';
import {StructuredContentGenerator} from './sandbox/structured-content-generator.js';

export class DisplayGenerator {
    /**
     * @param {import('display').DisplayGeneratorConstructorDetails} details
     */
    constructor({japaneseUtil, contentManager, hotkeyHelpController = null}) {
        /** @type {import('../language/sandbox/japanese-util.js').JapaneseUtil} */
        this._japaneseUtil = japaneseUtil;
        /** @type {import('./display-content-manager.js').DisplayContentManager} */
        this._contentManager = contentManager;
        /** @type {?import('../input/hotkey-help-controller.js').HotkeyHelpController} */
        this._hotkeyHelpController = hotkeyHelpController;
        /** @type {HtmlTemplateCollection} */
        this._templates = new HtmlTemplateCollection();
        /** @type {StructuredContentGenerator} */
        this._structuredContentGenerator = new StructuredContentGenerator(this._contentManager, japaneseUtil, document);
        /** @type {PronunciationGenerator} */
        this._pronunciationGenerator = new PronunciationGenerator(japaneseUtil);
    }

    /** */
    async prepare() {
        const html = await yomitan.api.getDisplayTemplatesHtml();
        this._templates.load(html);
        this.updateHotkeys();
    }

    /** */
    updateHotkeys() {
        const hotkeyHelpController = this._hotkeyHelpController;
        if (hotkeyHelpController === null) { return; }
        for (const template of this._templates.getAllTemplates()) {
            hotkeyHelpController.setupNode(template.content);
        }
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @returns {HTMLElement}
     */
    createTermEntry(dictionaryEntry) {
        const node = this._instantiate('term-entry');

        const headwordsContainer = this._querySelector(node, '.headword-list');
        const inflectionRuleChainsContainer = this._querySelector(node, '.inflection-rule-chains');
        const groupedPronunciationsContainer = this._querySelector(node, '.pronunciation-group-list');
        const frequencyGroupListContainer = this._querySelector(node, '.frequency-group-list');
        const definitionsContainer = this._querySelector(node, '.definition-list');
        const headwordTagsContainer = this._querySelector(node, '.headword-list-tag-list');

        const {headwords, type, inflectionRuleChainCandidates, definitions, frequencies, pronunciations} = dictionaryEntry;
        const groupedPronunciations = DictionaryDataUtil.getGroupedPronunciations(dictionaryEntry);
        const pronunciationCount = groupedPronunciations.reduce((i, v) => i + v.pronunciations.length, 0);
        const groupedFrequencies = DictionaryDataUtil.groupTermFrequencies(dictionaryEntry);
        const termTags = DictionaryDataUtil.groupTermTags(dictionaryEntry);

        /** @type {Set<string>} */
        const uniqueTerms = new Set();
        /** @type {Set<string>} */
        const uniqueReadings = new Set();
        /** @type {Set<import('dictionary').TermSourceMatchType>} */
        const primaryMatchTypes = new Set();
        for (const {term, reading, sources} of headwords) {
            uniqueTerms.add(term);
            uniqueReadings.add(reading);
            for (const {matchType, isPrimary} of sources) {
                if (!isPrimary) { continue; }
                primaryMatchTypes.add(matchType);
            }
        }

        node.dataset.format = type;
        node.dataset.headwordCount = `${headwords.length}`;
        node.dataset.definitionCount = `${definitions.length}`;
        node.dataset.pronunciationDictionaryCount = `${groupedPronunciations.length}`;
        node.dataset.pronunciationCount = `${pronunciationCount}`;
        node.dataset.uniqueTermCount = `${uniqueTerms.size}`;
        node.dataset.uniqueReadingCount = `${uniqueReadings.size}`;
        node.dataset.frequencyCount = `${frequencies.length}`;
        node.dataset.groupedFrequencyCount = `${groupedFrequencies.length}`;
        node.dataset.primaryMatchTypes = [...primaryMatchTypes].join(' ');

        for (let i = 0, ii = headwords.length; i < ii; ++i) {
            const node2 = this._createTermHeadword(headwords[i], i, pronunciations);
            node2.dataset.index = `${i}`;
            headwordsContainer.appendChild(node2);
        }
        headwordsContainer.dataset.count = `${headwords.length}`;

        this._appendMultiple(inflectionRuleChainsContainer, this._createInflectionRuleChain.bind(this), inflectionRuleChainCandidates);
        this._appendMultiple(frequencyGroupListContainer, this._createFrequencyGroup.bind(this), groupedFrequencies, false);
        this._appendMultiple(groupedPronunciationsContainer, this._createGroupedPronunciation.bind(this), groupedPronunciations);
        this._appendMultiple(headwordTagsContainer, this._createTermTag.bind(this), termTags, headwords.length);

        for (const term of uniqueTerms) {
            headwordTagsContainer.appendChild(this._createSearchTag(term));
        }
        for (const reading of uniqueReadings) {
            if (uniqueTerms.has(reading)) { continue; }
            headwordTagsContainer.appendChild(this._createSearchTag(reading));
        }

        // Add definitions
        const dictionaryTag = this._createDictionaryTag('');
        for (let i = 0, ii = definitions.length; i < ii; ++i) {
            const definition = definitions[i];
            const {dictionary} = definition;

            if (dictionaryTag.dictionaries.includes(dictionary)) {
                dictionaryTag.redundant = true;
            } else {
                dictionaryTag.redundant = false;
                dictionaryTag.dictionaries.push(dictionary);
                dictionaryTag.name = dictionary;
            }

            const node2 = this._createTermDefinition(definition, dictionaryTag, headwords, uniqueTerms, uniqueReadings);
            node2.dataset.index = `${i}`;
            definitionsContainer.appendChild(node2);
        }
        definitionsContainer.dataset.count = `${definitions.length}`;

        return node;
    }

    /**
     * @param {import('dictionary').KanjiDictionaryEntry} dictionaryEntry
     * @returns {HTMLElement}
     */
    createKanjiEntry(dictionaryEntry) {
        const node = this._instantiate('kanji-entry');

        const glyphContainer = this._querySelector(node, '.kanji-glyph');
        const frequencyGroupListContainer = this._querySelector(node, '.frequency-group-list');
        const tagContainer = this._querySelector(node, '.kanji-tag-list');
        const definitionsContainer = this._querySelector(node, '.kanji-gloss-list');
        const chineseReadingsContainer = this._querySelector(node, '.kanji-readings-chinese');
        const japaneseReadingsContainer = this._querySelector(node, '.kanji-readings-japanese');
        const statisticsContainer = this._querySelector(node, '.kanji-statistics');
        const classificationsContainer = this._querySelector(node, '.kanji-classifications');
        const codepointsContainer = this._querySelector(node, '.kanji-codepoints');
        const dictionaryIndicesContainer = this._querySelector(node, '.kanji-dictionary-indices');

        this._setTextContent(glyphContainer, dictionaryEntry.character, 'ja');
        const groupedFrequencies = DictionaryDataUtil.groupKanjiFrequencies(dictionaryEntry.frequencies);

        const dictionaryTag = this._createDictionaryTag(dictionaryEntry.dictionary);

        this._appendMultiple(frequencyGroupListContainer, this._createFrequencyGroup.bind(this), groupedFrequencies, true);
        this._appendMultiple(tagContainer, this._createTag.bind(this), [...dictionaryEntry.tags, dictionaryTag]);
        this._appendMultiple(definitionsContainer, this._createKanjiDefinition.bind(this), dictionaryEntry.definitions);
        this._appendMultiple(chineseReadingsContainer, this._createKanjiReading.bind(this), dictionaryEntry.onyomi);
        this._appendMultiple(japaneseReadingsContainer, this._createKanjiReading.bind(this), dictionaryEntry.kunyomi);

        statisticsContainer.appendChild(this._createKanjiInfoTable(dictionaryEntry.stats.misc));
        classificationsContainer.appendChild(this._createKanjiInfoTable(dictionaryEntry.stats.class));
        codepointsContainer.appendChild(this._createKanjiInfoTable(dictionaryEntry.stats.code));
        dictionaryIndicesContainer.appendChild(this._createKanjiInfoTable(dictionaryEntry.stats.index));

        return node;
    }

    /**
     * @returns {HTMLElement}
     */
    createEmptyFooterNotification() {
        return this._instantiate('footer-notification');
    }

    /**
     * @param {HTMLElement} tagNode
     * @param {?import('dictionary').DictionaryEntry} dictionaryEntry
     * @returns {DocumentFragment}
     */
    createTagFooterNotificationDetails(tagNode, dictionaryEntry) {
        const node = this._templates.instantiateFragment('footer-notification-tag-details');

        let details = tagNode.dataset.details;
        if (typeof details !== 'string') {
            const label = tagNode.querySelector('.tag-label-content');
            details = label !== null && label.textContent !== null ? label.textContent : '';
        }
        const tagDetails = this._querySelector(node, '.tag-details');
        this._setTextContent(tagDetails, details);

        if (dictionaryEntry !== null && dictionaryEntry.type === 'term') {
            const {headwords} = dictionaryEntry;
            const disambiguationHeadwords = [];
            const {headwords: headwordIndices} = tagNode.dataset;
            if (typeof headwordIndices === 'string' && headwordIndices.length > 0) {
                for (const headwordIndexString of headwordIndices.split(' ')) {
                    const headwordIndex = Number.parseInt(headwordIndexString, 10);
                    if (!Number.isNaN(headwordIndex) && headwordIndex >= 0 && headwordIndex < headwords.length) {
                        disambiguationHeadwords.push(headwords[headwordIndex]);
                    }
                }
            }

            if (disambiguationHeadwords.length > 0 && disambiguationHeadwords.length < headwords.length) {
                const disambiguationContainer = this._querySelector(node, '.tag-details-disambiguation-list');
                const copyAttributes = ['totalHeadwordCount', 'matchedHeadwordCount', 'unmatchedHeadwordCount'];
                for (const attribute of copyAttributes) {
                    const value = tagNode.dataset[attribute];
                    if (typeof value === 'undefined') { continue; }
                    disambiguationContainer.dataset[attribute] = value;
                }
                for (const {term, reading} of disambiguationHeadwords) {
                    const disambiguationItem = document.createElement('span');
                    disambiguationItem.className = 'tag-details-disambiguation';
                    this._appendFurigana(disambiguationItem, term, reading, (container, text) => {
                        container.appendChild(document.createTextNode(text));
                    });
                    disambiguationContainer.appendChild(disambiguationItem);
                }
            }
        }

        return node;
    }

    /**
     * @param {(DocumentFragment|Node|Error)[]} errors
     * @returns {HTMLElement}
     */
    createAnkiNoteErrorsNotificationContent(errors) {
        const content = this._instantiate('footer-notification-anki-errors-content');

        const header = this._querySelector(content, '.anki-note-error-header');
        this._setTextContent(header, (errors.length === 1 ? 'An error occurred:' : `${errors.length} errors occurred:`), 'en');

        const list = this._querySelector(content, '.anki-note-error-list');
        for (const error of errors) {
            const div = document.createElement('li');
            div.className = 'anki-note-error-message';
            if (error instanceof DocumentFragment || error instanceof Node) {
                div.appendChild(error);
            } else {
                let message = isObject(error) && typeof error.message === 'string' ? error.message : `${error}`;
                let link = null;
                if (error instanceof ExtensionError && error.data !== null && typeof error.data === 'object') {
                    const {referenceUrl} = /** @type {import('core').UnknownObject} */ (error.data);
                    if (typeof referenceUrl === 'string') {
                        message = message.trimEnd();
                        if (!/[.!?]^/.test(message)) { message += '.'; }
                        message += ' ';
                        link = document.createElement('a');
                        link.href = referenceUrl;
                        link.target = '_blank';
                        link.rel = 'noreferrer noopener';
                        link.textContent = 'More info';
                    }
                }
                this._setTextContent(div, message);
                if (link !== null) { div.appendChild(link); }
            }
            list.appendChild(div);
        }

        return content;
    }

    /**
     * @returns {HTMLElement}
     */
    createProfileListItem() {
        return this._instantiate('profile-list-item');
    }

    /**
     * @param {string} name
     * @returns {HTMLElement}
     */
    instantiateTemplate(name) {
        return this._instantiate(name);
    }

    /**
     * @param {string} name
     * @returns {DocumentFragment}
     */
    instantiateTemplateFragment(name) {
        return this._templates.instantiateFragment(name);
    }

    // Private

    /**
     * @param {import('dictionary').TermHeadword} headword
     * @param {number} headwordIndex
     * @param {import('dictionary').TermPronunciation[]} pronunciations
     * @returns {HTMLElement}
     */
    _createTermHeadword(headword, headwordIndex, pronunciations) {
        const {term, reading, tags, sources} = headword;

        let isPrimaryAny = false;
        const matchTypes = new Set();
        const matchSources = new Set();
        for (const {matchType, matchSource, isPrimary} of sources) {
            if (isPrimary) {
                isPrimaryAny = true;
            }
            matchTypes.add(matchType);
            matchSources.add(matchSource);
        }

        const node = this._instantiate('headword');

        const termContainer = this._querySelector(node, '.headword-term');

        node.dataset.isPrimary = `${isPrimaryAny}`;
        node.dataset.readingIsSame = `${reading === term}`;
        node.dataset.frequency = DictionaryDataUtil.getTermFrequency(tags);
        node.dataset.matchTypes = [...matchTypes].join(' ');
        node.dataset.matchSources = [...matchSources].join(' ');

        const {wordClasses} = headword;
        const pronunciationCategories = this._getPronunciationCategories(reading, pronunciations, wordClasses, headwordIndex);
        if (pronunciationCategories !== null) {
            node.dataset.pronunciationCategories = pronunciationCategories;
        }
        if (wordClasses.length > 0) {
            node.dataset.wordClasses = wordClasses.join(' ');
        }

        const headwordReading = this._querySelector(node, '.headword-reading');
        this._setTextContent(headwordReading, reading);

        this._appendFurigana(termContainer, term, reading, this._appendKanjiLinks.bind(this));

        return node;
    }

    /**
     * @param {import('dictionary').InflectionRuleChainCandidate} inflectionRuleChain
     * @returns {?HTMLElement}
     */
    _createInflectionRuleChain(inflectionRuleChain) {
        const {source, inflectionRules} = inflectionRuleChain;
        if (!Array.isArray(inflectionRules) || inflectionRules.length === 0) { return null; }
        const fragment = this._instantiate('inflection-rule-chain');

        const sourceIcon = this._getInflectionSourceIcon(source);

        fragment.appendChild(sourceIcon);

        this._appendMultiple(fragment, this._createTermInflection.bind(this), inflectionRules);
        return fragment;
    }

    /**
     * @param {import('dictionary').InflectionSource} source
     * @returns {HTMLElement}
     */
    _getInflectionSourceIcon(source) {
        const icon = document.createElement('span');
        icon.classList.add('inflection-source-icon');
        icon.dataset.inflectionSource = source;
        switch (source) {
            case 'dictionary':
                icon.title = 'Dictionary Deinflection';
                return icon;
            case 'algorithm':
                icon.title = 'Algorithm Deinflection';
                return icon;
            case 'both':
                icon.title = 'Dictionary and Algorithm Deinflection';
                return icon;
        }
    }

    /**
     * @param {string} inflection
     * @returns {DocumentFragment}
     */
    _createTermInflection(inflection) {
        const fragment = this._templates.instantiateFragment('inflection');
        const node = this._querySelector(fragment, '.inflection');
        this._setTextContent(node, inflection);
        node.dataset.reason = inflection;
        return fragment;
    }

    /**
     * @param {import('dictionary').TermDefinition} definition
     * @param {import('dictionary').Tag} dictionaryTag
     * @param {import('dictionary').TermHeadword[]} headwords
     * @param {Set<string>} uniqueTerms
     * @param {Set<string>} uniqueReadings
     * @returns {HTMLElement}
     */
    _createTermDefinition(definition, dictionaryTag, headwords, uniqueTerms, uniqueReadings) {
        const {dictionary, tags, headwordIndices, entries} = definition;
        const disambiguations = DictionaryDataUtil.getDisambiguations(headwords, headwordIndices, uniqueTerms, uniqueReadings);

        const node = this._instantiate('definition-item');

        const tagListContainer = this._querySelector(node, '.definition-tag-list');
        const onlyListContainer = this._querySelector(node, '.definition-disambiguation-list');
        const entriesContainer = this._querySelector(node, '.gloss-list');

        node.dataset.dictionary = dictionary;

        this._appendMultiple(tagListContainer, this._createTag.bind(this), [...tags, dictionaryTag]);
        this._appendMultiple(onlyListContainer, this._createTermDisambiguation.bind(this), disambiguations);
        this._appendMultiple(entriesContainer, this._createTermDefinitionEntry.bind(this), entries, dictionary);

        return node;
    }

    /**
     * @param {import('dictionary-data').TermGlossaryContent} entry
     * @param {string} dictionary
     * @returns {?HTMLElement}
     */
    _createTermDefinitionEntry(entry, dictionary) {
        switch (typeof entry) {
            case 'string':
                return this._createTermDefinitionEntryText(entry);
            case 'object': {
                switch (entry.type) {
                    case 'image':
                        return this._createTermDefinitionEntryImage(entry, dictionary);
                    case 'structured-content':
                        return this._createTermDefinitionEntryStructuredContent(entry.content, dictionary);
                    case 'text':
                        break;
                }
                break;
            }
        }

        return null;
    }

    /**
     * @param {string} text
     * @returns {HTMLElement}
     */
    _createTermDefinitionEntryText(text) {
        const node = this._instantiate('gloss-item');
        const container = this._querySelector(node, '.gloss-content');
        this._setMultilineTextContent(container, text);
        return node;
    }

    /**
     * @param {import('dictionary-data').TermGlossaryImage} data
     * @param {string} dictionary
     * @returns {HTMLElement}
     */
    _createTermDefinitionEntryImage(data, dictionary) {
        const {description} = data;

        const node = this._instantiate('gloss-item');

        const contentContainer = this._querySelector(node, '.gloss-content');
        const image = this._structuredContentGenerator.createDefinitionImage(data, dictionary);
        contentContainer.appendChild(image);

        if (typeof description === 'string') {
            const fragment = this._templates.instantiateFragment('gloss-item-image-description');
            const container = this._querySelector(fragment, '.gloss-image-description');
            this._setMultilineTextContent(container, description);
            contentContainer.appendChild(fragment);
        }

        return node;
    }

    /**
     * @param {import('structured-content').Content} content
     * @param {string} dictionary
     * @returns {HTMLElement}
     */
    _createTermDefinitionEntryStructuredContent(content, dictionary) {
        const node = this._instantiate('gloss-item');
        const contentContainer = this._querySelector(node, '.gloss-content');
        this._structuredContentGenerator.appendStructuredContent(contentContainer, content, dictionary);
        return node;
    }

    /**
     * @param {string} disambiguation
     * @returns {HTMLElement}
     */
    _createTermDisambiguation(disambiguation) {
        const node = this._instantiate('definition-disambiguation');
        node.dataset.term = disambiguation;
        this._setTextContent(node, disambiguation, 'ja');
        return node;
    }

    /**
     * @param {string} character
     * @returns {HTMLAnchorElement}
     */
    _createKanjiLink(character) {
        const node = document.createElement('a');
        node.className = 'headword-kanji-link';
        this._setTextContent(node, character, 'ja');
        return node;
    }

    /**
     * @param {string} text
     * @returns {HTMLElement}
     */
    _createKanjiDefinition(text) {
        const node = this._instantiate('kanji-gloss-item');
        const container = this._querySelector(node, '.kanji-gloss-content');
        this._setMultilineTextContent(container, text);
        return node;
    }

    /**
     * @param {string} reading
     * @returns {HTMLElement}
     */
    _createKanjiReading(reading) {
        const node = this._instantiate('kanji-reading');
        this._setTextContent(node, reading, 'ja');
        return node;
    }

    /**
     * @param {import('dictionary').KanjiStat[]} details
     * @returns {HTMLElement}
     */
    _createKanjiInfoTable(details) {
        const node = this._instantiate('kanji-info-table');
        const container = this._querySelector(node, '.kanji-info-table-body');

        const count = this._appendMultiple(container, this._createKanjiInfoTableItem.bind(this), details);
        if (count === 0) {
            const n = this._createKanjiInfoTableItemEmpty();
            container.appendChild(n);
        }

        return node;
    }

    /**
     * @param {import('dictionary').KanjiStat} details
     * @returns {HTMLElement}
     */
    _createKanjiInfoTableItem(details) {
        const {content, name, value} = details;
        const node = this._instantiate('kanji-info-table-item');
        const nameNode = this._querySelector(node, '.kanji-info-table-item-header');
        const valueNode = this._querySelector(node, '.kanji-info-table-item-value');
        this._setTextContent(nameNode, content.length > 0 ? content : name);
        this._setTextContent(valueNode, typeof value === 'string' ? value : `${value}`);
        return node;
    }

    /**
     * @returns {HTMLElement}
     */
    _createKanjiInfoTableItemEmpty() {
        return this._instantiate('kanji-info-table-empty');
    }

    /**
     * @param {import('dictionary').Tag} tag
     * @returns {HTMLElement}
     */
    _createTag(tag) {
        const {content, name, category, redundant} = tag;
        const node = this._instantiate('tag');

        const inner = this._querySelector(node, '.tag-label-content');

        const contentString = content.join('\n');

        node.title = contentString;
        this._setTextContent(inner, name);
        node.dataset.details = contentString.length > 0 ? contentString : name;
        node.dataset.category = category;
        if (redundant) { node.dataset.redundant = 'true'; }

        return node;
    }

    /**
     * @param {import('dictionary-data-util').TagGroup} tagInfo
     * @param {number} totalHeadwordCount
     * @returns {HTMLElement}
     */
    _createTermTag(tagInfo, totalHeadwordCount) {
        const {tag, headwordIndices} = tagInfo;
        const node = this._createTag(tag);
        node.dataset.headwords = headwordIndices.join(' ');
        node.dataset.totalHeadwordCount = `${totalHeadwordCount}`;
        node.dataset.matchedHeadwordCount = `${headwordIndices.length}`;
        node.dataset.unmatchedHeadwordCount = `${Math.max(0, totalHeadwordCount - headwordIndices.length)}`;
        return node;
    }

    /**
     * @param {string} name
     * @param {string} category
     * @returns {import('dictionary').Tag}
     */
    _createTagData(name, category) {
        return {
            name,
            category,
            order: 0,
            score: 0,
            content: [],
            dictionaries: [],
            redundant: false
        };
    }

    /**
     * @param {string} text
     * @returns {HTMLElement}
     */
    _createSearchTag(text) {
        return this._createTag(this._createTagData(text, 'search'));
    }

    /**
     * @param {import('dictionary-data-util').DictionaryGroupedPronunciations} details
     * @returns {HTMLElement}
     */
    _createGroupedPronunciation(details) {
        const {dictionary, pronunciations} = details;

        const node = this._instantiate('pronunciation-group');
        node.dataset.dictionary = dictionary;
        node.dataset.pronunciationsMulti = 'true';
        node.dataset.pronunciationsCount = `${pronunciations.length}`;

        const n1 = this._querySelector(node, '.pronunciation-group-tag-list');
        const tag = this._createTag(this._createTagData(dictionary, 'pronunciation-dictionary'));
        n1.appendChild(tag);

        let hasTags = false;
        for (const {pronunciation: {tags}} of pronunciations) {
            if (tags.length > 0) {
                hasTags = true;
                break;
            }
        }

        const n = this._querySelector(node, '.pronunciation-list');
        n.dataset.hasTags = `${hasTags}`;
        this._appendMultiple(n, this._createPronunciation.bind(this), pronunciations);

        return node;
    }

    /**
     * @param {import('dictionary-data-util').GroupedPronunciation} details
     * @returns {HTMLElement}
     */
    _createPronunciation(details) {
        const {pronunciation} = details;
        switch (pronunciation.type) {
            case 'pitch-accent':
                return this._createPronunciationPitchAccent(pronunciation, details);
            case 'phonetic-transcription':
                return this._createPronunciationPhoneticTranscription(pronunciation, details);
        }
    }


    /**
     * @param {import('dictionary').PhoneticTranscription} pronunciation
     * @param {import('dictionary-data-util').GroupedPronunciation} details
     * @returns {HTMLElement}
     */
    _createPronunciationPhoneticTranscription(pronunciation, details) {
        const {ipa, tags} = pronunciation;
        const {exclusiveTerms, exclusiveReadings} = details;

        const node = this._instantiate('pronunciation');

        node.dataset.tagCount = `${tags.length}`;

        let n = this._querySelector(node, '.pronunciation-tag-list');
        this._appendMultiple(n, this._createTag.bind(this), tags);

        n = this._querySelector(node, '.pronunciation-disambiguation-list');
        this._createPronunciationDisambiguations(n, exclusiveTerms, exclusiveReadings);

        n = this._querySelector(node, '.pronunciation-text-container');

        this._setTextContent(n, ipa);

        return node;
    }

    /**
     * @param {import('dictionary').PitchAccent} pitchAccent
     * @param {import('dictionary-data-util').GroupedPronunciation} details
     * @returns {HTMLElement}
     */
    _createPronunciationPitchAccent(pitchAccent, details) {
        const jp = this._japaneseUtil;

        const {position, nasalPositions, devoicePositions, tags} = pitchAccent;
        const {reading, exclusiveTerms, exclusiveReadings} = details;
        const morae = jp.getKanaMorae(reading);

        const node = this._instantiate('pronunciation');

        node.dataset.pitchAccentDownstepPosition = `${position}`;
        if (nasalPositions.length > 0) { node.dataset.nasalMoraPosition = nasalPositions.join(' '); }
        if (devoicePositions.length > 0) { node.dataset.devoiceMoraPosition = devoicePositions.join(' '); }
        node.dataset.tagCount = `${tags.length}`;

        let n = this._querySelector(node, '.pronunciation-tag-list');
        this._appendMultiple(n, this._createTag.bind(this), tags);

        n = this._querySelector(node, '.pronunciation-disambiguation-list');
        this._createPronunciationDisambiguations(n, exclusiveTerms, exclusiveReadings);

        n = this._querySelector(node, '.pronunciation-downstep-notation-container');
        n.appendChild(this._pronunciationGenerator.createPronunciationDownstepPosition(position));

        n = this._querySelector(node, '.pronunciation-text-container');

        n.lang = 'ja';
        n.appendChild(this._pronunciationGenerator.createPronunciationText(morae, position, nasalPositions, devoicePositions));

        n = this._querySelector(node, '.pronunciation-graph-container');
        n.appendChild(this._pronunciationGenerator.createPronunciationGraph(morae, position));

        return node;
    }

    /**
     * @param {HTMLElement} container
     * @param {string[]} exclusiveTerms
     * @param {string[]} exclusiveReadings
     */
    _createPronunciationDisambiguations(container, exclusiveTerms, exclusiveReadings) {
        const templateName = 'pronunciation-disambiguation';
        for (const term of exclusiveTerms) {
            const node = this._instantiate(templateName);
            node.dataset.type = 'term';
            this._setTextContent(node, term, 'ja');
            container.appendChild(node);
        }

        for (const exclusiveReading of exclusiveReadings) {
            const node = this._instantiate(templateName);
            node.dataset.type = 'reading';
            this._setTextContent(node, exclusiveReading, 'ja');
            container.appendChild(node);
        }

        container.dataset.count = `${exclusiveTerms.length + exclusiveReadings.length}`;
        container.dataset.termCount = `${exclusiveTerms.length}`;
        container.dataset.readingCount = `${exclusiveReadings.length}`;
    }

    /**
     * @param {import('dictionary-data-util').DictionaryFrequency<import('dictionary-data-util').TermFrequency>|import('dictionary-data-util').DictionaryFrequency<import('dictionary-data-util').KanjiFrequency>} details
     * @param {boolean} kanji
     * @returns {HTMLElement}
     */
    _createFrequencyGroup(details, kanji) {
        const {dictionary, frequencies} = details;

        const node = this._instantiate('frequency-group-item');
        const body = this._querySelector(node, '.tag-body-content');

        const tagLabel = this._querySelector(node, '.tag-label-content');
        this._setTextContent(tagLabel, dictionary);
        node.dataset.details = dictionary;

        const ii = frequencies.length;
        for (let i = 0; i < ii; ++i) {
            const item = frequencies[i];
            const itemNode = (
                kanji ?
                this._createKanjiFrequency(/** @type {import('dictionary-data-util').KanjiFrequency} */ (item), dictionary) :
                this._createTermFrequency(/** @type {import('dictionary-data-util').TermFrequency} */ (item), dictionary)
            );
            itemNode.dataset.index = `${i}`;
            body.appendChild(itemNode);
        }

        body.dataset.count = `${ii}`;
        node.dataset.count = `${ii}`;
        node.dataset.details = dictionary;

        return node;
    }

    /**
     * @param {import('dictionary-data-util').TermFrequency} details
     * @param {string} dictionary
     * @returns {HTMLElement}
     */
    _createTermFrequency(details, dictionary) {
        const {term, reading, values} = details;
        const node = this._instantiate('term-frequency-item');
        const tagLabel = this._querySelector(node, '.tag-label-content');
        const disambiguationTerm = this._querySelector(node, '.frequency-disambiguation-term');
        const disambiguationReading = this._querySelector(node, '.frequency-disambiguation-reading');
        const frequencyValueList = this._querySelector(node, '.frequency-value-list');

        this._setTextContent(tagLabel, dictionary);
        this._setTextContent(disambiguationTerm, term, 'ja');
        this._setTextContent(disambiguationReading, (reading !== null ? reading : ''), 'ja');
        this._populateFrequencyValueList(frequencyValueList, values);

        node.dataset.term = term;
        if (typeof reading === 'string') {
            node.dataset.reading = reading;
        }
        node.dataset.hasReading = `${reading !== null}`;
        node.dataset.readingIsSame = `${reading === term}`;
        node.dataset.dictionary = dictionary;
        node.dataset.details = dictionary;

        return node;
    }

    /**
     * @param {import('dictionary-data-util').KanjiFrequency} details
     * @param {string} dictionary
     * @returns {HTMLElement}
     */
    _createKanjiFrequency(details, dictionary) {
        const {character, values} = details;
        const node = this._instantiate('kanji-frequency-item');
        const tagLabel = this._querySelector(node, '.tag-label-content');
        const frequencyValueList = this._querySelector(node, '.frequency-value-list');

        this._setTextContent(tagLabel, dictionary);
        this._populateFrequencyValueList(frequencyValueList, values);

        node.dataset.character = character;
        node.dataset.dictionary = dictionary;
        node.dataset.details = dictionary;

        return node;
    }

    /**
     * @param {HTMLElement} node
     * @param {import('dictionary-data-util').FrequencyData[]} values
     */
    _populateFrequencyValueList(node, values) {
        let fullFrequency = '';
        for (let i = 0, ii = values.length; i < ii; ++i) {
            const {frequency, displayValue} = values[i];
            const frequencyString = `${frequency}`;
            const text = displayValue !== null ? displayValue : `${frequency}`;

            if (i > 0) {
                const node2 = document.createElement('span');
                node2.className = 'frequency-value';
                node2.dataset.frequency = `${frequency}`;
                node2.textContent = ', ';
                node.appendChild(node2);
                fullFrequency += ', ';
            }

            const node2 = document.createElement('span');
            node2.className = 'frequency-value';
            node2.dataset.frequency = frequencyString;
            if (displayValue !== null) {
                node2.dataset.displayValue = `${displayValue}`;
                if (displayValue !== frequencyString) {
                    node2.title = frequencyString;
                }
            }
            this._setTextContent(node2, text, 'ja');
            node.appendChild(node2);

            fullFrequency += text;
        }

        node.dataset.frequency = fullFrequency;
    }

    /**
     * @param {HTMLElement} container
     * @param {string} text
     */
    _appendKanjiLinks(container, text) {
        const jp = this._japaneseUtil;
        let part = '';
        for (const c of text) {
            if (jp.isCodePointKanji(/** @type {number} */ (c.codePointAt(0)))) {
                if (part.length > 0) {
                    container.appendChild(document.createTextNode(part));
                    part = '';
                }

                const link = this._createKanjiLink(c);
                container.appendChild(link);
            } else {
                part += c;
            }
        }
        if (part.length > 0) {
            container.appendChild(document.createTextNode(part));
        }
    }

    /**
     * @template [TItem=unknown]
     * @template [TExtraArg=void]
     * @param {HTMLElement} container
     * @param {(item: TItem, arg: TExtraArg) => ?Node} createItem
     * @param {TItem[]} detailsArray
     * @param {TExtraArg} [arg]
     * @returns {number}
     */
    _appendMultiple(container, createItem, detailsArray, arg) {
        let count = 0;
        const {ELEMENT_NODE} = Node;
        if (Array.isArray(detailsArray)) {
            for (const details of detailsArray) {
                const item = createItem(details, /** @type {TExtraArg} */ (arg));
                if (item === null) { continue; }
                container.appendChild(item);
                if (item.nodeType === ELEMENT_NODE) {
                    /** @type {HTMLElement} */ (item).dataset.index = `${count}`;
                }
                ++count;
            }
        }

        container.dataset.count = `${count}`;

        return count;
    }

    /**
     * @param {HTMLElement} container
     * @param {string} term
     * @param {string} reading
     * @param {(element: HTMLElement, text: string) => void} addText
     */
    _appendFurigana(container, term, reading, addText) {
        container.lang = 'ja';
        const segments = this._japaneseUtil.distributeFurigana(term, reading);
        for (const {text, reading: furigana} of segments) {
            if (furigana) {
                const ruby = document.createElement('ruby');
                const rt = document.createElement('rt');
                addText(ruby, text);
                ruby.appendChild(rt);
                rt.appendChild(document.createTextNode(furigana));
                container.appendChild(ruby);
            } else {
                addText(container, text);
            }
        }
    }

    /**
     * @param {string} dictionary
     * @returns {import('dictionary').Tag}
     */
    _createDictionaryTag(dictionary) {
        return this._createTagData(dictionary, 'dictionary');
    }

    /**
     * @param {HTMLElement} node
     * @param {string} value
     * @param {string} [language]
     */
    _setTextContent(node, value, language) {
        if (typeof language === 'string') {
            node.lang = language;
        } else if (this._japaneseUtil.isStringPartiallyJapanese(value)) {
            node.lang = 'ja';
        }

        node.textContent = value;
    }

    /**
     * @param {HTMLElement} node
     * @param {string} value
     * @param {string} [language]
     */
    _setMultilineTextContent(node, value, language) {
        // This can't just call _setTextContent because the lack of <br> elements will
        // cause the text to not copy correctly.
        if (typeof language === 'string') {
            node.lang = language;
        } else if (this._japaneseUtil.isStringPartiallyJapanese(value)) {
            node.lang = 'ja';
        }

        let start = 0;
        while (true) {
            const end = value.indexOf('\n', start);
            if (end < 0) { break; }
            node.appendChild(document.createTextNode(value.substring(start, end)));
            node.appendChild(document.createElement('br'));
            start = end + 1;
        }

        if (start < value.length) {
            node.appendChild(document.createTextNode(start === 0 ? value : value.substring(start)));
        }
    }

    /**
     * @param {string} reading
     * @param {import('dictionary').TermPronunciation[]} termPronunciations
     * @param {string[]} wordClasses
     * @param {number} headwordIndex
     * @returns {?string}
     */
    _getPronunciationCategories(reading, termPronunciations, wordClasses, headwordIndex) {
        if (termPronunciations.length === 0) { return null; }
        const isVerbOrAdjective = DictionaryDataUtil.isNonNounVerbOrAdjective(wordClasses);
        /** @type {Set<import('japanese-util').PitchCategory>} */
        const categories = new Set();
        for (const termPronunciation of termPronunciations) {
            if (termPronunciation.headwordIndex !== headwordIndex) { continue; }
            for (const pronunciation of termPronunciation.pronunciations) {
                if (pronunciation.type !== 'pitch-accent') { continue; }
                const category = this._japaneseUtil.getPitchCategory(reading, pronunciation.position, isVerbOrAdjective);
                if (category !== null) {
                    categories.add(category);
                }
            }
        }
        return categories.size > 0 ? [...categories].join(' ') : null;
    }

    /**
     * @template {HTMLElement} T
     * @param {string} name
     * @returns {T}
     */
    _instantiate(name) {
        return /** @type {T} */ (this._templates.instantiate(name));
    }

    /**
     * @template {HTMLElement} T
     * @param {Element|DocumentFragment} element
     * @param {string} selector
     * @returns {T}
     */
    _querySelector(element, selector) {
        return /** @type {T} */ (element.querySelector(selector));
    }
}
