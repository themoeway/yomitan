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

import {describe, expect, test} from 'vitest';
import {TextSourceMap} from '../ext/js/general/text-source-map.js';
import {JapaneseUtil} from '../ext/js/language/sandbox/japanese-util.js';
import * as wanakana from '../ext/lib/wanakana.js';

const jp = new JapaneseUtil(wanakana);

/** */
function testIsCodePointKanji() {
    describe('isCodePointKanji', () => {
        /** @type {[characters: string, expected: boolean][]} */
        const data = [
            ['力方', true],
            ['\u53f1\u{20b9f}', true],
            ['かたカタ々kata、。？,.?', false],
            ['逸逸', true]
        ];

        test.each(data)('%s -> %o', (characters, expected) => {
            for (const character of characters) {
                const codePoint = /** @type {number} */ (character.codePointAt(0));
                const actual = jp.isCodePointKanji(codePoint);
                expect(actual).toStrictEqual(expected); // `isCodePointKanji failed for ${character} (\\u{${codePoint.toString(16)}})`
            }
        });
    });
}

/** */
function testIsCodePointKana() {
    describe('isCodePointKana', () => {
        /** @type {[characters: string, expected: boolean][]} */
        const data = [
            ['かたカタ', true],
            ['力方々kata、。？,.?', false],
            ['\u53f1\u{20b9f}', false]
        ];

        test.each(data)('%s -> %o', (characters, expected) => {
            for (const character of characters) {
                const codePoint = /** @type {number} */ (character.codePointAt(0));
                const actual = jp.isCodePointKana(codePoint);
                expect(actual).toStrictEqual(expected); // `isCodePointKana failed for ${character} (\\u{${codePoint.toString(16)}})`
            }
        });
    });
}

/** */
function testIsCodePointJapanese() {
    describe('isCodePointJapanese', () => {
        /** @type {[characters: string, expected: boolean][]} */
        const data = [
            ['かたカタ力方々、。？', true],
            ['\u53f1\u{20b9f}', true],
            ['kata,.?', false],
            ['逸逸', true]
        ];

        test.each(data)('%s -> %o', (characters, expected) => {
            for (const character of characters) {
                const codePoint = /** @type {number} */ (character.codePointAt(0));
                const actual = jp.isCodePointJapanese(codePoint);
                expect(actual).toStrictEqual(expected); // `isCodePointJapanese failed for ${character} (\\u{${codePoint.toString(16)}})`
            }
        });
    });
}

/** */
function testIsStringEntirelyKana() {
    describe('isStringEntirelyKana', () => {
        /** @type {[string: string, expected: boolean][]} */
        const data = [
            ['かたかな', true],
            ['カタカナ', true],
            ['ひらがな', true],
            ['ヒラガナ', true],
            ['カタカナひらがな', true],
            ['かたカタ力方々、。？', false],
            ['\u53f1\u{20b9f}', false],
            ['kata,.?', false],
            ['かたカタ力方々、。？invalid', false],
            ['\u53f1\u{20b9f}invalid', false],
            ['kata,.?かた', false]
        ];

        test.each(data)('%s -> %o', (string, expected) => {
            expect(jp.isStringEntirelyKana(string)).toStrictEqual(expected);
        });
    });
}

/** */
function testIsStringPartiallyJapanese() {
    describe('isStringPartiallyJapanese', () => {
        /** @type {[string: string, expected: boolean][]} */
        const data = [
            ['かたかな', true],
            ['カタカナ', true],
            ['ひらがな', true],
            ['ヒラガナ', true],
            ['カタカナひらがな', true],
            ['かたカタ力方々、。？', true],
            ['\u53f1\u{20b9f}', true],
            ['kata,.?', false],
            ['かたカタ力方々、。？invalid', true],
            ['\u53f1\u{20b9f}invalid', true],
            ['kata,.?かた', true],
            ['逸逸', true]
        ];

        test.each(data)('%s -> %o', (string, expected) => {
            expect(jp.isStringPartiallyJapanese(string)).toStrictEqual(expected);
        });
    });
}

