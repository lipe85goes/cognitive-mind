# Line endings

The policy lives in `.gitattributes` at the repository root. This page says why
it is what it is, and what to do when you add a new kind of file.

## The policy

```
* text=auto eol=lf

*.png   binary
*.webp  binary
*.ico   binary
*.glb   binary

*.bat   text eol=crlf
*.cmd   text eol=crlf
```

Every text file is **LF in the index and LF in your working copy**, on every
machine. Binaries are never inspected for text and never converted. Windows
batch files are the one deliberate exception.

## Why it was needed

`core.autocrlf` is not a project setting. On this repository it arrives from
Git for Windows' **system** config — `C:\Program Files\Git\etc\gitconfig` — where
the installer writes `core.autocrlf=true`. Nobody chose it per-project, and it is
absent on a typical macOS or Linux install. So the same commit produced CRLF
working files on one machine and LF on another, and which one you got depended
on your installer rather than on the project.

That cost real time twice:

- Validation tooling that reads production source anchors on newline-shaped
  literals. On a CRLF checkout those stop matching, and `final-acceptance` could
  not run at all. Worse, it failed *silently* in part: a trailing-newline anchor
  like `"  return (\n"` breaks on CRLF, while a leading-newline one like
  `"\n  );"` keeps matching, so half the anchors returned confident, wrong
  answers.
- Validators write their evidence in LF. Over a CRLF checkout that marked files
  as modified on every run with no content change at all, which is what made a
  passing check leave a dirty worktree.

Both are fixed at their own level as well — the tooling normalises at its seam,
and the checks no longer write — but the underlying cause was that the
repository had no opinion. Now it does.

## How `core.autocrlf` interacts with this

It no longer participates for any governed file. `.gitattributes` wins over
`core.autocrlf`, so a clone is identical whether the setting is `true`, `false`
or `input` — this is tested, see
`docs/archive/mindflow-repository-eol-policy-05/`.

You do **not** need to change your Git configuration, and you should not need to
think about it again.

## Adding a new file type

Usually: do nothing. `text=auto` lets Git decide by content, and it gets text
formats right.

Add an explicit rule when:

- **It is binary and matters.** Declare `binary` rather than relying on the
  heuristic — a file whose header happens to look textual would otherwise be at
  risk of conversion. Follow the existing `*.png binary` lines.
- **It genuinely needs CRLF.** `.bat` and `.cmd` do: `cmd.exe` can mis-execute a
  batch file with LF-only endings. Nothing else in this repository does.
  `.ps1` does **not** — PowerShell reads LF scripts correctly.

Keep the file short. A rule per real need, not a rule per extension that exists
somewhere in the world.

## Encoding is a separate subject

Line endings are which bytes end a line. Encoding is which bytes represent a
character. They are unrelated, and this policy governs only the first.

This repository is UTF-8 without BOM, and that is not changed here. If you hit
mojibake — `—` arriving as `â€"` — it is an encoding problem in whatever read or
wrote the file, not a line-ending one, and CRLF will not fix it. The known case
is Windows PowerShell 5.1, which reads UTF-8 files as the ANSI code page unless
told otherwise; see the ENCODING FOLLOW-UP section in
`docs/archive/mindflow-repository-eol-policy-05/README.md`.
