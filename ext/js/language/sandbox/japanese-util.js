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

const HIRAGANA_SMALL_TSU_CODE_POINT = 0x3063;
const KATAKANA_SMALL_TSU_CODE_POINT = 0x30c3;
const KATAKANA_SMALL_KA_CODE_POINT = 0x30f5;
const KATAKANA_SMALL_KE_CODE_POINT = 0x30f6;
const KANA_PROLONGED_SOUND_MARK_CODE_POINT = 0x30fc;

/** @type {import('japanese-util').CodepointRange} */
const HIRAGANA_RANGE = [0x3040, 0x309f];
/** @type {import('japanese-util').CodepointRange} */
const KATAKANA_RANGE = [0x30a0, 0x30ff];

/** @type {import('japanese-util').CodepointRange} */
const HIRAGANA_CONVERSION_RANGE = [0x3041, 0x3096];
/** @type {import('japanese-util').CodepointRange} */
const KATAKANA_CONVERSION_RANGE = [0x30a1, 0x30f6];

/** @type {import('japanese-util').CodepointRange[]} */
const KANA_RANGES = [HIRAGANA_RANGE, KATAKANA_RANGE];

/** @type {import('japanese-util').CodepointRange} */
const CJK_UNIFIED_IDEOGRAPHS_RANGE = [0x4e00, 0x9fff];
/** @type {import('japanese-util').CodepointRange} */
const CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A_RANGE = [0x3400, 0x4dbf];
/** @type {import('japanese-util').CodepointRange} */
const CJK_UNIFIED_IDEOGRAPHS_EXTENSION_B_RANGE = [0x20000, 0x2a6df];
/** @type {import('japanese-util').CodepointRange} */
const CJK_UNIFIED_IDEOGRAPHS_EXTENSION_C_RANGE = [0x2a700, 0x2b73f];
/** @type {import('japanese-util').CodepointRange} */
const CJK_UNIFIED_IDEOGRAPHS_EXTENSION_D_RANGE = [0x2b740, 0x2b81f];
/** @type {import('japanese-util').CodepointRange} */
const CJK_UNIFIED_IDEOGRAPHS_EXTENSION_E_RANGE = [0x2b820, 0x2ceaf];
/** @type {import('japanese-util').CodepointRange} */
const CJK_UNIFIED_IDEOGRAPHS_EXTENSION_F_RANGE = [0x2ceb0, 0x2ebef];
/** @type {import('japanese-util').CodepointRange} */
const CJK_COMPATIBILITY_IDEOGRAPHS_RANGE = [0xf900, 0xfaff];
/** @type {import('japanese-util').CodepointRange} */
const CJK_COMPATIBILITY_IDEOGRAPHS_SUPPLEMENT_RANGE = [0x2f800, 0x2fa1f];
/** @type {import('japanese-util').CodepointRange[]} */
const CJK_IDEOGRAPH_RANGES = [
    CJK_UNIFIED_IDEOGRAPHS_RANGE,
    CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A_RANGE,
    CJK_UNIFIED_IDEOGRAPHS_EXTENSION_B_RANGE,
    CJK_UNIFIED_IDEOGRAPHS_EXTENSION_C_RANGE,
    CJK_UNIFIED_IDEOGRAPHS_EXTENSION_D_RANGE,
    CJK_UNIFIED_IDEOGRAPHS_EXTENSION_E_RANGE,
    CJK_UNIFIED_IDEOGRAPHS_EXTENSION_F_RANGE,
    CJK_COMPATIBILITY_IDEOGRAPHS_RANGE,
    CJK_COMPATIBILITY_IDEOGRAPHS_SUPPLEMENT_RANGE
];

/**
 * Japanese character ranges, roughly ordered in order of expected frequency.
 * @type {import('japanese-util').CodepointRange[]}
 */
