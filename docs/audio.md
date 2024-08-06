# Audio

## Default audio sources

After looking up a term, you can click on the <img src="../ext/images/play-audio.svg" alt="" width="16" height="16"> _speaker_ button to hear the term's pronunciation. When searching for audio, multiple audio sources are checked until the first source with audio for the term is found. If no audio is found, you will hear a short click instead. Right-clicking the <img src="../ext/images/play-audio.svg" alt="" width="16" height="16"> button allows choosing the source manually.

The default audio sources are:

- LanguagePod101
- Jisho.org (japanese only)
- Lingua Libre
- Wiktionary

Depending on language, you may want to increase coverage by adding additional sources, as described below.

## Configuration

Audio sources can be configured in `Settings` > `Audio` > `Configure audio playback sources` to reorder them or add new ones. Besides the four sources mentioned above, you can also use your browser's inbuilt text-to-speech (TTS) engine or add a custom URL source:

### Text-to-speech (TTS)

To enable this, just add a new playback source with the `Text-to-speech` type and choose your desired voice. This is the simplest way to get pronunciation audio, though there a few points to keep in mind:

- TTS voices vary between browsers and so might not support all languages. For instance, [Microsoft Edge](https://www.microsoft.com/en-us/edge) offers a wide selection of free Azure natural voices for a variety of languages. Edge provides over 300 voices, compared to around 25 in Google Chrome (see [here](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=stt) for a list of supported languages).
- TTS audio can be inaccurate for languages with complex pronunciation such as Japanese, where words can have multiple possible readings and pitch accents.
- ⚠️ Note that the TTS voices cannot be sent to Anki; this is a [limitation of the browser SpeechSynthesis API](https://github.com/themoeway/yomitan/issues/864).

### Custom URL

You can add a custom URL from which audio will be fetched. One use case for this is fetching audio from Forvo:

#### Yomichan Forvo Server

[Forvo](https://forvo.com/) is currently the largest online pronunciation database, with native pronunciation audio for various languages. One way to get Forvo audio in Yomitan is via the [Yomichan Forvo Server](https://ankiweb.net/shared/info/580654285) Anki add-on. It fetches from Forvo, at the cost of a slight delay. After installing it in Anki, add a `Custom URL (JSON)` audio source with the URL `http://localhost:8770?term={term}&reading={reading}&language=en` (replacing `en` with the desired language's ISO code).
