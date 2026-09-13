# Making Yomitan Dictionaries　<!-- omit in toc -->

This document provides an overview on how to create your own Yomitan dictionary.

- [Tools](#tools)
- [Read the Schemas](#read-the-schemas)
- [Packaging A Dictionary](#packaging-a-dictionary)
- [Examples](#examples)
- [Schema Validation](#schema-validation)
- [Grammar wildcards](#grammar-wildcards)
- [Conjugation](#conjugation)
- [Tag Categories](#tag-categories)

## Tools

- [Yomichan Dictionary Builder](https://github.com/MarvNC/yomichan-dict-builder/): A node package that simplifies the process of making dictionaries, particularly useful for those using TypeScript or JavaScript.
- [hasUTF16SurrogatePairAt](https://www.npmjs.com/package/@stdlib/assert-has-utf16-surrogate-pair-at): Important for checking if a kanji/hanzi is a surrogate pair, which affects string operations in JavaScript.
- [japanese-furigana-normalize](https://github.com/MarvNC/japanese-furigana-normalize): A utility function to normalize Japanese readings containing furigana, ensuring proper alignment with kanji characters.

## Read the Schemas

Familiarity with the [Yomitan schemas](https://github.com/yomidevs/yomitan/tree/master/ext/data/schemas) is essential. These schemas define the structure of Yomitan dictionaries. Helpful resources for interpreting JSON schemas include [codebeautify](https://codebeautify.org/jsonviewer/), [json-schema-viewer](https://json-schema-viewer.vercel.app/), and [jsonhero](https://jsonhero.io/).

Below is a list of Yomitan dictionary schemas, their expected filenames, and their usage:

| Schema                                                                                                                                                    | Expected Filename                | Usage                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| [`dictionary-index-schema.json`](https://github.com/yomidevs/yomitan/tree/master/ext/data/schemas/dictionary-index-schema.json)                           | `index.json`                     | Metadata about the dictionary. Please include as much detail as possible.              |
| [`dictionary-kanji-bank-v3-schema.json`](https://github.com/yomidevs/yomitan/tree/master/ext/data/schemas/dictionary-kanji-bank-v3-schema.json)           | `kanji_bank_${number}.json`      | Information used in the kanji viewer - meanings, readings, statistics, and codepoints. |
| [`dictionary-kanji-meta-bank-v3-schema.json`](https://github.com/yomidevs/yomitan/tree/master/ext/data/schemas/dictionary-kanji-meta-bank-v3-schema.json) | `kanji_meta-bank_${number}.json` | Stores kanji frequency data.                                                           |
| [`dictionary-tag-bank-v3-schema.json`](https://github.com/yomidevs/yomitan/tree/master/ext/data/schemas/dictionary-tag-bank-v3-schema.json)               | `tag_bank_${number}.json`        | Defines tags for kanji and term dictionaries, like parts of speech or kanken level.    |
| [`dictionary-term-bank-v3-schema.json`](https://github.com/yomidevs/yomitan/tree/master/ext/data/schemas/dictionary-term-bank-v3-schema.json)             | `term_bank_${number}.json`       | Stores dictionary readings, definitions, etc.                                          |
| [`dictionary-term-meta-bank-v3-schema.json`](https://github.com/yomidevs/yomitan/tree/master/ext/data/schemas/dictionary-term-meta-bank-v3-schema.json)   | `term_meta_bank_${number}.json`  | Stores meta information about terms, such as frequency data and pitch accent data.     |

## Adding Custom CSS

You can add custom CSS to a dictionary simply by adding a `styles.css` file to the root of the dictionary zip archive. This file will be loaded by Yomitan and applied to the dictionary viewer with the styles scoped to the dictionary. For example, observe the `styles.css` file in the [official test dictionary](https://github.com/yomidevs/yomitan/tree/master/test/data/dictionaries/valid-dictionary1).

## Packaging A Dictionary

A dictionary can contain various types of information within the zip file. After creating an `index.json` and the relevant data files, zip them with all data `.json` files in the root directory of the zip, not in subfolders. Use the highest compression level possible to reduce the size.

## Examples

- The [official test dictionary](https://github.com/yomidevs/yomitan/tree/master/test/data/dictionaries/valid-dictionary1) showcases the full range of features available in Yomitan dictionaries.

## Schema Validation

To validate schemas, configure [VSCode](https://code.visualstudio.com/docs/languages/json#_json-schemas-and-settings) to validate schemas or use a website such as [jsonschemavalidator](https://www.jsonschemavalidator.net/).

For VSCode validation, add the following to your User or Workspace `settings.json`:

```json
"json.schemas": [
    {
        "fileMatch": ["index.json"],
        "url": "https://raw.githubusercontent.com/yomidevs/yomitan/refs/heads/master/ext/data/schemas/dictionary-index-schema.json"
    },
    {
        "fileMatch": ["kanji_bank_*.json"],
        "url": "https://raw.githubusercontent.com/yomidevs/yomitan/refs/heads/master/ext/data/schemas/dictionary-kanji-bank-v3-schema.json"
    },
    {
        "fileMatch": ["kanji_meta_bank_*.json"],
        "url": "https://raw.githubusercontent.com/yomidevs/yomitan/refs/heads/master/ext/data/schemas/dictionary-kanji-meta-bank-v3-schema.json"
    },
    {
        "fileMatch": ["tag_bank_*.json"],
        "url": "https://raw.githubusercontent.com/yomidevs/yomitan/refs/heads/master/ext/data/schemas/dictionary-tag-bank-v3-schema.json"
    },
    {
        "fileMatch": ["term_bank_*.json"],
        "url": "https://raw.githubusercontent.com/yomidevs/yomitan/refs/heads/master/ext/data/schemas/dictionary-term-bank-v3-schema.json"
    },
    {
        "fileMatch": ["term_meta_bank_*.json"],
        "url": "https://raw.githubusercontent.com/yomidevs/yomitan/refs/heads/master/ext/data/schemas/dictionary-term-meta-bank-v3-schema.json"
    }
]
```

## Grammar wildcards

DICT-1: Japanese dictionaries can place the fullwidth tilde `～` (U+FF5E) inside an ordinary term or reading, for example `いくら～でも`. Users must turn on **Advanced → Translation → Japanese grammar wildcards** to match this entry when they scan `いくら騒いでも`. The switch is off by default and applies to all enabled dictionaries in the active profile. Existing dictionaries need no new fields, schema version, or reimport.

DICT-2: Each `～` matches one or more characters. A pattern must contain literal text before and after every gap. Multiple gaps work, for example `どんなに～ても～ない`. Leading, trailing, or adjacent markers remain literal, as do ASCII `~` and wave dash `〜`. Other characters are literal; patterns do not use regular expression syntax. Normal text processing, conjugation rules, scan length, and search resolution still apply.

DICT-3: Keep the pattern in the existing term or reading field and write definitions as usual. For example, this version 3 term entry matches `いくら騒いでも`:

```json
["いくら～でも", "", "", "", 0, ["no matter how much"], -1, ""]
```

DICT-4: With the switch off, Yomitan searches these entries as literal text. Existing explicit prefix and suffix searches keep their usual behavior. Grammar matching applies to Japanese term lookups and may add lookup time when enabled.

## Conjugation

For Yomitan to conjugate Japanese terms, they need the appropriate part of speech tag. The part of speech labels are documented on the [official JMDict page](http://www.edrdg.org/jmdictdb/cgi-bin/edhelp.py?svc=jmdict&sid=#kw_pos). For other languages, find the part of speech tags in `ext/js/language/{language}/{language}-transforms.js` under the `conditions` label, for labels that aren't prefixed with "Intermediate".

## Tag Categories

The second item in the array of the tag bank schema determines the tag category, affecting the tag color in the user interface. The categories include:

- name
- expression
- popular
- frequent
- archaism
- dictionary
- frequency
- partOfSpeech
- search
- pronunciation-dictionary

You can view the tag colors [here](https://github.com/yomidevs/yomitan/blob/48f1d012ad5045319d4e492dfbefa39da92817b2/ext/css/display.css#L136-L149).

# Community Contributions

If you have any questions, need help, or want to share a new dictionary, feel free to pop in the [Yomitan Discord server](../README.md#yomitan). We're happy to help you get started!
