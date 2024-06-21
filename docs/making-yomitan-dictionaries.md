# Making Yomitan Dictionaries　<!-- omit in toc -->

This document provides an overview on how to create your own Yomitan dictionary.

- [Tools](#tools)
- [Read the Schemas](#read-the-schemas)
- [Packaging A Dictionary](#packaging-a-dictionary)
- [Examples](#examples)
- [Schema Validation](#schema-validation)
- [Conjugation](#conjugation)
- [Tag Categories](#tag-categories)

## Tools

- [Yomichan Dictionary Builder](https://github.com/MarvNC/yomichan-dict-builder/): A node package that simplifies the process of making dictionaries, particularly useful for those using TypeScript or JavaScript.
- [hasUTF16SurrogatePairAt](https://www.npmjs.com/package/@stdlib/assert-has-utf16-surrogate-pair-at): Important for checking if a kanji/hanzi is a surrogate pair, which affects string operations in JavaScript.
- [japanese-furigana-normalize](https://github.com/MarvNC/japanese-furigana-normalize): A utility function to normalize Japanese readings containing furigana, ensuring proper alignment with kanji characters.

## Read the Schemas

Familiarity with the [Yomitan schemas](https://github.com/themoeway/yomitan/tree/master/ext/data/schemas) is essential. These schemas define the structure of Yomitan dictionaries. Helpful resources for interpreting JSON schemas include [codebeautify](https://codebeautify.org/jsonviewer/), [json-schema-viewer](https://json-schema-viewer.vercel.app/), and [jsonhero](https://jsonhero.io/).

Below is a list of Yomitan dictionary schemas, their expected filenames, and their usage:

| Schema                                                                                                                                                     | Expected Filename                | Usage                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| [`dictionary-index-schema.json`](https://github.com/themoeway/yomitan/tree/master/ext/data/schemas/dictionary-index-schema.json)                           | `index.json`                     | Metadata about the dictionary. Please include as much detail as possible.              |
| [`dictionary-kanji-bank-v3-schema.json`](https://github.com/themoeway/yomitan/tree/master/ext/data/schemas/dictionary-kanji-bank-v3-schema.json)           | `kanji_bank_${number}.json`      | Information used in the kanji viewer - meanings, readings, statistics, and codepoints. |
| [`dictionary-kanji-meta-bank-v3-schema.json`](https://github.com/themoeway/yomitan/tree/master/ext/data/schemas/dictionary-kanji-meta-bank-v3-schema.json) | `kanji_meta-bank_${number}.json` | Stores kanji frequency data.                                                           |
| [`dictionary-tag-bank-v3-schema.json`](https://github.com/themoeway/yomitan/tree/master/ext/data/schemas/dictionary-tag-bank-v3-schema.json)               | `tag_bank_${number}.json`        | Defines tags for kanji and term dictionaries, like parts of speech or kanken level.    |
| [`dictionary-term-bank-v3-schema.json`](https://github.com/themoeway/yomitan/tree/master/ext/data/schemas/dictionary-term-bank-v3-schema.json)             | `term_bank_${number}.json`       | Stores dictionary readings, definitions, etc.                                          |
| [`dictionary-term-meta-bank-v3-schema.json`](https://github.com/themoeway/yomitan/tree/master/ext/data/schemas/dictionary-term-meta-bank-v3-schema.json)   | `term_meta_bank_${number}.json`  | Stores meta information about terms, such as frequency data and pitch accent data.     |

## Packaging A Dictionary

A dictionary can contain various types of information within the zip file. After creating an `index.json` and the relevant data files, zip them with all data `.json` files in the root directory of the zip, not in subfolders. Use the highest compression level possible to reduce the size.

## Examples

- The [official test dictionary](https://github.com/themoeway/yomitan/tree/master/test/data/dictionaries/valid-dictionary1) showcases the full range of features available in Yomitan dictionaries.

## Schema Validation

To validate schemas, configure [VSCode](https://code.visualstudio.com/docs/languages/json#_json-schemas-and-settings) to validate schemas or use a website such as [jsonschemavalidator](https://www.jsonschemavalidator.net/).

For VSCode validation, use the following settings JSON:

```json
  "json.schemas": [
    {
      "fileMatch": ["kanji_bank_*.json"],
      "url": "https://github.com/themoeway/yomitan/raw/master/ext/data/schemas/dictionary-kanji-bank-v3-schema.json"
    },
    {
      "fileMatch": ["kanji_meta_bank_*.json"],
      "url": "https://github.com/themoeway/yomitan/raw/master/ext/data/schemas/dictionary-kanji-meta-bank-v3-schema.json"
    },
    {
      "fileMatch": ["tag_bank_*.json"],
      "url": "https://github.com/themoeway/yomitan/raw/master/ext/data/schemas/dictionary-tag-bank-v3-schema.json"
    },
    {
      "fileMatch": ["term_bank_*.json"],
      "url": "https://github.com/themoeway/yomitan/raw/master/ext/data/schemas/dictionary-term-bank-v3-schema.json"
    },
    {
      "fileMatch": ["term_meta_bank_*.json"],
      "url": "https://github.com/themoeway/yomitan/raw/master/ext/data/schemas/dictionary-term-meta-bank-v3-schema.json"
    }
  ],
```

## Conjugation

For Yomitan to conjugate Japanese terms, they need the appropriate part of speech tag. The part of speech labels are documented on the [official JMDict page](http://www.edrdg.org/jmdictdb/cgi-bin/edhelp.py?svc=jmdict&sid=#kw_pos). An [npm package](https://www.npmjs.com/package/yomichan-dict-reader) can help with extracting conjugations from JMDict, as demonstrated in the [JP-Mongolian dictionary](https://github.com/MarvNC/yomichan-dictionaries/blob/master/mongolian/scrape.js).

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
- search

You can view the tag colors [here](https://github.com/themoeway/yomitan/blob/48f1d012ad5045319d4e492dfbefa39da92817b2/ext/css/display.css#L136-L149).