const JAPANESE_RANGES = [
    HIRAGANA_RANGE,
    KATAKANA_RANGE,

    ...CJK_IDEOGRAPH_RANGES,

    [0xff66, 0xff9f], // Halfwidth katakana

    [0x30fb, 0x30fc], // Katakana punctuation
    [0xff61, 0xff65], // Kana punctuation
    [0x3000, 0x303f], // CJK punctuation

    [0xff10, 0xff19], // Fullwidth numbers
    [0xff21, 0xff3a], // Fullwidth upper case Latin letters
    [0xff41, 0xff5a], // Fullwidth lower case Latin letters

    [0xff01, 0xff0f], // Fullwidth punctuation 1
    [0xff1a, 0xff1f], // Fullwidth punctuation 2
    [0xff3b, 0xff3f], // Fullwidth punctuation 3
    [0xff5b, 0xff60], // Fullwidth punctuation 4
    [0xffe0, 0xffee] // Currency markers
];

const SMALL_KANA_SET = new Set(Array.from('ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ'));

const HALFWIDTH_KATAKANA_MAPPING = new Map([
    ['ｦ', 'ヲヺ-'],
    ['ｧ', 'ァ--'],
    ['ｨ', 'ィ--'],
    ['ｩ', 'ゥ--'],
    ['ｪ', 'ェ--'],
    ['ｫ', 'ォ--'],
    ['ｬ', 'ャ--'],
    ['ｭ', 'ュ--'],
    ['ｮ', 'ョ--'],
    ['ｯ', 'ッ--'],
    ['ｰ', 'ー--'],
    ['ｱ', 'ア--'],
    ['ｲ', 'イ--'],
    ['ｳ', 'ウヴ-'],
    ['ｴ', 'エ--'],
    ['ｵ', 'オ--'],
    ['ｶ', 'カガ-'],
    ['ｷ', 'キギ-'],
    ['ｸ', 'クグ-'],
    ['ｹ', 'ケゲ-'],
    ['ｺ', 'コゴ-'],
    ['ｻ', 'サザ-'],
    ['ｼ', 'シジ-'],
    ['ｽ', 'スズ-'],
    ['ｾ', 'セゼ-'],
    ['ｿ', 'ソゾ-'],
    ['ﾀ', 'タダ-'],
    ['ﾁ', 'チヂ-'],
    ['ﾂ', 'ツヅ-'],
    ['ﾃ', 'テデ-'],
    ['ﾄ', 'トド-'],
    ['ﾅ', 'ナ--'],
    ['ﾆ', 'ニ--'],
    ['ﾇ', 'ヌ--'],
    ['ﾈ', 'ネ--'],
    ['ﾉ', 'ノ--'],
    ['ﾊ', 'ハバパ'],
    ['ﾋ', 'ヒビピ'],
    ['ﾌ', 'フブプ'],
    ['ﾍ', 'ヘベペ'],
    ['ﾎ', 'ホボポ'],
    ['ﾏ', 'マ--'],
    ['ﾐ', 'ミ--'],
    ['ﾑ', 'ム--'],
    ['ﾒ', 'メ--'],
    ['ﾓ', 'モ--'],
    ['ﾔ', 'ヤ--'],
    ['ﾕ', 'ユ--'],
    ['ﾖ', 'ヨ--'],
    ['ﾗ', 'ラ--'],
    ['ﾘ', 'リ--'],
    ['ﾙ', 'ル--'],
    ['ﾚ', 'レ--'],
    ['ﾛ', 'ロ--'],
    ['ﾜ', 'ワ--'],
    ['ﾝ', 'ン--']
]);

const VOWEL_TO_KANA_MAPPING = new Map([
    ['a', 'ぁあかがさざただなはばぱまゃやらゎわヵァアカガサザタダナハバパマャヤラヮワヵヷ'],
    ['i', 'ぃいきぎしじちぢにひびぴみりゐィイキギシジチヂニヒビピミリヰヸ'],
    ['u', 'ぅうくぐすずっつづぬふぶぷむゅゆるゥウクグスズッツヅヌフブプムュユルヴ'],
    ['e', 'ぇえけげせぜてでねへべぺめれゑヶェエケゲセゼテデネヘベペメレヱヶヹ'],
    ['o', 'ぉおこごそぞとどのほぼぽもょよろをォオコゴソゾトドノホボポモョヨロヲヺ'],
    ['', 'のノ']
]);

/** @type {Map<string, string>} */
const KANA_TO_VOWEL_MAPPING = new Map();
for (const [vowel, characters] of VOWEL_TO_KANA_MAPPING) {
    for (const character of characters) {
        KANA_TO_VOWEL_MAPPING.set(character, vowel);
    }
}

