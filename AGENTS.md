# Repository Guidelines

## Project Structure & Module Organization
This site is a GitHub Pages/Jekyll project. Top-level `index.html` drives the landing page, while reusable blocks live under `_includes/` and page templates under `_layouts/`. Blog posts or updates belong in `_posts/` using standard Jekyll naming (`YYYY-MM-DD-title.md`). Custom Ruby helpers live in `_plugins/` (for example `_tag_gen.rb`). Static assets are organized under `css/`, `js/`, `images/`, `projects/`, and `publications/`. Legacy material is archived in `old_web/`; avoid editing it unless you are migrating content.

## Build, Test, and Development Commands
Ensure Ruby 3.x, Bundler, and Jekyll are installed (`gem install bundler jekyll`). Install dependencies when a `Gemfile` is present (`bundle install`). For local preview, run `bundle exec jekyll serve --livereload`, then visit `http://localhost:4000`. For production checks use `JEKYLL_ENV=production bundle exec jekyll build`, which writes the site to `_site/`. When editing CSS only, `bundle exec jekyll build --incremental` speeds feedback loops.

## Coding Style & Naming Conventions
Follow HTML/Liquid indentation of two spaces and close Liquid tags explicitly. Front matter should include `layout`, `title`, and `permalink` when applicable; keep keys in lower-case snake case. Name assets in `kebab-case` (for example `moviechat.gif`) and group project images inside a folder under `projects/`. Prefer CSS additions in `css/custom.css`; use descriptive class names and keep color constants centralized. Avoid inline styles or importing remote scripts without review.

## Testing Guidelines
Run `bundle exec jekyll build` before every PR to catch build warnings and broken includes. Review the rendered pages locally, checking navigation, hero sections, and asset paths on desktop and mobile breakpoints. For link checking, optionally install `htmlproofer` and run `bundle exec htmlproofer ./_site --check-external-hash`. Document any known regressions or unsupported browsers in the PR.

## Commit & Pull Request Guidelines
Existing history uses terse messages; prefer informative subjects such as `layout: tighten hero spacing`. Each commit should isolate a logical change, especially when modifying `_layouts` or `_plugins`. PRs must summarize the user-facing impact, list key files touched, and note validation steps (`bundle exec jekyll build`). Include before/after screenshots or a live preview link for visual tweaks, and link related GitHub issues when available.
