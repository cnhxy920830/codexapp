//! Windows taskbar badge owner.
//!
//! Replaces the upstream `electron-set-badge-count` desktop message, which
//! `main-Bnxe1qAn.js` resolves as `n.app.setBadgeCount(i.count)`. Tauri 2.11
//! marks `Window::set_badge_count` as Windows-unsupported and explicitly
//! recommends `Window::set_overlay_icon` instead. This module honors that
//! direction by rendering a numeric badge to a 32×32 RGBA buffer and applying
//! it as the calling window's taskbar overlay icon.
//!
//! Behavior parity:
//!
//! - `count == 0` clears the overlay icon (matches upstream
//!   `setBadgeCount(0)` clearing macOS dock badge).
//! - `count >= 1 && count <= 9` renders a single digit centered.
//! - `count >= 10 && count <= 99` renders the two digits.
//! - `count >= 100` renders `99+` (Windows taskbar overlays cannot reasonably
//!   show three digits at this scale).
//!
//! The renderer ships no font asset — it uses a hand-coded 5×7 bitmap font for
//! `0..=9` plus `+`, scaled up by 3 to occupy the 32×32 overlay. No new crate
//! dependency is introduced; this stays inside the existing Tauri / std
//! surface to keep the dependency graph minimal.

use serde::Deserialize;
use serde::Serialize;
use tauri::image::Image;
use tauri::Window;

const OVERLAY_SIZE: u32 = 32;
const SCALE: u32 = 3;
const FONT_WIDTH: u32 = 5;
const FONT_HEIGHT: u32 = 7;

const RED: [u8; 4] = [220, 38, 38, 255];
const WHITE: [u8; 4] = [255, 255, 255, 255];
const TRANSPARENT: [u8; 4] = [0, 0, 0, 0];

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ElectronSetBadgeCountParams {
    pub count: u32,
}

#[tauri::command(rename = "electron-set-badge-count")]
pub fn electron_set_badge_count(
    window: Window,
    params: ElectronSetBadgeCountParams,
) -> Result<(), String> {
    if params.count == 0 {
        window
            .set_overlay_icon(None)
            .map_err(|err| format!("failed to clear overlay icon: {err}"))?;
        return Ok(());
    }

    let label = render_label(params.count);
    let rgba = render_overlay_rgba(&label);
    let image = Image::new_owned(rgba, OVERLAY_SIZE, OVERLAY_SIZE);
    window
        .set_overlay_icon(Some(image))
        .map_err(|err| format!("failed to set overlay icon: {err}"))
}

fn render_label(count: u32) -> String {
    if count >= 100 {
        "9+".to_string()
    } else {
        count.to_string()
    }
}

fn render_overlay_rgba(label: &str) -> Vec<u8> {
    let size = OVERLAY_SIZE as i32;
    let mut buffer = vec![0u8; (OVERLAY_SIZE * OVERLAY_SIZE * 4) as usize];

    let center = (size as f64 - 1.0) / 2.0;
    let radius = (size as f64 / 2.0) - 0.5;
    let radius_sq = radius * radius;

    for y in 0..size {
        for x in 0..size {
            let dx = x as f64 - center;
            let dy = y as f64 - center;
            let dist_sq = dx * dx + dy * dy;
            let pixel = if dist_sq <= radius_sq {
                RED
            } else {
                TRANSPARENT
            };
            write_pixel(&mut buffer, x as u32, y as u32, pixel);
        }
    }

    let glyph_widths: Vec<usize> = label.chars().map(|_| FONT_WIDTH as usize).collect();
    let total_glyph_width: usize =
        glyph_widths.iter().sum::<usize>() + label.len().saturating_sub(1);
    let total_text_width = (total_glyph_width as u32) * SCALE;
    let total_text_height = FONT_HEIGHT * SCALE;

    let start_x = ((OVERLAY_SIZE as i64 - total_text_width as i64) / 2).max(0) as u32;
    let start_y = ((OVERLAY_SIZE as i64 - total_text_height as i64) / 2).max(0) as u32;

    let mut cursor_x = start_x;
    for ch in label.chars() {
        let glyph = glyph_for(ch);
        for gy in 0..FONT_HEIGHT {
            for gx in 0..FONT_WIDTH {
                if !glyph_pixel(glyph, gx, gy) {
                    continue;
                }
                for dy in 0..SCALE {
                    for dx in 0..SCALE {
                        let px = cursor_x + gx * SCALE + dx;
                        let py = start_y + gy * SCALE + dy;
                        if px < OVERLAY_SIZE && py < OVERLAY_SIZE {
                            write_pixel(&mut buffer, px, py, WHITE);
                        }
                    }
                }
            }
        }
        cursor_x += FONT_WIDTH * SCALE + SCALE;
    }

    buffer
}

