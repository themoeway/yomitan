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

import {EventListenerCollection} from '../../core/event-listener-collection.js';
import {clone} from '../../core/utilities.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {yomitan} from '../../yomitan.js';
import {ProfileConditionsUI} from './profile-conditions-ui.js';

export class ProfileController {
    /**
     * @param {import('./settings-controller.js').SettingsController} settingsController
     * @param {import('./modal-controller.js').ModalController} modalController
     */
    constructor(settingsController, modalController) {
        /** @type {import('./settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {import('./modal-controller.js').ModalController} */
        this._modalController = modalController;
        /** @type {ProfileConditionsUI} */
        this._profileConditionsUI = new ProfileConditionsUI(settingsController);
        /** @type {?number} */
        this._profileConditionsIndex = null;
        /** @type {HTMLSelectElement} */
        this._profileActiveSelect = querySelectorNotNull(document, '#profile-active-select');
        /** @type {HTMLSelectElement} */
        this._profileTargetSelect = querySelectorNotNull(document, '#profile-target-select');
        /** @type {HTMLSelectElement} */
        this._profileCopySourceSelect = querySelectorNotNull(document, '#profile-copy-source-select');
        /** @type {HTMLElement} */
        this._removeProfileNameElement = querySelectorNotNull(document, '#profile-remove-name');
        /** @type {HTMLButtonElement} */
        this._profileAddButton = querySelectorNotNull(document, '#profile-add-button');
        /** @type {HTMLButtonElement} */
        this._profileRemoveConfirmButton = querySelectorNotNull(document, '#profile-remove-confirm-button');
        /** @type {HTMLButtonElement} */
        this._profileCopyConfirmButton = querySelectorNotNull(document, '#profile-copy-confirm-button');
        /** @type {HTMLElement} */
        this._profileEntryListContainer = querySelectorNotNull(document, '#profile-entry-list');
        /** @type {HTMLElement} */
        this._profileConditionsProfileName = querySelectorNotNull(document, '#profile-conditions-profile-name');
        /** @type {?import('./modal.js').Modal} */
        this._profileRemoveModal = null;
        /** @type {?import('./modal.js').Modal} */
        this._profileCopyModal = null;
        /** @type {?import('./modal.js').Modal} */
        this._profileConditionsModal = null;
        /** @type {boolean} */
        this._profileEntriesSupported = false;
        /** @type {ProfileEntry[]} */
        this._profileEntryList = [];
        /** @type {import('settings').Profile[]} */
        this._profiles = [];
        /** @type {number} */
        this._profileCurrent = 0;
    }

    /** @type {number} */
    get profileCount() {
        return this._profiles.length;
    }

    /** @type {number} */
    get profileCurrentIndex() {
        return this._profileCurrent;
    }

    /** */
    async prepare() {
        const {platform: {os}} = await yomitan.api.getEnvironmentInfo();
        this._profileConditionsUI.os = os;

        this._profileRemoveModal = this._modalController.getModal('profile-remove');
        this._profileCopyModal = this._modalController.getModal('profile-copy');
        this._profileConditionsModal = this._modalController.getModal('profile-conditions');

        this._profileEntriesSupported = (this._profileEntryListContainer !== null);

        if (this._profileActiveSelect !== null) { this._profileActiveSelect.addEventListener('change', this._onProfileActiveChange.bind(this), false); }
        if (this._profileTargetSelect !== null) { this._profileTargetSelect.addEventListener('change', this._onProfileTargetChange.bind(this), false); }
        if (this._profileAddButton !== null) { this._profileAddButton.addEventListener('click', this._onAdd.bind(this), false); }
        if (this._profileRemoveConfirmButton !== null) { this._profileRemoveConfirmButton.addEventListener('click', this._onDeleteConfirm.bind(this), false); }
        if (this._profileCopyConfirmButton !== null) { this._profileCopyConfirmButton.addEventListener('click', this._onCopyConfirm.bind(this), false); }

        this._profileConditionsUI.on('conditionGroupCountChanged', this._onConditionGroupCountChanged.bind(this));
        this._settingsController.on('optionsChanged', this._onOptionsChanged.bind(this));
        this._onOptionsChanged();
    }

