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

import * as ajvSchemas0 from '../../lib/validate-schemas.js';
import {
    BlobWriter as BlobWriter0,
    TextWriter as TextWriter0,
    Uint8ArrayReader as Uint8ArrayReader0,
    ZipReader as ZipReader0,
    configure
} from '../../lib/zip.js';
import {stringReverse} from '../core/utilities.js';
import {ExtensionError} from '../core/extension-error.js';
import {parseJson} from '../core/json.js';
import {toError} from '../core/to-error.js';
import {MediaUtil} from '../media/media-util.js';

const ajvSchemas = /** @type {import('dictionary-importer').CompiledSchemaValidators} */ (/** @type {unknown} */ (ajvSchemas0));
const BlobWriter = /** @type {typeof import('@zip.js/zip.js').BlobWriter} */ (/** @type {unknown} */ (BlobWriter0));
const TextWriter = /** @type {typeof import('@zip.js/zip.js').TextWriter} */ (/** @type {unknown} */ (TextWriter0));
const Uint8ArrayReader = /** @type {typeof import('@zip.js/zip.js').Uint8ArrayReader} */ (/** @type {unknown} */ (Uint8ArrayReader0));
const ZipReader = /** @type {typeof import('@zip.js/zip.js').ZipReader} */ (/** @type {unknown} */ (ZipReader0));

export class DictionaryImporter {
    /**
     * @param {import('dictionary-importer-media-loader').GenericMediaLoader} mediaLoader
     * @param {import('dictionary-importer').OnProgressCallback} [onProgress]
     */
    constructor(mediaLoader, onProgress) {
        /** @type {import('dictionary-importer-media-loader').GenericMediaLoader} */
        this._mediaLoader = mediaLoader;
        /** @type {import('dictionary-importer').OnProgressCallback} */
        this._onProgress = typeof onProgress === 'function' ? onProgress : () => {};
        /** @type {import('dictionary-importer').ProgressData} */
        this._progressData = this._createProgressData();
    }

