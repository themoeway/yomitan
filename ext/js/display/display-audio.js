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

import {EventListenerCollection} from '../core/event-listener-collection.js';
import {PopupMenu} from '../dom/popup-menu.js';
import {querySelectorNotNull} from '../dom/query-selector.js';
import {AudioSystem} from '../media/audio-system.js';
import {yomitan} from '../yomitan.js';

export class DisplayAudio {
    /**
     * @param {import('./display.js').Display} display
     */
    constructor(display) {
        /** @type {import('./display.js').Display} */
        this._display = display;
        /** @type {?import('display-audio').GenericAudio} */
        this._audioPlaying = null;
        /** @type {AudioSystem} */
        this._audioSystem = new AudioSystem();
        /** @type {number} */
        this._playbackVolume = 1.0;
        /** @type {boolean} */
        this._autoPlay = false;
        /** @type {?import('core').Timeout} */
        this._autoPlayAudioTimer = null;
        /** @type {number} */
        this._autoPlayAudioDelay = 400;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {Map<string, import('display-audio').CacheItem>} */
        this._cache = new Map();
        /** @type {Element} */
        this._menuContainer = querySelectorNotNull(document, '#popup-menus');
        /** @type {import('core').TokenObject} */
        this._entriesToken = {};
        /** @type {Set<PopupMenu>} */
        this._openMenus = new Set();
        /** @type {import('display-audio').AudioSource[]} */
        this._audioSources = [];
        /** @type {Map<import('settings').AudioSourceType, string>} */
        this._audioSourceTypeNames = new Map([
            ['jpod101', 'JapanesePod101'],
            ['jpod101-alternate', 'JapanesePod101 (Alternate)'],
            ['jisho', 'Jisho.org'],
            ['text-to-speech', 'Text-to-speech'],
            ['text-to-speech-reading', 'Text-to-speech (Kana reading)'],
            ['custom', 'Custom URL'],
            ['custom-json', 'Custom URL (JSON)']
        ]);
        /** @type {(event: MouseEvent) => void} */
        this._onAudioPlayButtonClickBind = this._onAudioPlayButtonClick.bind(this);
        /** @type {(event: MouseEvent) => void} */
        this._onAudioPlayButtonContextMenuBind = this._onAudioPlayButtonContextMenu.bind(this);
        /** @type {(event: import('popup-menu').MenuCloseEvent) => void} */
        this._onAudioPlayMenuCloseClickBind = this._onAudioPlayMenuCloseClick.bind(this);
    }

    /** @type {number} */
    get autoPlayAudioDelay() {
        return this._autoPlayAudioDelay;
    }

    set autoPlayAudioDelay(value) {
        this._autoPlayAudioDelay = value;
    }

    /** */
    prepare() {
        this._audioSystem.prepare();
        /* eslint-disable no-multi-spaces */
        this._display.hotkeyHandler.registerActions([
            ['playAudio',           this._onHotkeyActionPlayAudio.bind(this)],
            ['playAudioFromSource', this._onHotkeyActionPlayAudioFromSource.bind(this)]
        ]);
        this._display.registerDirectMessageHandlers([
            ['displayAudioClearAutoPlayTimer', this._onMessageClearAutoPlayTimer.bind(this)]
        ]);
        /* eslint-enable no-multi-spaces */
        this._display.on('optionsUpdated', this._onOptionsUpdated.bind(this));
        this._display.on('contentClear', this._onContentClear.bind(this));
        this._display.on('contentUpdateEntry', this._onContentUpdateEntry.bind(this));
        this._display.on('contentUpdateComplete', this._onContentUpdateComplete.bind(this));
        this._display.on('frameVisibilityChange', this._onFrameVisibilityChange.bind(this));
        const options = this._display.getOptions();
        if (options !== null) {
            this._onOptionsUpdated({options});
        }
    }

    /** */
    clearAutoPlayTimer() {
        if (this._autoPlayAudioTimer === null) { return; }
        clearTimeout(this._autoPlayAudioTimer);
        this._autoPlayAudioTimer = null;
    }

    /** */
    stopAudio() {
        if (this._audioPlaying === null) { return; }
        this._audioPlaying.pause();
        this._audioPlaying = null;
    }