    /**
     * @param {number} profileIndex
     * @param {number} offset
     */
    async moveProfile(profileIndex, offset) {
        if (this._getProfile(profileIndex) === null) { return; }

        const profileIndexNew = Math.max(0, Math.min(this._profiles.length - 1, profileIndex + offset));
        if (profileIndex === profileIndexNew) { return; }

        await this.swapProfiles(profileIndex, profileIndexNew);
    }

    /**
     * @param {number} profileIndex
     * @param {string} value
     */
    async setProfileName(profileIndex, value) {
        const profile = this._getProfile(profileIndex);
        if (profile === null) { return; }

        profile.name = value;
        this._updateSelectName(profileIndex, value);

        const profileEntry = this._getProfileEntry(profileIndex);
        if (profileEntry !== null) { profileEntry.setName(value); }

        await this._settingsController.setGlobalSetting(`profiles[${profileIndex}].name`, value);
    }

    /**
     * @param {number} profileIndex
     */
    async setDefaultProfile(profileIndex) {
        const profile = this._getProfile(profileIndex);
        if (profile === null) { return; }

        /** @type {HTMLSelectElement} */ (this._profileActiveSelect).value = `${profileIndex}`;
        this._profileCurrent = profileIndex;

        const profileEntry = this._getProfileEntry(profileIndex);
        if (profileEntry !== null) { profileEntry.setIsDefault(true); }

        await this._settingsController.setGlobalSetting('profileCurrent', profileIndex);
    }

    /**
     * @param {number} sourceProfileIndex
     * @param {number} destinationProfileIndex
     */
    async copyProfile(sourceProfileIndex, destinationProfileIndex) {
        const sourceProfile = this._getProfile(sourceProfileIndex);
        if (sourceProfile === null || !this._getProfile(destinationProfileIndex)) { return; }

        const options = clone(sourceProfile.options);
        this._profiles[destinationProfileIndex].options = options;

        this._updateProfileSelectOptions();

        const destinationProfileEntry = this._getProfileEntry(destinationProfileIndex);
        if (destinationProfileEntry !== null) {
            destinationProfileEntry.updateState();
        }

        await this._settingsController.modifyGlobalSettings([{
            action: 'set',
            path: `profiles[${destinationProfileIndex}].options`,
            value: options
        }]);

        await this._settingsController.refresh();
    }

    /**
     * @param {number} profileIndex
     */
    async duplicateProfile(profileIndex) {
        const profile = this._getProfile(profileIndex);
        if (profile === null) { return; }

        // Create new profile
        const newProfile = clone(profile);
        newProfile.name = this._createCopyName(profile.name, this._profiles, 100);

        // Update state
        const index = this._profiles.length;
        this._profiles.push(newProfile);
        if (this._profileEntriesSupported) {
            this._addProfileEntry(index);
        }
        this._updateProfileSelectOptions();

        // Modify settings
        await this._settingsController.modifyGlobalSettings([{
            action: 'splice',
            path: 'profiles',
            start: index,
            deleteCount: 0,
            items: [newProfile]
        }]);

        // Update profile index
        this._settingsController.profileIndex = index;
    }

    /**
     * @param {number} profileIndex
     */
    async deleteProfile(profileIndex) {
        const profile = this._getProfile(profileIndex);
        if (profile === null || this.profileCount <= 1) { return; }

        // Get indices
        let profileCurrentNew = this._profileCurrent;
        const settingsProfileIndex = this._settingsController.profileIndex;

        // Construct settings modifications
        /** @type {import('settings-modifications').Modification[]} */
        const modifications = [{
            action: 'splice',
            path: 'profiles',
            start: profileIndex,
            deleteCount: 1,
            items: []
        }];
        if (profileCurrentNew >= profileIndex) {
            profileCurrentNew = Math.min(profileCurrentNew - 1, this._profiles.length - 1);
            modifications.push({
                action: 'set',
                path: 'profileCurrent',
                value: profileCurrentNew
            });
        }

        // Update state
        this._profileCurrent = profileCurrentNew;

        this._profiles.splice(profileIndex, 1);

        if (profileIndex < this._profileEntryList.length) {
            const profileEntry = this._profileEntryList[profileIndex];
            profileEntry.cleanup();
            this._profileEntryList.splice(profileIndex, 1);

            for (let i = profileIndex, ii = this._profileEntryList.length; i < ii; ++i) {
                this._profileEntryList[i].index = i;
            }
        }

        const profileEntry2 = this._getProfileEntry(profileCurrentNew);
        if (profileEntry2 !== null) {
            profileEntry2.setIsDefault(true);
        }

        this._updateProfileSelectOptions();

        // Update profile index
        if (settingsProfileIndex === profileIndex) {
            this._settingsController.profileIndex = profileCurrentNew;
        }

        // Modify settings
        await this._settingsController.modifyGlobalSettings(modifications);
    }

