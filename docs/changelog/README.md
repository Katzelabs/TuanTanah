# docs/changelog — engineering notes

Write-ups **for us**: what changed under the hood, which constants moved, which tables were added,
and the ClickUp task it came from. Long-form, technical, and written after a substantial piece of
work — not once per release.

**This is not the changelog players read.** That one lives in
[`shared/data/changelog.ts`](../../shared/data/changelog.ts), is rendered at `/changelog`, is written
in player language in both English and Indonesian, and gets an entry for **every** release. See the
"Changelog" and "Cutting a release" sections in the root [README](../../README.md).

Rule of thumb: if a line only makes sense to someone who has read the diff, it belongs here. If it
describes something a player would notice while playing, it belongs in `shared/data/changelog.ts`.
