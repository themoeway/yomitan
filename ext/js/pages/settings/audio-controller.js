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

import {EventDispatcher} from '../../core/event-dispatcher.js';
import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {AudioSystem} from '../../media/audio-system.js';

/**
 * @augments EventDispatcher<import('audio-controller').Events>
 */
export class AudioController extends EventDispatcher {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     * @param {import('./modal-controller.js').ModalController} modalController
     */
    constructor(settingsController, modalController) {
        super();
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {import('./modal-controller.js').ModalController} */
        this._modalController = modalController;
        /** @type {AudioSystem} */
        this._audioSystem = new AudioSystem();
        /** @type {HTMLElement} */
        this._audioSourceContainer = querySelectorNotNull(document, '#audio-source-list');
        /** @type {HTMLButtonElement} */
        this._audioSourceAddButton = querySelectorNotNull(document, '#audio-source-add');
        /** @type {AudioSourceEntry[]} */
        this._audioSourceEntries = [];
        /** @type {HTMLInputElement} */
        this._voiceTestTextInput = querySelectorNotNull(document, '#text-to-speech-voice-test-text');
        /** @type {import('audio-controller').VoiceInfo[]} */
        this._voices = [];
    }

    /** @type {import('./settings-controller.js').SettingsController} */
    get settingsController() {
        return this._settingsController;
    }

    /** @type {import('./modal-controller.js').ModalController} */
    get modalController() {
        return this._modalController;
    }

    /** */
    async prepare() {
        this._audioSystem.prepare();

        this._audioSourceContainer.textContent = '';
        /** @type {HTMLButtonElement} */
        const testButton = querySelectorNotNull(document, '#text-to-speech-voice-test');

        this._audioSourceAddButton.addEventListener('click', this._onAddAudioSource.bind(this), false);

        this._audioSystem.on('voiceschanged', this._updateTextToSpeechVoices.bind(this));
        this._updateTextToSpeechVoices();

        testButton.addEventListener('click', this._onTestTextToSpeech.bind(this), false);

        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));

        const options = await this._settingsController.getOptions();
        const optionsContext = this._settingsController.getOptionsContext();
        this._onOptionsChanged({options, optionsContext});
    }

    /**
     * @param {AudioSourceEntry} entry
     */
    async removeSource(entry) {
        const {index} = entry;
        this._audioSourceEntries.splice(index, 1);
        entry.cleanup();
        for (let i = index, ii = this._audioSourceEntries.length; i < ii; ++i) {
            this._audioSourceEntries[i].index = i;
        }

        await this._settingsController.modifyProfileSettings([{
            action: 'splice',
            path: 'audio.sources',
            start: index,
            deleteCount: 1,
            items: []
        }]);
    }

    /**
     * @returns {import('audio-controller').VoiceInfo[]}
     */
    getVoices() {
        return this._voices;
    }

    /**
     * @param {string} voice
     */
    setTestVoice(voice) {
        /** @type {HTMLInputElement} */ (this._voiceTestTextInput).dataset.voice = voice;
    }

    // Private

    /**
     * @param {import('settings-controller').EventArgument<'optionsChanged'>} details
     */
    _onOptionsChanged({options}) {
        for (const entry of this._audioSourceEntries) {
            entry.cleanup();
        }
        this._audioSourceEntries = [];

        const {sources} = options.audio;
        for (let i = 0, ii = sources.length; i < ii; ++i) {
            this._createAudioSourceEntry(i, sources[i]);
        }
    }

    /** */
    _onAddAudioSource() {
        this._addAudioSource();
    }

    /** */
    _onTestTextToSpeech() {
        try {
            const input = /** @type {HTMLInputElement} */ (this._voiceTestTextInput);
            const text = input.value || '';
            const voiceUri = input.dataset.voice;
            const audio = this._audioSystem.createTextToSpeechAudio(text, typeof voiceUri === 'string' ? voiceUri : '');
            audio.volume = 1.0;
            audio.play();
        } catch (e) {
            // NOP
        }
    }

    /** */
    _updateTextToSpeechVoices() {
        const voices = (
            typeof speechSynthesis !== 'undefined' ?
            [...speechSynthesis.getVoices()].map((voice, index) => ({
                voice,
                isJapanese: this._languageTagIsJapanese(voice.lang),
                index
            })) :
            []
        );
        voices.sort(this._textToSpeechVoiceCompare.bind(this));
        this._voices = voices;
        this.trigger('voicesUpdated', {});
    }

    /**
     * @param {import('audio-controller').VoiceInfo} a
     * @param {import('audio-controller').VoiceInfo} b
     * @returns {number}
     */
    _textToSpeechVoiceCompare(a, b) {
        if (a.isJapanese) {
            if (!b.isJapanese) { return -1; }
        } else {
            if (b.isJapanese) { return 1; }
        }

        if (a.voice.default) {
            if (!b.voice.default) { return -1; }
        } else {
            if (b.voice.default) { return 1; }
        }

        return a.index - b.index;
    }

    /**
     * @param {string} languageTag
     * @returns {boolean}
     */
    _languageTagIsJapanese(languageTag) {
        return (
            languageTag.startsWith('ja_') ||
            languageTag.startsWith('ja-') ||
            languageTag.startsWith('jpn-')
        );
    }

    /**
     * @param {number} index
     * @param {import('settings').AudioSourceOptions} source
     */
    _createAudioSourceEntry(index, source) {
        const node = /** @type {HTMLElement} */ (this._settingsController.instantiateTemplate('audio-source'));
        const entry = new AudioSourceEntry(this, index, source, node);
        this._audioSourceEntries.push(entry);
        /** @type {HTMLElement} */ (this._audioSourceContainer).appendChild(node);
        entry.prepare();
    }

    /**
     * @returns {import('settings').AudioSourceType}
     */
    _getUnusedAudioSourceType() {
        /** @type {import('settings').AudioSourceType[]} */
        const typesAvailable = [
            'jpod101',
            'jpod101-alternate',
            'jisho',
            'custom'
        ];
        for (const type of typesAvailable) {
            if (!this._audioSourceEntries.some((entry) => entry.type === type)) {
                return type;
            }
        }
        return typesAvailable[0];
    }

    /** */
    async _addAudioSource() {
        const type = this._getUnusedAudioSourceType();
        /** @type {import('settings').AudioSourceOptions} */
        const source = {type, url: '', voice: ''};
        const index = this._audioSourceEntries.length;
        this._createAudioSourceEntry(index, source);
        await this._settingsController.modifyProfileSettings([{
            action: 'splice',
            path: 'audio.sources',
            start: index,
            deleteCount: 0,
            items: [source]
        }]);
    }
}

