# Generates the PWA / home-screen icons in public/ from the JOBLIO mark.
#   any       — the rounded-square mark on a transparent background
#   maskable  — full-bleed brand gradient with the "J" inside the 80% safe zone,
#               so Android can crop it to any shape (circle, squircle…)
#   apple     — full-bleed (iOS rounds the corners itself)
# Usage (Windows PowerShell, from the project root):  .\scripts\generate-pwa-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot "..\public"
$purple = [Drawing.Color]::FromArgb(0x5b, 0x46, 0xe5)
$blue = [Drawing.Color]::FromArgb(0x2f, 0xa7, 0xd6)
$mint = [Drawing.Color]::FromArgb(0x4f, 0xd1, 0xa5)

# The "J" + dots of the 32x32 mark, scaled by $s and offset to ($x, $y).
function Draw-Glyph($g, [float]$x, [float]$y, [float]$s) {
  $pen = New-Object Drawing.Pen([Drawing.Color]::White, (3.1 * $s))
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $g.DrawLine($pen, $x + 19.4 * $s, $y + 9.2 * $s, $x + 19.4 * $s, $y + 18.1 * $s)
  $g.DrawArc($pen, $x + 8.8 * $s, $y + 12.8 * $s, 10.6 * $s, 10.6 * $s, 0, 180)
  $g.FillEllipse([Drawing.Brushes]::White, $x + 16.7 * $s, $y + 6.5 * $s, 5.4 * $s, 5.4 * $s)
  $g.FillEllipse((New-Object Drawing.SolidBrush($mint)), $x + 22.6 * $s, $y + 20.6 * $s, 4 * $s, 4 * $s)
}

function New-Icon([int]$size, [string]$file, [string]$kind) {
  $bmp = New-Object Drawing.Bitmap($size, $size)
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'
  $grad = New-Object Drawing.Drawing2D.LinearGradientBrush((New-Object Drawing.PointF(0, 0)), (New-Object Drawing.PointF($size, $size)), $purple, $blue)
  if ($kind -eq "any") {
    # Rounded square (rx 9.5/32), transparent corners.
    $r = $size * 9.5 / 32 * 2
    $path = New-Object Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $r, $r, 180, 90); $path.AddArc($size - $r, 0, $r, $r, 270, 90)
    $path.AddArc($size - $r, $size - $r, $r, $r, 0, 90); $path.AddArc(0, $size - $r, $r, $r, 90, 90); $path.CloseFigure()
    $g.FillPath($grad, $path)
    Draw-Glyph $g 0 0 ($size / 32)
  } else {
    # Full bleed; maskable keeps the glyph inside the central 80% (Android safe zone).
    $g.FillRectangle($grad, 0, 0, $size, $size)
    $scale = if ($kind -eq "maskable") { 0.62 } else { 0.8 }
    $inner = $size * $scale
    Draw-Glyph $g (($size - $inner) / 2) (($size - $inner) / 2) ($inner / 32)
  }
  $bmp.Save((Join-Path $out $file), [Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  "$file ($size x $size, $kind)"
}

New-Icon 192 "icon-192.png" "any"
New-Icon 512 "icon-512.png" "any"
New-Icon 192 "icon-maskable-192.png" "maskable"
New-Icon 512 "icon-maskable-512.png" "maskable"
New-Icon 180 "apple-touch-icon.png" "apple"