/** */
function testConvertKatakanaToHiragana() {
    describe('convertKatakanaToHiragana', () => {
        /** @type {[string: string, expected: string, keepProlongedSoundMarks?: boolean][]} */
        const data = [
            ['かたかな', 'かたかな'],
            ['ひらがな', 'ひらがな'],
            ['カタカナ', 'かたかな'],
            ['ヒラガナ', 'ひらがな'],
            ['カタカナかたかな', 'かたかなかたかな'],
            ['ヒラガナひらがな', 'ひらがなひらがな'],
            ['chikaraちからチカラ力', 'chikaraちからちから力'],
            ['katakana', 'katakana'],
            ['hiragana', 'hiragana'],
            ['カーナー', 'かあなあ'],
            ['カーナー', 'かーなー', true]
        ];

        for (const [string, expected, keepProlongedSoundMarks = false] of data) {
            test(`${string}${keepProlongedSoundMarks ? ' keeping prolonged sound marks' : ''} -> ${expected}`, () => {
                expect(jp.convertKatakanaToHiragana(string, keepProlongedSoundMarks)).toStrictEqual(expected);
            });
        }
    });
}

/** */
function testConvertHiraganaToKatakana() {
    describe('ConvertHiraganaToKatakana', () => {
        /** @type {[string: string, expected: string][]} */
        const data = [
            ['かたかな', 'カタカナ'],
            ['ひらがな', 'ヒラガナ'],
            ['カタカナ', 'カタカナ'],
            ['ヒラガナ', 'ヒラガナ'],
            ['カタカナかたかな', 'カタカナカタカナ'],
            ['ヒラガナひらがな', 'ヒラガナヒラガナ'],
            ['chikaraちからチカラ力', 'chikaraチカラチカラ力'],
            ['katakana', 'katakana'],
            ['hiragana', 'hiragana']
        ];

        test.each(data)('%s -> %o', (string, expected) => {
            expect(jp.convertHiraganaToKatakana(string)).toStrictEqual(expected);
        });
    });
}

/** */
function testConvertToRomaji() {
    describe('ConvertToRomaji', () => {
        /** @type {[string: string, expected: string][]} */
        const data = [
            ['かたかな', 'katakana'],
            ['ひらがな', 'hiragana'],
            ['カタカナ', 'katakana'],
            ['ヒラガナ', 'hiragana'],
            ['カタカナかたかな', 'katakanakatakana'],
            ['ヒラガナひらがな', 'hiraganahiragana'],
            ['chikaraちからチカラ力', 'chikarachikarachikara力'],
            ['katakana', 'katakana'],
            ['hiragana', 'hiragana']
        ];

        test.each(data)('%s -> %o', (string, expected) => {
            expect(jp.convertToRomaji(string)).toStrictEqual(expected);
        });
    });
}

/** */
function testConvertNumericToFullWidth() {
    describe('ConvertNumericToFullWidth', () => {
        /** @type {[string: string, expected: string][]} */
        const data = [
            ['0123456789', '０１２３４５６７８９'],
            ['abcdefghij', 'abcdefghij'],
            ['カタカナ', 'カタカナ'],
            ['ひらがな', 'ひらがな']
        ];

        test.each(data)('%s -> %o', (string, expected) => {
            expect(jp.convertNumericToFullWidth(string)).toStrictEqual(expected);
        });
    });
}

/** */
function testConvertHalfWidthKanaToFullWidth() {
    describe('ConvertHalfWidthKanaToFullWidth', () => {
        /** @type {[string: string, expected: string, expectedSourceMapping?: number[]][]} */
        const data = [
            ['0123456789', '0123456789'],
            ['abcdefghij', 'abcdefghij'],
            ['カタカナ', 'カタカナ'],
            ['ひらがな', 'ひらがな'],
            ['ｶｷ', 'カキ', [1, 1]],
            ['ｶﾞｷ', 'ガキ', [2, 1]],
            ['ﾆﾎﾝ', 'ニホン', [1, 1, 1]],
            ['ﾆｯﾎﾟﾝ', 'ニッポン', [1, 1, 2, 1]]
        ];

        for (const [string, expected, expectedSourceMapping] of data) {
            test(`${string} -> ${expected}${typeof expectedSourceMapping !== 'undefined' ? ', ' + JSON.stringify(expectedSourceMapping) : ''}`, () => {
                const sourceMap = new TextSourceMap(string);
                const actual1 = jp.convertHalfWidthKanaToFullWidth(string, null);
                const actual2 = jp.convertHalfWidthKanaToFullWidth(string, sourceMap);
                expect(actual1).toStrictEqual(expected);
                expect(actual2).toStrictEqual(expected);
                if (typeof expectedSourceMapping !== 'undefined') {
                    expect(sourceMap.equals(new TextSourceMap(string, expectedSourceMapping))).toBe(true);
                }
            });
        }
    });
}

