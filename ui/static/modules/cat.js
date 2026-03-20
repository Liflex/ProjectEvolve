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

    // Body — lying down, horizontal (26×10)
    const BODY_LYING = {
        w: 26, h: 10,
        outline: decode([
            0x20,0x00,0x00,0x01, 0x40,0x00,0x80,0x00, 0x40,0x00,0x80,0x00,
            0x40,0x00,0x80,0x00, 0x40,0x00,0x80,0x00, 0x40,0x00,0x80,0x00,
            0x20,0x00,0x00,0x01, 0x10,0x00,0x02,0x00, 0x08,0x00,0x04,0x00,
            0x02,0x00,0x10,0x00
        ], 26, 10),
        fill: decode([
            0x3F,0xFF,0xFF,0x00, 0x7F,0xFF,0xFF,0x80, 0x7F,0xFF,0xFF,0x80,
            0x7F,0xFF,0xFF,0x80, 0x7F,0xFF,0xFF,0x80, 0x7F,0xFF,0xFF,0x80,
            0x3F,0xFF,0xFF,0x00, 0x1F,0xFF,0xFE,0x00, 0x0F,0xFF,0xFC,0x00,
            0x03,0xFF,0xF0,0x00
        ], 26, 10)
    };

    // Front paws — lying down (13×4)
    const PAWS_LYING = {
        w: 13, h: 4,
        outline: decode([
            0x60,0x06, 0x70,0x0E, 0x38,0x1C, 0x1F,0x00
        ], 13, 4),
        fill: decode([
            0x60,0x06, 0x70,0x0E, 0x38,0x1C, 0x1F,0x00
        ], 13, 4)
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

    // Eyes - love: heart-shaped eyes (17x4, 1 frame)
    const EYES_LOVE = [
        decode([0x60,0x18,0x00, 0x78,0x1E,0x00, 0x7C,0x3E,0x00, 0x38,0x1C,0x00], 17, 4),
    ];

    // Eyes - sad: droopy narrow eyes with angled brows (17x4, 1 frame)
    const EYES_SAD = [
        decode([0x30,0x0C,0x00, 0x70,0x1C,0x00, 0x30,0x0C,0x00, 0x30,0x0C,0x00], 17, 4),
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

    // Lying pose positions — head at top, body horizontal below, paws between
    const LIE_HEAD_POS = { x: 13, y: 1 };
    const LIE_BODY_POS = { x: 1, y: 25 };
    const LIE_PAWS_POS = { x: 10, y: 22 };
    const LIE_TAIL_POS = { x: 0, y: 14 };

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
        love:      { frames: EYES_LOVE,     x: 9 + OX,  y: 10 + OY, color: '#ff69b4', blinkSpeed: 0 },
        sad:       { frames: EYES_SAD,      x: 9 + OX,  y: 11 + OY, color: '#6688bb', blinkSpeed: 0 },
    };

    // Eye glint centers for cursor tracking — [leftEyeCenter, rightEyeCenter] relative to EYE_CFG position
    // Only expressions with open eyes get glints (not happy/sleepy)
    const EYE_GLINT = {
        neutral:   { left: [3, 2], right: [12, 2] },
        surprised: { left: [3, 2], right: [12, 2] },
        angry:     { left: [2, 1], right: [12, 1] },
        thinking:  { left: [3, 2], right: [12, 2] },
        sad:       { left: [3, 1], right: [12, 1] },
        // love has no glint — heart sprites cover the eyes
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
    // Love: cat 'w' mouth (7×2)
    const MOUTH_LOVE = decode([0x6C, 0x7C], 7, 2);
    // Sad: frown (7×2)
    const MOUTH_SAD = decode([0x7C, 0x38], 7, 2);

    // Mouth config: { sprite, x-offset from HEAD_POS, y-offset from HEAD_POS, color }
    const MOUTH_CFG = {
        neutral:   { sprite: MOUTH_NEUTRAL,   dx: 10, dy: 15, color: '#b44aff' },
        happy:     { sprite: MOUTH_HAPPY,     dx: 9,  dy: 14, color: '#ff69b4' },
        surprised: { sprite: MOUTH_SURPRISED, dx: 10, dy: 14, color: '#ff69b4' },
        angry:     { sprite: MOUTH_ANGRY,     dx: 9,  dy: 14, color: '#ff3355' },
        thinking:  { sprite: MOUTH_THINKING,  dx: 10, dy: 15, color: '#88aaff' },
        sleepy:    { sprite: MOUTH_SLEEPY,    dx: 11, dy: 16, color: '#b44aff' },
        love:      { sprite: MOUTH_LOVE,     dx: 9,  dy: 15, color: '#ff69b4' },
        sad:       { sprite: MOUTH_SAD,      dx: 9,  dy: 15, color: '#6688bb' },
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
        love:      { droop: -2, spread: 1.2,  color: '#ff69b4', wobble: 0 },
        sad:       { droop: 3,  spread: 0.8,  color: '#6688bb', wobble: 1 },
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
        typing_start: [
            '*подкрался* Что пишешь?',
            '*уши навострил* О, сообщение!',
            'Мурр? Пишешь мне? =^.^=',
            '*заинтересованно смотрит*',
            '*принюхался* Что-то интересное?',
        ],
        typing_long: [
            '*нетерпеливо* Длинное сообщение...',
            'Много букав! *хвост дёргается*',
            '*ждёт* Почти написал?',
            'Эссе? =^.^= *уснул от скуки*',
            '*скучает* Может уже отправишь?',
        ],
        typing_stop: [
            '* ждёт отправки* ...',
            'Ну? Отправляй! Мяу!',
            '*нетерпеливо* Жду-у-у...',
            'Enter нажми! =^.^=',
        ],
        love: [
            '*мурррр...* ♥ =^_^=',
            'Ты самый лучший! Мурр!',
            '*трётся о руку* Люблю!',
            '*довольно жмурится* Мяу~',
            'Ещё! Не останавливайся! ♥',
            '*счастливый писк* =^._.^=',
            'Мур-мур-мур! Ты волшебник!',
            '*переворачивается* Чешешь идеально!',
        ],
        sad: [
            '*грустно смотрит* Мяу...',
            'Не расстраивай меня...',
            '*опустил уши* Мрр...',
            '*тихое мурчание* Всё будет хорошо...',
            '*прижался* Мне грустно...',
            'Мяу... *вздыхает*',
            '*обнял лапкой* Не грусти...',
        ],
        lying_down: [
            '*ложится* Мурр...',
            '*растянулся* Уютно_',
            '*сворачивается* Спать...',
            '*зевает* Лягу_',
            '*укладывается* Мррр...',
            '*принюхался* Мягкое место_',
        ],
        standing_up: [
            '*встаёт* Мяу!',
            '*потянулся* Ох...',
            '*поднимается* Готов!',
            '*расправляется* Ну вот_',
            '*встряхнулся* Проснулся!',
        ],
        sneeze: [
            'Апчхи! =O_O=',
            '*Апчхи!* Мяу?!',
            'А-апчхи!... *трёт нос*',
            '*чихает* Мяу! Прости_',
            'Апчхи! *вздрагивает*',
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

    // Agent response keyword-based skill suggestions (analyzes text content for context)
    const AGENT_CONTEXT_SKILL_TIPS = [
        {
            keywords: ['commit', 'коммит', 'git add', 'git commit', 'git push', 'изменения зафиксиров'],
            skills: ['/commit'],
            tips: [
                'Изменения готовы? /commit создаст коммит! =^_^=',
                'Пора коммитить! /commit поможет! Мяу!',
                'Фиксируем результат? /commit — одна команда!',
            ],
        },
        {
            keywords: ['refactor', 'рефакторинг', 'refactoring', 'упростить код', 'чистота кода', 'дубликат', 'duplicate'],
            skills: ['/simplify'],
            tips: [
                'Рефакторинг? /simplify проверит качество! Мурр!',
                '/simplify найдёт дубликаты и проблемы!',
                'Код можно лучше? /simplify подскажет_',
            ],
        },
        {
            keywords: ['тест', 'test', 'тестирован', 'unit test', 'pytest', 'assert', 'coverage'],
            skills: ['/code-reviewer'],
            tips: [
                'Тесты? /code-reviewer проверит качество! =^.^=',
                '/code-reviewer — ревью с фокусом на тесты!',
                '*уши навострил* Тесты важны! /code-reviewer поможет_',
            ],
        },
        {
            keywords: ['security', 'безопасность', 'vulnerability', 'xss', 'sql injection', 'auth', 'уязвимость'],
            skills: ['/code-reviewer'],
            tips: [
                'Безопасность? /code-reviewer найдёт уязвимости!',
                '*тревожно* Security matters! /code-reviewer проверит_',
                '/code-reviewer — security-аудит включён!',
            ],
        },
        {
            keywords: ['spec', 'спецификац', 'требован', 'feature', 'фича', 'план реализац', 'задача'],
            skills: ['/speckit.specify', '/speckit.features'],
            tips: [
                'Нужна спецификация? /speckit.specify создаст!',
                'Фича? /speckit.features для быстрого старта! =^_^=',
                '/speckit.plan — план реализации из спецификации!',
            ],
        },
        {
            keywords: ['deploy', 'деплой', 'release', 'релиз', 'production', 'продакшн', 'ci/cd', 'pipeline'],
            skills: ['/push'],
            tips: [
                'Релиз? /push автоматизирует деплой! Мяу!',
                '/push — релиз одной командой! =^.^=',
                'CI/CD? /push запустит пайплайн!',
            ],
        },
        {
            keywords: ['баг', 'bug', 'ошибк', 'error', 'fix', 'починить', 'исправить', 'crash', 'exception'],
            skills: ['/simplify'],
            tips: [
                'Баг? /simplify поможет найти корень проблемы!',
                '*концентрируется* /simplify проанализирует код_',
                'Fixing bugs? /simplify проверит решение!',
            ],
        },
        {
            keywords: ['документац', 'document', 'readme', 'docstring', 'комментари', 'описан'],
            skills: ['/code-reviewer'],
            tips: [
                'Документация? /code-reviewer проверит полноту!',
                '/code-reviewer найдёт недостающие доки_',
                '*кивает* Хорошая документация = хороший проект!',
            ],
        },
        {
            keywords: ['prompt', 'промпт', 'system prompt', 'claude', 'llm', 'ai агент', 'модель'],
            skills: ['/speckit.clarify'],
            tips: [
                'Улучши промпт? /speckit.clarify найдёт пробелы!',
                '/speckit.clarify — анализ спецификации! Мяу!',
            ],
        },
        {
            keywords: ['производительн', 'performance', 'оптимиз', 'медленн', 'slow', 'быстрее', 'ускорить'],
            skills: ['/simplify'],
            tips: [
                'Оптимизация? /simplify найдёт узкие места!',
                '/simplify — анализ производительности кода!',
            ],
        },
    ];

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

    // Chat context for idle tips (set from chat module)
    let _chatContextMessages = null;

    /**
     * Internal: analyze recent messages and return contextual skill suggestion.
     * Used by both idle tips timer and public API.
     */
    function _getContextualSkillSuggestion(messages) {
        if (!messages || messages.length === 0) return null;
        const recentText = messages
            .slice(-6)
            .map(m => (m.content || '').replace(/<[^>]*>/g, ''))
            .join(' ')
            .toLowerCase();

        // Check for "completed action" patterns — suggest follow-up
        const followUpPatterns = [
            { pattern: /(?:создал|created|написал|wrote|добавил|added|реализовал|implemented)\s+\S+\s+(?:файл|file|модуль|module|класс|class|функци|function)/i,
              tips: ['Файл готов! /code-reviewer проверит? =^_^=', 'Создано! /simplify для качества кода!'],
              skill: '/code-reviewer' },
            { pattern: /(?:исправил|fixed|починил|ремонтировал|resolved)\s+(?:баг|bug|ошибк|error|issue)/i,
              tips: ['Баг пофиксен! /commit сохраним? Мяу!', 'Фикс готов! Не забудь /commit!'],
              skill: '/commit' },
            { pattern: /(?:все тест|all test|тесты прох|tests pass|тесты зелен|tests green)/i,
              tips: ['Тесты зелёные! /commit фиксирует прогресс! =^_^='],
              skill: '/commit' },
            { pattern: /(?:рефакторинг|refactor|упростил|simplif|очистил|cleaned)/i,
              tips: ['Рефакторинг завершён! /code-reviewer подтвердит качество!'],
              skill: '/code-reviewer' },
            { pattern: /(?:зависимость|dependenc|обновил|updated|upgrade|npm install|pip install)/i,
              tips: ['Зависимости обновлены! /simplify проверит совместимость!'],
              skill: '/simplify' },
            { pattern: /(?:документац|documented|readme|docstring|комментари|comment)/i,
              tips: ['Доки готовы! /commit сохраним? =^.^='],
              skill: '/commit' },
            { pattern: /(?:настроил|configured|setup|config|установил|installed)/i,
              tips: ['Настройка завершена! /commit для фиксации!'],
              skill: '/commit' },
        ];

        for (const { pattern, tips, skill } of followUpPatterns) {
            if (pattern.test(recentText)) {
                return { tip: pickRandom(tips), skill };
            }
        }

        // Fallback: keyword match from AGENT_CONTEXT_SKILL_TIPS
        for (const group of AGENT_CONTEXT_SKILL_TIPS) {
            if (group.keywords.some(kw => recentText.includes(kw))) {
                return { tip: pickRandom(group.tips), skill: pickRandom(group.skills) };
            }
        }

        return null;
    }

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
            'Погладь меня! *надеется* =^._.^=',
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
    let _userTyping = false;               // user is typing in chat input
    let _userTypingTimer = null;           // debounce timer for typing stop
    let _pose = 'sitting';                 // 'sitting' | 'lying'
    let _poseTransition = 0;               // ticks remaining for pose transition animation
    let _headTiltAngle = 0;                // current head tilt angle in degrees (-6 to 6)
    let _headTiltTarget = 0;               // target tilt angle (smoothly interpolated)
    let _headTiltTicks = 0;                // ticks remaining for forced tilt hold
    let _bounceTicks = 0;                  // remaining ticks for body bounce
    let _bounceOffset = 0;                 // current bounce Y offset (pixels)
    let _sneezeTicks = 0;                  // remaining ticks for sneeze animation
    let _sneezePhase = 0;                  // 0=none, 1=pre, 2=jerks, 3=recover

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
        { expr: 'thinking', speech: '*прищурился* Чего надо?', anim: 'headTilt' },
        { expr: 'surprised', speech: 'Не трогай! *шипение*', anim: 'earTwitch' },
        { expr: 'happy', speech: 'Ещё! Ещё! =^._.^=', anim: 'pawWave' },
        { expr: 'neutral', speech: 'Мяу~', anim: 'headTilt' },
        { expr: 'thinking', speech: '*наклонил голову*...', anim: 'headTilt' },
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
        const isLying = _pose === 'lying';

        // Select positions based on pose
        const headBase = isLying ? LIE_HEAD_POS : HEAD_POS;
        const bodyBase = isLying ? LIE_BODY_POS : BODY_POS;
        const tailBase = isLying ? LIE_TAIL_POS : TAIL_POS;

        // Stretch offsets (sitting only — lying cats don't stretch the same way)
        let bodyOffX = 0, bodyOffY = 0, headExtraY = 0;
        if (_stretchTicks > 0 && !isLying) {
            if (_stretchPhase === 1 || _stretchPhase === 2) {
                bodyOffY = 1;
                headExtraY = -2;
            } else if (_stretchPhase === 0) {
                bodyOffY = -1;
                headExtraY = 1;
            }
        }

        // Breathing: subtle continuous body oscillation (sitting only)
        if (!isLying) {
            const breathPeriod = expression === 'sleepy' || _idleLevel >= 2 ? 40 : 25;
            const breathAmp = expression === 'sleepy' || _idleLevel >= 2 ? 0.4 : 0.3;
            bodyOffY += Math.sin(_tickCount / breathPeriod * Math.PI * 2) * breathAmp;
        }

        // Purr vibration: subtle body shake
        if (_purrrTicks > 0) {
            bodyOffX += Math.random() < 0.5 ? -1 : 1;
        }

        // Tail position adjustment based on expression/mood
        let tailOffX = 0, tailOffY = 0;
        if (expression === 'happy' || _mood === 'happy') {
            tailOffY = -1;
        } else if (expression === 'angry') {
            tailOffX = 1; tailOffY = -1;
        } else if (expression === 'sleepy' || _idleLevel >= 2 || isLying) {
            tailOffX = 2; tailOffY = 1; // curled forward
        } else if (expression === 'thinking') {
            tailOffY = 1;
        } else if (expression === 'love') {
            tailOffY = -2;
            tailOffX = -1;
        } else if (expression === 'sad') {
            tailOffX = 3;
            tailOffY = 2;
        }
        const tailPos = { x: tailBase.x + tailOffX, y: tailBase.y + tailOffY + _bounceOffset };

        // Z-order differs by pose:
        // Sitting: tail → body → head → paw → eyes → whiskers → particles
        // Lying:  tail → body → paws → head → eyes → whiskers → particles
        drawFilled(TAIL_OUTLINES[tailFrame], TAIL_FILLS[tailFrame], tailPos, outlineColor, fillColor, true);

        if (isLying) {
            // Lying body (horizontal)
            drawFilled(BODY_LYING.outline, BODY_LYING.fill,
                { x: bodyBase.x + bodyOffX, y: bodyBase.y + bodyOffY + _bounceOffset },
                outlineColor, fillColor);
            // Front paws between head and body
            drawGrid(PAWS_LYING.outline, LIE_PAWS_POS.x, LIE_PAWS_POS.y + _bounceOffset, outlineColor);
        } else {
            // Sitting body (vertical)
            drawFilled(BODY.outline, BODY.fill,
                { x: bodyBase.x + bodyOffX, y: bodyBase.y + bodyOffY + _bounceOffset },
                outlineColor, fillColor);
        }

        // Paw wave animation (sitting only — drawn before head tilt so it's not rotated)
        if (!isLying && _pawWaveTicks > 0 && (_pawWavePhase === 1 || _pawWavePhase === 2)) {
            const pawX = bodyBase.x + 12 + bodyOffX;
            const pawBaseY = bodyBase.y + 14 + bodyOffY + _bounceOffset;
            const pawLift = _pawWavePhase === 2 ? 3 : 2;
            drawFilled(PAW_OUTLINE, PAW_FILL,
                { x: pawX, y: pawBaseY - pawLift },
                outlineColor, fillColor);
        }

        // === Head tilt: canvas rotation around neck pivot ===
        // Sneeze head jerk
        let sneezeOffX = 0, sneezeOffY = 0;
        if (_sneezePhase === 1) {
            // Pre-sneeze: head pulls back slightly
            sneezeOffY = 1;
        } else if (_sneezePhase === 2) {
            // Sneeze jerk: head snaps forward
            sneezeOffX = 2;
            sneezeOffY = -1;
        } else if (_sneezePhase === 3) {
            // Recovery: subtle residual shake
            sneezeOffX = Math.random() < 0.5 ? 0.5 : -0.5;
        }
        const headDrawX = headBase.x + _headOffX + sneezeOffX;
        const headDrawY = headBase.y + _headOffY + headExtraY + _bounceOffset + sneezeOffY;
        const tiltRad = _headTiltAngle * Math.PI / 180;
        const pivotX = (headDrawX + HEAD.w / 2) * ps;
        const pivotY = (headDrawY + HEAD.h - 2) * ps;

        if (Math.abs(tiltRad) > 0.001) {
            ctx.save();
            ctx.translate(pivotX, pivotY);
            ctx.rotate(tiltRad);
            ctx.translate(-pivotX, -pivotY);
        }

        // Head with ear twitch + stretch offset
        drawFilled(HEAD.outline, HEAD.fill,
            { x: headDrawX, y: headDrawY },
            outlineColor, fillColor);

        // Eyes — compute position relative to head base (works for both poses)
        const eyeRelX = cfg.x - HEAD_POS.x;
        const eyeRelY = cfg.y - HEAD_POS.y;
        const eyeAbsX = headDrawX + eyeRelX;
        const eyeAbsY = headDrawY + eyeRelY;

        const frames = cfg.frames;
        if (frames && frames.length > 0 && frames[eyeFrame]) {
            drawGrid(frames[eyeFrame], eyeAbsX, eyeAbsY, eyeColor);
        }

        // Cursor-tracking eye glints
        const glintCfg = EYE_GLINT[expression];
        if (glintCfg && _mouseTracking && _idleLevel < 2 && !isLying) {
            const isBlinking = expression === 'neutral' && eyeFrame === 1;
            const isSleepyBlink = expression === 'sleepy' && (eyeFrame === 2 || eyeFrame === 0);
            if (!isBlinking && !isSleepyBlink) {
                const rect = canvas.getBoundingClientRect();
                const catScreenX = rect.left + rect.width / 2;
                const catScreenY = rect.top + rect.height * (isLying ? 0.15 : 0.4);
                const dx = _mouseX - catScreenX;
                const dy = _mouseY - catScreenY;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const targetX = (dx / dist);
                const targetY = (dy / dist);
                _glintX += (targetX - _glintX) * 0.12;
                _glintY += (targetY - _glintY) * 0.12;
                const gx = Math.round(_glintX);
                const gy = Math.round(_glintY);
                const eox = _headOffX;
                const eoy = _headOffY + headExtraY;
                ctx.fillStyle = '#ffffff';
                const lx = eyeAbsX + glintCfg.left[0] + gx;
                const ly = eyeAbsY + glintCfg.left[1] + gy;
                ctx.fillRect(lx * ps, ly * ps, ps, ps);
                const rx = eyeAbsX + glintCfg.right[0] + gx;
                const ry = eyeAbsY + glintCfg.right[1] + gy;
                ctx.fillRect(rx * ps, ry * ps, ps, ps);
            }
        }

        // Head position for whiskers/mouth
        const hx = headDrawX;
        const hy = headDrawY;

        renderMouth(hx, hy);
        renderWhiskers(hx, hy);

        // End head tilt transform
        if (Math.abs(tiltRad) > 0.001) {
            ctx.restore();
        }

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

        // Head tilt: smooth rotation for curious/thinking expression, random idle
        if (_headTiltTicks > 0) {
            _headTiltTicks--;
            if (_headTiltTicks === 0) _headTiltTarget = 0;
        }
        // Trigger head tilt during thinking/surprised expressions
        if ((expression === 'thinking' || expression === 'surprised') && _headTiltTicks === 0 && Math.random() < 0.03) {
            _headTiltTarget = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3);
            _headTiltTicks = 8 + Math.floor(Math.random() * 6);
        }
        // Random head tilt during neutral idle
        else if (expression === 'neutral' && _idleLevel === 0 && _earTwitchTicks === 0 && _stretchTicks === 0 && _headTiltTicks === 0 && Math.random() < 0.005) {
            _headTiltTarget = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 2);
            _headTiltTicks = 6 + Math.floor(Math.random() * 4);
        }
        // Smooth interpolation toward target
        _headTiltAngle += (_headTiltTarget - _headTiltAngle) * 0.15;
        if (Math.abs(_headTiltAngle) < 0.1 && _headTiltTarget === 0) _headTiltAngle = 0;

        // Body bounce: oscillating Y offset during celebrations
        if (_bounceTicks > 0) {
            _bounceTicks--;
            _bounceOffset = Math.sin(_bounceTicks * 0.6) * 1.5;
        } else {
            _bounceOffset *= 0.8;
            if (Math.abs(_bounceOffset) < 0.1) _bounceOffset = 0;
        }

        // Sneeze: rare random animation
        if (_sneezeTicks > 0) {
            _sneezeTicks--;
            if (_sneezeTicks === 0) {
                _sneezePhase = 0;
                // Return to neutral after sneeze
                if (expression === 'surprised' && _idleLevel === 0) {
                    setTimeout(() => { if (animating) setExpression('neutral'); }, 1500);
                }
            } else if (_sneezeTicks < 3) {
                _sneezePhase = 3; // recovery shake
            } else if (_sneezeTicks < 5) {
                _sneezePhase = 2; // sneeze jerk
            } else {
                _sneezePhase = 1; // pre-sneeze pull back
            }
        } else if (expression === 'neutral' && _idleLevel < 2 && _stretchTicks === 0 && _pawWaveTicks === 0 && Math.random() < 0.001) {
            // ~0.1% per tick ≈ every ~2 min at 120ms interval
            triggerSneeze();
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

        // Purr vibration: body micro-shake when happy/love (triggered externally or by mood)
        if (_purrrTicks > 0) {
            _purrrTicks--;
            // Spawn heart/sparkle particles during purr
            if (_tickCount % 5 === 0) {
                const isLove = expression === 'love';
                spawnParticle({
                    x: BODY_POS.x + 3 + Math.random() * 12,
                    y: BODY_POS.y + 2 + Math.random() * 4,
                    vx: (Math.random() - 0.5) * (isLove ? 0.25 : 0.15),
                    vy: -0.08 - Math.random() * (isLove ? 0.1 : 0.06),
                    life: 25 + Math.floor(Math.random() * (isLove ? 20 : 15)),
                    char: isLove ? (Math.random() < 0.7 ? '♥' : '✦') : (Math.random() < 0.4 ? '♥' : '✦'),
                    color: isLove ? (Math.random() < 0.7 ? '#ff69b4' : '#ff1493') : (Math.random() < 0.4 ? '#ff69b4' : '#ffd700'),
                    fontSize: 6 + Math.floor(Math.random() * (isLove ? 3 : 2)),
                    wobble: isLove ? 0.15 : 0.1,
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
                    // Deep sleep → lie down
                    setExpression('sleepy');
                    _tailSpeed = 6; // almost still
                    _pose = 'lying';
                    if (!currentSpeech) {
                        setSpeechText(pickRandom(SPEECH.lying_down), 5000);
                    }
                } else if (newIdleLevel === 1 && prevLevel < 1) {
                    if (!currentSpeech) setSpeechText(pickRandom(IDLE_SPEECH[1]), 5000);
                } else if (newIdleLevel === 0 && prevLevel > 0) {
                    // Woke up from idle — stand up if lying
                    if (_pose === 'lying') {
                        _pose = 'sitting';
                        if (!currentSpeech) {
                            setSpeechText(pickRandom(SPEECH.standing_up), 4000);
                        }
                    }
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
                // Try contextual skill suggestion from recent messages
                if (_chatContextMessages && _chatContextMessages.length > 0 && Math.random() < 0.4) {
                    const suggestion = _getContextualSkillSuggestion(_chatContextMessages);
                    if (suggestion) {
                        currentSpeech = suggestion.tip;
                        _speechAction = suggestion.skill;
                        render();
                        return;
                    }
                }
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
    //  SNEEZE ANIMATION
    // ================================================================

    function triggerSneeze() {
        if (_sneezeTicks > 0 || !animating) return;
        _sneezeTicks = 8;
        _sneezePhase = 1;
        setExpression('surprised');
        setSpeechText(pickRandom(SPEECH.sneeze), 3000);
        triggerEarTwitch();
        // Small particle burst from nose area
        for (let s = 0; s < 4; s++) {
            spawnParticle({
                x: HEAD_POS.x + 11 + Math.random() * 4,
                y: HEAD_POS.y + 14 + Math.random() * 2,
                vx: (Math.random() - 0.5) * 0.3,
                vy: 0.1 + Math.random() * 0.15,
                life: 12 + Math.floor(Math.random() * 8),
                char: Math.random() < 0.5 ? '·' : '°',
                color: '#d98fff',
                fontSize: 5 + Math.floor(Math.random() * 3),
                wobble: 0.08,
                wobbleSpeed: 0.12,
            });
        }
    }

    // ================================================================
    //  PUBLIC API
    // ================================================================

    window.CatModule = {

        /**
         * Start animation on a canvas element.
         * @param {HTMLCanvasElement} el - canvas element
         * @param {string} expr - 'neutral'|'happy'|'sleepy'|'surprised'|'angry'|'thinking'|'love'|'sad'
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
            _pose = 'sitting';
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
            // Reset head tilt when expression changes (except thinking/surprised which trigger it)
            if (expr !== 'thinking' && expr !== 'surprised') {
                _headTiltTarget = 0;
                _headTiltTicks = 0;
            }
            // Adjust tail speed based on expression
            const tailSpeeds = {
                neutral: 2, happy: 1, sleepy: 5, surprised: 1,
                angry: 3, thinking: 3, love: 1, sad: 4,
            };
            _tailSpeed = tailSpeeds[expr] || 2;
            // Purr when happy
            if (expr === 'happy') _purrrTicks = 20;
            // Head tilt when thinking (curious look)
            if (expr === 'thinking') triggerHeadTilt();
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

        /** Trigger a head tilt animation (curious/confused look). */
        triggerHeadTilt() {
            _headTiltTarget = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3);
            _headTiltTicks = 8 + Math.floor(Math.random() * 6);
        },

        /** Trigger a body bounce animation (celebration/excitement). */
        triggerBounce(ticks) {
            _bounceTicks = ticks || 15;
        },

        /** Trigger a sneeze animation (rare random, or call manually). */
        triggerSneeze() {
            triggerSneeze();
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
                _bounceTicks = 20; // celebration bounce
                triggerHeadTilt();
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
                    _bounceTicks = 15; // excited bounce
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
                // Single discard — sad expression with encouraging phrase
                setExpression('sad');
                const discardMsg = pickRandom(SPEECH.discard_single);
                setSpeechText(discardMsg, 4000);
                triggerEarTwitch();
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

            // Priority 1: keyword-based contextual skill suggestion (higher value for user)
            const lower = content.toLowerCase();
            for (const group of AGENT_CONTEXT_SKILL_TIPS) {
                if (group.keywords.some(kw => lower.includes(kw))) {
                    const tip = pickRandom(group.tips);
                    const skill = pickRandom(group.skills);
                    setSpeechText(tip, 6000, skill);
                    if (Math.random() < 0.5) setExpression('thinking');
                    return;
                }
            }

            // Priority 2: structural analysis (existing behavior)
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
         * Analyze recent chat messages and return a contextual skill suggestion.
         * Called after agent finishes streaming — gives a "next step" tip.
         * @param {Array} messages - recent chat messages (last ~6)
         * @returns {{tip: string, skill: string}|null} suggestion or null
         */
        getContextualSkillSuggestion(messages) {
            return _getContextualSkillSuggestion(messages);
        },

        /**
         * Update chat context for idle tips.
         * Called from chat module when messages change.
         * @param {Array} messages - recent chat messages
         */
        setChatContext(messages) {
            _chatContextMessages = messages;
        },

        /**
         * Get a random idle chat tip (for chat page when user is idle).
         * If messages provided, tries contextual tips first.
         * @param {Array} [messages] - recent chat messages for context
         * @returns {string} tip text
         */
        getChatIdleTip(messages) {
            return _getContextualSkillSuggestion(messages)
                ? _getContextualSkillSuggestion(messages).tip
                : pickRandom(CHAT_IDLE_TIPS);
        },

        /**
         * React to user typing in chat input.
         * Called on each keystroke — debounced internally.
         * Cat looks curious, may comment on long messages.
         */
        onUserTyping(textLength) {
            if (!animating) return;
            _lastInteractionTime = Date.now();

            // Stand up from lying when user types
            if (_pose === 'lying') {
                _pose = 'sitting';
            }

            // Wake from idle
            if (_idleLevel > 0) {
                _idleLevel = 0;
                _tailSpeed = 2;
                if (expression === 'sleepy') setExpression('neutral');
            }

            // First keystroke after not typing — initial reaction
            if (!_userTyping) {
                _userTyping = true;
                // Only react ~30% of the time to avoid spam
                if (Math.random() < 0.3 && !currentSpeech) {
                    setExpression('thinking');
                    setSpeechText(pickRandom(SPEECH.typing_start), 3000);
                    setTimeout(() => {
                        if (animating && expression === 'thinking' && _userTyping) {
                            setExpression('neutral');
                        }
                    }, 3000);
                }
            }

            // Clear existing timer
            if (_userTypingTimer) clearTimeout(_userTypingTimer);

            // Long message reaction (>200 chars while still typing)
            if (textLength > 200 && textLength % 100 < 5 && !currentSpeech && Math.random() < 0.2) {
                setSpeechText(pickRandom(SPEECH.typing_long), 3000);
                if (Math.random() < 0.3) triggerEarTwitch();
            }

            // Set debounce timer: after 3s of no typing, assume stopped
            _userTypingTimer = setTimeout(() => {
                _userTyping = false;
                // Occasional "send it!" nudge if user stopped typing but didn't send
                if (animating && !currentSpeech && Math.random() < 0.15) {
                    setSpeechText(pickRandom(SPEECH.typing_stop), 2500);
                }
            }, 3000);
        },

        /** Check if user is currently typing. */
        isUserTyping() {
            return _userTyping;
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

        /** Get current pose ('sitting' | 'lying'). */
        getPose() {
            return _pose;
        },

        /** Set pose ('sitting' | 'lying'). Triggers speech. */
        setPose(pose) {
            if (!animating) return;
            if (pose !== 'sitting' && pose !== 'lying') return;
            if (_pose === pose) return;
            _pose = pose;
            _lastInteractionTime = Date.now();
            if (pose === 'lying') {
                setExpression('sleepy');
                _tailSpeed = 5;
                setSpeechText(pickRandom(SPEECH.lying_down), 4000);
            } else {
                setExpression('neutral');
                _tailSpeed = 2;
                setSpeechText(pickRandom(SPEECH.standing_up), 3000);
            }
            if (animating) render();
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

            // Stand up from lying pose
            if (_pose === 'lying') {
                _pose = 'sitting';
                _idleLevel = 0;
                _tailSpeed = 2;
                setExpression('surprised');
                triggerEarTwitch();
                setSpeechText('*подпрыгнул* Мяу?!', 3000);
                setTimeout(() => { if (animating) setExpression('neutral'); }, 3000);
                _clickCount = 0;
                return;
            }

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
                // Deep petting (7+ clicks) triggers love expression with heart eyes
                if (_clickCount >= 7) {
                    setExpression('love');
                    setSpeechText(pickRandom(SPEECH.love), 5000);
                    _purrrTicks = 35;
                    _tailSpeed = 1;
                    // Extra heart burst for deep petting
                    for (let h = 0; h < 6; h++) {
                        spawnParticle({
                            x: HEAD_POS.x + 5 + Math.random() * 16,
                            y: HEAD_POS.y - 3 + Math.random() * 8,
                            vx: (Math.random() - 0.5) * 0.35,
                            vy: -0.15 - Math.random() * 0.1,
                            life: 25 + Math.floor(Math.random() * 15),
                            char: Math.random() < 0.6 ? '♥' : '✦',
                            color: Math.random() < 0.6 ? '#ff69b4' : '#ff1493',
                            fontSize: 7 + Math.floor(Math.random() * 3),
                            wobble: 0.15,
                            wobbleSpeed: 0.2,
                        });
                    }
                    return;
                }
                // Normal petting (3-6 clicks) — happy expression
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
            else if (reaction.anim === 'headTilt') triggerHeadTilt();

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
                // Stand up from lying on hover
                if (_pose === 'lying') {
                    _pose = 'sitting';
                    _idleLevel = 1;
                    _tailSpeed = 2;
                    setExpression('neutral');
                    setSpeechText('*встал* Мяу? Ты тут!', 3000);
                    triggerEarTwitch();
                    return;
                }
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
            if (_pose === 'lying') {
                _pose = 'sitting';
            }
            if (_idleLevel > 0) {
                _idleLevel = 0;
                _tailSpeed = 2;
                if (expression === 'sleepy') setExpression('neutral');
            }
        },

        /**
         * Get contextual observation tooltip based on current page and app state.
         * Returns a short string with the cat's "observation" about what's happening.
         * @param {string} page - 'dashboard'|'experiments'|'chat'|'settings'|'run'
         * @param {object} ctx - context data (varies by page)
         * @returns {string} tooltip text (1-2 lines)
         */
        getContextTooltip(page, ctx) {
            if (!animating) return '';
            const p = page || _currentPage || 'dashboard';
            const c = ctx || {};

            // Idle state overrides — cat is sleeping/lying
            if (_idleLevel >= 3 || _pose === 'lying') {
                return pickRandom([
                    '*храпит* zZzZ...',
                    '*лежит* ...zzz...',
                    '*сонно* Мурр... zzz',
                    '*свернулся калачиком*',
                    '*мурчит во сне*...',
                ]);
            }
            if (_idleLevel >= 2) {
                return pickRandom([
                    '*зевает* Скучно...',
                    '*сонно моргает* Жду...',
                    '*крутит головой*...',
                ]);
            }

            // Page-specific observations
            switch (p) {
                case 'dashboard': {
                    const total = c.totalExperiments || 0;
                    const keeps = c.totalKeeps || 0;
                    const score = c.avgScore;
                    if (total === 0) return 'Пусто... Начни исследование!';
                    let line = total + ' эксп. · ' + keeps + ' KEEP';
                    if (score !== undefined) line += ' · ' + (score * 100).toFixed(0) + '%';
                    return line;
                }
                case 'experiments': {
                    const total = c.totalExperiments || 0;
                    const filtered = c.filteredCount;
                    let line = 'Журнал: ' + total + ' записей';
                    if (filtered !== undefined && filtered !== total) line += ' (' + filtered + ' видно)';
                    return line;
                }
                case 'chat': {
                    const sessions = c.sessionCount || 0;
                    const msgs = c.messageCount || 0;
                    const streaming = c.isStreaming;
                    const cost = c.totalCost;
                    const editMode = c.isEditMode;
                    const pinned = c.pinnedCount || 0;
                    const budget = c.budgetPct;
                    if (editMode) {
                        return pickRandom([
                            '*прищурился* Редактируем...',
                            'Осторожно_ Изменяем сообщение!',
                        ]);
                    }
                    if (streaming) {
                        return pickRandom([
                            'Агент работает... ' + msgs + ' сообщ.',
                            'Пишет... *наблюдает*',
                        ]);
                    }
                    if (budget && budget >= 0.8) {
                        return '*тревожно* Бюджет ' + Math.round(budget * 100) + '%!';
                    }
                    let line = sessions + ' сессия' + (sessions === 1 ? '' : sessions < 5 ? 'и' : 'й');
                    if (msgs > 0) line += ' · ' + msgs + ' сообщ.';
                    if (pinned > 0) line += ' · ' + pinned + ' pin';
                    if (cost > 0) line += ' · $' + cost.toFixed(2);
                    if (sessions === 0) return 'Нет сессий... Начни чат!';
                    if (msgs === 0 && sessions > 0) return pickRandom([
                        'Сессия открыта_ Ждём сообщение!',
                        '*виляет хвостом* Пиши что-нибудь!',
                    ]);
                    return line;
                }
                case 'settings': {
                    const theme = c.theme || '?';
                    const fontSize = c.fontSize;
                    let line = 'Тема: ' + theme;
                    if (fontSize) line += ' · ' + fontSize + 'px';
                    return line;
                }
                case 'run': {
                    if (c.isRunning) {
                        return 'Эксперимент идёт... ' + (c.elapsed || '');
                    }
                    return 'Жду запуска...';
                }
                default:
                    return '*наблюдает*';
            }
        },

    };

    // [CatModule] Loaded — catode32 cat sprite engine
})();