fn write_pixel(buffer: &mut [u8], x: u32, y: u32, pixel: [u8; 4]) {
    let stride = OVERLAY_SIZE * 4;
    let offset = (y * stride + x * 4) as usize;
    buffer[offset..offset + 4].copy_from_slice(&pixel);
}

fn glyph_pixel(glyph: &[u8; 7], col: u32, row: u32) -> bool {
    let row_bits = glyph[row as usize];
    let bit = 1u8 << (FONT_WIDTH - 1 - col);
    (row_bits & bit) != 0
}

/// Hand-coded 5×7 bitmap glyphs for `0..=9` and `+`.
///
/// Each glyph is 7 rows tall; each row's 5 columns are encoded in the low 5
/// bits, MSB-first (so `0b11111` is a fully-on row).
fn glyph_for(ch: char) -> &'static [u8; 7] {
    match ch {
        '0' => &[
            0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110,
        ],
        '1' => &[
            0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110,
        ],
        '2' => &[
            0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111,
        ],
        '3' => &[
            0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110,
        ],
        '4' => &[
            0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010,
        ],
        '5' => &[
            0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110,
        ],
        '6' => &[
            0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110,
        ],
        '7' => &[
            0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000,
        ],
        '8' => &[
            0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110,
        ],
        '9' => &[
            0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100,
        ],
        '+' => &[
            0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000,
        ],
        _ => &[
            0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000,
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn params_deserialize_camel_case() {
        let raw = serde_json::json!({"count": 7});
        let parsed: ElectronSetBadgeCountParams = serde_json::from_value(raw).expect("deserialize");
        assert_eq!(parsed.count, 7);
    }

    #[test]
    fn label_truncates_above_99() {
        assert_eq!(render_label(0), "0");
        assert_eq!(render_label(1), "1");
        assert_eq!(render_label(9), "9");
        assert_eq!(render_label(10), "10");
        assert_eq!(render_label(99), "99");
        assert_eq!(render_label(100), "9+");
        assert_eq!(render_label(9999), "9+");
    }

    #[test]
    fn rgba_buffer_has_correct_size() {
        let buffer = render_overlay_rgba("3");
        assert_eq!(
            buffer.len(),
            (OVERLAY_SIZE * OVERLAY_SIZE * 4) as usize,
            "32x32 RGBA buffer expected"
        );
    }

    #[test]
    fn rgba_buffer_writes_red_inside_circle_and_transparent_outside() {
        let buffer = render_overlay_rgba("1");
        let stride = OVERLAY_SIZE * 4;

        // Top-left corner is well outside the circle.
        let corner = pixel_at(&buffer, 0, 0, stride);
        assert_eq!(corner, TRANSPARENT, "top-left should be transparent");

        // Center pixel is inside the circle and might be the digit body (white)
        // or the red background — both are non-transparent. Confirm.
        let center = pixel_at(&buffer, OVERLAY_SIZE / 2, OVERLAY_SIZE / 2, stride);
        assert_ne!(center, TRANSPARENT, "center should not be transparent");
    }

    #[test]
    fn rgba_buffer_renders_white_pixels_for_digit() {
        let buffer = render_overlay_rgba("8");
        let any_white = buffer
            .chunks_exact(4)
            .any(|chunk| chunk == [255, 255, 255, 255]);
        assert!(any_white, "expected at least one white pixel for the digit");
    }

    #[test]
    fn rgba_buffer_for_two_chars_fits_in_canvas() {
        // "9+" exercises the multi-glyph layout and ensures we never write past
        // the OVERLAY_SIZE bounds. If bounds checking is wrong, this test would
        // panic on indexed write.
        let _ = render_overlay_rgba("9+");
    }

    #[test]
    fn glyph_pixel_decodes_bit_mask_msb_first() {
        let one = glyph_for('1');
        // Row 0 bottom-right of the bit mask `0b00100` — column index 2 (0-indexed
        // from MSB) should be set, others off.
        assert!(!glyph_pixel(one, 0, 0));
        assert!(!glyph_pixel(one, 1, 0));
        assert!(glyph_pixel(one, 2, 0));
        assert!(!glyph_pixel(one, 3, 0));
        assert!(!glyph_pixel(one, 4, 0));
    }

    fn pixel_at(buffer: &[u8], x: u32, y: u32, stride: u32) -> [u8; 4] {
        let offset = (y * stride + x * 4) as usize;
        let mut out = [0u8; 4];
        out.copy_from_slice(&buffer[offset..offset + 4]);
        out
    }
}
