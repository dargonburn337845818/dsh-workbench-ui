# dsh-workbench-ui

> A DSH plugin that brings `wb`-managed research projects to the browser: project status, gates, evidence, memory, and todos in one panel.

[中文](README.md) | **English**

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-blue.svg)](LICENSE)

## Introduction

dsh-workbench-ui is a research workbench plugin for DSH (DeepSeek Harness). It reads project ledgers under `research-workbench/projects/` and shows them in a web panel beside the DSH conversation, so you can inspect a project, record a gate, add a memory, or update a todo without switching to the terminal.

Project data stays on your machine by default. The plugin provides a web interface on top of the existing `wb` workflow; it does not replace the underlying project management model.

## Features

- **Project overview**: list local research projects with current stage, passed gates, claims, decisions, conflicts, and last update time.
- **Project detail**: view stages, gates, decisions, conflicts, todos, memories, and files under `evidence/`, `notes/`, and `artifacts/`.
- **Project actions**: create projects, delete projects (with confirmation), edit goals and non-goals, add memories and todos.
- **Gates and claims**: record a gate (stage + acceptance item + evidence), record a sourced claim.
- **Paper search**: search OpenAlex, Crossref, Semantic Scholar, Europe PMC, and Unpaywall, with OA/PDF links where available.
- **PDF deep reading**: choose a local PDF, store it in `evidence/`, render pages to PNG, and extract figures, formulas, and tables into Markdown.
- **Citation graph**: enter a DOI or title, generate an OpenAlex citation/co-citation graph into `artifacts/`, with an interactive SVG viewer and PNG/JSON export.
- **AI context**: generate a complete project continuation context for an AI or the next session.
- **Semantic memory search**: use local sentence-transformers embeddings when cached; fall back to TF-IDF otherwise.
- **File preview**: preview text artifacts directly in the panel.
- **Guided research**: the panel suggests the next action based on the project state.

## Installation

Make sure no dsh web agent is running, then:

```bash
dsh plugin --profile web add $HOME/work/dsh-workbench-ui
```

After installation, refresh the page and restart dsh web. The "Research" panel appears beside the conversation.

Build locally without a DSH checkout:

```bash
bash scripts/build-local.sh
```

Equivalent manual commands:

```bash
./node_modules/.bin/tsc -p tsconfig.json
./node_modules/.bin/tsdown
```

Outputs:

```text
lib/index.js    # host: /@dsh-external/dsh-workbench-ui/api
lib/client.js   # client: conversation.view panel
```

## Dependencies and Configuration

The panel backend calls:

```text
$HOME/work/skills/expert-decision-consensus/tools/workbench_cli.py
```

Project data defaults to:

```text
$HOME/work/research-workbench/projects/
```

Override the paths with environment variables:

```bash
export WB_SCRIPT=/path/to/workbench_cli.py
export WB_PROJECTS_DIR=/path/to/projects
```

Unpaywall requires a real email:

```bash
export UNPAYWALL_EMAIL=you@example.com
```

Semantic memory search defaults to a multilingual embedding model (`paraphrase-multilingual-MiniLM-L12-v2`), downloaded from the HF mirror:

```bash
python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# Optional: use another model
export WB_EMBED_MODEL=your-model-name

# Optional: disable auto-download and fall back to TF-IDF
export WB_EMBED_DOWNLOAD=0
```

## Development and Verification

```bash
npm run typecheck
npm run build:client
bash scripts/build-local.sh
node tests/api-smoke.mjs
```

After source changes, rebuild `lib/` so a clone can install the plugin directly.

## Privacy and Security

- Project and personal data stay in the local workspace and are not committed.
- Paper search calls third-party public APIs; provide API keys through environment variables, not the repository.
- Do not include personal paths, secrets, or real account information in public issues or pull requests.

## Contributing

Issues and pull requests are welcome. Run the verification commands above and describe the change and verification results in the PR.

## License

[BSD-3-Clause](LICENSE)