/** */
function testConvertAlphabeticToKana() {
    describe('ConvertAlphabeticToKana', () => {
        /** @type {[string: string, expected: string, expectedSourceMapping?: number[]][]} */
        const data = [
            ['0123456789', '0123456789'],
            ['abcdefghij', 'あbcでfgひj', [1, 1, 1, 2, 1, 1, 2, 1]],
            ['ABCDEFGHIJ', 'あbcでfgひj', [1, 1, 1, 2, 1, 1, 2, 1]], // wanakana.toHiragana converts text to lower case
            ['カタカナ', 'カタカナ'],
            ['ひらがな', 'ひらがな'],
            ['chikara', 'ちから', [3, 2, 2]],
            ['CHIKARA', 'ちから', [3, 2, 2]]
        ];

        for (const [string, expected, expectedSourceMapping] of data) {
            test(`${string} -> ${string}${typeof expectedSourceMapping !== 'undefined' ? ', ' + JSON.stringify(expectedSourceMapping) : ''}`, () => {
                const sourceMap = new TextSourceMap(string);
                const actual1 = jp.convertAlphabeticToKana(string, null);
                const actual2 = jp.convertAlphabeticToKana(string, sourceMap);
                expect(actual1).toStrictEqual(expected);
                expect(actual2).toStrictEqual(expected);
                if (typeof expectedSourceMapping !== 'undefined') {
                    expect(sourceMap.equals(new TextSourceMap(string, expectedSourceMapping))).toBe(true);
                }
            });
        }
    });
}