    /**
     * @param {import('./dictionary-database.js').DictionaryDatabase} dictionaryDatabase
     * @param {ArrayBuffer} archiveContent
     * @param {import('dictionary-importer').ImportDetails} details
     * @returns {Promise<import('dictionary-importer').ImportResult>}
     */
    async importDictionary(dictionaryDatabase, archiveContent, details) {
        if (!dictionaryDatabase) {
            throw new Error('Invalid database');
        }
        if (!dictionaryDatabase.isPrepared()) {
            throw new Error('Database is not ready');
        }

        this._progressReset();

        configure({
            workerScripts: {
                deflate: ['../../lib/z-worker.js'],
                inflate: ['../../lib/z-worker.js']
            }
        });

        // Read archive
        const zipFileReader = new Uint8ArrayReader(new Uint8Array(archiveContent));
        const zipReader = new ZipReader(zipFileReader);
        const zipEntries = await zipReader.getEntries();
        /** @type {import('dictionary-importer').ArchiveFileMap} */
        const fileMap = new Map();
        for (const entry of zipEntries) {
            fileMap.set(entry.filename, entry);
        }
        // Read and validate index
        const indexFileName = 'index.json';
        const indexFile = fileMap.get(indexFileName);
        if (typeof indexFile === 'undefined') {
            throw new Error('No dictionary index found in archive');
        }
        const indexFile2 = /** @type {import('@zip.js/zip.js').Entry} */ (indexFile);

        const indexContent = await this._getData(indexFile2, new TextWriter());
        const index = /** @type {import('dictionary-data').Index} */ (parseJson(indexContent));

        if (!ajvSchemas.dictionaryIndex(index)) {
            throw this._formatAjvSchemaError(ajvSchemas.dictionaryIndex, indexFileName);
        }

        const dictionaryTitle = index.title;
        const version = typeof index.format === 'number' ? index.format : index.version;

        if (typeof version !== 'number' || !dictionaryTitle || !index.revision) {
            throw new Error('Unrecognized dictionary format');
        }

        // Verify database is not already imported
        if (await dictionaryDatabase.dictionaryExists(dictionaryTitle)) {
            throw new Error('Dictionary is already imported');
        }

        // Load schemas
        this._progressNextStep(0);
        const dataBankSchemas = this._getDataBankSchemas(version);

        // Files
        /** @type {import('dictionary-importer').QueryDetails} */
        const queryDetails = [
            ['termFiles', /^term_bank_(\d+)\.json$/],
            ['termMetaFiles', /^term_meta_bank_(\d+)\.json$/],
            ['kanjiFiles', /^kanji_bank_(\d+)\.json$/],
            ['kanjiMetaFiles', /^kanji_meta_bank_(\d+)\.json$/],
            ['tagFiles', /^tag_bank_(\d+)\.json$/]
        ];
        const {termFiles, termMetaFiles, kanjiFiles, kanjiMetaFiles, tagFiles} = Object.fromEntries(this._getArchiveFiles(fileMap, queryDetails));

        // Load data
        this._progressNextStep(termFiles.length + termMetaFiles.length + kanjiFiles.length + kanjiMetaFiles.length + tagFiles.length);
        const termList = await (
            version === 1 ?
            this._readFileSequence(termFiles, this._convertTermBankEntryV1.bind(this), dataBankSchemas[0], dictionaryTitle) :
            this._readFileSequence(termFiles, this._convertTermBankEntryV3.bind(this), dataBankSchemas[0], dictionaryTitle)
        );
        const termMetaList = await this._readFileSequence(termMetaFiles, this._convertTermMetaBankEntry.bind(this), dataBankSchemas[1], dictionaryTitle);
        const kanjiList = await (
            version === 1 ?
            this._readFileSequence(kanjiFiles, this._convertKanjiBankEntryV1.bind(this), dataBankSchemas[2], dictionaryTitle) :
            this._readFileSequence(kanjiFiles, this._convertKanjiBankEntryV3.bind(this), dataBankSchemas[2], dictionaryTitle)
        );
        const kanjiMetaList = await this._readFileSequence(kanjiMetaFiles, this._convertKanjiMetaBankEntry.bind(this), dataBankSchemas[3], dictionaryTitle);
        const tagList = await this._readFileSequence(tagFiles, this._convertTagBankEntry.bind(this), dataBankSchemas[4], dictionaryTitle);
        this._addOldIndexTags(index, tagList, dictionaryTitle);

        // Prefix wildcard support
        const prefixWildcardsSupported = !!details.prefixWildcardsSupported;
        if (prefixWildcardsSupported) {
            for (const entry of termList) {
                entry.expressionReverse = stringReverse(entry.expression);
                entry.readingReverse = stringReverse(entry.reading);
            }
        }

        // Extended data support
        this._progressNextStep(termList.length);
        const formatProgressInterval = 1000;
        /** @type {import('dictionary-importer').ImportRequirement[]} */
        const requirements = [];
        for (let i = 0, ii = termList.length; i < ii; ++i) {
            const entry = termList[i];
            const glossaryList = entry.glossary;
            for (let j = 0, jj = glossaryList.length; j < jj; ++j) {
                const glossary = glossaryList[j];
                if (typeof glossary !== 'object' || glossary === null || Array.isArray(glossary)) { continue; }
                glossaryList[j] = this._formatDictionaryTermGlossaryObject(glossary, entry, requirements);
            }
            if ((i % formatProgressInterval) === 0) {
                this._progressData.index = i;
                this._progress();
            }
        }
        this._progress();

        // Async requirements
        this._progressNextStep(requirements.length);
        const {media} = await this._resolveAsyncRequirements(requirements, fileMap);

        // Add dictionary descriptor
        this._progressNextStep(termList.length + termMetaList.length + kanjiList.length + kanjiMetaList.length + tagList.length + media.length);

        /** @type {import('dictionary-importer').SummaryCounts} */
        const counts = {
            terms: {total: termList.length},
            termMeta: this._getMetaCounts(termMetaList),
            kanji: {total: kanjiList.length},
            kanjiMeta: this._getMetaCounts(kanjiMetaList),
            tagMeta: {total: tagList.length},
            media: {total: media.length}
        };
        const summary = this._createSummary(dictionaryTitle, version, index, {prefixWildcardsSupported, counts});
        dictionaryDatabase.bulkAdd('dictionaries', [summary], 0, 1);

        // Add data
        /** @type {Error[]} */
        const errors = [];
        const maxTransactionLength = 1000;

        /**
         * @template {import('dictionary-database').ObjectStoreName} T
         * @param {T} objectStoreName
         * @param {import('dictionary-database').ObjectStoreData<T>[]} entries
         */
        const bulkAdd = async (objectStoreName, entries) => {
            const ii = entries.length;
            for (let i = 0; i < ii; i += maxTransactionLength) {
                const count = Math.min(maxTransactionLength, ii - i);

                try {
                    await dictionaryDatabase.bulkAdd(objectStoreName, entries, i, count);
                } catch (e) {
                    errors.push(toError(e));
                }

                this._progressData.index += count;
                this._progress();
            }
        };

        await bulkAdd('terms', termList);
        await bulkAdd('termMeta', termMetaList);
        await bulkAdd('kanji', kanjiList);
        await bulkAdd('kanjiMeta', kanjiMetaList);
        await bulkAdd('tagMeta', tagList);
        await bulkAdd('media', media);

        this._progress();

        return {result: summary, errors};
    }

