# Parallel work — ClickUp epic 86ey2z15b (player accounts)

Seven subtasks (A–G) run concurrently in separate git worktrees. This file is the
coordination contract: the things that would collide if each branch decided them
independently. **Read this before starting a ticket.**

The shared seams are already committed on `main` (the "contract commit"):

| Seam                        | File                                             | Owner                                      |
| --------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Account/friend/invite types | `shared/types/auth.ts`                           | contract — do not widen locally            |
| Socket events for F + G     | `shared/types/events.ts`                         | contract — already declared                |
| DB schema                   | `server/src/persistence/migrations/0002_auth.ts` | contract — do not add competing migrations |
| Kysely types                | `server/src/persistence/schema.ts`               | contract                                   |
| Server auth API             | `server/src/modules/auth/index.ts`               | A implements, B–G import                   |
| Client auth store           | `client/src/features/auth/index.ts`              | B implements, C/D/F/G import               |

Changing a contract file means every other branch rebases. If a ticket needs a
change there, say so in the ClickUp epic first — don't widen it on your branch.

## Ticket assignments

| Ticket                  | Branch                   | Server port | Client port | Migration      |
| ----------------------- | ------------------------ | ----------- | ----------- | -------------- |
| A — auth foundation     | `feat/auth-a-foundation` | 3001        | 5181        | 0002 (written) |
| B — auth client         | `feat/auth-b-client`     | 3002        | 5182        | —              |
| C — home + invite links | `feat/auth-c-invite`     | 3003        | 5183        | —              |
| D — account settings    | `feat/auth-d-account`    | 3004        | 5184        | —              |
| E — match history       | `feat/auth-e-history`    | 3005        | 5185        | 0003 if needed |
| F — friends             | `feat/auth-f-friends`    | 3006        | 5186        | 0004 if needed |
| G — room invites        | `feat/auth-g-invites`    | 3007        | 5187        | 0005 if needed |

**Migration numbers are reserved, not optional.** Two branches both creating
`0003_*.ts` is a silent ordering corruption. Use the number in your row or none.

## i18n: the highest-collision surface

`client/src/i18n/locales/{en,id}.json` are single files every ticket adds to, and
JSON conflicts are miserable to resolve. Convention:

- Each ticket adds **one top-level key** and nests everything under it:
  `auth` (B), `invite` (C + G), `account` (D), `history` (E), `friends` (F).
- Never reorder or reformat existing keys — an accidental reformat turns an
  additive change into a whole-file conflict.
- Add to **both** `en` and `id` in the same commit.

Server-side codes go in `shared/i18n/messages/*` — one module per source file,
both languages, guarded by a parity test.

## Per-worktree setup

```sh
git worktree add ../tt-a feat/auth-a-foundation
cd ../tt-a
cp ../tuan-tanah/.env .env      # .env is gitignored — it does NOT come along
pnpm install                    # workspace symlinks can't be shared
```

Then set this worktree's ports in its `.env` (`PORT=300N`) and start the client
with `pnpm --filter client dev -- --port 518N`.

### `.env` is NOT auto-loaded in local dev

There is no `dotenv` in the server — `bootstrap/env.ts` reads `process.env`
directly. In production compose supplies the file (`env_file: .env`); locally
nothing does. So copying `.env` into your worktree is **not** enough:

```sh
export $(grep -vE '^#|^$' .env | xargs)   # then pnpm dev / pnpm --filter server migrate
```

Subtask **A** should decide whether to add `dotenv` to the server's dev path and
remove this footgun for everyone. Until then, export explicitly.

Gotchas:

- **Without the env actually exported, accounts are silently disabled** (blank
  Google creds is a supported state, not an error) and you'll spend an hour
  debugging a feature that was never switched on.
- **`DATABASE_URL` must point at local Postgres**, never the VPS. Check before
  running `pnpm --filter server migrate`.
- Redis can be shared across worktrees; room codes are random enough not to clash.

## Before opening a PR

`pnpm check` (typecheck + lint + format) and `pnpm test` if you touched engine
code. Rebase on `main` first — the contract may have moved.
