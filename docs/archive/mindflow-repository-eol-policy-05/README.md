# MINDFLOW-REPOSITORY-EOL-POLICY-05

Made the repository's line-ending policy explicit and portable, so a checkout no
longer depends on each developer's Git installation.

The operating documentation is `docs/LINE_ENDINGS.md`. This file is the
measurement record.

## The finding that framed the mission

`core.autocrlf=true` was never set for this project. It comes from the **system**
scope — Git for Windows writes it into `C:\Program Files\Git\etc\gitconfig` at
install time:

```
core.autocrlf  local  : (not set)
core.autocrlf  global : (not set)
core.autocrlf  system : true
```

So the working-copy line endings were a property of the installer, not of the
repository, and differed between a Windows clone and a macOS or Linux one.

## EOL INVENTORY

1075 tracked files. **The index was already fully canonical** — the divergence
was entirely in the working copy.

| | BEFORE | AFTER |
| --- | --- | --- |
| tracked files | 1075 | 1075 |
| **index** LF | 680 | 680 |
| **index** CRLF | 0 | 0 |
| **index** mixed | 0 | 0 |
| **index** binary | 395 | 395 |
| **worktree** LF | 545 | **680** |
| **worktree** CRLF | 121 | **0** |
| **worktree** mixed | 14 | **0** |
| **worktree** binary | 395 | 395 |
| files with attributes in force | 0 | 1075 |
| LF in index but CRLF on disk | 121 | 0 |

A *fresh* checkout was worse than the working copy above: materialised from the
index with `core.autocrlf=true` and no policy, **680 of 680 text files come out
CRLF** — every single one differing from its blob.

The 14 mixed-EOL files were files edited in place by tooling that writes LF into
a CRLF file: `useEscapeMaze.ts`, `globals.css`, `storage.ts`, `worlds.ts` and
others. Their blobs were still clean LF, because check-in normalisation had been
absorbing the difference.

## FILE TYPE CLASSIFICATION

| class | extensions present | count |
| --- | --- | --- |
| source / config text | `.json` 415, `.md` 89, `.mjs` 76, `.tsx` 39, `.ts` 30, `.py` 16, `.css` 9, `.svg` 5, `.gitignore` 1 | 680 |
| binary | `.png` 294, `.webp` 92, `.glb` 8, `.ico` 1 | 395 |
| Windows scripts | **none tracked** (`.bat`, `.cmd`, `.ps1`) | 0 |
| Unix shell | **none tracked** (`.sh`) | 0 |

No `.gltf`, `.mp4`, audio, fonts or archives are tracked, so no rules were
invented for them. `package-lock.json` is tracked and is an ordinary `.json`
governed by the default rule.

## INDEX_RENORMALIZATION_REQUIRED = NO

Proven, not assumed. In an isolated worktree with the policy applied:

```
git add --renormalize .
git diff --cached --name-only   ->  0 files
```

680 of 680 text blobs were already LF and 0 were CRLF or mixed, so there was
nothing to renormalise. **`NO_INDEX_RENORMALIZATION_REQUIRED`** — no commit was
manufactured to touch files that were already correct.

`BINARY CHANGES = 0` follows trivially: the preview staged nothing at all.

## CORE.AUTOCRLF INDEPENDENCE PROOF

The whole worktree was deleted and materialised again from the index under each
setting, with the policy in force. Deleting first matters — `checkout-index -f`
skips files the stat cache believes are current, so overwriting in place proves
nothing. `-c core.autocrlf=<v>` applies to one invocation; the operator's own
configuration was never written to.

```
core.autocrlf=true    w/lf=680  w/-text=395   binary aggregate == object database
core.autocrlf=false   w/lf=680  w/-text=395   binary aggregate == object database
core.autocrlf=input   w/lf=680  w/-text=395   binary aggregate == object database

EOL identical across all three settings : YES
Zero CRLF and zero mixed in any setting : YES
Binary bytes == object database         : YES

CORE_AUTOCRLF_INDEPENDENT
BINARY_CONTENT_PRESERVED
```

Compare the same measurement without the policy: `w/crlf=680`.

The binary check hashes each of the 395 binaries and compares the aggregate
against the bytes read straight out of the object database, so the comparison is
against what Git stores rather than against another checkout.

## WORKING COPY ALIGNMENT

The index needed nothing, but the operator's 135 non-LF working files did — they
were the local condition that broke the tooling in the first place. They were
re-materialised, and the change proven to be EOL-only:

```
files still non-LF on disk: 135   (crlf 121, mixed 14)
SEMANTIC_CONTENT_DELTA = 0
still containing CRLF   = 0
git status --porcelain  -> clean
```

`SEMANTIC_CONTENT_DELTA` compares the SHA-256 of each file's content normalised
to LF, before and after. No blob and no commit is involved: this only brings the
checkout in line with what a fresh clone now produces.

## CROSS-EOL TOOLING REGRESSION

`tools/validation/cross-eol-tests.mjs` guards the bug class rather than the
symptom, because a policy is a promise about checkouts and not a property of the
code. It drives the real loader twice — once normally, once with a transform that
hands `instrument()` a fully CRLF source — and requires identical results, down
to the generated map.

It also pins the asymmetry that made the original failure so hard to read:

> A **trailing**-newline anchor (`"  return (\n"`) stops matching on CRLF. A
> **leading**-newline one (`"\n  );"`) keeps matching, because the `\n` of `\r\n`
> is a real `\n`. So a CRLF checkout does not fail cleanly — half the anchors go
> on returning confident, wrong indices. That is how the previous mission
> observed `retStart = -1` next to a plausible `retEnd = 950`.

`loadInstrumented` was hardened to normalise **after** `transform` as well as
before it, closing the one remaining route by which foreign line endings could
reach the instrumentation.

## ENCODING FOLLOW-UP

Encoding was surveyed but deliberately not changed — it is a separate subject
from line endings, and this mission was scoped to the latter.

All 680 tracked text files scanned:

| finding | count |
| --- | --- |
| invalid UTF-8 | **0** |
| mojibake sequences | **0** |
| UTF-8 BOM present | **6** |
| containing non-ASCII (normal: Portuguese text, em dashes) | 260 |

The repository's committed content is clean UTF-8. The mojibake seen in this
project's history was transient, inside the working process, and never reached a
commit — it came from **Windows PowerShell 5.1 reading UTF-8 files as the ANSI
code page**. It recurred once during this mission, when a `.ps1` helper script
containing an em dash failed to parse. It is not a line-ending problem and CRLF
would not fix it.

Two follow-ups, neither actioned here:

1. Six Markdown files carry a UTF-8 BOM: `docs/MEMORY_CIRCUIT_ASSET_SPEC.md`,
   `docs/archive/home-legacy/README.md`, `docs/archive/memory-circuit/README.md`,
   `docs/archive/route-previews/README.md`,
   `public/illustrations/home/README.md`, `public/models/route/README.md`.
   Harmless for Markdown, but inconsistent with the other 674 files. Removing
   them is a one-line change whenever someone wants it; §2 of this mission
   forbade touching BOMs in bulk.
2. Helper scripts written for Windows PowerShell 5.1 should stay ASCII-only, or
   be written for `pwsh`. `working-tree-encoding` was considered and rejected:
   it would not help, because the files are already UTF-8 and the problem is the
   *reader*.

## Files

- `cross-eol-tooling.json` — the §14 regression's evidence.
- `../../LINE_ENDINGS.md` — the operating documentation.
- `../../../.gitattributes` — the policy itself, commented.
