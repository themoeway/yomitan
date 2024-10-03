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

import {EventDispatcher} from '../../core/event-dispatcher.js';
import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {fetchJson} from '../../core/fetch-utilities.js';
import {isObjectNotArray} from '../../core/object-utilities.js';
import {generateId} from '../../core/utilities.js';
import {OptionsUtil} from '../../data/options-util.js';
import {getAllPermissions} from '../../data/permissions-util.js';
import {HtmlTemplateCollection} from '../../dom/html-template-collection.js';

/**
 * @augments EventDispatcher<import('settings-controller').Events>
 */
export class SettingsController extends EventDispatcher {
    /**
     * @param {import('../../application.js').Application} application
     */
    constructor(application) {
        super();
        /** @type {import('../../application.js').Application} */
        this._application = application;
        /** @type {number} */
        this._profileIndex = 0;
        /** @type {string} */
        this._source = generateId(16);
        /** @type {Set<import('settings-controller').PageExitPrevention>} */
        this._pageExitPreventions = new Set();
        /** @type {EventListenerCollection} */
        this._pageExitPreventionEventListeners = new EventListenerCollection();
        /** @type {HtmlTemplateCollection} */
        this._templates = new HtmlTemplateCollection();
        /** @type {import('settings-controller').RecommendedSettingsByLanguage} */
        this._recommendedSettingsByLanguage = {};
    }

    /** @type {import('../../application.js').Application} */
    get application() {
        return this._application;
    }

    /** @type {string} */
    get source() {
        return this._source;
    }

    /** @type {number} */
    get profileIndex() {
        return this._profileIndex;
    }

    set profileIndex(value) {
        if (this._profileIndex === value) { return; }
        this._setProfileIndex(value, true);
    }

    /** @type {HtmlTemplateCollection} */
    get templates() {
        return this._templates;
    }

    /** */
    async prepare() {
        await this._templates.loadFromFiles(['/templates-settings.html']);
        this._recommendedSettingsByLanguage = await fetchJson('/data/recommended-settings.json');
        this._application.on('optionsUpdated', this._onOptionsUpdated.bind(this));
        if (this._canObservePermissionsChanges()) {
            chrome.permissions.onAdded.addListener(this._onPermissionsChanged.bind(this));
            chrome.permissions.onRemoved.addListener(this._onPermissionsChanged.bind(this));
        }
        const optionsFull = await this.getOptionsFull();
        const {profiles, profileCurrent} = optionsFull;
        if (profileCurrent >= 0 && profileCurrent < profiles.length) {
            this._profileIndex = profileCurrent;
        }
    }

    /** */
    async refresh() {
        await this._onOptionsUpdatedInternal(true);
    }

    /**
     * @returns {Promise<import('settings').ProfileOptions>}
     */
    async getOptions() {
        const optionsContext = this.getOptionsContext();
        return await this._application.api.optionsGet(optionsContext);
    }

    /**
     * @returns {Promise<import('settings').Options>}
     */
    async getOptionsFull() {
        return await this._application.api.optionsGetFull();
    }

    /**
     * @param {import('settings').Options} value
     */
    async setAllSettings(value) {
        const profileIndex = value.profileCurrent;
        await this._application.api.setAllSettings(value, this._source);
        this._setProfileIndex(profileIndex, true);
    }

    /**
     * @param {import('settings-modifications').ScopedRead[]} targets
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async getSettings(targets) {
        return await this._getSettings(targets, null);
    }

    /**
     * @param {import('settings-modifications').Read[]} targets
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async getGlobalSettings(targets) {
        return await this._getSettings(targets, {scope: 'global', optionsContext: null});
    }

    /**
     * @param {import('settings-modifications').Read[]} targets
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async getProfileSettings(targets) {
        return await this._getSettings(targets, {scope: 'profile', optionsContext: null});
    }

    /**
     * @param {import('settings-modifications').ScopedModification[]} targets
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async modifySettings(targets) {
        return await this._modifySettings(targets, null);
    }

    /**
     * @param {import('settings-modifications').Modification[]} targets
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async modifyGlobalSettings(targets) {
        return await this._modifySettings(targets, {scope: 'global', optionsContext: null});
    }

    /**
     * @param {import('settings-modifications').Modification[]} targets
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async modifyProfileSettings(targets) {
        return await this._modifySettings(targets, {scope: 'profile', optionsContext: null});
    }

    /**
     * @param {string} path
     * @param {unknown} value
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async setGlobalSetting(path, value) {
        return await this.modifyGlobalSettings([{action: 'set', path, value}]);
    }

    /**
     * @param {string} path
     * @param {unknown} value
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async setProfileSetting(path, value) {
        return await this.modifyProfileSettings([{action: 'set', path, value}]);
    }

    /**
     * @param {string} language
     */
    async applyLanguageSettingOverrides(language) {
        /** @type {import('settings-controller').RecommendedSetting[]} */
        const settingOverrides = this._recommendedSettingsByLanguage[language];
        if (typeof settingOverrides === 'undefined') { return; }
        /** @type {import('settings-modifications').Modification[]} */
        const modifications = settingOverrides.map(({path, value}) => ({action: 'set', path, value}));
        await this.modifyProfileSettings(modifications);
        await this._onOptionsUpdatedInternal(true);
    }