    /**
     * @param {number} index1
     * @param {number} index2
     */
    async swapProfiles(index1, index2) {
        const profile1 = this._getProfile(index1);
        const profile2 = this._getProfile(index2);
        if (profile1 === null || profile2 === null || index1 === index2) { return; }

        // Get swapped indices
        const profileCurrent = this._profileCurrent;
        const profileCurrentNew = this._getSwappedValue(profileCurrent, index1, index2);

        const settingsProfileIndex = this._settingsController.profileIndex;
        const settingsProfileIndexNew = this._getSwappedValue(settingsProfileIndex, index1, index2);

        // Construct settings modifications
        /** @type {import('settings-modifications').Modification[]} */
        const modifications = [{
            action: 'swap',
            path1: `profiles[${index1}]`,
            path2: `profiles[${index2}]`
        }];
        if (profileCurrentNew !== profileCurrent) {
            modifications.push({
                action: 'set',
                path: 'profileCurrent',
                value: profileCurrentNew
            });
        }

        // Update state
        this._profileCurrent = profileCurrentNew;

        this._profiles[index1] = profile2;
        this._profiles[index2] = profile1;

        const entry1 = this._getProfileEntry(index1);
        const entry2 = this._getProfileEntry(index2);
        if (entry1 !== null && entry2 !== null) {
            entry1.index = index2;
            entry2.index = index1;
            this._swapDomNodes(entry1.node, entry2.node);
            this._profileEntryList[index1] = entry2;
            this._profileEntryList[index2] = entry1;
        }

        this._updateProfileSelectOptions();

        // Modify settings
        await this._settingsController.modifyGlobalSettings(modifications);

        // Update profile index
        if (settingsProfileIndex !== settingsProfileIndexNew) {
            this._settingsController.profileIndex = settingsProfileIndexNew;
        }
    }

    /**
     * @param {number} profileIndex
     */
    openDeleteProfileModal(profileIndex) {
        const profile = this._getProfile(profileIndex);
        if (profile === null || this.profileCount <= 1) { return; }

        /** @type {HTMLElement} */ (this._removeProfileNameElement).textContent = profile.name;
        /** @type {import('./modal.js').Modal} */ (this._profileRemoveModal).node.dataset.profileIndex = `${profileIndex}`;
        /** @type {import('./modal.js').Modal} */ (this._profileRemoveModal).setVisible(true);
    }

    /**
     * @param {number} profileIndex
     */
    openCopyProfileModal(profileIndex) {
        const profile = this._getProfile(profileIndex);
        if (profile === null || this.profileCount <= 1) { return; }

        let copyFromIndex = this._profileCurrent;
        if (copyFromIndex === profileIndex) {
            if (profileIndex !== 0) {
                copyFromIndex = 0;
            } else if (this.profileCount > 1) {
                copyFromIndex = 1;
            }
        }

        const profileIndexString = `${profileIndex}`;
        const select = /** @type {HTMLSelectElement} */ (this._profileCopySourceSelect);
        for (const option of select.querySelectorAll('option')) {
            const {value} = option;
            option.disabled = (value === profileIndexString);
        }
        select.value = `${copyFromIndex}`;

        /** @type {import('./modal.js').Modal} */ (this._profileCopyModal).node.dataset.profileIndex = `${profileIndex}`;
        /** @type {import('./modal.js').Modal} */ (this._profileCopyModal).setVisible(true);
    }

    /**
     * @param {number} profileIndex
     */
    openProfileConditionsModal(profileIndex) {
        const profile = this._getProfile(profileIndex);
        if (profile === null) { return; }

        if (this._profileConditionsModal === null) { return; }
        this._profileConditionsModal.setVisible(true);

        this._profileConditionsUI.cleanup();
        this._profileConditionsIndex = profileIndex;
        this._profileConditionsUI.prepare(profileIndex);
        if (this._profileConditionsProfileName !== null) {
            this._profileConditionsProfileName.textContent = profile.name;
        }
    }