    /**
     * @param {number} dictionaryEntryIndex
     * @param {number} headwordIndex
     * @param {?string} [sourceType]
     */
    async playAudio(dictionaryEntryIndex, headwordIndex, sourceType = null) {
        let sources = this._audioSources;
        if (sourceType !== null) {
            sources = [];
            for (const source of this._audioSources) {
                if (source.type === sourceType) {
                    sources.push(source);
                }
            }
        }
        await this._playAudio(dictionaryEntryIndex, headwordIndex, sources, null);
    }

    /**
     * @param {string} term
     * @param {string} reading
     * @returns {import('display-audio').AudioMediaOptions}
     */
    getAnkiNoteMediaAudioDetails(term, reading) {
        /** @type {import('display-audio').AudioSourceShort[]} */
        const sources = [];
        let preferredAudioIndex = null;
        const primaryCardAudio = this._getPrimaryCardAudio(term, reading);
        if (primaryCardAudio !== null) {
            const {index, subIndex} = primaryCardAudio;
            const source = this._audioSources[index];
            sources.push(this._getSourceData(source));
            preferredAudioIndex = subIndex;
        } else {
            for (const source of this._audioSources) {
                if (!source.isInOptions) { continue; }
                sources.push(this._getSourceData(source));
            }
        }
        return {sources, preferredAudioIndex};
    }

    // Private

    /**
     * @param {import('display').EventArgument<'optionsUpdated'>} details
     */
    _onOptionsUpdated({options}) {
        const {enabled, autoPlay, volume, sources} = options.audio;
        this._autoPlay = enabled && autoPlay;
        this._playbackVolume = Number.isFinite(volume) ? Math.max(0.0, Math.min(1.0, volume / 100.0)) : 1.0;

        /** @type {Set<import('settings').AudioSourceType>} */
        const requiredAudioSources = new Set([
            'jpod101',
            'jpod101-alternate',
            'jisho'
        ]);
        /** @type {Map<string, import('display-audio').AudioSource[]>} */
        const nameMap = new Map();
        this._audioSources.length = 0;
        for (const {type, url, voice} of sources) {
            this._addAudioSourceInfo(type, url, voice, true, nameMap);
            requiredAudioSources.delete(type);
        }
        for (const type of requiredAudioSources) {
            this._addAudioSourceInfo(type, '', '', false, nameMap);
        }

        const data = document.documentElement.dataset;
        data.audioEnabled = `${enabled && sources.length > 0}`;

        this._cache.clear();
    }

    /** */
    _onContentClear() {
        this._entriesToken = {};
        this._cache.clear();
        this.clearAutoPlayTimer();
        this._eventListeners.removeAllEventListeners();
    }

    /**
     * @param {import('display').EventArgument<'contentUpdateEntry'>} details
     */
    _onContentUpdateEntry({element}) {
        const eventListeners = this._eventListeners;
        for (const button of element.querySelectorAll('.action-button[data-action=play-audio]')) {
            eventListeners.addEventListener(button, 'click', this._onAudioPlayButtonClickBind, false);
            eventListeners.addEventListener(button, 'contextmenu', this._onAudioPlayButtonContextMenuBind, false);
            eventListeners.addEventListener(button, 'menuClose', this._onAudioPlayMenuCloseClickBind, false);
        }
    }

    /** */
    _onContentUpdateComplete() {
        if (!this._autoPlay || !this._display.frameVisible) { return; }

        this.clearAutoPlayTimer();

        const {dictionaryEntries} = this._display;
        if (dictionaryEntries.length === 0) { return; }

        const firstDictionaryEntries = dictionaryEntries[0];
        if (firstDictionaryEntries.type === 'kanji') { return; }

        const callback = () => {
            this._autoPlayAudioTimer = null;
            this.playAudio(0, 0);
        };

        if (this._autoPlayAudioDelay > 0) {
            this._autoPlayAudioTimer = setTimeout(callback, this._autoPlayAudioDelay);
        } else {
            callback();
        }
    }

    /**
     * @param {import('display').EventArgument<'frameVisibilityChange'>} details
     */
    _onFrameVisibilityChange({value}) {
        if (!value) {
            // The auto-play timer is stopped, but any audio that has already started playing
            // is not stopped, as this is a valid use case for some users.
            this.clearAutoPlayTimer();
        }
    }

