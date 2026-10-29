# Tang Study: workflow for adding and changing content

Instructions for Claude, working with Timothy Billings on the Tang Study app for ENGL/CMLT 325.
Repository: Xue-dao-lao/TangStudy. Live site: https://xue-dao-lao.github.io/TangStudy/
Read the specification (tang-study-app-spec.md in the Project) for the design decisions behind these rules.

## Conventions

- Traditional characters in standard forms always (為 not 爲, 群 not 羣, 疏 not 疎).
- Entry format: `char (simp.), crib gloss; additional glosses`. Give the simplified form only when it differs.
- Everything before the first semicolon appears verbatim in the crib under the character, so keep it a bare
  English gloss: no grammatical labels, no parentheses.
- Punctuation in the poem text marks where each verse ends; it is never shown in the character grid. Grammatical functions such as *nominalizer* go after
  the semicolon, in asterisks (shown in italics).
- Glosses are spare and suited to Tang poetry: the classical sense first. Flag, rather than bury, any Tang usage
  that diverges from the common sense.
- Compounds and binomes are entries of their own (明月, 悠悠). In poem text they are marked with [brackets].
  Propose only genuinely lexical units; leave arguable cases unbracketed and mention them.
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

床前[明月]光，疑是地上霜。
舉頭望[明月]，低頭思[故鄉]。

LEXICON
床, bed; couch; well-railing                                         —
前, before; in front of; former                                      #55

COMPOUNDS
明月, bright moon

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
- Tell Timothy to mark characters to memorize with a leading `+`, edit glosses, and add or remove brackets.

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
component is written `手/扌, hand`; the form after the slash is shown beside the full one, has its own stroke
animation, and appears on reading flashcards. Radicals are never tied to a week; flashcards offer them as a
set of their own ("common radicals"). To add radicals later, add lines to the file and to the lexicon.
Stroke data for ⻊ is derived by the build from the first seven strokes of 路 (no source has it directly).

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
