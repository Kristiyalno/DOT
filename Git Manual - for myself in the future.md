# Git Basics

## What Git Does

Git tracks changes to your files over time. Your project lives in two places:

- **Local** — your computer
- **Remote** — GitHub (or similar)

They're separate. Nothing syncs automatically. You push to send your changes up, you pull to bring changes down.

---

## First Time Setup (one repo, one time)

```bash
git init                                      # turn the folder into a git repo
git remote add origin https://github.com/you/repo.git  # link it to GitHub
git branch -M main                            # name the branch "main"
git add -A                                    # stage everything
git commit -m "first commit"
git push --set-upstream origin main           # first push, sets the link
```

After this, future pushes are just `git push`.

---

## The Normal Workflow

```bash
git add -A          # stage all changes (modified, new, deleted)
git commit -m "what you changed"
git push            # send to GitHub
```

That's it 90% of the time.

---

## Common Commands

| Command | What it does |
|---|---|
| `git status` | shows what's changed and what's staged |
| `git add -A` | stage everything |
| `git add filename` | stage one specific file |
| `git commit -m "message"` | save a snapshot with a label |
| `git push` | upload commits to GitHub |
| `git pull` | download changes from GitHub |
| `git log --oneline` | see commit history, one line each |
| `git diff` | see exactly what changed line by line |

---

## Does Pushing Delete Files on GitHub?

**Yes, if you deleted them locally.** `git add -A` stages deletions too. So if you deleted a file on your PC, committed, and pushed — it's gone on GitHub as well.

If you only want to push without deleting anything, use `git add .` only on specific files instead of `-A`. But in practice, if your local folder is the source of truth, this behavior is what you want.

---

## Force Push

Used when GitHub has commits you don't have locally and you want to overwrite it completely with your version:

```bash
git push --force
```

This **destroys** whatever was on GitHub and replaces it with yours. Fine for personal projects. Never do it on a shared repo without telling people.

---

## Pulling (Getting Changes from GitHub)

If you edited something on GitHub directly, or on another computer:

```bash
git pull
```

If there are conflicts (same file changed in two places), Git will tell you and mark the conflicting lines inside the file. You fix them manually, then `git add -A` and `git commit`.

---

## Cloning (Starting from an Existing Repo)

If you want to download a repo to a new computer:

```bash
git clone https://github.com/you/repo.git
```

This creates a folder with everything in it, already linked to GitHub. No need for `git init` or `git remote add`.

---

## Branches (Optional but Useful)

Branches let you work on something without touching the main version.

```bash
git checkout -b feature-name    # create and switch to a new branch
git checkout main               # switch back to main
git merge feature-name          # merge the branch into main
```

For a solo project you probably don't need this.

---

## .gitignore

A file called `.gitignore` in your project root tells Git what to ignore. Useful for things like `node_modules/` which you never want to upload.

Example `.gitignore`:
```
node_modules/
dist/
.env
```

---

## Quick Reference Card

```
Made changes → git add -A → git commit -m "msg" → git push
Want latest from GitHub → git pull
Overwrite GitHub with yours → git push --force
Download a repo → git clone <url>
See what's changed → git status
```