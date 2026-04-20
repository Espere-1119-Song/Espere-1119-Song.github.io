# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jekyll-based GitHub Pages personal academic portfolio for Enxin (Espere) Song, hosted at `enxinsong.com`. No `_config.yml` or `Gemfile` at root — the site is served directly by GitHub Pages using the top-level `index.html` and Jekyll conventions.

## Commands

```bash
# Install dependencies (when Gemfile present)
bundle install

# Local development with live reload
bundle exec jekyll serve --livereload
# Visit http://localhost:4000

# Production build (outputs to _site/)
JEKYLL_ENV=production bundle exec jekyll build

# Faster incremental build (CSS-only changes)
bundle exec jekyll build --incremental

# Pre-commit validation
bundle exec jekyll build

# Optional link checking
bundle exec htmlproofer ./_site --check-external-hash
```

## Architecture

- `index.html` — main landing page (single-page layout)
- `_includes/` — reusable Liquid/HTML partials (nav, footer, analytics)
- `_layouts/` — page templates (base, default, page, post, minimal, etc.)
- `_plugins/_tag_gen.rb` — custom Ruby plugin for tag generation
- `_posts/` — blog posts in `YYYY-MM-DD-title.md` format
- `css/custom.css` — primary place for CSS additions; keep color constants here
- `projects/` — project showcase folders (e.g., `projects/FOCAREUS/`)
- `publications/` — publication media assets
- `old_web/` — archived previous site; avoid editing unless migrating content

## Coding Conventions

- HTML/Liquid: 2-space indentation, explicitly close Liquid tags
- Front matter: include `layout`, `title`, `permalink`; keys in `lower_snake_case`
- Assets: `kebab-case` filenames; group project images in a subfolder under `projects/`
- CSS: add to `css/custom.css`; avoid inline styles or unreviewed remote scripts

## Commit Style

Informative subjects scoped to the change area, e.g. `layout: tighten hero spacing`. Each commit should isolate a logical change, especially for `_layouts/` or `_plugins/` edits. Visual changes should include before/after screenshots.
