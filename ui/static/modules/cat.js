/**
 * ============================================================
 *  AutoResearch — Catode32 Cat Sprite Module
 * ============================================================
 *
 *  Original sprites from https://github.com/moonbench/catode32
 *  sitting.forward pose with animated blink and tail wag.
 *
 *  RENDERING:
 *   - 1bpp bytearrays decoded to boolean pixel grids
 *   - Two-tone: fill color (body interior) + outline color (edges)
 *   - Parts composited: tail → body → head → eyes (z-order)
 *
 *  USAGE:
 *   CatModule.start(canvasEl, 'working')   → begin animation
 *   CatModule.stop()                       → stop + cleanup
 *   CatModule.setExpression('happy')       → change face
 *   CatModule.getSpeech()                  → current speech message
 * ============================================================
 */

;(function () {
    'use strict';

    // ================================================================
    //  1BPP DECODER
    //  Each byte: MSB = leftmost pixel, 1 = filled, 0 = empty
    //  Row stride = ceil(width / 8)
    // ================================================================

    function decode(data, width, height) {
        const stride = Math.ceil(width / 8);
        const grid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                const byteIdx = y * stride + Math.floor(x / 8);
                const bitIdx = 7 - (x % 8);
                row.push(byteIdx < data.length && (data[byteIdx] & (1 << bitIdx)) ? 1 : 0);
            }
            grid.push(row);
        }
        return grid;
    }

    // ================================================================
    //  SPRITE DATA (from catode32/src/assets/character.py)
    // ================================================================

    // Head — straight forward, neutral (25×24)
    const HEAD = {
        w: 25, h: 24,
        outline: decode([
            0x40,0x00,0x01,0x00, 0xa0,0x00,0x02,0x80, 0x90,0x00,0x04,0x80,
            0x88,0x00,0x08,0x80, 0xa4,0x00,0x12,0x80, 0xa2,0x00,0x22,0x80,
            0x91,0xff,0xc4,0x80, 0x90,0x00,0x04,0x80, 0x88,0x00,0x08,0x80,
            0x88,0x00,0x08,0x80, 0xb0,0x00,0x06,0x80, 0x80,0x00,0x00,0x80,
            0x80,0x00,0x00,0x80, 0x80,0x00,0x00,0x80, 0x80,0x00,0x00,0x80,
            0x80,0x00,0x00,0x80, 0x40,0x00,0x01,0x00, 0x40,0x00,0x01,0x00,
            0x40,0x00,0x01,0x00, 0x40,0x00,0x01,0x00, 0xe0,0x00,0x03,0x80,
            0x10,0x00,0x04,0x00, 0x78,0x00,0x0f,0x00, 0x06,0x00,0x30,0x00
        ], 25, 24),
        fill: decode([
            0x40,0x00,0x01,0x00, 0xe0,0x00,0x03,0x80, 0xf0,0x00,0x07,0x80,
            0xf8,0x00,0x0f,0x80, 0xfc,0x00,0x1f,0x80, 0xfe,0x00,0x3f,0x80,
            0xff,0xff,0xff,0x80, 0xff,0xff,0xff,0x80, 0xff,0xff,0xff,0x80,
            0xff,0xff,0xff,0x80, 0xff,0xff,0xff,0x80, 0xff,0xff,0xff,0x80,
            0xff,0xff,0xff,0x80, 0xff,0xff,0xff,0x80, 0xff,0xff,0xff,0x80,
            0x7f,0xff,0xff,0x00, 0x7f,0xff,0xff,0x00, 0x7f,0xff,0xff,0x00,
            0x7f,0xff,0xff,0x00, 0xff,0xff,0xff,0x80, 0x1f,0xff,0xfc,0x00,
            0x7f,0xff,0xff,0x00, 0x07,0xff,0xf0,0x00
        ], 25, 24)
    };

    // Body — straight forward, sitting (17×18)
    const BODY = {
        w: 17, h: 18,
        outline: decode([
            0x04,0x10,0x00, 0x08,0x08,0x00, 0x10,0x04,0x00, 0x10,0x04,0x00,
            0x20,0x02,0x00, 0x20,0x02,0x00, 0x40,0x01,0x00, 0x40,0x01,0x00,
            0x40,0x01,0x00, 0x40,0x00,0x00, 0x80,0x00,0x00, 0x80,0x00,0x00,
            0x80,0x00,0x00, 0x80,0x00,0x80, 0x80,0x00,0x80, 0x60,0x03,0x00,
            0x10,0x84,0x00, 0x0f,0x78,0x00
        ], 17, 18),
        fill: decode([
            0x07,0xf0,0x00, 0x0f,0xf8,0x00, 0x1f,0xfc,0x00, 0x1f,0xfc,0x00,
            0x3f,0xfe,0x00, 0x3f,0xfe,0x00, 0x7f,0xff,0x00, 0x7f,0xff,0x00,
            0x7f,0xff,0x00, 0x7f,0xff,0x00, 0xff,0xff,0x80, 0xff,0xff,0x80,
            0xff,0xff,0x80, 0xff,0xff,0x80, 0xff,0xff,0x80, 0x7f,0xff,0x00,
            0x1f,0xfc,0x00, 0x0f,0x78,0x00
        ], 17, 18)
    };

    // Eyes — front, neutral with blink (17×4, 6 frames)
    const EYES_NEUTRAL = [
        decode([0x60,0x03,0x00, 0xe8,0x0b,0x80, 0xe4,0x19,0x80, 0x38,0x0e,0x00], 17, 4),
        decode([0x00,0x00,0x00, 0xe8,0x0b,0x80, 0xe4,0x19,0x80, 0x38,0x0e,0x00], 17, 4),
        decode([0x00,0x00,0x00, 0x00,0x00,0x00, 0xec,0x1b,0x80, 0x38,0x0e,0x00], 17, 4),
        decode([0x00,0x00,0x00, 0x00,0x00,0x00, 0x00,0x00,0x00, 0xfc,0x1f,0x80], 17, 4),
        decode([0x00,0x00,0x00, 0x00,0x00,0x00, 0xec,0x1b,0x80, 0x38,0x0e,0x00], 17, 4),
        decode([0x00,0x00,0x00, 0xe8,0x0b,0x80, 0xe4,0x19,0x80, 0x38,0x0e,0x00], 17, 4),
    ];

    // Eyes — front, happy (15×2, 1 frame)
    const EYES_HAPPY = [
        decode([0x78,0x3c,0x84,0x42], 15, 2)
    ];

    // Eyes — front, sleepy/content (17×3, 4 frames)
    const EYES_SLEEPY = [
        decode([0x4c,0x13,0x00, 0xc4,0x11,0x80, 0x38,0x0e,0x00], 17, 3),
        decode([0x00,0x00,0x00, 0xcc,0x13,0x80, 0x38,0x0e,0x00], 17, 3),
        decode([0x00,0x00,0x00, 0x00,0x00,0x00, 0xfc,0x1f,0x80], 17, 3),
        decode([0x00,0x00,0x00, 0xcc,0x13,0x80, 0x38,0x0e,0x00], 17, 3),
    ];

    // Eyes — surprised: wider open, round, no blink (17×4, 1 frame)
    // .##..........##.  brow
    // .####......####.  wide open
    // .####......####.  wide open
    // ..####....####..  wide bottom
    const EYES_SURPRISED = [
        decode([0x60,0x03,0x00, 0x78,0x0F,0x00, 0x78,0x0F,0x00, 0x3C,0x0F,0x00], 17, 4),
    ];

    // Eyes — angry: narrow with furrowed V-brows (17×4, 1 frame)
    // .##.#........###.  V-brows (inner pixels angled)
    // .###......###.    narrow top
    // ..##........##..  narrow mid
    // ..##........##..  narrow bottom
    const EYES_ANGRY = [
        decode([0x68,0x0E,0x00, 0x70,0x0E,0x00, 0x30,0x06,0x00, 0x30,0x06,0x00], 17, 4),
    ];

    // Eyes — thinking: asymmetric (left open+pupil right-shifted, right half-closed) (17×4, 1 frame)
    // .##..........##.  brows
    // .###..#.....##..  left open+pupil, right half
    // .###.......##...  left open, right narrow
    // ..###......##...  bottom
    const EYES_THINKING = [
        decode([0x60,0x03,0x00, 0x64,0x06,0x00, 0x70,0x18,0x00, 0x38,0x18,0x00], 17, 4),
    ];

    // Tail — neutral wagging (15×21, 16 frames)
    const TAIL_OUTLINES = [
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00, 0x78,0x00, 0x86,0x00, 0x71,0x00, 0x08,0x80, 0x04,0x40, 0x02,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x06,0x20, 0x38,0x40, 0x00,0x80, 0x01,0x00, 0x06,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00, 0x3c,0x00, 0x43,0x00, 0x38,0x80, 0x04,0x40, 0x02,0x20, 0x01,0x10, 0x00,0x90, 0x00,0x90, 0x00,0x90, 0x01,0x20, 0x06,0x20, 0x38,0x40, 0x00,0x80, 0x01,0x00, 0x06,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00, 0x1e,0x00, 0x21,0x80, 0x1c,0x40, 0x02,0x20, 0x01,0x10, 0x00,0x88, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x90, 0x07,0x10, 0x38,0x20, 0x00,0x40, 0x01,0x80, 0x06,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00, 0x07,0x00, 0x08,0xc0, 0x06,0x20, 0x01,0x10, 0x00,0x88, 0x00,0x44, 0x00,0x24, 0x00,0x24, 0x00,0x44, 0x00,0x88, 0x07,0x10, 0x38,0x20, 0x00,0x40, 0x01,0x80, 0x06,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00, 0x01,0xc0, 0x02,0x20, 0x01,0x10, 0x00,0x88, 0x00,0x44, 0x00,0x24, 0x00,0x24, 0x00,0x24, 0x00,0x44, 0x00,0x88, 0x07,0x10, 0x38,0x20, 0x00,0x40, 0x01,0x80, 0x06,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0xc0, 0x01,0x20, 0x00,0x90, 0x00,0x90, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x88, 0x07,0x10, 0x38,0x20, 0x00,0x40, 0x01,0x80, 0x06,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x40, 0x00,0xa0, 0x00,0xa0, 0x00,0xa0, 0x00,0x90, 0x00,0x90, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x88, 0x00,0x90, 0x07,0x10, 0x38,0x20, 0x00,0x40, 0x01,0x80, 0x06,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x10, 0x00,0x28, 0x00,0x28, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x88, 0x00,0x88, 0x01,0x10, 0x06,0x10, 0x38,0x20, 0x00,0x40, 0x01,0x80, 0x06,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x18, 0x00,0x24, 0x00,0x28, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x48, 0x00,0x50, 0x00,0x90, 0x00,0x90, 0x00,0x90, 0x01,0x10, 0x02,0x10, 0x04,0x20, 0x38,0x40, 0x00,0x80, 0x01,0x00, 0x06,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00, 0x00,0x1c, 0x00,0x22, 0x00,0x44, 0x00,0x48, 0x00,0x90, 0x00,0x90, 0x00,0x90, 0x00,0x90, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x02,0x20, 0x04,0x20, 0x38,0x40, 0x00,0x80, 0x01,0x00, 0x06,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00, 0x00,0x38, 0x00,0x44, 0x00,0x88, 0x00,0x90, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x02,0x20, 0x02,0x40, 0x02,0x40, 0x04,0x40, 0x38,0x80, 0x01,0x00, 0x02,0x00, 0x04,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00, 0x00,0x38, 0x00,0x44, 0x00,0x88, 0x01,0x10, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x02,0x20, 0x02,0x40, 0x02,0x40, 0x04,0x40, 0x38,0x80, 0x01,0x00, 0x02,0x00, 0x04,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x10, 0x00,0x68, 0x00,0x88, 0x01,0x10, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x02,0x20, 0x02,0x20, 0x02,0x40, 0x02,0x40, 0x04,0x40, 0x38,0x80, 0x01,0x00, 0x02,0x00, 0x04,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x40, 0x00,0xa0, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x02,0x40, 0x02,0x40, 0x02,0x40, 0x02,0x40, 0x04,0x80, 0x38,0x80, 0x01,0x00, 0x02,0x00, 0x04,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00, 0x0e,0x00, 0x11,0x00, 0x08,0x80, 0x04,0x40, 0x04,0x40, 0x02,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x02,0x20, 0x02,0x40, 0x04,0x40, 0x38,0x80, 0x01,0x00, 0x02,0x00, 0x04,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00, 0x00,0x00, 0x00,0x00, 0x00,0x00, 0x3c,0x00, 0x42,0x00, 0x31,0x00, 0x08,0x80, 0x04,0x40, 0x02,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x01,0x20, 0x06,0x20, 0x38,0x40, 0x00,0x80, 0x01,0x00, 0x06,0x00, 0x38,0x00], 15, 21),
    ];

    // Tail fill — neutral wagging (15×21, 16 frames, one per outline frame)
    const TAIL_FILLS = [
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00, 0x78,0x00, 0xfe,0x00, 0x7f,0x00, 0x0f,0x80, 0x07,0xc0, 0x03,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x07,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3f,0x00, 0x3e,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00, 0x3c,0x00, 0x7f,0x00, 0x3f,0x80, 0x07,0xc0, 0x03,0xe0, 0x01,0xf0, 0x00,0xf0, 0x00,0xf0, 0x00,0xf0, 0x01,0xe0, 0x07,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3f,0x00, 0x3e,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00, 0x1e,0x00, 0x3f,0x80, 0x1f,0xc0, 0x03,0xe0, 0x01,0xf0, 0x00,0xf8, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0xf0, 0x07,0xf0, 0x3f,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3e,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00, 0x07,0x00, 0x0f,0xc0, 0x07,0xe0, 0x01,0xf0, 0x00,0xf8, 0x00,0x7c, 0x00,0x3c, 0x00,0x3c, 0x00,0x7c, 0x00,0xf8, 0x07,0xf0, 0x3f,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3e,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00, 0x01,0xc0, 0x03,0xe0, 0x01,0xf0, 0x00,0xf8, 0x00,0x7c, 0x00,0x3c, 0x00,0x3c, 0x00,0x3c, 0x00,0x7c, 0x00,0xf8, 0x07,0xf0, 0x3f,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3e,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0xc0, 0x01,0xe0, 0x00,0xf0, 0x00,0xf0, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0xf8, 0x07,0xf0, 0x3f,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3e,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x40, 0x00,0xe0, 0x00,0xe0, 0x00,0xe0, 0x00,0xf0, 0x00,0xf0, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0xf8, 0x00,0xf0, 0x07,0xf0, 0x3f,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3e,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x10, 0x00,0x38, 0x00,0x38, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0xf8, 0x01,0xf0, 0x07,0xf0, 0x3f,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3e,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x18, 0x00,0x3c, 0x00,0x38, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x78, 0x00,0x70, 0x00,0xf0, 0x00,0xf0, 0x00,0xf0, 0x01,0xf0, 0x03,0xf0, 0x07,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3f,0x00, 0x3e,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00, 0x00,0x1c, 0x00,0x3e, 0x00,0x7c, 0x00,0x78, 0x00,0xf0, 0x00,0xf0, 0x00,0xf0, 0x00,0xf0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x03,0xe0, 0x07,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3f,0x00, 0x3e,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x38, 0x00,0x7c, 0x00,0xf8, 0x00,0xf0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x03,0xe0, 0x03,0xc0, 0x03,0xc0, 0x07,0xc0, 0x3f,0x80, 0x3f,0x00, 0x3e,0x00, 0x3c,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x38, 0x00,0x7c, 0x00,0xf8, 0x01,0xf0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x03,0xe0, 0x03,0xc0, 0x03,0xc0, 0x07,0xc0, 0x3f,0x80, 0x3f,0x00, 0x3e,0x00, 0x3c,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00,0x00,0x00, 0x00,0x10, 0x00,0x78, 0x00,0xf8, 0x01,0xf0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x03,0xe0, 0x03,0xe0, 0x03,0xc0, 0x03,0xc0, 0x07,0xc0, 0x3f,0x80, 0x3f,0x00, 0x3e,0x00, 0x3c,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x40, 0x00,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x02,0x40, 0x02,0x40, 0x02,0x40, 0x02,0x40, 0x04,0x80, 0x38,0x80, 0x01,0x00, 0x02,0x00, 0x04,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00, 0x0e,0x00, 0x1f,0x00, 0x0f,0x80, 0x07,0xc0, 0x07,0xc0, 0x03,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x03,0xe0, 0x03,0xc0, 0x07,0xc0, 0x3f,0x80, 0x3f,0x00, 0x3e,0x00, 0x3c,0x00, 0x38,0x00], 15, 21),
        decode([0x00,0x00, 0x00,0x00, 0x00,0x00,0x00,0x00, 0x3c,0x00, 0x7e,0x00, 0x3f,0x00, 0x0f,0x80, 0x07,0xc0, 0x03,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x01,0xe0, 0x07,0xe0, 0x3f,0xc0, 0x3f,0x80, 0x3f,0x00, 0x3e,0x00, 0x38,0x00], 15, 21),
    ];

    // ================================================================
    //  LAYOUT — positions derived from catode32 anchors
    //
    //  Body (17×18) anchor (9,18) → sprite (0,0) at game (0,0)
    //  Head (25×24) anchor (13,23) placed at body+head_offset (18,18) → sprite (0,0) at game (5,-5)
    //  Tail (15×21) anchor (3,18) placed at body+tail_offset (25,29) → sprite (0,0) at game (22,11)
    //  Eyes neutral (17×4) anchor (8,2) at head (12,17) → game (9,10)
    //  Eyes happy (15×2) anchor (7,2) at head (12,17) → game (10,10)
    //  Eyes sleepy (17×3) anchor (8,1) at head (12,17) → game (9,11)
    //
    //  Bounding box: x[0..36] y[-5..31] → offset (+0,+5) → canvas 37×37
    // ================================================================

    const OX = 8, OY = 17;
    const HEAD_POS = { x: 5 + OX, y: -5 + OY };
    const BODY_POS = { x: 0 + OX, y: 0 + OY };
    const TAIL_POS = { x: -8 + OX, y: -15 + OY };

    // Eye positions depend on expression (different anchor/size)
    // color: per-expression eye color (null = default white)
    // blinkSpeed: tick interval for blink animation (0 = no blink)
    const EYE_CFG = {
        neutral:   { frames: EYES_NEUTRAL,   x: 9 + OX,  y: 10 + OY, color: null,      blinkSpeed: 8 },
        happy:     { frames: EYES_HAPPY,     x: 10 + OX, y: 10 + OY, color: null,      blinkSpeed: 0 },
        sleepy:    { frames: EYES_SLEEPY,    x: 9 + OX,  y: 11 + OY, color: null,      blinkSpeed: 8 },
        surprised: { frames: EYES_SURPRISED, x: 9 + OX,  y: 10 + OY, color: '#ffff00', blinkSpeed: 0 },
        angry:     { frames: EYES_ANGRY,     x: 9 + OX,  y: 11 + OY, color: '#ff3355', blinkSpeed: 0 },
        thinking:  { frames: EYES_THINKING,  x: 9 + OX,  y: 10 + OY, color: '#88aaff', blinkSpeed: 0 },
    };

    // Paw sprite for wave animation (3×4)
    const PAW_OUTLINE = decode([0x07, 0x05, 0x07], 3, 4);
    const PAW_FILL = decode([0x07, 0x07, 0x07], 3, 4);

    const CW = 45, CH = 37;

    // ================================================================
    //  SPEECH MESSAGES
    // ================================================================

    const SPEECH = {
        working: [
            'Мяу... *фокус*',
            '> компилирую_',
            'Мурр... взламываю...',
            'Мяу?! ...мяу!',
            '*прыткий взгляд*',
            'Доступ к мейнфрейму_',
            'Подбираю пароли...',
            'Анализирую код...',
            '*концентрация*',
        ],
        success: [
            'Мурр! =^._.^=',
            '*счастливый хвост*',
            'Миссия выполнена!',
            'Цель нейтрализована. =^.^=',
            'Ещё один в мешке!',
            'Победа! =^_^=',
        ],
        error: [
            'Мяу?! o_o',
            '*шипение*',
            'Не лучшая моя работа...',
            'Ошибка 404: мотивация не найдена.',
            '*недовольное мурчание*',
        ],
        idle: [
            '*тихо сидит*',
            '...мурр...',
            '=^.^=',
            '*хвост машет*',
            'Жду приказов...',
            '*зевает*',
            'Мяу~',
        ],
        surprised: [
            'МЯУ?! O_O',
            'Ого!',
            '*уши встали торчком*',
            'Ничего себе!',
            '*шерсть дыбом*',
        ],
        angry: [
            '*шипение* >:(',
            'Мррр...',
            '*когти выпущены*',
            '*не довольный взгляд*',
            'Плохой код. Очень плохой.',
        ],
        thinking: [
            '*размышляет*...',
            'Хмм...',
            'Мур... мурр...',
            '*покусывает губы*',
            'Нужно подумать...',
        ],
        tip: [
            'Попробуй улучшить prompt...',
            'Не забудь проверить changelog_',
            'Качество > количество, мяу!',
            'Посмотри последний эксперимент...',
            'Настрой фокус-области в CONFIG_',
            'Запусти эксперимент чтобы я заработал!',
            'Изучи тренд на DASHBOARD_',
            'Чем выше score, тем лучше_',
            'DISCARD — не конец, а опыт!',
            'Каждый KEEP = эволюция проекта.',
        ],
    };

    // Chat context-aware skill tips (keyword → tips)
    const CHAT_SKILL_TIPS = {
        commit: [
            'Попробуй /commit для автокоммита! =^_^=',
            'Нужен коммит? /commit поможет! Мяу!',
            '/commit — я знаю хороший скилл для этого_',
        ],
        git: [
            'Git-операции? /commit создаст коммит автоматически!',
            'Мурр... /commit упростит работу с git_',
        ],
        refactor: [
            'Рефакторинг? /simplify проверит качество кода!',
            '/simplify — ревью кода на эффективность! Мяу!',
            'Попробуй /simplify перед рефакторингом_',
        ],
        code: [
            'Писашь код? /code-reviewer сделает полный обзор!',
            '/simplify проверит код на проблемы_',
            'Мурр... /code-reviewer найдёт проблемы!',
        ],
        spec: [
            'Нужна спецификация? /speckit.specify поможет!',
            '/speckit.features — быстрая генерация фичи!',
            'Spec Kit: /speckit.plan для плана реализации!',
        ],
        test: [
            'Тестируешь? /code-reviewer проверит код_',
            '*уши насторожились* Качество кода важно!',
        ],
        bug: [
            'Баг? Опиши его агенту — он поможет! Мяу!',
            '/simplify может найти корень проблемы_',
            '*концентрируется* Расскажи подробнее о баге...',
        ],
        deploy: [
            'Деплой? /push автоматизирует релиз!',
            '/push — релиз одной командой! Мяу!',
        ],
        improve: [
            'Улучшения? /simplify проверит что можно лучше!',
            '/code-reviewer для комплексного анализа_',
        ],
    };

    // Agent response content type tips
    const AGENT_RESPONSE_TIPS = {
        code_block: [
            'Ого, код! *внимательно смотрит* =^.^=',
            'Красивый код! *одобряет*',
            '*изучает код* Мурр...',
            'Код принят! =^._.^=',
        ],
        tool_call: [
            '*следит за инструментом*...',
            'Агент работает... Мяу!',
            '*прищурился* Интересный инструмент_',
        ],
        long_response: [
            'Много текста... *зевает* но я внимательно!',
            '*читает*... Мурр... интересно!',
            'Подробный ответ! =^_^=',
        ],
        markdown_table: [
            'Таблица! *нравится organised данные*',
            '*изучает таблицу* Мурр...',
        ],
    };

    // Idle chat tips (when user is in chat but not typing)
    const CHAT_IDLE_TIPS = [
        'Спроси меня о скиллах! /help покажет все_',
        'Попробуй /commit или /simplify!',
        'Spec Kit: /speckit.specify для новой фичи!',
        'Набери / для списка команд_',
        '/code-reviewer — полный обзор кода!',
        '*ждёт сообщение* Мурр...',
        'Попробуй /speckit.features для быстрой фичи!',
        'Хочешь коммит? /commit поможет!',
        'Shift+Enter для новой строки_',
        '/simplify — улучшит твой код!',
    ];

    // Page-aware contextual tips
    const PAGE_TIPS = {
        dashboard: [
            'Посмотри тренд качества_',
            'Сколько KEEP за сессию?',
            'Наведи на график для деталей_',
            'Качество растёт? =^_^=',
            'COMPARE — сравни эксперименты!',
        ],
        experiments: [
            'Кликни для деталей эксперимента_',
            'COMPARE — два рядом!',
            'FILES — посмотри изменения_',
            'Фильтруй по типу...',
            'Найди лучший эксперимент!',
        ],
        config: [
            'Улучши prompt для лучших результатов_',
            'Обнови цели проекта...',
            'Фокус-области важны!',
            'Добавь constraint если нужно_',
            'Чёткие цели = лучший код!',
        ],
        chat: [
            'Shift+Enter для новой строки_',
            'Спроси что-нибудь!',
            'Я слушаю... мурр_',
            'Agent готов к работе_',
            'Попробуй задать задачу!',
        ],
        settings: [
            'Попробуй другую тему!',
            'DARCULA — как в IDE_',
            'Настрой размер шрифта...',
            'Compact mode экономит место_',
            'Matrix rain можно выключить_',
        ],
        run: [
            '*встряхнулся* Погнали!',
            'Жду результатов...',
            'Эксперименты идут! Мяу!',
            '*следит за логами*',
            'Не забудь проверить score_',
        ],
    };

    // ================================================================
    //  ANIMATION STATE
    // ================================================================

    let animating = false;
    let expression = 'neutral';
    let tailFrame = 0;
    let eyeFrame = 0;
    let animTimer = null;
    let canvas = null;
    let ctx = null;
    let tipTimer = null;
    let ps = 4; // pixel size
    let currentSpeech = '';
    let speechTimer = null;
    let _tickCount = 0;
    let _headOffX = 0, _headOffY = 0;   // ear twitch offset
    let _earTwitchTicks = 0;              // remaining ticks for ear twitch
    let _mood = 'neutral';                // persistent mood: neutral, happy, grumpy, sleepy
    let _pawWaveTicks = 0;                // remaining ticks for paw wave animation
    let _pawWavePhase = 0;                // 0=down, 1=up, 2=hold, 3=down
    let _stretchTicks = 0;                // remaining ticks for stretch animation
    let _stretchPhase = 0;                // 0=prep, 1=stretch, 2=hold, 3=relax
    let _currentPage = 'dashboard';       // current page for contextual tips
    let _tailSpeed = 2;                   // ticks between tail frame advances (1=fast, 2=normal, 3=slow, 4=erratic)
    let _tailAccum = 0;                   // accumulator for tail speed
    let _purrrTicks = 0;                  // remaining ticks for purr body vibration
    let _expHistory = [];                 // recent experiment results for streak/milestone detection
    let _lastMilestone = 0;               // last milestone triggered (prevent spam)
    let _isHovering = false;               // mouse is over cat canvas
    let _clickCount = 0;                   // rapid-click counter for petting detection
    let _lastClickTime = 0;               // timestamp of last click
    let _lastInteractionTime = Date.now(); // last user interaction (click/hover/API)
    let _idleLevel = 0;                   // 0=active, 1=restless, 2=sleepy, 3=deep-sleep
    let _hoverReactionCooldown = 0;        // prevent hover reaction spam

    // ================================================================
    //  CLICK & PETTING REACTIONS
    // ================================================================

    const CLICK_REACTIONS = [
        { expr: 'surprised', speech: 'Мяу?! *подпрыгнул*', anim: 'earTwitch' },
        { expr: 'happy', speech: '*мурр* =^_^=', anim: 'pawWave' },
        { expr: 'happy', speech: 'Мур-мур-мур!', anim: 'purr' },
        { expr: 'thinking', speech: '*прищурился* Чего надо?', anim: 'earTwitch' },
        { expr: 'surprised', speech: 'Не трогай! *шипение*', anim: 'earTwitch' },
        { expr: 'happy', speech: 'Ещё! Ещё! =^._.^=', anim: 'pawWave' },
        { expr: 'neutral', speech: 'Мяу~', anim: 'earTwitch' },
        { expr: 'thinking', speech: '*наклонил голову*...', anim: null },
    ];

    const PETTING_REACTIONS = [
        '*мурррр...* =^_^=',
        'Ещё чешешь! Мурр!',
        '*довольно жмурится*',
        '*мурлычет* Мяу~',
        'Не останавливайся! =^_^=',
        '*трётся о руку* Мурр...',
    ];

    const HOVER_GREETINGS = [
        '*настороженно смотрит*',
        'Чего?..',
        '*уши навострились*',
        '*внимание*',
    ];

    const IDLE_SPEECH = {
        1: ['*скучает*...', 'Хмм...', 'Мяу...'],
        2: ['*зевает*... Мяу...', '*сонно моргает*', 'Скучно...'],
        3: ['*храпит*... zzz', '*свернулся клубком*', 'Мурр... *храпит*'],
    };

    // ================================================================
    //  RENDER
    // ================================================================

    function drawGrid(grid, ox, oy, color, flipH) {
        ctx.fillStyle = color;
        const w = grid[0].length;
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < w; x++) {
                if (grid[y][x]) {
                    const px = flipH ? (ox + w - 1 - x) : (ox + x);
                    ctx.fillRect(px * ps, (oy + y) * ps, ps, ps);
                }
            }
        }
    }

    function drawFilled(outline, fill, pos, outlineColor, fillColor, flipH) {
        const w = fill[0].length;
        // Fill-only pixels (fill=1, outline=0)
        ctx.fillStyle = fillColor;
        for (let y = 0; y < fill.length; y++) {
            for (let x = 0; x < w; x++) {
                if (fill[y][x] && !outline[y][x]) {
                    const px = flipH ? (pos.x + w - 1 - x) : (pos.x + x);
                    ctx.fillRect(px * ps, (pos.y + y) * ps, ps, ps);
                }
            }
        }
        // Outline pixels
        drawGrid(outline, pos.x, pos.y, outlineColor, flipH);
    }

    function render() {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const outlineColor = '#b44aff';
        const fillColor = '#1e1430';
        const cfg = EYE_CFG[expression] || EYE_CFG.neutral;
        const eyeColor = cfg.color || '#ffffff';

        // Stretch offsets
        let bodyOffX = 0, bodyOffY = 0, headExtraY = 0;
        if (_stretchTicks > 0) {
            if (_stretchPhase === 1 || _stretchPhase === 2) {
                // Stretching: body shifts down, head up
                bodyOffY = 1;
                headExtraY = -2;
            } else if (_stretchPhase === 0) {
                // Preparing: slight compression
                bodyOffY = -1;
                headExtraY = 1;
            }
        }

        // Purr vibration: subtle body shake
        if (_purrrTicks > 0) {
            bodyOffX += Math.random() < 0.5 ? -1 : 1;
        }

        // Z-order: tail → body → head → paw → eyes
        drawFilled(TAIL_OUTLINES[tailFrame], TAIL_FILLS[tailFrame], TAIL_POS, outlineColor, fillColor, true);
        drawFilled(BODY.outline, BODY.fill,
            { x: BODY_POS.x + bodyOffX, y: BODY_POS.y + bodyOffY },
            outlineColor, fillColor);
        // Head with ear twitch + stretch offset
        drawFilled(HEAD.outline, HEAD.fill,
            { x: HEAD_POS.x + _headOffX, y: HEAD_POS.y + _headOffY + headExtraY },
            outlineColor, fillColor);

        // Paw wave animation
        if (_pawWaveTicks > 0 && (_pawWavePhase === 1 || _pawWavePhase === 2)) {
            // Paw position: right side of body, near front
            const pawX = BODY_POS.x + 12 + bodyOffX;
            const pawBaseY = BODY_POS.y + 14 + bodyOffY;
            const pawLift = _pawWavePhase === 2 ? 3 : 2;
            drawFilled(PAW_OUTLINE, PAW_FILL,
                { x: pawX, y: pawBaseY - pawLift },
                outlineColor, fillColor);
        }

        // Eyes on top (follow head offset)
        const frames = cfg.frames;
        if (frames && frames.length > 0 && frames[eyeFrame]) {
            drawGrid(frames[eyeFrame], cfg.x + _headOffX, cfg.y + _headOffY + headExtraY, eyeColor);
        }
    }

    // ================================================================
    //  ANIMATION LOOP
    // ================================================================

    function tick() {
        _tickCount++;

        // Tail: variable speed based on mood/expression
        _tailAccum++;
        const tailInterval = _tailSpeed;
        if (_tailAccum >= tailInterval) {
            _tailAccum = 0;
            if (_tailSpeed === 4) {
                // Erratic: random skip or double-advance
                if (Math.random() < 0.3) tailFrame = (tailFrame + 2) % TAIL_OUTLINES.length;
                else tailFrame = (tailFrame + 1) % TAIL_OUTLINES.length;
            } else {
                tailFrame = (tailFrame + 1) % TAIL_OUTLINES.length;
            }
        }

        // Eyes: blink cycle with per-expression speed
        const eyeCfg = EYE_CFG[expression] || EYE_CFG.neutral;
        const blinkSpeed = eyeCfg.blinkSpeed || 0;
        if (blinkSpeed > 0) {
            const frames = eyeCfg.frames;
            if (frames.length > 1 && _tickCount % blinkSpeed === 0) {
                eyeFrame = (eyeFrame + 1) % frames.length;
            }
        }

        // Ear twitch: random micro-animation during idle/neutral
        if (_earTwitchTicks > 0) {
            _earTwitchTicks--;
            if (_earTwitchTicks === 0) { _headOffX = 0; _headOffY = 0; }
        } else if (expression === 'neutral' && _stretchTicks === 0 && Math.random() < 0.02) {
            _headOffX = Math.random() < 0.5 ? 1 : -1;
            _headOffY = -1;
            _earTwitchTicks = 2 + Math.floor(Math.random() * 2);
        }

        // Paw wave: random animation during idle
        if (_pawWaveTicks > 0) {
            _pawWaveTicks--;
            // Phase progression: down(0) → up(1) → hold(2) → down(3)
            if (_pawWaveTicks === 0) { _pawWavePhase = 0; }
            else if (_pawWaveTicks < 3) { _pawWavePhase = 3; }
            else if (_pawWaveTicks < 6) { _pawWavePhase = 2; }
            else { _pawWavePhase = 1; }
        } else if (expression === 'neutral' && _stretchTicks === 0 && Math.random() < 0.008) {
            // ~0.8% chance per tick (~every 15s at 120ms interval)
            _pawWaveTicks = 10;
            _pawWavePhase = 1;
            setSpeech('tip');
        }

        // Stretch/yawn: rare animation during idle
        if (_stretchTicks > 0) {
            _stretchTicks--;
            // Phase progression: prep(0) → stretch(1) → hold(2) → relax(3)
            if (_stretchTicks === 0) { _stretchPhase = 0; }
            else if (_stretchTicks < 3) { _stretchPhase = 3; }
            else if (_stretchTicks < 8) { _stretchPhase = 2; }
            else { _stretchPhase = 1; }
            // During stretch, use sleepy eyes
            if (_stretchPhase >= 1 && _stretchPhase <= 2 && expression === 'neutral') {
                // Temporarily show sleepy-like half-closed eyes by forcing eyeFrame
            }
        } else if (expression === 'neutral' && _pawWaveTicks === 0 && Math.random() < 0.004) {
            // ~0.4% chance per tick (~every 30s at 120ms interval)
            _stretchTicks = 12;
            _stretchPhase = 0;
            setSpeech('idle'); // yawn
        }

        // Purr vibration: body micro-shake when happy (triggered externally or by mood)
        if (_purrrTicks > 0) {
            _purrrTicks--;
        }

        // Hover reaction cooldown
        if (_hoverReactionCooldown > 0) _hoverReactionCooldown--;

        // Idle escalation: track inactivity and change behavior
        const idleSec = Math.floor((Date.now() - _lastInteractionTime) / 1000);
        let newIdleLevel = 0;
        if (idleSec > 180) newIdleLevel = 3;       // 3+ min: deep sleep
        else if (idleSec > 90) newIdleLevel = 2;   // 1.5+ min: sleepy
        else if (idleSec > 45) newIdleLevel = 1;   // 45s+: restless

        if (newIdleLevel !== _idleLevel) {
            const prevLevel = _idleLevel;
            _idleLevel = newIdleLevel;
            // Don't override non-neutral expressions set by external events
            if (expression === 'neutral' || expression === 'sleepy') {
                if (newIdleLevel === 2 && prevLevel < 2) {
                    setExpression('sleepy');
                    _tailSpeed = 4; // slow erratic
                    triggerStretch();
                } else if (newIdleLevel === 3 && prevLevel < 3) {
                    setExpression('sleepy');
                    _tailSpeed = 4;
                    setSpeechText(pickRandom(IDLE_SPEECH[3]), 6000);
                } else if (newIdleLevel === 1 && prevLevel < 1) {
                    // Just restless — subtle hint
                    if (!currentSpeech) setSpeechText(pickRandom(IDLE_SPEECH[1]), 5000);
                } else if (newIdleLevel === 0 && prevLevel > 0) {
                    // Woke up from idle
                    setExpression('neutral');
                    _tailSpeed = 2;
                }
            }
        }

        // Occasional idle speech (only when no other speech active)
        if (_idleLevel >= 1 && !currentSpeech && _tickCount % 80 === 0) {
            const pool = IDLE_SPEECH[_idleLevel];
            if (pool) setSpeechText(pickRandom(pool), 5000);
        }

        // Hover ear twitch (increased frequency when mouse is over cat)
        if (_isHovering && _hoverReactionCooldown === 0 && expression === 'neutral' && _earTwitchTicks === 0) {
            if (Math.random() < 0.04) {
                triggerEarTwitch();
                _hoverReactionCooldown = 15; // ~1.8s cooldown
            }
        }

        render();
    }

    // ================================================================
    //  SPEECH
    // ================================================================

    function pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function setSpeech(type) {
        const pool = SPEECH[type] || SPEECH.idle;
        currentSpeech = pickRandom(pool);
        if (speechTimer) clearTimeout(speechTimer);
        speechTimer = setTimeout(() => { currentSpeech = ''; }, 6000);
    }

    function startTips() {
        if (tipTimer) clearInterval(tipTimer);
        const showTip = () => {
            if (!animating || currentSpeech) return; // don't override active speech
            // Mood-aware tips
            const moodTips = {
                happy: ['*довольный мурр*', 'Всё идёт по плану! =^_^=', 'Хороший день для хаков!'],
                grumpy: ['Хмф...', '*недовольно смотрит*', 'Можно получше...', 'Не всё KEEP...'],
                sleepy: ['*зевает*... Мяу...', '*сонно моргает*', 'Скучно... дай задачу...'],
            };
            // Page-aware tips take priority, chat idle tips for chat page
            let pool;
            if (_currentPage === 'chat' && Math.random() < 0.6) {
                // 60% chat-specific idle tips when on chat page
                pool = CHAT_IDLE_TIPS;
            } else {
                const pagePool = PAGE_TIPS[_currentPage];
                if (pagePool && Math.random() < 0.7) {
                    // 70% page-specific tips
                    pool = pagePool;
                } else if (moodTips[_mood]) {
                    // 30% mood-specific or generic
                    pool = moodTips[_mood];
                } else {
                    pool = SPEECH.tip;
                }
            }
            currentSpeech = pickRandom(pool);
            if (speechTimer) clearTimeout(speechTimer);
            speechTimer = setTimeout(() => { currentSpeech = ''; }, 6000);
        };
        // first tip after 8s, then every 15-25s
        tipTimer = setTimeout(() => {
            showTip();
            tipTimer = setInterval(showTip, 15000 + Math.random() * 10000);
        }, 8000);
    }

    function stopTips() {
        if (tipTimer) { clearTimeout(tipTimer); clearInterval(tipTimer); tipTimer = null; }
    }

    // ================================================================
    //  PUBLIC API
    // ================================================================

    window.CatModule = {

        /**
         * Start animation on a canvas element.
         * @param {HTMLCanvasElement} el - canvas element
         * @param {string} expr - 'neutral'|'happy'|'sleepy'|'surprised'|'angry'|'thinking'
         */
        start(el, expr, pixelSize) {
            if (animating) this.stop();
            canvas = el;
            ctx = canvas.getContext('2d');
            ps = pixelSize || 4;
            canvas.width = CW * ps;
            canvas.height = CH * ps;
            canvas.style.imageRendering = 'pixelated';

            if (expr) expression = expr;
            tailFrame = 0;
            eyeFrame = 0;
            _tickCount = 0;
            animating = true;

            render();
            animTimer = setInterval(tick, 120);
            setSpeech('working');
            startTips();
        },

        /** Stop animation and release canvas. */
        stop() {
            animating = false;
            if (animTimer) { clearInterval(animTimer); animTimer = null; }
            stopTips();
            canvas = null;
            ctx = null;
        },

        /** Change expression (e.g. 'happy', 'sleepy', 'surprised', 'angry', 'thinking'). */
        setExpression(expr) {
            _lastInteractionTime = Date.now();
            if (expr !== 'sleepy') _idleLevel = 0;
            expression = expr;
            eyeFrame = 0;
            _tailAccum = 0;
            // Adjust tail speed based on expression
            const tailSpeeds = {
                neutral: 2, happy: 1, sleepy: 4, surprised: 1,
                angry: 3, thinking: 3,
            };
            _tailSpeed = tailSpeeds[expr] || 2;
            // Purr when happy
            if (expr === 'happy') _purrrTicks = 20;
            if (animating) render();
        },

        /** Trigger a speech bubble. */
        say(type) {
            _lastInteractionTime = Date.now();
            setSpeech(type);
        },

        /** Get current speech message. */
        getSpeech() {
            return currentSpeech;
        },

        /** Set speech text directly (for external page-aware tips). */
        setSpeechText(text, durationMs) {
            _lastInteractionTime = Date.now();
            currentSpeech = text || '';
            if (speechTimer) clearTimeout(speechTimer);
            if (durationMs && text) {
                speechTimer = setTimeout(() => { currentSpeech = ''; }, durationMs);
            }
        },

        /** Trigger an ear twitch immediately. */
        triggerEarTwitch() {
            _headOffX = Math.random() < 0.5 ? 1 : -1;
            _headOffY = -1;
            _earTwitchTicks = 2 + Math.floor(Math.random() * 2);
        },

        /** Trigger a paw wave animation. */
        triggerPawWave() {
            if (_pawWaveTicks > 0) return;
            _pawWaveTicks = 10;
            _pawWavePhase = 1;
        },

        /** Trigger a stretch/yawn animation. */
        triggerStretch() {
            if (_stretchTicks > 0) return;
            _stretchTicks = 12;
            _stretchPhase = 0;
        },

        /**
         * React to experiment result — milestone detection, streak analysis, mood updates.
         * @param {string} decision - 'KEEP'|'DISCARD'|'ACCEPT'|'ERROR'|null
         * @param {number} score - experiment score (0-1)
         * @param {number} expNum - experiment number
         */
        reactToExperiment(decision, score, expNum) {
            if (!animating) return;
            const isKeep = decision === 'KEEP' || decision === 'ACCEPT';
            const isDiscard = decision === 'DISCARD';
            const isError = decision === 'ERROR';

            // Track history for streaks
            _expHistory.push({ decision, score: score || 0, num: expNum || 0 });
            if (_expHistory.length > 20) _expHistory.shift();

            // Milestone: every 10 experiments
            if (expNum && expNum % 10 === 0 && expNum !== _lastMilestone) {
                _lastMilestone = expNum;
                setExpression('surprised');
                setSpeechText('Мяу! Эксперимент #' + expNum + '! =^_^=', 5000);
                triggerPawWave();
                setTimeout(() => { if (animating) setExpression('happy'); }, 2000);
                setTimeout(() => { if (animating) setExpression('neutral'); }, 5000);
                return;
            }

            // Streak detection: 3+ consecutive KEEP
            if (isKeep) {
                let streak = 0;
                for (let i = _expHistory.length - 1; i >= 0; i--) {
                    if (_expHistory[i].decision === 'KEEP' || _expHistory[i].decision === 'ACCEPT') streak++;
                    else break;
                }
                if (streak >= 5) {
                    setExpression('happy');
                    setSpeechText('Серия из ' + streak + '! Непобедимы! =^_^=', 5000);
                    _purrrTicks = 30;
                    setTimeout(() => { if (animating) setExpression('neutral'); }, 5000);
                    return;
                }
                if (streak >= 3) {
                    setExpression('happy');
                    setSpeechText(streak + ' KEEP подряд! Мурр! =^._.^=', 4000);
                    setTimeout(() => { if (animating) setExpression('neutral'); }, 4000);
                    return;
                }
            }

            // Streak detection: 3+ consecutive DISCARD
            if (isDiscard) {
                let streak = 0;
                for (let i = _expHistory.length - 1; i >= 0; i--) {
                    if (_expHistory[i].decision === 'DISCARD') streak++;
                    else break;
                }
                if (streak >= 3) {
                    setExpression('angry');
                    setMood('grumpy');
                    setSpeechText(streak + ' DISCARD... *шипение* Код нужно менять!', 5000);
                    _tailSpeed = 4; // erratic
                    setTimeout(() => { if (animating) { setExpression('neutral'); _tailSpeed = 2; } }, 5000);
                    return;
                }
            }

            // High score celebration (>= 0.9)
            if (score >= 0.9 && isKeep) {
                setExpression('happy');
                setSpeechText('Отличный score: ' + (score * 100).toFixed(0) + '%! =^_^=', 4000);
                _purrrTicks = 25;
                triggerPawWave();
                setTimeout(() => { if (animating) setExpression('neutral'); }, 4000);
                return;
            }

            // Error reaction
            if (isError) {
                setExpression('surprised');
                setSpeechText('Мяу?! Ошибка! *уши торчком*', 4000);
                triggerEarTwitch();
                setTimeout(() => { if (animating) setExpression('neutral'); }, 4000);
                return;
            }
        },

        /**
         * Analyze user chat message and trigger contextual cat reaction.
         * Returns true if a reaction was triggered.
         * @param {string} message - user message text
         */
        analyzeChatContext(message) {
            if (!message || !animating) return false;
            _lastInteractionTime = Date.now();
            const lower = message.toLowerCase();
            // Check each keyword category
            for (const [keyword, tips] of Object.entries(CHAT_SKILL_TIPS)) {
                if (lower.includes(keyword)) {
                    // Don't trigger on slash commands (they're already handled)
                    if (lower.startsWith('/')) continue;
                    // Only trigger ~40% of the time to avoid spam
                    if (Math.random() < 0.4) {
                        setSpeechText(pickRandom(tips), 6000);
                        if (Math.random() < 0.5) triggerEarTwitch();
                        return true;
                    }
                }
            }
            return false;
        },

        /**
         * React to agent response content.
         * @param {string} content - agent response text
         */
        analyzeAgentResponse(content) {
            if (!content || !animating) return;
            _lastInteractionTime = Date.now();
            const hasCode = (content.match(/```[\s\S]*?```/g) || []).length;
            const hasTable = content.includes('|---|') || content.includes('| --- |');
            const isLong = content.length > 1500;
            const hasToolCalls = content.includes('tool_call') || content.includes('ToolCall') || content.includes('⏺') || content.includes('Command');

            // Only react ~30% of the time
            if (Math.random() > 0.3) return;

            if (hasCode >= 2) {
                setSpeechText(pickRandom(AGENT_RESPONSE_TIPS.code_block), 5000);
                if (Math.random() < 0.4) setExpression('happy');
            } else if (hasToolCalls) {
                setSpeechText(pickRandom(AGENT_RESPONSE_TIPS.tool_call), 5000);
            } else if (isLong) {
                setSpeechText(pickRandom(AGENT_RESPONSE_TIPS.long_response), 5000);
            } else if (hasTable) {
                setSpeechText(pickRandom(AGENT_RESPONSE_TIPS.markdown_table), 5000);
            }
        },

        /**
         * Get a random idle chat tip (for chat page when user is idle).
         */
        getChatIdleTip() {
            return pickRandom(CHAT_IDLE_TIPS);
        },

        /** Set current page for contextual tips. */
        setPage(page) {
            _currentPage = page || 'dashboard';
        },

        /** Get current page. */
        getPage() {
            return _currentPage;
        },

        /** Set persistent mood (affects idle tip selection). */
        setMood(mood) {
            _mood = mood || 'neutral';
        },

        /** Get current mood. */
        getMood() {
            return _mood;
        },

        /** Is animation running? */
        isActive() {
            return animating;
        },

        /** Get current expression name. */
        getExpression() {
            return expression;
        },

        /** Get current mood name. */
        getMoodName() {
            return _mood;
        },

        /**
         * Handle click on cat canvas.
         * Single click: random reaction. Rapid clicks (3+): petting mode with purr.
         */
        onClick() {
            if (!animating) return;
            const now = Date.now();
            _lastInteractionTime = now;

            // Wake up from idle
            if (_idleLevel > 0) {
                _idleLevel = 0;
                _tailSpeed = 2;
                if (expression === 'sleepy') {
                    setExpression('surprised');
                    triggerEarTwitch();
                    setSpeechText('*проснулся!* Мяу?!', 3000);
                    setTimeout(() => { if (animating) setExpression('neutral'); }, 3000);
                    _clickCount = 0;
                    return;
                }
            }

            // Detect rapid clicks (petting)
            if (now - _lastClickTime < 600) {
                _clickCount++;
            } else {
                _clickCount = 1;
            }
            _lastClickTime = now;

            // Petting mode (3+ rapid clicks)
            if (_clickCount >= 3) {
                setExpression('happy');
                setSpeechText(pickRandom(PETTING_REACTIONS), 4000);
                _purrrTicks = 25;
                _tailSpeed = 1; // fast happy tail
                return;
            }

            // Normal single/double click reaction
            const reaction = pickRandom(CLICK_REACTIONS);
            setExpression(reaction.expr);
            setSpeechText(reaction.speech, 4000);

            if (reaction.anim === 'earTwitch') triggerEarTwitch();
            else if (reaction.anim === 'pawWave') triggerPawWave();
            else if (reaction.anim === 'purr') _purrrTicks = 15;

            // Return to neutral after delay
            setTimeout(() => {
                if (animating && (expression === reaction.expr) && _idleLevel === 0) {
                    setExpression('neutral');
                }
            }, 4000);
        },

        /**
         * Set hover state when mouse enters/leaves cat canvas.
         * @param {boolean} isHovering
         */
        setHovering(isHovering) {
            _isHovering = isHovering;
            if (isHovering) {
                _lastInteractionTime = Date.now();
                // Wake from deep sleep
                if (_idleLevel >= 3) {
                    _idleLevel = 1;
                    setExpression('neutral');
                    _tailSpeed = 2;
                    setSpeechText('*проснулся* Мяу?', 3000);
                    triggerEarTwitch();
                    return;
                }
                // Occasional greeting on first hover
                if (Math.random() < 0.25 && !currentSpeech && _hoverReactionCooldown === 0) {
                    setSpeechText(pickRandom(HOVER_GREETINGS), 3000);
                    _hoverReactionCooldown = 30; // ~3.6s cooldown
                }
            }
        },

        /**
         * Reset idle timer (called on any external interaction).
         */
        resetIdle() {
            _lastInteractionTime = Date.now();
            if (_idleLevel > 0) {
                _idleLevel = 0;
                _tailSpeed = 2;
                if (expression === 'sleepy') setExpression('neutral');
            }
        },

    };

    // [CatModule] Loaded — catode32 cat sprite engine
})();