    /**
     * @returns {import('dictionary-importer').ProgressData}
     */
    _createProgressData() {
        return {
            stepIndex: 0,
            stepCount: 6,
            index: 0,
            count: 0
        };
    }

    /** */
    _progressReset() {
        this._progressData = this._createProgressData();
        this._progress();
    }

    /**
     * @param {number} count
     */
    _progressNextStep(count) {
        ++this._progressData.stepIndex;
        this._progressData.index = 0;
        this._progressData.count = count;
        this._progress();
    }

    /** */
    _progress() {
        this._onProgress(this._progressData);
    }

    /**
     * @param {string} dictionaryTitle
     * @param {number} version
     * @param {import('dictionary-data').Index} index
     * @param {{prefixWildcardsSupported: boolean, counts: import('dictionary-importer').SummaryCounts}} details
     * @returns {import('dictionary-importer').Summary}
     */
    _createSummary(dictionaryTitle, version, index, details) {
        const indexSequenced = index.sequenced;
        const {prefixWildcardsSupported, counts} = details;

        /** @type {import('dictionary-importer').Summary} */
        const summary = {
            title: dictionaryTitle,
            revision: index.revision,
            sequenced: typeof indexSequenced === 'boolean' && indexSequenced,
            version,
            importDate: Date.now(),
            prefixWildcardsSupported,
            counts
        };

        const {author, url, description, attribution, frequencyMode} = index;
        if (typeof author === 'string') { summary.author = author; }
        if (typeof url === 'string') { summary.url = url; }
        if (typeof description === 'string') { summary.description = description; }
        if (typeof attribution === 'string') { summary.attribution = attribution; }
        if (typeof frequencyMode === 'string') { summary.frequencyMode = frequencyMode; }

        return summary;
    }

    /**
     * @param {import('ajv').ValidateFunction} schema
     * @param {string} fileName
     * @returns {ExtensionError}
     */
    _formatAjvSchemaError(schema, fileName) {
        const e2 = new ExtensionError(`Dictionary has invalid data in '${fileName}'`);
        e2.data = schema.errors;

        return e2;
    }

    /**
     * @param {number} version
     * @returns {import('dictionary-importer').CompiledSchemaNameArray}
     */
    _getDataBankSchemas(version) {
        const termBank = (
            version === 1 ?
            'dictionaryTermBankV1' :
            'dictionaryTermBankV3'
        );
        const termMetaBank = 'dictionaryTermMetaBankV3';
        const kanjiBank = (
            version === 1 ?
            'dictionaryKanjiBankV1' :
            'dictionaryKanjiBankV3'
        );
        const kanjiMetaBank = 'dictionaryKanjiMetaBankV3';
        const tagBank = 'dictionaryTagBankV3';

        return [termBank, termMetaBank, kanjiBank, kanjiMetaBank, tagBank];
    }

