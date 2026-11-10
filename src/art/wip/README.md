Work-in-progress sprite files (`*.ts` exporting `sprites` / `fonts`) live here while
they are being drawn. They are **not** loaded by the game, only by the preview tool:

    npm run sprites -- --wip --filter my_id --scale 6 --out shots/x.png

When a file is finished and validates cleanly, `git mv`/`mv` it into
`src/art/sprites/` where it is auto-registered.
