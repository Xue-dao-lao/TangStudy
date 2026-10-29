# TangStudy

A web-based app for learning characters in order to begin to read some Tang-Dynasty poetry.
Built for ENGL/CMLT 325 at Middlebury College. Live at https://xue-dao-lao.github.io/TangStudy/

## How content is added

Everything students see is generated from plain-text files in `source/`:

- `source/lexicon.txt`: the master lexicon, one entry per line: `char (simp.), crib gloss; additional glosses`.
  The simplified form appears only when it differs; everything before the first semicolon is the crib gloss.
- `source/items/*.txt`: one file per poem or character lesson, holding the reviewed sheet: the text with
  compounds in [brackets], the lexicon lines (a leading `+` marks a character to memorize), and the translations.
  A gloss in an item file that differs from the master lexicon becomes a contextual gloss for that poem only.
- `source/tang_char_freq.txt`: frequency ranks in the Quan Tangshi.

`tools/build.py` turns these into `data/content.json`, copies stroke data into `strokes/`, and cuts the TW-Kai
font down to the characters in use (`fonts/`).

## Credits

- Characters set in TW-Kai (全字庫正楷體), Ministry of Digital Affairs, Taiwan; web packaging under SIL OFL 1.1 (`fonts/LICENSE-OFL.txt`).
- Stroke data from Make Me a Hanzi via hanzi-writer-data (Arphic Public License, `strokes/ARPHIC-PUBLIC-LICENSE.txt`).
- Stroke animation and writing practice by Hanzi Writer (MIT, `lib/HANZI-WRITER-LICENSE.txt`).