    /**
     * @param {import('dictionary-data').TermGlossaryText|import('dictionary-data').TermGlossaryImage|import('dictionary-data').TermGlossaryStructuredContent} data
     * @param {import('dictionary-database').DatabaseTermEntry} entry
     * @param {import('dictionary-importer').ImportRequirement[]} requirements
     * @returns {import('dictionary-data').TermGlossary}
     * @throws {Error}
     */
    _formatDictionaryTermGlossaryObject(data, entry, requirements) {
        switch (data.type) {
            case 'text':
                return data.text;
            case 'image':
                return this._formatDictionaryTermGlossaryImage(data, entry, requirements);
            case 'structured-content':
                return this._formatStructuredContent(data, entry, requirements);
            default:
                throw new Error(`Unhandled data type: ${/** @type {import('core').SerializableObject} */ (data).type}`);
        }
    }

    /**
     * @param {import('dictionary-data').TermGlossaryImage} data
     * @param {import('dictionary-database').DatabaseTermEntry} entry
     * @param {import('dictionary-importer').ImportRequirement[]} requirements
     * @returns {import('dictionary-data').TermGlossaryImage}
     */
    _formatDictionaryTermGlossaryImage(data, entry, requirements) {
        /** @type {import('dictionary-data').TermGlossaryImage} */
        const target = {
            type: 'image',
            path: '' // Will be populated during requirement resolution
        };
        requirements.push({type: 'image', target, source: data, entry});
        return target;
    }

    /**
     * @param {import('dictionary-data').TermGlossaryStructuredContent} data
     * @param {import('dictionary-database').DatabaseTermEntry} entry
     * @param {import('dictionary-importer').ImportRequirement[]} requirements
     * @returns {import('dictionary-data').TermGlossaryStructuredContent}
     */
    _formatStructuredContent(data, entry, requirements) {
        const content = this._prepareStructuredContent(data.content, entry, requirements);
        return {
            type: 'structured-content',
            content
        };
    }

    /**
     * @param {import('structured-content').Content} content
     * @param {import('dictionary-database').DatabaseTermEntry} entry
     * @param {import('dictionary-importer').ImportRequirement[]} requirements
     * @returns {import('structured-content').Content}
     */
    _prepareStructuredContent(content, entry, requirements) {
        if (typeof content === 'string' || !(typeof content === 'object' && content !== null)) {
            return content;
        }
        if (Array.isArray(content)) {
            for (let i = 0, ii = content.length; i < ii; ++i) {
                content[i] = this._prepareStructuredContent(content[i], entry, requirements);
            }
            return content;
        }
        const {tag} = content;
        switch (tag) {
            case 'img':
                return this._prepareStructuredContentImage(content, entry, requirements);
        }
        const childContent = content.content;
        if (typeof childContent !== 'undefined') {
            content.content = this._prepareStructuredContent(childContent, entry, requirements);
        }
        return content;
    }

    /**
     * @param {import('structured-content').ImageElement} content
     * @param {import('dictionary-database').DatabaseTermEntry} entry
     * @param {import('dictionary-importer').ImportRequirement[]} requirements
     * @returns {import('structured-content').ImageElement}
     */
    _prepareStructuredContentImage(content, entry, requirements) {
        /** @type {import('structured-content').ImageElement} */
        const target = {
            tag: 'img',
            path: '' // Will be populated during requirement resolution
        };
        requirements.push({type: 'structured-content-image', target, source: content, entry});
        return target;
    }

    /**
     * @param {import('dictionary-importer').ImportRequirement[]} requirements
     * @param {import('dictionary-importer').ArchiveFileMap} fileMap
     * @returns {Promise<{media: import('dictionary-database').MediaDataArrayBufferContent[]}>}
     */
    async _resolveAsyncRequirements(requirements, fileMap) {
        /** @type {Map<string, import('dictionary-database').MediaDataArrayBufferContent>} */
        const media = new Map();
        /** @type {import('dictionary-importer').ImportRequirementContext} */
        const context = {fileMap, media};

        for (const requirement of requirements) {
            await this._resolveAsyncRequirement(context, requirement);
        }

        return {
            media: [...media.values()]
        };
    }