const kana = 'うゔ-かが-きぎ-くぐ-けげ-こご-さざ-しじ-すず-せぜ-そぞ-ただ-ちぢ-つづ-てで-とど-はばぱひびぴふぶぷへべぺほぼぽワヷ-ヰヸ-ウヴ-ヱヹ-ヲヺ-カガ-キギ-クグ-ケゲ-コゴ-サザ-シジ-スズ-セゼ-ソゾ-タダ-チヂ-ツヅ-テデ-トド-ハバパヒビピフブプヘベペホボポ';
/** @type {Map<string, {character: string, type: import('japanese-util').DiacriticType}>} */
const DIACRITIC_MAPPING = new Map();
for (let i = 0, ii = kana.length; i < ii; i += 3) {
    const character = kana[i];
    const dakuten = kana[i + 1];
    const handakuten = kana[i + 2];
    DIACRITIC_MAPPING.set(dakuten, {character, type: 'dakuten'});
    if (handakuten !== '-') {
        DIACRITIC_MAPPING.set(handakuten, {character, type: 'handakuten'});
    }
}


/**
 * @param {number} codePoint
 * @param {import('japanese-util').CodepointRange} range
 * @returns {boolean}
 */
// eslint-disable-next-line no-implicit-globals
function isCodePointInRange(codePoint, [min, max]) {
    return (codePoint >= min && codePoint <= max);
}

/**
 * @param {number} codePoint
 * @param {import('japanese-util').CodepointRange[]} ranges
 * @returns {boolean}
 */
// eslint-disable-next-line no-implicit-globals
function isCodePointInRanges(codePoint, ranges) {
    for (const [min, max] of ranges) {
        if (codePoint >= min && codePoint <= max) {
            return true;
        }
    }
    return false;
}

/**
 * @param {string} previousCharacter
 * @returns {?string}
 */
// eslint-disable-next-line no-implicit-globals
function getProlongedHiragana(previousCharacter) {
    switch (KANA_TO_VOWEL_MAPPING.get(previousCharacter)) {
        case 'a': return 'あ';
        case 'i': return 'い';
        case 'u': return 'う';
        case 'e': return 'え';
        case 'o': return 'う';
        default: return null;
    }
}


export class JapaneseUtil {
    /**
     * @param {?import('wanakana')|import('../../../lib/wanakana.js')} wanakana
     */
    constructor(wanakana = null) {
        /** @type {?import('wanakana')} */
        this._wanakana = /** @type {import('wanakana')} */ (wanakana);
    }

    // Character code testing functions

    /**
     * @param {number} codePoint
     * @returns {boolean}
     */
    isCodePointKanji(codePoint) {
        return isCodePointInRanges(codePoint, CJK_IDEOGRAPH_RANGES);
    }

    /**
     * @param {number} codePoint
     * @returns {boolean}
     */
    isCodePointKana(codePoint) {
        return isCodePointInRanges(codePoint, KANA_RANGES);
    }

    /**
     * @param {number} codePoint
     * @returns {boolean}
     */
    isCodePointJapanese(codePoint) {
        return isCodePointInRanges(codePoint, JAPANESE_RANGES);
    }

    // String testing functions

    /**
     * @param {string} str
     * @returns {boolean}
     */
    isStringEntirelyKana(str) {
        if (str.length === 0) { return false; }
        for (const c of str) {
            if (!isCodePointInRanges(/** @type {number} */ (c.codePointAt(0)), KANA_RANGES)) {
                return false;
            }
        }
        return true;
    }

    /**
     * @param {string} str
     * @returns {boolean}
     */
    isStringPartiallyJapanese(str) {
        if (str.length === 0) { return false; }
        for (const c of str) {
            if (isCodePointInRanges(/** @type {number} */ (c.codePointAt(0)), JAPANESE_RANGES)) {
                return true;
            }
        }
        return false;
    }

    // Mora functions

    /**
     * @param {number} moraIndex
     * @param {number} pitchAccentDownstepPosition
     * @returns {boolean}
     */
    isMoraPitchHigh(moraIndex, pitchAccentDownstepPosition) {
        switch (pitchAccentDownstepPosition) {
            case 0: return (moraIndex > 0);
            case 1: return (moraIndex < 1);
            default: return (moraIndex > 0 && moraIndex < pitchAccentDownstepPosition);
        }
    }