class AudioSourceEntry {
    /**
     * @param {AudioController} parent
     * @param {number} index
     * @param {import('settings').AudioSourceOptions} source
     * @param {HTMLElement} node
     */
    constructor(parent, index, source, node) {
        /** @type {AudioController} */
        this._parent = parent;
        /** @type {number} */
        this._index = index;
        /** @type {import('settings').AudioSourceType} */
        this._type = source.type;
        /** @type {string} */
        this._url = source.url;
        /** @type {string} */
        this._voice = source.voice;
        /** @type {HTMLElement} */
        this._node = node;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {HTMLSelectElement} */
        this._typeSelect = querySelectorNotNull(this._node, '.audio-source-type-select');
        /** @type {HTMLInputElement} */
        this._urlInput = querySelectorNotNull(this._node, '.audio-source-parameter-container[data-field=url] .audio-source-parameter');
        /** @type {HTMLSelectElement} */
        this._voiceSelect = querySelectorNotNull(this._node, '.audio-source-parameter-container[data-field=voice] .audio-source-parameter');
    }

    /** @type {number} */
    get index() {
        return this._index;
    }

    set index(value) {
        this._index = value;
    }

    /** @type {import('settings').AudioSourceType} */
    get type() {
        return this._type;
    }

    /** */
    prepare() {
        this._updateTypeParameter();

        /** @type {HTMLButtonElement} */
        const menuButton = querySelectorNotNull(this._node, '.audio-source-menu-button');

        this._typeSelect.value = this._type;
        this._urlInput.value = this._url;

        this._eventListeners.addEventListener(this._typeSelect, 'change', this._onTypeSelectChange.bind(this), false);
        this._eventListeners.addEventListener(this._urlInput, 'change', this._onUrlInputChange.bind(this), false);
        this._eventListeners.addEventListener(this._voiceSelect, 'change', this._onVoiceSelectChange.bind(this), false);
        this._eventListeners.addEventListener(menuButton, 'menuOpen', this._onMenuOpen.bind(this), false);
        this._eventListeners.addEventListener(menuButton, 'menuClose', this._onMenuClose.bind(this), false);
        this._eventListeners.on(this._parent, 'voicesUpdated', this._onVoicesUpdated.bind(this));
        this._onVoicesUpdated();
    }