    /**
     * @param {import('dictionary-importer').ImportRequirementContext} context
     * @param {import('dictionary-importer').ImportRequirement} requirement
     */
    async _resolveAsyncRequirement(context, requirement) {
        switch (requirement.type) {
            case 'image':
                await this._resolveDictionaryTermGlossaryImage(
                    context,
                    requirement.target,
                    requirement.source,
                    requirement.entry
                );
                break;
            case 'structured-content-image':
                await this._resolveStructuredContentImage(
                    context,
                    requirement.target,
                    requirement.source,
                    requirement.entry
                );
                break;
            default:
                return;
        }
        ++this._progressData.index;
        this._progress();
    }

    /**
     * @param {import('dictionary-importer').ImportRequirementContext} context
     * @param {import('dictionary-data').TermGlossaryImage} target
     * @param {import('dictionary-data').TermGlossaryImage} source
     * @param {import('dictionary-database').DatabaseTermEntry} entry
     */
    async _resolveDictionaryTermGlossaryImage(context, target, source, entry) {
        await this._createImageData(context, target, source, entry);
    }

    /**
     * @param {import('dictionary-importer').ImportRequirementContext} context
     * @param {import('structured-content').ImageElement} target
     * @param {import('structured-content').ImageElement} source
     * @param {import('dictionary-database').DatabaseTermEntry} entry
     */
    async _resolveStructuredContentImage(context, target, source, entry) {
        const {verticalAlign, sizeUnits} = source;
        await this._createImageData(context, target, source, entry);
        if (typeof verticalAlign === 'string') { target.verticalAlign = verticalAlign; }
        if (typeof sizeUnits === 'string') { target.sizeUnits = sizeUnits; }
    }

    /**
     * @param {import('dictionary-importer').ImportRequirementContext} context
     * @param {import('structured-content').ImageElementBase} target
     * @param {import('structured-content').ImageElementBase} source
     * @param {import('dictionary-database').DatabaseTermEntry} entry
     */
    async _createImageData(context, target, source, entry) {
        const {
            path,
            width: preferredWidth,
            height: preferredHeight,
            title,
            alt,
            description,
            pixelated,
            imageRendering,
            appearance,
            background,
            collapsed,
            collapsible
        } = source;
        const {width, height} = await this._getImageMedia(context, path, entry);
        target.path = path;
        target.width = width;
        target.height = height;
        if (typeof preferredWidth === 'number') { target.preferredWidth = preferredWidth; }
        if (typeof preferredHeight === 'number') { target.preferredHeight = preferredHeight; }
        if (typeof title === 'string') { target.title = title; }
        if (typeof alt === 'string') { target.alt = alt; }
        if (typeof description === 'string') { target.description = description; }
        if (typeof pixelated === 'boolean') { target.pixelated = pixelated; }
        if (typeof imageRendering === 'string') { target.imageRendering = imageRendering; }
        if (typeof appearance === 'string') { target.appearance = appearance; }
        if (typeof background === 'boolean') { target.background = background; }
        if (typeof collapsed === 'boolean') { target.collapsed = collapsed; }
        if (typeof collapsible === 'boolean') { target.collapsible = collapsible; }
    }