/** */
function testDistributeFurigana() {
    describe('DistributeFurigana', () => {
        /** @type {[input: [term: string, reading: string], expected: {text: string, reading: string}[]][]} */
        const data = [
            [
                ['有り難う', 'ありがとう'],
                [
                    {text: '有', reading: 'あ'},
                    {text: 'り', reading: ''},
                    {text: '難', reading: 'がと'},
                    {text: 'う', reading: ''}
                ]
            ],
            [
                ['方々', 'かたがた'],
                [
                    {text: '方々', reading: 'かたがた'}
                ]
            ],
            [
                ['お祝い', 'おいわい'],
                [
                    {text: 'お', reading: ''},
                    {text: '祝', reading: 'いわ'},
                    {text: 'い', reading: ''}
                ]
            ],
            [
                ['美味しい', 'おいしい'],
                [
                    {text: '美味', reading: 'おい'},
                    {text: 'しい', reading: ''}
                ]
            ],
            [
                ['食べ物', 'たべもの'],
                [
                    {text: '食', reading: 'た'},
                    {text: 'べ', reading: ''},
                    {text: '物', reading: 'もの'}
                ]
            ],
            [
                ['試し切り', 'ためしぎり'],
                [
                    {text: '試', reading: 'ため'},
                    {text: 'し', reading: ''},
                    {text: '切', reading: 'ぎ'},
                    {text: 'り', reading: ''}
                ]
            ],
            // Ambiguous
            [
                ['飼い犬', 'かいいぬ'],
                [
                    {text: '飼い犬', reading: 'かいいぬ'}
                ]
            ],
            [
                ['長い間', 'ながいあいだ'],
                [
                    {text: '長い間', reading: 'ながいあいだ'}
                ]
            ],
            // Same/empty reading
            [
                ['飼い犬', ''],
                [
                    {text: '飼い犬', reading: ''}
                ]
            ],
            [
                ['かいいぬ', 'かいいぬ'],
                [
                    {text: 'かいいぬ', reading: ''}
                ]
            ],
            [
                ['かいぬ', 'かいぬ'],
                [
                    {text: 'かいぬ', reading: ''}
                ]
            ],
            // Misc
            [
                ['月', 'か'],
                [
                    {text: '月', reading: 'か'}
                ]
            ],
            [
                ['月', 'カ'],
                [
                    {text: '月', reading: 'カ'}
                ]
            ],
            // Mismatched kana readings
            [
                ['有り難う', 'アリガトウ'],
                [
                    {text: '有', reading: 'ア'},
                    {text: 'り', reading: 'リ'},
                    {text: '難', reading: 'ガト'},
                    {text: 'う', reading: 'ウ'}
                ]
            ],
            [
                ['ありがとう', 'アリガトウ'],
                [
                    {text: 'ありがとう', reading: 'アリガトウ'}
                ]
            ],
            // Mismatched kana readings (real examples)
            [
                ['カ月', 'かげつ'],
                [
                    {text: 'カ', reading: 'か'},
                    {text: '月', reading: 'げつ'}
                ]
            ],
            [
                ['序ノ口', 'じょのくち'],
                [
                    {text: '序', reading: 'じょ'},
                    {text: 'ノ', reading: 'の'},
                    {text: '口', reading: 'くち'}
                ]
            ],
            [
                ['スズメの涙', 'すずめのなみだ'],
                [
                    {text: 'スズメ', reading: 'すずめ'},
                    {text: 'の', reading: ''},
                    {text: '涙', reading: 'なみだ'}
                ]
            ],
            [
                ['二カ所', 'にかしょ'],
                [
                    {text: '二', reading: 'に'},
                    {text: 'カ', reading: 'か'},
                    {text: '所', reading: 'しょ'}
                ]
            ],
            [
                ['八ツ橋', 'やつはし'],
                [
                    {text: '八', reading: 'や'},
                    {text: 'ツ', reading: 'つ'},
                    {text: '橋', reading: 'はし'}
                ]
            ],
            [
                ['八ツ橋', 'やつはし'],
                [
                    {text: '八', reading: 'や'},
                    {text: 'ツ', reading: 'つ'},
                    {text: '橋', reading: 'はし'}
                ]
            ],
            [
                ['一カ月', 'いっかげつ'],
                [
                    {text: '一', reading: 'いっ'},
                    {text: 'カ', reading: 'か'},
                    {text: '月', reading: 'げつ'}
                ]
            ],
            [
                ['一カ所', 'いっかしょ'],
                [
                    {text: '一', reading: 'いっ'},
                    {text: 'カ', reading: 'か'},
                    {text: '所', reading: 'しょ'}
                ]
            ],
            [
                ['カ所', 'かしょ'],
                [
                    {text: 'カ', reading: 'か'},
                    {text: '所', reading: 'しょ'}
                ]
            ],
            [
                ['数カ月', 'すうかげつ'],
                [
                    {text: '数', reading: 'すう'},
                    {text: 'カ', reading: 'か'},
                    {text: '月', reading: 'げつ'}
                ]
            ],
            [
                ['くノ一', 'くのいち'],
                [
                    {text: 'く', reading: ''},
                    {text: 'ノ', reading: 'の'},
                    {text: '一', reading: 'いち'}
                ]
            ],
            [
                ['くノ一', 'くのいち'],
                [
                    {text: 'く', reading: ''},
                    {text: 'ノ', reading: 'の'},
                    {text: '一', reading: 'いち'}
                ]
            ],
            [
                ['数カ国', 'すうかこく'],
                [
                    {text: '数', reading: 'すう'},
                    {text: 'カ', reading: 'か'},
                    {text: '国', reading: 'こく'}
                ]
            ],
            [
                ['数カ所', 'すうかしょ'],
                [
                    {text: '数', reading: 'すう'},
                    {text: 'カ', reading: 'か'},
                    {text: '所', reading: 'しょ'}
                ]
            ],
            [
                ['壇ノ浦の戦い', 'だんのうらのたたかい'],
                [
                    {text: '壇', reading: 'だん'},
                    {text: 'ノ', reading: 'の'},
                    {text: '浦', reading: 'うら'},
                    {text: 'の', reading: ''},
                    {text: '戦', reading: 'たたか'},
                    {text: 'い', reading: ''}
                ]
            ],
            [
                ['壇ノ浦の戦', 'だんのうらのたたかい'],
                [
                    {text: '壇', reading: 'だん'},
                    {text: 'ノ', reading: 'の'},
                    {text: '浦', reading: 'うら'},
                    {text: 'の', reading: ''},
                    {text: '戦', reading: 'たたかい'}
                ]
            ],
            [
                ['序ノ口格', 'じょのくちかく'],
                [
                    {text: '序', reading: 'じょ'},
                    {text: 'ノ', reading: 'の'},
                    {text: '口格', reading: 'くちかく'}
                ]
            ],
            [
                ['二カ国語', 'にかこくご'],
                [
                    {text: '二', reading: 'に'},
                    {text: 'カ', reading: 'か'},
                    {text: '国語', reading: 'こくご'}
                ]
            ],
            [
                ['カ国', 'かこく'],
                [
                    {text: 'カ', reading: 'か'},
                    {text: '国', reading: 'こく'}
                ]
            ],
            [
                ['カ国語', 'かこくご'],
                [
                    {text: 'カ', reading: 'か'},
                    {text: '国語', reading: 'こくご'}
                ]
            ],
            [
                ['壇ノ浦の合戦', 'だんのうらのかっせん'],
                [
                    {text: '壇', reading: 'だん'},
                    {text: 'ノ', reading: 'の'},
                    {text: '浦', reading: 'うら'},
                    {text: 'の', reading: ''},
                    {text: '合戦', reading: 'かっせん'}
                ]
            ],
            [
                ['一タ偏', 'いちたへん'],
                [
                    {text: '一', reading: 'いち'},
                    {text: 'タ', reading: 'た'},
                    {text: '偏', reading: 'へん'}
                ]
            ],
            [
                ['ル又', 'るまた'],
                [
                    {text: 'ル', reading: 'る'},
                    {text: '又', reading: 'また'}
                ]
            ],
            [
                ['ノ木偏', 'のぎへん'],
                [
                    {text: 'ノ', reading: 'の'},
                    {text: '木偏', reading: 'ぎへん'}
                ]
            ],
            [
                ['一ノ貝', 'いちのかい'],
                [
                    {text: '一', reading: 'いち'},
                    {text: 'ノ', reading: 'の'},
                    {text: '貝', reading: 'かい'}
                ]
            ],
            [
                ['虎ノ門事件', 'とらのもんじけん'],
                [
                    {text: '虎', reading: 'とら'},
                    {text: 'ノ', reading: 'の'},
                    {text: '門事件', reading: 'もんじけん'}
                ]
            ],
            [
                ['教育ニ関スル勅語', 'きょういくにかんするちょくご'],
                [
                    {text: '教育', reading: 'きょういく'},
                    {text: 'ニ', reading: 'に'},
                    {text: '関', reading: 'かん'},
                    {text: 'スル', reading: 'する'},
                    {text: '勅語', reading: 'ちょくご'}
                ]
            ],
            [
                ['二カ年', 'にかねん'],
                [
                    {text: '二', reading: 'に'},
                    {text: 'カ', reading: 'か'},
                    {text: '年', reading: 'ねん'}
                ]
            ],
            [
                ['三カ年', 'さんかねん'],
                [
                    {text: '三', reading: 'さん'},
                    {text: 'カ', reading: 'か'},
                    {text: '年', reading: 'ねん'}
                ]
            ],
            [
                ['四カ年', 'よんかねん'],
                [
                    {text: '四', reading: 'よん'},
                    {text: 'カ', reading: 'か'},
                    {text: '年', reading: 'ねん'}
                ]
            ],
            [
                ['五カ年', 'ごかねん'],
                [
                    {text: '五', reading: 'ご'},
                    {text: 'カ', reading: 'か'},
                    {text: '年', reading: 'ねん'}
                ]
            ],
            [
                ['六カ年', 'ろっかねん'],
                [
                    {text: '六', reading: 'ろっ'},
                    {text: 'カ', reading: 'か'},
                    {text: '年', reading: 'ねん'}
                ]
            ],
            [
                ['七カ年', 'ななかねん'],
                [
                    {text: '七', reading: 'なな'},
                    {text: 'カ', reading: 'か'},
                    {text: '年', reading: 'ねん'}
                ]
            ],
            [
                ['八カ年', 'はちかねん'],
                [
                    {text: '八', reading: 'はち'},
                    {text: 'カ', reading: 'か'},
                    {text: '年', reading: 'ねん'}
                ]
            ],
            [
                ['九カ年', 'きゅうかねん'],
                [
                    {text: '九', reading: 'きゅう'},
                    {text: 'カ', reading: 'か'},
                    {text: '年', reading: 'ねん'}
                ]
            ],
            [
                ['十カ年', 'じゅうかねん'],
                [
                    {text: '十', reading: 'じゅう'},
                    {text: 'カ', reading: 'か'},
                    {text: '年', reading: 'ねん'}
                ]
            ],
            [
                ['鏡ノ間', 'かがみのま'],
                [
                    {text: '鏡', reading: 'かがみ'},
                    {text: 'ノ', reading: 'の'},
                    {text: '間', reading: 'ま'}
                ]
            ],
            [
                ['鏡ノ間', 'かがみのま'],
                [
                    {text: '鏡', reading: 'かがみ'},
                    {text: 'ノ', reading: 'の'},
                    {text: '間', reading: 'ま'}
                ]
            ],
            [
                ['ページ違反', 'ぺーじいはん'],
                [
                    {text: 'ペ', reading: 'ぺ'},
                    {text: 'ー', reading: ''},
                    {text: 'ジ', reading: 'じ'},
                    {text: '違反', reading: 'いはん'}
                ]
            ],
            // Mismatched kana
            [
                ['サボる', 'サボル'],
                [
                    {text: 'サボ', reading: ''},
                    {text: 'る', reading: 'ル'}
                ]
            ],
            // Reading starts with term, but has remainder characters
            [
                ['シック', 'シック・ビルしょうこうぐん'],
                [
                    {text: 'シック', reading: 'シック・ビルしょうこうぐん'}
                ]
            ],
            // Kanji distribution tests
            [
                ['逸らす', 'そらす'],
                [
                    {text: '逸', reading: 'そ'},
                    {text: 'らす', reading: ''}
                ]
            ],
            [
                ['逸らす', 'そらす'],
                [
                    {text: '逸', reading: 'そ'},
                    {text: 'らす', reading: ''}
                ]
            ]
        ];

        test.each(data)('%o -> %o', (input, expected) => {
            const [term, reading] = input;
            const actual = jp.distributeFurigana(term, reading);
            expect(actual).toStrictEqual(expected);
        });
    });
}