    /**
     * @param {string} text
     * @param {number} pitchAccentDownstepPosition
     * @param {boolean} isVerbOrAdjective
     * @returns {?import('japanese-util').PitchCategory}
     */
    getPitchCategory(text, pitchAccentDownstepPosition, isVerbOrAdjective) {
        if (pitchAccentDownstepPosition === 0) {
            return 'heiban';
        }
        if (isVerbOrAdjective) {
            return pitchAccentDownstepPosition > 0 ? 'kifuku' : null;
        }
        if (pitchAccentDownstepPosition === 1) {
            return 'atamadaka';
        }
        if (pitchAccentDownstepPosition > 1) {
            return pitchAccentDownstepPosition >= this.getKanaMoraCount(text) ? 'odaka' : 'nakadaka';
        }
        return null;
    }

    /**
     * @param {string} text
     * @returns {string[]}
     */
    getKanaMorae(text) {
        const morae = [];
        let i;
        for (const c of text) {
            if (SMALL_KANA_SET.has(c) && (i = morae.length) > 0) {
                morae[i - 1] += c;
            } else {
                morae.push(c);
            }
        }
        return morae;
    }

    /**
     * @param {string} text
     * @returns {number}
     */
    getKanaMoraCount(text) {
        let moraCount = 0;
        for (const c of text) {
            if (!(SMALL_KANA_SET.has(c) && moraCount > 0)) {
                ++moraCount;
            }
        }
        return moraCount;
    }

    // Conversion functions

    /**
     * @param {string} text
     * @returns {string}
     */
    convertToKana(text) {
        return this._getWanakana().toKana(text);
    }

    /**
     * @returns {boolean}
     */
    convertToKanaSupported() {
        return this._wanakana !== null;
    }