    /**
     * @param {import('dictionary-importer').ImportRequirementContext} context
     * @param {string} path
     * @param {import('dictionary-database').DatabaseTermEntry} entry
     * @returns {Promise<import('dictionary-database').MediaDataArrayBufferContent>}
     */
    async _getImageMedia(context, path, entry) {
        const {media} = context;
        const {dictionary} = entry;

        /**
         * @param {string} message
         * @returns {Error}
         */
        const createError = (message) => {
            const {expression, reading} = entry;
            const readingSource = reading.length > 0 ? ` (${reading})` : '';
            return new Error(`${message} at path ${JSON.stringify(path)} for ${expression}${readingSource} in ${dictionary}`);
        };

        // Check if already added
        let mediaData = media.get(path);
        if (typeof mediaData !== 'undefined') {
            if (MediaUtil.getFileExtensionFromImageMediaType(mediaData.mediaType) === null) {
                throw createError('Media file is not a valid image');
            }
            return mediaData;
        }

        // Find file in archive
        const file = context.fileMap.get(path);
        if (typeof file === 'undefined') {
            throw createError('Could not find image');
        }

        // Load file content
        let content = await (await this._getData(file, new BlobWriter())).arrayBuffer();

        const mediaType = MediaUtil.getImageMediaTypeFromFileName(path);
        if (mediaType === null) {
            throw createError('Could not determine media type for image');
        }

        // Load image data
        let width;
        let height;
        try {
            ({content, width, height} = await this._mediaLoader.getImageDetails(content, mediaType));
        } catch (e) {
            throw createError('Could not load image');
        }

        // Create image data
        mediaData = {
            dictionary,
            path,
            mediaType,
            width,
            height,
            content
        };
        media.set(path, mediaData);

        return mediaData;
    }

    /**
     * @param {import('dictionary-data').TermV1} entry
     * @param {string} dictionary
     * @returns {import('dictionary-database').DatabaseTermEntry}
     */
    _convertTermBankEntryV1(entry, dictionary) {
        let [expression, reading, definitionTags, rules, score, ...glossary] = entry;
        expression = this._normalizeTermOrReading(expression);
        reading = this._normalizeTermOrReading(reading.length > 0 ? reading : expression);
        return {expression, reading, definitionTags, rules, score, glossary, dictionary};
    }

    /**
     * @param {import('dictionary-data').TermV3} entry
     * @param {string} dictionary
     * @returns {import('dictionary-database').DatabaseTermEntry}
     */
    _convertTermBankEntryV3(entry, dictionary) {
        let [expression, reading, definitionTags, rules, score, glossary, sequence, termTags] = entry;
        expression = this._normalizeTermOrReading(expression);
        reading = this._normalizeTermOrReading(reading.length > 0 ? reading : expression);
        return {expression, reading, definitionTags, rules, score, glossary, sequence, termTags, dictionary};
    }

    /**
     * @param {import('dictionary-data').TermMeta} entry
     * @param {string} dictionary
     * @returns {import('dictionary-database').DatabaseTermMeta}
     */
    _convertTermMetaBankEntry(entry, dictionary) {
        const [expression, mode, data] = entry;
        return /** @type {import('dictionary-database').DatabaseTermMeta} */ ({expression, mode, data, dictionary});
    }

    /**
     * @param {import('dictionary-data').KanjiV1} entry
     * @param {string} dictionary
     * @returns {import('dictionary-database').DatabaseKanjiEntry}
     */
    _convertKanjiBankEntryV1(entry, dictionary) {
        const [character, onyomi, kunyomi, tags, ...meanings] = entry;
        return {character, onyomi, kunyomi, tags, meanings, dictionary};
    }

    /**
     * @param {import('dictionary-data').KanjiV3} entry
     * @param {string} dictionary
     * @returns {import('dictionary-database').DatabaseKanjiEntry}
     */
    _convertKanjiBankEntryV3(entry, dictionary) {
        const [character, onyomi, kunyomi, tags, meanings, stats] = entry;
        return {character, onyomi, kunyomi, tags, meanings, stats, dictionary};
    }

    /**
     * @param {import('dictionary-data').KanjiMeta} entry
     * @param {string} dictionary
     * @returns {import('dictionary-database').DatabaseKanjiMeta}
     */
    _convertKanjiMetaBankEntry(entry, dictionary) {
        const [character, mode, data] = entry;
        return {character, mode, data, dictionary};
    }

    /**
     * @param {import('dictionary-data').Tag} entry
     * @param {string} dictionary
     * @returns {import('dictionary-database').Tag}
     */
    _convertTagBankEntry(entry, dictionary) {
        const [name, category, order, notes, score] = entry;
        return {name, category, order, notes, score, dictionary};
    }

