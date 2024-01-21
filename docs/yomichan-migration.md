## Migrating from Yomichan

### Exporting Data

If you are an existing user of Yomichan, you can export your dictionary collection and settings such that they can be imported into Yomitan to reflect your setup exactly as it was.

You can export your settings from Yomichan's Settings page. Go to the `Backup` section and click on `Export Settings`.

Yomichan doesn't have first-class support to export the dictionary collection. Please follow the instructions provided in the following link to export your data:
https://github.com/themoeway/yomichan-data-exporter#steps-to-export-the-data

You can then import the exported files into Yomitan from the `Backup` section of the `Settings` page. Please see [the section on importing dictionaries](#importing-dictionaries) further below for more explicit steps.

### Custom Templates

If you do not use custom templates for Anki note creation, this section can be skipped.

Due to security concerns, an alternate implementation of Handlebars is being used which behaves slightly differently.
This revealed a bug in four of Yomitan's template helpers, which have now been fixed in the default templates. If your
custom templates use the following helpers, please ensure their use matches the corrected forms.

| Helper           | Example                                                       | Corrected                            |
| ---------------- | ------------------------------------------------------------- | ------------------------------------ |
| `formatGlossary` | `{{#formatGlossary ../dictionary}}{{{.}}}{{/formatGlossary}}` | `{{formatGlossary ../dictionary .}}` |
| `furigana`       | `{{#furigana}}{{{definition}}}{{/furigana}}`                  | `{{furigana definition}}`            |
| `furiganaPlain`  | `{{~#furiganaPlain}}{{{.}}}{{/furiganaPlain~}}`               | `{{~furiganaPlain .~}}`              |
| `dumpObject`     | `{{#dumpObject}}{{{.}}}{{/dumpObject}}`                       | `{{dumpObject .}}`                   |

Authors of custom templates may be interested to know that other helpers previously used and documented in the block
form (e.g. `{{#set "key" "value"}}{{/set}}`), while not broken by this change, may also be replaced with the less verbose
form (e.g. `{{set "key" "value"}}`). The default templates and helper documentation have been changed to reflect this.
