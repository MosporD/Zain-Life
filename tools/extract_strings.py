"""Lists every user-facing English text fragment in the app (for the Arabic dictionary).
Usage: python tools/extract_strings.py www/app.js www/life.js www/planner.js www/index.html"""
import html
import json
import re
import sys

BS = chr(92)


def literals(src):
    out, i, n, prev = [], 0, len(src), ''
    while i < n:
        c = src[i]
        if c in ' \t\r\n':
            i += 1
            continue
        if src.startswith('//', i):
            i = src.find('\n', i)
            i = n if i < 0 else i
            continue
        if src.startswith('/*', i):
            i = src.find('*/', i) + 2
            continue
        if c in '\'"`':
            q, j, buf = c, i + 1, ''
            while j < n and src[j] != q:
                if src[j] == BS:
                    buf += src[j + 1]
                    j += 2
                    continue
                buf += src[j]
                j += 1
            out.append(buf)
            i, prev = j + 1, 'a'
            continue
        if c == '/' and (prev == '' or prev in '(,=:[!&|?{};+-*%<>~^'):
            j, cls = i + 1, False
            while j < n:
                if src[j] == BS:
                    j += 2
                    continue
                if src[j] == '[':
                    cls = True
                elif src[j] == ']':
                    cls = False
                elif src[j] == '/' and not cls:
                    break
                j += 1
            i = j + 1
            while i < n and src[i].isalpha():
                i += 1
            prev = 'a'
            continue
        if c.isalnum() or c in '_$':
            j = i
            while j < n and (src[j].isalnum() or src[j] in '_$'):
                j += 1
            word = src[i:j]
            i = j
            prev = '(' if word in ('return', 'typeof', 'case', 'in', 'of') else 'a'
            continue
        prev = c
        i += 1
    return out


ATTR = r'\s(class|data-[a-z-]+|id|style|href|type|viewBox|d|fill|stroke[a-z-]*|width|height|role|inputmode|step|min|max|accept|src|value|for|name|pathLength|rel|lang|content|charset|hidden|disabled|checked|selected|cx|cy|r|x|y|rx|points)="[^"]*"'
pieces = set()


def add(t):
    t = html.unescape(t)
    for part in re.split(r'<[^>]*>|<[a-z/][^>]*$|^[^<]*>', t):
        part = re.sub(r'\s+', ' ', part).strip()
        if not re.search(r'[A-Za-z]{2,}', part):
            continue
        if re.fullmatch(r'[a-z][a-zA-Z0-9_\-\.]*', part):
            continue
        pieces.add(part)


for f in sys.argv[1:]:
    s = open(f, encoding='utf-8').read()
    if f.endswith('.html'):
        s = re.sub(r'<script.*?</script>', '', s, flags=re.S)
        s = re.sub(r'<svg.*?</svg>', '', s, flags=re.S)
        for m in re.finditer(r'(placeholder|aria-label|title)="([^"]+)"', s):
            add(m.group(2))
        add(re.sub(ATTR, '', s))
        continue
    for lit in literals(s):
        for m in re.finditer(r'(placeholder|aria-label|title)="([^"]+)"', lit):
            add(m.group(2))
        add(re.sub(ATTR, '', lit))

ps = sorted(pieces, key=lambda x: (len(x), x))
json.dump(ps, open('pieces.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(ps), sum(map(len, ps)))
