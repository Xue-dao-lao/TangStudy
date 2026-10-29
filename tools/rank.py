#!/usr/bin/env python3
"""Rank characters by frequency in the poem lines of the Quan Tangshi.

Source: the traditional-character transcription in the chinese-poetry project
(github.com/chinese-poetry/chinese-poetry, folder 全唐诗, poet.tang.*.json), which keeps the printed
forms (爲, 却, 羣 ...) rather than converting from simplified characters. Editors' notes embedded in
the poem lines in parentheses or brackets are removed before counting; titles are not counted.
Variant pairs the app treats as one character are merged into the standard form.

Usage: python3 tools/rank.py <path to 全唐诗 folder> > source/tang_char_freq.txt
"""
import json, glob, re, sys
from collections import Counter

NOTE = re.compile(r'[（(][^（）()]*[）)]')
BRACKETS = re.compile(r'[\[［【][^\]］】]*[\]］】]')
MERGE = {'爲': '為', '羣': '群', '疎': '疏', '却': '卻', '峯': '峰'}
N = 500

c, poems = Counter(), 0
for f in sorted(glob.glob(sys.argv[1].rstrip('/') + '/poet.tang.*.json')):
    for p in json.load(open(f, encoding='utf-8')):
        poems += 1
        txt = ''.join(p['paragraphs'])
        prev = None
        while prev != txt:
            prev, txt = txt, NOTE.sub('', txt)
        txt = BRACKETS.sub('', txt)
        for ch in re.sub(r'[^㐀-鿿]', '', txt):
            c[MERGE.get(ch, ch)] += 1

print(f'全唐詩　字頻統計　前 {N} 字')
print('=' * 40)
print(f'Poem lines only, editorial notes removed; {poems:,} poems, {sum(c.values()):,} characters.')
print('Variants merged: ' + ', '.join(f'{a}→{b}' for a, b in MERGE.items()) + '. Made by tools/rank.py.')
print()
for i, (ch, n) in enumerate(c.most_common(N), 1):
    print(f'{i:>3}.  {ch}  ({n:,})')
