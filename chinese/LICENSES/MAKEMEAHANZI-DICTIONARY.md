# Make Me a Hanzi dictionary attribution

Portions of `../data/character-components.json` are filtered and reformatted records from **Make Me a Hanzi**, Shaunak Kishore, `dictionary.txt`, revision `bddc96d41bef78427ed0e034e9f7e31d71fd1b92`.

Source: https://github.com/skishore/makemeahanzi/blob/bddc96d41bef78427ed0e034e9f7e31d71fd1b92/dictionary.txt

License: **GNU Lesser General Public License v3 or later**, see `MAKEMEAHANZI-LGPL.txt`. The derived data subset is distributed under the same license. The source's notices and data attribution are preserved. Fields are not historically verified by Chinese Lab; graphical decomposition is not necessarily the etymological origin, and simplification can obscure earlier forms.

Changes: selected 473 characters occurring in course vocabulary lessons 1–10, converted JSON Lines to a JSON object keyed by character, removed fields not used by the UI, preserved decompositions, radical classification, pinyin, and source formation annotations. The original English hints remain unchanged.

See also https://github.com/skishore/makemeahanzi/blob/bddc96d41bef78427ed0e034e9f7e31d71fd1b92/COPYING

---

## Original COPYING notice

dictionary.txt is derived from:
    Unihan - http://unicode.org/charts/unihan.html
    CJKlib - https://github.com/cburgmer/cjklib

You can redistribute and/or modify dictionary.txt under the terms of the GNU
Lesser General Public License as published by the Free Software Foundation,
either version 3 of the license, or (at your option) any later version. You
should have recieved a copy of this license (the file "LGPL") along with
dictionary.txt; if not, see see <http://www.gnu.org/licenses/>.



graphics.txt is derived from:
    Arphic PL KaitiM GB - https://apps.ubuntu.com/cat/applications/precise/fonts-arphic-gkai00mp/
    Arphic PL UKai - https://apps.ubuntu.com/cat/applications/fonts-arphic-ukai/

You can redistribute and/or modify graphics.txt under the terms of the Arphic
Public License as published by Arphic Technology Co., Ltd. You should have
received a copy of this license (the directory "APL") along with graphics.txt;
if not, see <http://ftp.gnu.org/non-gnu/chinese-fonts-truetype/LICENSE>.