    /**
     * @param {import('dictionary-data').Index} index
     * @param {import('dictionary-database').Tag[]} results
     * @param {string} dictionary
     */
    _addOldIndexTags(index, results, dictionary) {
        const {tagMeta} = index;
        if (typeof tagMeta !== 'object' || tagMeta === null) { return; }
        for (const [name, value] of Object.entries(tagMeta)) {
            const {category, order, notes, score} = value;
            results.push({name, category, order, notes, score, dictionary});
        }
    }

    /**
     * @param {import('dictionary-importer').ArchiveFileMap} fileMap
     * @param {import('dictionary-importer').QueryDetails} queryDetails
     * @returns {import('dictionary-importer').QueryResult}
     */
    _getArchiveFiles(fileMap, queryDetails) {
        /** @type {import('dictionary-importer').QueryResult} */
        const results = new Map();

        for (const [fileType] of queryDetails) {
            results.set(fileType, []);
        }

        for (const [fileName, fileEntry] of fileMap.entries()) {
            for (const [fileType, fileNameFormat] of queryDetails) {
                if (!fileNameFormat.test(fileName)) { continue; }
                const entries = results.get(fileType);

                if (typeof entries !== 'undefined') {
                    entries.push(fileEntry);
                    break;
                }
            }
        }
        return results;
    }

    /**
     * @template [TEntry=unknown]
     * @template [TResult=unknown]
     * @param {import('@zip.js/zip.js').Entry[]} files
     * @param {(entry: TEntry, dictionaryTitle: string) => TResult} convertEntry
     * @param {import('dictionary-importer').CompiledSchemaName} schemaName
     * @param {string} dictionaryTitle
     * @returns {Promise<TResult[]>}
     */
    async _readFileSequence(files, convertEntry, schemaName, dictionaryTitle) {
        const progressData = this._progressData;
        let startIndex = 0;

        const results = [];
        for (const file of files) {
            const content = await this._getData(file, new TextWriter());
            const entries = /** @type {unknown} */ (parseJson(content));

            startIndex = progressData.index;
            this._progress();

            const schema = ajvSchemas[schemaName];
            if (!schema(entries)) {
                throw this._formatAjvSchemaError(schema, file.filename);
            }

            progressData.index = startIndex + 1;
            this._progress();

            if (Array.isArray(entries)) {
                for (const entry of entries) {
                    results.push(convertEntry(/** @type {TEntry} */ (entry), dictionaryTitle));
                }
            }
        }
        return results;
    }

    /**
     * @param {import('dictionary-database').DatabaseTermMeta[]|import('dictionary-database').DatabaseKanjiMeta[]} metaList
     * @returns {import('dictionary-importer').SummaryMetaCount}
     */
    _getMetaCounts(metaList) {
        /** @type {Map<string, number>} */
        const countsMap = new Map();
        for (const {mode} of metaList) {
            let count = countsMap.get(mode);
            count = typeof count !== 'undefined' ? count + 1 : 1;
            countsMap.set(mode, count);
        }
        /** @type {import('dictionary-importer').SummaryMetaCount} */
        const counts = {total: metaList.length};
        for (const [key, value] of countsMap.entries()) {
            if (Object.prototype.hasOwnProperty.call(counts, key)) { continue; }
            counts[key] = value;
        }
        return counts;
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    _normalizeTermOrReading(text) {
        // Note: this function should not perform String.normalize on the text,
        // as it will normalize characters in an undesirable way.
        // Thus, this function is currently a no-op.
        // Example:
        // - '\u9038'.normalize('NFC') => '\u9038' (逸)
        // - '\ufa67'.normalize('NFC') => '\u9038' (逸 => 逸)
        return text;
    }

    /**
     * @template [T=unknown]
     * @param {import('@zip.js/zip.js').Entry} entry
     * @param {import('@zip.js/zip.js').Writer<T>|import('@zip.js/zip.js').WritableWriter} writer
     * @returns {Promise<T>}
     */
    async _getData(entry, writer) {
        if (typeof entry.getData === 'undefined') {
            throw new Error(`Cannot read ${entry.filename}`);
        }
        return await entry.getData(writer);
    }
}
