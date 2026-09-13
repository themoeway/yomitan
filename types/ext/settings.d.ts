/*
 * Copyright (C) 2023-2026  Yomitan Authors
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

import type * as Input from './input';

export type OptionsContextFlag = 'clipboard';

export type OptionsContext1 = {
    url: string;
    depth: number;
    index?: undefined;
    current?: undefined;
    flags?: OptionsContextFlag[];
    modifiers?: Input.Modifier[];
    modifierKeys?: Input.ModifierKey[];
    pointerType?: Input.PointerType;
};

export type OptionsContext2 = {
    index: number;
    url?: undefined;
    depth?: undefined;
    current?: undefined;
    flags?: OptionsContextFlag[];
    modifiers?: Input.Modifier[];
    modifierKeys?: Input.ModifierKey[];
    pointerType?: Input.PointerType;
};

export type OptionsContext3 = {
    current: true;
    url?: undefined;
    depth?: undefined;
    index?: undefined;
    flags?: OptionsContextFlag[];
    modifiers?: Input.Modifier[];
    modifierKeys?: Input.ModifierKey[];
    pointerType?: Input.PointerType;
};

export type OptionsContext = OptionsContext1 | OptionsContext2 | OptionsContext3;

export type Options = {
    version: number;
    profiles: Profile[];
    profileCurrent: number;
    global: GlobalOptions;
};

export type GlobalOptions = {
    database: GlobalDatabaseOptions;
    dataTransmissionConsentShown: boolean;
};

export type GlobalDatabaseOptions = {
    prefixWildcardsSupported: boolean;
};

export type Profile = {
    id: string;
    name: string;
    conditionGroups: ProfileConditionGroup[];
    options: ProfileOptions;
};

export type ProfileConditionGroup = {
    conditions: ProfileCondition[];
};

export type ProfileConditionType = 'popupLevel' | 'url' | 'modifierKeys' | 'flags';

export type ProfileCondition = {
    type: ProfileConditionType;
    operator: string;
    value: string;
};

export type ProfileOptions = {
    general: GeneralOptions;
    popupWindow: PopupWindowOptions;
    audio: AudioOptions;
    scanning: ScanningOptions;
    translation: TranslationOptions;
    dictionaries: DictionariesOptions;
    parsing: ParsingOptions;
    anki: AnkiOptions;
    sentenceParsing: SentenceParsingOptions;
    inputs: InputsOptions;
    clipboard: ClipboardOptions;
    accessibility: AccessibilityOptions;
};

export type GeneralOptions = {
    enable: boolean;
    language: string;
    resultOutputMode: ResultOutputMode;
    debugInfo: boolean;
    maxResults: number;
    showAdvanced: boolean;
    fontFamily: string;
    fontSize: number;
    lineHeight: string;
    popupDisplayMode: PopupDisplayMode;
    popupFullWidthPosition: PopupFullWidthPosition;
    popupWidth: number;
    popupHeight: number;
    popupHorizontalOffset: number;
    popupVerticalOffset: number;
    popupHorizontalOffset2: number;
    popupVerticalOffset2: number;
    popupHorizontalTextPosition: PopupHorizontalTextPosition;
    popupVerticalTextPosition: PopupVerticalTextPosition;
    popupScalingFactor: number;
    popupScaleRelativeToPageZoom: boolean;
    popupScaleRelativeToVisualViewport: boolean;
    showGuide: boolean;
    enableContextMenuScanSelected: boolean;
    compactTags: boolean;
    averageFrequency: boolean;
    glossaryLayoutMode: GlossaryLayoutMode;
    mainDictionary: string;
    popupTheme: PopupTheme;
    popupOuterTheme: PopupOuterTheme;
    customPopupCss: string;
    customPopupOuterCss: string;
    enableWanakana: boolean;
    showPitchAccentDownstepNotation: boolean;
    showPitchAccentPositionNotation: boolean;
    showPitchAccentGraph: boolean;
    showIframePopupsInRootFrame: boolean;
    useSecurePopupFrameUrl: boolean;
    usePopupShadowDom: boolean;
    usePopupWindow: boolean;
    popupCurrentIndicatorMode: PopupCurrentIndicatorMode;
    popupActionBarVisibility: PopupActionBarVisibility;
    popupActionBarLocation: PopupActionBarLocation;
    frequencyDisplayMode: FrequencyDisplayMode;
    termDisplayMode: TermDisplayMode;
    sortFrequencyDictionary: string | null;
    sortFrequencyDictionaryOrder: SortFrequencyDictionaryOrder;
    stickySearchHeader: boolean;
    enableYomitanApi: boolean;
    yomitanApiAllowCssSanitizationBypass: boolean;
};

export type PopupWindowOptions = {
    width: number;
    height: number;
    left: number;
    top: number;
    useLeft: boolean;
    useTop: boolean;
    windowType: PopupWindowType;
    windowState: PopupWindowState;
};

export type AudioOptions = {
    enabled: boolean;
    volume: number;
    autoPlay: boolean;
    fallbackSoundType: FallbackSoundType;
    sources: AudioSourceOptions[];
    enableDefaultAudioSources: boolean;
};

export type FallbackSoundType = 'none' | 'click' | 'bloop';

export type AudioSourceOptions = {
    type: AudioSourceType;
    url: string;
    voice: string;
};

export type ScanningOptions = {
    inputs: ScanningInput[];
    preventMiddleMouse: ScanningPreventSecondaryMouseOptions;
    preventBackForward: ScanningPreventSecondaryMouseOptions;
    selectText: boolean;
    alphanumeric: boolean;
    autoHideResults: boolean;
    delay: number;
    hideDelay: number;
    length: number;
    deepDomScan: boolean;
    popupNestingMaxDepth: number;
    enablePopupSearch: boolean;
    enableOnPopupExpressions: boolean;
    enableOnSearchPage: boolean;
    enableSearchTags: boolean;
    layoutAwareScan: boolean;
    matchTypePrefix: boolean;
    hidePopupOnCursorExit: boolean;
    hidePopupOnCursorExitDelay: number;
    reducedMotionScrolling: boolean;
    reducedMotionScrollingScale: number;
    reducedMotionScrollingSwipeThreshold: number;
    normalizeCssZoom: boolean;
    scanWithoutMousemove: boolean;
    scanResolution: string;
};

export type ScanningInput = {
    include: string;
    exclude: string;
    types: ScanningInputTypes;
    options: ScanningInputOptions;
};

export type ScanningInputTypes = {
    mouse: boolean;
    touch: boolean;
    pen: boolean;
};

export type ScanningInputOptions = {
    showAdvanced: boolean;
    searchTerms: boolean;
    searchKanji: boolean;
    scanOnTouchMove: boolean;
    scanOnTouchPress: boolean;
    scanOnTouchRelease: boolean;
    scanOnTouchTap: boolean;
    scanOnPenMove: boolean;
    scanOnPenHover: boolean;
    scanOnPenReleaseHover: boolean;
    scanOnPenPress: boolean;
    scanOnPenRelease: boolean;
    preventTouchScrolling: boolean;
    preventPenScrolling: boolean;
    minimumTouchTime: number;
};

export type ScanningPreventSecondaryMouseOptions = {
    onTextHover: boolean;
    onWebPages: boolean;
    onPopupPages: boolean;
    onSearchPages: boolean;
    onSearchQuery: boolean;
};

export type TranslationOptions = {
    convertHalfWidthCharacters: TranslationConvertType;
    convertNumericCharacters: TranslationConvertType;
    alphabeticToHiragana: TranslationConvertType;
    convertHiraganaToKatakana: TranslationConvertType;
    convertKatakanaToHiragana: TranslationConvertType;
    collapseEmphaticSequences: TranslationCollapseEmphaticSequences;
    textReplacements: TranslationTextReplacementOptions;
    searchResolution: SearchResolution;
    enableGrammarWildcards: boolean;
};

export type SearchResolution = 'letter' | 'word';

export type TranslationTextReplacementOptions = {
    searchOriginal: boolean;
    groups: TranslationTextReplacementGroup[][];
};

export type TranslationTextReplacementGroup = {
    pattern: string;
    ignoreCase: boolean;
    replacement: string;
};

export type DictionariesOptions = DictionaryOptions[];

export type DictionaryOptions = {
    name: string;
    alias: string;
    enabled: boolean;
    allowSecondarySearches: boolean;
    definitionsCollapsible: DictionaryDefinitionsCollapsible;
    partsOfSpeechFilter: boolean;
    useDeinflections: boolean;
    styles?: string;
};

export type ParsingOptions = {
    enableScanningParser: boolean;
    enableMecabParser: boolean;
    selectedParser: string | null;
    termSpacing: boolean;
    readingMode: ParsingReadingMode;
    useAllFrequencyDictionaries: boolean;
};

export type AnkiOptions = {
    enable: boolean;
    server: string;
    tags: string[];
    screenshot: AnkiScreenshotOptions;
    cardFormats: AnkiCardFormat[];
    duplicateScope: AnkiDuplicateScope;
    duplicateScopeCheckAllModels: boolean;
    duplicateBehavior: AnkiDuplicateBehavior;
    checkForDuplicates: boolean;
    fieldTemplates: string | null;
    suspendNewCards: boolean;
    displayTagsAndFlags: AnkiDisplayTagsAndFlags;
    targetTags: string[];
    noteGuiMode: AnkiNoteGuiMode;
    apiKey: string;
    downloadTimeout: number;
    forceSync: boolean;
    noteDupeCheckFirst: boolean;
};

export type AnkiScreenshotOptions = {
    format: AnkiScreenshotFormat;
    quality: number;
};

export type AnkiCardFormat = {
    type: AnkiCardFormatType;
    name: string;
    deck: string;
    model: string;
    fields: AnkiFields;
    icon: AddNoteIcon;
};

export type AnkiCardFormatType = 'kanji' | 'term';

export type AddNoteIcon = 'big-circle' | 'small-circle' | 'big-square' | 'big-diamond';

export type AnkiFields = {
    [key: string]: AnkiField;
};

export type AnkiField = {
    value: string;
    overwriteMode: AnkiNoteFieldOverwriteMode;
};

export type AnkiNoteFieldOverwriteMode = 'coalesce' | 'coalesce-new' | 'overwrite' | 'append' | 'prepend' | 'skip';

export type SentenceParsingOptions = {
    scanExtent: number;
    terminationCharacterMode: SentenceTerminationCharacterMode;
    terminationCharacters: SentenceParsingTerminationCharacterOption[];
};

export type SentenceParsingTerminationCharacterOption = {
    enabled: boolean;
    character1: string;
    character2: string | null;
    includeCharacterAtStart: boolean;
    includeCharacterAtEnd: boolean;
};

export type InputsOptions = {
    hotkeys: InputsHotkeyOptions[];
};

export type InputsHotkeyOptions = {
    action: string;
    argument: string;
    key: string | null;
    modifiers: InputsHotkeyModifier[];
    scopes: InputsHotkeyScope[];
    enabled: boolean;
};

export type ClipboardOptions = {
    enableBackgroundMonitor: boolean;
    enableSearchPageMonitor: boolean;
    autoSearchContent: boolean;
    maximumSearchLength: number;
};

export type AccessibilityOptions = {
    forceGoogleDocsHtmlRendering: boolean;
};

export type PreventSecondaryMouseOptions = {
    onTextHover: boolean;
    onWebPages: boolean;
    onPopupPages: boolean;
    onSearchPages: boolean;
    onSearchQuery: boolean;
};

export type ResultOutputMode = 'group' | 'merge' | 'split' | 'term';

export type PopupDisplayMode = 'default' | 'full-width';

export type PopupFullWidthPosition = 'top' | 'above-cursor' | 'bottom';

export type PopupHorizontalTextPosition = 'below' | 'above';

export type PopupVerticalTextPosition = 'default' | 'before' | 'after' | 'left' | 'right';

export type GlossaryLayoutMode = 'default' | 'compact' | 'compact-popup-anki';

export type PopupTheme = 'light' | 'dark' | 'browser' | 'site';

export type PopupOuterTheme = 'light' | 'dark' | 'browser' | 'site' | 'none';

export type PopupCurrentIndicatorMode = 'none' | 'asterisk' | 'triangle' | 'bar-left' | 'bar-right' | 'dot-left' | 'dot-right';

export type PopupActionBarVisibility = 'auto' | 'always';

export type PopupActionBarLocation = 'left' | 'right' | 'top' | 'bottom';

export type FrequencyDisplayMode = 'tags' | 'tags-grouped' | 'split-tags' | 'split-tags-grouped' | 'inline-list' | 'list' | 'list-bordered';

export type TermDisplayMode = 'ruby' | 'ruby-and-reading' | 'term-and-reading' | 'term-only';

export type SortFrequencyDictionaryOrder = 'ascending' | 'descending';

export type PopupWindowType = 'normal' | 'popup';

export type PopupWindowState = 'normal' | 'maximized' | 'fullscreen';

export type AudioSourceType = 'jpod101' | 'language-pod-101' | 'jisho' | 'lingua-libre' | 'wiktionary' | 'text-to-speech' | 'text-to-speech-reading' | 'custom' | 'custom-json';

export type TranslationConvertType = 'false' | 'true' | 'variant';

export type TranslationCollapseEmphaticSequences = 'false' | 'true' | 'full';

export type DictionaryDefinitionsCollapsible = 'not-collapsible' | 'expanded' | 'collapsed' | 'force-collapsed' | 'force-expanded';

export type ParsingReadingMode = 'hiragana' | 'katakana' | 'romaji' | 'dictionary-reading' | 'none';

export type AnkiScreenshotFormat = 'png' | 'jpeg';

export type AnkiDuplicateScope = 'collection' | 'deck' | 'deck-root';

export type AnkiDuplicateBehavior = 'prevent' | 'overwrite' | 'new';

export type AnkiDisplayTagsAndFlags = 'never' | 'always' | 'non-standard' | 'custom';

export type AnkiNoteGuiMode = 'browse' | 'edit';

export type SentenceTerminationCharacterMode = 'custom' | 'custom-no-newlines' | 'newlines' | 'none';

export type InputsHotkeyModifier = 'alt' | 'ctrl' | 'shift' | 'meta';

export type InputsHotkeyScope = 'popup' | 'search' | 'web';