/** */
function testDistributeFuriganaInflected() {
    describe('DistributeFuriganaInflected', () => {
        /** @type {[input: [term: string, reading: string, source: string], expected: {text: string, reading: string}[]][]} */
        const data = [
            [
                ['美味しい', 'おいしい', '美味しかた'],
                [
                    {text: '美味', reading: 'おい'},
                    {text: 'しかた', reading: ''}
                ]
            ],
            [
                ['食べる', 'たべる', '食べた'],
                [
                    {text: '食', reading: 'た'},
                    {text: 'べた', reading: ''}
                ]
            ],
            [
                ['迄に', 'までに', 'までに'],
                [
                    {text: 'までに', reading: ''}
                ]
            ],
            [
                ['行う', 'おこなう', 'おこなわなかった'],
                [
                    {text: 'おこなわなかった', reading: ''}
                ]
            ],
            [
                ['いい', 'いい', 'イイ'],
                [
                    {text: 'イイ', reading: ''}
                ]
            ],
            [
                ['否か', 'いなか', '否カ'],
                [
                    {text: '否', reading: 'いな'},
                    {text: 'カ', reading: 'か'}
                ]
            ]
        ];

        test.each(data)('%o -> %o', (input, expected) => {
            const [term, reading, source] = input;
            const actual = jp.distributeFuriganaInflected(term, reading, source);
            expect(actual).toStrictEqual(expected);
        });
    });
}

