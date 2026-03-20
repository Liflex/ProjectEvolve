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

    // Eye glint centers for cursor tracking — [leftEyeCenter, rightEyeCenter] relative to EYE_CFG position
    // Only expressions with open eyes get glints (not happy/sleepy)
    const EYE_GLINT = {
        neutral:   { left: [3, 2], right: [12, 2] },
        surprised: { left: [3, 2], right: [12, 2] },
        angry:     { left: [2, 1], right: [12, 1] },
        thinking:  { left: [3, 2], right: [12, 2] },
    };

    // Paw sprite for wave animation (3×4)
    const PAW_OUTLINE = decode([0x07, 0x05, 0x07], 3, 4);
    const PAW_FILL = decode([0x07, 0x07, 0x07], 3, 4);

    // ================================================================
    //  MOUTH SPRITES — per-expression (width × 2 rows)
    // ================================================================

    // Neutral: small straight line (5×2)
    const MOUTH_NEUTRAL = decode([0x08, 0x00], 5, 2);
    // Happy: curved up smile (7×3)
    const MOUTH_HAPPY = decode([0x02, 0x3E, 0x01], 7, 3);
    // Surprised: small O shape (5×4)
    const MOUTH_SURPRISED = decode([0x0E, 0x11, 0x11, 0x0E], 5, 4);
    // Angry: small frown (7×3)
    const MOUTH_ANGRY = decode([0x01, 0x3E, 0x02], 7, 3);
    // Thinking: slightly asymmetric (5×2)
    const MOUTH_THINKING = decode([0x0C, 0x02], 5, 2);
    // Sleepy: small (3×1)
    const MOUTH_SLEEPY = decode([0x02], 3, 1);

    // Mouth config: { sprite, x-offset from HEAD_POS, y-offset from HEAD_POS, color }
    const MOUTH_CFG = {
        neutral:   { sprite: MOUTH_NEUTRAL,   dx: 10, dy: 15, color: '#b44aff' },
        happy:     { sprite: MOUTH_HAPPY,     dx: 9,  dy: 14, color: '#ff69b4' },
        surprised: { sprite: MOUTH_SURPRISED, dx: 10, dy: 14, color: '#ff69b4' },
        angry:     { sprite: MOUTH_ANGRY,     dx: 9,  dy: 14, color: '#ff3355' },
        thinking:  { sprite: MOUTH_THINKING,  dx: 10, dy: 15, color: '#88aaff' },
        sleepy:    { sprite: MOUTH_SLEEPY,    dx: 11, dy: 16, color: '#b44aff' },
    };

    // ================================================================
    //  WHISKERS — drawn as canvas lines (3 per side)
    //  Positions relative to HEAD_POS center of face
    // ================================================================

    const WHISKER_BASE = {
        // Left whiskers (from face center-left going outward)
        left: [
            { sx: 2, sy: 13, ex: -5, ey: 11 },
            { sx: 2, sy: 14, ex: -6, ey: 14 },
            { sx: 2, sy: 15, ex: -5, ey: 17 },
        ],
        // Right whiskers (from face center-right going outward)
        right: [
            { sx: 23, sy: 13, ex: 30, ey: 11 },
            { sx: 23, sy: 14, ex: 31, ey: 14 },
            { sx: 23, sy: 15, ex: 30, ey: 17 },
        ],
    };

    // Whisker config per expression: { droop, spread, color, wobble }
    const WHISKER_CFG = {
        neutral:   { droop: 0,  spread: 1.0, color: '#d98fff', wobble: 0 },
        happy:     { droop: -1, spread: 1.1, color: '#ff69b4', wobble: 0 },
        surprised: { droop: -2, spread: 1.3, color: '#ffff66', wobble: 1 },
        angry:     { droop: 2,  spread: 0.8, color: '#ff3355', wobble: 2 },
        thinking:  { droop: 1,  spread: 0.9, color: '#88aaff', wobble: 0 },
        sleepy:    { droop: 1,  spread: 0.85, color: '#d98fff', wobble: 0 },
    };

    const CW = 50, CH = 37;

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
            // Warcraft 3 Peon-style
            'Работа работой, а поспать надо...',
            'Слушаю и повинуюсь! *рылко вперёд*',
            'Опять работать?... Мяу...',
            'Так, где тут кнопка "сделать всё"?',
            'Время — золото! Мяу!',
            '*копает* Код не пишет себя сам!',
            'Задание принято! =^._.^=',
        ],
        success: [
            'Мурр! =^._.^=',
            '*счастливый хвост*',
            'Миссия выполнена!',
            'Цель нейтрализована. =^.^=',
            'Ещё один в мешке!',
            'Победа! =^_^=',
            // Gaming
            'GG WP! =^_^=',
            'Level up! Мяу!',
            'Ачивка разблокирована! ★',
            'Миссия выполнена, командир!',
            'Враг повержен! =^._.^=',
            'Босс убит! Лут собран!',
            '+1 к репутации!',
        ],
        error: [
            'Мяу?! o_o',
            '*шипение*',
            'Не лучшая моя работа...',
            'Ошибка 404: мотивация не найдена.',
            '*недовольное мурчание*',
            // Gaming
            'Критический удар по коду! *спотыкается*',
            'Game Over?... Нет, ещё рано!',
            'Баг нашёл нас! Мяу?!',
            'Нужно больше золота на фиксы!...',
            'Отступаем! Перегруппировываемся!',
            'Не тот путь, мясник...',
            'Задание провалено... *вздыхает*',
        ],
        idle: [
            '*тихо сидит*',
            '...мурр...',
            '=^.^=',
            '*хвост машет*',
            'Жду приказов...',
            '*зевает*',
            'Мяу~',
            // Gaming
            'AFK? Я на посту_',
            '*патрулирует кодовую базу*',
            'Нам нужно больше экспериментов!',
            'Кто-нибудь работает?!',
            '*рыба играет рядом*...',
            'Раб готов! Жду_',
            '*ловит мух*... Мяу!',
        ],
        surprised: [
            'МЯУ?! O_O',
            'Ого!',
            '*уши встали торчком*',
            'Ничего себе!',
            '*шерсть дыбом*',
            // Gaming
            'Двойной удар?! Мяу!!',
            'Бафф наложен! =^.^=',
            'О_О Это легендарный дроп!',
            'Босс заспавнился?!',
        ],
        angry: [
            '*шипение* >:(',
            'Мррр...',
            '*когти выпущены*',
            '*не довольный взгляд*',
            'Плохой код. Очень плохой.',
            // Gaming
            'Бой начался! >:(',
            'Моя ярость не знает границ!',
            'Это баг-репорт! *когти*',
            'Объявляю войну этому коду!',
            'За котов! В атаку!',
        ],
        thinking: [
            '*размышляет*...',
            'Хмм...',
            'Мур... мурр...',
            '*покусывает губы*',
            'Нужно подумать...',
            // Gaming
            'Тактика... нужна тактика...',
            'Хмм, а если так?... *наклонил голову*',
            '*изучает карту* Куда идём?',
            'Квест принят. Думаю над стратегией...',
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
            // Gaming
            'Не забывай сохраняться! (git commit)',
            'Качай скиллы через эксперименты!',
            'Каждый KEEP = +1 XP!',
            'DISCARD = урок выучен, XP не пропал!',
            'Исследуй все уголки кода!',
        ],
        milestone: [
            'Мяу! Эксперимент #{n}! =^_^=',
            'Level {n} достигнут! ★',
            'Milestone! Прогресс неостановим!',
            '{n} экспериментов! Я горжусь тобой!',
            'Ачивка: {n} экспериментов! Мурр!',
            'Впечатляющий прогресс, командир!',
        ],
        streak_keep: [
            'Комбо x{n}! Непобедимы! =^_^=',
            'Серия из {n}! Форма огонь!',
            'Winning streak x{n}! Мяу!',
            '{n} KEEP подряд! Легенда!',
            'Доминация! x{n} побед!',
        ],
        streak_discard: [
            '{n} DISCARD... *шипение* Сменить тактику!',
            'Серия неудач... Нужен другой подход!',
            '{n} раз откатились... *грустно*',
            'Перегруппировка! Меняем стратегию!',
        ],
        discard_single: [
            'Не вышло... Но это не конец!',
            'DISCARD. Откат. Начинаем заново.',
            '*вздыхает* Бывало и лучше...',
            'Ну и ладно, зато опыт есть!',
            'Одна битва не решает войну!',
        ],
        high_score: [
            'Score {s}%! Блестяще! =^_^=',
            'Легендарный результат: {s}%!',
            'Critical hit! Score {s}%!',
            '{s}%! Это S-ранг!',
            'Босс повержен с {s}% урона!',
        ],
        waiting: [
            'AFK? Я на посту_',
            '*патрулирует* Жду...',
            'Жду приказа, командир!',
            '*скучает* Ску-учно...',
            'Мяу? Ты ещё тут?',
            '*проверяет часы* Долго ещё?',
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

    // Real-time tool call reactions — per tool type with contextual messages
    const TOOL_CALL_REACTIONS = {
        read: {
            // 25% trigger chance — reads are frequent
            chance: 0.25,
            expressions: ['thinking', 'neutral'],
            generic: [
                'Читаю файл... *прищурился*',
                '*смотрит через плечо* Что там?',
                '*внимательно* Интересно...',
                'Чтение... Мяу~',
            ],
            // {file} placeholder replaced with filename
            contextual: [
                'Читаю {file}... *прищурился*',
                '{file}... *изучает*',
                '*заглядывает в* {file}...',
            ],
        },
        edit: {
            // 45% trigger chance — edits are important
            chance: 0.45,
            expressions: ['surprised', 'thinking'],
            generic: [
                'Правка! *ушами шевелит*',
                'О, редактирование! =^.^=',
                '*заинтересованно* Что меняем?',
                'Код меняется! Мурр!',
            ],
            contextual: [
                'Правим {file}! =^.^=',
                'Редактирую {file}... *хвостиком виляет*',
                '{file} изменён! Мяу!',
            ],
        },
        write: {
            // 55% trigger chance — new files are notable
            chance: 0.55,
            expressions: ['happy', 'surprised'],
            generic: [
                'Новый файл! Мурр!',
                'Создаём файл! *радостно*',
                '*хвостиком виляет* Пишем!',
                'Создание... =^_^=',
            ],
            contextual: [
                'Новый файл: {file}! Мяу!',
                'Создаю {file}... *вдохновлённо*',
                '{file} появился! =^_^=',
            ],
        },
        bash: {
            // 40% trigger chance — commands are action
            chance: 0.40,
            expressions: ['thinking', 'surprised'],
            generic: [
                'Команда! *напряжённо слушает*',
                '*уши навострил* Запуск!',
                'Баш! *готовится*',
                'Выполняю... Мяу!',
            ],
            contextual: [
                'Запускаю: {detail}... *напряжённо*',
                'Команда: {detail}...',
                '*уши навострил* {detail}',
            ],
        },
        search: {
            // 20% trigger chance — searches are routine
            chance: 0.20,
            expressions: ['neutral', 'thinking'],
            generic: [
                'Поиск... *внимательно*',
                'Ищем... Мяу~',
                '*принюхался* Где-то тут...',
            ],
            contextual: [
                'Ищу: {detail}...',
                'Поиск "{detail}"... Мяу~',
            ],
        },
        other: {
            // 15% trigger chance — unknown tools
            chance: 0.15,
            expressions: ['thinking'],
            generic: [
                '*наклонил голову* Что это?',
                'Инструмент... Мяу?',
                '*любопытно*...',
            ],
            contextual: [
                '{detail}... *наклонил голову*',
            ],
        },
    };

    // Consecutive tool call pattern reactions
    const TOOL_PATTERN_REACTIONS = {
        many_edits: [
            'Много правок! *волнуется*',
            'Серия правок... *интенсивно следит*',
            'Так-так-так, что тут творится...',
        ],
        many_reads: [
            '*сонно* Много файлов... Зачем?',
            'Чтение марафон... *зевает*',
        ],
        many_bash: [
            '*тревожно* Много команд!',
            'Запускаем всё подряд?! Мяу?!',
        ],
        edit_after_write: [
            'Только создали и уже правим? =^.^=',
            'Файл создан — сразу к доработке!',
        ],
        bash_after_edit: [
            'Запускаем после правок? =^_^=',
            'Тестируем изменения? Мурр!',
        ],
        search_then_read: [
            'Нашли — теперь читаем! Логично.',
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
            'Рейтинг проекта обновлён! Мяу!',
            'Каждый KEEP = +1 к репутации!',
        ],
        experiments: [
            'Кликни для деталей эксперимента_',
            'COMPARE — два рядом!',
            'FILES — посмотри изменения_',
            'Фильтруй по типу...',
            'Найди лучший эксперимент!',
            'Лог экспериментов — как дневник квестов!',
        ],
        config: [
            'Улучши prompt для лучших результатов_',
            'Обнови цели проекта...',
            'Фокус-области важны!',
            'Добавь constraint если нужно_',
            'Чёткие цели = лучший код!',
            'Правильный prompt = сильный бафф!',
        ],
        chat: [
            'Shift+Enter для новой строки_',
            'Спроси что-нибудь!',
            'Я слушаю... мурр_',
            'Agent готов к работе_',
            'Попробуй задать задачу!',
            'Набери / для меню скиллов!',
        ],
        settings: [
            'Попробуй другую тему!',
            'DARCULA — как в IDE_',
            'Настрой размер шрифта...',
            'Compact mode экономит место_',
            'Matrix rain можно выключить_',
            'Настрой интерфейс под себя!',
        ],
        run: [
            '*встряхнулся* Погнали!',
            'Жду результатов...',
            'Эксперименты идут! Мяу!',
            '*следит за логами*',
            'Не забудь проверить score_',
            'Задание в процессе...',
            'Раунд начинается! =^_^=',
            'За старт! Ждём результат...',
            '*наблюдает за прогрессом*',
            'Нам нужно больше экспериментов!',
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
    let _speechAction = null;              // { type: 'insert', value: '/commit ' } — actionable speech
    let _toolHistory = [];                 // recent tool calls [{type, ts}] for pattern detection
    let _toolReactCooldown = 0;            // cooldown to prevent tool reaction spam (ticks)
    let _particles = [];                   // floating particles (Zzz, hearts, sparkles)
    let _whiskerWobble = 0;                // whisker wobble phase
    let _mouseX = 0, _mouseY = 0;         // global cursor position for eye tracking
    let _glintX = 0, _glintY = 0;         // smoothed glint offset (-1..1)
    let _mouseTracking = false;            // is mousemove listener active

    // Mouse move handler for eye tracking
    function _onMouseMove(e) {
        _mouseX = e.clientX;
        _mouseY = e.clientY;
    }

    // ================================================================
    //  PARTICLES (Zzz, hearts, sparkles)
    // ================================================================

    function spawnParticle(opts) {
        _particles.push({
            x: opts.x, y: opts.y,
            vx: opts.vx || 0, vy: opts.vy || 0,
            life: opts.life || 40, maxLife: opts.life || 40,
            char: opts.char || 'Z',
            color: opts.color || '#b44aff',
            fontSize: opts.fontSize || 8,
            wobble: opts.wobble || 0,       // horizontal wobble amplitude
            wobbleSpeed: opts.wobbleSpeed || 0.1,
            age: 0,
        });
    }

    function updateParticles() {
        for (let i = _particles.length - 1; i >= 0; i--) {
            const p = _particles[i];
            p.age++;
            p.x += p.vx + Math.sin(p.age * p.wobbleSpeed) * p.wobble;
            p.y += p.vy;
            p.life--;
            if (p.life <= 0) _particles.splice(i, 1);
        }
        // Cap particles to prevent memory issues
        if (_particles.length > 30) _particles.splice(0, _particles.length - 30);
    }

    function renderParticles() {
        if (_particles.length === 0) return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const p of _particles) {
            const fadeIn = Math.min(1, p.age / 5);
            const fadeOut = Math.min(1, p.life / (p.maxLife * 0.3));
            ctx.globalAlpha = fadeIn * fadeOut;
            ctx.fillStyle = p.color;
            ctx.font = p.fontSize + 'px monospace';
            ctx.fillText(p.char, p.x * ps, p.y * ps);
        }
        ctx.restore();
    }

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
        'Ещё! Ещё! Мур-мур-мур!',
        '*довольно трясёт хвостом*',
    ];

    const HOVER_GREETINGS = [
        '*настороженно смотрит*',
        'Чего?..',
        '*уши навострились*',
        '*внимание*',
        'Мяу? Ты что-то хочешь?',
        '*поворачивает голову*',
    ];

    const IDLE_SPEECH = {
        1: ['*скучает*...', 'Хмм...', 'Мяу...', '*оглядывается* Кто-нибудь тут?', '*теребит хвост*'],
        2: ['*зевает*... Мяу...', '*сонно моргает*', 'Скучно...', '*сонный мяу*', 'Мурр... хочу на ручки...'],
        3: ['*храпит*... zzz', '*свернулся клубком*', 'Мурр... *храпит*', '*сонный писк*... zZzZ'],
    };

    // ================================================================
    //  WHISKER & MOUTH RENDERING
    // ================================================================

    function renderWhiskers(headX, headY) {
        const wCfg = WHISKER_CFG[expression] || WHISKER_CFG.neutral;
        ctx.save();
        ctx.strokeStyle = wCfg.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.7;

        // Wobble animation for angry/surprised
        const wb = wCfg.wobble > 0 ? Math.sin(_whiskerWobble) * wCfg.wobble : 0;

        for (const side of ['left', 'right']) {
            for (const w of WHISKER_BASE[side]) {
                const sx = (headX + w.sx) * ps;
                const sy = (headY + w.sy + wCfg.droop) * ps;
                const spreadMul = wCfg.spread;
                // Direction multiplier: left goes negative-x, right positive-x
                const dir = side === 'left' ? -1 : 1;
                const dx = (w.ex - w.sx) * dir * spreadMul;
                const dy = (w.ey - w.sy) + wb * (side === 'left' ? 1 : -1);
                const ex = sx + dx * ps;
                const ey = (headY + w.sy + dy + wCfg.droop) * ps;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(ex, ey);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    function renderMouth(headX, headY) {
        const mCfg = MOUTH_CFG[expression] || MOUTH_CFG.neutral;
        drawGrid(mCfg.sprite, headX + mCfg.dx, headY + mCfg.dy, mCfg.color);
    }

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

        // Z-order: tail → body → head → paw → eyes → particles
        // Tail position adjustment based on expression/mood
        let tailOffX = 0, tailOffY = 0;
        if (expression === 'happy' || _mood === 'happy') {
            tailOffY = -1; // raised tail
        } else if (expression === 'angry') {
            tailOffX = 1; tailOffY = -1; // puffed
        } else if (expression === 'sleepy' || _idleLevel >= 2) {
            tailOffX = 2; tailOffY = 1; // curled forward
        } else if (expression === 'thinking') {
            tailOffY = 1; // low, contemplative
        }
        const tailPos = { x: TAIL_POS.x + tailOffX, y: TAIL_POS.y + tailOffY };
        drawFilled(TAIL_OUTLINES[tailFrame], TAIL_FILLS[tailFrame], tailPos, outlineColor, fillColor, true);
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

        // Cursor-tracking eye glints (bright pixel that follows mouse)
        const glintCfg = EYE_GLINT[expression];
        if (glintCfg && _mouseTracking && _idleLevel < 2) {
            // Skip during blink frames
            const isBlinking = expression === 'neutral' && eyeFrame === 1;
            const isSleepyBlink = expression === 'sleepy' && (eyeFrame === 2 || eyeFrame === 0);
            if (!isBlinking && !isSleepyBlink) {
                const rect = canvas.getBoundingClientRect();
                const catScreenX = rect.left + rect.width / 2;
                const catScreenY = rect.top + rect.height * 0.4; // eyes are in upper portion
                const dx = _mouseX - catScreenX;
                const dy = _mouseY - catScreenY;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                // Target offset: max ±1 pixel in each direction
                const targetX = (dx / dist);
                const targetY = (dy / dist);
                // Smooth interpolation
                _glintX += (targetX - _glintX) * 0.12;
                _glintY += (targetY - _glintY) * 0.12;
                const gx = Math.round(_glintX);
                const gy = Math.round(_glintY);
                // Draw glint on each eye
                const eox = _headOffX;
                const eoy = _headOffY + headExtraY;
                ctx.fillStyle = '#ffffff';
                // Left eye glint
                const lx = cfg.x + glintCfg.left[0] + gx + eox;
                const ly = cfg.y + glintCfg.left[1] + gy + eoy;
                ctx.fillRect(lx * ps, ly * ps, ps, ps);
                // Right eye glint
                const rx = cfg.x + glintCfg.right[0] + gx + eox;
                const ry = cfg.y + glintCfg.right[1] + gy + eoy;
                ctx.fillRect(rx * ps, ry * ps, ps, ps);
            }
        }

        // Head position for whiskers/mouth (follows head offset)
        const hx = HEAD_POS.x + _headOffX;
        const hy = HEAD_POS.y + _headOffY + headExtraY;

        // Mouth (below eyes)
        renderMouth(hx, hy);

        // Whiskers (on sides of face)
        renderWhiskers(hx, hy);

        // Floating particles (Zzz, hearts, sparkles) — rendered on top
        renderParticles();
    }

    // ================================================================
    //  ANIMATION LOOP
    // ================================================================

    function tick() {
        _tickCount++;

        // Tool reaction cooldown decrement
        if (_toolReactCooldown > 0) _toolReactCooldown--;

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
        // Whisker wobble animation (for angry/surprised expressions)
        const wCfg = WHISKER_CFG[expression] || WHISKER_CFG.neutral;
        if (wCfg.wobble > 0) {
            _whiskerWobble += 0.3;
        } else {
            // Smoothly decay wobble
            if (Math.abs(_whiskerWobble) > 0.01) {
                _whiskerWobble *= 0.85;
            } else {
                _whiskerWobble = 0;
            }
        }

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
            // Spawn heart/sparkle particles during purr
            if (_tickCount % 5 === 0) {
                spawnParticle({
                    x: BODY_POS.x + 3 + Math.random() * 12,
                    y: BODY_POS.y + 2 + Math.random() * 4,
                    vx: (Math.random() - 0.5) * 0.15,
                    vy: -0.08 - Math.random() * 0.06,
                    life: 25 + Math.floor(Math.random() * 15),
                    char: Math.random() < 0.4 ? '♥' : '✦',
                    color: Math.random() < 0.4 ? '#ff69b4' : '#ffd700',
                    fontSize: 6 + Math.floor(Math.random() * 2),
                    wobble: 0.1,
                    wobbleSpeed: 0.15,
                });
            }
        }

        // Zzz particles during sleep (idle level 2+)
        if (_idleLevel >= 2 && _tickCount % 35 === 0) {
            const isBig = Math.random() < 0.3;
            spawnParticle({
                x: HEAD_POS.x + 12 + _headOffX + Math.random() * 3,
                y: HEAD_POS.y - 1 + _headOffY,
                vx: 0.03 + Math.random() * 0.05,
                vy: -0.06 - Math.random() * 0.04,
                life: 50 + Math.floor(Math.random() * 20),
                char: isBig ? 'Z' : 'z',
                color: isBig ? '#d98fff' : '#b44aff',
                fontSize: isBig ? 10 : 7,
                wobble: 0.05,
                wobbleSpeed: 0.08,
            });
        }

        // Update particles
        updateParticles();

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
                    _tailSpeed = 5; // very slow, peaceful
                    triggerStretch();
                    if (!currentSpeech) setSpeechText(pickRandom(IDLE_SPEECH[2]), 5000);
                } else if (newIdleLevel === 3 && prevLevel < 3) {
                    setExpression('sleepy');
                    _tailSpeed = 6; // almost still
                    setSpeechText(pickRandom(IDLE_SPEECH[3]), 6000);
                } else if (newIdleLevel === 1 && prevLevel < 1) {
                    // Just restless — subtle hint
                    if (!currentSpeech) setSpeechText(pickRandom(IDLE_SPEECH[1]), 5000);
                } else if (newIdleLevel === 0 && prevLevel > 0) {
                    // Woke up from idle
                    setExpression('neutral');
                    _tailSpeed = 2;
                    if (prevLevel >= 3 && !currentSpeech) {
                        setSpeechText('*проснулся* Мяу? Ты вернулся!', 4000);
                    }
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

    // Extract slash command from tip text (e.g., "/commit для автокоммита" → "/commit ")
    function extractSlashAction(text) {
        if (!text) return null;
        const match = text.match(/(\/[a-zA-Z.]+(?:\s|$))/);
        return match ? { type: 'insert', value: match[1] } : null;
    }

    function setSpeech(type) {
        const pool = SPEECH[type] || SPEECH.idle;
        currentSpeech = pickRandom(pool);
        _speechAction = null;
        if (speechTimer) clearTimeout(speechTimer);
        speechTimer = setTimeout(() => { currentSpeech = ''; _speechAction = null; }, 6000);
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
            _speechAction = extractSlashAction(currentSpeech);
            if (speechTimer) clearTimeout(speechTimer);
            speechTimer = setTimeout(() => { currentSpeech = ''; _speechAction = null; }, 6000);
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
            _glintX = 0;
            _glintY = 0;
            animating = true;
            _mouseTracking = true;
            document.addEventListener('mousemove', _onMouseMove);

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
            _particles = [];
            _mouseTracking = false;
            document.removeEventListener('mousemove', _onMouseMove);
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
                neutral: 2, happy: 1, sleepy: 5, surprised: 1,
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

        /** Get current speech action (clickable command). */
        getSpeechAction() {
            return _speechAction;
        },

        /** Consume speech action (clear after use). */
        consumeSpeechAction() {
            const action = _speechAction;
            _speechAction = null;
            return action;
        },

        /** Set speech text directly (for external page-aware tips). */
        setSpeechText(text, durationMs, action) {
            _lastInteractionTime = Date.now();
            currentSpeech = text || '';
            _speechAction = action || null;
            if (speechTimer) clearTimeout(speechTimer);
            if (durationMs && text) {
                speechTimer = setTimeout(() => { currentSpeech = ''; _speechAction = null; }, durationMs);
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
                const milestoneText = pickRandom(SPEECH.milestone).replace('{n}', expNum);
                setSpeechText(milestoneText, 5000);
                triggerPawWave();
                // Celebration sparkles
                for (let s = 0; s < 5; s++) {
                    spawnParticle({
                        x: BODY_POS.x + 2 + Math.random() * 14,
                        y: BODY_POS.y - 3 + Math.random() * 6,
                        vx: (Math.random() - 0.5) * 0.25,
                        vy: -0.1 - Math.random() * 0.1,
                        life: 30 + Math.floor(Math.random() * 20),
                        char: Math.random() < 0.5 ? '✦' : '★',
                        color: Math.random() < 0.5 ? '#ffd700' : '#b44aff',
                        fontSize: 6 + Math.floor(Math.random() * 3),
                        wobble: 0.12,
                        wobbleSpeed: 0.18,
                    });
                }
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
                    setSpeechText(pickRandom(SPEECH.streak_keep).replace('{n}', streak), 5000);
                    _purrrTicks = 30;
                    setTimeout(() => { if (animating) setExpression('neutral'); }, 5000);
                    return;
                }
                if (streak >= 3) {
                    setExpression('happy');
                    setSpeechText(pickRandom(SPEECH.streak_keep).replace('{n}', streak), 4000);
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
                    setSpeechText(pickRandom(SPEECH.streak_discard).replace('{n}', streak), 5000);
                    _tailSpeed = 4; // erratic
                    setTimeout(() => { if (animating) { setExpression('neutral'); _tailSpeed = 2; } }, 5000);
                    return;
                }
                // Single discard — encouraging phrase
                setExpression('neutral');
                setSpeechText(pickRandom(SPEECH.discard_single), 4000);
                setTimeout(() => { if (animating) setExpression('neutral'); }, 4000);
                return;
            }

            // High score celebration (>= 0.9)
            if (score >= 0.9 && isKeep) {
                setExpression('happy');
                const scoreText = (score * 100).toFixed(0);
                setSpeechText(pickRandom(SPEECH.high_score).replace('{s}', scoreText), 4000);
                _purrrTicks = 25;
                triggerPawWave();
                setTimeout(() => { if (animating) setExpression('neutral'); }, 4000);
                return;
            }

            // Error reaction
            if (isError) {
                setExpression('surprised');
                setSpeechText(pickRandom(SPEECH.error), 4000);
                triggerEarTwitch();
                setTimeout(() => { if (animating) setExpression('neutral'); }, 4000);
                return;
            }
        },

        /**
         * React to a tool call from the agent in real-time.
         * @param {string} toolType - 'read'|'edit'|'write'|'bash'|'search'|'other'
         * @param {string} detail - tool detail (filename, command, pattern, etc.)
         * @returns {boolean} true if reaction was triggered
         */
        reactToToolCall(toolType, detail) {
            if (!animating || !toolType) return false;
            if (_toolReactCooldown > 0) return false;
            _lastInteractionTime = Date.now();

            const now = Date.now();
            _toolHistory.push({ type: toolType, ts: now });
            // Keep last 20 tool calls
            if (_toolHistory.length > 20) _toolHistory.shift();

            // Pattern detection (needs 3+ history)
            if (_toolHistory.length >= 3) {
                const recent = _toolHistory.slice(-5);
                const last3 = recent.slice(-3);
                const allSame = last3.every(t => t.type === toolType);

                if (allSame && last3.length >= 3) {
                    const patternKey = 'many_' + (toolType === 'read' ? 'reads' : toolType === 'edit' ? 'edits' : toolType === 'bash' ? 'bash' : null);
                    if (patternKey && TOOL_PATTERN_REACTIONS[patternKey]) {
                        setSpeechText(pickRandom(TOOL_PATTERN_REACTIONS[patternKey]), 4000);
                        if (toolType === 'bash') { setExpression('surprised'); triggerEarTwitch(); }
                        else if (toolType === 'edit') { setExpression('thinking'); }
                        else { setExpression('sleepy'); }
                        _toolReactCooldown = 15; // 15 ticks (~1.8s) cooldown after pattern
                        return true;
                    }
                }

                // Cross-tool patterns: edit after write, bash after edit, search then read
                if (recent.length >= 2) {
                    const prev = recent[recent.length - 2];
                    const prev2 = recent.length >= 3 ? recent[recent.length - 3] : null;
                    if (prev.type === 'write' && toolType === 'edit' && Math.random() < 0.4) {
                        setSpeechText(pickRandom(TOOL_PATTERN_REACTIONS.edit_after_write), 4000);
                        setExpression('surprised');
                        _toolReactCooldown = 10;
                        return true;
                    }
                    if (prev.type === 'edit' && toolType === 'bash' && Math.random() < 0.5) {
                        setSpeechText(pickRandom(TOOL_PATTERN_REACTIONS.bash_after_edit), 4000);
                        setExpression('happy');
                        _toolReactCooldown = 10;
                        return true;
                    }
                    if (prev.type === 'search' && toolType === 'read' && Math.random() < 0.3) {
                        setSpeechText(pickRandom(TOOL_PATTERN_REACTIONS.search_then_read), 4000);
                        setExpression('thinking');
                        _toolReactCooldown = 8;
                        return true;
                    }
                }
            }

            // Standard per-tool reaction (rate-limited by chance)
            const cfg = TOOL_CALL_REACTIONS[toolType] || TOOL_CALL_REACTIONS.other;
            if (Math.random() > cfg.chance) return false;

            // Build contextual message if detail available
            let message;
            const hasContext = detail && detail.length > 0 && detail.length < 80;
            if (hasContext && cfg.contextual && Math.random() < 0.6) {
                // Use contextual template with detail
                const tpl = pickRandom(cfg.contextual);
                const shortDetail = detail.length > 40 ? detail.slice(0, 37) + '...' : detail;
                message = tpl.replace('{file}', shortDetail).replace('{detail}', shortDetail);
            } else {
                message = pickRandom(cfg.generic);
            }

            setExpression(pickRandom(cfg.expressions));
            setSpeechText(message, 3500);
            _toolReactCooldown = 6; // ~0.7s cooldown

            // Occasional ear twitch for edits and bash
            if ((toolType === 'edit' || toolType === 'bash') && Math.random() < 0.4) {
                triggerEarTwitch();
            }
            // Paw wave for writes (new files are exciting!)
            if (toolType === 'write' && Math.random() < 0.3) {
                triggerPawWave();
            }

            return true;
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
                        const tip = pickRandom(tips);
                        setSpeechText(tip, 6000, extractSlashAction(tip));
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
                // Burst of hearts on pet
                for (let h = 0; h < 3; h++) {
                    spawnParticle({
                        x: HEAD_POS.x + 8 + Math.random() * 10,
                        y: HEAD_POS.y - 2 + Math.random() * 5,
                        vx: (Math.random() - 0.5) * 0.3,
                        vy: -0.12 - Math.random() * 0.08,
                        life: 20 + Math.floor(Math.random() * 10),
                        char: '♥',
                        color: '#ff69b4',
                        fontSize: 7 + Math.floor(Math.random() * 2),
                        wobble: 0.15,
                        wobbleSpeed: 0.2,
                    });
                }
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
