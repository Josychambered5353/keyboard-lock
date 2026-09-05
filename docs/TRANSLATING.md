# Translating Keyboard Lock

Every string the app shows lives in `src/shared/i18n/locales/`. There is one
flat JSON file per language, and English is the source of truth.

## Fixing wording in an existing language

Edit the language's JSON file and open a pull request. Please keep:

- the `{placeholder}` names exactly as they appear in `en.json` — they are
  replaced with real values at runtime, and the test suite checks for them;
- the tone: short, plain and calm. The app talks to someone holding a cloth.

## Adding a new language

1. Copy `src/shared/i18n/locales/en.json` to `<code>.json`, using a BCP-47 code
   (`sv`, `ko`, `pt-BR`).
2. Translate the values. Leave the keys alone.
3. Add the code to `LocaleCode` in `src/shared/types.ts`.
4. Import the file in `src/shared/i18n/index.ts` and add it to both `MESSAGES`
   and `LOCALE_NAMES`. The name in `LOCALE_NAMES` is the endonym — the language
   written in itself, the way it should read in the picker.
5. Run `npm test`. The i18n suite fails on a missing key, an extra key, a blank
   value or a dropped placeholder.

If your language needs a region fallback (the way `pt-PT` resolves to `pt-BR`),
add it to `resolveLocale` in `src/shared/i18n/index.ts` and cover it with a test.

## What the placeholders mean

| Placeholder  | Where it appears                               | Example value |
| ------------ | ---------------------------------------------- | ------------- |
| `{duration}` | Lock lengths written as prose                  | `5 min`       |
| `{shortcut}` | The unlock combination                         | `⌃⌥U`         |
| `{count}`    | A number of seconds, minutes or swallowed keys | `37`          |
| `{minutes}`  | Whole minutes of a duration                    | `2`           |
| `{seconds}`  | Remaining seconds of a duration                | `30`          |

## A note on plurals

The app deliberately avoids sentences whose grammar depends on a count. Where a
number appears it is next to a unit (`30 s`, `5 min`) or in a standalone status
line, so no language needs plural rules to read correctly. If you find a string
that reads badly in your language because of this, please open an issue — the
English source should change rather than the translation being bent around it.