/** */
function testCollapseEmphaticSequences() {
    describe('CollapseEmphaticSequences', () => {
        /** @type {[input: [text: string, fullCollapse: boolean], output: [expected: string, expectedSourceMapping: number[]]][]} */
        const data = [
            [['かこい', false], ['かこい', [1, 1, 1]]],
            [['かこい', true], ['かこい', [1, 1, 1]]],
            [['かっこい', false], ['かっこい', [1, 1, 1, 1]]],
            [['かっこい', true], ['かこい', [2, 1, 1]]],
            [['かっっこい', false], ['かっこい', [1, 2, 1, 1]]],
            [['かっっこい', true], ['かこい', [3, 1, 1]]],
            [['かっっっこい', false], ['かっこい', [1, 3, 1, 1]]],
            [['かっっっこい', true], ['かこい', [4, 1, 1]]],

            [['こい', false], ['こい', [1, 1]]],
            [['こい', true], ['こい', [1, 1]]],
            [['っこい', false], ['っこい', [1, 1, 1]]],
            [['っこい', true], ['こい', [2, 1]]],
            [['っっこい', false], ['っこい', [2, 1, 1]]],
            [['っっこい', true], ['こい', [3, 1]]],
            [['っっっこい', false], ['っこい', [3, 1, 1]]],
            [['っっっこい', true], ['こい', [4, 1]]],

            [['すごい', false], ['すごい', [1, 1, 1]]],
            [['すごい', true], ['すごい', [1, 1, 1]]],
            [['すごーい', false], ['すごーい', [1, 1, 1, 1]]],
            [['すごーい', true], ['すごい', [1, 2, 1]]],
            [['すごーーい', false], ['すごーい', [1, 1, 2, 1]]],
            [['すごーーい', true], ['すごい', [1, 3, 1]]],
            [['すっごーい', false], ['すっごーい', [1, 1, 1, 1, 1]]],
            [['すっごーい', true], ['すごい', [2, 2, 1]]],
            [['すっっごーーい', false], ['すっごーい', [1, 2, 1, 2, 1]]],
            [['すっっごーーい', true], ['すごい', [3, 3, 1]]],

            [['', false], ['', []]],
            [['', true], ['', []]],
            [['っ', false], ['っ', [1]]],
            [['っ', true], ['', [1]]],
            [['っっ', false], ['っ', [2]]],
            [['っっ', true], ['', [2]]],
            [['っっっ', false], ['っ', [3]]],
            [['っっっ', true], ['', [3]]]
        ];

        test.each(data)('%o -> %o', (input, output) => {
            const [text, fullCollapse] = input;
            const [expected, expectedSourceMapping] = output;

            const sourceMap = new TextSourceMap(text);
            const actual1 = jp.collapseEmphaticSequences(text, fullCollapse, null);
            const actual2 = jp.collapseEmphaticSequences(text, fullCollapse, sourceMap);
            expect(actual1).toStrictEqual(expected);
            expect(actual2).toStrictEqual(expected);
            if (typeof expectedSourceMapping !== 'undefined') {
                expect(sourceMap.equals(new TextSourceMap(text, expectedSourceMapping))).toBe(true);
            }
        });
    });
}