    /** */
    _onHotkeyActionPlayAudio() {
        this.playAudio(this._display.selectedIndex, 0);
    }

    /**
     * @param {unknown} source
     */
    _onHotkeyActionPlayAudioFromSource(source) {
        if (!(typeof source === 'string' || typeof source === 'undefined' || source === null)) { return; }
        this.playAudio(this._display.selectedIndex, 0, source);
    }

    /** @type {import('display').DirectApiHandler<'displayAudioClearAutoPlayTimer'>} */
    _onMessageClearAutoPlayTimer() {
        this.clearAutoPlayTimer();
    }

    /**
     * @param {import('settings').AudioSourceType} type
     * @param {string} url
     * @param {string} voice
     * @param {boolean} isInOptions
     * @param {Map<string, import('display-audio').AudioSource[]>} nameMap
     */
    _addAudioSourceInfo(type, url, voice, isInOptions, nameMap) {
        const index = this._audioSources.length;
        const downloadable = this._sourceIsDownloadable(type);
        let name = this._audioSourceTypeNames.get(type);
        if (typeof name === 'undefined') { name = 'Unknown'; }

        let entries = nameMap.get(name);
        if (typeof entries === 'undefined') {
            entries = [];
            nameMap.set(name, entries);
        }
        const nameIndex = entries.length;
        if (nameIndex === 1) {
            entries[0].nameUnique = false;
        }

        /** @type {import('display-audio').AudioSource} */
        const source = {
            index,
            type,
            url,
            voice,
            isInOptions,
            downloadable,
            name,
            nameIndex,
            nameUnique: (nameIndex === 0)
        };

        entries.push(source);
        this._audioSources.push(source);
    }

