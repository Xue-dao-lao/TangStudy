# Tang Study: workflow for adding and changing content

Instructions for Claude, working with Timothy Billings on the Tang Study app for ENGL/CMLT 325.
Repository: Xue-dao-lao/TangStudy. Live site: https://xue-dao-lao.github.io/TangStudy/
Read the specification (tang-study-app-spec.md in the Project) for the design decisions behind these rules.

## Conventions

- Traditional characters in standard forms always (為 not 爲, 群 not 羣, 疏 not 疎).
- Entry format: `char (simp.) pinyin, crib gloss; additional glosses`, e.g. `舉 (举) jǔ, raise; lift`. Give the
  simplified form only when it differs. Pinyin with tone marks; for characters with more than one reading,
  give the one used in Tang verse and flag it on the review sheet. (The build fills in a missing reading
  with the most common one and reports it.)
- Everything before the first semicolon appears verbatim in the crib under the character, so keep it a bare
  English gloss: no grammatical labels, no parentheses.
- Punctuation in the poem text marks where each verse ends; it is never shown in the character grid. Grammatical functions such as *nominalizer* go after
  the semicolon, in asterisks (shown in italics).
- Glosses are spare and suited to Tang poetry: the classical sense first. Flag, rather than bury, any Tang usage
  that diverges from the common sense.
- Compounds and binomes are entries of their own (故鄉, 悠悠), pointed out in the poem's NOTES rather than
  marked in the text. Propose only genuinely lexical units, and few of them.
- Use Timothy's text exactly as given. Supply the poet if he omits it. Verify or find texts only when asked,
  as a separate task, and then say whether the text was checked against a named source or reconstructed (m).

## Step 1: the review sheet

Timothy gives a poem (or a list of characters for a lesson), the week, and any translations.
Read `source/lexicon.txt` first. Return the sheet in a code block, in this form:

```
POEM                                  (or LESSON)
Poet: 李白 Li Bai
Title: 靜夜思 / Quiet Night Thoughts   (lessons have no title line)
Week: 1                               (optional; omit to hold the poem unassigned)
Release: 2027-02-15                   (optional; hides the item until that date)

床前明月光，疑是地上霜。
舉頭望明月，低頭思故鄉。

LEXICON
床 chuáng, bed; couch; well-railing                                  —
前 qián, before; in front of; former                                 #55

COMPOUNDS
故鄉 (故乡) gùxiāng, home; native place

NOTES
Line 4: 故鄉, compound "home"

TRANSLATIONS
Judith Gautier, "L'auberge" (1867)
```

- One LEXICON line per distinct character, in order of first appearance, starting with the characters of the
  Chinese title, which are clickable on the poem page (for lessons, the given order).
- For a character already in the master lexicon, copy its existing line and mark it `(existing)`;
  for a new one, draft the entry. New entries need Timothy's full attention; existing ones only need checking
  against this poem's sense.
- After each line, the character's rank in `source/tang_char_freq.txt` (`#55`), or `—` if outside the top 500.
- List translations by translator, title, and date; their full texts are kept from Timothy's message.
- Tell Timothy to mark characters to memorize with a leading `+` and edit glosses; propose any notes
  (compounds, variants) in a NOTES section.

## Step 2: building the item

Timothy returns the revised sheet. Then:

1. Write `source/items/wNN-<id>.txt` (NN = two-digit week; id = a short pinyin slug, e.g. w01-jingyesi.txt;
   for a poem not yet assigned to a week, `unassigned-<id>.txt`)
   containing the revised sheet with an `Id:` line after the header, the `(existing)` marks and ranks removed,
   and a TRANSLATIONS section with the full texts:
   ```
   == Translator | Title | Date
   Note: optional headnote or subtitle
   lines of the translation...
   ```
   Join lines broken only by wrapping in the pasted source; keep real verse lineation.
2. Merge the item's new entries into `source/lexicon.txt` (characters under CHARACTERS, compounds under
   COMPOUNDS). Never change an existing master entry to suit one poem: if Timothy changed an existing
   character's crib on this sheet, leave the master as it is; the build records it as a contextual gloss for
   this poem only.
3. Run the build (see Setup) and read every NOTE it prints. Resolve missing entries and missing stroke data;
   report an override that is not among the entry's additional glosses to Timothy, who decides whether the
   master entry should gain that sense.
4. Check the poem page in a headless browser at desktop and phone widths.
5. Commit and push. Pages republishes within a minute or two; students' copies update automatically.

## Radicals