    // Private

    /** */
    async _onOptionsChanged() {
        // Update state
        const {profiles, profileCurrent} = await this._settingsController.getOptionsFull();
        this._profiles = profiles;
        this._profileCurrent = profileCurrent;

        const settingsProfileIndex = this._settingsController.profileIndex;

        // Udpate UI
        this._updateProfileSelectOptions();

        /** @type {HTMLSelectElement} */ (this._profileActiveSelect).value = `${profileCurrent}`;
        /** @type {HTMLSelectElement} */ (this._profileTargetSelect).value = `${settingsProfileIndex}`;

        // Update profile conditions
        this._profileConditionsUI.cleanup();
        const conditionsProfile = this._getProfile(this._profileConditionsIndex !== null ? this._profileConditionsIndex : settingsProfileIndex);
        if (conditionsProfile !== null) {
            this._profileConditionsUI.prepare(settingsProfileIndex);
        }

        // Udpate profile entries
        for (const entry of this._profileEntryList) {
            entry.cleanup();
        }
        this._profileEntryList = [];
        if (this._profileEntriesSupported) {
            for (let i = 0, ii = profiles.length; i < ii; ++i) {
                this._addProfileEntry(i);
            }
        }
    }

    /**
     * @param {Event} e
     */
    _onProfileActiveChange(e) {
        const element = /** @type {HTMLSelectElement} */ (e.currentTarget);
        const value = this._tryGetValidProfileIndex(element.value);
        if (value === null) { return; }
        this.setDefaultProfile(value);
    }

    /**
     * @param {Event} e
     */
    _onProfileTargetChange(e) {
        const element = /** @type {HTMLSelectElement} */ (e.currentTarget);
        const value = this._tryGetValidProfileIndex(element.value);
        if (value === null) { return; }
        this._settingsController.profileIndex = value;
    }

    /** */
    _onAdd() {
        this.duplicateProfile(this._settingsController.profileIndex);
    }

    /** */
    _onDeleteConfirm() {
        const modal = /** @type {import('./modal.js').Modal} */ (this._profileRemoveModal);
        modal.setVisible(false);
        const {node} = modal;
        const profileIndex = node.dataset.profileIndex;
        delete node.dataset.profileIndex;

        const validProfileIndex = this._tryGetValidProfileIndex(profileIndex);
        if (validProfileIndex === null) { return; }

        this.deleteProfile(validProfileIndex);
    }

    /** */
    _onCopyConfirm() {
        const modal = /** @type {import('./modal.js').Modal} */ (this._profileCopyModal);
        modal.setVisible(false);
        const {node} = modal;
        const destinationProfileIndex = node.dataset.profileIndex;
        delete node.dataset.profileIndex;

        const validDestinationProfileIndex = this._tryGetValidProfileIndex(destinationProfileIndex);
        if (validDestinationProfileIndex === null) { return; }

        const sourceProfileIndex = this._tryGetValidProfileIndex(/** @type {HTMLSelectElement} */ (this._profileCopySourceSelect).value);
        if (sourceProfileIndex === null) { return; }

        this.copyProfile(sourceProfileIndex, validDestinationProfileIndex);
    }

    /**
     * @param {import('profile-conditions-ui').EventArgument<'conditionGroupCountChanged'>} details
     */
    _onConditionGroupCountChanged({count, profileIndex}) {
        if (profileIndex >= 0 && profileIndex < this._profileEntryList.length) {
            const profileEntry = this._profileEntryList[profileIndex];
            profileEntry.setConditionGroupsCount(count);
        }
    }

    /**
     * @param {number} profileIndex
     */
    _addProfileEntry(profileIndex) {
        const profile = this._profiles[profileIndex];
        const node = /** @type {HTMLElement} */ (this._settingsController.instantiateTemplate('profile-entry'));
        const entry = new ProfileEntry(this, node, profile, profileIndex);
        this._profileEntryList.push(entry);
        entry.prepare();
        /** @type {HTMLElement} */ (this._profileEntryListContainer).appendChild(node);
    }