    /** */
    cleanup() {
        if (this._node.parentNode !== null) {
            this._node.parentNode.removeChild(this._node);
        }
        this._eventListeners.removeAllEventListeners();
    }

    // Private

    /** */
    _onVoicesUpdated() {
        if (this._voiceSelect === null) { return; }
        const voices = this._parent.getVoices();

        const fragment = document.createDocumentFragment();

        let option = document.createElement('option');
        option.value = '';
        option.textContent = 'None';
        fragment.appendChild(option);

        for (const {voice} of voices) {
            option = document.createElement('option');
            option.value = voice.voiceURI;
            option.textContent = `${voice.name} (${voice.lang})`;
            fragment.appendChild(option);
        }

        this._voiceSelect.textContent = '';
        this._voiceSelect.appendChild(fragment);
        this._voiceSelect.value = this._voice;
    }

    /**
     * @param {Event} e
     */
    _onTypeSelectChange(e) {
        const element = /** @type {HTMLSelectElement} */ (e.currentTarget);
        const value = this._normalizeAudioSourceType(element.value);
        if (value === null) { return; }
        this._setType(value);
    }

    /**
     * @param {Event} e
     */
    _onUrlInputChange(e) {
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        this._setUrl(element.value);
    }

    /**
     * @param {Event} e
     */
    _onVoiceSelectChange(e) {
        const element = /** @type {HTMLSelectElement} */ (e.currentTarget);
        this._setVoice(element.value);
    }

    /**
     * @param {import('popup-menu').MenuOpenEvent} e
     */
    _onMenuOpen(e) {
        const {menu} = e.detail;

        let hasHelp = false;
        switch (this._type) {
            case 'custom':
            case 'custom-json':
            case 'text-to-speech':
            case 'text-to-speech-reading':
                hasHelp = true;
                break;
        }

        /** @type {?HTMLElement} */
        const helpNode = menu.bodyNode.querySelector('.popup-menu-item[data-menu-action=help]');
        if (helpNode !== null) {
            helpNode.hidden = !hasHelp;
        }
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onMenuClose(e) {
        switch (e.detail.action) {
            case 'help':
                this._showHelp(this._type);
                break;
            case 'remove':
                this._parent.removeSource(this);
                break;
        }
    }

    /**
     * @param {import('settings').AudioSourceType} value
     */
    async _setType(value) {
        this._type = value;
        this._updateTypeParameter();
        await this._parent.settingsController.setProfileSetting(`audio.sources[${this._index}].type`, value);
    }

    /**
     * @param {string} value
     */
    async _setUrl(value) {
        this._url = value;
        await this._parent.settingsController.setProfileSetting(`audio.sources[${this._index}].url`, value);
    }

    /**
     * @param {string} value
     */
    async _setVoice(value) {
        this._voice = value;
        await this._parent.settingsController.setProfileSetting(`audio.sources[${this._index}].voice`, value);
    }

    /** */
    _updateTypeParameter() {
        let field = null;
        switch (this._type) {
            case 'custom':
            case 'custom-json':
                field = 'url';
                break;
            case 'text-to-speech':
            case 'text-to-speech-reading':
                field = 'voice';
                break;
        }
        for (const node of /** @type {NodeListOf<HTMLElement>} */ (this._node.querySelectorAll('.audio-source-parameter-container'))) {
            node.hidden = (field === null || node.dataset.field !== field);
        }
    }

    /**
     * @param {import('settings').AudioSourceType} type
     */
    _showHelp(type) {
        switch (type) {
            case 'custom':
                this._showModal('audio-source-help-custom');
                break;
            case 'custom-json':
                this._showModal('audio-source-help-custom-json');
                break;
            case 'text-to-speech':
            case 'text-to-speech-reading':
                this._parent.setTestVoice(this._voice);
                this._showModal('audio-source-help-text-to-speech');
                break;
        }
    }

    /**
     * @param {string} name
     */
    _showModal(name) {
        const modal = this._parent.modalController.getModal(name);
        if (modal === null) { return; }
        modal.setVisible(true);
    }

    /**
     * @param {string} value
     * @returns {?import('settings').AudioSourceType}
     */
    _normalizeAudioSourceType(value) {
        switch (value) {
            case 'jpod101':
            case 'jpod101-alternate':
            case 'jisho':
            case 'text-to-speech':
            case 'text-to-speech-reading':
            case 'custom':
            case 'custom-json':
                return value;
            default:
                return null;
        }
    }
}
