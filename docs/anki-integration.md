## Anki Integration

Yomitan features automatic flashcard creation for [Anki](https://apps.ankiweb.net/), a free application designed to help you
retain knowledge. This feature requires the prior installation of an Anki plugin called [AnkiConnect](https://foosoft.net/projects/anki-connect).
Check the respective project page for more information about how to set up this software.

### Flashcard Configuration

Before flashcards can be automatically created, you must configure the templates used to create term and/or kanji notes.
If you are unfamiliar with Anki deck and model management, this would be a good time to reference the [Anki
Manual](https://docs.ankiweb.net/#/). In short, you must specify what information should be included in the
flashcards that Yomitan creates through AnkiConnect.

Flashcard fields can be configured with the following steps:

1.  Open the Yomitan options page and scroll down to the section labeled _Anki Options_.
2.  Tick the checkbox labeled _Enable Anki integration_ (Anki must be running with [AnkiConnect](https://foosoft.net/projects/anki-connect) installed).
3.  Select the type of template to configure by clicking on either the _Terms_ or _Kanji_ tabs.
4.  Select the Anki deck and model to use for new creating new flashcards of this type.
5.  Fill the model fields with markers corresponding to the information you wish to include (several can be used at
    once). Advanced users can also configure the actual [Handlebars](https://handlebarsjs.com/) templates used to create
    the flashcard contents (this is strictly optional).

    #### Markers for Term Cards

    | Marker                     | Description                                                                                                              |
    | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
    | `{audio}`                  | Audio sample of a native speaker's pronunciation in MP3 format (if available).                                           |
    | `{clipboard-image}`        | An image which is stored in the system clipboard, if present.                                                            |
    | `{clipboard-text}`         | Text which is stored in the system clipboard, if present.                                                                |
    | `{cloze-body}`             | Raw, inflected term as it appeared before being reduced to dictionary form by Yomitan.                                   |
    | `{cloze-prefix}`           | Fragment of the containing `{sentence}` starting at the beginning of `{sentence}` until the beginning of `{cloze-body}`. |
    | `{cloze-suffix}`           | Fragment of the containing `{sentence}` starting at the end of `{cloze-body}` until the end of `{sentence}`.             |
    | `{conjugation}`            | Conjugation path from the raw inflected term to the source term.                                                         |
    | `{dictionary}`             | Name of the dictionary from which the card is being created (unavailable in _grouped_ mode).                             |
    | `{document-title}`         | Title of the web page that the term appeared in.                                                                         |
    | `{expression}`             | Term expressed as kanji (will be displayed in kana if kanji is not available).                                           |
    | `{frequencies}`            | Frequency information for the term.                                                                                      |
    | `{furigana}`               | Term expressed as kanji with furigana displayed above it (e.g. <ruby>日本語<rt>にほんご</rt></ruby>).                    |
    | `{furigana-plain}`         | Term expressed as kanji with furigana displayed next to it in brackets (e.g. 日本語[にほんご]).                          |
    | `{glossary}`               | List of definitions for the term (output format depends on whether running in _grouped_ mode).                           |
    | `{glossary-brief}`         | List of definitions for the term in a more compact format.                                                               |
    | `{glossary-no-dictionary}` | List of definitions for the term, except the dictionary tag is omitted.                                                  |
    | `{part-of-speech}`         | Part of speech information for the term.                                                                                 |
    | `{pitch-accents}`          | List of pitch accent downstep notations for the term.                                                                    |
    | `{pitch-accent-graphs}`    | List of pitch accent graphs for the term.                                                                                |
    | `{pitch-accent-positions}` | List of accent downstep positions for the term as a number.                                                              |
    | `{reading}`                | Kana reading for the term (empty for terms where the expression is the reading).                                         |
    | `{screenshot}`             | Screenshot of the web page taken at the time the term was added.                                                         |
    | `{search-query}`           | The full search query shown on the search page.                                                                          |
    | `{selection-text}`         | The selected text on the search page or popup.                                                                           |
    | `{sentence}`               | Sentence, quote, or phrase that the term appears in from the source content.                                             |
    | `{sentence-furigana}`      | Sentence, quote, or phrase that the term appears in from the source content, with furigana added.                        |
    | `{tags}`                   | Grammar and usage tags providing information about the term (unavailable in _grouped_ mode).                             |
    | `{url}`                    | Address of the web page in which the term appeared in.                                                                   |

    #### Markers for Kanji Cards

    | Marker                | Description                                                                                                              |
    | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
    | `{character}`         | Unicode glyph representing the current kanji.                                                                            |
    | `{clipboard-image}`   | An image which is stored in the system clipboard, if present.                                                            |
    | `{clipboard-text}`    | Text which is stored in the system clipboard, if present.                                                                |
    | `{cloze-body}`        | Raw, inflected parent term as it appeared before being reduced to dictionary form by Yomitan.                            |
    | `{cloze-prefix}`      | Fragment of the containing `{sentence}` starting at the beginning of `{sentence}` until the beginning of `{cloze-body}`. |
    | `{cloze-suffix}`      | Fragment of the containing `{sentence}` starting at the end of `{cloze-body}` until the end of `{sentence}`.             |
    | `{dictionary}`        | Name of the dictionary from which the card is being created.                                                             |
    | `{document-title}`    | Title of the web page that the kanji appeared in.                                                                        |
    | `{frequencies}`       | Frequency information for the kanji.                                                                                     |
    | `{glossary}`          | List of definitions for the kanji.                                                                                       |
    | `{kunyomi}`           | Kunyomi (Japanese reading) for the kanji expressed as katakana.                                                          |
    | `{onyomi}`            | Onyomi (Chinese reading) for the kanji expressed as hiragana.                                                            |
    | `{screenshot}`        | Screenshot of the web page taken at the time the kanji was added.                                                        |
    | `{search-query}`      | The full search query shown on the search page.                                                                          |
    | `{selection-text}`    | The selected text on the search page or popup.                                                                           |
    | `{sentence}`          | Sentence, quote, or phrase that the character appears in from the source content.                                        |
    | `{sentence-furigana}` | Sentence, quote, or phrase that the character appears in from the source content, with furigana added.                   |
    | `{stroke-count}`      | Number of strokes that the kanji character has.                                                                          |
    | `{url}`               | Address of the web page in which the kanji appeared in.                                                                  |

When creating your model for Yomitan, _make sure that you pick a unique field to be first_; fields that will
contain `{expression}` or `{character}` are ideal candidates for this. Anki does not allow duplicate flashcards to be
added to a deck by default; it uses the first field in the model to check for duplicates. For example, if you have `{reading}`
configured to be the first field in your model and <ruby>橋<rt>はし</rt></ruby> is already in your deck, you will not
be able to create a flashcard for <ruby>箸<rt>はし</rt></ruby> because they share the same reading.

### Flashcard Creation

Once Yomitan is configured, it becomes trivial to create new flashcards with a single click. You will see the following
icons next to term definitions:

- Clicking ![](../img/btn-add-expression.png) adds the current expression as kanji (e.g. 食べる).
- Clicking ![](../img/btn-add-reading.png) adds the current expression as hiragana or katakana (e.g. たべる).

Below are some troubleshooting tips you can try if you are unable to create new flashcards:

- Individual icons will appear grayed out if a flashcard cannot be created for the current definition (e.g. it already exists in the deck).
- If all of the buttons appear grayed out, then you should double-check your deck and model configuration settings.
- If no icons appear at all, make sure that Anki is running in the background and that [AnkiConnect](https://foosoft.net/projects/anki-connect) has been installed.