    /** */
    _updateProfileSelectOptions() {
        for (const select of this._getAllProfileSelects()) {
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < this._profiles.length; ++i) {
                const profile = this._profiles[i];
                const option = document.createElement('option');
                option.value = `${i}`;
                option.textContent = profile.name;
                fragment.appendChild(option);
            }
            select.textContent = '';
            select.appendChild(fragment);
        }
    }

    /**
     * @param {number} index
     * @param {string} name
     */
    _updateSelectName(index, name) {
        const optionValue = `${index}`;
        for (const select of this._getAllProfileSelects()) {
            for (const option of select.querySelectorAll('option')) {
                if (option.value === optionValue) {
                    option.textContent = name;
                }
            }
        }
    }

    /**
     * @returns {HTMLSelectElement[]}
     */
    _getAllProfileSelects() {
        return [
            /** @type {HTMLSelectElement} */ (this._profileActiveSelect),
            /** @type {HTMLSelectElement} */ (this._profileTargetSelect),
            /** @type {HTMLSelectElement} */ (this._profileCopySourceSelect)
        ];
    }

    /**
     * @param {string|undefined} stringValue
     * @returns {?number}
     */
    _tryGetValidProfileIndex(stringValue) {
        if (typeof stringValue !== 'string') { return null; }
        const intValue = parseInt(stringValue, 10);
        return (
            Number.isFinite(intValue) &&
            intValue >= 0 &&
            intValue < this.profileCount ?
            intValue : null
        );
    }

    /**
     * @param {string} name
     * @param {import('settings').Profile[]} profiles
     * @param {number} maxUniqueAttempts
     * @returns {string}
     */
    _createCopyName(name, profiles, maxUniqueAttempts) {
        let space, index, prefix, suffix;
        const match = /^([\w\W]*\(Copy)((\s+)(\d+))?(\)\s*)$/.exec(name);
        if (match === null) {
            prefix = `${name} (Copy`;
            space = '';
            index = '';
            suffix = ')';
        } else {
            prefix = match[1];
            suffix = match[5];
            if (typeof match[2] === 'string') {
                space = match[3];
                index = parseInt(match[4], 10) + 1;
            } else {
                space = ' ';
                index = 2;
            }
        }

        let i = 0;
        while (true) {
            const newName = `${prefix}${space}${index}${suffix}`;
            if (i++ >= maxUniqueAttempts || profiles.findIndex((profile) => profile.name === newName) < 0) {
                return newName;
            }
            if (typeof index !== 'number') {
                index = 2;
                space = ' ';
            } else {
                ++index;
            }
        }
    }

    /**
     * @template [T=unknown]
     * @param {T} currentValue
     * @param {T} value1
     * @param {T} value2
     * @returns {T}
     */
    _getSwappedValue(currentValue, value1, value2) {
        if (currentValue === value1) { return value2; }
        if (currentValue === value2) { return value1; }
        return currentValue;
    }

    /**
     * @param {number} profileIndex
     * @returns {?import('settings').Profile}
     */
    _getProfile(profileIndex) {
        return (profileIndex >= 0 && profileIndex < this._profiles.length ? this._profiles[profileIndex] : null);
    }

    /**
     * @param {number} profileIndex
     * @returns {?ProfileEntry}
     */
    _getProfileEntry(profileIndex) {
        return (profileIndex >= 0 && profileIndex < this._profileEntryList.length ? this._profileEntryList[profileIndex] : null);
    }

    /**
     * @param {Element} node1
     * @param {Element} node2
     */
    _swapDomNodes(node1, node2) {
        const parent1 = node1.parentNode;
        const parent2 = node2.parentNode;
        const next1 = node1.nextSibling;
        const next2 = node2.nextSibling;
        if (node2 !== next1 && parent1 !== null) { parent1.insertBefore(node2, next1); }
        if (node1 !== next2 && parent2 !== null) { parent2.insertBefore(node1, next2); }
    }
}

class ProfileEntry {
    /**
     * @param {ProfileController} profileController
     * @param {HTMLElement} node
     * @param {import('settings').Profile} profile
     * @param {number} index
     */
    constructor(profileController, node, profile, index) {
        /** @type {ProfileController} */
        this._profileController = profileController;
        /** @type {HTMLElement} */
        this._node = node;
        /** @type {import('settings').Profile} */
        this._profile = profile;
        /** @type {number} */
        this._index = index;
        /** @type {HTMLInputElement} */
        this._isDefaultRadio = querySelectorNotNull(node, '.profile-entry-is-default-radio');
        /** @type {HTMLInputElement} */
        this._nameInput = querySelectorNotNull(node, '.profile-entry-name-input');
        /** @type {HTMLElement} */
        this._countLink = querySelectorNotNull(node, '.profile-entry-condition-count-link');
        /** @type {HTMLElement} */
        this._countText = querySelectorNotNull(node, '.profile-entry-condition-count');
        /** @type {HTMLButtonElement} */
        this._menuButton = querySelectorNotNull(node, '.profile-entry-menu-button');
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
    }