/** */
function testIsMoraPitchHigh() {
    describe('IsMoraPitchHigh', () => {
        /** @type {[input: [moraIndex: number, pitchAccentDownstepPosition: number], expected: boolean][]} */
        const data = [
            [[0, 0], false],
            [[1, 0], true],
            [[2, 0], true],
            [[3, 0], true],

            [[0, 1], true],
            [[1, 1], false],
            [[2, 1], false],
            [[3, 1], false],

            [[0, 2], false],
            [[1, 2], true],
            [[2, 2], false],
            [[3, 2], false],

            [[0, 3], false],
            [[1, 3], true],
            [[2, 3], true],
            [[3, 3], false],

            [[0, 4], false],
            [[1, 4], true],
            [[2, 4], true],
            [[3, 4], true]
        ];

        test.each(data)('%o -> %o', (input, expected) => {
            const [moraIndex, pitchAccentDownstepPosition] = input;
            const actual = jp.isMoraPitchHigh(moraIndex, pitchAccentDownstepPosition);
            expect(actual).toStrictEqual(expected);
        });
    });
}

/** */
function testGetKanaMorae() {
    describe('GetKanaMorae', () => {
        /** @type {[text: string, expected: string[]][]} */
        const data = [
            ['かこ', ['か', 'こ']],
            ['かっこ', ['か', 'っ', 'こ']],
            ['カコ', ['カ', 'コ']],
            ['カッコ', ['カ', 'ッ', 'コ']],
            ['コート', ['コ', 'ー', 'ト']],
            ['ちゃんと', ['ちゃ', 'ん', 'と']],
            ['とうきょう', ['と', 'う', 'きょ', 'う']],
            ['ぎゅう', ['ぎゅ', 'う']],
            ['ディスコ', ['ディ', 'ス', 'コ']]
        ];

        test.each(data)('%s -> %o', (text, expected) => {
            const actual = jp.getKanaMorae(text);
            expect(actual).toStrictEqual(expected);
        });
    });
}


/** */
function main() {
    testIsCodePointKanji();
    testIsCodePointKana();
    testIsCodePointJapanese();
    testIsStringEntirelyKana();
    testIsStringPartiallyJapanese();
    testConvertKatakanaToHiragana();
    testConvertHiraganaToKatakana();
    testConvertToRomaji();
    testConvertNumericToFullWidth();
    testConvertHalfWidthKanaToFullWidth();
    testConvertAlphabeticToKana();
    testDistributeFurigana();
    testDistributeFuriganaInflected();
    testCollapseEmphaticSequences();
    testIsMoraPitchHigh();
    testGetKanaMorae();
}

main();