    /**
     * @param {string} language
     * @returns {import('settings-controller').RecommendedSetting[]}
     */
    getRecommendedSettings(language) {
        return this._recommendedSettingsByLanguage[language];
    }

    /**
     * @returns {Promise<import('dictionary-importer').Summary[]>}
     */
    async getDictionaryInfo() {
        return await this._application.api.getDictionaryInfo();
    }

    /**
     * @returns {import('settings').OptionsContext}
     */
    getOptionsContext() {
        return {index: this._profileIndex};
    }

    /**
     * @returns {import('settings-controller').PageExitPrevention}
     */
    preventPageExit() {
        /** @type {import('settings-controller').PageExitPrevention} */
        // eslint-disable-next-line sonarjs/prefer-object-literal
        const obj = {};
        obj.end = this._endPreventPageExit.bind(this, obj);
        if (this._pageExitPreventionEventListeners.size === 0) {
            this._pageExitPreventionEventListeners.addEventListener(window, 'beforeunload', this._onBeforeUnload.bind(this), false);
        }
        this._pageExitPreventions.add(obj);
        return obj;
    }

    /**
     * @param {string} name
     * @returns {Element}
     */
    instantiateTemplate(name) {
        return this._templates.instantiate(name);
    }

    /**
     * @param {string} name
     * @returns {DocumentFragment}
     */
    instantiateTemplateFragment(name) {
        return this._templates.instantiateFragment(name);
    }

    /**
     * @returns {Promise<import('settings').Options>}
     */
    async getDefaultOptions() {
        const optionsUtil = new OptionsUtil();
        await optionsUtil.prepare();
        return optionsUtil.getDefault();
    }

    // Private

    /**
     * @param {number} value
     * @param {boolean} canUpdateProfileIndex
     */
    _setProfileIndex(value, canUpdateProfileIndex) {
        this._profileIndex = value;
        this.trigger('optionsContextChanged', {});
        void this._onOptionsUpdatedInternal(canUpdateProfileIndex);
    }

    /**
     * @param {{source: string}} details
     */
    _onOptionsUpdated({source}) {
        if (source === this._source) { return; }
        void this._onOptionsUpdatedInternal(true);
    }

    /**
     * @param {boolean} canUpdateProfileIndex
     */
    async _onOptionsUpdatedInternal(canUpdateProfileIndex) {
        const optionsContext = this.getOptionsContext();
        try {
            const options = await this.getOptions();
            this.trigger('optionsChanged', {options, optionsContext});
        } catch (e) {
            if (canUpdateProfileIndex) {
                this._setProfileIndex(0, false);
                return;
            }
            throw e;
        }
    }

    /**
     * @param {import('settings-modifications').OptionsScope} target
     */
    _modifyOptionsScope(target) {
        if (target.scope === 'profile') {
            target.optionsContext = this.getOptionsContext();
        }
    }

    /**
     * @template {boolean} THasScope
     * @param {import('settings-controller').SettingsRead<THasScope>[]} targets
     * @param {import('settings-controller').SettingsExtraFields<THasScope>} extraFields
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async _getSettings(targets, extraFields) {
        const targets2 = targets.map((target) => {
            const target2 = /** @type {import('settings-controller').SettingsRead<true>} */ (Object.assign({}, extraFields, target));
            this._modifyOptionsScope(target2);
            return target2;
        });
        return await this._application.api.getSettings(targets2);
    }

    /**
     * @template {boolean} THasScope
     * @param {import('settings-controller').SettingsModification<THasScope>[]} targets
     * @param {import('settings-controller').SettingsExtraFields<THasScope>} extraFields
     * @returns {Promise<import('settings-controller').ModifyResult[]>}
     */
    async _modifySettings(targets, extraFields) {
        const targets2 = targets.map((target) => {
            const target2 = /** @type {import('settings-controller').SettingsModification<true>} */ (Object.assign({}, extraFields, target));
            this._modifyOptionsScope(target2);
            return target2;
        });
        return await this._application.api.modifySettings(targets2, this._source);
    }

    /**
     * @param {BeforeUnloadEvent} e
     * @returns {string|undefined}
     */
    _onBeforeUnload(e) {
        if (this._pageExitPreventions.size === 0) {
            return;
        }

        e.preventDefault();
        e.returnValue = '';
        return '';
    }

    /**
     * @param {import('settings-controller').PageExitPrevention} obj
     */
    _endPreventPageExit(obj) {
        this._pageExitPreventions.delete(obj);
        if (this._pageExitPreventions.size === 0) {
            this._pageExitPreventionEventListeners.removeAllEventListeners();
        }
    }

    /** */
    _onPermissionsChanged() {
        void this._triggerPermissionsChanged();
    }

    /** */
    async _triggerPermissionsChanged() {
        const eventName = 'permissionsChanged';
        if (!this.hasListeners(eventName)) { return; }

        const permissions = await getAllPermissions();
        this.trigger(eventName, {permissions});
    }

    /**
     * @returns {boolean}
     */
    _canObservePermissionsChanges() {
        return isObjectNotArray(chrome.permissions) && isObjectNotArray(chrome.permissions.onAdded) && isObjectNotArray(chrome.permissions.onRemoved);
    }
}