    /**
     * @param {MouseEvent} e
     */
    _onAudioPlayButtonClick(e) {
        e.preventDefault();

        const button = /** @type {HTMLButtonElement} */ (e.currentTarget);
        const headwordIndex = this._getAudioPlayButtonHeadwordIndex(button);
        const dictionaryEntryIndex = this._display.getElementDictionaryEntryIndex(button);

        if (e.shiftKey) {
            this._showAudioMenu(button, dictionaryEntryIndex, headwordIndex);
        } else {
            this.playAudio(dictionaryEntryIndex, headwordIndex);
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onAudioPlayButtonContextMenu(e) {
        e.preventDefault();

        const button = /** @type {HTMLButtonElement} */ (e.currentTarget);
        const headwordIndex = this._getAudioPlayButtonHeadwordIndex(button);
        const dictionaryEntryIndex = this._display.getElementDictionaryEntryIndex(button);

        this._showAudioMenu(button, dictionaryEntryIndex, headwordIndex);
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onAudioPlayMenuCloseClick(e) {
        const button = /** @type {Element} */ (e.currentTarget);
        const headwordIndex = this._getAudioPlayButtonHeadwordIndex(button);
        const dictionaryEntryIndex = this._display.getElementDictionaryEntryIndex(button);

        const {detail: {action, item, menu, shiftKey}} = e;
        switch (action) {
            case 'playAudioFromSource':
                if (shiftKey) {
                    e.preventDefault();
                }
                this._playAudioFromSource(dictionaryEntryIndex, headwordIndex, item);
                break;
            case 'setPrimaryAudio':
                e.preventDefault();
                this._setPrimaryAudio(dictionaryEntryIndex, headwordIndex, item, menu, true);
                break;
        }
    }

    /**
     * @param {string} term
     * @param {string} reading
     * @param {boolean} create
     * @returns {import('display-audio').CacheItem|undefined}
     */
    _getCacheItem(term, reading, create) {
        const key = this._getTermReadingKey(term, reading);
        let cacheEntry = this._cache.get(key);
        if (typeof cacheEntry === 'undefined' && create) {
            cacheEntry = {
                sourceMap: new Map(),
                primaryCardAudio: null
            };
            this._cache.set(key, cacheEntry);
        }
        return cacheEntry;
    }

    /**
     * @param {Element} item
     * @returns {import('display-audio').SourceInfo}
     */
    _getMenuItemSourceInfo(item) {
        const group = /** @type {?HTMLElement} */ (item.closest('.popup-menu-item-group'));
        if (group !== null) {
            const {index, subIndex} = group.dataset;
            if (typeof index === 'string') {
                const indexNumber = Number.parseInt(index, 10);
                if (indexNumber >= 0 && indexNumber < this._audioSources.length) {
                    return {
                        source: this._audioSources[indexNumber],
                        subIndex: typeof subIndex === 'string' ? Number.parseInt(subIndex, 10) : null
                    };
                }
            }
        }
        return {source: null, subIndex: null};
    }

    /**
     * @param {number} dictionaryEntryIndex
     * @param {number} headwordIndex
     * @param {import('display-audio').AudioSource[]} sources
     * @param {?number} audioInfoListIndex
     * @returns {Promise<import('display-audio').PlayAudioResult>}
     */
    async _playAudio(dictionaryEntryIndex, headwordIndex, sources, audioInfoListIndex) {
        this.stopAudio();
        this.clearAutoPlayTimer();

        const headword = this._getHeadword(dictionaryEntryIndex, headwordIndex);
        if (headword === null) {
            return {audio: null, source: null, subIndex: 0, valid: false};
        }

        const buttons = this._getAudioPlayButtons(dictionaryEntryIndex, headwordIndex);

        const {term, reading} = headword;

        const progressIndicatorVisible = this._display.progressIndicatorVisible;
        const overrideToken = progressIndicatorVisible.setOverride(true);
        try {
            // Create audio
            let audio;
            let title;
            let source = null;
            let subIndex = 0;
            const info = await this._createTermAudio(term, reading, sources, audioInfoListIndex);
            const valid = (info !== null);
            if (valid) {
                ({audio, source, subIndex} = info);
                const sourceIndex = sources.indexOf(source);
                title = `From source ${1 + sourceIndex}: ${source.name}`;
            } else {
                audio = this._audioSystem.getFallbackAudio();
                title = 'Could not find audio';
            }

            // Stop any currently playing audio
            this.stopAudio();

            // Update details
            const potentialAvailableAudioCount = this._getPotentialAvailableAudioCount(term, reading);
            for (const button of buttons) {
                const titleDefault = button.dataset.titleDefault || '';
                button.title = `${titleDefault}\n${title}`;
                this._updateAudioPlayButtonBadge(button, potentialAvailableAudioCount);
            }

            // Play
            audio.currentTime = 0;
            audio.volume = this._playbackVolume;

            const playPromise = audio.play();
            this._audioPlaying = audio;

            if (typeof playPromise !== 'undefined') {
                try {
                    await playPromise;
                } catch (e) {
                    // NOP
                }
            }

            return {audio, source, subIndex, valid};
        } finally {
            progressIndicatorVisible.clearOverride(overrideToken);
        }
    }

    /**
     * @param {number} dictionaryEntryIndex
     * @param {number} headwordIndex
     * @param {?HTMLElement} item
     */
    async _playAudioFromSource(dictionaryEntryIndex, headwordIndex, item) {
        if (item === null) { return; }
        const {source, subIndex} = this._getMenuItemSourceInfo(item);
        if (source === null) { return; }

        try {
            const token = this._entriesToken;
            const {valid} = await this._playAudio(dictionaryEntryIndex, headwordIndex, [source], subIndex);
            if (valid && token === this._entriesToken) {
                this._setPrimaryAudio(dictionaryEntryIndex, headwordIndex, item, null, false);
            }
        } catch (e) {
            // NOP
        }
    }

    /**
     * @param {number} dictionaryEntryIndex
     * @param {number} headwordIndex
     * @param {?HTMLElement} item
     * @param {?PopupMenu} menu
     * @param {boolean} canToggleOff
     */
    _setPrimaryAudio(dictionaryEntryIndex, headwordIndex, item, menu, canToggleOff) {
        if (item === null) { return; }
        const {source, subIndex} = this._getMenuItemSourceInfo(item);
        if (source === null || !source.downloadable) { return; }

        const headword = this._getHeadword(dictionaryEntryIndex, headwordIndex);
        if (headword === null) { return; }

        const {index} = source;
        const {term, reading} = headword;
        const cacheEntry = this._getCacheItem(term, reading, true);
        if (typeof cacheEntry === 'undefined') { return; }

        let {primaryCardAudio} = cacheEntry;
        primaryCardAudio = (
            !canToggleOff ||
            primaryCardAudio === null ||
            primaryCardAudio.index !== index ||
            primaryCardAudio.subIndex !== subIndex
        ) ? {index: index, subIndex} : null;
        cacheEntry.primaryCardAudio = primaryCardAudio;

        if (menu !== null) {
            this._updateMenuPrimaryCardAudio(menu.bodyNode, term, reading);
        }
    }

    /**
     * @param {Element} button
     * @returns {number}
     */
    _getAudioPlayButtonHeadwordIndex(button) {
        const headwordNode = /** @type {?HTMLElement} */ (button.closest('.headword'));
        if (headwordNode !== null) {
            const {index} = headwordNode.dataset;
            if (typeof index === 'string') {
                const headwordIndex = parseInt(index, 10);
                if (Number.isFinite(headwordIndex)) { return headwordIndex; }
            }
        }
        return 0;
    }

    /**
     * @param {number} dictionaryEntryIndex
     * @param {number} headwordIndex
     * @returns {HTMLButtonElement[]}
     */
    _getAudioPlayButtons(dictionaryEntryIndex, headwordIndex) {
        const results = [];
        const {dictionaryEntryNodes} = this._display;
        if (dictionaryEntryIndex >= 0 && dictionaryEntryIndex < dictionaryEntryNodes.length) {
            const node = dictionaryEntryNodes[dictionaryEntryIndex];
            const button1 = /** @type {?HTMLButtonElement} */ ((headwordIndex === 0 ? node.querySelector('.action-button[data-action=play-audio]') : null));
            const button2 = /** @type {?HTMLButtonElement} */ (node.querySelector(`.headword:nth-of-type(${headwordIndex + 1}) .action-button[data-action=play-audio]`));
            if (button1 !== null) { results.push(button1); }
            if (button2 !== null) { results.push(button2); }
        }
        return results;
    }

    /**
     * @param {string} term
     * @param {string} reading
     * @param {import('display-audio').AudioSource[]} sources
     * @param {?number} audioInfoListIndex
     * @returns {Promise<?import('display-audio').TermAudio>}
     */
    async _createTermAudio(term, reading, sources, audioInfoListIndex) {
        const cacheItem = this._getCacheItem(term, reading, true);
        if (typeof cacheItem === 'undefined') { return null; }
        const {sourceMap} = cacheItem;

        for (const source of sources) {
            const {index} = source;

            let cacheUpdated = false;
            let sourceInfo = sourceMap.get(index);
            if (typeof sourceInfo === 'undefined') {
                const infoListPromise = this._getTermAudioInfoList(source, term, reading);
                sourceInfo = {infoListPromise, infoList: null};
                sourceMap.set(index, sourceInfo);
                cacheUpdated = true;
            }

            let {infoList} = sourceInfo;
            if (infoList === null) {
                infoList = await sourceInfo.infoListPromise;
                sourceInfo.infoList = infoList;
            }

            const {audio, index: subIndex, cacheUpdated: cacheUpdated2} = await this._createAudioFromInfoList(source, infoList, audioInfoListIndex);
            if (cacheUpdated || cacheUpdated2) { this._updateOpenMenu(); }
            if (audio !== null) {
                return {audio, source, subIndex};
            }
        }

        return null;
    }

    /**
     * @param {import('display-audio').AudioSource} source
     * @param {import('display-audio').AudioInfoList} infoList
     * @param {?number} audioInfoListIndex
     * @returns {Promise<import('display-audio').CreateAudioResult>}
     */
    async _createAudioFromInfoList(source, infoList, audioInfoListIndex) {
        let start = 0;
        let end = infoList.length;
        if (audioInfoListIndex !== null) {
            start = Math.max(0, Math.min(end, audioInfoListIndex));
            end = Math.max(0, Math.min(end, audioInfoListIndex + 1));
        }

        /** @type {import('display-audio').CreateAudioResult} */
        const result = {
            audio: null,
            index: -1,
            cacheUpdated: false
        };
        for (let i = start; i < end; ++i) {
            const item = infoList[i];

            let {audio, audioResolved} = item;

            if (!audioResolved) {
                let {audioPromise} = item;
                if (audioPromise === null) {
                    audioPromise = this._createAudioFromInfo(item.info, source);
                    item.audioPromise = audioPromise;
                }

                result.cacheUpdated = true;

                try {
                    audio = await audioPromise;
                } catch (e) {
                    continue;
                } finally {
                    item.audioResolved = true;
                }

                item.audio = audio;
            }

            if (audio !== null) {
                result.audio = audio;
                result.index = i;
                break;
            }
        }
        return result;
    }

    /**
     * @param {import('audio-downloader').Info} info
     * @param {import('display-audio').AudioSource} source
     * @returns {Promise<import('display-audio').GenericAudio>}
     */
    async _createAudioFromInfo(info, source) {
        switch (info.type) {
            case 'url':
                return await this._audioSystem.createAudio(info.url, source.type);
            case 'tts':
                return this._audioSystem.createTextToSpeechAudio(info.text, info.voice);
            default:
                throw new Error(`Unsupported type: ${/** @type {import('core').SafeAny} */ (info).type}`);
        }
    }

    /**
     * @param {import('display-audio').AudioSource} source
     * @param {string} term
     * @param {string} reading
     * @returns {Promise<import('display-audio').AudioInfoList>}
     */
    async _getTermAudioInfoList(source, term, reading) {
        const sourceData = this._getSourceData(source);
        const infoList = await yomitan.api.getTermAudioInfoList(sourceData, term, reading);
        return infoList.map((info) => ({info, audioPromise: null, audioResolved: false, audio: null}));
    }

    /**
     * @param {number} dictionaryEntryIndex
     * @param {number} headwordIndex
     * @returns {?import('dictionary').TermHeadword}
     */
    _getHeadword(dictionaryEntryIndex, headwordIndex) {
        const {dictionaryEntries} = this._display;
        if (dictionaryEntryIndex < 0 || dictionaryEntryIndex >= dictionaryEntries.length) { return null; }

        const dictionaryEntry = dictionaryEntries[dictionaryEntryIndex];
        if (dictionaryEntry.type === 'kanji') { return null; }

        const {headwords} = dictionaryEntry;
        if (headwordIndex < 0 || headwordIndex >= headwords.length) { return null; }

        return headwords[headwordIndex];
    }

    /**
     * @param {string} term
     * @param {string} reading
     * @returns {string}
     */
    _getTermReadingKey(term, reading) {
        return JSON.stringify([term, reading]);
    }

    /**
     * @param {HTMLButtonElement} button
     * @param {?number} potentialAvailableAudioCount
     */
    _updateAudioPlayButtonBadge(button, potentialAvailableAudioCount) {
        if (potentialAvailableAudioCount === null) {
            delete button.dataset.potentialAvailableAudioCount;
        } else {
            button.dataset.potentialAvailableAudioCount = `${potentialAvailableAudioCount}`;
        }

        /** @type {?HTMLElement} */
        const badge = button.querySelector('.action-button-badge');
        if (badge === null) { return; }

        const badgeData = badge.dataset;
        switch (potentialAvailableAudioCount) {
            case 0:
                badgeData.icon = 'cross';
                badge.hidden = false;
                break;
            case 1:
            case null:
                delete badgeData.icon;
                badge.hidden = true;
                break;
            default:
                badgeData.icon = 'plus-thick';
                badge.hidden = false;
                break;
        }
    }

    /**
     * @param {string} term
     * @param {string} reading
     * @returns {?number}
     */
    _getPotentialAvailableAudioCount(term, reading) {
        const cacheEntry = this._getCacheItem(term, reading, false);
        if (typeof cacheEntry === 'undefined') { return null; }

        const {sourceMap} = cacheEntry;
        let count = 0;
        for (const {infoList} of sourceMap.values()) {
            if (infoList === null) { continue; }
            for (const {audio, audioResolved} of infoList) {
                if (!audioResolved || audio !== null) {
                    ++count;
                }
            }
        }
        return count;
    }

    /**
     * @param {HTMLButtonElement} button
     * @param {number} dictionaryEntryIndex
     * @param {number} headwordIndex
     */
    _showAudioMenu(button, dictionaryEntryIndex, headwordIndex) {
        const headword = this._getHeadword(dictionaryEntryIndex, headwordIndex);
        if (headword === null) { return; }

        const {term, reading} = headword;
        const popupMenu = this._createMenu(button, term, reading);
        this._openMenus.add(popupMenu);
        popupMenu.prepare();
        popupMenu.on('close', this._onPopupMenuClose.bind(this));
    }

    /**
     * @param {import('popup-menu').EventArgument<'close'>} details
     */
    _onPopupMenuClose({menu}) {
        this._openMenus.delete(menu);
    }

    /**
     * @param {import('settings').AudioSourceType} source
     * @returns {boolean}
     */
    _sourceIsDownloadable(source) {
        switch (source) {
            case 'text-to-speech':
            case 'text-to-speech-reading':
                return false;
            default:
                return true;
        }
    }

    /**
     * @param {HTMLButtonElement} sourceButton
     * @param {string} term
     * @param {string} reading
     * @returns {PopupMenu}
     */
    _createMenu(sourceButton, term, reading) {
        // Create menu
        const menuContainerNode = /** @type {HTMLElement} */ (this._display.displayGenerator.instantiateTemplate('audio-button-popup-menu'));
        /** @type {HTMLElement} */
        const menuBodyNode = querySelectorNotNull(menuContainerNode, '.popup-menu-body');
        menuContainerNode.dataset.term = term;
        menuContainerNode.dataset.reading = reading;

        // Set up items based on options and cache data
        this._createMenuItems(menuContainerNode, menuBodyNode, term, reading);

        // Update primary card audio display
        this._updateMenuPrimaryCardAudio(menuBodyNode, term, reading);

        // Create popup menu
        this._menuContainer.appendChild(menuContainerNode);
        return new PopupMenu(sourceButton, menuContainerNode);
    }

    /**
     * @param {HTMLElement} menuContainerNode
     * @param {HTMLElement} menuItemContainer
     * @param {string} term
     * @param {string} reading
     */
    _createMenuItems(menuContainerNode, menuItemContainer, term, reading) {
        const {displayGenerator} = this._display;
        let showIcons = false;
        const currentItems = [...menuItemContainer.children];
        for (const source of this._audioSources) {
            const {index, name, nameIndex, nameUnique, isInOptions, downloadable} = source;
            const entries = this._getMenuItemEntries(source, term, reading);
            for (let i = 0, ii = entries.length; i < ii; ++i) {
                const {valid, index: subIndex, name: subName} = entries[i];
                const existingNode = this._getOrCreateMenuItem(currentItems, index, subIndex);
                const node = existingNode !== null ? existingNode : /** @type {HTMLElement} */ (displayGenerator.instantiateTemplate('audio-button-popup-menu-item'));

                /** @type {HTMLElement} */
                const labelNode = querySelectorNotNull(node, '.popup-menu-item-audio-button .popup-menu-item-label');
                let label = name;
                if (!nameUnique) {
                    label = `${label} ${nameIndex + 1}`;
                    if (ii > 1) { label = `${label} -`; }
                }
                if (ii > 1) { label = `${label} ${i + 1}`; }
                if (typeof subName === 'string' && subName.length > 0) { label += `: ${subName}`; }
                labelNode.textContent = label;

                /** @type {HTMLElement} */
                const cardButton = querySelectorNotNull(node, '.popup-menu-item-set-primary-audio-button');
                cardButton.hidden = !downloadable;

                if (valid !== null) {
                    /** @type {HTMLElement} */
                    const icon = querySelectorNotNull(node, '.popup-menu-item-audio-button .popup-menu-item-icon');
                    icon.dataset.icon = valid ? 'checkmark' : 'cross';
                    showIcons = true;
                }
                node.dataset.index = `${index}`;
                if (subIndex !== null) {
                    node.dataset.subIndex = `${subIndex}`;
                }
                node.dataset.valid = `${valid}`;
                node.dataset.sourceInOptions = `${isInOptions}`;
                node.dataset.downloadable = `${downloadable}`;

                menuItemContainer.appendChild(node);
            }
        }
        for (const node of currentItems) {
            const {parentNode} = node;
            if (parentNode === null) { continue; }
            parentNode.removeChild(node);
        }
        menuContainerNode.dataset.showIcons = `${showIcons}`;
    }

    /**
     * @param {Element[]} currentItems
     * @param {number} index
     * @param {?number} subIndex
     * @returns {?HTMLElement}
     */
    _getOrCreateMenuItem(currentItems, index, subIndex) {
        const indexNumber = `${index}`;
        const subIndexNumber = `${subIndex !== null ? subIndex : 0}`;
        for (let i = 0, ii = currentItems.length; i < ii; ++i) {
            const node = currentItems[i];
            if (!(node instanceof HTMLElement) || indexNumber !== node.dataset.index) { continue; }

            let subIndex2 = node.dataset.subIndex;
            if (typeof subIndex2 === 'undefined') { subIndex2 = '0'; }
            if (subIndexNumber !== subIndex2) { continue; }

            currentItems.splice(i, 1);
            return node;
        }
        return null;
    }

    /**
     * @param {import('display-audio').AudioSource} source
     * @param {string} term
     * @param {string} reading
     * @returns {import('display-audio').MenuItemEntry[]}
     */
    _getMenuItemEntries(source, term, reading) {
        const cacheEntry = this._getCacheItem(term, reading, false);
        if (typeof cacheEntry !== 'undefined') {
            const {sourceMap} = cacheEntry;
            const sourceInfo = sourceMap.get(source.index);
            if (typeof sourceInfo !== 'undefined') {
                const {infoList} = sourceInfo;
                if (infoList !== null) {
                    const ii = infoList.length;
                    if (ii === 0) {
                        return [{valid: false, index: null, name: null}];
                    }

                    /** @type {import('display-audio').MenuItemEntry[]} */
                    const results = [];
                    for (let i = 0; i < ii; ++i) {
                        const {audio, audioResolved, info: {name}} = infoList[i];
                        const valid = audioResolved ? (audio !== null) : null;
                        const entry = {valid, index: i, name: typeof name === 'string' ? name : null};
                        results.push(entry);
                    }
                    return results;
                }
            }
        }
        return [{valid: null, index: null, name: null}];
    }

    /**
     * @param {string} term
     * @param {string} reading
     * @returns {?import('display-audio').PrimaryCardAudio}
     */
    _getPrimaryCardAudio(term, reading) {
        const cacheEntry = this._getCacheItem(term, reading, false);
        return typeof cacheEntry !== 'undefined' ? cacheEntry.primaryCardAudio : null;
    }

    /**
     * @param {HTMLElement} menuBodyNode
     * @param {string} term
     * @param {string} reading
     */
    _updateMenuPrimaryCardAudio(menuBodyNode, term, reading) {
        const primaryCardAudio = this._getPrimaryCardAudio(term, reading);
        const primaryCardAudioIndex = (primaryCardAudio !== null ? primaryCardAudio.index : null);
        const primaryCardAudioSubIndex = (primaryCardAudio !== null ? primaryCardAudio.subIndex : null);
        const itemGroups = /** @type {NodeListOf<HTMLElement>} */ (menuBodyNode.querySelectorAll('.popup-menu-item-group'));
        for (const node of itemGroups) {
            const {index, subIndex} = node.dataset;
            if (typeof index !== 'string') { continue; }
            const indexNumber = Number.parseInt(index, 10);
            const subIndexNumber = typeof subIndex === 'string' ? Number.parseInt(subIndex, 10) : null;
            const isPrimaryCardAudio = (indexNumber === primaryCardAudioIndex && subIndexNumber === primaryCardAudioSubIndex);
            node.dataset.isPrimaryCardAudio = `${isPrimaryCardAudio}`;
        }
    }

    /** */
    _updateOpenMenu() {
        for (const menu of this._openMenus) {
            const menuContainerNode = menu.containerNode;
            const {term, reading} = menuContainerNode.dataset;
            if (typeof term === 'string' && typeof reading === 'string') {
                this._createMenuItems(menuContainerNode, menu.bodyNode, term, reading);
            }
            menu.updatePosition();
        }
    }

    /**
     * @param {import('display-audio').AudioSource} source
     * @returns {import('display-audio').AudioSourceShort}
     */
    _getSourceData(source) {
        const {type, url, voice} = source;
        return {type, url, voice};
    }
}