    /**
     * @param {string} text
     * @param {boolean} [keepProlongedSoundMarks]
     * @returns {string}
     */
    convertKatakanaToHiragana(text, keepProlongedSoundMarks = false) {
        let result = '';
        const offset = (HIRAGANA_CONVERSION_RANGE[0] - KATAKANA_CONVERSION_RANGE[0]);
        for (let char of text) {
            const codePoint = /** @type {number} */ (char.codePointAt(0));
            switch (codePoint) {
                case KATAKANA_SMALL_KA_CODE_POINT:
                case KATAKANA_SMALL_KE_CODE_POINT:
                    // No change
                    break;
                case KANA_PROLONGED_SOUND_MARK_CODE_POINT:
                    if (!keepProlongedSoundMarks && result.length > 0) {
                        const char2 = getProlongedHiragana(result[result.length - 1]);
                        if (char2 !== null) { char = char2; }
                    }
                    break;
                default:
                    if (isCodePointInRange(codePoint, KATAKANA_CONVERSION_RANGE)) {
                        char = String.fromCodePoint(codePoint + offset);
                    }
                    break;
            }
            result += char;
        }
        return result;
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    convertHiraganaToKatakana(text) {
        let result = '';
        const offset = (KATAKANA_CONVERSION_RANGE[0] - HIRAGANA_CONVERSION_RANGE[0]);
        for (let char of text) {
            const codePoint = /** @type {number} */ (char.codePointAt(0));
            if (isCodePointInRange(codePoint, HIRAGANA_CONVERSION_RANGE)) {
                char = String.fromCodePoint(codePoint + offset);
            }
            result += char;
        }
        return result;
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    convertToRomaji(text) {
        const wanakana = this._getWanakana();
        return wanakana.toRomaji(text);
    }

    /**
     * @returns {boolean}
     */
    convertToRomajiSupported() {
        return this._wanakana !== null;
    }

    /**
     * @param {string} text
     * @returns {string}
     */
    convertNumericToFullWidth(text) {
        let result = '';
        for (const char of text) {
            let c = /** @type {number} */ (char.codePointAt(0));
            if (c >= 0x30 && c <= 0x39) { // ['0', '9']
                c += 0xff10 - 0x30; // 0xff10 = '0' full width
                result += String.fromCodePoint(c);
            } else {
                result += char;
            }
        }
        return result;
    }

    /**
     * @param {string} text
     * @param {?import('../../general/text-source-map.js').TextSourceMap} [sourceMap]
     * @returns {string}
     */
    convertHalfWidthKanaToFullWidth(text, sourceMap = null) {
        let result = '';

        // This function is safe to use charCodeAt instead of codePointAt, since all
        // the relevant characters are represented with a single UTF-16 character code.
        for (let i = 0, ii = text.length; i < ii; ++i) {
            const c = text[i];
            const mapping = HALFWIDTH_KATAKANA_MAPPING.get(c);
            if (typeof mapping !== 'string') {
                result += c;
                continue;
            }

            let index = 0;
            switch (text.charCodeAt(i + 1)) {
                case 0xff9e: // dakuten
                    index = 1;
                    break;
                case 0xff9f: // handakuten
                    index = 2;
                    break;
            }

            let c2 = mapping[index];
            if (index > 0) {
                if (c2 === '-') { // invalid
                    index = 0;
                    c2 = mapping[0];
                } else {
                    ++i;
                }
            }

            if (sourceMap !== null && index > 0) {
                sourceMap.combine(result.length, 1);
            }
            result += c2;
        }

        return result;
    }

    /**
     * @param {string} text
     * @param {?import('../../general/text-source-map.js').TextSourceMap} sourceMap
     * @returns {string}
     */
    convertAlphabeticToKana(text, sourceMap = null) {
        let part = '';
        let result = '';

        for (const char of text) {
            // Note: 0x61 is the character code for 'a'
            let c = /** @type {number} */ (char.codePointAt(0));
            if (c >= 0x41 && c <= 0x5a) { // ['A', 'Z']
                c += (0x61 - 0x41);
            } else if (c >= 0x61 && c <= 0x7a) { // ['a', 'z']
                // NOP; c += (0x61 - 0x61);
            } else if (c >= 0xff21 && c <= 0xff3a) { // ['A', 'Z'] fullwidth
                c += (0x61 - 0xff21);
            } else if (c >= 0xff41 && c <= 0xff5a) { // ['a', 'z'] fullwidth
                c += (0x61 - 0xff41);
            } else if (c === 0x2d || c === 0xff0d) { // '-' or fullwidth dash
                c = 0x2d; // '-'
            } else {
                if (part.length > 0) {
                    result += this._convertAlphabeticPartToKana(part, sourceMap, result.length);
                    part = '';
                }
                result += char;
                continue;
            }
            part += String.fromCodePoint(c);
        }

        if (part.length > 0) {
            result += this._convertAlphabeticPartToKana(part, sourceMap, result.length);
        }
        return result;
    }

    /**
     * @returns {boolean}
     */
    convertAlphabeticToKanaSupported() {
        return this._wanakana !== null;
    }

    /**
     * @param {string} character
     * @returns {?{character: string, type: import('japanese-util').DiacriticType}}
     */
    getKanaDiacriticInfo(character) {
        const info = DIACRITIC_MAPPING.get(character);
        return typeof info !== 'undefined' ? {character: info.character, type: info.type} : null;
    }

    // Furigana distribution

    /**
     * @param {string} term
     * @param {string} reading
     * @returns {import('japanese-util').FuriganaSegment[]}
     */
    distributeFurigana(term, reading) {
        if (reading === term) {
            // Same
            return [this._createFuriganaSegment(term, '')];
        }

        /** @type {import('japanese-util').FuriganaGroup[]} */
        const groups = [];
        /** @type {?import('japanese-util').FuriganaGroup} */
        let groupPre = null;
        let isKanaPre = null;
        for (const c of term) {
            const codePoint = /** @type {number} */ (c.codePointAt(0));
            const isKana = this.isCodePointKana(codePoint);
            if (isKana === isKanaPre) {
                /** @type {import('japanese-util').FuriganaGroup} */ (groupPre).text += c;
            } else {
                groupPre = {isKana, text: c, textNormalized: null};
                groups.push(groupPre);
                isKanaPre = isKana;
            }
        }
        for (const group of groups) {
            if (group.isKana) {
                group.textNormalized = this.convertKatakanaToHiragana(group.text);
            }
        }

        const readingNormalized = this.convertKatakanaToHiragana(reading);
        const segments = this._segmentizeFurigana(reading, readingNormalized, groups, 0);
        if (segments !== null) {
            return segments;
        }

        // Fallback
        return [this._createFuriganaSegment(term, reading)];
    }

    /**
     * @param {string} term
     * @param {string} reading
     * @param {string} source
     * @returns {import('japanese-util').FuriganaSegment[]}
     */
    distributeFuriganaInflected(term, reading, source) {
        const termNormalized = this.convertKatakanaToHiragana(term);
        const readingNormalized = this.convertKatakanaToHiragana(reading);
        const sourceNormalized = this.convertKatakanaToHiragana(source);

        let mainText = term;
        let stemLength = this._getStemLength(termNormalized, sourceNormalized);

        // Check if source is derived from the reading instead of the term
        const readingStemLength = this._getStemLength(readingNormalized, sourceNormalized);
        if (readingStemLength > 0 && readingStemLength >= stemLength) {
            mainText = reading;
            stemLength = readingStemLength;
            reading = `${source.substring(0, stemLength)}${reading.substring(stemLength)}`;
        }

        const segments = [];
        if (stemLength > 0) {
            mainText = `${source.substring(0, stemLength)}${mainText.substring(stemLength)}`;
            const segments2 = this.distributeFurigana(mainText, reading);
            let consumed = 0;
            for (const segment of segments2) {
                const {text} = segment;
                const start = consumed;
                consumed += text.length;
                if (consumed < stemLength) {
                    segments.push(segment);
                } else if (consumed === stemLength) {
                    segments.push(segment);
                    break;
                } else {
                    if (start < stemLength) {
                        segments.push(this._createFuriganaSegment(mainText.substring(start, stemLength), ''));
                    }
                    break;
                }
            }
        }

        if (stemLength < source.length) {
            const remainder = source.substring(stemLength);
            const segmentCount = segments.length;
            if (segmentCount > 0 && segments[segmentCount - 1].reading.length === 0) {
                // Append to the last segment if it has an empty reading
                segments[segmentCount - 1].text += remainder;
            } else {
                // Otherwise, create a new segment
                segments.push(this._createFuriganaSegment(remainder, ''));
            }
        }

        return segments;
    }

    // Miscellaneous

    /**
     * @param {string} text
     * @param {boolean} fullCollapse
     * @param {?import('../../general/text-source-map.js').TextSourceMap} [sourceMap]
     * @returns {string}
     */
    collapseEmphaticSequences(text, fullCollapse, sourceMap = null) {
        let result = '';
        let collapseCodePoint = -1;
        const hasSourceMap = (sourceMap !== null);
        for (const char of text) {
            const c = char.codePointAt(0);
            if (
                c === HIRAGANA_SMALL_TSU_CODE_POINT ||
                c === KATAKANA_SMALL_TSU_CODE_POINT ||
                c === KANA_PROLONGED_SOUND_MARK_CODE_POINT
            ) {
                if (collapseCodePoint !== c) {
                    collapseCodePoint = c;
                    if (!fullCollapse) {
                        result += char;
                        continue;
                    }
                }
            } else {
                collapseCodePoint = -1;
                result += char;
                continue;
            }

            if (hasSourceMap) {
                sourceMap.combine(Math.max(0, result.length - 1), 1);
            }
        }
        return result;
    }

    // Private

    /**
     * @param {string} text
     * @param {string} reading
     * @returns {import('japanese-util').FuriganaSegment}
     */
    _createFuriganaSegment(text, reading) {
        return {text, reading};
    }

    /**
     * @param {string} reading
     * @param {string} readingNormalized
     * @param {import('japanese-util').FuriganaGroup[]} groups
     * @param {number} groupsStart
     * @returns {?(import('japanese-util').FuriganaSegment[])}
     */
    _segmentizeFurigana(reading, readingNormalized, groups, groupsStart) {
        const groupCount = groups.length - groupsStart;
        if (groupCount <= 0) {
            return reading.length === 0 ? [] : null;
        }

        const group = groups[groupsStart];
        const {isKana, text} = group;
        const textLength = text.length;
        if (isKana) {
            const {textNormalized} = group;
            if (textNormalized !== null && readingNormalized.startsWith(textNormalized)) {
                const segments = this._segmentizeFurigana(
                    reading.substring(textLength),
                    readingNormalized.substring(textLength),
                    groups,
                    groupsStart + 1
                );
                if (segments !== null) {
                    if (reading.startsWith(text)) {
                        segments.unshift(this._createFuriganaSegment(text, ''));
                    } else {
                        segments.unshift(...this._getFuriganaKanaSegments(text, reading));
                    }
                    return segments;
                }
            }
            return null;
        } else {
            let result = null;
            for (let i = reading.length; i >= textLength; --i) {
                const segments = this._segmentizeFurigana(
                    reading.substring(i),
                    readingNormalized.substring(i),
                    groups,
                    groupsStart + 1
                );
                if (segments !== null) {
                    if (result !== null) {
                        // More than one way to segmentize the tail; mark as ambiguous
                        return null;
                    }
                    const segmentReading = reading.substring(0, i);
                    segments.unshift(this._createFuriganaSegment(text, segmentReading));
                    result = segments;
                }
                // There is only one way to segmentize the last non-kana group
                if (groupCount === 1) {
                    break;
                }
            }
            return result;
        }
    }

    /**
     * @param {string} text
     * @param {string} reading
     * @returns {import('japanese-util').FuriganaSegment[]}
     */
    _getFuriganaKanaSegments(text, reading) {
        const textLength = text.length;
        const newSegments = [];
        let start = 0;
        let state = (reading[0] === text[0]);
        for (let i = 1; i < textLength; ++i) {
            const newState = (reading[i] === text[i]);
            if (state === newState) { continue; }
            newSegments.push(this._createFuriganaSegment(text.substring(start, i), state ? '' : reading.substring(start, i)));
            state = newState;
            start = i;
        }
        newSegments.push(this._createFuriganaSegment(text.substring(start, textLength), state ? '' : reading.substring(start, textLength)));
        return newSegments;
    }

    /**
     * @returns {import('wanakana')}
     * @throws {Error}
     */
    _getWanakana() {
        const wanakana = this._wanakana;
        if (wanakana === null) { throw new Error('Functions which use WanaKana are not supported in this context'); }
        return wanakana;
    }

    /**
     * @param {string} text
     * @param {?import('../../general/text-source-map.js').TextSourceMap} sourceMap
     * @param {number} sourceMapStart
     * @returns {string}
     */
    _convertAlphabeticPartToKana(text, sourceMap, sourceMapStart) {
        const wanakana = this._getWanakana();
        const result = wanakana.toHiragana(text);

        // Generate source mapping
        if (sourceMap !== null) {
            let i = 0;
            let resultPos = 0;
            const ii = text.length;
            while (i < ii) {
                // Find smallest matching substring
                let iNext = i + 1;
                let resultPosNext = result.length;
                while (iNext < ii) {
                    const t = wanakana.toHiragana(text.substring(0, iNext));
                    if (t === result.substring(0, t.length)) {
                        resultPosNext = t.length;
                        break;
                    }
                    ++iNext;
                }

                // Merge characters
                const removals = iNext - i - 1;
                if (removals > 0) {
                    sourceMap.combine(sourceMapStart, removals);
                }
                ++sourceMapStart;

                // Empty elements
                const additions = resultPosNext - resultPos - 1;
                for (let j = 0; j < additions; ++j) {
                    sourceMap.insert(sourceMapStart, 0);
                    ++sourceMapStart;
                }

                i = iNext;
                resultPos = resultPosNext;
            }
        }

        return result;
    }

    /**
     * @param {string} text1
     * @param {string} text2
     * @returns {number}
     */
    _getStemLength(text1, text2) {
        const minLength = Math.min(text1.length, text2.length);
        if (minLength === 0) { return 0; }

        let i = 0;
        while (true) {
            const char1 = /** @type {number} */ (text1.codePointAt(i));
            const char2 = /** @type {number} */ (text2.codePointAt(i));
            if (char1 !== char2) { break; }
            const charLength = String.fromCodePoint(char1).length;
            i += charLength;
            if (i >= minLength) {
                if (i > minLength) {
                    i -= charLength; // Don't consume partial UTF16 surrogate characters
                }
                break;
            }
        }
        return i;
    }
}