The Common Radicals page (menu: Radicals) is built from `source/items/radicals.txt`, which has the same form
as a poem's sheet but begins `RADICALS`, has no poem text, and lists the radicals in display order under
LEXICON. Its entries go into the master lexicon like any others. A radical with a different form as a
component is written `手/扌 shǒu, hand`; the form after the slash is shown beside the full one, has its own stroke
animation, and appears on reading flashcards. Radicals are never tied to a week; flashcards offer them as a
set of their own ("common radicals"). To add radicals later, add lines to the file and to the lexicon.
Stroke data for ⻊ is derived by the build from the first seven strokes of 路 (no source has it directly).

## Top 300

The Top 300 page (menu: Top 300) lists the first 300 characters of `source/tang_char_freq.txt` in rank order
(standard forms; 爲 shows as 為). A character becomes a link as soon as it has an entry in the master
lexicon; nothing else is needed. Timothy glosses them in passes of twenty: send a review sheet headed
`TOP 300: ranks N–M`, one line per rank in the usual entry format with pinyin, marking characters already in
the lexicon `(existing)`. Once approved, add the new lines to the lexicon (no item file). To show the whole
list of 500, change TOP_N in tools/build.py.

## Writing sheets

Printable handwriting sheets are generated by the app from the stroke data; nothing needs to be prepared.
Links: under each week on the syllabus (that week's assigned characters), on the Radicals page (all
radicals and their component forms), and in every character's entry tile (that character). On the sheet,
students add characters by clicking tiles (no typing needed), chosen from a menu of lists: each week's
assigned characters, the common radicals with their component forms, or all characters by pinyin. Any
block can be removed; the address (#/sheet/chars/霜明上/w1) records the selection and the open list.
Layout: letter paper, ten 0.75in boxes to a row; for each character, the strokes in order (newest in
vermilion), grey copies to trace to the end of that row (at least three), then at least one blank row.
At most three characters to a page, and each page is filled: spare rows are shared out evenly as extra
blank rows. Settings at the top of the sheet code in app.js: SHEET_COLS, MIN_TRACE, PER_PAGE, and the
page measurements in inches.

## Notes

A poem file may have a NOTES section, placed before TRANSLATIONS, one line per line of the poem, in line
order. Form: line number and colon, then the Chinese that is the subject of the note, a comma, then the
note; English renderings in double quotation marks; several notes on one line separated by semicolons:
`Line 6: 稚子, compound "little son"`
`Line 7: 多病所須唯藥物, variant 但有故人供祿米 "if only old friends supply me with rice"`
`Line 3: 美人, compound "a beauty," often a friend or patron longed for; 何處, compound "where"`
Notes appear beneath the character grid and above the translations; Chinese in them is set in TW-Kai.
Compounds are never [bracketed] in the poem text: the course is about single characters, so a compound
worth pointing out goes in a note instead. Compound entries may still be added to the lexicon, where they
appear as "see also" links from their characters.

Translations keep their indentation, stanza breaks and paragraph indents as pasted; runs of spaces within a
line are reduced to one. The date after the title is optional.

## Changing things later

- **A gloss, everywhere**: edit the master line in `source/lexicon.txt`, and also every item file whose line
  for that character matched the old gloss (otherwise those poems would keep the old wording as an override).
  Search with `grep -rn '^+\?CHAR,' source/items`.
- **A gloss, in one poem only**: edit that item file's line; the build turns it into a contextual gloss.
- **Brackets, assigned characters, translations**: edit the item file.
- **Assigning a held poem to a week**: add or change its `Week:` line (and rename the file to the wNN- form).
  Poems without a week appear only under All poems (alphabetical by the poet's pinyin), never on the
  syllabus or in flashcards; their `+` marks take effect once a week is given.
- **The app itself** (layout, wording, features): edit `index.html`, `style.css`, `app.js`, or `sw.js`.
  Test in a headless browser before pushing.
- After any change: run the build, check, commit, push. Tell Timothy in a line what changed.

## Setup in a new session

```
# repository (attach Xue-dao-lao/TangStudy with push access first)
git clone https://github.com/Xue-dao-lao/TangStudy /home/claude/tangstudy

# build dependencies, kept outside the repository
D=<scratchpad>/deps; mkdir -p $D && cd $D
npm pack hanzi-writer-data@2.0.1 @ivanagyro/tw-kai
mkdir hwd twkai && tar xzf hanzi-writer-data-*.tgz -C hwd && tar xzf ivanagyro-tw-kai-*.tgz -C twkai
pip install --break-system-packages -q fonttools brotli

# build
cd /home/claude/tangstudy
python3 -I tools/build.py --strokes $D/hwd/package --font $D/twkai/package
```

The build writes `data/content.json`, `strokes/*.json` and `fonts/kai-*.woff2`; commit those along with the
sources. Commit messages end with the session's attribution lines.