    /** @type {number} */
    get index() {
        return this._index;
    }

    set index(value) {
        this._index = value;
    }

    /** @type {HTMLElement} */
    get node() {
        return this._node;
    }

    /** */
    prepare() {
        this.updateState();

        this._eventListeners.addEventListener(this._isDefaultRadio, 'change', this._onIsDefaultRadioChange.bind(this), false);
        this._eventListeners.addEventListener(this._nameInput, 'input', this._onNameInputInput.bind(this), false);
        this._eventListeners.addEventListener(this._countLink, 'click', this._onConditionsCountLinkClick.bind(this), false);
        this._eventListeners.addEventListener(this._menuButton, 'menuOpen', this._onMenuOpen.bind(this), false);
        this._eventListeners.addEventListener(this._menuButton, 'menuClose', this._onMenuClose.bind(this), false);
    }

    /** */
    cleanup() {
        this._eventListeners.removeAllEventListeners();
        if (this._node.parentNode !== null) {
            this._node.parentNode.removeChild(this._node);
        }
    }

    /**
     * @param {string} value
     */
    setName(value) {
        if (this._nameInput.value === value) { return; }
        this._nameInput.value = value;
    }

    /**
     * @param {boolean} value
     */
    setIsDefault(value) {
        this._isDefaultRadio.checked = value;
    }

    /** */
    updateState() {
        this._nameInput.value = this._profile.name;
        this._countText.textContent = `${this._profile.conditionGroups.length}`;
        this._isDefaultRadio.checked = (this._index === this._profileController.profileCurrentIndex);
    }

    /**
     * @param {number} count
     */
    setConditionGroupsCount(count) {
        this._countText.textContent = `${count}`;
    }

    // Private

    /**
     * @param {Event} e
     */
    _onIsDefaultRadioChange(e) {
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        if (!element.checked) { return; }
        this._profileController.setDefaultProfile(this._index);
    }

    /**
     * @param {Event} e
     */
    _onNameInputInput(e) {
        const element = /** @type {HTMLInputElement} */ (e.currentTarget);
        const name = element.value;
        this._profileController.setProfileName(this._index, name);
    }

    /** */
    _onConditionsCountLinkClick() {
        this._profileController.openProfileConditionsModal(this._index);
    }

    /**
     * @param {import('popup-menu').MenuOpenEvent} e
     */
    _onMenuOpen(e) {
        const bodyNode = e.detail.menu.bodyNode;
        const count = this._profileController.profileCount;
        this._setMenuActionEnabled(bodyNode, 'moveUp', this._index > 0);
        this._setMenuActionEnabled(bodyNode, 'moveDown', this._index < count - 1);
        this._setMenuActionEnabled(bodyNode, 'copyFrom', count > 1);
        this._setMenuActionEnabled(bodyNode, 'delete', count > 1);
    }

    /**
     * @param {import('popup-menu').MenuCloseEvent} e
     */
    _onMenuClose(e) {
        switch (e.detail.action) {
            case 'moveUp':
                this._profileController.moveProfile(this._index, -1);
                break;
            case 'moveDown':
                this._profileController.moveProfile(this._index, 1);
                break;
            case 'copyFrom':
                this._profileController.openCopyProfileModal(this._index);
                break;
            case 'editConditions':
                this._profileController.openProfileConditionsModal(this._index);
                break;
            case 'duplicate':
                this._profileController.duplicateProfile(this._index);
                break;
            case 'delete':
                this._profileController.openDeleteProfileModal(this._index);
                break;
        }
    }

    /**
     * @param {Element} menu
     * @param {string} action
     * @param {boolean} enabled
     */
    _setMenuActionEnabled(menu, action, enabled) {
        const element = /** @type {HTMLButtonElement} */ (menu.querySelector(`[data-menu-action="${action}"]`));
        if (element === null) { return; }
        element.disabled = !enabled;
    }
}
