# Bear stage pictures

One master picture per stage (`<name>_oski.png`: baby, small, young, growing, strong, big,
huge, massive, legendary, max) plus four press frames per bear, all made in ChatGPT and
kept here as the originals. `python3 assets/source/make_bears.py` shrinks them into
`assets/bears/` and writes `src/config/bearImages.ts` (a stage animates only when all four
frames exist; otherwise it uses the squash fallback).

| File | Bar position |
| --- | --- |
| `<name>_oski.png` | lockout (the master) |
| `<name>_oski_mid.png` | across the forehead, just below the cap brim |
| `<name>_oski_eyes.png` | across the eyes |
| `<name>_oski_nose.png` | across the nose and mouth |
| `<name>_oski_bottom.png` | at the collarbone, under the chin |

Baby Oski is done. Lessons from making it:
- Describe bar heights by body landmarks, not pixels. The model can't hit coordinates, and
  landmarks scale to each bear's size.
- Edit the master every time, one image at a time. Editing its own previous output makes the
  bear grow a little each time.
- Check each frame for a stretched body or head (a longer torso or legs than the master).
  Small drift in size or colour is fine.
- Spacing doesn't need to be perfect: the animation is timed to the bar's measured height in
  each frame.

## Prompt (used per bear, swap the name)

```
Now small oski. Use my uploaded small_oski.png as the master and edit that original directly for every image, never your previous images. Do not redraw or restyle it. Keep the same 4:3 canvas, the same bear (face, cap with CAL, fur, body size, muscles, feet, legs), the same grass, trees, and sky, and the same barbell (same plates, same size, same colors). The bear's height must match the original exactly. Do not lengthen his legs or stretch his body or head, and keep his feet in exactly the same position. Only change the arms and the barbell position. Give me one image at a time, 4 images total.

first: the bottom of a shoulder press: the barbell rests across the front of his shoulders at the collarbone, just under his chin, elbows bent about 90 degrees, pointing down and slightly forward and out, forearms vertical, wrists straight, hands gripping the bar just outside shoulder width with knuckles facing up. Plates are lower too and stay level. Arms and shoulders look flexed and loaded in the same cartoon muscle style as the original.

second: the barbell is across his nose and mouth, covering the lower half of his face with his eyes visible just above the bar. Elbows bent about 100 degrees, pointing down and slightly forward and out.

third: the barbell is across his eyes, covering the middle of his eyes, with his forehead and cap visible above the bar and his nose and mouth visible below it. Elbows bent about 105 degrees, pointing down and slightly forward and out.

fourth: the barbell is across his forehead, just below the front brim of his cap, so the cap sits above the bar. Elbows bent about 110 degrees, pointing out to the sides.

Output the same size and framing as the original, with the same flat cartoon style, thick black outlines, and colors.
```

Files come back in the order bottom, nose, eyes, mid.
